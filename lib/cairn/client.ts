import "server-only";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createHash } from "node:crypto";
import { cache } from "react";
import type { z } from "zod";
import { CairnError } from "./errors";
import { parseToolResult, type ToolCallResult } from "./parse";
import {
  getProjectMembersResultSchema,
  getProjectResultSchema,
  listMembersResultSchema,
  listProjectsResultSchema,
} from "./schemas";

/**
 * Cairn とのやり取りはこのモジュールに集める。
 * いまは PAT（CAIRN_PAT, read スコープ）でリモート MCP を呼ぶ。
 * 将来 Bot API（projects:read）に置き換えるときは、このファイルの中身だけを差し替える。
 *
 * ユーザーのログイン（OIDC）で得たトークンでは、Cairn を呼ばない。
 *
 * 速さのため、2 段で使い回す（Vercel の sin1 から東京の Cairn へは 1 往復が重い）。
 * - 接続: 1 リクエストにつき MCP の接続（initialize）を 1 回だけ行い、その中のツール呼び出しで共有する
 * - 結果: 成功した結果だけを、サーバーインスタンスごとに 60 秒メモリに持つ（エラーは持たない）
 */

const DEFAULT_MCP_URL = "https://oss-cairn.com/api/mcp";

function connectionSettings(): { url: URL; pat: string } {
  const pat = process.env.CAIRN_PAT;
  if (!pat) {
    throw new CairnError("not_configured", "環境変数 CAIRN_PAT が設定されていません");
  }
  return { url: new URL(process.env.CAIRN_MCP_URL ?? DEFAULT_MCP_URL), pat };
}

function toCairnError(toolName: string, error: unknown): CairnError {
  if (error instanceof CairnError) return error;
  if (error instanceof StreamableHTTPError && (error.code === 401 || error.code === 403)) {
    return new CairnError("unauthorized", `Cairn の認証に失敗しました（${error.code}）`, {
      cause: error,
    });
  }
  const detail = error instanceof Error ? error.message : String(error);
  return new CairnError("unavailable", `Cairn の ${toolName} を呼べませんでした: ${detail}`, {
    cause: error,
  });
}

/**
 * MCP の SDK は初期化のあと、サーバーからの通知を受けるための GET（SSE）を開きっぱなしにする。
 * 配車さんは読み取りのツールを呼ぶだけで通知は使わないので、GET には仕様どおり 405 を返したことにして開かない
 * （開いた接続を閉じるときの中断が、Next.js の中で拾われない例外になるため）。
 */
const fetchWithoutServerStream: typeof fetch = (input, init) => {
  if ((init?.method ?? "GET").toUpperCase() === "GET") {
    return Promise.resolve(new Response(null, { status: 405 }));
  }
  return fetch(input, init);
};

/** セッションが無効になったとみなすエラー（サーバー側で期限切れ・再起動など）。接続し直して 1 回だけ再試行する */
function isSessionError(error: unknown): boolean {
  return error instanceof StreamableHTTPError && (error.code === 404 || error.code === 400);
}

type ConnectFn = () => Promise<Client>;

async function connectClient(): Promise<Client> {
  const { url, pat } = connectionSettings();
  const client = new Client({ name: "haisha-san", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: { headers: { Authorization: `Bearer ${pat}` } },
    fetch: fetchWithoutServerStream,
  });
  await client.connect(transport);
  return client;
}

/**
 * 1 リクエスト分の MCP 接続。最初の呼び出しで接続し、同時に来た呼び出しは同じ接続の完了を待つ。
 * 接続に失敗したら、その失敗は持ち越さない（次の呼び出しでやり直す）。
 * 通知用の SSE を開いていないので、明示的には閉じない（他の呼び出しを巻き込まないため）。
 */
export class McpSession {
  private clientPromise: Promise<Client> | null = null;

  constructor(private readonly connect: ConnectFn) {}

  private acquire(): Promise<Client> {
    if (!this.clientPromise) {
      const promise = this.connect();
      this.clientPromise = promise;
      promise.catch(() => {
        if (this.clientPromise === promise) this.clientPromise = null;
      });
    }
    return this.clientPromise;
  }

