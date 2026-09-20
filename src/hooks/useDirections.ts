import { useCallback, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import type { RouteQuery } from '../types';
import { buildRequest, DirectionsError, requestRoutes } from '../lib/directions';

export interface DirectionsState {
  loading: boolean;
  error?: string;
  result?: google.maps.routes.Route[];
}

/** Routes API（Route.computeRoutes）を使った検索フック。routes ライブラリの読み込み完了を待つ。 */
export function useDirections() {
  const routesLib = useMapsLibrary('routes');
  const [state, setState] = useState<DirectionsState>({ loading: false });
  const seq = useRef(0);

  const search = useCallback(
    async (query: RouteQuery, opts?: { alternatives?: boolean }) => {
      if (!routesLib) {
        setState({ loading: false, error: '地図ライブラリの読み込み中です。少し待ってからお試しください。' });
        return undefined;
      }
      const my = ++seq.current;
      setState({ loading: true });
      try {
        const result = await requestRoutes(routesLib.Route, buildRequest(query, opts));
        if (my !== seq.current) return undefined;
        setState({ loading: false, result });
        return result;
      } catch (err) {
        if (my !== seq.current) return undefined;
        const message = err instanceof DirectionsError ? err.message : '経路検索に失敗しました。';
        setState({ loading: false, error: message });
        return undefined;
      }
    },
    [routesLib],
  );

  const reset = useCallback(() => setState({ loading: false }), []);

  return { ...state, ready: !!routesLib, search, reset };
}
