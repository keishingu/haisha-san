import { describe, it, expect } from 'vitest';
import { calculateAssignment } from '../assignment';
import { Member, MeetingCandidate, LatLng } from '../../types';

describe('calculateAssignment', () => {
  const destination: LatLng = { lat: 35.4786, lng: 138.7531 };

  const meetingCandidates: MeetingCandidate[] = [
    {
      id: 'station1',
      name: '中野駅',
      address: '東京都中野区中野5丁目',
      location: { lat: 35.7061, lng: 139.6658 },
      placeType: 'station',
    },
  ];

  it('車がない場合は全員を公共交通組にすること', async () => {
    const members: Member[] = [
      { id: '1', name: '田中', addressInput: '東京都新宿区', location: { lat: 35.6938, lng: 139.7034 }, isDriver: false },
      { id: '2', name: '佐藤', addressInput: '東京都世田谷区', location: { lat: 35.6462, lng: 139.6527 }, isDriver: false },
    ];

    const result = await calculateAssignment(members, destination, meetingCandidates);

    expect(result.vehiclePlans).toHaveLength(0);
    expect(result.transitOnlyPlans).toHaveLength(2);
    expect(result.transitOnlyPlans[0].reason).toBe('no_vehicle');
    expect(result.transitOnlyPlans[1].reason).toBe('no_vehicle');
    expect(result.warnings).toContain('車ありメンバーがいません。全員が公共交通で目的地へ向かいます。');
  });

  it('総定員が不足する場合、席不足の公共交通組が生成されること', async () => {
    const members: Member[] = [
      { id: '1', name: '田中', addressInput: '東京都新宿区', location: { lat: 35.6938, lng: 139.7034 }, isDriver: true, vehicleCapacity: 2 },
      { id: '2', name: '佐藤', addressInput: '東京都世田谷区', location: { lat: 35.6462, lng: 139.6527 }, isDriver: false },
      { id: '3', name: '鈴木', addressInput: '東京都中野区', location: { lat: 35.7077, lng: 139.6639 }, isDriver: false },
    ];

    const result = await calculateAssignment(members, destination, meetingCandidates);

    expect(result.vehiclePlans).toHaveLength(1);
    expect(result.vehiclePlans[0].passengerIds.length).toBeLessThanOrEqual(1);
    expect(result.transitOnlyPlans.length).toBeGreaterThanOrEqual(1);
    expect(result.transitOnlyPlans[0].reason).toBe('seat_shortage');
  });

  it('定員超過時の割り当てが行われないこと', async () => {
    const members: Member[] = [
      { id: '1', name: '田中', addressInput: '東京都新宿区', location: { lat: 35.6938, lng: 139.7034 }, isDriver: true, vehicleCapacity: 1 },
      { id: '2', name: '佐藤', addressInput: '東京都世田谷区', location: { lat: 35.6462, lng: 139.6527 }, isDriver: false },
    ];

    const result = await calculateAssignment(members, destination, meetingCandidates);

    // ドライバーの定員が1（本人のみ）なので乗客は割り当てられない
    const allAssignedPassengers = result.vehiclePlans.flatMap(vp => vp.passengerIds);
    expect(allAssignedPassengers).toHaveLength(0);
    expect(result.transitOnlyPlans).toHaveLength(1);
    expect(result.transitOnlyPlans[0].reason).toBe('seat_shortage');
  });

  it('Google Mapsリンクが生成されること', async () => {
    const members: Member[] = [
      { id: '1', name: '田中', addressInput: '東京都新宿区', location: { lat: 35.6938, lng: 139.7034 }, isDriver: true, vehicleCapacity: 2 },
      { id: '2', name: '佐藤', addressInput: '東京都世田谷区', location: { lat: 35.6462, lng: 139.6527 }, isDriver: false },
    ];

    const result = await calculateAssignment(members, destination, meetingCandidates);

    expect(result.vehiclePlans[0].googleMapsUrl).toContain('https://www.google.com/maps/dir/');
    expect(result.transitOnlyPlans).toHaveLength(0);
  });
});
