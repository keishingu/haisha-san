import { EncryptJWT, SignJWT, jwtDecrypt, jwtVerify } from "jose";

/**
 * 配車さん自身が発行する Cookie の中身（純粋関数）。
 * - セッション: HS256 で署名した JWT。中身は Cairn のユーザーIDとログイン方法だけ
 * - ログイン途中の state / nonce / PKCE の code_verifier: 暗号化した JWT（10分で失効）
 */

const ISSUER = "haisha-san";
export const SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;
export const LOGIN_TX_MAX_AGE_SECONDS = 10 * 60;

export type SessionPayload = {
  /** Cairn のユーザーID（OIDC の sub） */
  sub: string;
  /** oidc = Cairn でログイン、dev = 開発用ログイン */
  via: "oidc" | "dev";
};

export async function signSession(
  payload: SessionPayload,
  secret: Uint8Array,
  now: Date = new Date(),
): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({ via: payload.via })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience("haisha:session")
    .setSubject(payload.sub)
    .setIssuedAt(iat)
    .setExpirationTime(iat + SESSION_MAX_AGE_SECONDS)
    .sign(secret);
}

/**
 * 署名・期限を確かめる。開発用ログインのセッションは、開発用ログインが有効なときだけ受け付ける。
 * 不正・期限切れは null（呼び出し側でログイン画面へ）。
 */
export async function verifySession(
  token: string,
  secret: Uint8Array,
  options: { devLoginEnabled: boolean; now?: Date },
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: "haisha:session",
      algorithms: ["HS256"],
      currentDate: options.now,
    });
    const via = payload.via;
    if (!payload.sub || (via !== "oidc" && via !== "dev")) return null;
    if (via === "dev" && !options.devLoginEnabled) return null;
    return { sub: payload.sub, via };
  } catch {
    return null;
  }
}

export type LoginTransaction = {
  state: string;
  nonce: string;
  codeVerifier: string;
  /** ログイン後に戻る配車さん内のパス */
  returnTo: string;
};

async function txKey(secret: Uint8Array): Promise<Uint8Array> {
  const label = new TextEncoder().encode("haisha:login-tx:");
  const material = new Uint8Array(label.length + secret.length);
  material.set(label);
  material.set(secret, label.length);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", material));
}

export async function sealLoginTransaction(
  tx: LoginTransaction,
  secret: Uint8Array,
  now: Date = new Date(),
): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new EncryptJWT({ ...tx })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuer(ISSUER)
    .setIssuedAt(iat)
    .setExpirationTime(iat + LOGIN_TX_MAX_AGE_SECONDS)
    .encrypt(await txKey(secret));
}

export async function openLoginTransaction(
  sealed: string,
  secret: Uint8Array,
  now?: Date,
): Promise<LoginTransaction | null> {
  try {
    const { payload } = await jwtDecrypt(sealed, await txKey(secret), {
      issuer: ISSUER,
      currentDate: now,
    });
    const { state, nonce, codeVerifier, returnTo } = payload;
    if (
      typeof state !== "string" ||
      typeof nonce !== "string" ||
      typeof codeVerifier !== "string" ||
      typeof returnTo !== "string"
    ) {
      return null;
    }
    return { state, nonce, codeVerifier, returnTo: safeReturnTo(returnTo) };
  } catch {
    return null;
  }
}

/** オープンリダイレクトを防ぐ。配車さん内の絶対パスだけを許す */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  return value;
}
