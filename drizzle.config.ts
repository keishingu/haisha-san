import { defineConfig } from "drizzle-kit";

// ローカルでは .env.local を読む（Vercel では環境変数が直接入る）
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local が無ければ環境変数をそのまま使う
}

if (!process.env.DATABASE_URL) {
  throw new Error("環境変数 DATABASE_URL が設定されていません");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL },
  strict: true,
  verbose: true,
});
