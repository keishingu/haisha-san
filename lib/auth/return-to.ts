import { safeReturnTo } from "./tokens";

/** proxy.ts が付ける、開こうとした画面のパス */
export const REQUEST_PATH_HEADER = "x-haisha-request-path";

/** ログイン画面の URL。戻り先が配車さん内のパスで、ホーム以外なら returnTo に付ける */
export function loginUrlFor(requestedPath: string | null | undefined): string {
  const returnTo = safeReturnTo(requestedPath);
  return returnTo === "/" ? "/login" : `/login?returnTo=${encodeURIComponent(returnTo)}`;
}
