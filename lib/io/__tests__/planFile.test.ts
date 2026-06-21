import { describe, it, expect } from 'vitest';
import { Member, Destination } from '@/lib/types';
import { buildPlanFile, parsePlanFile, serializePlanFile, PlanFileParseError } from '../planFile';

const members: Member[] = [
  { id: '1', name: '田中', addressInput: '東京都新宿区西新宿1丁目', location: { lat: 35.6938, lng: 139.7034 }, isDriver: true, vehicleCapacity: 4 },
  { id: '2', name: '佐藤', addressInput: '東京都世田谷区', isDriver: false },
];
const destination: Destination = { addressInput: '河口湖キャンプ場', location: { lat: 35.4786, lng: 138.7531 } };

describe('planFile', () => {
  it('書き出した内容をそのまま読み込めること（往復一致）', () => {
    const json = serializePlanFile(buildPlanFile(members, destination));
    const parsed = parsePlanFile(json);
    expect(parsed.members).toEqual(members);
    expect(parsed.destination).toEqual(destination);
  });

  it('不正なJSONを拒否すること', () => {
    expect(() => parsePlanFile('not json')).toThrow(PlanFileParseError);
  });

  it('versionフィールドが無い場合は拒否すること', () => {
    expect(() => parsePlanFile(JSON.stringify({ destination, members }))).toThrow(PlanFileParseError);
  });

  it('membersが配列でない場合は拒否すること', () => {
    expect(() => parsePlanFile(JSON.stringify({ version: 1, destination, members: 'x' }))).toThrow(PlanFileParseError);
  });

  it('メンバーの必須項目が欠けている場合は拒否すること', () => {
    const bad = { version: 1, destination, members: [{ id: '1', name: '田中' }] };
    expect(() => parsePlanFile(JSON.stringify(bad))).toThrow(PlanFileParseError);
  });
});
