import type { LatLng, PlanSegment, TransitPlan, TransitSegment } from '../types';
import { boundsOf } from './navitime';

/**
 * 出発地・目的地に「駅」そのものを指定したときの、駅構内の徒歩を外す。
 *
 * 乗換検索は Google の地点座標（駅の代表点）で行うため、NAVITIME は「その地点から最寄り駅まで歩く」
 * 経路を返す（例: 近鉄奈良駅 → 徒歩 2分 → 近鉄奈良 15:37 発）。指定した駅と乗車駅が同じなら
 * その徒歩は不要なので、NAVITIME アプリと同じく駅から始まる／駅で終わる経路にする。
 */

/** これより長い徒歩は、名前が同じでも本当の移動として残す */
export const STATION_WALK_MAX_M = 700;
export const STATION_WALK_MAX_SEC = 10 * 60;

/** 駅名の比較用。「近鉄奈良駅」「近鉄奈良」→「近鉄奈良」、「大阪難波（近鉄・阪神線）」→「大阪難波」 */
export function normalizeStationName(name: string | undefined): string {
  if (!name) return '';
  return name
    .normalize('NFKC')
    .replace(/[(（〔［[【][^)）〕］\]】]*[)）〕］\]】]/g, '')
    .replace(/\s+/g, '')
    .replace(/(駅|停留所|バス停)$/, '');
}

export function sameStation(a: string | undefined, b: string | undefined): boolean {
  const x = normalizeStationName(a);
  return x !== '' && x === normalizeStationName(b);
}

function isShortWalk(s: PlanSegment | undefined): boolean {
  return (
    s?.kind === 'walk' &&
    (s.distanceM ?? 0) <= STATION_WALK_MAX_M &&
    s.durationSec <= STATION_WALK_MAX_SEC
  );
}

/** 経路線を区間ごとの線からつなぎ直す（つなぎ目の重複点は除く） */
function joinPaths(paths: LatLng[][]): LatLng[] {
  const out: LatLng[] = [];
  for (const p of paths) {
    for (const pt of p) {
      const last = out[out.length - 1];
      if (last && last.lat === pt.lat && last.lng === pt.lng) continue;
      out.push(pt);
    }
  }
  return out;
}

export function trimStationWalks(plan: TransitPlan, fromName: string | undefined, toName: string | undefined): TransitPlan {
  const segs = plan.segments;
  const firstRide = segs[1];
  const lastRide = segs[segs.length - 2];
  const dropHead =
    segs.length >= 2 && isShortWalk(segs[0]) && firstRide?.kind === 'transit' && sameStation(firstRide.departureStop, fromName);
  const dropTail =
    segs.length >= 2 && isShortWalk(segs[segs.length - 1]) && lastRide?.kind === 'transit' && sameStation(lastRide.arrivalStop, toName);
  if (!dropHead && !dropTail) return plan;

  const start = dropHead ? 1 : 0;
  const end = dropTail ? segs.length - 1 : segs.length;
  const segments = segs.slice(start, end);
  const rides = segments.filter((s): s is TransitSegment => s.kind === 'transit');
  if (rides.length === 0) return plan;

  const removed = [...(dropHead ? [segs[0]] : []), ...(dropTail ? [segs[segs.length - 1]] : [])];
  const removedWalkSec = removed.reduce((a, s) => a + s.durationSec, 0);
  const removedDist = removed.reduce((a, s) => a + (s.kind === 'walk' ? s.distanceM : 0), 0);

  const departureTime = dropHead ? rides[0].departureTime : plan.departureTime;
  const arrivalTime = dropTail ? rides[rides.length - 1].arrivalTime : plan.arrivalTime;

  // 地図の区間（legs）が区間と 1 対 1 のときだけ、経路線も同じように外す
  let legs = plan.legs;
  let overviewPath = plan.overviewPath;
  let bounds = plan.bounds;
  if (legs && legs.length === segs.length) {
    legs = legs.slice(start, end);
    const joined = joinPaths(legs.map((l) => l.path));
    if (joined.length > 1) {
      overviewPath = joined;
      bounds = boundsOf(joined) ?? bounds;
    }
  }

  return {
    ...plan,
    segments,
    departureTime,
    arrivalTime,
    durationSec: Math.max(0, Math.round((arrivalTime.getTime() - departureTime.getTime()) / 1000)),
    walkSec: Math.max(0, plan.walkSec - removedWalkSec),
    distanceM: plan.distanceM != null ? Math.max(0, plan.distanceM - removedDist) : undefined,
    legs,
    overviewPath,
    bounds,
  };
}
