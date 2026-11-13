// @vitest-environment node
import { describe, expect, test } from "vitest";
import type { MemberOrigin } from "@/db/schema";
import { DomainError } from "@/lib/errors";
import { composePlanMembers } from "./compose";
import { planFormInputSchema } from "./input";

const origin = (id: string, addressInput: string, lat: number, lng: number): MemberOrigin => ({
  cairnUserId: id,
  addressInput,
  lat,
  lng,
  canDrive: false,
  vehicleCapacity: null,
  updatedById: id,
  updatedAt: new Date(),
});

const names = new Map([
  ["u1", "山田"],
  ["u2", "川口"],
]);

function parse(participants: unknown[]) {
  return planFormInputSchema.parse({ projectId: "p", destinationInput: "大倉", optimizationMode: "balanced", participants }).participants;
}

const member = (cairnUserId: string, extra: Record<string, unknown> = {}) => ({
  kind: "member",
  cairnUserId,
  included: true,
  canDrive: false,
  vehicleCapacity: null,
  ...extra,
});

describe("composePlanMembers", () => {
  test("保存済みの出発地の座標をそのまま使い、参加者には住所を入れない", () => {
    const { members, participants } = composePlanMembers({
      participants: parse([member("u1")]),
      projectMemberNames: names,
      origins: new Map([["u1", origin("u1", "東京都杉並区", 35.7, 139.6)]]),
    });
    expect(members[0]).toMatchObject({ id: "u1", name: "山田", addressInput: "東京都杉並区", location: { lat: 35.7, lng: 139.6 } });
    expect(JSON.stringify(participants)).not.toContain("杉並");
  });

  test("今回だけの出発地を入れたら、保存済みの座標は使わない", () => {
    const { members } = composePlanMembers({
      participants: parse([member("u1", { addressOverride: "東京都三鷹市" })]),
      projectMemberNames: names,
      origins: new Map([["u1", origin("u1", "東京都杉並区", 35.7, 139.6)]]),
    });
    expect(members[0].addressInput).toBe("東京都三鷹市");
    expect(members[0].location).toBeUndefined();
  });

  test("チェックを外した人は含めない", () => {
    const { members } = composePlanMembers({
      participants: parse([member("u1"), member("u2", { included: false })]),
      projectMemberNames: names,
      origins: new Map([["u1", origin("u1", "東京都杉並区", 35.7, 139.6)]]),
    });
    expect(members.map((m) => m.id)).toEqual(["u1"]);
  });

  test("出発地が未登録で今回の出発地も無ければ、名前を挙げてエラーにする", () => {
    expect(() =>
      composePlanMembers({ participants: parse([member("u2")]), projectMemberNames: names, origins: new Map() }),
    ).toThrow(/川口さんの出発地が登録されていません/);
  });

  test("山行のメンバーではない部員はエラーにする", () => {
    expect(() =>
      composePlanMembers({ participants: parse([member("zz", { addressOverride: "新宿" })]), projectMemberNames: names, origins: new Map() }),
    ).toThrow(DomainError);
  });

  test("自宅を集合場所にすると、表示名は「◯◯さんの自宅」で住所の文字を使わない", () => {
    const { members } = composePlanMembers({
      participants: parse([member("u1", { canDrive: true, vehicleCapacity: 4, meetingAtHome: true })]),
      projectMemberNames: names,
      origins: new Map([["u1", origin("u1", "東京都杉並区", 35.7, 139.6)]]),
    });
    expect(members[0]).toMatchObject({ isDriver: true, meetingAtHome: true, meetingPointInput: "山田さんの自宅" });
  });

  test("Cairn にいない参加者を加えられる", () => {
    const { members, participants } = composePlanMembers({
      participants: parse([{ kind: "guest", id: "guest-1", name: "OB 佐藤", addressInput: "川崎", canDrive: false, vehicleCapacity: null }]),
      projectMemberNames: names,
      origins: new Map(),
    });
    expect(members[0]).toMatchObject({ id: "guest-1", name: "OB 佐藤", addressInput: "川崎" });
    expect(participants[0]).toMatchObject({ kind: "guest", name: "OB 佐藤" });
  });

  test("車を出すのに定員が無ければエラーにする", () => {
    expect(() =>
      composePlanMembers({
        participants: parse([member("u1", { canDrive: true, vehicleCapacity: null })]),
        projectMemberNames: names,
        origins: new Map([["u1", origin("u1", "東京都杉並区", 35.7, 139.6)]]),
      }),
    ).toThrow(/定員/);
  });
});
