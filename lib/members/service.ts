import { eq } from "drizzle-orm";
import { members } from "@/db/schema";
import type { Executor } from "@/db/types";
import { checkRoleChange, countActiveKakari, findActiveWorkspaceMember, type MemberRole } from "@/lib/auth/membership";
import type { CairnWorkspaceMember } from "@/lib/cairn/schemas";
import { DomainError } from "@/lib/errors";

/**
 * 配車係の付け外しのサービス層。
 * 部員かどうかは Cairn のワークスペース（active なメンバー）で決まり、配車さん の役割は members テーブルに持つ。
 */

export type MemberRow = {
  cairnUserId: string;
  name: string;
  avatarUrl: string | null;
  /** 学年などの属性（Cairn の profileAttributes） */
  attributes: string[];
  role: MemberRole;
  /** まだ 配車さん にログインしたことがなければ null */
  lastLoginAt: Date | null;
};

/** Cairn の active なメンバー全員に 配車さん の役割を合わせる。配車係を上に */
export async function listMembers(
  db: Executor,
  workspaceMembers: readonly CairnWorkspaceMember[],
): Promise<MemberRow[]> {
  const rows = await db
    .select({ cairnUserId: members.cairnUserId, role: members.role, lastLoginAt: members.lastLoginAt })
    .from(members);
  const byId = new Map(rows.map((r) => [r.cairnUserId, r]));
  return workspaceMembers
    .filter((m) => m.membershipStatus === "active")
    .map((m) => {
      const row = byId.get(m.userId);
      return {
        cairnUserId: m.userId,
        name: m.name,
        avatarUrl: m.avatarUrl ?? null,
        attributes: m.profileAttributes.map((a) => a.name),
        role: row?.role ?? ("member" as const),
        lastLoginAt: row?.lastLoginAt ?? null,
      };
    })
    // 漢字の名前は読み順で並べられないので、同じ役割の中は Cairn の並びのまま（sort は安定）
    .sort((a, b) => (a.role === b.role ? 0 : a.role === "kakari" ? -1 : 1));
}

/**
 * 配車係にする／外す。
 * - 実行者が配車係であること、対象が Cairn の active なメンバーであること
 * - まだ 配車さん にログインしたことがない部員は、行を作ってから役割を付ける
 * - 最後の1人の配車係は外せない（配車係の行を FOR UPDATE で押さえて数える）
 */
export async function changeMemberRole(
  db: Executor,
  input: {
    actorId: string;
    targetCairnUserId: string;
    newRole: MemberRole;
    workspaceMembers: readonly CairnWorkspaceMember[];
  },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [actor] = await tx
      .select({ role: members.role })
      .from(members)
      .where(eq(members.cairnUserId, input.actorId));
    if (!actor || actor.role !== "kakari") {
      throw new DomainError("配車係だけが役割を変更できます");
    }
    if (!findActiveWorkspaceMember(input.workspaceMembers, input.targetCairnUserId)) {
      throw new DomainError("Cairn のワークスペースの部員ではありません");
    }

    const kakari = await tx
      .select({ cairnUserId: members.cairnUserId })
      .from(members)
      .where(eq(members.role, "kakari"))
      .for("update");

    const [target] = await tx
      .select({ role: members.role })
      .from(members)
      .where(eq(members.cairnUserId, input.targetCairnUserId));
    const targetCurrentRole: MemberRole = target?.role ?? "member";

    const check = checkRoleChange({
      actorRole: actor.role,
      targetCurrentRole,
      newRole: input.newRole,
      kakariCount: countActiveKakari(
        kakari.map((k) => k.cairnUserId),
        input.workspaceMembers,
      ),
    });
    if (!check.ok) throw new DomainError(check.reason);

    const now = new Date();
    await tx
      .insert(members)
      .values({
        cairnUserId: input.targetCairnUserId,
        role: input.newRole,
        roleUpdatedById: input.actorId,
        roleUpdatedAt: now,
      })
      .onConflictDoUpdate({
        target: members.cairnUserId,
        set: { role: input.newRole, roleUpdatedById: input.actorId, roleUpdatedAt: now },
      });
  });
}
