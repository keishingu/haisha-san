// @vitest-environment node
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { beforeAll, describe, expect, test } from "vitest";
import { IdTokenError, verifyIdToken } from "./id-token";

const ISSUER = "https://oss-cairn.com/oidc";
const CLIENT_ID = "rack-client";
const NONCE = "nonce-123";
const now = new Date("2026-11-03T00:00:00Z");
const iat = Math.floor(now.getTime() / 1000);

let privateKey: CryptoKey;
let otherPrivateKey: CryptoKey;
let keys: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const pair = await generateKeyPair("ES256");
  const other = await generateKeyPair("ES256");
  privateKey = pair.privateKey;
  otherPrivateKey = other.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "ES256" };
  keys = createLocalJWKSet({ keys: [jwk] });
});

function idToken(claims: Record<string, unknown>, key = privateKey) {
  return new SignJWT({ nonce: NONCE, email: "a@example.com", ...claims })
    .setProtectedHeader({ alg: "ES256", kid: "k1" })
    .setIssuer((claims.iss as string) ?? ISSUER)
    .setAudience((claims.aud as string | string[]) ?? CLIENT_ID)
    .setSubject((claims.sub as string) ?? "cairn-user-1")
    .setIssuedAt(iat)
    .setExpirationTime(iat + 300)
    .sign(key);
}

const verify = (token: string) =>
  verifyIdToken(token, { issuer: ISSUER, clientId: CLIENT_ID, expectedNonce: NONCE, keys, now });

describe("ID トークンの検証", () => {
  test("正しいトークンなら sub を Cairn のユーザーIDとして返す", async () => {
    await expect(verify(await idToken({}))).resolves.toEqual({
      sub: "cairn-user-1",
      email: "a@example.com",
    });
  });

  test("JWKS に無い鍵で署名されたものは拒否する", async () => {
    await expect(verify(await idToken({}, otherPrivateKey))).rejects.toThrow(IdTokenError);
  });

  test("iss が違えば拒否する", async () => {
    await expect(verify(await idToken({ iss: "https://develop.oss-cairn.com/oidc" }))).rejects.toThrow(
      IdTokenError,
    );
  });

  test("aud が client ID でなければ拒否する", async () => {
    await expect(verify(await idToken({ aud: "another-client" }))).rejects.toThrow(IdTokenError);
  });

  test("nonce が違えば拒否する", async () => {
    await expect(verify(await idToken({ nonce: "other" }))).rejects.toThrow(/nonce/);
  });

  test("aud が複数で azp が自分でなければ拒否する", async () => {
    await expect(
      verify(await idToken({ aud: [CLIENT_ID, "x"], azp: "x" })),
    ).rejects.toThrow(/azp/);
  });

  test("email_verified が false ならメールアドレスを使わない", async () => {
    await expect(verify(await idToken({ email_verified: false }))).resolves.toMatchObject({
      email: null,
    });
  });

  test("HS256 のトークンは受け付けない", async () => {
    const hs = await new SignJWT({ nonce: NONCE })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setSubject("cairn-user-1")
      .setIssuedAt(iat)
      .setExpirationTime(iat + 300)
      .sign(new TextEncoder().encode("s".repeat(32)));
    await expect(verify(hs)).rejects.toThrow(IdTokenError);
  });
});
