import { Destination, LatLng, Member } from '@/lib/types';

// 入力内容（住所・氏名・目的地）をユーザー自身のファイルとして書き出し/読み込みするための処理。
// サーバーやブラウザストレージには触れず、JSON文字列の組み立て・解析のみを行う。
export const PLAN_FILE_VERSION = 1;

export type PlanFileData = {
  version: number;
  destination: Destination;
  members: Member[];
};

export class PlanFileParseError extends Error {}

export function buildPlanFile(members: Member[], destination: Destination): PlanFileData {
  return { version: PLAN_FILE_VERSION, destination, members };
}

export function serializePlanFile(data: PlanFileData): string {
  return JSON.stringify(data, null, 2);
}

export function parsePlanFile(json: string): PlanFileData {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new PlanFileParseError('ファイルの形式が正しくありません（JSONとして読み込めません）。');
  }

  if (typeof raw !== 'object' || raw === null) {
    throw new PlanFileParseError('ファイルの形式が正しくありません。');
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.version !== 'number') {
    throw new PlanFileParseError('対応していないファイル形式です。');
  }

  return {
    version: obj.version,
    destination: parseDestination(obj.destination),
    members: parseMembers(obj.members),
  };
}

function parseLatLng(value: unknown): LatLng | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'object') {
    throw new PlanFileParseError('位置情報の形式が正しくありません。');
  }
  const v = value as Record<string, unknown>;
  if (typeof v.lat !== 'number' || typeof v.lng !== 'number') {
    throw new PlanFileParseError('位置情報の形式が正しくありません。');
  }
  return { lat: v.lat, lng: v.lng };
}

function parseDestination(value: unknown): Destination {
  if (typeof value !== 'object' || value === null) {
    throw new PlanFileParseError('目的地のデータが見つかりません。');
  }
  const v = value as Record<string, unknown>;
  if (typeof v.addressInput !== 'string') {
    throw new PlanFileParseError('目的地のデータが正しくありません。');
  }
  return { addressInput: v.addressInput, location: parseLatLng(v.location) };
}

function parseMembers(value: unknown): Member[] {
  if (!Array.isArray(value)) {
    throw new PlanFileParseError('メンバーのデータが正しくありません。');
  }
  return value.map(parseMember);
}

function parseMember(value: unknown, index: number): Member {
  if (typeof value !== 'object' || value === null) {
    throw new PlanFileParseError(`メンバー${index + 1}のデータが正しくありません。`);
  }
  const v = value as Record<string, unknown>;
  if (
    typeof v.id !== 'string' ||
    typeof v.name !== 'string' ||
    typeof v.addressInput !== 'string' ||
    typeof v.isDriver !== 'boolean'
  ) {
    throw new PlanFileParseError(`メンバー${index + 1}のデータが正しくありません。`);
  }
  return {
    id: v.id,
    name: v.name,
    addressInput: v.addressInput,
    isDriver: v.isDriver,
    location: parseLatLng(v.location),
    vehicleCapacity: typeof v.vehicleCapacity === 'number' ? v.vehicleCapacity : undefined,
  };
}
