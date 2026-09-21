import { describe, expect, it } from 'vitest';
import type { LatLng, PlanSegment } from '../types';
import { buildLegs, cumulative, journeyAt, journeyDuration, legTimings, nearestIndex, pointAt, splitIndices } from './journey';
import { glyphFor, stepPhase, tokenSvg } from './token';

const line = (n: number): LatLng[] => Array.from({ length: n }, (_, i) => ({ lat: 34, lng: 135 + i * 0.01 }));

const walk = (sec: number): PlanSegment => ({ kind: 'walk', durationSec: sec, distanceM: sec * 1.2, instruction: '徒歩' });
const ride = (sec: number, lineName: string, vehicle: 'RAIL' | 'BUS' = 'RAIL', lineColor?: string): PlanSegment => ({
  kind: 'transit',
  lineName,
  lineColor,
  vehicle,
  vehicleName: '普通',
  headsign: '行き先',
  departureStop: 'A',
  arrivalStop: 'B',
  departureTime: new Date(0),
  arrivalTime: new Date(sec * 1000),
  numStops: 2,
  durationSec: sec,
});

describe('journey', () => {
  it('cumulative and pointAt walk along the path by distance', () => {
    const path = line(5);
    const cum = cumulative(path);
    expect(cum).toHaveLength(5);
    expect(cum[0]).toBe(0);
    expect(cum[4]).toBeGreaterThan(cum[2]);

    expect(pointAt(path, 0)).toEqual(path[0]);
    expect(pointAt(path, 1).lng).toBeCloseTo(path[4].lng, 6);
    expect(pointAt(path, 0.5).lng).toBeCloseTo(135.02, 4);
    // はみ出した t や短い経路でも落ちない
    expect(pointAt(path, -3)).toEqual(path[0]);
    expect(pointAt([], 0.5)).toEqual({ lat: 0, lng: 0 });
    expect(pointAt([path[0]], 0.5)).toEqual(path[0]);
    expect(pointAt([path[0], path[0]], 0.5)).toEqual(path[0]);
  });

  it('nearestIndex finds the closest vertex without going back', () => {
    const path = line(6);
    expect(nearestIndex(path, { lat: 34, lng: 135.0299 })).toBe(3);
    // from より前は見ない
    expect(nearestIndex(path, { lat: 34, lng: 135.0 }, 4)).toBe(4);
  });

  it('splitIndices keeps boundaries increasing and inside the path', () => {
    const path = line(10);
    const b = splitIndices(path, [
      { lat: 34, lng: 135.03 },
      { lat: 34, lng: 135.06 },
    ]);
    expect(b[0]).toBe(0);
    expect(b[b.length - 1]).toBe(9);
    expect(b).toEqual([...b].sort((x, y) => x - y));
    expect(new Set(b).size).toBe(b.length);
    // 経路の外れた地点を渡しても端は壊れない
    const b2 = splitIndices(path, [{ lat: 90, lng: 0 }]);
    expect(b2[0]).toBe(0);
    expect(b2[b2.length - 1]).toBe(9);
  });

  it('buildLegs splits the path at the given boundaries and keeps the modes', () => {
    const path = line(10);
    const segments = [walk(300), ride(1800, '近鉄奈良線', 'RAIL', '#E60012'), walk(240)];
    const legs = buildLegs(path, segments, [
      { lat: 34, lng: 135.02 },
      { lat: 34, lng: 135.07 },
    ]);
    expect(legs.map((l) => l.kind)).toEqual(['walk', 'transit', 'walk']);
    expect(legs[1].label).toBe('近鉄奈良線');
    expect(legs[1].color).toBe('#E60012');
    // 区間はつながっていて、全体で経路を覆う
    expect(legs[0].path[0]).toEqual(path[0]);
    expect(legs[2].path[legs[2].path.length - 1]).toEqual(path[9]);
    expect(legs[0].path[legs[0].path.length - 1]).toEqual(legs[1].path[0]);
    expect(legs[1].path[legs[1].path.length - 1]).toEqual(legs[2].path[0]);
  });

  it('buildLegs falls back to a time-proportional split when boundaries are missing', () => {
    const path = line(20);
    const segments = [walk(60), ride(3000, 'JR'), walk(60)];
    const legs = buildLegs(path, segments, []); // 境目の座標が取れなかった場合
    expect(legs).toHaveLength(3);
    // 乗車区間がいちばん長い
    expect(legs[1].path.length).toBeGreaterThan(legs[0].path.length);
    expect(legs[2].path[legs[2].path.length - 1]).toEqual(path[19]);
    // 経路が短い・区間が無い場合は空
    expect(buildLegs([path[0]], segments, [])).toEqual([]);
    expect(buildLegs(path, [], [])).toEqual([]);
  });

  it('legTimings give every leg a visible share that adds up to the total', () => {
    const path = line(10);
    const legs = buildLegs(path, [walk(30), ride(7200, 'JR'), walk(30)], []);
    const total = journeyDuration(legs);
    const timings = legTimings(legs);
    expect(timings.reduce((a, x) => a + x, 0)).toBeCloseTo(total, 3);
    // ごく短い徒歩でも一瞬で消えない
    expect(Math.min(...timings)).toBeGreaterThan(400);
    // 乗車区間がいちばん長い
    expect(timings[1]).toBeGreaterThan(timings[0]);
    expect(legTimings([])).toEqual([]);
  });

  it('journeyAt moves through the legs in order and ends at the destination', () => {
    const path = line(10);
    const legs = buildLegs(path, [walk(300), ride(1800, 'JR'), walk(300)], [
      { lat: 34, lng: 135.02 },
      { lat: 34, lng: 135.07 },
    ]);
    const timings = legTimings(legs);
    const total = timings.reduce((a, x) => a + x, 0);

    expect(journeyAt(legs, timings, 0)!.index).toBe(0);
    expect(journeyAt(legs, timings, 0)!.pos).toEqual(path[0]);
    expect(journeyAt(legs, timings, timings[0] + 10)!.index).toBe(1);
    const end = journeyAt(legs, timings, total + 500)!;
    expect(end.index).toBe(legs.length - 1);
    expect(end.done).toBe(true);
    expect(end.pos.lng).toBeCloseTo(path[9].lng, 6);

    // 進むほど前に進む（後戻りしない）
    let prev = -Infinity;
    for (let t = 0; t <= total; t += total / 20) {
      const at = journeyAt(legs, timings, t)!;
      expect(at.pos.lng).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = at.pos.lng;
    }
    expect(journeyAt([], [], 0)).toBeUndefined();
  });
});