  /** 失敗した接続だけを捨てる（すでに別の接続に替わっていたらそのまま） */
  private discard(failed: Promise<Client>) {
    if (this.clientPromise === failed) this.clientPromise = null;
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    for (let attempt = 0; ; attempt++) {
      const promise = this.acquire();
      try {
        const client = await promise;
        return (await client.callTool({ name: toolName, arguments: args })) as ToolCallResult;
      } catch (error) {
        if (attempt === 0 && isSessionError(error)) {
          this.discard(promise);
          continue;
        }
        throw toCairnError(toolName, error);
      }
    }
  }
}

// 同じリクエストの中では、接続を 1 つにまとめる（React の cache はリクエスト単位）
const getSession = cache(() => new McpSession(connectClient));

// ---- 60 秒のメモリキャッシュ（成功した結果だけ） ----

export const CACHE_TTL_MS = 60_000;

type CacheEntry = { expiresAt: number; value: unknown };
const resultCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

/** PAT や URL を生のままキーにしない（メモリのダンプやログに出さないため） */
function cacheKey(toolName: string, args: Record<string, unknown>): string {
  const { url, pat } = connectionSettings();
  const scope = createHash("sha256").update(`${url.href}\0${pat}`).digest("hex");
  return `${scope}:${toolName}:${JSON.stringify(args)}`;
}

/** テスト用: キャッシュを空にする */
export function __resetCacheForTests() {
  resultCache.clear();
  inflight.clear();
}

/**
 * ツールを呼び、検証（と load の後処理）まで通った結果だけを 60 秒持つ。
 * 同じキーの未完了の呼び出しは 1 つにまとめる。失敗は持たない。
 */
async function cachedCall<S extends z.ZodType, R = z.infer<S>>(
  toolName: string,
  args: Record<string, unknown>,
  schema: S,
  finalize: (result: z.infer<S>) => R = (result) => result as unknown as R,
): Promise<R> {
  const key = cacheKey(toolName, args);
  const hit = resultCache.get(key);
  if (hit) {
    if (hit.expiresAt > Date.now()) return hit.value as R;
    resultCache.delete(key);
  }
  const pending = inflight.get(key);
  if (pending) return pending as Promise<R>;

  const promise = (async () => {
    const raw = await getSession().callTool(toolName, args);
    const value = finalize(parseToolResult(toolName, raw, schema));
    resultCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
    return value;
  })().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

// React の cache でリクエスト内の重複も省く。

export const listProjects = cache(() =>
  cachedCall("list_projects", {}, listProjectsResultSchema),
);

export const getProject = cache((projectId: string) =>
  cachedCall("get_project", { projectId }, getProjectResultSchema),
);

/** 山行のメンバー。切り詰められたら、一部のメンバーだけで判断しないようエラーにする（エラーはキャッシュしない） */
export const getProjectMembers = cache((projectId: string) =>
  cachedCall("get_project_members", { projectId }, getProjectMembersResultSchema, (result) => {
    if (result.truncated) {
      throw new CairnError(
        "invalid_response",
        `Cairn の山行のメンバーが多すぎて、全員を取得できません（${result.totalCount ?? "不明"} 人）`,
      );
    }
    return result;
  }),
);

/** list_members の1回の上限 */
export const LIST_MEMBERS_MAX = 200;

/**
 * ワークスペースのメンバーを全員取る。
 * 上限を超えて切り詰められたら、一部だけで判断しないようエラーにする。
 */
export const listAllWorkspaceMembers = cache(() =>
  cachedCall("list_members", { limit: LIST_MEMBERS_MAX }, listMembersResultSchema, (result) => {
    if (result.truncated) {
      throw new CairnError(
        "invalid_response",
        `Cairn のメンバーが ${LIST_MEMBERS_MAX} 人を超えていて、全員を取得できません（${result.totalCount} 人）`,
      );
    }
    return result.items;
  }),
);
