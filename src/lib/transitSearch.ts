import type { Place, RouteQuery, TransitPlan } from '../types';
import { buildNavitimeParams, isNodeParam, NAVITIME_LIMIT, NavitimeError, type NavitimeLocation } from './navitime';
import { getStationNode, learnStationNodes, rememberStationNode } from './stationNodes';

/** 駅コード指定が契約で使えないと分かったら、そのセッションでは座標だけで検索する */
let nodeParamsUnsupported = false;

export function resetNodeSupport(): void {
  nodeParamsUnsupported = false;
}

export interface NodeSearchResult {
  plans: TransitPlan[];
  /** 後続便などの再検索に使うパラメータ（駅コード指定を含む） */
  params: Record<string, string>;
  calls: number;
  /** 駅コードで検索できたか */
  usedNodes: boolean;
}

function isInvalid(err: unknown): boolean {
  return err instanceof NavitimeError && err.status === 'INVALID';
}

/**
 * NAVITIME アプリと同じ「駅から」の検索にする。
 * 1. 覚えている駅コードがあればそれで検索する。
 * 2. 無ければ座標で検索し、結果から駅コードを学んで（端末に記憶して）駅コードで検索し直す。
 *    2 回目は初めての駅のときだけ。駅コードが契約で使えなければ座標の結果をそのまま使う。
 */
export async function searchFromStations(
  from: Place & { location: NonNullable<Place['location']> },
  to: Place & { location: NonNullable<Place['location']> },
  query: RouteQuery,
  fetchPlans: (params: Record<string, string>) => Promise<TransitPlan[]>,
): Promise<NodeSearchResult> {
  const build = (start: NavitimeLocation, goal: NavitimeLocation) =>
    buildNavitimeParams(start, goal, query.timeType, query.time, NAVITIME_LIMIT, query.filter ?? 'all');

  const fromNode = nodeParamsUnsupported ? undefined : getStationNode(from.name);
  const toNode = nodeParamsUnsupported ? undefined : getStationNode(to.name);
  let params = build(fromNode ?? from.location, toNode ?? to.location);
  let calls = 0;
  let plans: TransitPlan[];
  try {
    plans = await fetchPlans(params);
    calls++;
  } catch (err) {
    // 駅コードを受け付けない契約なら座標でやり直す
    if (!isInvalid(err) || (!isNodeParam(params.start) && !isNodeParam(params.goal))) throw err;
    nodeParamsUnsupported = true;
    params = build(from.location, to.location);
    plans = await fetchPlans(params);
    calls++;
  }
  if (nodeParamsUnsupported) return { plans, params, calls, usedNodes: false };

  const usedFrom = isNodeParam(params.start);
  const usedTo = isNodeParam(params.goal);
  if (usedFrom && usedTo) return { plans, params, calls, usedNodes: true };

  // 座標で検索した側の駅コードを結果から学ぶ
  const learned = learnStationNodes(plans, usedFrom ? undefined : from.name, usedTo ? undefined : to.name);
  const nextFrom = usedFrom ? params.start : learned.from;
  const nextTo = usedTo ? params.goal : learned.to;
  if (learned.from) rememberStationNode(from.name, learned.from, plans.find((p) => p.boardNode?.id === learned.from)?.boardNode?.name);
  if (learned.to) rememberStationNode(to.name, learned.to, plans.find((p) => p.alightNode?.id === learned.to)?.alightNode?.name);
  if (!learned.from && !learned.to) return { plans, params, calls, usedNodes: usedFrom || usedTo };

  const retry = build(nextFrom ?? from.location, nextTo ?? to.location);
  try {
    const better = await fetchPlans(retry);
    calls++;
    if (better.length === 0) return { plans, params, calls, usedNodes: usedFrom || usedTo };
    return { plans: better, params: retry, calls, usedNodes: true };
  } catch (err) {
    if (isInvalid(err)) {
      nodeParamsUnsupported = true;
      return { plans, params, calls, usedNodes: false };
    }
    throw err;
  }
}
