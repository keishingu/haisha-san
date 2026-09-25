import { describe, it, expect } from 'vitest';
import { generateShortCode, redisKeyForCode } from '../short-link/shortLink';

describe('generateShortCode', () => {
  it('8文字のコードを生成すること', () => {
    expect(generateShortCode()).toHaveLength(8);
  });

  it('紛らわしい文字(0/O/1/I/l)を含まないこと', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateShortCode()).not.toMatch(/[0O1Il]/);
    }
  });

  it('毎回異なるコードを生成すること', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateShortCode()));
    expect(codes.size).toBe(20);
  });
});

describe('redisKeyForCode', () => {
  it('share-link: プレフィックスを付与すること', () => {
    expect(redisKeyForCode('abc123')).toBe('share-link:abc123');
  });
});
