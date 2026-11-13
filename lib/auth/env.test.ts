// @vitest-environment node
import { describe, expect, test } from "vitest";
import {
  assertDevLoginNotInProduction,
  isDevLoginEnabled,
  readInitialAdminIds,
  readOidcSettings,
  readSessionSecret,
} from "./env";

describe("開発用ログインの本番ガード", () => {
  test("開発環境で HAISHA_DEV_LOGIN=1 なら有効", () => {
    expect(isDevLoginEnabled({ NODE_ENV: "development", HAISHA_DEV_LOGIN: "1" })).toBe(true);
  });

  test("HAISHA_DEV_LOGIN が無ければ無効", () => {
    expect(isDevLoginEnabled({ NODE_ENV: "development" })).toBe(false);
  });

  test("NODE_ENV=production で HAISHA_DEV_LOGIN=1 なら起動を止める", () => {
    expect(() =>
      assertDevLoginNotInProduction({ NODE_ENV: "production", HAISHA_DEV_LOGIN: "1" }),
    ).toThrow(/本番では使えません/);
  });

  test("Vercel の Production 環境でも止める", () => {
    expect(() =>
      assertDevLoginNotInProduction({ NODE_ENV: "development", VERCEL_ENV: "production", HAISHA_DEV_LOGIN: "1" }),
    ).toThrow();
  });

  test("本番で有効かを問い合わせても、代替せずに止める", () => {
    expect(() => isDevLoginEnabled({ NODE_ENV: "production", HAISHA_DEV_LOGIN: "1" })).toThrow();
  });

  test("本番で HAISHA_DEV_LOGIN が無ければ止めない", () => {
    expect(() => assertDevLoginNotInProduction({ NODE_ENV: "production" })).not.toThrow();
  });
});

describe("Cairn でログインの設定", () => {
  const full = {
    CAIRN_OIDC_ISSUER: "https://oss-cairn.com/oidc/",
    CAIRN_OIDC_CLIENT_ID: "cairn_oidc_client_rack",
    CAIRN_OIDC_CLIENT_SECRET: "s",
    HAISHA_APP_URL: "https://rack.example.com/",
  };

  test("4つそろっていれば使える。issuer の末尾のスラッシュは落とす", () => {
    expect(readOidcSettings(full)).toEqual({
      ok: true,
      issuer: "https://oss-cairn.com/oidc",
      clientId: "cairn_oidc_client_rack",
      clientSecret: "s",
      appOrigin: "https://rack.example.com",
      redirectUri: "https://rack.example.com/auth/callback",
    });
  });

  test("コールバック URL は HAISHA_APP_URL の origin から作り、パスは無視する", () => {
    const settings = readOidcSettings({ ...full, HAISHA_APP_URL: "http://localhost:3000/login?x=1" });
    expect(settings.ok && settings.redirectUri).toBe("http://localhost:3000/auth/callback");
  });

  test("足りない変数名を返す", () => {
    expect(readOidcSettings({ CAIRN_OIDC_ISSUER: "https://oss-cairn.com/oidc" })).toEqual({
      ok: false,
      missing: ["CAIRN_OIDC_CLIENT_ID", "CAIRN_OIDC_CLIENT_SECRET", "HAISHA_APP_URL"],
    });
  });

  test("HAISHA_APP_URL が URL でなければ使えない", () => {
    for (const value of ["rack.example.com", "ftp://rack.example.com"]) {
      expect(readOidcSettings({ ...full, HAISHA_APP_URL: value })).toEqual({
        ok: false,
        missing: ["HAISHA_APP_URL（http(s) の URL にしてください）"],
      });
    }
  });
});

describe("最初の配車係", () => {
  const A = "00000000-0000-4000-8000-000000000001";
  const B = "3f2b8c1e-5a47-4d0e-9b6a-1c2d3e4f5a6b";

  test("カンマ区切りの UUID を読み、空白と空要素を除く", () => {
    const r = readInitialAdminIds({ HAISHA_INITIAL_ADMIN_CAIRN_USER_IDS: ` ${A} , ${B.toUpperCase()},, ` });
    expect(r.ok).toBe(true);
    expect([...r.ids]).toEqual([A, B.toUpperCase()]);
  });

  test("未設定なら有効で空", () => {
    const r = readInitialAdminIds({});
    expect(r.ok).toBe(true);
    expect(r.ids.size).toBe(0);
  });

  test("空文字でも有効で空", () => {
    const r = readInitialAdminIds({ HAISHA_INITIAL_ADMIN_CAIRN_USER_IDS: " , " });
    expect(r).toEqual({ ok: true, ids: new Set() });
  });

  test("メールアドレスは無効として返す", () => {
    const r = readInitialAdminIds({ HAISHA_INITIAL_ADMIN_CAIRN_USER_IDS: "someone@example.com" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.invalid).toEqual(["someone@example.com"]);
    expect(r.ids.size).toBe(0);
  });

  test("UUID と無効な項目が混ざっていれば、無効な項目だけ返し、有効な項目は残す", () => {
    const r = readInitialAdminIds({ HAISHA_INITIAL_ADMIN_CAIRN_USER_IDS: `${A},taro,${B}x` });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.invalid).toEqual(["taro", `${B}x`]);
    expect([...r.ids]).toEqual([A]);
  });
});

describe("セッションの署名鍵", () => {
  test("未設定ならエラー", () => {
    expect(() => readSessionSecret({})).toThrow(/HAISHA_SESSION_SECRET/);
  });

  test("短すぎればエラー", () => {
    expect(() => readSessionSecret({ HAISHA_SESSION_SECRET: "short" })).toThrow(/32 文字以上/);
  });
});
