import { describe, expect, it } from 'vitest';
import { assignBadges, normalizeVehicle, resultToPlans, routeToPlan, type RouteLike, type StepLike } from './transit';

const t = (h: number, m: number) => new Date(2026, 8, 19, h, m);

function walk(sec: number, m: number): StepLike {
  return { travel_mode: 'WALKING', duration: { value: sec }, distance: { value: m }, instructions: '<b>徒歩</b>' };
}
function ride(line: string, dep: Date, arr: Date, from: string, to: string, opts: Partial<NonNullable<StepLike['transit']>['line']> = {}): StepLike {
  return {
    travel_mode: 'TRANSIT',
    duration: { value: (arr.getTime() - dep.getTime()) / 1000 },
    transit: {
      line: { name: line, short_name: line.slice(0, 2), color: '#ff0000', vehicle: { type: 'HEAVY_RAIL', name: '電車' }, ...opts },
      headsign: '高尾',
      departure_stop: { name: from },
      arrival_stop: { name: to },
      departure_time: { value: dep },
      arrival_time: { value: arr },
      num_stops: 3,
    },
  };
}
function route(steps: StepLike[], fare?: number): RouteLike {
  const dur = steps.reduce((a, s) => a + (s.duration?.value ?? 0), 0);
  return {
    legs: [{ duration: { value: dur }, departure_time: { value: t(8, 0) }, arrival_time: { value: new Date(t(8, 0).getTime() + dur * 1000) }, steps }],
    fare: fare != null ? { value: fare, currency: 'JPY', text: `¥${fare}` } : undefined,
  };
}

describe('transit', () => {
  it('normalizeVehicle', () => {
    expect(normalizeVehicle('HEAVY_RAIL')).toBe('RAIL');
    expect(normalizeVehicle('SUBWAY')).toBe('SUBWAY');
    expect(normalizeVehicle('BUS')).toBe('BUS');
    expect(normalizeVehicle(undefined)).toBe('OTHER');
    expect(normalizeVehicle('FERRY')).toBe('OTHER');
  });

  it('routeToPlan merges consecutive walks and counts transfers', () => {
    const r = route([walk(60, 80), walk(120, 150), ride('中央線', t(8, 3), t(8, 20), '東京', '新宿'), walk(30, 40), ride('山手線', t(8, 25), t(8, 30), '新宿', '代々木'), walk(60, 70)]);
    const p = routeToPlan(r, 0);
    expect(p.segments.map((s) => s.kind)).toEqual(['walk', 'transit', 'walk', 'transit', 'walk']);
    expect(p.segments[0]).toMatchObject({ kind: 'walk', durationSec: 180, distanceM: 230 });
    expect(p.transfers).toBe(1);
    expect(p.walkSec).toBe(270);
    expect(p.summary).toBe('中央 → 山手');
    const seg = p.segments[1];
    expect(seg.kind === 'transit' && seg.vehicle).toBe('RAIL');
  });

  it('assignBadges marks fastest / cheapest / easiest', () => {
    const fast = route([ride('A', t(8, 0), t(8, 20), 'x', 'y'), walk(10, 10), ride('B', t(8, 21), t(8, 25), 'y', 'z')], 500);
    const cheap = route([ride('C', t(8, 0), t(8, 40), 'x', 'z')], 200);
    const plans = assignBadges([routeToPlan(fast, 0), routeToPlan(cheap, 1)]);
    expect(plans[0].badges).toEqual(['fastest']);
    expect(plans[1].badges).toEqual(['cheapest', 'easiest']);
  });

  it('assignBadges skips cheapest when no fare data', () => {
    const plans = assignBadges([routeToPlan(route([ride('A', t(8, 0), t(8, 20), 'x', 'y')]), 0)]);
    expect(plans[0].badges).toEqual(['fastest', 'easiest']);
  });

  it('resultToPlans sorts by departure time', () => {
    const late: RouteLike = { ...route([ride('A', t(9, 0), t(9, 20), 'x', 'y')]), legs: [{ steps: [ride('A', t(9, 0), t(9, 20), 'x', 'y')], departure_time: { value: t(9, 0) } }] };
    const early: RouteLike = { legs: [{ steps: [ride('B', t(8, 0), t(8, 20), 'x', 'y')], departure_time: { value: t(8, 0) } }] };
    const plans = resultToPlans({ routes: [late, early] });
    expect(plans.map((p) => p.summary)).toEqual(['B', 'A']);
  });
});
