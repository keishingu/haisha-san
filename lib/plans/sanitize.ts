import { buildDestinationUrl } from "@/lib/google-maps/links";
import type { LatLng, PlanResult } from "@/lib/types";

/**
 * 保存する前に、プランから出発地（自宅）の座標が分かるものを取り除く（純粋関数）。
 * - 同乗者のいない車のルート URL は「自宅→目的地」なので、目的地だけの URL にする
 * 集合地点・公共交通の経路（乗車駅→降車駅）はそのまま残す（ログインした部員だけが見るため。設計書 §6）
 */
export function sanitizePlanResult(result: PlanResult, destination: LatLng): PlanResult {
  return {
    ...result,
    vehiclePlans: result.vehiclePlans.map((vp) =>
      vp.meetingPoint ? vp : { ...vp, googleMapsUrl: buildDestinationUrl(destination) },
    ),
  };
}
