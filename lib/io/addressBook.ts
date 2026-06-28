import { Member } from '../types';

// 住所録（メンバーの氏名・住所・運転可否・定員）を、ユーザー自身のCSVファイルとして
// 書き出し/読み込みするための処理。サーバーやブラウザストレージには触れず、
// CSV文字列の組み立て・解析のみを行う。
// 目的地はCSVには含めない（住所録は人の一覧であり、目的地は都度入力する想定のため）。
// location（緯度経度）は住所文字列から都度再解決できるため書き出さない。

export class AddressBookParseError extends Error {}

// 書き出し時のヘッダー（日本語）。表計算ソフトで開いたときに分かりやすい並び。
const EXPORT_HEADER = ['氏名', '住所', '運転', '定員', '同乗グループ', '指定集合場所'];

// 読み込み時に許容する列名のゆれ。外部の住所録CSVを取り込めるよう別名も受け付ける。
// 比較は normalizeHeader（trim + 小文字化 + 空白除去）後の文字列で行う。
const NAME_ALIASES = ['氏名', '名前', 'name'];
const ADDRESS_ALIASES = ['住所', 'address'];
const DRIVER_ALIASES = ['運転', '運転手', '運転可否', 'ドライバー', 'driver', 'isdriver'];
const CAPACITY_ALIASES = ['定員', '乗車定員', '席数', 'capacity', 'vehiclecapacity'];
const GROUP_ALIASES = ['同乗グループ', 'グループ', 'group', 'groupid'];
const MEETING_ALIASES = ['指定集合場所', '集合場所', 'meetingpoint', 'meeting'];

// 運転可否を「はい」とみなす値。表計算ソフトでよく使われる表記を広めに許容する。
const DRIVER_TRUE_VALUES = ['はい', 'yes', 'true', '1', '○', '◯', 'o', 'y', '可'];

export function buildAddressBookCsv(members: Member[]): string {
  const rows = members.map((m) => [
    m.name,
    m.addressInput,
    m.isDriver ? 'はい' : 'いいえ',
    m.vehicleCapacity != null ? String(m.vehicleCapacity) : '',
    m.groupId ?? '',
    m.meetingPointInput ?? '',
  ]);
  return [EXPORT_HEADER, ...rows].map((row) => row.map(escapeCsvField).join(',')).join('\r\n');
}

export function parseAddressBookCsv(csv: string): Member[] {
  const rows = parseCsvRows(csv);
  // 完全に空の行（末尾の改行などで生じる）は対象外。
  const nonEmptyRows = rows.filter((row) => row.some((cell) => cell.trim() !== ''));
  if (nonEmptyRows.length === 0) {
    throw new AddressBookParseError('CSVにデータがありません。');
  }

  const header = nonEmptyRows[0].map(normalizeHeader);
  const nameIdx = findColumn(header, NAME_ALIASES);
  const addressIdx = findColumn(header, ADDRESS_ALIASES);
  if (nameIdx === -1 || addressIdx === -1) {
    throw new AddressBookParseError(
      '見出し行が見つかりません。1行目に「氏名」「住所」（任意で「運転」「定員」）の列を入れてください。',
    );
  }
  const driverIdx = findColumn(header, DRIVER_ALIASES);
  const capacityIdx = findColumn(header, CAPACITY_ALIASES);
  const groupIdx = findColumn(header, GROUP_ALIASES);
  const meetingIdx = findColumn(header, MEETING_ALIASES);

  const members: Member[] = [];
  for (let i = 1; i < nonEmptyRows.length; i++) {
    const row = nonEmptyRows[i];
    const name = (row[nameIdx] ?? '').trim();
    const addressInput = (row[addressIdx] ?? '').trim();
    if (name === '' && addressInput === '') continue;
    if (name === '') {
      throw new AddressBookParseError(`${i + 1}行目: 氏名が入力されていません。`);
    }

    const member: Member = {
      id: `csv-${i}-${Date.now()}`,
      name,
      addressInput,
      isDriver: driverIdx === -1 ? false : parseDriver(row[driverIdx]),
    };
    const capacity = capacityIdx === -1 ? undefined : parseCapacity(row[capacityIdx]);
    if (capacity !== undefined) member.vehicleCapacity = capacity;
    const groupId = groupIdx === -1 ? '' : (row[groupIdx] ?? '').trim();
    if (groupId !== '') member.groupId = groupId;
    const meetingPoint = meetingIdx === -1 ? '' : (row[meetingIdx] ?? '').trim();
    if (meetingPoint !== '') member.meetingPointInput = meetingPoint;
    members.push(member);
  }

  if (members.length === 0) {
    throw new AddressBookParseError('読み込めるメンバーがありませんでした。');
  }
  return members;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s/g, '');
}

function findColumn(header: string[], aliases: string[]): number {
  const set = aliases.map(normalizeHeader);
  return header.findIndex((h) => set.includes(h));
}

function parseDriver(value: string | undefined): boolean {
  return DRIVER_TRUE_VALUES.includes((value ?? '').trim().toLowerCase());
}

function parseCapacity(value: string | undefined): number | undefined {
  const trimmed = (value ?? '').trim();
  if (trimmed === '') return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

// CSVのフィールドを必要に応じて引用符で囲む（カンマ・引用符・改行を含む場合）。
function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// RFC 4180 に概ね準拠したCSVパーサ。引用符内のカンマ・改行・エスケープ（""）に対応。
// 先頭のBOM、CRLF/LF の両方を扱う。
function parseCsvRows(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\r') {
      i++;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += c;
    i++;
  }
  row.push(field);
  rows.push(row);
  return rows;
}
