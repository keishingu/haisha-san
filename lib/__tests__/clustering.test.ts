import { describe, it, expect } from 'vitest';
import { calculateAssignment } from '../planner/assignment';
import { Member, MeetingCandidate, LatLng } from '../types';

const destination: LatLng = { lat: 35.48, lng: 138.75 };

// 西クラスタと東クラスタ。共有の集合候補は「遠い中央(東寄り)」に1つだけ。
// 旧実装（共有候補で割り当て）だと遠回り計算が候補位置に引っ張られて交差し得たが、
// クラスタリング後はメンバーは地理的に近いドライバーへ割り当てられる。
const members: Member[] = [
  { id: 'dW', name: '西ドライバー', addressInput: '', location: { lat: 35.66, lng: 139.50 }, isDriver: true, vehicleCapacity: 2 },
  { id: 'pW', name: '西メンバー', addressInput: '', location: { lat: 35.66, lng: 139.51 }, isDriver: false },
  { id: 'dE', name: '東ドライバー', addressInput: '', location: { lat: 35.66, lng: 140.00 }, isDriver: true, vehicleCapacity: 2 },
  { id: 'pE', name: '東メンバー', addressInput: '', location: { lat: 35.66, lng: 139.99 }, isDriver: false },
];

const farSharedCandidate: MeetingCandidate[] = [
  { id: 'center', name: '遠い中央駅', address: '', location: { lat: 35.66, lng: 139.95 }, placeType: 'station' },
];

describe('割り当てフェーズのクラスタリング', () => {
  it('遠い共有候補があってもメンバーは近いドライバーへ割り当てられる（交差しない）', async () => {
    const r = await calculateAssignment(members, destination, farSharedCandidate, false, 'balanced');
    const carW = r.vehiclePlans.find((v) => v.driverId === 'dW')!;
    const carE = r.vehiclePlans.find((v) => v.driverId === 'dE')!;
    expect(carW.passengerIds).toContain('pW');
    expect(carE.passengerIds).toContain('pE');
    expect(carW.passengerIds).not.toContain('pE');
    expect(carE.passengerIds).not.toContain('pW');
  });

  it('定員を超える割り当ては生成されない', async () => {
    const r = await calculateAssignment(members, destination, farSharedCandidate, false, 'balanced');
    for (const vp of r.vehiclePlans) {
      const driver = members.find((m) => m.id === vp.driverId)!;
      expect(vp.passengerIds.length + 1).toBeLessThanOrEqual(driver.vehicleCapacity!);
    }
  });
});
