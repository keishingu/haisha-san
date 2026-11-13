import { describe, expect, it, vi } from 'vitest';
import { sampleGateway, type MapsGateway } from '../google-maps/gateway';
import { buildPlan } from '../planner/buildPlan';
import type { Member } from '../types';

// 集合地点の候補が1件も見つからない地図
const noCandidates = (): MapsGateway & { searchMeetingCandidates: ReturnType<typeof vi.fn> } => ({
  ...sampleGateway,
  searchMeetingCandidates: vi.fn(async () => []),
});

const driver = (id: string, addressInput: string): Member => ({ id, name: id, addressInput, isDriver: true, vehicleCapacity: 4 });
const rider = (id: string, addressInput: string): Member => ({ id, name: id, addressInput, isDriver: false });

describe('buildPlan: 集合地点の検索', () => {
  it('全員が運転するときは集合地点を検索せず、直行の車だけのプランを作ること', async () => {
    const maps = noCandidates();
    const { result } = await buildPlan([driver('a', '東京都杉並区'), driver('b', '東京都中野区')], { addressInput: '河口湖' }, 'balanced', maps);
    expect(maps.searchMeetingCandidates).not.toHaveBeenCalled();
    expect(result.vehiclePlans).toHaveLength(2);
    expect(result.vehiclePlans.every((vp) => !vp.meetingPoint)).toBe(true);
  });

  it('誰も運転しないときは集合地点を検索せず、全員を公共交通にすること', async () => {
    const maps = noCandidates();
    const { result } = await buildPlan([rider('a', '東京都杉並区'), rider('b', '東京都中野区')], { addressInput: '河口湖' }, 'balanced', maps);
    expect(maps.searchMeetingCandidates).not.toHaveBeenCalled();
    expect(result.transitOnlyPlans).toHaveLength(2);
  });

  it('同乗者がいて候補が見つからなければエラーにすること', async () => {
    await expect(
      buildPlan([driver('a', '東京都杉並区'), rider('b', '東京都中野区')], { addressInput: '河口湖' }, 'balanced', noCandidates()),
    ).rejects.toThrow(/集合地点候補が見つかりませんでした/);
  });
});
