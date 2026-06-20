import { describe, it, expect, beforeEach } from 'vitest';
import { Member, PlanResult } from '../types';
import { generateShareText } from '../share-url/shareText';
import { buildSharePayload } from '../share-url/payload';
import { buildShareUrl } from '../share-url/shareUrl';

const members: Member[] = [
  { id: '1', name: '田中', addressInput: '東京都新宿区西新宿1丁目', location: { lat: 35.6938, lng: 139.7034 }, isDriver: true, vehicleCapacity: 4 },
  { id: '2', name: '佐藤', addressInput: '東京都世田谷区', location: { lat: 35.6462, lng: 139.6527 }, isDriver: false },
  { id: '3', name: '鈴木', addressInput: '東京都中野区', location: { lat: 35.7077, lng: 139.6639 }, isDriver: false },
];

const planResult: PlanResult = {
  vehiclePlans: [
    {
      vehicleId: '1',
      driverId: '1',
      passengerIds: ['2'],
      meetingPoint: { id: 's1', name: '中野駅', address: '東京都中野区中野5丁目', location: { lat: 35.7061, lng: 139.6658 }, placeType: 'station' },
      driveDurationMinutes: 90,
      driverDetourMinutes: 12,
      passengerAccess: [{ memberId: '2', mode: 'transit', durationMinutes: 20 }],
      googleMapsUrl: 'https://www.google.com/maps/dir/?api=1&origin=35.7061,139.6658&destination=35.4786,138.7531&travelmode=driving',
    },
  ],
  transitOnlyPlans: [
    { memberId: '3', destinationMapsUrl: 'https://www.google.com/maps/dir/?api=1&destination=35.4786,138.7531', reason: 'seat_shortage' },
  ],
  warnings: ['席が1席不足しています。'],
};

describe('プライバシー: 共有テキスト', () => {
  it('共有テキストに出発地住所が含まれないこと', () => {
    const text = generateShareText(members, '河口湖キャンプ場', planResult);
    expect(text).not.toContain('東京都新宿区西新宿1丁目');
    expect(text).not.toContain('東京都世田谷区');
    expect(text).not.toContain('東京都中野区');
    // 氏名・目的地・集合地点名は含まれてよい
    expect(text).toContain('田中');
    expect(text).toContain('河口湖キャンプ場');
    expect(text).toContain('中野駅');
  });
});

describe('プライバシー: 共有ペイロード', () => {
  it('共有ペイロードに出発地住所と自宅緯度経度が含まれないこと', () => {
    const payload = buildSharePayload(members, '河口湖キャンプ場', planResult, 'メモ');
    const json = JSON.stringify(payload);
    expect(json).not.toContain('西新宿1丁目');
    expect(json).not.toContain('35.6938');
    expect(json).not.toContain('139.7034');
    expect(json).not.toContain('35.6462');
    // 車ごとの割り当てと公共交通組は含まれる
    expect(payload.vehiclePlans).toHaveLength(1);
    expect(payload.transitOnlyPlans).toHaveLength(1);
    expect(payload.vehiclePlans[0].driverName).toBe('田中');
    expect(payload.transitOnlyPlans[0].memberName).toBe('鈴木');
  });
});

describe('プライバシー: ストレージ非保存', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('共有テキスト・ペイロード・URL生成でLocalStorage/SessionStorageに何も保存しないこと', () => {
    generateShareText(members, '河口湖キャンプ場', planResult);
    const payload = buildSharePayload(members, '河口湖キャンプ場', planResult);
    buildShareUrl(payload);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
