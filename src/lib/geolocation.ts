import type { LatLng } from '../types';
import { loadJson, saveJson } from './storage';

/** 最後に取得した現在地（端末に保存し、次回起動時すぐ地図へ描くため） */
export const LAST_POSITION_KEY = 'lastPosition';

/** これより古い保存位置は使わない（別の場所に青い点が出続けるのを防ぐ） */
export const POSITION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** 自動取得を省略してよい「十分新しい」位置の鮮度 */
export const POSITION_FRESH_MS = 60 * 1000;

interface StoredPosition {
  lat: number;
  lng: number;
  at: number;
}

const ERROR_MESSAGES: Record<number, string> = {
  1: '位置情報の利用が許可されていません。ブラウザの設定で許可してください。',
  2: '現在地を取得できませんでした。',
  3: '現在地の取得がタイムアウトしました。',
};

export function geolocationErrorMessage(code?: number): string {
  return (code !== undefined && ERROR_MESSAGES[code]) || '現在地を取得できませんでした。';
}

function readStored(): StoredPosition | undefined {
  const v = loadJson<StoredPosition | null>(LAST_POSITION_KEY, null);
  if (!v || typeof v.lat !== 'number' || typeof v.lng !== 'number' || typeof v.at !== 'number') return undefined;
  return v;
}

/** 保存済みの現在地。期限切れ・壊れた値なら undefined。 */
export function readLastPosition(now: number = Date.now()): LatLng | undefined {
  const v = readStored();
  if (!v || now - v.at > POSITION_MAX_AGE_MS) return undefined;
  return { lat: v.lat, lng: v.lng };
}

/** 保存済みの現在地の取得時刻（無ければ undefined） */
export function lastPositionTime(): number | undefined {
  return readStored()?.at;
}

export function saveLastPosition(pos: LatLng, now: number = Date.now()): void {
  saveJson<StoredPosition>(LAST_POSITION_KEY, { lat: pos.lat, lng: pos.lng, at: now });
}

/**
 * 位置情報が「すでに許可されている」か。
 * 未許可の端末で勝手に許可ダイアログを出さないための事前確認に使う。
 * Permissions API 非対応の環境では、過去に取得できた実績（保存済みの位置）で代用する。
 */
export async function isGeolocationGranted(): Promise<boolean> {
  try {
    if (!globalThis.navigator?.geolocation) return false;
    const permissions = globalThis.navigator.permissions;
    if (permissions?.query) {
      const status = await permissions.query({ name: 'geolocation' as PermissionName });
      return status.state === 'granted';
    }
  } catch {
    /* 非対応・拒否された問い合わせは「不明」として扱う */
  }
  // 以前に取得できているなら許可済みとみなす（ダイアログは出ない）
  return lastPositionTime() !== undefined;
}
