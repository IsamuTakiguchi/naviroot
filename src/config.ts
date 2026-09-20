export const GOOGLE_MAPS_API_KEY: string = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim();
export const GOOGLE_MAPS_MAP_ID: string | undefined =
  (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? '').trim() || undefined;

export const hasApiKey = (): boolean => GOOGLE_MAPS_API_KEY.length > 0;

/** 東京駅（初期表示の中心） */
export const DEFAULT_CENTER = { lat: 35.681236, lng: 139.767125 };
export const DEFAULT_ZOOM = 13;

/** 時刻表機能で Directions API を呼ぶ最大回数（課金対策） */
export const TIMETABLE_MAX_QUERIES = 6;
export const HISTORY_LIMIT = 30;
