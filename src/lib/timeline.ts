import type { TransitPlan, TransitSegment, WalkSegment } from '../types';

/**
 * 経路を NAVITIME 風のタイムライン行に変換する。
 * 地点行は「11:02 着 / 11:05 発 学園前」のように、到着と出発をひとつにまとめる。
 */

export interface PointRow {
  kind: 'point';
  name: string;
  /** その地点に着く時刻（出発地には無い） */
  arrive?: Date;
  /** その地点を出る時刻（目的地には無い） */
  depart?: Date;
  /** 出発地 / 目的地 */
  terminal?: 'start' | 'goal';
  /** 乗車する路線の降車駅（時刻表リンク用） */
  nextStop?: string;
}

export interface WalkRow {
  kind: 'walk';
  segment: WalkSegment;
}

export interface TransitRow {
  kind: 'transit';
  segment: TransitSegment;
}

export type TimelineRow = PointRow | WalkRow | TransitRow;

export function buildTimelineRows(plan: TransitPlan, fromName: string, toName: string): TimelineRow[] {
  const rows: TimelineRow[] = [];
  const start: PointRow = { kind: 'point', name: fromName, depart: plan.departureTime, terminal: 'start' };
  rows.push(start);

  let cursor = plan.departureTime;
  /** 直前が徒歩のとき、次の地点に着く時刻 */
  let pendingArrive: Date | undefined;
  let trailingWalk = false;

  for (const s of plan.segments) {
    if (s.kind === 'walk') {
      rows.push({ kind: 'walk', segment: s });
      cursor = new Date(cursor.getTime() + s.durationSec * 1000);
      pendingArrive = cursor;
      trailingWalk = true;
      continue;
    }

    const last = rows[rows.length - 1];
    if (!trailingWalk && last?.kind === 'point') {
      // 同じ駅での乗換、または出発地から直接乗車: 直前の地点行に発時刻を足す
      last.depart = s.departureTime;
      last.nextStop = s.arrivalStop;
      // 出発地から直接乗る場合は、実際の乗車地点の名前を使う
      if (s.departureStop) last.name = s.departureStop;
    } else {
      rows.push({
        kind: 'point',
        name: s.departureStop,
        arrive: pendingArrive,
        depart: s.departureTime,
        nextStop: s.arrivalStop,
      });
    }

    rows.push({ kind: 'transit', segment: s });
    rows.push({ kind: 'point', name: s.arrivalStop, arrive: s.arrivalTime });
    cursor = s.arrivalTime;
    pendingArrive = undefined;
    trailingWalk = false;
  }

  const last = rows[rows.length - 1];
  if (!trailingWalk && last?.kind === 'point' && last !== start) {
    // 最後の降車駅が目的地
    last.terminal = 'goal';
    last.arrive = last.arrive ?? plan.arrivalTime;
  } else {
    rows.push({ kind: 'point', name: toName, arrive: plan.arrivalTime, terminal: 'goal' });
  }
  return rows;
}
