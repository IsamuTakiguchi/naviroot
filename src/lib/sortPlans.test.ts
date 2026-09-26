import { describe, expect, it } from 'vitest';
import type { TransitPlan } from '../types';
import { PLAN_SORTS, sortPlans } from './sortPlans';

const mk = (id: string, depMin: number, durMin: number, fareYen: number | undefined, transfers: number, walkSec = 0): TransitPlan => ({
  id,
  departureTime: new Date(2026, 8, 26, 18, depMin),
  arrivalTime: new Date(2026, 8, 26, 18, depMin + durMin),
  durationSec: durMin * 60,
  transfers,
  fare: fareYen == null ? undefined : { value: fareYen, currency: 'JPY', text: `${fareYen}` },
  walkSec,
  summary: id,
  badges: [],
  segments: [],
});

const plans = [mk('a', 44, 28, 530, 0), mk('b', 51, 26, 1050, 0), mk('c', 56, 27, 530, 0), mk('d', 40, 35, 400, 1, 300), mk('e', 45, 30, undefined, 2)];

describe('sortPlans', () => {
  it('has the four NAVITIME tabs', () => {
    expect(PLAN_SORTS.map((s) => s.label)).toEqual(['おすすめ', '時間短い', '運賃安い', '乗換少ない']);
  });

  it('sorts by departure, duration, fare, and transfers', () => {
    expect(sortPlans(plans, 'recommended').map((p) => p.id)).toEqual(['d', 'a', 'e', 'b', 'c']);
    expect(sortPlans(plans, 'fastest').map((p) => p.id)).toEqual(['b', 'c', 'a', 'e', 'd']);
    // 運賃不明は最後
    expect(sortPlans(plans, 'cheapest').map((p) => p.id)).toEqual(['d', 'c', 'a', 'b', 'e']);
    // 乗換が同じなら歩きが少ない順 → 所要時間順
    expect(sortPlans(plans, 'fewest').map((p) => p.id)).toEqual(['b', 'c', 'a', 'd', 'e']);
  });

  it('does not mutate the input', () => {
    const before = plans.map((p) => p.id);
    sortPlans(plans, 'fastest');
    expect(plans.map((p) => p.id)).toEqual(before);
  });
});
