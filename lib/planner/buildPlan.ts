import { Member, Destination, LatLng, MeetingCandidate, PlanResult } from '../types';
import { calculateAssignment } from './assignment';
import { OptimizationMode, DEFAULT_OPTIMIZATION_MODE } from './optimization';
import type { MapsGateway } from '../google-maps/gateway';

export type BuildPlanResult = {
  result: PlanResult;
  resolvedMembers: Member[]; // location 解決済み
  destinationLocation: LatLng; // 解決済み目的地座標
  mode: 'live' | 'sample';
};

function centroid(locations: LatLng[]): LatLng {
  return {
    lat: locations.reduce((s, p) => s + p.lat, 0) / locations.length,
    lng: locations.reduce((s, p) => s + p.lng, 0) / locations.length,
  };
}

async function resolveLocation(
  addressInput: string,
  existing: LatLng | undefined,
  maps: MapsGateway
): Promise<LatLng | undefined> {
  if (existing) return existing;
  return maps.geocode(addressInput);
}

/**
 * 入力（メンバー・目的地）を解決し、割り当て結果を返す。
 * 地図の機能は maps で渡す（Cairn の配車はサーバーで Google Maps Platform、サンプルモードは内蔵の辞書）。
 */
export async function buildPlan(
  members: Member[],
  destination: Destination,
  optimizationMode: OptimizationMode = DEFAULT_OPTIMIZATION_MODE,
  maps: MapsGateway
): Promise<BuildPlanResult> {
  const live = maps.live;

  // 目的地
  const destLocation = await resolveLocation(destination.addressInput, destination.location, maps);
  if (!destLocation) {
    throw new Error(`目的地「${destination.addressInput}」を特定できませんでした。市区町村や番地を追加してください。`);
  }

  // メンバー
  const resolvedMembers: Member[] = [];
  const unresolved: string[] = [];
  const meetingPointWarnings: string[] = [];
  for (const m of members) {
    const loc = await resolveLocation(m.addressInput, m.location, maps);
    if (!loc) {
      unresolved.push(m.name || m.addressInput);
      continue;
    }
    const resolved: Member = { ...m, location: loc };
    // ドライバーの指定集合場所を解決する。特定できない場合は自動選定にフォールバックし、警告で知らせる。
    if (m.isDriver && m.meetingAtHome) {
      resolved.meetingPointLocation = loc;
    } else if (m.isDriver && m.meetingPointInput?.trim()) {
      const mpLoc = await resolveLocation(m.meetingPointInput, m.meetingPointLocation, maps);
      if (mpLoc) {
        resolved.meetingPointLocation = mpLoc;
      } else {
        meetingPointWarnings.push(
          `「${m.name || m.addressInput}」の指定集合場所「${m.meetingPointInput.trim()}」を特定できませんでした。集合地点を自動で選びました。`
        );
      }
    }
    resolvedMembers.push(resolved);
  }
  if (unresolved.length > 0) {
    throw new Error(
      `次のメンバーの住所を特定できませんでした: ${unresolved.join('、')}。市区町村や番地を追加してください。`
    );
  }

  // 集合地点候補の中心（車なしメンバーの重心、いなければ目的地）
  const nonDriverLocs = resolvedMembers.filter(m => !m.isDriver).map(m => m.location!);
  const searchCenter = nonDriverLocs.length > 0 ? centroid(nonDriverLocs) : destLocation;

  // 指定した中心の周辺で集合地点候補を返すプロバイダ。
  // 車ごとに呼び出して、その車のメンバーに近い候補を取り直すために使う。
  const candidateProvider = (center: LatLng): Promise<MeetingCandidate[]> => maps.searchMeetingCandidates(center);

  const candidates = await candidateProvider(searchCenter);
  if (candidates.length === 0) {
    throw new Error('集合地点候補が見つかりませんでした。メンバーの住所を確認してください。');
  }

  const result = await calculateAssignment(
    resolvedMembers,
    destLocation,
    candidates,
    maps.routes,
    optimizationMode,
    candidateProvider
  );

  if (meetingPointWarnings.length > 0) {
    result.warnings.push(...meetingPointWarnings);
  }

  return { result, resolvedMembers, destinationLocation: destLocation, mode: live ? 'live' : 'sample' };
}
