import { describe, expect, it, vi } from 'vitest';
import { collectFollowups, earliestDeparture, latestDeparture, modeForParams, shiftParams } from './followups';
import type { TransitPlan } from '../types';

const t = (h: number, m: number) => new Date(2026, 8, 20, h, m);

function plan(dep: Date, line = '奈良交通バス'): TransitPlan {
  const arr = new Date(dep.getTime() + 15 * 60_000);
  return {
    id: 'x',
    departureTime: dep,
    arrivalTime: arr,
    durationSec: 900,
    transfers: 0,
    walkSec: 0,
    summary: line,
    badges: [],
    segments: [
      {
        kind: 'transit',
        lineName: line,
        vehicle: 'BUS',
        vehicleName: 'バス',
        headsign: '学園前駅',
        departureStop: '鶴舞',
        arrivalStop: '学園前駅',
        departureTime: dep,
        arrivalTime: arr,
        numStops: 0,
        durationSec: 900,
      },
    ],
  };
}

describe('followups', () => {
  it('modeForParams / latest / earliest', () => {
    expect(modeForParams({ start_time: 'x' })).toBe('forward');
    expect(modeForParams({ goal_time: 'x' })).toBe('backward');
    expect(modeForParams({ first_operation: '2026-09-20' })).toBe('none');
    expect(latestDeparture([plan(t(8, 0)), plan(t(8, 30))])).toEqual(t(8, 30));
    expect(earliestDeparture([plan(t(8, 0)), plan(t(8, 30))])).toEqual(t(8, 0));
    expect(latestDeparture([])).toBeUndefined();
  });

  it('shiftParams moves the time window and drops other time params', () => {
    const base = { start: '1,2', goal: '3,4', start_time: '2026-09-20T08:00:00', limit: '10', first_operation: '2026-09-20' };
    expect(shiftParams(base, [plan(t(8, 10))], 'next')).toEqual({ start: '1,2', goal: '3,4', limit: '10', start_time: '2026-09-20T08:11:00' });
    expect(shiftParams(base, [plan(t(8, 10)), plan(t(8, 40))], 'prev')).toEqual({ start: '1,2', goal: '3,4', limit: '10', goal_time: '2026-09-20T08:09:00' });
    expect(shiftParams(base, [], 'next')).toBeUndefined();
  });

  it('collectFollowups fetches forward until enough candidates or no growth', async () => {
    const fetcher = vi.fn(async (p: Record<string, string>) => {
      const dep = new Date(p.start_time);
      return [plan(new Date(dep.getTime() + 9 * 60_000))];
    });
    const r = await collectFollowups(fetcher, { start_time: '2026-09-20T08:00:00' }, [plan(t(8, 5))], { min: 4, max: 2 });
    expect(r.plans.map((p) => p.departureTime.getMinutes())).toEqual([5, 15, 25]);
    expect(r.calls).toBe(2);
    expect(fetcher.mock.calls[0][0].start_time).toBe('2026-09-20T08:06:00');
    expect(fetcher.mock.calls[1][0].start_time).toBe('2026-09-20T08:16:00');

    const same = vi.fn(async () => [plan(t(8, 5))]);
    const r2 = await collectFollowups(same, { start_time: '2026-09-20T08:00:00' }, [plan(t(8, 5))], { min: 4, max: 3 });
    expect(r2.plans).toHaveLength(1);
    expect(r2.calls).toBe(1);

    const enough = vi.fn(async () => []);
    const r3 = await collectFollowups(enough, { start_time: 'x' }, [plan(t(8, 0)), plan(t(8, 10)), plan(t(8, 20)), plan(t(8, 30))], { min: 4, max: 2 });
    expect(enough).not.toHaveBeenCalled();
    expect(r3.calls).toBe(0);
  });

  it('collectFollowups goes backward for arrival searches and skips first/last', async () => {
    const fetcher = vi.fn(async (p: Record<string, string>) => {
      const goal = new Date(p.goal_time);
      return [plan(new Date(goal.getTime() - 19 * 60_000))];
    });
    const r = await collectFollowups(fetcher, { goal_time: '2026-09-20T09:00:00' }, [plan(t(8, 40))], { min: 3, max: 3 });
    expect(r.plans.map((p) => p.departureTime.getMinutes())).toEqual([0, 20, 40]);
    expect(fetcher.mock.calls[0][0].goal_time).toBe('2026-09-20T08:39:00');

    const none = vi.fn(async () => [plan(t(9, 0))]);
    const r2 = await collectFollowups(none, { first_operation: '2026-09-20' }, [plan(t(5, 0))], { min: 3, max: 3 });
    expect(none).not.toHaveBeenCalled();
    expect(r2.plans).toHaveLength(1);

    const failing = vi.fn(async () => {
      throw new Error('boom');
    });
    const r3 = await collectFollowups(failing, { start_time: 'x' }, [plan(t(8, 0))], { min: 3, max: 3 });
    expect(r3.plans).toHaveLength(1);
    expect(r3.calls).toBe(0);
  });
});
