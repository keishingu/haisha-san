import { jwtVerify, type JWTVerifyGetKey } from "jose";

/**
 * Cairn の OIDC プロバイダー（issuer は <Cairn の URL>/oidc、ES256）が発行した ID トークンの検証。
 * - JWKS で署名を検証する（openid-client はトークンエンドポイントの ID トークンの署名を既定では検証しないため、ここで明示的に行う）
 * - iss = CAIRN_OIDC_ISSUER、aud に client ID を含むこと、nonce の一致を確かめる
 * - sub を Cairn のユーザーIDとして使う
 *
 * アクセストークン・リフレッシュトークンはここに渡さないし、どこにも保存しない。
 */

export class IdTokenError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "IdTokenError";
  }
}

export type VerifiedIdentity = {
  /** Cairn のユーザーID */
  sub: string;
  email: string | null;
};

export async function verifyIdToken(
  idToken: string,
  options: {
    issuer: string;
    clientId: string;
    expectedNonce: string;
    keys: JWTVerifyGetKey;
    now?: Date;
  },
): Promise<VerifiedIdentity> {
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, options.keys, {
      issuer: options.issuer,
      audience: options.clientId,
      currentDate: options.now,
      // 対称鍵（HS256）は JWKS で検証できないので受け付けない
      algorithms: ["RS256", "ES256", "PS256", "EdDSA"],
      requiredClaims: ["sub", "iat", "exp"],
    }));
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new IdTokenError(`ID トークンを検証できません: ${detail}`, { cause });
  }

  if (payload.nonce !== options.expectedNonce) {
    throw new IdTokenError("ID トークンの nonce が一致しません");
  }
  // aud が複数あるときは、自分宛て（azp）であることも確かめる
  if (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== options.clientId) {
    throw new IdTokenError("ID トークンの azp が client ID と一致しません");
  }
  if (typeof payload.sub !== "string" || payload.sub === "") {
    throw new IdTokenError("ID トークンに sub がありません");
  }

  const email =
    typeof payload.email === "string" && payload.email_verified !== false
      ? payload.email
      : null;
  return { sub: payload.sub, email };
}
