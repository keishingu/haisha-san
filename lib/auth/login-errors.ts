/** ログイン画面に出すエラー。クエリ ?error=<code> で渡す */
export const LOGIN_ERRORS = {
  not_member: "部のワークスペースのメンバーではありません。",
  cairn_unavailable:
    "Cairn から部員かどうかを確かめられませんでした。時間をおいてもう一度ログインしてください。続く場合は配車係に連絡してください。",
  oidc_not_configured:
    "Cairn でログインの設定がありません。管理者に連絡してください。",
  initial_admin_invalid:
    "最初の配車係の設定（環境変数 HAISHA_INITIAL_ADMIN_CAIRN_USER_IDS）が正しくありません。メールアドレスではなく Cairn のユーザーID（UUID）を入れてください。管理者に連絡してください。",
  oidc_failed: "Cairn でのログインに失敗しました。もう一度お試しください。",
  login_expired: "ログインの手続きが期限切れになりました。もう一度お試しください。",
  access_denied: "Cairn でのログインがキャンセルされました。",
} as const;

export type LoginErrorCode = keyof typeof LOGIN_ERRORS;

export function loginErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return code in LOGIN_ERRORS
    ? LOGIN_ERRORS[code as LoginErrorCode]
    : "ログインに失敗しました。もう一度お試しください。";
}
