import { assertDevLoginNotInProduction } from "@/lib/auth/env";

/** サーバー起動時に1回だけ呼ばれる。本番で開発用ログインが有効なら起動を止める */
export function register() {
  assertDevLoginNotInProduction(process.env);
}
