import { NextResponse, type NextRequest } from "next/server";
import { readOidcSettings } from "@/lib/auth/env";
import { beginLogin } from "@/lib/auth/oidc";
import { setLoginTransaction } from "@/lib/auth/session";
import { safeReturnTo } from "@/lib/auth/tokens";

/** Cairn でログインを始める。認可エンドポイントへリダイレクトする */
export async function GET(request: NextRequest) {
  const loginUrl = (error: string) => new URL(`/login?error=${error}`, request.nextUrl.origin);

  // 設定が無ければ、開発用ログインに代替せずエラーを出す
  const settings = readOidcSettings(process.env);
  if (!settings.ok) {
    return NextResponse.redirect(loginUrl("oidc_not_configured"));
  }

  // コールバックは HAISHA_APP_URL に戻る。ログイン途中の Cookie を同じドメインに置くため、別のドメインから来たらそちらで始め直す
  if (request.nextUrl.origin !== settings.appOrigin) {
    const url = new URL(request.nextUrl.pathname + request.nextUrl.search, settings.appOrigin);
    return NextResponse.redirect(url);
  }

  try {
    const { authorizationUrl, tx } = await beginLogin(safeReturnTo(request.nextUrl.searchParams.get("returnTo")));
    await setLoginTransaction(tx);
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    console.error("[auth/login] Cairn でログインを開始できません", error);
    return NextResponse.redirect(loginUrl("oidc_failed"));
  }
}
