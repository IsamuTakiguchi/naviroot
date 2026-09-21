import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('config: API keys', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('prefers the stored key and falls back to the build-time key', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', ' env-google ');
    vi.stubEnv('VITE_NAVITIME_API_KEY', 'env-navitime');
    const c = await import('./config');
    expect(c.getApiKey()).toBe('env-google');
    expect(c.apiKeySource()).toBe('env');
    expect(c.getNavitimeKey()).toBe('env-navitime');
    expect(c.navitimeKeySource()).toBe('env');
    expect(c.hasApiKey()).toBe(true);

    c.saveApiKey('stored-google');
    c.saveNavitimeKey('stored-navitime');
    expect(c.getApiKey()).toBe('stored-google');
    expect(c.apiKeySource()).toBe('stored');
    expect(c.getNavitimeKey()).toBe('stored-navitime');
    expect(c.navitimeKeySource()).toBe('stored');

    c.clearApiKey();
    c.clearNavitimeKey();
    expect(c.getApiKey()).toBe('env-google');
    expect(c.getNavitimeKey()).toBe('env-navitime');
  });

  it('reports none without any key and does not throw on non-string stored values', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');
    vi.stubEnv('VITE_NAVITIME_API_KEY', '');
    const c = await import('./config');
    expect(c.apiKeySource()).toBe('none');
    expect(c.navitimeKeySource()).toBe('none');
    expect(c.hasApiKey()).toBe(false);
    localStorage.setItem('naviroot:apiKey', 'null');
    localStorage.setItem('naviroot:navitimeKey', '{"k":1}');
    expect(() => c.getApiKey()).not.toThrow();
    expect(c.getApiKey()).toBe('');
    expect(c.getNavitimeKey()).toBe('');
    // JSON でない生の文字列もキーとして受け付ける
    localStorage.setItem('naviroot:apiKey', 'AIzaRawKey');
    expect(c.getApiKey()).toBe('AIzaRawKey');
    expect(c.saveApiKey('   ')).toBe(false);
  });
});
