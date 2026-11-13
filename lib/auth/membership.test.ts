// @vitest-environment node
import { describe, expect, test } from "vitest";
import { checkRoleChange, findActiveWorkspaceMember, roleOnLogin } from "./membership";

const workspace = [
  { userId: "u1", name: "A", membershipStatus: "active", profileAttributes: [] },
  { userId: "u2", name: "B", membershipStatus: "inactive", profileAttributes: [] },
];

describe("部員かどうかの確認", () => {
  test("active なメンバーなら見つかる", () => {
    expect(findActiveWorkspaceMember(workspace, "u1")?.name).toBe("A");
  });

  test("active でないメンバーは部員として扱わない", () => {
    expect(findActiveWorkspaceMember(workspace, "u2")).toBeNull();
  });

  test("ワークスペースにいなければ見つからない", () => {
    expect(findActiveWorkspaceMember(workspace, "u3")).toBeNull();
  });
});

describe("ログイン時の役割", () => {
  const admins = new Set(["boss"]);

  test("初めてのログインで、最初の配車係に指定されていれば配車係", () => {
    expect(roleOnLogin({ sub: "boss", existingRole: null, initialAdminIds: admins, kakariCount: 0 })).toBe("kakari");
  });

  test("初めてのログインで、指定されていなければ部員", () => {
    expect(roleOnLogin({ sub: "u1", existingRole: null, initialAdminIds: admins, kakariCount: 0 })).toBe("member");
  });

  test("画面で外された配車係は、環境変数に残っていても戻さない", () => {
    expect(roleOnLogin({ sub: "boss", existingRole: "member", initialAdminIds: admins, kakariCount: 2 })).toBe("member");
  });

  test("配車係が1人もいなければ、環境変数の人を配車係に戻す", () => {
    expect(roleOnLogin({ sub: "boss", existingRole: "member", initialAdminIds: admins, kakariCount: 0 })).toBe("kakari");
  });

  test("保存されている役割を使う", () => {
    expect(roleOnLogin({ sub: "u1", existingRole: "kakari", initialAdminIds: admins, kakariCount: 1 })).toBe("kakari");
  });
});

describe("配車係の付け外し", () => {
  test("配車係は部員を配車係にできる", () => {
    expect(checkRoleChange({ actorRole: "kakari", targetCurrentRole: "member", newRole: "kakari", kakariCount: 1 })).toEqual({ ok: true });
  });

  test("部員は役割を変えられない", () => {
    expect(checkRoleChange({ actorRole: "member", targetCurrentRole: "member", newRole: "kakari", kakariCount: 1 }).ok).toBe(false);
  });

  test("最後の1人の配車係は外せない", () => {
    expect(checkRoleChange({ actorRole: "kakari", targetCurrentRole: "kakari", newRole: "member", kakariCount: 1 })).toMatchObject({ ok: false });
  });

  test("配車係が2人以上なら外せる", () => {
    expect(checkRoleChange({ actorRole: "kakari", targetCurrentRole: "kakari", newRole: "member", kakariCount: 2 }).ok).toBe(true);
  });
});
