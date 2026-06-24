import { describe, it, expect } from 'vitest';
import { calculateAssignment } from '../planner/assignment';
import { Member, MeetingCandidate, LatLng } from '../types';

// ドライバーと同乗者は西寄り(経度139.55付近)。グローバル候補は遠い東(139.95)に1つだけ置く。
const destination: LatLng = { lat: 35.48, lng: 138.75 };
const driver: Member = { id: 'd', name: 'D', addressInput: '', location: { lat: 35.66, lng: 139.55 }, isDriver: true, vehicleCapacity: 3 };
const passenger: Member = { id: 'p', name: 'P', addressInput: '', location: { lat: 35.66, lng: 139.56 }, isDriver: false };
const members = [driver, passenger];

const farGlobal: MeetingCandidate[] = [
  { id: 'center', name: '遠い中央駅', address: '', location: { lat: 35.66, lng: 139.95 }, placeType: 'station' },
];

// 要求中心ちょうどに候補を返すプロバイダ（車ごとの集合地点＝そのグループの重心になる）
const provider = async (center: LatLng): Promise<MeetingCandidate[]> => [
  { id: 'local', name: '近隣駅', address: '', location: center, placeType: 'station' as const },
];

describe('集合地点を車ごとにメンバー近くで選ぶ', () => {
  it('candidateProvider 無しでは渡されたグローバル候補（遠い）が使われること', async () => {
    const r = await calculateAssignment(members, destination, farGlobal, false, 'balanced');
    const vp = r.vehiclePlans.find((v) => v.passengerIds.includes('p'))!;
    expect(vp.meetingPoint?.id).toBe('center');
  });

  it('candidateProvider 有りでは車のメンバー近くの集合地点へ置き換わること', async () => {
    const r = await calculateAssignment(members, destination, farGlobal, false, 'balanced', provider);
    const vp = r.vehiclePlans.find((v) => v.passengerIds.includes('p'))!;
    expect(vp.meetingPoint?.id).toBe('local');
    // メンバー(経度139.5x)の近くに来る＝遠いcenter(139.95)より小さい経度
    expect(vp.meetingPoint!.location.lng).toBeLessThan(139.8);
    // 集合時間も短くなる
    const access = vp.passengerAccess.find((a) => a.memberId === 'p')!.durationMinutes!;
    expect(access).toBeLessThan(30);
  });

  it('2台が別クラスタなら車ごとに別々の集合地点になること', async () => {
    const two: Member[] = [
      { id: 'dW', name: '西D', addressInput: '', location: { lat: 35.66, lng: 139.50 }, isDriver: true, vehicleCapacity: 2 },
      { id: 'pW', name: '西P', addressInput: '', location: { lat: 35.66, lng: 139.50 }, isDriver: false },
      { id: 'dE', name: '東D', addressInput: '', location: { lat: 35.66, lng: 140.00 }, isDriver: true, vehicleCapacity: 2 },
      { id: 'pE', name: '東P', addressInput: '', location: { lat: 35.66, lng: 140.00 }, isDriver: false },
    ];
    // 各クラスタ付近に候補がある現実的な設定（貪欲割り当てが地理的に素直になる）
    const twoGlobals: MeetingCandidate[] = [
      { id: 'gW', name: '西駅', address: '', location: { lat: 35.66, lng: 139.50 }, placeType: 'station' },
      { id: 'gE', name: '東駅', address: '', location: { lat: 35.66, lng: 140.00 }, placeType: 'station' },
    ];
    const r = await calculateAssignment(two, destination, twoGlobals, false, 'balanced', provider);
    const carsWithPax = r.vehiclePlans.filter((v) => v.passengerIds.length > 0);
    expect(carsWithPax.length).toBe(2);
    const lngs = carsWithPax.map((v) => v.meetingPoint!.location.lng);
    // 2台の集合地点が異なる経度になっている（同じ駅に固まらない）
    expect(Math.abs(lngs[0] - lngs[1])).toBeGreaterThan(0.1);
  });
});
