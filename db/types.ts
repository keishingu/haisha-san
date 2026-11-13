import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

type Schema = typeof schema;

/**
 * ドライバに依存しない DB の型。本番は Neon（neon-serverless）、テストは PGlite を渡す。
 * サービス層の関数はこの型を受け取る。
 */
export type Database = PgDatabase<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;

export type Transaction = PgTransaction<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;

/** トランザクションの中でも外でも呼べる関数のための型 */
export type Executor = Database | Transaction;
