import { useCallback, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import type { Place, RouteQuery, TransitPlan } from '../types';
import { getNavitimeKey } from '../config';
import { resolvePair } from '../lib/places';
import {
  buildNavitimeParams,
  EXTRA_ORDERS,
  mergePlans,
  NAVITIME_LIMIT,
  NAVITIME_MESSAGES,
  NavitimeError,
  requestNavitimePlans,
  type NavitimeStatus,
} from '../lib/navitime';

export interface TransitSearchState {
  loading: boolean;
  plans: TransitPlan[];
  error?: string;
  errorStatus?: NavitimeStatus;
  errorDetail?: string;
  /** 「別の経路も探す」の実行中 */
  loadingMore?: boolean;
  /** 追加取得を実行済み（同じ検索では再実行しない） */
  moreLoaded?: boolean;
  /** 追加取得に失敗したときの文言 */
  moreError?: string;
}

/** 乗換案内の検索フック（NAVITIME API）。キーが無ければ NO_PROVIDER を返し、画面側で外部サービスへ誘導する。 */
export function useTransitSearch() {
  const placesLib = useMapsLibrary('places');
  const [state, setState] = useState<TransitSearchState>({ loading: false, plans: [] });
  const seq = useRef(0);
  /** 直近の検索で使ったパラメータ（追加取得用） */
  const lastRef = useRef<{ key: string; params: Record<string, string> } | null>(null);

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
        const params = buildNavitimeParams(from.location, to.location, query.timeType, query.time, NAVITIME_LIMIT, query.filter ?? 'all');
        const plans = await requestNavitimePlans(key, params);
        if (my !== seq.current) return undefined;
        if (plans.length === 0) throw new NavitimeError('ZERO_RESULTS', NAVITIME_MESSAGES.ZERO_RESULTS, 'items=0');
        lastRef.current = { key, params };
        setState({ loading: false, plans, moreLoaded: false });
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

  /** 並び順を変えた検索を追加で行い、重複を除いて候補を広げる（API を最大 3 回消費） */
  const searchMore = useCallback(async () => {
    const last = lastRef.current;
    if (!last) return;
    const my = seq.current;
    setState((s) => ({ ...s, loadingMore: true, moreError: undefined }));
    const extra: TransitPlan[][] = [];
    let failure: string | undefined;
    for (const order of EXTRA_ORDERS) {
      try {
        extra.push(await requestNavitimePlans(last.key, { ...last.params, order }));
      } catch (err) {
        failure = err instanceof NavitimeError ? err.message : '追加の候補を取得できませんでした。';
        break;
      }
      if (my !== seq.current) return;
    }
    if (my !== seq.current) return;
    setState((s) => ({ ...s, loadingMore: false, moreLoaded: true, moreError: failure, plans: mergePlans([s.plans, ...extra]) }));
  }, []);

  const reset = useCallback(() => setState({ loading: false, plans: [] }), []);

  return { ...state, search, searchMore, reset, hasKey: !!getNavitimeKey(), ready: !!placesLib };
}
