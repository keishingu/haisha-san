import "server-only";

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { isProduction } from "@/lib/auth/env";
import * as schema from "./schema";
import type { Database } from "./types";

export type { Database, Transaction } from "./types";

let instance: Promise<Database> | undefined;

/**
 * ローカル開発用: DATABASE_URL=pglite:<ディレクトリ> なら、ファイルに保存する PGlite を使う（Neon が無くても画面を試せる）。
 * 本番で設定されていたらエラーにする。テーブルは `pnpm db:dev-migrate` で作る。
 */
async function createLocalDb(dataDir: string): Promise<Database> {
  if (isProduction(process.env)) {
    throw new Error("DATABASE_URL=pglite: は本番では使えません");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  // Next.js の開発サーバーでは、画面と Route Handler でこのモジュールが別々に読み込まれることがある。
  // 同じフォルダを2つの PGlite で開くと互いの書き込みが見えず、ファイルも壊れるので、プロセスで1つにする
  const g = globalThis as typeof globalThis & { __haishaPglite?: Map<string, InstanceType<typeof PGlite>> };
  g.__haishaPglite ??= new Map();
  let client = g.__haishaPglite.get(dataDir);
  if (!client) {
    client = new PGlite(dataDir);
    g.__haishaPglite.set(dataDir, client);
  }
  return drizzlePglite(client, { schema }) as unknown as Database;
}

/**
 * DB への接続。トランザクションを使えるよう、Neon の WebSocket の Pool を使う。
 * import しただけでは接続しない（ビルド時に DATABASE_URL を要求しないため）。
 */
export function getDb(): Promise<Database> {
  instance ??= (async () => {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("環境変数 DATABASE_URL が設定されていません");
    }
    if (url.startsWith("pglite:")) return createLocalDb(url.slice("pglite:".length));
    return drizzle(new Pool({ connectionString: url }), { schema });
  })();
  instance.catch(() => {
    instance = undefined;
  });
  return instance;
}
