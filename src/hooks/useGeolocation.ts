import { useCallback, useEffect, useState } from 'react';
import type { LatLng } from '../types';
import {
  geolocationErrorMessage,
  isGeolocationGranted,
  lastPositionTime,
  POSITION_FRESH_MS,
  readLastPosition,
  saveLastPosition,
} from '../lib/geolocation';

export interface GeolocationState {
  position?: LatLng;
  loading: boolean;
  error?: string;
}

/* 現在地はアプリ全体で 1 つ。地図・スポット検索・ルートフォームで同じ値を見る。 */
let current: LatLng | undefined;
let inFlight: Promise<LatLng | undefined> | undefined;
/** 直近の取得失敗の理由（ボタン操作時だけ画面に出す） */
let lastError: string | undefined;
const listeners = new Set<(pos: LatLng | undefined) => void>();

function publish(pos: LatLng | undefined) {
  current = pos;
  listeners.forEach((fn) => fn(pos));
}

/** 現在地を 1 回取得する。同時に呼ばれても実際の取得は 1 回にまとめる。 */
function requestPosition(): Promise<LatLng | undefined> {
  if (inFlight) return inFlight;
  inFlight = new Promise<LatLng | undefined>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        saveLastPosition(p);
        publish(p);
        resolve(p);
      },
      (err) => {
        lastError = geolocationErrorMessage(err.code);
        resolve(undefined);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }).finally(() => {
    inFlight = undefined;
  });
  return inFlight;
}

/**
 * 現在地。`auto` を指定すると、すでに許可されている場合だけ表示時に自動取得する
 * （未許可の端末で勝手に許可ダイアログを出さないため）。
 */
export function useGeolocation(options?: { auto?: boolean }) {
  const auto = options?.auto ?? false;
  const [position, setPosition] = useState<LatLng | undefined>(() => current ?? readLastPosition());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const fn = (p: LatLng | undefined) => setPosition(p);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const locate = useCallback((): Promise<LatLng | undefined> => {
    if (!('geolocation' in navigator)) {
      setError('このブラウザは位置情報に対応していません。');
      return Promise.resolve(undefined);
    }
    setLoading(true);
    setError(undefined);
    lastError = undefined;
    return requestPosition().then((p) => {
      setLoading(false);
      if (!p) setError(lastError ?? geolocationErrorMessage());
      return p;
    });
  }, []);

  useEffect(() => {
    if (!auto) return;
    let cancelled = false;
    const at = lastPositionTime();
    // 直前に取得したばかりなら取り直さない
    if (current && at !== undefined && Date.now() - at < POSITION_FRESH_MS) return;
    void (async () => {
      if (!(await isGeolocationGranted()) || cancelled) return;
      // 自動取得の失敗は画面にエラーを出さない（ボタン操作時のみ表示する）
      await requestPosition();
    })();
    return () => {
      cancelled = true;
    };
  }, [auto]);

  return { position, loading, error, locate };
}
