import type { TransitPlan } from '../types';
import { toDateTimeLocal } from './format';
import { mergePlans } from './navitime';

/**
 * NAVITIME の route_transit は「経路パターン」単位で候補を返すため、
 * 1 路線しか無い区間では 1 件になる。NAVITIME アプリのように後続便（前の便）を並べるため、
 * 出発（到着）時刻をずらして再検索し、重複を除いて統合する。
 */

export type FollowupMode = 'forward' | 'backward' | 'none';
export type SlideDirection = 'next' | 'prev';

/** 検索パラメータから、追加取得の進行方向を決める */
export function modeForParams(params: Record<string, string>): FollowupMode {
  if (params.start_time) return 'forward';
  if (params.goal_time) return 'backward';
  return 'none';
}

export function latestDeparture(plans: TransitPlan[]): Date | undefined {
  if (plans.length === 0) return undefined;
  return new Date(Math.max(...plans.map((p) => p.departureTime.getTime())));
}

export function earliestDeparture(plans: TransitPlan[]): Date | undefined {
  if (plans.length === 0) return undefined;
  return new Date(Math.min(...plans.map((p) => p.departureTime.getTime())));
}

const withoutTimeParams = (params: Record<string, string>) => {
  const { start_time: _s, goal_time: _g, first_operation: _f, last_operation: _l, ...rest } = params;
  void _s;
  void _g;
  void _f;
  void _l;
  return rest;
};

const toApiTime = (d: Date) => `${toDateTimeLocal(d)}:00`;

/**
 * 取得済みの候補を基準に、次（後続便）または前（先行便）を探すためのパラメータを作る。
 * next: 最遅出発 + 1 分に出発時刻指定 / prev: 最早出発 − 1 分までに到着する便を到着時刻指定で探す
 */
export function shiftParams(
  params: Record<string, string>,
  plans: TransitPlan[],
  direction: SlideDirection,
): Record<string, string> | undefined {
  if (direction === 'next') {
    const latest = latestDeparture(plans);
    if (!latest) return undefined;
    return { ...withoutTimeParams(params), start_time: toApiTime(new Date(latest.getTime() + 60_000)) };
  }
  const earliest = earliestDeparture(plans);
  if (!earliest) return undefined;
  return { ...withoutTimeParams(params), goal_time: toApiTime(new Date(earliest.getTime() - 60_000)) };
}

export interface FollowupOptions {
  /** この件数に達するまで追加取得する */
  min: number;
  /** 追加取得の最大回数 */
  max: number;
}

export interface FollowupResult {
  plans: TransitPlan[];
  /** 追加で行った API 呼び出し回数 */
  calls: number;
}

/** 候補が少ないとき、時刻をずらした検索を繰り返して候補を増やす（件数が増えなければ打ち切り） */
export async function collectFollowups(
  fetchPlans: (params: Record<string, string>) => Promise<TransitPlan[]>,
  params: Record<string, string>,
  initial: TransitPlan[],
  { min, max }: FollowupOptions,
): Promise<FollowupResult> {
  const mode = modeForParams(params);
  let plans = initial;
  let calls = 0;
  if (mode === 'none') return { plans, calls };
  const direction: SlideDirection = mode === 'forward' ? 'next' : 'prev';
  for (let i = 0; i < max && plans.length < min; i++) {
    const shifted = shiftParams(params, plans, direction);
    if (!shifted) break;
    let batch: TransitPlan[];
    try {
      batch = await fetchPlans(shifted);
    } catch {
      break;
    }
    calls++;
    const merged = mergePlans([plans, batch]);
    if (merged.length === plans.length) break;
    plans = merged;
  }
  return { plans, calls };
}
