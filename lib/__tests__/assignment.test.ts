import { describe, it, expect } from 'vitest';
import { calculateAssignment } from '../planner/assignment';
import { Member, MeetingCandidate, LatLng } from '../types';

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

    const allAssignedPassengers = result.vehiclePlans.flatMap((vp) => vp.passengerIds);
    expect(allAssignedPassengers).toHaveLength(0);
    expect(result.transitOnlyPlans).toHaveLength(1);
    expect(result.transitOnlyPlans[0].reason).toBe('seat_shortage');
  });

  it('総定員を超える割り当てが生成されないこと（複数台）', async () => {
    const members: Member[] = [
      { id: '1', name: '田中', addressInput: '東京都新宿区', location: { lat: 35.6938, lng: 139.7034 }, isDriver: true, vehicleCapacity: 2 },
      { id: '2', name: '佐藤', addressInput: '東京都世田谷区', location: { lat: 35.6462, lng: 139.6527 }, isDriver: true, vehicleCapacity: 2 },
      { id: '3', name: '鈴木', addressInput: '東京都中野区', location: { lat: 35.7077, lng: 139.6639 }, isDriver: false },
      { id: '4', name: '高橋', addressInput: '東京都杉並区', location: { lat: 35.6994, lng: 139.6367 }, isDriver: false },
    ];

    const result = await calculateAssignment(members, destination, meetingCandidates);

    for (const vp of result.vehiclePlans) {
      const driver = members.find((m) => m.id === vp.driverId)!;
      // 乗車人数（ドライバー本人 + 同乗者）が定員以内であること
      expect(vp.passengerIds.length + 1).toBeLessThanOrEqual(driver.vehicleCapacity!);
    }
  });

  it('同乗者0人のドライバーもソロ車として表示されること（車が消えない）', async () => {
    const members: Member[] = [
      { id: '1', name: '田中', addressInput: '東京都新宿区', location: { lat: 35.6938, lng: 139.7034 }, isDriver: true, vehicleCapacity: 4 },
      { id: '2', name: '佐藤', addressInput: '東京都世田谷区', location: { lat: 35.6462, lng: 139.6527 }, isDriver: true, vehicleCapacity: 4 },
      { id: '3', name: '鈴木', addressInput: '東京都中野区', location: { lat: 35.7077, lng: 139.6639 }, isDriver: true, vehicleCapacity: 4 },
      { id: '4', name: '高橋', addressInput: '東京都杉並区', location: { lat: 35.6994, lng: 139.6367 }, isDriver: false },
    ];

    const result = await calculateAssignment(members, destination, meetingCandidates);

    // ドライバー3人 → 車は3台すべて表示される（同乗者がいない車も含む）
    expect(result.vehiclePlans).toHaveLength(3);
    const solo = result.vehiclePlans.filter((vp) => vp.passengerIds.length === 0);
    expect(solo.length).toBeGreaterThanOrEqual(2);
    // ソロ車は集合地点なし・直行リンクを持つ
    for (const vp of solo) {
      expect(vp.meetingPoint).toBeUndefined();
      expect(vp.googleMapsUrl).toContain('https://www.google.com/maps/dir/');
    }
    expect(result.transitOnlyPlans).toHaveLength(0);
  });

  it('同乗グループのメンバーが同じ車に割り当てられること', async () => {
    const members: Member[] = [
      { id: '1', name: '田中', addressInput: '東京都新宿区', location: { lat: 35.6938, lng: 139.7034 }, isDriver: true, vehicleCapacity: 4 },
      { id: '2', name: '佐藤', addressInput: '神奈川県横浜市', location: { lat: 35.4437, lng: 139.6380 }, isDriver: true, vehicleCapacity: 4 },
      // 鈴木と高橋は地理的に別々のドライバーに近いが、同じグループなので同じ車になる。
      { id: '3', name: '鈴木', addressInput: '東京都中野区', location: { lat: 35.7077, lng: 139.6639 }, isDriver: false, groupId: '1' },
      { id: '4', name: '高橋', addressInput: '神奈川県川崎市', location: { lat: 35.5308, lng: 139.7029 }, isDriver: false, groupId: '1' },
    ];

    const result = await calculateAssignment(members, destination, meetingCandidates);

    const carWith3 = result.vehiclePlans.find((vp) => vp.passengerIds.includes('3'));
    expect(carWith3).toBeDefined();
    expect(carWith3!.passengerIds).toContain('4');
    expect(result.transitOnlyPlans).toHaveLength(0);
  });

  it('グループにドライバーが含まれる場合そのドライバーの車に固定されること', async () => {
    const members: Member[] = [
      // 佐藤の方が鈴木に近いが、鈴木は田中とグループなので田中の車に乗る。
      { id: '1', name: '田中', addressInput: '神奈川県横浜市', location: { lat: 35.4437, lng: 139.6380 }, isDriver: true, vehicleCapacity: 4, groupId: '1' },
      { id: '2', name: '佐藤', addressInput: '東京都中野区', location: { lat: 35.7077, lng: 139.6639 }, isDriver: true, vehicleCapacity: 4 },
      { id: '3', name: '鈴木', addressInput: '東京都中野区', location: { lat: 35.7077, lng: 139.6639 }, isDriver: false, groupId: '1' },
    ];

    const result = await calculateAssignment(members, destination, meetingCandidates);

    const tanakaCar = result.vehiclePlans.find((vp) => vp.driverId === '1');
    expect(tanakaCar!.passengerIds).toContain('3');
    const satoCar = result.vehiclePlans.find((vp) => vp.driverId === '2');
    expect(satoCar!.passengerIds).not.toContain('3');
  });

  it('ドライバー無しグループが先に並んでいてもドライバー固定グループの席が確保されること', async () => {
    // member一覧では先にドライバー無しグループ(2)が登場するが、ドライバー固定グループ(1)の
    // 席を先取りして固定グループのメンバーを押し出してはいけない。田中の定員は2（空席1）。
    const members: Member[] = [
      { id: '1', name: '田中', addressInput: '東京都新宿区', location: { lat: 35.6938, lng: 139.7034 }, isDriver: true, vehicleCapacity: 2, groupId: '1' },
      // ドライバー無しグループ2。田中に近いので放っておくと田中の唯一の空席を取りに行く。
      { id: '2', name: '佐藤', addressInput: '東京都新宿区', location: { lat: 35.6938, lng: 139.7034 }, isDriver: false, groupId: '2' },
      // 田中とグループのメンバー（後に登場）。固定なので田中の空席はこの人のために確保される。
      { id: '3', name: '鈴木', addressInput: '東京都中野区', location: { lat: 35.7077, lng: 139.6639 }, isDriver: false, groupId: '1' },
      // 佐藤を受けられるもう1台。
      { id: '4', name: '高橋', addressInput: '東京都新宿区', location: { lat: 35.6938, lng: 139.7034 }, isDriver: true, vehicleCapacity: 4 },
    ];

    const result = await calculateAssignment(members, destination, meetingCandidates);

    const tanakaCar = result.vehiclePlans.find((vp) => vp.driverId === '1');
    expect(tanakaCar!.passengerIds).toEqual(['3']);
    // 鈴木が公共交通に押し出されていないこと。
    expect(result.transitOnlyPlans.map((t) => t.memberId)).not.toContain('3');
  });

  it('グループ全員を収められる車が無い場合は全員を公共交通組にすること', async () => {
    const members: Member[] = [
      { id: '1', name: '田中', addressInput: '東京都新宿区', location: { lat: 35.6938, lng: 139.7034 }, isDriver: true, vehicleCapacity: 2 }, // 空席1
      { id: '2', name: '佐藤', addressInput: '東京都世田谷区', location: { lat: 35.6462, lng: 139.6527 }, isDriver: false, groupId: '1' },
      { id: '3', name: '鈴木', addressInput: '東京都中野区', location: { lat: 35.7077, lng: 139.6639 }, isDriver: false, groupId: '1' },
    ];

    const result = await calculateAssignment(members, destination, meetingCandidates);

    // グループをばらさず、2人とも公共交通組へ。
    expect(result.vehiclePlans[0].passengerIds).toHaveLength(0);
    const transitIds = result.transitOnlyPlans.map((t) => t.memberId).sort();
    expect(transitIds).toEqual(['2', '3']);
  });

  it('ドライバーの指定集合場所が集合地点として使われること', async () => {
    const meetingPointLocation: LatLng = { lat: 35.6896, lng: 139.7006 }; // 新宿駅
    const members: Member[] = [
      { id: '1', name: '田中', addressInput: '東京都新宿区', location: { lat: 35.6938, lng: 139.7034 }, isDriver: true, vehicleCapacity: 4, meetingPointInput: '新宿駅西口', meetingPointLocation },
      { id: '2', name: '佐藤', addressInput: '東京都世田谷区', location: { lat: 35.6462, lng: 139.6527 }, isDriver: false },
    ];

    const result = await calculateAssignment(members, destination, meetingCandidates);

    expect(result.vehiclePlans[0].meetingPoint?.name).toBe('新宿駅西口');
    expect(result.vehiclePlans[0].meetingPoint?.location).toEqual(meetingPointLocation);
    expect(result.vehiclePlans[0].meetingPoint?.placeType).toBe('custom');
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
