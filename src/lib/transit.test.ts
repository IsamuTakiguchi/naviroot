import { describe, expect, it } from 'vitest';
import { assignBadges, moneyToFare, normalizeVehicle, resultToPlans, routeToPlan, type RouteLike, type StepLike } from './transit';

const t = (h: number, m: number) => new Date(2026, 8, 19, h, m);
const ms = (sec: number) => sec * 1000;

export function walk(sec: number, m: number): StepLike {
  return { travelMode: 'WALKING', staticDurationMillis: ms(sec), distanceMeters: m, instructions: '<b>徒歩</b>' };
}
export function ride(
  line: string,
  dep: Date,
  arr: Date,
  from: string,
  to: string,
  opts: Partial<NonNullable<NonNullable<StepLike['transitDetails']>['transitLine']>> = {},
): StepLike {
  return {
    travelMode: 'TRANSIT',
    staticDurationMillis: arr.getTime() - dep.getTime(),
    transitDetails: {
      transitLine: {
        name: line,
        shortName: line.slice(0, 2),
        color: '#ff0000',
        vehicle: { vehicleType: 'HEAVY_RAIL', name: '電車' },
        agencies: [{ name: 'JR東日本' }],
        ...opts,
      },
      headsign: '高尾',
      departureStop: { name: from },
      arrivalStop: { name: to },
      departureTime: dep,
      arrivalTime: arr,
      stopCount: 3,
    },
  };
}
export function route(steps: StepLike[], fareYen?: number, fareText?: string): RouteLike {
  const dur = steps.reduce((a, s) => a + (s.staticDurationMillis ?? 0), 0);
  return {
    legs: [{ steps, staticDurationMillis: dur }],
    durationMillis: dur,
    travelAdvisory: fareYen != null ? { transitFare: { currencyCode: 'JPY', units: fareYen, nanos: 0 } } : null,
    localizedValues: { transitFare: fareText ?? null },
  };
}

describe('transit', () => {
  it('normalizeVehicle', () => {
    expect(normalizeVehicle('HEAVY_RAIL')).toBe('RAIL');
    expect(normalizeVehicle('SUBWAY')).toBe('SUBWAY');
    expect(normalizeVehicle('BUS')).toBe('BUS');
    expect(normalizeVehicle('LIGHT_RAIL')).toBe('TRAM');
    expect(normalizeVehicle(undefined)).toBe('OTHER');
    expect(normalizeVehicle('FERRY')).toBe('OTHER');
  });

  it('moneyToFare converts units + nanos', () => {
    expect(moneyToFare({ currencyCode: 'JPY', units: 1234, nanos: 0 })).toEqual({ value: 1234, currency: 'JPY', text: '¥1,234' });
    expect(moneyToFare({ currencyCode: 'USD', units: 2, nanos: 500_000_000 }, '$2.50')).toEqual({ value: 2.5, currency: 'USD', text: '$2.50' });
    expect(moneyToFare(null)).toBeUndefined();
    expect(moneyToFare({ currencyCode: 'JPY', units: 0, nanos: 0 })).toBeUndefined();
  });

  it('routeToPlan merges consecutive walks, counts transfers and derives times', () => {
    const r = route([walk(60, 80), walk(120, 150), ride('中央線', t(8, 3), t(8, 20), '東京', '新宿'), walk(30, 40), ride('山手線', t(8, 25), t(8, 30), '新宿', '代々木'), walk(60, 70)], 200);
    const p = routeToPlan(r, 0);
    expect(p.segments.map((s) => s.kind)).toEqual(['walk', 'transit', 'walk', 'transit', 'walk']);
    expect(p.segments[0]).toMatchObject({ kind: 'walk', durationSec: 180, distanceM: 230 });
    expect(p.transfers).toBe(1);
    expect(p.walkSec).toBe(270);
    expect(p.summary).toBe('中央 → 山手');
    expect(p.departureTime).toEqual(t(8, 0));
    expect(p.arrivalTime).toEqual(t(8, 31));
    expect(p.fare).toEqual({ value: 200, currency: 'JPY', text: '¥200' });
    const seg = p.segments[1];
    expect(seg.kind === 'transit' && seg.vehicle).toBe('RAIL');
    expect(seg.kind === 'transit' && seg.agency).toBe('JR東日本');
    expect(seg.kind === 'transit' && seg.departureStop).toBe('東京');
  });

  it('walk-only routes use now as departure', () => {
    const now = t(9, 0);
    const p = routeToPlan(route([walk(600, 800)]), 0, now);
    expect(p.departureTime).toEqual(now);
    expect(p.arrivalTime).toEqual(t(9, 10));
    expect(p.transfers).toBe(0);
    expect(p.fare).toBeUndefined();
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
    const late = route([ride('A', t(9, 0), t(9, 20), 'x', 'y')]);
    const early = route([ride('B', t(8, 0), t(8, 20), 'x', 'y')]);
    const plans = resultToPlans([late, early]);
    expect(plans.map((p) => p.summary)).toEqual(['B', 'A']);
  });
});
