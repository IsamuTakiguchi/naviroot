import { useCallback, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import type { Place, RouteQuery, TransitPlan } from '../types';
import { getNavitimeKey } from '../config';
import { resolvePair } from '../lib/places';
import { buildNavitimeParams, NAVITIME_MESSAGES, NavitimeError, requestNavitimePlans, type NavitimeStatus } from '../lib/navitime';

export interface TransitSearchState {
  loading: boolean;
  plans: TransitPlan[];
  error?: string;
  errorStatus?: NavitimeStatus;
  errorDetail?: string;
}

/** 乗換案内の検索フック（NAVITIME API）。キーが無ければ NO_PROVIDER を返し、画面側で外部サービスへ誘導する。 */
export function useTransitSearch() {
  const placesLib = useMapsLibrary('places');
  const [state, setState] = useState<TransitSearchState>({ loading: false, plans: [] });
  const seq = useRef(0);

  const search = useCallback(
    async (query: RouteQuery, opts?: { onResolved?: (from: Place, to: Place) => void }): Promise<TransitPlan[] | undefined> => {
      const key = getNavitimeKey();
      const my = ++seq.current;
      setState({ loading: true, plans: [] });
      try {
        const { from, to } = await resolvePair(placesLib, query.from, query.to);
        if (my !== seq.current) return undefined;
        opts?.onResolved?.(from, to);
        if (!key) throw new NavitimeError('NO_PROVIDER', NAVITIME_MESSAGES.NO_PROVIDER);
        if (!from.location || !to.location) throw new NavitimeError('RESOLVE', NAVITIME_MESSAGES.RESOLVE);
        const params = buildNavitimeParams(from.location, to.location, query.timeType, query.time, 5, query.filter ?? 'all');
        const plans = await requestNavitimePlans(key, params);
        if (my !== seq.current) return undefined;
        if (plans.length === 0) throw new NavitimeError('ZERO_RESULTS', NAVITIME_MESSAGES.ZERO_RESULTS, 'items=0');
        setState({ loading: false, plans });
        return plans;
      } catch (err) {
        if (my !== seq.current) return undefined;
        if (err instanceof NavitimeError) {
          setState({ loading: false, plans: [], error: err.message, errorStatus: err.status, errorDetail: err.detail });
        } else {
          setState({
            loading: false,
            plans: [],
            error: '乗換案内の検索に失敗しました。',
            errorStatus: 'SERVER',
            errorDetail: err instanceof Error ? `${err.name} ${err.message}` : String(err),
          });
        }
        return undefined;
      }
    },
    [placesLib],
  );

  const reset = useCallback(() => setState({ loading: false, plans: [] }), []);

  return { ...state, search, reset, hasKey: !!getNavitimeKey(), ready: !!placesLib };
}
