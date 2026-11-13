import { NextResponse, type NextRequest } from "next/server";
import { completeLogin } from "@/lib/auth/login";
import { finishLogin } from "@/lib/auth/oidc";
import { takeLoginTransaction } from "@/lib/auth/session";

/** Cairn からのコールバック。ID トークンを検証し、部員かどうかを確かめてからセッションを作る */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const toLogin = (error: string) => NextResponse.redirect(new URL(`/login?error=${error}`, origin));

  const tx = await takeLoginTransaction();

  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) {
    return toLogin(providerError === "access_denied" ? "access_denied" : "oidc_failed");
  }
  if (!tx) return toLogin("login_expired");

  let identity;
  try {
    identity = await finishLogin(request.nextUrl.searchParams, tx);
  } catch (error) {
    console.error("[auth/callback] ID トークンを受け取れません", error);
    return toLogin("oidc_failed");
  }

  const result = await completeLogin({ sub: identity.sub, email: identity.email, via: "oidc" });
  if (!result.ok) return toLogin(result.error);
  return NextResponse.redirect(new URL(tx.returnTo, origin));
}
