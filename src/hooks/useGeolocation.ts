import { useCallback, useState } from 'react';
import type { LatLng } from '../types';

export interface GeolocationState {
  position?: LatLng;
  loading: boolean;
  error?: string;
}

const ERROR_MESSAGES: Record<number, string> = {
  1: '位置情報の利用が許可されていません。ブラウザの設定で許可してください。',
  2: '現在地を取得できませんでした。',
  3: '現在地の取得がタイムアウトしました。',
};

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({ loading: false });

  const locate = useCallback((): Promise<LatLng | undefined> => {
    if (!('geolocation' in navigator)) {
      setState({ loading: false, error: 'このブラウザは位置情報に対応していません。' });
      return Promise.resolve(undefined);
    }
    setState((s) => ({ ...s, loading: true, error: undefined }));
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setState({ loading: false, position: p });
          resolve(p);
        },
        (err) => {
          setState({ loading: false, error: ERROR_MESSAGES[err.code] ?? '現在地を取得できませんでした。' });
          resolve(undefined);
        },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
      );
    });
  }, []);

  return { ...state, locate };
}
