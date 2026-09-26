import { useCallback, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import type { Place, RouteQuery, TransitPlan } from '../types';
import { getNavitimeKey } from '../config';
import { resolvePair } from '../lib/places';
import {
  EXTRA_ORDERS,
  mergePlans,
  NAVITIME_MESSAGES,
  NavitimeError,
  requestNavitimePlans,
  type NavitimeStatus,
} from '../lib/navitime';
import { collectFollowups, shiftParams, type SlideDirection } from '../lib/followups';
import { trimStationWalks } from '../lib/stationWalk';
import { searchFromStations } from '../lib/transitSearch';
import { useSettings } from './useSettings';

/** 後続便の自動取得: この件数に満たなければ、最大この回数まで時刻をずらして再検索 */
export const MIN_CANDIDATES = 4;
export const AUTO_FOLLOWUPS = 2;

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
  /** 「1本前 / 1本後」の実行中 */
  sliding?: SlideDirection;
  /** 「1本前 / 1本後」の結果メッセージ（見つからない等） */
  slideNote?: string;
  /** この検索で NAVITIME API を呼んだ回数 */
  apiCalls: number;
  /** 最初の応答に含まれていた候補数（診断用） */
  firstBatch: number;
  /** 実際に検索に使った時刻（'YYYY-MM-DDTHH:mm:ss'。見出しの表示用） */
  searchTime?: string;
  /** NAVITIME アプリと同じ「駅コード」で検索できたか */
  fromStations?: boolean;
}

const EMPTY: TransitSearchState = { loading: false, plans: [], apiCalls: 0, firstBatch: 0 };

interface LastSearch {
  key: string;
  params: Record<string, string>;
  fromName: string;
  toName: string;
}

/**
 * NAVITIME から候補を取り、駅を指定したときの構内徒歩を外してからバッジを付け直す。
 * 最初の検索・後続便・別の経路・前後の便のすべてでこれを通す。
 */
async function fetchPlans(last: Pick<LastSearch, 'key' | 'fromName' | 'toName'>, params: Record<string, string>): Promise<TransitPlan[]> {
  const plans = await requestNavitimePlans(last.key, params);
  // 徒歩を外すと出発時刻が変わるので、並べ直し・重複除去・バッジ付けをやり直す
  return mergePlans([plans.map((p) => trimStationWalks(p, last.fromName, last.toName))]);
}

