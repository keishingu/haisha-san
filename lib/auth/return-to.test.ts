// @vitest-environment node
import { describe, expect, test } from "vitest";
import { loginUrlFor } from "./return-to";

describe("loginUrlFor", () => {
  test("開こうとしたパスを returnTo に付ける", () => {
    expect(loginUrlFor("/plans/abc?x=1")).toBe("/login?returnTo=%2Fplans%2Fabc%3Fx%3D1");
  });

  test("ホーム・不明・外部への URL は returnTo を付けない", () => {
    expect(loginUrlFor("/")).toBe("/login");
    expect(loginUrlFor(null)).toBe("/login");
    expect(loginUrlFor("//evil.example.com")).toBe("/login");
    expect(loginUrlFor("https://evil.example.com")).toBe("/login");
  });
});
