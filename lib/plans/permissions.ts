import type { MemberRole } from "@/lib/auth/membership";

type Actor = { cairnUserId: string; role: MemberRole };

/** 山行のプランを作れるか: その山行のメンバーか配車係 */
export function canCreatePlan(actor: Actor, projectMemberIds: ReadonlySet<string>): boolean {
  return actor.role === "kakari" || projectMemberIds.has(actor.cairnUserId);
}

/** プランを消せるか: 作った人、その山行のリーダー、配車係 */
export function canDeletePlan(actor: Actor, plan: { createdById: string }, leaderIds: ReadonlySet<string>): boolean {
  return actor.role === "kakari" || plan.createdById === actor.cairnUserId || leaderIds.has(actor.cairnUserId);
}
