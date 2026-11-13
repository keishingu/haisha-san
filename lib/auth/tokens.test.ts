// @vitest-environment node
import { describe, expect, test } from "vitest";
import {
  SESSION_MAX_AGE_SECONDS,
  openLoginTransaction,
  safeReturnTo,
  sealLoginTransaction,
  signSession,
  verifySession,
} from "./tokens";

const secret = new TextEncoder().encode("x".repeat(32));
const otherSecret = new TextEncoder().encode("y".repeat(32));
const now = new Date("2026-11-03T00:00:00Z");

describe("セッション Cookie", () => {
  test("署名したセッションを読み戻せる", async () => {
    const token = await signSession({ sub: "u1", via: "oidc" }, secret, now);
    await expect(verifySession(token, secret, { devLoginEnabled: false, now })).resolves.toEqual({
      sub: "u1",
      via: "oidc",
    });
  });

  test("別の鍵で署名されたものは受け付けない", async () => {
    const token = await signSession({ sub: "u1", via: "oidc" }, otherSecret, now);
    await expect(verifySession(token, secret, { devLoginEnabled: false, now })).resolves.toBeNull();
  });

  test("期限切れは受け付けない", async () => {
    const token = await signSession({ sub: "u1", via: "oidc" }, secret, now);
    const later = new Date(now.getTime() + (SESSION_MAX_AGE_SECONDS + 1) * 1000);
    await expect(verifySession(token, secret, { devLoginEnabled: false, now: later })).resolves.toBeNull();
  });

  test("開発用ログインのセッションは、開発用ログインが無効なら受け付けない", async () => {
    const token = await signSession({ sub: "u1", via: "dev" }, secret, now);
    await expect(verifySession(token, secret, { devLoginEnabled: false, now })).resolves.toBeNull();
    await expect(verifySession(token, secret, { devLoginEnabled: true, now })).resolves.toEqual({
      sub: "u1",
      via: "dev",
    });
  });
});

describe("ログイン途中の値", () => {
  const tx = { state: "s", nonce: "n", codeVerifier: "v", returnTo: "/calendar" };

  test("暗号化して読み戻せる", async () => {
    const sealed = await sealLoginTransaction(tx, secret, now);
    expect(sealed).not.toContain("calendar");
    await expect(openLoginTransaction(sealed, secret, now)).resolves.toEqual(tx);
  });

  test("10分を過ぎたら読めない", async () => {
    const sealed = await sealLoginTransaction(tx, secret, now);
    const later = new Date(now.getTime() + 11 * 60 * 1000);
    await expect(openLoginTransaction(sealed, secret, later)).resolves.toBeNull();
  });

  test("別の鍵では読めない", async () => {
    const sealed = await sealLoginTransaction(tx, otherSecret, now);
    await expect(openLoginTransaction(sealed, secret, now)).resolves.toBeNull();
  });
});

describe("ログイン後の戻り先", () => {
  test.each([
    ["/calendar", "/calendar"],
    ["https://evil.example", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["/\t/evil.example", "/"],
    ["/\n/evil.example", "/"],
    ["/%09/evil.example", "/%09/evil.example"],
    ["/plans/abc?x=1#y", "/plans/abc?x=1#y"],
    [null, "/"],
  ])("%s は %s にする", (input, expected) => {
    expect(safeReturnTo(input)).toBe(expected);
  });
});
