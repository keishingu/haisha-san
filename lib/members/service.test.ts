// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { members } from "@/db/schema";
import type { Database } from "@/db/types";
import type { CairnWorkspaceMember } from "@/lib/cairn/schemas";
import { DomainError } from "@/lib/errors";
import { createTestDb, seedMember } from "@/test/db";
import { changeMemberRole, listMembers } from "./service";

let db: Database;
let close: () => Promise<void>;

const ws = (userId: string, name: string, extra: Partial<CairnWorkspaceMember> = {}): CairnWorkspaceMember => ({
  userId,
  name,
  membershipStatus: "active",
  profileAttributes: [],
  ...extra,
});

const workspace = [
  ws("kakari", "山田 太郎", { profileAttributes: [{ id: "g", name: "4年" }] }),
  ws("a", "青木 花子"),
  ws("b", "伊藤 次郎"),
  ws("gone", "退部 者", { membershipStatus: "inactive" }),
];

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  await seedMember(db, "kakari", "kakari");
});

afterEach(async () => {
  await close();
});

const roleOf = async (id: string) =>
  (await db.select({ role: members.role }).from(members).where(eq(members.cairnUserId, id)))[0]?.role;

describe("部員の一覧", () => {
  test("Cairn の active なメンバー全員が出て、配車係が上に並ぶ", async () => {
    const list = await listMembers(db, workspace);
    expect(list.map((m) => m.cairnUserId)).toEqual(["kakari", "a", "b"]);
    expect(list[0]).toMatchObject({ role: "kakari", attributes: ["4年"] });
  });

  test("まだログインしていない部員は部員の役割で、最終ログインが空", async () => {
    const list = await listMembers(db, workspace);
    expect(list.find((m) => m.cairnUserId === "a")).toMatchObject({ role: "member", lastLoginAt: null });
  });

  test("ログインした日が出る", async () => {
    const at = new Date("2026-10-01T00:00:00Z");
    await db.update(members).set({ lastLoginAt: at }).where(eq(members.cairnUserId, "kakari"));
    const list = await listMembers(db, workspace);
    expect(list[0]!.lastLoginAt).toEqual(at);
  });
});

describe("配車係の付け外し", () => {
  test("まだログインしたことがない部員も配車係にできる", async () => {
    await changeMemberRole(db, { actorId: "kakari", targetCairnUserId: "a", newRole: "kakari", workspaceMembers: workspace });
    expect(await roleOf("a")).toBe("kakari");
  });

  test("配車係を外せる（ほかに配車係がいるとき）", async () => {
    await changeMemberRole(db, { actorId: "kakari", targetCairnUserId: "a", newRole: "kakari", workspaceMembers: workspace });
    await changeMemberRole(db, { actorId: "kakari", targetCairnUserId: "kakari", newRole: "member", workspaceMembers: workspace });
    expect(await roleOf("kakari")).toBe("member");
  });

  test("最後の1人の配車係は外せない", async () => {
    await expect(
      changeMemberRole(db, { actorId: "kakari", targetCairnUserId: "kakari", newRole: "member", workspaceMembers: workspace }),
    ).rejects.toThrow("配車係が1人もいなくなるため、外せません");
    expect(await roleOf("kakari")).toBe("kakari");
  });

  test("部員は役割を変更できない", async () => {
    await seedMember(db, "a", "member");
    await expect(
      changeMemberRole(db, { actorId: "a", targetCairnUserId: "b", newRole: "kakari", workspaceMembers: workspace }),
    ).rejects.toThrow(DomainError);
    expect(await roleOf("b")).toBeUndefined();
  });

  test("Cairn で active でない人は配車係にできない", async () => {
    await expect(
      changeMemberRole(db, { actorId: "kakari", targetCairnUserId: "gone", newRole: "kakari", workspaceMembers: workspace }),
    ).rejects.toThrow(DomainError);
    expect(await roleOf("gone")).toBeUndefined();
  });

  test("変更した配車係と時刻が残る", async () => {
    await changeMemberRole(db, { actorId: "kakari", targetCairnUserId: "a", newRole: "kakari", workspaceMembers: workspace });
    const [row] = await db.select().from(members).where(eq(members.cairnUserId, "a"));
    expect(row).toMatchObject({ roleUpdatedById: "kakari" });
    expect(row!.roleUpdatedAt).not.toBeNull();
  });

  test("ログイン済みの部員はログイン日を保ったまま配車係になる", async () => {
    const at = new Date("2026-10-01T00:00:00Z");
    await seedMember(db, "a", "member");
    await db.update(members).set({ lastLoginAt: at }).where(eq(members.cairnUserId, "a"));
    await changeMemberRole(db, { actorId: "kakari", targetCairnUserId: "a", newRole: "kakari", workspaceMembers: workspace });
    const [row] = await db.select().from(members).where(eq(members.cairnUserId, "a"));
    expect(row).toMatchObject({ role: "kakari", lastLoginAt: at });
  });
});
