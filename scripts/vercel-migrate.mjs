// Vercel のビルドで、Neon にマイグレーションを流す（package.json の vercel-build から呼ぶ）。
// 流すのは本番（main）と検証（develop）だけ。PR ごとの Preview は検証の DB を共有しているので、
// まだ develop に入っていないスキーマの変更で検証の DB を変えないよう、流さない。
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

const env = process.env.VERCEL_ENV;
const branch = process.env.VERCEL_GIT_COMMIT_REF;
const shouldMigrate = env === "production" || (env === "preview" && branch === "develop");
if (!shouldMigrate) {
  console.log(`[migrate] スキップ（VERCEL_ENV=${env ?? "なし"}, ブランチ=${branch ?? "なし"}）`);
  process.exit(0);
}

// マイグレーションはプーラーを通さない接続で流す
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL_UNPOOLED / DATABASE_URL が設定されていません");
  process.exit(1);
}
const pool = new Pool({ connectionString: url });
try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log(`[migrate] 適用しました（VERCEL_ENV=${env}, ブランチ=${branch}）`);
} finally {
  await pool.end();
}
