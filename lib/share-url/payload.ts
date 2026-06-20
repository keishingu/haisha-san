import { Member, PlanResult, SharePlanPayload, LatLng } from '../types';
import { buildMeetingPointUrl, buildDestinationUrl } from '../google-maps/links';

const reasonText: Record<string, string> = {
  seat_shortage: '席不足',
  no_vehicle: '車なし',
  manual: '手動指定',
};

/**
 * 結果と入力から共有用ペイロードを作る。
 * 出発地住所・自宅緯度経度・住所解決結果の詳細・公共交通の詳細経路は含めない。
 * 集合地点／目的地の緯度経度は Google Maps リンク（座標のみ）の生成にだけ使い、
 * 出発地（自宅）由来の座標はリンクにも含めない。
 */
export function buildSharePayload(
  members: Member[],
  destinationLabel: string,
  planResult: PlanResult,
  destinationLocation: LatLng,
  notes?: string
): SharePlanPayload {
  const destinationMapsUrl = buildDestinationUrl(destinationLocation);

  return {
    title: '配車さん - 配車計画',
    destinationLabel,
    vehiclePlans: planResult.vehiclePlans.map((vp) => {
      const driver = members.find((m) => m.id === vp.driverId);
      const passengers = vp.passengerIds.map((pid) => members.find((m) => m.id === pid));
      const hasMeetingPoint = !!vp.meetingPoint;
      return {
        driverName: driver?.name || '不明',
        passengerNames: passengers.map((p) => p?.name || '不明'),
        // 集合地点（駅など）の座標は共有してよい。自宅座標は含めない。
        meetingPointName: hasMeetingPoint ? vp.meetingPoint!.name : undefined,
        meetingPointMapsUrl: hasMeetingPoint ? buildMeetingPointUrl(vp.meetingPoint!.location) : undefined,
        // ソロ車は自宅→目的地リンク（自宅座標入り）を共有しない。目的地ピンのみにする。
        destinationMapsUrl: hasMeetingPoint ? vp.googleMapsUrl : destinationMapsUrl,
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
