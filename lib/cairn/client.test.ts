// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// 「リクエスト」の境界を再現するため、React の cache を手動でリセットできるメモ化に差し替える
const memos = vi.hoisted(() => [] as Map<string, unknown>[]);
vi.mock("react", () => ({
  cache: <A extends unknown[], R>(fn: (...args: A) => R) => {
    const memo = new Map<string, unknown>();
    memos.push(memo);
    return (...args: A): R => {
      const key = JSON.stringify(args);
      if (!memo.has(key)) memo.set(key, fn(...args));
      return memo.get(key) as R;
    };
  },
}));
vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  callTool: vi.fn(),
  transportOptions: [] as unknown[],
}));

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: class {
    connect = mocks.connect;
    callTool = mocks.callTool;
  },
}));
vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", async () => {
  class StreamableHTTPError extends Error {
    constructor(
      public readonly code: number | undefined,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    StreamableHTTPError,
    StreamableHTTPClientTransport: class {
      constructor(_url: URL, options: unknown) {
        mocks.transportOptions.push(options);
      }
    },
  };
});

import { StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CairnError } from "./errors";
import {
  __resetCacheForTests,
  getProject,
  getProjectMembers,
  listAllWorkspaceMembers,
  listProjects,
} from "./client";

const PAT = "secret-pat-value";
const json = (value: unknown) => ({ content: [{ type: "text", text: JSON.stringify(value) }] });
const project = { id: "p1", title: "山行", startDate: null, endDate: null, archived: false };

/** 新しいリクエストを始める（React cache の中身だけを捨てる。モジュールのメモリキャッシュは残る） */
function newRequest() {
  for (const memo of memos) memo.clear();
}

beforeEach(() => {
  vi.useFakeTimers();
  process.env.CAIRN_PAT = PAT;
  delete process.env.CAIRN_MCP_URL;
  mocks.connect.mockReset().mockResolvedValue(undefined);
  mocks.callTool.mockReset();
  mocks.transportOptions.length = 0;
  __resetCacheForTests();
  newRequest();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Cairn クライアントの接続", () => {
  test("同じリクエストの中では、複数のツールを呼んでも接続は1回だけ", async () => {
    mocks.callTool.mockResolvedValue(json([project]));
    await listProjects();
    mocks.callTool.mockResolvedValue(json({ ...project, description: null }));
    await Promise.all([getProject("p1"), getProject("p2")]);
    expect(mocks.callTool).toHaveBeenCalledTimes(3);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
  });

  test("リクエストが変わると接続し直す", async () => {
    mocks.callTool.mockResolvedValue(json({ ...project }));
    await getProject("p1");
    newRequest();
    await getProject("p2");
    expect(mocks.connect).toHaveBeenCalledTimes(2);
  });

  test("同時に来た呼び出しは同じ接続の完了を待つ", async () => {
    let release!: () => void;
    mocks.connect.mockReturnValue(new Promise<void>((resolve) => (release = resolve)));
    mocks.callTool.mockResolvedValue(json({ ...project }));
    const calls = Promise.all([getProject("a"), getProject("b"), getProject("c")]);
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.callTool).not.toHaveBeenCalled();
    release();
    await calls;
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(mocks.callTool).toHaveBeenCalledTimes(3);
  });

  test("接続に失敗したら CairnError になり、次のリクエストでやり直せる", async () => {
    mocks.connect.mockRejectedValueOnce(new Error("接続できない"));
    await expect(getProject("p1")).rejects.toBeInstanceOf(CairnError);
    newRequest();
    mocks.callTool.mockResolvedValue(json({ ...project }));
    await expect(getProject("p1")).resolves.toMatchObject({ id: "p1" });
    expect(mocks.connect).toHaveBeenCalledTimes(2);
  });

  test("接続の失敗は同じリクエストの中でも持ち越さず、次の呼び出しで再接続する", async () => {
    mocks.connect.mockRejectedValueOnce(new Error("接続できない"));
    await expect(getProject("p1")).rejects.toBeInstanceOf(CairnError);
    mocks.callTool.mockResolvedValue(json({ ...project }));
    await expect(getProject("p2")).resolves.toBeDefined();
    expect(mocks.connect).toHaveBeenCalledTimes(2);
  });

  test("401 は unauthorized の CairnError になる", async () => {
    mocks.callTool.mockRejectedValue(new StreamableHTTPError(401, "Unauthorized"));
    await expect(getProject("p1")).rejects.toMatchObject({ kind: "unauthorized" });
  });

  test("セッションが無効（404）になったら、接続し直して1回だけ再試行する", async () => {
    mocks.callTool
      .mockRejectedValueOnce(new StreamableHTTPError(404, "Session not found"))
      .mockResolvedValueOnce(json({ ...project }));
    await expect(getProject("p1")).resolves.toMatchObject({ id: "p1" });
    expect(mocks.connect).toHaveBeenCalledTimes(2);
    expect(mocks.callTool).toHaveBeenCalledTimes(2);
  });

  test("再試行しても失敗したら CairnError にする（無限に繰り返さない）", async () => {
    mocks.callTool.mockRejectedValue(new StreamableHTTPError(404, "Session not found"));
    await expect(getProject("p1")).rejects.toBeInstanceOf(CairnError);
    expect(mocks.callTool).toHaveBeenCalledTimes(2);
  });

  test("通知用の GET（SSE）は開かず 405 を返す", async () => {
    mocks.callTool.mockResolvedValue(json({ ...project }));
    await getProject("p1");
    const options = mocks.transportOptions[0] as { fetch: typeof fetch };
    const response = await options.fetch("https://example.test/mcp", { method: "GET" });
    expect(response.status).toBe(405);
  });
});

