// @vitest-environment node
import { describe, expect, test } from "vitest";
import type { CairnProject } from "@/lib/cairn/schemas";
import { formatTripDates, orderTrips, todayInJapan } from "./order";

const p = (id: string, startDate: string | null, endDate: string | null, archived = false): CairnProject => ({
  id,
  title: id,
  startDate,
  endDate,
  archived,
  memberNames: [],
});

describe("orderTrips", () => {
  test("これから・実施中を近い順、日程未定、終わった山行を新しい順に並べ、アーカイブは除く", () => {
    const ordered = orderTrips(
      [
        p("past-old", "2026-01-01", "2026-01-02"),
        p("future-far", "2026-12-01", "2026-12-02"),
        p("undated", null, null),
        p("ongoing", "2026-11-12", "2026-11-14"),
        p("past-new", "2026-11-01", "2026-11-02"),
        p("archived", "2026-11-20", "2026-11-21", true),
      ],
      "2026-11-13",
    );
    expect(ordered.map((t) => t.id)).toEqual(["ongoing", "future-far", "undated", "past-new", "past-old"]);
  });
});

describe("formatTripDates", () => {
  test("日程を短く表示する", () => {
    expect(formatTripDates({ startDate: "2026-10-13", endDate: "2026-10-16" })).toBe("10/13〜10/16");
    expect(formatTripDates({ startDate: "2026-10-13", endDate: "2026-10-13" })).toBe("10/13");
    expect(formatTripDates({ startDate: null, endDate: null })).toBe("日程未定");
  });
});

describe("todayInJapan", () => {
  test("日本時間の日付を返す", () => {
    expect(todayInJapan(new Date("2026-11-12T16:00:00Z"))).toBe("2026-11-13");
  });
});
