import { Member, PlanResult } from '../types';

export function generateShareText(
  members: Member[],
  destination: string,
  planResult: PlanResult
): string {
  const lines: string[] = [];

  lines.push(`目的地: ${destination}`);
  lines.push('');

  // 車ごとの結果
  planResult.vehiclePlans.forEach((vp, index) => {
    const driver = members.find(m => m.id === vp.driverId);
    const passengers = vp.passengerIds.map(pid => members.find(m => m.id === pid));

    lines.push(`車${index + 1}: ${driver?.name}さんの車`);
    lines.push(`乗車: ${[driver?.name, ...passengers.map(p => p?.name)].filter(Boolean).join(', ')}`);
    lines.push(`集合地点: ${vp.meetingPoint ? vp.meetingPoint.name : '同乗者なし（自宅から目的地へ直行）'}`);
    lines.push(`移動時間: 約${vp.driveDurationMinutes}分`);
    if (vp.meetingPoint) {
      lines.push(`遠回り時間: +${vp.driverDetourMinutes}分`);
    }
    lines.push(`Google Maps: ${vp.googleMapsUrl}`);
    lines.push('');
  });

  // 公共交通組
  if (planResult.transitOnlyPlans.length > 0) {
    lines.push('公共交通で目的地へ向かうメンバー:');
    planResult.transitOnlyPlans.forEach(top => {
      const member = members.find(m => m.id === top.memberId);
      lines.push(`- ${member?.name}`);
      lines.push(`  理由: ${top.reason === 'seat_shortage' ? '席不足' : top.reason === 'no_vehicle' ? '車なし' : '手動指定'}`);
      lines.push(`  目的地までのGoogle Maps: ${top.destinationMapsUrl}`);
    });
    lines.push('');
  }

  // 警告
  if (planResult.warnings.length > 0) {
    lines.push('注意:');
    planResult.warnings.forEach(warning => {
      lines.push(`- ${warning}`);
    });
    lines.push('');
  }

  lines.push('※ この計画は配車さんで作成されました');
  lines.push('※ 入力データ（住所・氏名・目的地）は保存されません');

  return lines.join('\n');
}
