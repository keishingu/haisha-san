import { NextResponse, type NextRequest } from "next/server";
import { REQUEST_PATH_HEADER } from "@/lib/auth/return-to";

/**
 * 開こうとした画面のパスを、リクエストヘッダーで getCurrentMember に渡す。
 * ログインしていないときに /login?returnTo=... へ送り、ログイン後に同じ画面（共有されたプランなど）へ戻すため。
 * 認可の判定はここではしない（画面・Server Action・Route Handler の getCurrentMember で行う）。
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(REQUEST_PATH_HEADER, request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|auth/|login|sample).*)"],
};
