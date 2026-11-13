// @vitest-environment node
import { describe, expect, test } from "vitest";
import { canCreatePlan, canDeletePlan } from "./permissions";

describe("プランの権限", () => {
  test("山行のメンバーと配車係だけがプランを作れる", () => {
    const ids = new Set(["m1"]);
    expect(canCreatePlan({ cairnUserId: "m1", role: "member" }, ids)).toBe(true);
    expect(canCreatePlan({ cairnUserId: "k1", role: "kakari" }, ids)).toBe(true);
    expect(canCreatePlan({ cairnUserId: "x", role: "member" }, ids)).toBe(false);
  });

  test("作った人・リーダー・配車係だけがプランを消せる", () => {
    const plan = { createdById: "c" };
    const leaders = new Set(["l"]);
    expect(canDeletePlan({ cairnUserId: "c", role: "member" }, plan, leaders)).toBe(true);
    expect(canDeletePlan({ cairnUserId: "l", role: "member" }, plan, leaders)).toBe(true);
    expect(canDeletePlan({ cairnUserId: "k", role: "kakari" }, plan, leaders)).toBe(true);
    expect(canDeletePlan({ cairnUserId: "x", role: "member" }, plan, leaders)).toBe(false);
  });
});
