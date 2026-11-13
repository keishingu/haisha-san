// @vitest-environment node
import { describe, expect, test } from "vitest";
import type { CairnWorkspaceMember } from "@/lib/cairn/schemas";
import { planCsvImport } from "./csv-import";

const m = (userId: string, name: string, membershipStatus = "active"): CairnWorkspaceMember => ({
  userId,
  name,
  membershipStatus,
  profileAttributes: [],
});

const members = [m("u1", "山田 太郎"), m("u2", "川口 花子"), m("u3", "退部 済子", "inactive"), m("u4", "同名"), m("u5", "同名")];

describe("planCsvImport", () => {
  test("名前（空白は無視）で部員に対応づける", () => {
    const result = planCsvImport("氏名,住所,運転,定員\n山田太郎,東京都中野区,はい,5\n川口　花子,東京都三鷹市,いいえ,\n", members);
    expect(result).toEqual({
      ok: true,
      plan: {
        rows: [
          { cairnUserId: "u1", name: "山田 太郎", origin: { addressInput: "東京都中野区", canDrive: true, vehicleCapacity: 5 } },
          { cairnUserId: "u2", name: "川口 花子", origin: { addressInput: "東京都三鷹市", canDrive: false, vehicleCapacity: null } },
        ],
      },
    });
  });

  test("見つからない名前・退部した部員・同名の部員があれば、全部の問題を返して何も取り込まない", () => {
    const result = planCsvImport("氏名,住所\n知らない人,新宿\n退部 済子,中野\n同名,渋谷\n", members);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems).toHaveLength(3);
      expect(result.problems[2]).toMatch(/2 人いる/);
    }
  });

  test("同じ部員が2回出てきたらエラーにする", () => {
    const result = planCsvImport("氏名,住所\n山田 太郎,新宿\n山田太郎,中野\n", members);
    expect(result.ok).toBe(false);
  });
});
