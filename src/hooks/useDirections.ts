import { useCallback, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import type { Place, RouteQuery } from '../types';
import { buildRequest, describeError, DirectionsError, requestRoutes } from '../lib/directions';
import { resolvePair } from '../lib/places';

export interface DirectionsState {
  loading: boolean;
  error?: string;
  /** 状態コード（ZERO_RESULTS など。画面で分岐に使う） */
  errorStatus?: string;
  /** 生のエラー情報（画面の「詳細」用） */
  errorDetail?: string;
  result?: google.maps.routes.Route[];
}

/** Routes API（Route.computeRoutes）を使った検索フック。routes ライブラリの読み込み完了を待つ。 */
export function useDirections() {
  const routesLib = useMapsLibrary('routes');
  const placesLib = useMapsLibrary('places');
  const [state, setState] = useState<DirectionsState>({ loading: false });
  const seq = useRef(0);

  const search = useCallback(
    async (query: RouteQuery, opts?: { alternatives?: boolean; onResolved?: (from: Place, to: Place) => void }) => {
      if (!routesLib) {
        setState({ loading: false, error: '地図ライブラリの読み込み中です。少し待ってからお試しください。' });
        return undefined;
      }
      const my = ++seq.current;
      setState({ loading: true });
      try {
        // 自由入力の地点は先に Places で座標に解決しておく（住所の取り違え防止）
        const { from, to } = await resolvePair(placesLib, query.from, query.to);
        if (my !== seq.current) return undefined;
        opts?.onResolved?.(from, to);
        const result = await requestRoutes(routesLib.Route, buildRequest({ ...query, from, to }, opts));
        if (my !== seq.current) return undefined;
        setState({ loading: false, result });
        return result;
      } catch (err) {
        if (my !== seq.current) return undefined;
        const message = err instanceof DirectionsError ? err.message : '経路検索に失敗しました。';
        const errorDetail = err instanceof DirectionsError ? err.detail : describeError(err);
        const errorStatus = err instanceof DirectionsError ? err.status : 'UNKNOWN_ERROR';
        setState({ loading: false, error: message, errorStatus, errorDetail });
        return undefined;
      }
    },
    [routesLib, placesLib],
  );

  const reset = useCallback(() => setState({ loading: false }), []);

  return { ...state, ready: !!routesLib, search, reset };
}
