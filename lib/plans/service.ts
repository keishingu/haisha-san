import { desc, eq } from "drizzle-orm";
import type { Database } from "@/db/types";
import { plans, type Plan } from "@/db/schema";
import { DomainError } from "@/lib/errors";
import type { MapsGateway } from "@/lib/google-maps/gateway";
import { buildPlan } from "@/lib/planner/buildPlan";
import type { OptimizationMode } from "@/lib/planner/optimization";
import type { CairnProject, CairnProjectMember } from "@/lib/cairn/schemas";
import type { MemberRole } from "@/lib/auth/membership";
import { getOrigins } from "@/lib/origins/service";
import { composePlanMembers } from "./compose";
import { planFormInputSchema, type PlanFormInput } from "./input";
import { canCreatePlan, canDeletePlan } from "./permissions";
import { sanitizePlanResult } from "./sanitize";

type Actor = { cairnUserId: string; role: MemberRole };

/**
 * 配車を計算して保存する。住所はサーバーの中だけで使い、保存するプランには入れない。
 * 目的地が山行の場所のままで Place ID があれば、Place ID から座標を取る。
 */
export async function createPlan(
  db: Database,
  maps: MapsGateway,
  args: { actor: Actor; project: CairnProject; projectMembers: CairnProjectMember[]; input: PlanFormInput },
): Promise<Plan> {
  const projectMemberIds = new Set(args.projectMembers.map((m) => m.userId));
  if (!canCreatePlan(args.actor, projectMemberIds)) {
    throw new DomainError("この山行のメンバーか配車係だけが配車を作れます。");
  }
  const parsed = planFormInputSchema.safeParse(args.input);
  if (!parsed.success) throw new DomainError(parsed.error.issues.map((i) => i.message).join("\n"));
  const input = parsed.data;
  if (input.projectId !== args.project.id) throw new DomainError("山行が一致しません。画面を開き直してください。");

  const memberIds = input.participants.flatMap((p) => (p.kind === "member" && p.included ? [p.cairnUserId] : []));
  const origins = await getOrigins(db, memberIds);
  const { members, participants } = composePlanMembers({
    participants: input.participants,
    projectMemberNames: new Map(args.projectMembers.map((m) => [m.userId, m.name])),
    origins,
  });

  let destinationLocation;
  if (args.project.placeId && input.destinationInput === args.project.location) {
    destinationLocation = await maps.geocodePlaceId(args.project.placeId);
  }

  let built;
  try {
    built = await buildPlan(
      members,
      { addressInput: input.destinationInput, location: destinationLocation },
      input.optimizationMode as OptimizationMode,
      maps,
    );
  } catch (error) {
    if (error instanceof Error) throw new DomainError(error.message);
    throw error;
  }

  const [row] = await db
    .insert(plans)
    .values({
      cairnProjectId: args.project.id,
      projectTitle: args.project.title,
      destinationLabel: input.destinationInput,
      destinationLat: built.destinationLocation.lat,
      destinationLng: built.destinationLocation.lng,
      optimizationMode: input.optimizationMode as OptimizationMode,
      participants,
      result: sanitizePlanResult(built.result, built.destinationLocation),
      notes: input.notes ?? null,
      createdById: args.actor.cairnUserId,
    })
    .returning();
  return row;
}

export async function getPlan(db: Database, id: string): Promise<Plan | null> {
  // URL の id が UUID でなければ見つからない扱いにする（DB のエラーにしない）
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const [row] = await db.select().from(plans).where(eq(plans.id, id));
  return row ?? null;
}

export async function listPlansForProject(db: Database, cairnProjectId: string): Promise<Plan[]> {
  return db.select().from(plans).where(eq(plans.cairnProjectId, cairnProjectId)).orderBy(desc(plans.createdAt));
}

export async function listRecentPlans(db: Database, limit = 10): Promise<Plan[]> {
  return db.select().from(plans).orderBy(desc(plans.createdAt)).limit(limit);
}

export async function deletePlan(
  db: Database,
  args: { actor: Actor; planId: string; leaderIds: ReadonlySet<string> },
): Promise<void> {
  const plan = await getPlan(db, args.planId);
  if (!plan) throw new DomainError("プランが見つかりません。");
  if (!canDeletePlan(args.actor, plan, args.leaderIds)) {
    throw new DomainError("作った人・山行のリーダー・配車係だけがプランを消せます。");
  }
  await db.delete(plans).where(eq(plans.id, plan.id));
}
