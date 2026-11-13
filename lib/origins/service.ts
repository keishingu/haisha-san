import { eq, inArray } from "drizzle-orm";
import type { Database } from "@/db/types";
import { memberOrigins, type MemberOrigin } from "@/db/schema";
import { DomainError } from "@/lib/errors";
import type { MapsGateway } from "@/lib/google-maps/gateway";
import { originInputSchema, type OriginInput } from "./schema";

/**
 * 出発地を保存する。住所は保存時に座標へ解決し、解決できなければ保存しない（エラーを返す）。
 * 住所を変えていなければ、前の座標をそのまま使う（Geocoding を呼ばない）。
 */
export async function saveOrigin(
  db: Database,
  maps: MapsGateway,
  input: { cairnUserId: string; actorId: string; origin: OriginInput },
): Promise<MemberOrigin> {
  const parsed = originInputSchema.safeParse(input.origin);
  if (!parsed.success) throw new DomainError(parsed.error.issues.map((i) => i.message).join("\n"));
  const origin = parsed.data;

  const [existing] = await db.select().from(memberOrigins).where(eq(memberOrigins.cairnUserId, input.cairnUserId));
  let location = existing && existing.addressInput === origin.addressInput ? { lat: existing.lat, lng: existing.lng } : undefined;
  if (!location) {
    location = await maps.geocode(origin.addressInput);
    if (!location) {
      throw new DomainError(`住所「${origin.addressInput}」を特定できませんでした。市区町村や番地を足してください。`);
    }
  }

  const values = {
    cairnUserId: input.cairnUserId,
    addressInput: origin.addressInput,
    lat: location.lat,
    lng: location.lng,
    canDrive: origin.canDrive,
    vehicleCapacity: origin.vehicleCapacity,
    updatedById: input.actorId,
    updatedAt: new Date(),
  };
  const [row] = await db
    .insert(memberOrigins)
    .values(values)
    .onConflictDoUpdate({ target: memberOrigins.cairnUserId, set: values })
    .returning();
  return row;
}

export async function getOrigin(db: Database, cairnUserId: string): Promise<MemberOrigin | null> {
  const [row] = await db.select().from(memberOrigins).where(eq(memberOrigins.cairnUserId, cairnUserId));
  return row ?? null;
}

export async function getOrigins(db: Database, cairnUserIds: string[]): Promise<Map<string, MemberOrigin>> {
  if (cairnUserIds.length === 0) return new Map();
  const rows = await db.select().from(memberOrigins).where(inArray(memberOrigins.cairnUserId, cairnUserIds));
  return new Map(rows.map((r) => [r.cairnUserId, r]));
}

export async function listAllOrigins(db: Database): Promise<MemberOrigin[]> {
  return db.select().from(memberOrigins);
}

export async function deleteOrigin(db: Database, cairnUserId: string): Promise<void> {
  await db.delete(memberOrigins).where(eq(memberOrigins.cairnUserId, cairnUserId));
}
