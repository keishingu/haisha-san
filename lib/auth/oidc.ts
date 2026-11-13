import "server-only";

import { createRemoteJWKSet, type JWTVerifyGetKey } from "jose";
import * as client from "openid-client";
import { readOidcSettings } from "./env";
import { verifyIdToken, type VerifiedIdentity } from "./id-token";
import type { LoginTransaction } from "./tokens";

/**
 * Cairn でログイン（OIDC、認可コード＋PKCE、機密クライアント）。
 * ライブラリは openid-client。配車さんは ID トークンだけを使い、セッションも自前の Cookie で持つので、
 * セッション管理やトークン保存を抱える Auth.js より、ディスカバリと PKCE とトークン交換だけを担う openid-client が合う。
 *
 * エンドポイントは直書きせず、`<issuer>/.well-known/openid-configuration` から読む。
 */

export const OIDC_SCOPE = "openid profile email";

type Discovered = {
  config: client.Configuration;
  keys: JWTVerifyGetKey;
  issuer: string;
  clientId: string;
  redirectUri: string;
};

let discovered: Promise<Discovered> | undefined;
let discoveredFor: string | undefined;

export class OidcNotConfiguredError extends Error {
  constructor(readonly missing: string[]) {
    super(`Cairn でログインの環境変数がありません: ${missing.join(", ")}`);
    this.name = "OidcNotConfiguredError";
  }
}

async function discover(): Promise<Discovered> {
  const settings = readOidcSettings(process.env);
  if (!settings.ok) throw new OidcNotConfiguredError(settings.missing);

  const cacheKey = `${settings.issuer}|${settings.clientId}|${settings.redirectUri}`;
  if (!discovered || discoveredFor !== cacheKey) {
    discoveredFor = cacheKey;
    discovered = (async () => {
      const config = await client.discovery(
        new URL(settings.issuer),
        settings.clientId,
        settings.clientSecret,
      );
      const jwksUri = config.serverMetadata().jwks_uri;
      if (!jwksUri) {
        throw new Error("Cairn の OpenID 設定に jwks_uri がありません");
      }
      return {
        config,
        keys: createRemoteJWKSet(new URL(jwksUri)),
        issuer: settings.issuer,
        clientId: settings.clientId,
        redirectUri: settings.redirectUri,
      };
    })();
    // 失敗したら次のリクエストでやり直す
    discovered.catch(() => {
      discovered = undefined;
    });
  }
  return discovered;
}

/** 認可エンドポイントへのリダイレクト先と、Cookie に保存するログイン途中の値を作る */
export async function beginLogin(returnTo: string): Promise<{ authorizationUrl: URL; tx: LoginTransaction }> {
  const { config, redirectUri } = await discover();
  const codeVerifier = client.randomPKCECodeVerifier();
  const state = client.randomState();
  const nonce = client.randomNonce();
  const authorizationUrl = client.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri,
    scope: OIDC_SCOPE,
    code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
    code_challenge_method: "S256",
    state,
    nonce,
  });
  return { authorizationUrl, tx: { state, nonce, codeVerifier, returnTo } };
}

/**
 * コールバックで認可コードを ID トークンに交換し、検証した ID を返す。
 * アクセストークン・リフレッシュトークンは受け取っても使わず、保存もしない。
 * openid-client はコールバック URL の origin とパスを redirect_uri として送るので、
 * リクエストの URL ではなく登録した redirect_uri にクエリを付けて渡す。
 */
export async function finishLogin(
  callbackParams: URLSearchParams,
  tx: LoginTransaction,
): Promise<VerifiedIdentity> {
  const { config, keys, issuer, clientId, redirectUri } = await discover();
  const callbackUrl = new URL(redirectUri);
  callbackUrl.search = callbackParams.toString();
  const tokens = await client.authorizationCodeGrant(config, callbackUrl, {
    pkceCodeVerifier: tx.codeVerifier,
    expectedState: tx.state,
    expectedNonce: tx.nonce,
    idTokenExpected: true,
  });
  const idToken = tokens.id_token;
  if (!idToken) throw new Error("Cairn から ID トークンが返りませんでした");
  return verifyIdToken(idToken, { issuer, clientId, expectedNonce: tx.nonce, keys });
}