describe('token', () => {
  it('picks the glyph from the leg, honouring an explicit override', () => {
    expect(glyphFor({ kind: 'walk' })).toBe('walk');
    expect(glyphFor({ kind: 'transit', vehicle: 'BUS' })).toBe('bus');
    expect(glyphFor({ kind: 'transit', vehicle: 'TRAM' })).toBe('tram');
    expect(glyphFor({ kind: 'transit', vehicle: 'SUBWAY' })).toBe('train');
    expect(glyphFor({ kind: 'transit' })).toBe('train');
    expect(glyphFor({ kind: 'walk', glyph: 'bicycle' })).toBe('bicycle');
  });

  it('draws a valid SVG token whose look changes with the step', () => {
    const a = tokenSvg('walk', '#14a34e', 0);
    const b = tokenSvg('walk', '#14a34e', 1);
    expect(a.startsWith('<svg')).toBe(true);
    expect(a.endsWith('</svg>')).toBe(true);
    expect(a).toContain('#14a34e');
    expect(a).not.toBe(b); // 足が動く
    for (const g of ['train', 'bus', 'tram', 'car', 'bicycle'] as const) {
      expect(tokenSvg(g, '#2f9bf0').startsWith('<svg')).toBe(true);
    }
  });

  it('stepPhase alternates, faster on foot than on a vehicle', () => {
    expect(stepPhase('walk', 0)).toBe(0);
    expect(stepPhase('walk', 300)).toBe(1);
    expect(stepPhase('walk', 600)).toBe(0);
    expect(stepPhase('train', 300)).toBe(0);
    expect(stepPhase('train', 500)).toBe(1);
  });
});
