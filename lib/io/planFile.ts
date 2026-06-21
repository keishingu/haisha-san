import { Destination, Member } from '../types';

// 入力内容（住所・氏名・目的地）をユーザー自身のファイルとして書き出し/読み込みするための処理。
// サーバーやブラウザストレージには触れず、JSON文字列の組み立て・解析のみを行う。
export const PLAN_FILE_VERSION = 1;

export type PlanFileData = {
  version: number;
  destination: Destination;
  members: Member[];
};

export class PlanFileParseError extends Error {}

// location（緯度経度）は住所文字列から都度再解決できるため書き出さない。
// テキストの住所だけにすることで、書き出し内容を画面の案内文（住所・氏名・目的地）と一致させる。
export function buildPlanFile(members: Member[], destination: Destination): PlanFileData {
  return {
    version: PLAN_FILE_VERSION,
    destination: { addressInput: destination.addressInput },
    members: members.map(({ location, ...rest }) => rest),
  };
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

// location（緯度経度）は画面に表示されないため、手編集や旧バージョンのファイルに含まれていても
// 取り込まずに常に捨てる。表示中の住所テキストと計算に使う座標がズレることを防ぐため。
function parseDestination(value: unknown): Destination {
  if (typeof value !== 'object' || value === null) {
    throw new PlanFileParseError('目的地のデータが見つかりません。');
  }
  const v = value as Record<string, unknown>;
  if (typeof v.addressInput !== 'string') {
    throw new PlanFileParseError('目的地のデータが正しくありません。');
  }
  return { addressInput: v.addressInput };
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
    vehicleCapacity: typeof v.vehicleCapacity === 'number' ? v.vehicleCapacity : undefined,
  };
}
