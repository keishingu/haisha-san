// ローカル開発用の PGlite（DATABASE_URL=pglite:<ディレクトリ>）にマイグレーションを流す。
//   pnpm db:dev-migrate
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local が無ければ環境変数をそのまま使う
}

const url = process.env.DATABASE_URL ?? "";
if (!url.startsWith("pglite:")) {
  console.error("DATABASE_URL が pglite:<ディレクトリ> ではありません。Neon には pnpm db:migrate を使ってください。");
  process.exit(1);
}
const client = new PGlite(url.slice("pglite:".length));
await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
await client.close();
console.log(`migrated: ${url}`);
