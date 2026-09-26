import type { TransitPlan } from '../types';
import { loadJson, saveJson } from './storage';
import { normalizeStationName, sameStation } from './stationWalk';

/**
 * 駅名 → NAVITIME の駅コード（ノード ID）の対応を端末に記憶する。
 *
 * 乗換検索を駅の座標で行うと、NAVITIME はホームまでの徒歩を見込むため、
 * 直後に出る列車が候補から外れたり、出発時刻が NAVITIME アプリとずれたりする。
 * 一度検索した駅はコードを覚え、次からはアプリと同じ「駅から」の検索にする。
 */
export const STATION_NODES_KEY = 'stationNodes';
const MAX_ENTRIES = 300;

type NodeMap = Record<string, { id: string; name: string }>;

function readMap(): NodeMap {
  const m = loadJson<NodeMap | null>(STATION_NODES_KEY, null);
  return m && typeof m === 'object' ? m : {};
}

/** 記憶している駅コード。無ければ undefined */
export function getStationNode(name: string | undefined): string | undefined {
  const key = normalizeStationName(name);
  if (!key) return undefined;
  return readMap()[key]?.id;
}

export function rememberStationNode(name: string | undefined, id: string, stationName = name ?? ''): void {
  const key = normalizeStationName(name);
  if (!key || !id) return;
  const m = readMap();
  m[key] = { id, name: stationName };
  const keys = Object.keys(m);
  if (keys.length > MAX_ENTRIES) for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete m[k];
  saveJson(STATION_NODES_KEY, m);
}

export function clearStationNodes(): void {
  saveJson(STATION_NODES_KEY, {});
}

/**
 * 検索結果から、出発地・目的地の駅コードを学ぶ。
 * 指定した駅名と、最初に乗る（最後に降りる）駅の名前が一致する候補が多数派なら、その駅コードを採用する。
 */
export function learnStationNodes(plans: TransitPlan[], fromName: string | undefined, toName: string | undefined): { from?: string; to?: string } {
  const pick = (get: (p: TransitPlan) => TransitPlan['boardNode'], name: string | undefined): string | undefined => {
    if (!normalizeStationName(name)) return undefined;
    const votes = new Map<string, number>();
    for (const p of plans) {
      const n = get(p);
      if (n && sameStation(n.name, name)) votes.set(n.id, (votes.get(n.id) ?? 0) + 1);
    }
    let best: string | undefined;
    let bestN = 0;
    for (const [id, n] of votes) {
      if (n > bestN) {
        best = id;
        bestN = n;
      }
    }
    return best;
  };
  return { from: pick((p) => p.boardNode, fromName), to: pick((p) => p.alightNode, toName) };
}
