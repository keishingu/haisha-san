// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { Database } from "@/db/types";
import { DomainError } from "@/lib/errors";
import type { CairnProject, CairnProjectMember } from "@/lib/cairn/schemas";
import { sampleGateway } from "@/lib/google-maps/gateway";
import { saveOrigin } from "@/lib/origins/service";
import { createTestDb } from "@/test/db";
import { createPlan, deletePlan, getPlan, listPlansForProject } from "./service";

let db: Database;
let close: () => Promise<void>;
beforeEach(async () => ({ db, close } = await createTestDb()));
afterEach(async () => close());

const project: CairnProject = {
  id: "p1",
  title: "岩稜 架空岳",
  startDate: null,
  endDate: null,
  archived: false,
  memberNames: [],
  location: "丹沢 大倉",
  placeId: null,
};
const projectMembers: CairnProjectMember[] = [
  { userId: "d", name: "運転 する子", role: "leader" },
  { userId: "p", name: "乗る 人", role: "member" },
];

async function seedOrigins() {
  await saveOrigin(db, sampleGateway, { cairnUserId: "d", actorId: "d", origin: { addressInput: "東京都杉並区", canDrive: true, vehicleCapacity: 4 } });
  await saveOrigin(db, sampleGateway, { cairnUserId: "p", actorId: "p", origin: { addressInput: "東京都中野区", canDrive: false, vehicleCapacity: null } });
}

const input = {
  projectId: "p1",
  destinationInput: "丹沢 大倉",
  optimizationMode: "balanced",
  participants: [
    { kind: "member" as const, cairnUserId: "d", included: true, canDrive: true, vehicleCapacity: 4 },
    { kind: "member" as const, cairnUserId: "p", included: true, canDrive: false, vehicleCapacity: null },
  ],
};

describe("createPlan", () => {
  test("保存済みの出発地で配車を計算して保存し、住所はプランに入れない", async () => {
    await seedOrigins();
    const plan = await createPlan(db, sampleGateway, { actor: { cairnUserId: "p", role: "member" }, project, projectMembers, input });
    expect(plan.result.vehiclePlans).toHaveLength(1);
    expect(plan.result.vehiclePlans[0].passengerIds).toEqual(["p"]);
    expect(plan.participants.map((x) => x.name)).toEqual(["運転 する子", "乗る 人"]);
    const json = JSON.stringify(plan);
    expect(json).not.toContain("杉並");
    expect(json).not.toContain("中野区");
    expect(json).not.toContain("35.6994");
    expect(await listPlansForProject(db, "p1")).toHaveLength(1);
  });

  test("山行のメンバーでも配車係でもなければ作れない", async () => {
    await seedOrigins();
    await expect(
      createPlan(db, sampleGateway, { actor: { cairnUserId: "x", role: "member" }, project, projectMembers, input }),
    ).rejects.toThrow(/メンバーか配車係/);
  });

  test("同じ同乗グループに車を出す人が2人いれば、計算せずエラーにする", async () => {
    await seedOrigins();
    await expect(
      createPlan(db, sampleGateway, {
        actor: { cairnUserId: "d", role: "member" },
        project,
        projectMembers,
        input: {
          ...input,
          participants: [
            { kind: "member" as const, cairnUserId: "d", included: true, canDrive: true, vehicleCapacity: 4, groupId: "1" },
            { kind: "member" as const, cairnUserId: "p", included: true, canDrive: true, vehicleCapacity: 4, groupId: "1" },
          ],
        },
      }),
    ).rejects.toThrow(/同乗グループ「1」に車ありメンバーが2人います/);
    expect(await listPlansForProject(db, "p1")).toHaveLength(0);
  });

  test("目的地を特定できなければエラーにして保存しない", async () => {
    await seedOrigins();
    await expect(
      createPlan(db, sampleGateway, {
        actor: { cairnUserId: "d", role: "member" },
        project,
        projectMembers,
        input: { ...input, destinationInput: "どこでもない山" },
      }),
    ).rejects.toThrow(DomainError);
    expect(await listPlansForProject(db, "p1")).toHaveLength(0);
  });
});

describe("deletePlan", () => {
  test("作った人は消せるが、ほかの部員は消せない", async () => {
    await seedOrigins();
    const plan = await createPlan(db, sampleGateway, { actor: { cairnUserId: "p", role: "member" }, project, projectMembers, input });
    await expect(
      deletePlan(db, { actor: { cairnUserId: "x", role: "member" }, planId: plan.id, leaderIds: new Set(["d"]) }),
    ).rejects.toThrow(DomainError);
    await deletePlan(db, { actor: { cairnUserId: "p", role: "member" }, planId: plan.id, leaderIds: new Set(["d"]) });
    expect(await getPlan(db, plan.id)).toBeNull();
  });

  test("UUID でない ID は見つからない扱いにする", async () => {
    expect(await getPlan(db, "not-a-uuid")).toBeNull();
  });
});
