import { describe, it, expect, vi } from 'vitest';

describe('isApiKeyConfigured（ブラウザ用Maps JSキーの有無）', () => {
  it('ブラウザ用キーが未設定の場合はfalseを返すこと', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY', '');
    const { isApiKeyConfigured } = await import('../google-maps/client');
    expect(isApiKeyConfigured()).toBe(false);
    vi.unstubAllEnvs();
  });

  it('ブラウザ用キーが設定されている場合はtrueを返すこと', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY', 'test-browser-key');
    const { isApiKeyConfigured } = await import('../google-maps/client');
    expect(isApiKeyConfigured()).toBe(true);
    vi.unstubAllEnvs();
  });
});
