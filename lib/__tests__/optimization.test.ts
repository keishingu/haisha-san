import { describe, it, expect } from 'vitest';
import { calculateAssignment } from '../planner/assignment';
import { Member, MeetingCandidate, LatLng } from '../types';

// ドライバーは西寄り、目的地はさらに西、車なしメンバーは東寄りに置く。
// 集合地点候補は「メンバーの近く(東)」と「ドライバーの進路上(西)」の2つ。
const destination: LatLng = { lat: 35.48, lng: 138.75 };

const driver: Member = {
  id: 'd', name: 'ドライバー', addressInput: '', location: { lat: 35.69, lng: 139.70 }, isDriver: true, vehicleCapacity: 4,
};
const passenger: Member = {
  id: 'p', name: '同乗者', addressInput: '', location: { lat: 35.61, lng: 140.10 }, isDriver: false,
};
const members = [driver, passenger];

const nearPassenger: MeetingCandidate = {
  id: 'near-passenger', name: 'メンバー近くの駅', address: '', location: { lat: 35.61, lng: 140.05 }, placeType: 'station',
};
const nearRoute: MeetingCandidate = {
  id: 'near-route', name: 'ドライバー進路上の駅', address: '', location: { lat: 35.66, lng: 139.55 }, placeType: 'station',
};
const candidates = [nearPassenger, nearRoute];

function passengerAccessOf(planResult: Awaited<ReturnType<typeof calculateAssignment>>): number {
  const vp = planResult.vehiclePlans.find((v) => v.passengerIds.includes('p'))!;
  return vp.passengerAccess.find((a) => a.memberId === 'p')!.durationMinutes!;
}

describe('最適化モードによる集合地点の選択', () => {
  it('集合のしやすさ重視ではメンバーに近い集合地点が選ばれること', async () => {
    const result = await calculateAssignment(members, destination, candidates, false, 'gathering');
    const vp = result.vehiclePlans.find((v) => v.passengerIds.includes('p'))!;
    expect(vp.meetingPoint?.id).toBe('near-passenger');
  });

  it('ドライバー負担重視ではドライバーの進路上の集合地点が選ばれること', async () => {
    const result = await calculateAssignment(members, destination, candidates, false, 'driver');
    const vp = result.vehiclePlans.find((v) => v.passengerIds.includes('p'))!;
    expect(vp.meetingPoint?.id).toBe('near-route');
  });

  it('集合のしやすさ重視のほうが集合時間が短くなること', async () => {
    const gathering = await calculateAssignment(members, destination, candidates, false, 'gathering');
    const driverMode = await calculateAssignment(members, destination, candidates, false, 'driver');
    expect(passengerAccessOf(gathering)).toBeLessThan(passengerAccessOf(driverMode));
  });

  it('モード未指定（既定=バランス）でも割り当てが成立すること', async () => {
    const result = await calculateAssignment(members, destination, candidates, false);
    expect(result.vehiclePlans.some((v) => v.passengerIds.includes('p'))).toBe(true);
  });
});
