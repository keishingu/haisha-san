// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { members } from "@/db/schema";
import type { Database } from "@/db/types";
import { createTestDb, seedMember } from "@/test/db";
import { recordLogin } from "./record-login";

let db: Database;
let close: () => Promise<void>;
beforeEach(async () => ({ db, close } = await createTestDb()));
afterEach(async () => close());

const roleOf = async (id: string) => (await db.select().from(members).where(eq(members.cairnUserId, id)))[0]?.role;
const now = new Date("2026-11-14T00:00:00Z");

describe("recordLogin", () => {
  test("初めてのログインは計算した役割で行を作る", async () => {
    await recordLogin(db, { sub: "a", role: "kakari", existingRole: null, email: "a@example.com", now });
    expect(await roleOf("a")).toBe("kakari");
  });

  test("ログイン中に配車係から外されていたら、読んだときの役割で戻さない", async () => {
    await seedMember(db, "a", "kakari");
    // ログインが kakari を読んだあとに、ほかの配車係が外した
    await db.update(members).set({ role: "member" }).where(eq(members.cairnUserId, "a"));
    await recordLogin(db, { sub: "a", role: "kakari", existingRole: "kakari", email: null, now });
    expect(await roleOf("a")).toBe("member");
  });

  test("配車係がいないときの復旧では、部員を配車係に戻す", async () => {
    await seedMember(db, "a", "member");
    await recordLogin(db, { sub: "a", role: "kakari", existingRole: "member", email: null, now });
    expect(await roleOf("a")).toBe("kakari");
  });

  test("最終ログインとメールアドレスは更新する", async () => {
    await seedMember(db, "a", "member");
    await recordLogin(db, { sub: "a", role: "member", existingRole: "member", email: "a@example.com", now });
    const [row] = await db.select().from(members).where(eq(members.cairnUserId, "a"));
    expect(row).toMatchObject({ email: "a@example.com", lastLoginAt: now });
  });
});
