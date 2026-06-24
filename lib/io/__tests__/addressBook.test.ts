import { describe, it, expect } from 'vitest';
import { Member } from '../../types';
import { buildAddressBookCsv, parseAddressBookCsv, AddressBookParseError } from '../addressBook';

const members: Member[] = [
  { id: '1', name: '田中', addressInput: '東京都新宿区西新宿1丁目', location: { lat: 35.6938, lng: 139.7034 }, isDriver: true, vehicleCapacity: 4 },
  { id: '2', name: '佐藤', addressInput: '東京都世田谷区', isDriver: false },
];

describe('addressBook CSV', () => {
  it('書き出した内容をそのまま読み込めること（往復一致、id・緯度経度は除く）', () => {
    const csv = buildAddressBookCsv(members);
    const parsed = parseAddressBookCsv(csv);
    expect(parsed.map(({ id, location, ...rest }) => rest)).toEqual([
      { name: '田中', addressInput: '東京都新宿区西新宿1丁目', isDriver: true, vehicleCapacity: 4 },
      { name: '佐藤', addressInput: '東京都世田谷区', isDriver: false },
    ]);
  });

  it('書き出したCSVに緯度経度や内部IDが含まれないこと', () => {
    const csv = buildAddressBookCsv(members);
    expect(csv).not.toContain('35.6938');
    expect(csv).not.toContain('139.7034');
    // 内部ID（'1','2'）が住所・氏名以外の独立した列として出ていないこと
    expect(csv.split('\r\n')[0]).toBe('氏名,住所,運転,定員');
  });

  it('カンマや改行を含む住所を正しく往復できること', () => {
    const tricky: Member[] = [
      { id: '1', name: '山田, 太郎', addressInput: '東京都\n新宿区"1"', isDriver: false },
    ];
    const parsed = parseAddressBookCsv(buildAddressBookCsv(tricky));
    expect(parsed[0].name).toBe('山田, 太郎');
    expect(parsed[0].addressInput).toBe('東京都\n新宿区"1"');
  });

  it('英語の列名でも読み込めること', () => {
    const csv = 'name,address,driver,capacity\nAlice,Tokyo,yes,4\nBob,Osaka,no,';
    const parsed = parseAddressBookCsv(csv);
    expect(parsed[0]).toMatchObject({ name: 'Alice', addressInput: 'Tokyo', isDriver: true, vehicleCapacity: 4 });
    expect(parsed[1]).toMatchObject({ name: 'Bob', addressInput: 'Osaka', isDriver: false });
    expect(parsed[1].vehicleCapacity).toBeUndefined();
  });

  it('運転・定員の列が無くても氏名と住所があれば読み込めること', () => {
    const parsed = parseAddressBookCsv('氏名,住所\n田中,東京都新宿区');
    expect(parsed[0]).toMatchObject({ name: '田中', addressInput: '東京都新宿区', isDriver: false });
    expect(parsed[0].vehicleCapacity).toBeUndefined();
  });

  it('運転可否のさまざまな表記を真偽に変換すること', () => {
    const csv = '氏名,住所,運転\nA,x,はい\nB,x,いいえ\nC,x,○\nD,x,1\nE,x,';
    const parsed = parseAddressBookCsv(csv);
    expect(parsed.map((m) => m.isDriver)).toEqual([true, false, true, true, false]);
  });

  it('先頭BOMやCRLF改行を扱えること', () => {
    const csv = '﻿氏名,住所\r\n田中,東京都\r\n';
    const parsed = parseAddressBookCsv(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ name: '田中', addressInput: '東京都' });
  });

  it('空行を読み飛ばすこと', () => {
    const parsed = parseAddressBookCsv('氏名,住所\n\n田中,東京都\n\n');
    expect(parsed).toHaveLength(1);
  });

  it('見出し行に氏名・住所が無い場合は拒否すること', () => {
    expect(() => parseAddressBookCsv('foo,bar\n1,2')).toThrow(AddressBookParseError);
  });

  it('空のCSVを拒否すること', () => {
    expect(() => parseAddressBookCsv('')).toThrow(AddressBookParseError);
  });

  it('データ行で氏名が空の場合は拒否すること', () => {
    expect(() => parseAddressBookCsv('氏名,住所\n,東京都')).toThrow(AddressBookParseError);
  });
});
