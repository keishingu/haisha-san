import { Member, Destination, LatLng, MeetingCandidate, PlanResult } from '../types';
import { calculateAssignment } from './assignment';
import { getSampleLocation, getDynamicMeetingCandidates } from './sampleData';
import {
  getApiStatus,
  geocodeAddress,
  searchMeetingCandidates,
} from '../google-maps/client';

export type BuildPlanResult = {
  result: PlanResult;
  resolvedMembers: Member[]; // location 解決済み（ブラウザメモリ上のみ）
  destinationLocation: LatLng; // 解決済み目的地座標（ブラウザメモリ上のみ）
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
  live: boolean
): Promise<LatLng | undefined> {
  if (existing) return existing;
  if (live) {
    try {
      const r = await geocodeAddress(addressInput);
      return r.location;
    } catch {
      // live でも失敗したらサンプル辞書にフォールバック
      return getSampleLocation(addressInput);
    }
  }
  return getSampleLocation(addressInput);
}

/**
 * 入力（メンバー・目的地）を解決し、割り当て結果を返す。
 * サーバー用APIキーがあれば Google Maps Platform を使い、無ければサンプル辞書で動作する。
 * 解決した住所・緯度経度はブラウザメモリ上だけで扱い、保存しない。
 */
export async function buildPlan(members: Member[], destination: Destination): Promise<BuildPlanResult> {
  const { live } = await getApiStatus();

  // 目的地
  const destLocation = await resolveLocation(destination.addressInput, destination.location, live);
  if (!destLocation) {
    throw new Error(`目的地「${destination.addressInput}」を特定できませんでした。市区町村や番地を追加してください。`);
  }

  // メンバー
  const resolvedMembers: Member[] = [];
  const unresolved: string[] = [];
  for (const m of members) {
    const loc = await resolveLocation(m.addressInput, m.location, live);
    if (loc) {
      resolvedMembers.push({ ...m, location: loc });
    } else {
      unresolved.push(m.name || m.addressInput);
    }
  }
  if (unresolved.length > 0) {
    throw new Error(
      `次のメンバーの住所を特定できませんでした: ${unresolved.join('、')}。市区町村や番地を追加してください。`
    );
  }

  // 集合地点候補の中心（車なしメンバーの重心、いなければ目的地）
  const nonDriverLocs = resolvedMembers.filter(m => !m.isDriver).map(m => m.location!);
  const searchCenter = nonDriverLocs.length > 0 ? centroid(nonDriverLocs) : destLocation;

  let candidates: MeetingCandidate[] = [];
  if (live) {
    try {
      candidates = await searchMeetingCandidates(searchCenter);
    } catch {
      candidates = [];
    }
  }
  if (candidates.length === 0) {
    candidates = getDynamicMeetingCandidates(searchCenter);
  }
  if (candidates.length === 0) {
    throw new Error('集合地点候補が見つかりませんでした。メンバーの住所を確認してください。');
  }

  const result = await calculateAssignment(resolvedMembers, destLocation, candidates, live);

  return { result, resolvedMembers, destinationLocation: destLocation, mode: live ? 'live' : 'sample' };
}
