import type { NextConfig } from "next";
import { assertDevLoginNotInProduction } from "./lib/auth/env";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // ローカル開発用の PGlite（wasm）はバンドルせずに読む
  serverExternalPackages: ["@electric-sql/pglite"],
};

// Vercel の Production 環境のビルドで HAISHA_DEV_LOGIN=1 なら、デプロイ前に止める。
// 本番での起動時のチェックは instrumentation.ts（NODE_ENV=production も対象）
if (process.env.VERCEL_ENV === "production") {
  assertDevLoginNotInProduction(process.env);
}

export default nextConfig;
