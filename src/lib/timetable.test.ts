import { describe, expect, it, vi } from 'vitest';
import { collectTimetable, mergeEntries, nextDepartureAfter, planToEntry } from './timetable';
import type { TimetableEntry, TransitPlan } from '../types';

const t = (h: number, m: number) => new Date(2026, 8, 19, h, m);

function plan(dep: Date, line = '丸ノ内線', withWalk = true): TransitPlan {
  const arr = new Date(dep.getTime() + 15 * 60_000);
  return {
    id: 'p',
    departureTime: new Date(dep.getTime() - 60_000),
    arrivalTime: arr,
    durationSec: 960,
    transfers: 0,
    walkSec: 60,
    summary: line,
    badges: [],
    segments: [
      ...(withWalk ? [{ kind: 'walk' as const, durationSec: 60, distanceM: 50, instruction: '徒歩' }] : []),
      {
        kind: 'transit' as const,
        lineName: line,
        vehicle: 'SUBWAY' as const,
        vehicleName: '地下鉄',
        headsign: '池袋',
        departureStop: '銀座',
        arrivalStop: '新宿',
        departureTime: dep,
        arrivalTime: arr,
        numStops: 5,
        durationSec: 900,
      },
    ],
  };
}
const entry = (dep: Date, line = 'L'): TimetableEntry => ({
  departureTime: dep,
  arrivalTime: new Date(dep.getTime() + 600_000),
  lineName: line,
  headsign: 'H',
  vehicle: 'RAIL',
  vehicleName: '',
  departureStop: 'a',
  arrivalStop: 'b',
  numStops: 1,
  transfers: 0,
  durationSec: 600,
});

describe('timetable', () => {
  it('planToEntry uses the first ride as the departure', () => {
    const e = planToEntry(plan(t(8, 5)));
    expect(e).toMatchObject({ lineName: '丸ノ内線', departureStop: '銀座', arrivalStop: '新宿', transfers: 0, vehicle: 'SUBWAY' });
    expect(e?.departureTime).toEqual(t(8, 5));
  });

  it('planToEntry returns null for walk-only plans', () => {
    const walkOnly: TransitPlan = { ...plan(t(8, 0)), segments: [{ kind: 'walk', durationSec: 600, distanceM: 800, instruction: '徒歩' }] };
    expect(planToEntry(walkOnly)).toBeNull();
  });

  it('mergeEntries dedupes and sorts', () => {
    const merged = mergeEntries([[entry(t(8, 10)), entry(t(8, 0))], [entry(t(8, 10)), entry(t(8, 5), 'M')]]);
    expect(merged.map((e) => `${e.departureTime.getMinutes()}${e.lineName}`)).toEqual(['0L', '5M', '10L']);
  });

  it('nextDepartureAfter advances one minute past the latest', () => {
    expect(nextDepartureAfter([], t(8, 0))).toEqual(t(8, 1));
    expect(nextDepartureAfter([entry(t(8, 10)), entry(t(8, 4))], t(8, 0))).toEqual(t(8, 11));
    expect(nextDepartureAfter([entry(t(7, 50))], t(8, 0))).toEqual(t(8, 1));
  });

  it('collectTimetable walks forward and stops when nothing new arrives', async () => {
    const fetcher = vi.fn(async (dep: Date) => {
      if (dep.getTime() <= t(8, 0).getTime()) return [plan(t(8, 2)), plan(t(8, 6))];
      if (dep.getTime() <= t(8, 7).getTime()) return [plan(t(8, 10))];
      return [plan(t(8, 10))];
    });
    const progress = vi.fn();
    const result = await collectTimetable(fetcher, t(8, 0), 6, progress);
    expect(result.map((e) => e.departureTime.getMinutes())).toEqual([2, 6, 10]);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[1][0]).toEqual(t(8, 7));
    expect(fetcher.mock.calls[2][0]).toEqual(t(8, 11));
    expect(progress).toHaveBeenLastCalledWith(expect.any(Array), 3);
  });

  it('collectTimetable respects maxQueries and rethrows only the first failure', async () => {
    let n = 0;
    const fetcher = vi.fn(async (dep: Date) => [plan(new Date(dep.getTime() + 60_000 * ++n))]);
    const r = await collectTimetable(fetcher, t(8, 0), 2);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(r).toHaveLength(2);

    await expect(collectTimetable(async () => { throw new Error('boom'); }, t(8, 0), 3)).rejects.toThrow('boom');

    let calls = 0;
    const flaky = async (dep: Date) => {
      if (calls++ === 1) throw new Error('later');
      return [plan(dep)];
    };
    const partial = await collectTimetable(flaky, t(8, 0), 4);
    expect(partial).toHaveLength(1);
  });
});
