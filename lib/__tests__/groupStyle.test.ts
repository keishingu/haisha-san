import { describe, it, expect } from 'vitest';
import { getGroupStyle, getGroupLabel, GROUP_OPTIONS } from '../ui/groupStyle';

describe('groupStyle', () => {
  it('GROUP_OPTIONSは1〜9の文字列であること', () => {
    expect(GROUP_OPTIONS).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  });

  it('同じ番号は常に同じ色になること', () => {
    expect(getGroupStyle('1')).toEqual(getGroupStyle('1'));
    expect(getGroupStyle('3').dotClass).toBe(getGroupStyle('3').dotClass);
  });

  it('異なる番号は異なる色になること（1〜9）', () => {
    const dots = GROUP_OPTIONS.map((g) => getGroupStyle(g).dotClass);
    expect(new Set(dots).size).toBe(GROUP_OPTIONS.length);
  });

  it('1〜9以外のIDの色は prefix ではなく文字列全体から安定的に決まること', () => {
    // 同じ文字列なら常に同じ色（決定的）。
    expect(getGroupStyle('10')).toEqual(getGroupStyle('10'));
    expect(getGroupStyle('01')).toEqual(getGroupStyle('01'));
    // prefix の parseInt（"01"/"10"→1）に依存していないこと: それぞれ別の色に割り当たる。
    // （9色パレットのため全組合せの非衝突は保証しないが、この代表ケースでは別色になる。）
    expect(getGroupStyle('10')).not.toEqual(getGroupStyle('1'));
    expect(getGroupStyle('01')).not.toEqual(getGroupStyle('1'));
  });

  it('数字以外のIDでも安定して同じ色を返すこと', () => {
    expect(getGroupStyle('A')).toEqual(getGroupStyle('A'));
    expect(getGroupStyle('A').dotClass).toMatch(/^bg-/);
  });

  it('1〜9は丸数字ラベルになること', () => {
    expect(getGroupLabel('1')).toBe('グループ①');
    expect(getGroupLabel('9')).toBe('グループ⑨');
  });

  it('文字列全体が1〜9でない場合は丸数字にせずそのまま付与すること', () => {
    expect(getGroupLabel('10')).toBe('グループ10');
    expect(getGroupLabel('01')).toBe('グループ01');
    expect(getGroupLabel('1A')).toBe('グループ1A');
    expect(getGroupLabel('A')).toBe('グループA');
  });
});
