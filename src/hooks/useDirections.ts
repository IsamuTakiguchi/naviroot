import { useCallback, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import type { RouteQuery } from '../types';
import { buildRequest, DirectionsError, requestDirections } from '../lib/directions';

export interface DirectionsState {
  loading: boolean;
  error?: string;
  result?: google.maps.DirectionsResult;
}

/** DirectionsService を使った検索フック。routes ライブラリの読み込み完了を待つ。 */
export function useDirections() {
  const routesLib = useMapsLibrary('routes');
  const serviceRef = useRef<google.maps.DirectionsService | null>(null);
  const [state, setState] = useState<DirectionsState>({ loading: false });
  const seq = useRef(0);

  const search = useCallback(
    async (query: RouteQuery, opts?: { alternatives?: boolean }) => {
      if (!routesLib) {
        setState({ loading: false, error: '地図ライブラリの読み込み中です。少し待ってからお試しください。' });
        return undefined;
      }
      if (!serviceRef.current) serviceRef.current = new routesLib.DirectionsService();
      const my = ++seq.current;
      setState({ loading: true });
      try {
        const result = await requestDirections(serviceRef.current, buildRequest(query, opts));
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

  return { ...state, ready: !!routesLib, search, reset, getService: () => serviceRef.current };
}
