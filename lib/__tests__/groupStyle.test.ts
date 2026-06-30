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

  it('パレットを超える番号も剰余で安全に色を返すこと', () => {
    expect(getGroupStyle('10')).toEqual(getGroupStyle('1'));
  });

  it('数字以外のIDでも安定して同じ色を返すこと', () => {
    expect(getGroupStyle('A')).toEqual(getGroupStyle('A'));
    expect(getGroupStyle('A').dotClass).toMatch(/^bg-/);
  });

  it('1〜9は丸数字ラベルになること', () => {
    expect(getGroupLabel('1')).toBe('グループ①');
    expect(getGroupLabel('9')).toBe('グループ⑨');
  });

  it('範囲外や数字以外はそのまま付与すること', () => {
    expect(getGroupLabel('10')).toBe('グループ10');
    expect(getGroupLabel('A')).toBe('グループA');
  });
});
