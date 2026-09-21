import { describe, expect, it } from 'vitest';
import { buildTimelineRows, type PointRow } from './timeline';
import type { PlanSegment, TransitPlan } from '../types';

const t = (h: number, m: number) => new Date(2026, 8, 21, h, m);

const walk = (sec: number, m: number): PlanSegment => ({ kind: 'walk', durationSec: sec, distanceM: m, instruction: '徒歩' });
const ride = (line: string, dep: Date, arr: Date, from: string, to: string): PlanSegment => ({
  kind: 'transit',
  lineName: line,
  vehicle: 'RAIL',
  vehicleName: '普通',
  headsign: '行先',
  departureStop: from,
  arrivalStop: to,
  departureTime: dep,
  arrivalTime: arr,
  numStops: 2,
  durationSec: (arr.getTime() - dep.getTime()) / 1000,
});

const makePlan = (segments: PlanSegment[], dep: Date, arr: Date): TransitPlan => ({
  id: 'p',
  departureTime: dep,
  arrivalTime: arr,
  durationSec: (arr.getTime() - dep.getTime()) / 1000,
  transfers: 0,
  walkSec: 0,
  summary: '',
  badges: [],
  segments,
});

const points = (rows: ReturnType<typeof buildTimelineRows>) => rows.filter((r): r is PointRow => r.kind === 'point');

describe('timeline', () => {
  it('merges arrival and departure at the same station and derives walk arrival', () => {
    const plan = makePlan(
      [
        walk(720, 720),
        ride('近鉄奈良線', t(11, 5), t(11, 10), '学園前', '大和西大寺'),
        ride('近鉄京都線特急', t(11, 15), t(12, 42), '大和西大寺', '近鉄名古屋'),
      ],
      t(10, 50),
      t(12, 42),
    );
    const rows = buildTimelineRows(plan, '鶴舞西町1-12', '近鉄名古屋');
    expect(rows.map((r) => r.kind)).toEqual(['point', 'walk', 'point', 'transit', 'point', 'transit', 'point']);

    const [origin, gakuenmae, saidaiji, goal] = points(rows);
    expect(origin).toMatchObject({ name: '鶴舞西町1-12', depart: t(10, 50), terminal: 'start' });
    expect(origin.arrive).toBeUndefined();
    // 徒歩 12 分後に到着し、11:05 に発車
    expect(gakuenmae).toMatchObject({ name: '学園前', arrive: t(11, 2), depart: t(11, 5), nextStop: '大和西大寺' });
    // 同じ駅での乗換は 1 行にまとまる
    expect(saidaiji).toMatchObject({ name: '大和西大寺', arrive: t(11, 10), depart: t(11, 15), nextStop: '近鉄名古屋' });
    expect(goal).toMatchObject({ name: '近鉄名古屋', arrive: t(12, 42), terminal: 'goal' });
    expect(goal.depart).toBeUndefined();
  });

  it('adds a goal row after a trailing walk and names the boarding stop when leaving directly', () => {
    const plan = makePlan([ride('バス', t(9, 0), t(9, 20), '鶴舞', '学園前駅'), walk(300, 300)], t(9, 0), t(9, 25));
    const rows = buildTimelineRows(plan, '出発地', '目的地');
    expect(rows.map((r) => r.kind)).toEqual(['point', 'transit', 'point', 'walk', 'point']);
    const p = points(rows);
    // 徒歩を挟まず乗車するので、出発地の行が乗車停留所の名前になる
    expect(p[0]).toMatchObject({ name: '鶴舞', depart: t(9, 0), terminal: 'start', nextStop: '学園前駅' });
    expect(p[1]).toMatchObject({ name: '学園前駅', arrive: t(9, 20) });
    expect(p[2]).toMatchObject({ name: '目的地', arrive: t(9, 25), terminal: 'goal' });
  });

  it('handles a walk-only plan', () => {
    const plan = makePlan([walk(600, 800)], t(8, 0), t(8, 10));
    const rows = buildTimelineRows(plan, 'A', 'B');
    expect(rows.map((r) => r.kind)).toEqual(['point', 'walk', 'point']);
    expect(points(rows)[1]).toMatchObject({ name: 'B', arrive: t(8, 10), terminal: 'goal' });
  });

  it('separates transfers that require a walk between stations', () => {
    const plan = makePlan(
      [ride('A線', t(8, 0), t(8, 10), '駅1', '駅2'), walk(180, 200), ride('B線', t(8, 20), t(8, 30), '駅3', '駅4')],
      t(8, 0),
      t(8, 30),
    );
    const rows = buildTimelineRows(plan, '駅1', '駅4');
    const p = points(rows);
    expect(p.map((x) => x.name)).toEqual(['駅1', '駅2', '駅3', '駅4']);
    expect(p[1]).toMatchObject({ name: '駅2', arrive: t(8, 10) });
    expect(p[1].depart).toBeUndefined();
    expect(p[2]).toMatchObject({ name: '駅3', arrive: t(8, 13), depart: t(8, 20) });
  });
});
