import { describe, it, expect } from 'vitest';
import { validateInputs } from '../planner/validation';
import { Member, Destination } from '../types';

describe('validateInputs', () => {
  const validDestination: Destination = {
    addressInput: '河口湖キャンプ場',
    location: { lat: 35.4786, lng: 138.7531 },
  };

  const validMembers: Member[] = [
    { id: '1', name: '田中', addressInput: '東京都新宿区', location: { lat: 35.6938, lng: 139.7034 }, isDriver: true, vehicleCapacity: 4 },
    { id: '2', name: '佐藤', addressInput: '東京都世田谷区', location: { lat: 35.6462, lng: 139.6527 }, isDriver: false },
  ];

  it('有効な入力でエラーがないこと', () => {
    const result = validateInputs(validMembers, validDestination);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('目的地が未入力の場合エラーになること', () => {
    const result = validateInputs(validMembers, { addressInput: '', location: undefined });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('目的地を入力してください。');
  });

  it('メンバーが2人未満の場合エラーになること', () => {
    const result = validateInputs([validMembers[0]], validDestination);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('メンバーは2人以上必要です。');
  });

  it('メンバー名が未入力の場合エラーになること', () => {
    const result = validateInputs([{ ...validMembers[0], name: '' }, validMembers[1]], validDestination);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('1人目のメンバー名を入力してください。');
  });

  it('住所が未入力の場合エラーになること', () => {
    const result = validateInputs([{ ...validMembers[0], addressInput: '' }, validMembers[1]], validDestination);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('田中の住所を入力してください。');
  });

  it('車ありメンバーの定員が未設定の場合エラーになること', () => {
    const result = validateInputs([{ ...validMembers[0], vehicleCapacity: undefined }, validMembers[1]], validDestination);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('田中の車の定員を1以上に設定してください。');
  });

  it('車ありメンバーがいない場合警告が出ること', () => {
    const members = validMembers.map((m) => ({ ...m, isDriver: false }));
    const result = validateInputs(members, validDestination);
    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain('車ありメンバーがいません。全員が公共交通で目的地へ向かいます。');
  });

  it('総定員不足の場合警告が出ること', () => {
    const members = [{ ...validMembers[0], vehicleCapacity: 1 }, validMembers[1]];
    const result = validateInputs(members, validDestination);
    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain('全員を乗せるにはあと1席足りません。乗車できないメンバーは公共交通で目的地へ向かう案として表示します。');
  });

  it('同じ同乗グループに車ありが2人いる場合エラーになること', () => {
    const members: Member[] = [
      { ...validMembers[0], groupId: '1' },
      { id: '3', name: '鈴木', addressInput: '東京都中野区', location: { lat: 35.7077, lng: 139.6639 }, isDriver: true, vehicleCapacity: 4, groupId: '1' },
      validMembers[1],
    ];
    const result = validateInputs(members, validDestination);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('同乗グループ「1」に車ありメンバーが2人います。1つのグループに車ありは1人までにしてください。');
  });

  it('車なしだけの同乗グループはエラーにならないこと', () => {
    const members: Member[] = [
      validMembers[0],
      { ...validMembers[1], groupId: '2' },
      { id: '3', name: '鈴木', addressInput: '東京都中野区', location: { lat: 35.7077, lng: 139.6639 }, isDriver: false, groupId: '2' },
    ];
    const result = validateInputs(members, validDestination);
    expect(result.isValid).toBe(true);
  });

  it('ドライバー付き同乗グループが空席を超える場合警告が出ること', () => {
    const members: Member[] = [
      { ...validMembers[0], vehicleCapacity: 2, groupId: '1' }, // 空席は1
      { ...validMembers[1], groupId: '1' },
      { id: '3', name: '鈴木', addressInput: '東京都中野区', location: { lat: 35.7077, lng: 139.6639 }, isDriver: false, groupId: '1' },
    ];
    const result = validateInputs(members, validDestination);
    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain('同乗グループ「1」は「田中」の空席(1人)を超えています。超過分は公共交通で目的地へ向かう案になります。');
  });
});
