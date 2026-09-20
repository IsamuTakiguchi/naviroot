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

/* ---- NAVITIME（RapidAPI）乗換案内 ---- */

const NAVITIME_KEY_STORAGE = 'navitimeKey';
const NAVITIME_USAGE_STORAGE = 'navitimeUsage';

/** RapidAPI 上の NAVITIME Route(totalnavi) のホスト */
export const NAVITIME_HOST = 'navitime-route-totalnavi.p.rapidapi.com';
/** RapidAPI Basic プランの月間無料リクエスト数 */
export const NAVITIME_FREE_LIMIT = 500;

export function getNavitimeKey(): string {
  return loadJson<string>(NAVITIME_KEY_STORAGE, '').trim();
}

export function saveNavitimeKey(key: string): boolean {
  const k = key.trim();
  if (!k) return false;
  return saveJson(NAVITIME_KEY_STORAGE, k);
}

export function clearNavitimeKey(): void {
  removeKey(NAVITIME_KEY_STORAGE);
}

export interface NavitimeUsage {
  /** 'YYYY-MM' */
  month: string;
  count: number;
}

export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** 今月の NAVITIME 呼び出し回数（端末内カウント。月が変わればリセット） */
export function readNavitimeUsage(now: Date = new Date()): NavitimeUsage {
  const u = loadJson<NavitimeUsage | null>(NAVITIME_USAGE_STORAGE, null);
  const month = currentMonth(now);
  if (!u || u.month !== month || typeof u.count !== 'number') return { month, count: 0 };
  return u;
}

export function bumpNavitimeUsage(now: Date = new Date()): NavitimeUsage {
  const u = readNavitimeUsage(now);
  const next = { month: u.month, count: u.count + 1 };
  saveJson(NAVITIME_USAGE_STORAGE, next);
  return next;
}

export const GOOGLE_MAPS_MAP_ID: string | undefined =
  (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? '').trim() || undefined;

export const hasApiKey = (): boolean => getApiKey().length > 0;

/** 東京駅（初期表示の中心） */
export const DEFAULT_CENTER = { lat: 35.681236, lng: 139.767125 };
export const DEFAULT_ZOOM = 13;

/** 時刻表機能で乗換 API を呼ぶ最大回数（無料枠対策） */
export const TIMETABLE_MAX_QUERIES = 6;
export const HISTORY_LIMIT = 30;
