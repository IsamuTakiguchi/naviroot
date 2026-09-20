import type { TimetableEntry, TransitPlan, TransitSegment } from '../types';

/** TransitPlan から時刻表エントリ（最初の乗車区間を基準）を作る。乗車が無ければ null。 */
export function planToEntry(plan: TransitPlan): TimetableEntry | null {
  const transit = plan.segments.filter((s): s is TransitSegment => s.kind === 'transit');
  const first = transit[0];
  if (!first) return null;
  const last = transit[transit.length - 1];
  return {
    departureTime: first.departureTime,
    arrivalTime: last.arrivalTime,
    lineName: first.lineName,
    lineShortName: first.lineShortName,
    lineColor: first.lineColor,
    headsign: first.headsign,
    vehicle: first.vehicle,
    vehicleName: first.vehicleName,
    departureStop: first.departureStop,
    arrivalStop: last.arrivalStop,
    numStops: first.numStops,
    transfers: plan.transfers,
    durationSec: plan.durationSec,
  };
}

export function entryKey(e: TimetableEntry): string {
  return `${e.departureTime.getTime()}|${e.lineName}|${e.headsign}`;
}

/** 重複を除いて出発時刻順に並べる */
export function mergeEntries(lists: TimetableEntry[][]): TimetableEntry[] {
  const seen = new Set<string>();
  const out: TimetableEntry[] = [];
  for (const list of lists) {
    for (const e of list) {
      const k = entryKey(e);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(e);
    }
  }
  return out.sort((a, b) => a.departureTime.getTime() - b.departureTime.getTime());
}

/** 次に問い合わせる出発時刻: 取得済みの最遅出発 + 1 分 */
export function nextDepartureAfter(entries: TimetableEntry[], fallback: Date): Date {
  if (entries.length === 0) return new Date(fallback.getTime() + 60_000);
  const latest = Math.max(...entries.map((e) => e.departureTime.getTime()));
  return new Date(Math.max(latest, fallback.getTime()) + 60_000);
}

/**
 * 乗換検索を出発時刻をずらしながら複数回呼び、直近の出発一覧を作る。
 * fetchPlans は 1 回分の問い合わせ（データ源に依存しない。テスト差し替え用）。
 */
export async function collectTimetable(
  fetchPlans: (departureTime: Date) => Promise<TransitPlan[]>,
  start: Date,
  maxQueries: number,
  onProgress?: (entries: TimetableEntry[], done: number) => void,
): Promise<TimetableEntry[]> {
  let entries: TimetableEntry[] = [];
  let cursor = start;
  for (let i = 0; i < maxQueries; i++) {
    let plans: TransitPlan[] = [];
    try {
      plans = await fetchPlans(cursor);
    } catch (err) {
      if (i === 0) throw err;
      break;
    }
    const batch = plans.map(planToEntry).filter((e): e is TimetableEntry => e !== null);
    const before = entries.length;
    entries = mergeEntries([entries, batch]);
    onProgress?.(entries, i + 1);
    if (entries.length === before && i > 0) break;
    cursor = nextDepartureAfter(entries, cursor);
  }
  return entries;
}
