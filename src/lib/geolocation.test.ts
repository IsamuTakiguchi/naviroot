import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  geolocationErrorMessage,
  isGeolocationGranted,
  LAST_POSITION_KEY,
  lastPositionTime,
  POSITION_MAX_AGE_MS,
  readLastPosition,
  saveLastPosition,
} from './geolocation';

const stubNavigator = (value: Partial<Navigator>) => {
  vi.stubGlobal('navigator', { geolocation: {}, ...value } as Navigator);
};

describe('geolocation', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('saves and reads the last position, ignoring stale or broken values', () => {
    const now = Date.UTC(2026, 8, 21, 12, 0, 0);
    expect(readLastPosition(now)).toBeUndefined();
    expect(lastPositionTime()).toBeUndefined();

    saveLastPosition({ lat: 34.69, lng: 135.19 }, now);
    expect(localStorage.getItem(`naviroot:${LAST_POSITION_KEY}`)).toBe(`{"lat":34.69,"lng":135.19,"at":${now}}`);
    expect(readLastPosition(now)).toEqual({ lat: 34.69, lng: 135.19 });
    expect(lastPositionTime()).toBe(now);

    // 期限内は使い、期限切れは使わない
    expect(readLastPosition(now + POSITION_MAX_AGE_MS)).toEqual({ lat: 34.69, lng: 135.19 });
    expect(readLastPosition(now + POSITION_MAX_AGE_MS + 1)).toBeUndefined();

    localStorage.setItem(`naviroot:${LAST_POSITION_KEY}`, '{"lat":"x","lng":1,"at":1}');
    expect(readLastPosition(now)).toBeUndefined();
    localStorage.setItem(`naviroot:${LAST_POSITION_KEY}`, 'broken');
    expect(readLastPosition(now)).toBeUndefined();
    expect(lastPositionTime()).toBeUndefined();
  });

  it('maps error codes to Japanese messages', () => {
    expect(geolocationErrorMessage(1)).toContain('許可されていません');
    expect(geolocationErrorMessage(2)).toBe('現在地を取得できませんでした。');
    expect(geolocationErrorMessage(3)).toContain('タイムアウト');
    expect(geolocationErrorMessage(99)).toBe('現在地を取得できませんでした。');
    expect(geolocationErrorMessage()).toBe('現在地を取得できませんでした。');
  });

  it('reports granted only when the browser says so', async () => {
    stubNavigator({ permissions: { query: async () => ({ state: 'granted' }) } as unknown as Permissions });
    await expect(isGeolocationGranted()).resolves.toBe(true);

    stubNavigator({ permissions: { query: async () => ({ state: 'prompt' }) } as unknown as Permissions });
    await expect(isGeolocationGranted()).resolves.toBe(false);

    stubNavigator({ permissions: { query: async () => ({ state: 'denied' }) } as unknown as Permissions });
    await expect(isGeolocationGranted()).resolves.toBe(false);

    vi.stubGlobal('navigator', {} as Navigator);
    await expect(isGeolocationGranted()).resolves.toBe(false);
  });

  it('falls back to a previously stored position when the Permissions API is unavailable', async () => {
    stubNavigator({ permissions: undefined });
    await expect(isGeolocationGranted()).resolves.toBe(false);

    saveLastPosition({ lat: 34.69, lng: 135.19 }, Date.now());
    await expect(isGeolocationGranted()).resolves.toBe(true);

    // 問い合わせ自体が例外でも落ちない
    stubNavigator({
      permissions: {
        query: () => {
          throw new Error('not supported');
        },
      } as unknown as Permissions,
    });
    await expect(isGeolocationGranted()).resolves.toBe(true);
  });
});
