import { loadJson, removeKey, saveJson } from './lib/storage';

const API_KEY_STORAGE = 'apiKey';

const BUILD_TIME_KEY: string = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim();

/** API キー。アプリ内で保存したもの（localStorage）を優先し、無ければビルド時の環境変数を使う。 */
export function getApiKey(): string {
  const stored = loadJson<string>(API_KEY_STORAGE, '').trim();
  return stored || BUILD_TIME_KEY;
}

export function saveApiKey(key: string): boolean {
  const k = key.trim();
  if (!k) return false;
  return saveJson(API_KEY_STORAGE, k);
}

export function clearApiKey(): void {
  removeKey(API_KEY_STORAGE);
}

export function apiKeySource(): 'stored' | 'env' | 'none' {
  if (loadJson<string>(API_KEY_STORAGE, '').trim()) return 'stored';
  if (BUILD_TIME_KEY) return 'env';
  return 'none';
}

export const GOOGLE_MAPS_MAP_ID: string | undefined =
  (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? '').trim() || undefined;

export const hasApiKey = (): boolean => getApiKey().length > 0;

/** 東京駅（初期表示の中心） */
export const DEFAULT_CENTER = { lat: 35.681236, lng: 139.767125 };
export const DEFAULT_ZOOM = 13;

/** 時刻表機能で Directions API を呼ぶ最大回数（課金対策） */
export const TIMETABLE_MAX_QUERIES = 6;
export const HISTORY_LIMIT = 30;