describe("Cairn の結果の60秒キャッシュ", () => {
  test("60秒以内なら別のリクエストでもツールを呼び直さない", async () => {
    mocks.callTool.mockResolvedValue(json([project]));
    await listProjects();
    newRequest();
    vi.advanceTimersByTime(59_000);
    await listProjects();
    expect(mocks.callTool).toHaveBeenCalledTimes(1);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
  });

  test("60秒を過ぎたら取り直す", async () => {
    mocks.callTool.mockResolvedValue(json([project]));
    await listProjects();
    newRequest();
    vi.advanceTimersByTime(60_001);
    await listProjects();
    expect(mocks.callTool).toHaveBeenCalledTimes(2);
  });

  test("引数が違えば別のキャッシュになる", async () => {
    mocks.callTool.mockResolvedValue(json({ ...project }));
    await getProject("p1");
    newRequest();
    await getProject("p2");
    expect(mocks.callTool).toHaveBeenCalledTimes(2);
  });

  test("エラーはキャッシュしない", async () => {
    mocks.callTool.mockRejectedValueOnce(new Error("落ちた")).mockResolvedValueOnce(json([project]));
    await expect(listProjects()).rejects.toBeInstanceOf(CairnError);
    newRequest();
    await expect(listProjects()).resolves.toHaveLength(1);
    expect(mocks.callTool).toHaveBeenCalledTimes(2);
  });

  test("検証に通らない結果はキャッシュしない", async () => {
    mocks.callTool.mockResolvedValueOnce(json({ unexpected: true })).mockResolvedValueOnce(json([project]));
    await expect(listProjects()).rejects.toMatchObject({ kind: "invalid_response" });
    newRequest();
    await expect(listProjects()).resolves.toHaveLength(1);
    expect(mocks.callTool).toHaveBeenCalledTimes(2);
  });

  test("切り詰められたメンバーはエラーのままで、キャッシュしない", async () => {
    const truncated = {
      items: [{ userId: "u1", name: "A", membershipStatus: "active" }],
      totalCount: 500,
      truncated: true,
    };
    mocks.callTool.mockResolvedValue(json(truncated));
    await expect(listAllWorkspaceMembers()).rejects.toMatchObject({ kind: "invalid_response" });
    newRequest();
    await expect(listAllWorkspaceMembers()).rejects.toMatchObject({ kind: "invalid_response" });
    expect(mocks.callTool).toHaveBeenCalledTimes(2);
  });

  test("同時に来た同じ呼び出しは1回にまとまる（リクエストが別でも）", async () => {
    let release!: (value: unknown) => void;
    mocks.callTool.mockReturnValue(new Promise((resolve) => (release = resolve)));
    const first = getProjectMembers("p1");
    newRequest();
    const second = getProjectMembers("p1");
    await vi.advanceTimersByTimeAsync(0);
    release(json({ items: [], totalCount: 0, truncated: false }));
    await Promise.all([first, second]);
    expect(mocks.callTool).toHaveBeenCalledTimes(1);
  });

  test("PAT をそのままキャッシュのキーにしない", async () => {
    const setSpy = vi.spyOn(Map.prototype, "set");
    mocks.callTool.mockResolvedValue(json([project]));
    await listProjects();
    const keys = setSpy.mock.calls.map(([key]) => String(key));
    setSpy.mockRestore();
    expect(keys.some((key) => key.includes("list_projects"))).toBe(true);
    expect(keys.every((key) => !key.includes(PAT))).toBe(true);
  });

  test("PAT が変われば別のキャッシュになる", async () => {
    mocks.callTool.mockResolvedValue(json([project]));
    await listProjects();
    process.env.CAIRN_PAT = "another-pat";
    newRequest();
    await listProjects();
    expect(mocks.callTool).toHaveBeenCalledTimes(2);
  });
});
