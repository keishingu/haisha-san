// @vitest-environment node
import { describe, expect, test } from "vitest";
import { CairnError } from "./errors";
import { parseToolResult } from "./parse";
import { listMembersResultSchema, listProjectsResultSchema } from "./schemas";
import { patExpiryStatus } from "./pat-expiry";

const text = (value: unknown) => ({ content: [{ type: "text", text: JSON.stringify(value) }] });

describe("Cairn のツールの返り値の読み取り", () => {
  test("list_projects の text を読み、開始日・終了日の null を受け付ける", () => {
    const projects = parseToolResult(
      "list_projects",
      text([
        { id: "p1", title: "1010大ヤスリ", startDate: "2026-10-10", endDate: "2026-10-12", archived: false, memberNames: ["A"] },
        { id: "p2", title: "日付なし", startDate: null, endDate: null, archived: false },
      ]),
      listProjectsResultSchema,
    );
    expect(projects).toHaveLength(2);
    expect(projects[1]).toMatchObject({ startDate: null, endDate: null, memberNames: [] });
  });

  test("structuredContent があればそちらを使う", () => {
    const result = parseToolResult(
      "list_members",
      {
        structuredContent: {
          items: [{ userId: "u1", name: "A", membershipStatus: "active" }],
          totalCount: 1,
          truncated: false,
        },
      },
      listMembersResultSchema,
    );
    expect(result.items[0]?.userId).toBe("u1");
  });

  test("形が違えば空の値で代替せずエラーにする", () => {
    expect(() =>
      parseToolResult("list_projects", text({ items: [] }), listProjectsResultSchema),
    ).toThrow(CairnError);
  });

  test("isError の返り値はエラーにする", () => {
    try {
      parseToolResult(
        "list_projects",
        { isError: true, content: [{ type: "text", text: "forbidden" }] },
        listProjectsResultSchema,
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(CairnError);
      expect((error as CairnError).kind).toBe("unavailable");
    }
  });
});

describe("PAT の期限", () => {
  const now = new Date("2026-11-03T00:00:00Z");

  test("31日以上先なら案内しない", () => {
    expect(patExpiryStatus("2026-12-05T00:00:00Z", now).kind).toBe("ok");
  });

  test("30日前から案内する", () => {
    expect(patExpiryStatus("2026-12-03T00:00:00Z", now)).toMatchObject({
      kind: "expiring",
      daysLeft: 30,
    });
  });

  test("期限を過ぎたら expired", () => {
    expect(patExpiryStatus("2026-11-02T00:00:00Z", now).kind).toBe("expired");
  });

  test("未設定・読めない値は unknown として案内を出す", () => {
    expect(patExpiryStatus(undefined, now).kind).toBe("unknown");
    expect(patExpiryStatus("来年", now).kind).toBe("unknown");
  });
});
