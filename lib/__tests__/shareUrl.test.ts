import { describe, it, expect } from 'vitest';
import { buildShareUrl, parseSharePayload } from '../share-url/shareUrl';
import { SharePlanPayload } from '../types';

const payload: SharePlanPayload = {
  title: 'テスト配車',
  destinationLabel: '河口湖キャンプ場',
  vehiclePlans: [
    {
      driverName: '田中',
      passengerNames: ['佐藤', '鈴木'],
      meetingPointName: '中野駅',
      meetingPointMapsUrl: 'https://www.google.com/maps/dir/?api=1&destination=35.7061,139.6658',
      destinationMapsUrl: 'https://www.google.com/maps/dir/?api=1&origin=35.7061,139.6658&destination=35.4786,138.7531&travelmode=driving',
      driveDurationText: '1時間30分',
    },
  ],
  transitOnlyPlans: [
    {
      memberName: '高橋',
      destinationMapsUrl: 'https://www.google.com/maps/dir/?api=1&destination=35.4786,138.7531',
      reasonText: '席不足',
    },
  ],
  notes: 'テストメモ',
  createdAt: '2024-01-01T00:00:00Z',
};

describe('buildShareUrl / parseSharePayload', () => {
  it('共有URLが /s# 形式で生成されること', () => {
    const result = buildShareUrl(payload);
    expect(result.shareUrl).toContain('/s#');
    expect(result.byteLength).toBeGreaterThan(0);
  });

  it('URLフラグメントに出発地住所や自宅緯度経度が含まれないこと', () => {
    const result = buildShareUrl(payload);
    const hash = result.shareUrl.split('#')[1];
    // 出発地住所
    expect(hash).not.toContain('東京都新宿区');
    expect(hash).not.toContain('世田谷');
    // 自宅緯度経度
    expect(hash).not.toContain('35.6938');
    expect(hash).not.toContain('139.7034');
  });

  it('共有URLからペイロードを復元できること', () => {
    const result = buildShareUrl(payload);
    const originalHash = window.location.hash;
    window.location.hash = result.shareUrl.split('#')[1];
    try {
      const restored = parseSharePayload();
      expect(restored).toEqual(payload);
    } finally {
      window.location.hash = originalHash;
    }
  });

  it('不正な共有URLでnullが返ること', () => {
    const originalHash = window.location.hash;
    window.location.hash = '#invalid-data';
    try {
      expect(parseSharePayload()).toBeNull();
    } finally {
      window.location.hash = originalHash;
    }
  });

  it('引数で渡したhash文字列から復元できること', () => {
    const result = buildShareUrl(payload);
    const hash = '#' + result.shareUrl.split('#')[1];
    expect(parseSharePayload(hash)).toEqual(payload);
  });
});
