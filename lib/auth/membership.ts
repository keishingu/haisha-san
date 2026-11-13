import type { CairnWorkspaceMember } from "@/lib/cairn/schemas";

export type MemberRole = "member" | "kakari";

/** ワークスペースの active なメンバーの中から sub を探す。いなければ null（退部・未参加） */
export function findActiveWorkspaceMember(
  workspaceMembers: readonly CairnWorkspaceMember[],
  sub: string,
): CairnWorkspaceMember | null {
  return (
    workspaceMembers.find((m) => m.userId === sub && m.membershipStatus === "active") ?? null
  );
}

/**
 * 配車係のうち、いま Cairn のワークスペースにいる（active な）人の数。
 * ワークスペースから外れた配車係の行は配車さんの DB に残るが、ログインも操作もできないので数えない
 * （数えると、最後の配車係が外れたあと環境変数で配車係を戻せなくなる）。
 */
export function countActiveKakari(
  kakariIds: readonly string[],
  workspaceMembers: readonly CairnWorkspaceMember[],
): number {
  return kakariIds.filter((id) => findActiveWorkspaceMember(workspaceMembers, id)).length;
}

/**
 * ログイン時の役割。
 * - 初めてのログイン: HAISHA_INITIAL_ADMIN_CAIRN_USER_IDS に入っていれば配車係
 * - 2回目以降: 配車さんに保存した役割を使う（画面での付け外しを環境変数で上書きしない）
 * - ただし配車係が1人もいないときは、環境変数の人を配車係に戻す（誰も管理できない状態を防ぐ）
 */
export function roleOnLogin(input: {
  sub: string;
  existingRole: MemberRole | null;
  initialAdminIds: ReadonlySet<string>;
  kakariCount: number;
}): MemberRole {
  const isInitialAdmin = input.initialAdminIds.has(input.sub);
  if (input.existingRole === null) return isInitialAdmin ? "kakari" : "member";
  if (input.kakariCount === 0 && isInitialAdmin) return "kakari";
  return input.existingRole;
}

export type RoleChangeCheck = { ok: true } | { ok: false; reason: string };

/** 配車係の付け外しができるか */
export function checkRoleChange(input: {
  actorRole: MemberRole;
  targetCurrentRole: MemberRole;
  newRole: MemberRole;
  kakariCount: number;
}): RoleChangeCheck {
  if (input.actorRole !== "kakari") {
    return { ok: false, reason: "配車係だけが役割を変更できます" };
  }
  if (
    input.targetCurrentRole === "kakari" &&
    input.newRole === "member" &&
    input.kakariCount <= 1
  ) {
    return { ok: false, reason: "配車係が1人もいなくなるため、外せません" };
  }
  return { ok: true };
}
