import { describe, expect, it, vi } from 'vitest';
import { collectTimetable, mergeEntries, nextDepartureAfter, planToEntry } from './timetable';
import type { RouteLike, StepLike } from './transit';
import type { TimetableEntry } from '../types';

const t = (h: number, m: number) => new Date(2026, 8, 19, h, m);

function ride(line: string, dep: Date, arr: Date): StepLike {
  return {
    travelMode: 'TRANSIT',
    staticDurationMillis: arr.getTime() - dep.getTime(),
    transitDetails: {
      transitLine: { name: line, vehicle: { vehicleType: 'SUBWAY', name: '地下鉄' } },
      headsign: '池袋',
      departureStop: { name: '銀座' },
      arrivalStop: { name: '新宿' },
      departureTime: dep,
      arrivalTime: arr,
      stopCount: 5,
    },
  };
}
const route = (dep: Date, line = '丸ノ内線'): RouteLike => ({
  legs: [{ steps: [{ travelMode: 'WALKING', staticDurationMillis: 60_000, distanceMeters: 50 }, ride(line, dep, new Date(dep.getTime() + 15 * 60_000))] }],
  durationMillis: 960_000,
});
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
    const e = planToEntry(route(t(8, 5)), 0);
    expect(e).toMatchObject({ lineName: '丸ノ内線', departureStop: '銀座', arrivalStop: '新宿', transfers: 0, vehicle: 'SUBWAY' });
    expect(e?.departureTime).toEqual(t(8, 5));
  });

  it('planToEntry returns null for walk-only routes', () => {
    expect(planToEntry({ legs: [{ steps: [{ travelMode: 'WALKING' }] }] }, 0)).toBeNull();
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
      if (dep.getTime() <= t(8, 0).getTime()) return [route(t(8, 2)), route(t(8, 6))];
      if (dep.getTime() <= t(8, 7).getTime()) return [route(t(8, 10))];
      return [route(t(8, 10))];
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
    const fetcher = vi.fn(async (dep: Date) => [route(new Date(dep.getTime() + 60_000 * ++n))]);
    const r = await collectTimetable(fetcher, t(8, 0), 2);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(r).toHaveLength(2);

    await expect(collectTimetable(async () => { throw new Error('boom'); }, t(8, 0), 3)).rejects.toThrow('boom');

    let calls = 0;
    const flaky = async (dep: Date) => {
      if (calls++ === 1) throw new Error('later');
      return [route(dep)];
    };
    const partial = await collectTimetable(flaky, t(8, 0), 4);
    expect(partial).toHaveLength(1);
  });
});
