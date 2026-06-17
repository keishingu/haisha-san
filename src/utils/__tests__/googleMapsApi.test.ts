import { describe, it, expect, vi } from 'vitest';

describe('isApiKeyConfigured', () => {
  it('APIキーが未設定の場合はfalseを返すこと', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');
    const { isApiKeyConfigured } = await import('../googleMapsApi');
    expect(isApiKeyConfigured()).toBe(false);
    vi.unstubAllEnvs();
  });

  it('APIキーが設定されている場合はtrueを返すこと', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-api-key');
    const { isApiKeyConfigured } = await import('../googleMapsApi');
    expect(isApiKeyConfigured()).toBe(true);
    vi.unstubAllEnvs();
  });
});
