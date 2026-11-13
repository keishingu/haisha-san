// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Database } from "@/db/types";
import { DomainError } from "@/lib/errors";
import { sampleGateway, type MapsGateway } from "@/lib/google-maps/gateway";
import { createTestDb } from "@/test/db";
import { getOrigin, saveOrigin } from "./service";

let db: Database;
let close: () => Promise<void>;
beforeEach(async () => ({ db, close } = await createTestDb()));
afterEach(async () => close());

describe("saveOrigin", () => {
  test("住所を座標にして保存する", async () => {
    await saveOrigin(db, sampleGateway, {
      cairnUserId: "u1",
      actorId: "u1",
      origin: { addressInput: "東京都杉並区", canDrive: true, vehicleCapacity: 5 },
    });
    expect(await getOrigin(db, "u1")).toMatchObject({ addressInput: "東京都杉並区", canDrive: true, vehicleCapacity: 5, lat: 35.6994 });
  });

  test("住所を特定できなければ保存せずエラーにする", async () => {
    await expect(
      saveOrigin(db, sampleGateway, { cairnUserId: "u1", actorId: "u1", origin: { addressInput: "どこでもない", canDrive: false, vehicleCapacity: null } }),
    ).rejects.toThrow(DomainError);
    expect(await getOrigin(db, "u1")).toBeNull();
  });

  test("車を出せるのに定員が無ければエラーにする", async () => {
    await expect(
      saveOrigin(db, sampleGateway, { cairnUserId: "u1", actorId: "u1", origin: { addressInput: "東京都杉並区", canDrive: true, vehicleCapacity: null } }),
    ).rejects.toThrow(/定員/);
  });

  test("住所が変わらなければ住所の解決を呼ばない", async () => {
    const geocode = vi.fn(sampleGateway.geocode);
    const maps: MapsGateway = { ...sampleGateway, geocode };
    const input = { cairnUserId: "u1", actorId: "u1", origin: { addressInput: "東京都杉並区", canDrive: false, vehicleCapacity: null } };
    await saveOrigin(db, maps, input);
    await saveOrigin(db, maps, { ...input, origin: { ...input.origin, canDrive: true, vehicleCapacity: 4 } });
    expect(geocode).toHaveBeenCalledTimes(1);
    expect(await getOrigin(db, "u1")).toMatchObject({ canDrive: true, vehicleCapacity: 4 });
  });
});
