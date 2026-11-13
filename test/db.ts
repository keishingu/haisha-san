import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";
import type { Database } from "@/db/types";

/** テスト用の DB。メモリ上の PostgreSQL（PGlite）に、本番と同じマイグレーションを流す */
export async function createTestDb(): Promise<{ db: Database; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return { db: db as unknown as Database, close: () => client.close() };
}

export async function seedMember(db: Database, cairnUserId: string, role: "member" | "kakari" = "member") {
  await db.insert(schema.members).values({ cairnUserId, role });
}
