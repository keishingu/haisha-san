import { Member, PlanResult, SharePlanPayload } from '../types';
import { buildMeetingPointUrl } from '../google-maps/links';

const reasonText: Record<string, string> = {
  seat_shortage: '席不足',
  no_vehicle: '車なし',
  manual: '手動指定',
};

/**
 * 結果と入力から共有用ペイロードを作る。
 * 出発地住所・自宅緯度経度・住所解決結果の詳細・公共交通の詳細経路は含めない。
 * 集合地点の緯度経度は Google Maps リンク（座標のみ）の生成にだけ使い、ペイロードに生値は残さない。
 */
export function buildSharePayload(
  members: Member[],
  destinationLabel: string,
  planResult: PlanResult,
  notes?: string
): SharePlanPayload {
  return {
    title: '配車さん - 配車計画',
    destinationLabel,
    vehiclePlans: planResult.vehiclePlans.map((vp) => {
      const driver = members.find((m) => m.id === vp.driverId);
      const passengers = vp.passengerIds.map((pid) => members.find((m) => m.id === pid));
      return {
        driverName: driver?.name || '不明',
        passengerNames: passengers.map((p) => p?.name || '不明'),
        meetingPointName: vp.meetingPoint.name,
        meetingPointMapsUrl: buildMeetingPointUrl(vp.meetingPoint.location),
        destinationMapsUrl: vp.googleMapsUrl,
        driveDurationText: `${vp.driveDurationMinutes}分`,
      };
    }),
    transitOnlyPlans: planResult.transitOnlyPlans.map((top) => {
      const member = members.find((m) => m.id === top.memberId);
      return {
        memberName: member?.name || '不明',
        destinationMapsUrl: top.destinationMapsUrl,
        reasonText: reasonText[top.reason] ?? '公共交通',
      };
    }),
    notes: notes?.trim() ? notes.trim() : undefined,
    createdAt: new Date().toISOString(),
  };
}