/** 乗換案内の検索フック（NAVITIME API）。キーが無ければ NO_PROVIDER を返し、画面側で外部サービスへ誘導する。 */
export function useTransitSearch() {
  const placesLib = useMapsLibrary('places');
  const { settings } = useSettings();
  const [state, setState] = useState<TransitSearchState>(EMPTY);
  const seq = useRef(0);
  /** 直近の検索で使ったキーとパラメータ（追加取得・前後の便用） */
  const lastRef = useRef<LastSearch | null>(null);
  /** 現在の候補（setState の更新関数は遅延実行されるため、同期的に参照する用） */
  const plansRef = useRef<TransitPlan[]>([]);
  plansRef.current = state.plans;
  const autoFollowups = settings.autoFollowups;

  const search = useCallback(
    async (query: RouteQuery, opts?: { onResolved?: (from: Place, to: Place) => void }): Promise<TransitPlan[] | undefined> => {
      const key = getNavitimeKey();
      const my = ++seq.current;
      setState({ ...EMPTY, loading: true });
      try {
        const { from, to } = await resolvePair(placesLib, query.from, query.to);
        if (my !== seq.current) return undefined;
        opts?.onResolved?.(from, to);
        if (!key) throw new NavitimeError('NO_PROVIDER', NAVITIME_MESSAGES.NO_PROVIDER);
        if (!from.location || !to.location) throw new NavitimeError('RESOLVE', NAVITIME_MESSAGES.RESOLVE);
        const names = { key, fromName: from.name, toName: to.name };
        // NAVITIME アプリと同じく駅コードで検索する（初めての駅は座標で検索して駅コードを学ぶ）
        const station = await searchFromStations(
          { ...from, location: from.location },
          { ...to, location: to.location },
          query,
          (p) => fetchPlans(names, p),
        );
        if (my !== seq.current) return undefined;
        const { params } = station;
        const first = station.plans;
        if (first.length === 0) throw new NavitimeError('ZERO_RESULTS', NAVITIME_MESSAGES.ZERO_RESULTS, 'items=0');
        const last: LastSearch = { ...names, params };
        lastRef.current = last;
        const searchTime = params.start_time ?? params.goal_time;
        const base = { searchTime, fromStations: station.usedNodes, firstBatch: first.length };
        // NAVITIME アプリのように後続便を並べる: 候補が少なければ時刻をずらして追加取得
        let plans = first;
        let calls = station.calls;
        if (autoFollowups) {
          setState({ ...EMPTY, ...base, loading: true, plans: first, apiCalls: calls });
          const r = await collectFollowups((p) => fetchPlans(last, p), params, first, { min: MIN_CANDIDATES, max: AUTO_FOLLOWUPS });
          if (my !== seq.current) return undefined;
          plans = r.plans;
          calls += r.calls;
        }
        setState({ ...EMPTY, ...base, plans, moreLoaded: false, apiCalls: calls });
        return plans;
      } catch (err) {
        if (my !== seq.current) return undefined;
        if (err instanceof NavitimeError) {
          setState({ ...EMPTY, error: err.message, errorStatus: err.status, errorDetail: err.detail });
        } else {
          setState({
            ...EMPTY,
            error: '乗換案内の検索に失敗しました。',
            errorStatus: 'SERVER',
            errorDetail: err instanceof Error ? `${err.name} ${err.message}` : String(err),
          });
        }
        return undefined;
      }
    },
    [placesLib, autoFollowups],
  );

  /** 並び順を変えた検索を追加で行い、重複を除いて候補を広げる（API を最大 3 回消費） */
  const searchMore = useCallback(async () => {
    const last = lastRef.current;
    if (!last) return;
    const my = seq.current;
    setState((s) => ({ ...s, loadingMore: true, moreError: undefined }));
    const extra: TransitPlan[][] = [];
    let calls = 0;
    let failure: string | undefined;
    for (const order of EXTRA_ORDERS) {
      try {
        extra.push(await fetchPlans(last, { ...last.params, order }));
        calls++;
      } catch (err) {
        failure = err instanceof NavitimeError ? err.message : '追加の候補を取得できませんでした。';
        break;
      }
      if (my !== seq.current) return;
    }
    if (my !== seq.current) return;
    setState((s) => ({
      ...s,
      loadingMore: false,
      moreLoaded: true,
      moreError: failure,
      apiCalls: s.apiCalls + calls,
      plans: mergePlans([s.plans, ...extra]),
    }));
  }, []);

  /** 「1本前」「1本後」: 時刻をずらして 1 回検索し、候補の先頭／末尾に加える（API 1 回） */
  const slide = useCallback(async (direction: SlideDirection) => {
    const last = lastRef.current;
    if (!last) return;
    const my = seq.current;
    const current = plansRef.current;
    setState((s) => ({ ...s, sliding: direction, slideNote: undefined }));
    const shifted = shiftParams(last.params, current, direction);
    if (!shifted) {
      setState((s) => ({ ...s, sliding: undefined }));
      return;
    }
    let note: string | undefined;
    let batch: TransitPlan[] = [];
    let called = 0;
    try {
      batch = await fetchPlans(last, shifted);
      called = 1;
    } catch (err) {
      note = err instanceof NavitimeError && err.status !== 'ZERO_RESULTS' ? err.message : undefined;
      batch = [];
      called = err instanceof NavitimeError && err.status === 'ZERO_RESULTS' ? 1 : 0;
    }
    if (my !== seq.current) return;
    setState((s) => {
      const merged = mergePlans([s.plans, batch]);
      const grew = merged.length > s.plans.length;
      return {
        ...s,
        sliding: undefined,
        apiCalls: s.apiCalls + called,
        plans: merged,
        slideNote: note ?? (grew ? undefined : direction === 'next' ? 'この後の便は見つかりませんでした。' : 'この前の便は見つかりませんでした。'),
      };
    });
  }, []);

  const reset = useCallback(() => setState(EMPTY), []);

  return { ...state, search, searchMore, slide, reset, hasKey: !!getNavitimeKey(), ready: !!placesLib };
}
