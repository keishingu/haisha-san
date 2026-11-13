// @vitest-environment node
import { describe, expect, test } from "vitest";
import type { PlanResult } from "@/lib/types";
import { sanitizePlanResult } from "./sanitize";

describe("sanitizePlanResult", () => {
  test("同乗者のいない車のルート URL から、自宅の座標を取り除く", () => {
    const result: PlanResult = {
      vehiclePlans: [
        {
          vehicleId: "a",
          driverId: "a",
          passengerIds: [],
          driveDurationMinutes: 60,
          driverDetourMinutes: 0,
          passengerAccess: [],
          googleMapsUrl: "https://www.google.com/maps/dir/?api=1&origin=35.6994,139.6367&destination=35.4,139.1",
        },
      ],
      transitOnlyPlans: [],
      warnings: [],
    };
    const sanitized = sanitizePlanResult(result, { lat: 35.4, lng: 139.1 });
    expect(sanitized.vehiclePlans[0].googleMapsUrl).not.toContain("35.6994");
  });

  test("集合地点のある車の URL はそのまま残す", () => {
    const url = "https://www.google.com/maps/dir/?api=1&origin=35.7,139.66&destination=35.4,139.1";
    const result: PlanResult = {
      vehiclePlans: [
        {
          vehicleId: "a",
          driverId: "a",
          passengerIds: ["b"],
          meetingPoint: { id: "s", name: "中野駅", address: "", location: { lat: 35.7, lng: 139.66 }, placeType: "station" },
          driveDurationMinutes: 60,
          driverDetourMinutes: 5,
          passengerAccess: [],
          googleMapsUrl: url,
        },
      ],
      transitOnlyPlans: [],
      warnings: [],
    };
    expect(sanitizePlanResult(result, { lat: 35.4, lng: 139.1 }).vehiclePlans[0].googleMapsUrl).toBe(url);
  });
});
