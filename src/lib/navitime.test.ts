import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildNavitimeParams,
  contractOptionParams,
  fetchNavitimeRoutes,
  itemToPlan,
  navitimeToPlans,
  mergePlans,
  navitimeUrl,
  NavitimeError,
  planKey,
  surchargeOf,
  legBoundaries,
  requestNavitimePlans,
  sectionPath,
  shapesToPath,
  stripOptionalParams,
  vehicleFromMove,
  type NavitimeItem,
} from './navitime';
import { NAVITIME_HOST, readNavitimeUsage } from '../config';

const item = (over: Partial<NavitimeItem> = {}): NavitimeItem => ({
  summary: {
    start: { name: '鶴舞西町' },
    goal: { name: '学園前駅' },
    move: {
      from_time: '2026-09-20T14:02:00+09:00',
      to_time: '2026-09-20T14:35:00+09:00',
      time: 33,
      distance: 6200,
      transit_count: 1,
      walk_distance: 400,
      fare: { unit_0: 260, unit_48: 252 },
    },
  },
  sections: [
    { type: 'point', name: '鶴舞西町', coord: { lat: 34.69, lon: 135.76 } },
    { type: 'move', move: 'walk', time: 5, distance: 300 },
    { type: 'point', name: '鶴舞', node_id: 'b1' },
    {
      type: 'move',
      move: 'local_bus',
      line_name: '奈良交通バス 学園前駅行',
      from_time: '2026-09-20T14:07:00+09:00',
      to_time: '2026-09-20T14:20:00+09:00',
      time: 13,
      distance: 3000,
      transport: { name: '奈良交通', color: '#3366CC', company: { name: '奈良交通' }, links: [{ destination: { name: '学園前駅' } }] },
    },
    { type: 'point', name: '学園前駅', node_id: 's1' },
    {
      type: 'move',
      move: 'local_train',
      line_name: '近鉄奈良線',
      from_time: '2026-09-20T14:25:00+09:00',
      to_time: '2026-09-20T14:33:00+09:00',
      time: 8,
      distance: 2800,
      transport: { name: '近鉄奈良線', color: 'E60012', type: '普通', company: { name: '近畿日本鉄道' }, links: [{ destination: { name: '近鉄奈良' } }] },
    },
    { type: 'point', name: '近鉄奈良駅' },
    { type: 'move', move: 'walk', time: 1, distance: 50 },
    { type: 'move', move: 'walk', time: 1, distance: 50 },
    { type: 'point', name: '目的地' },
  ],
  shapes: {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', geometry: { type: 'LineString', coordinates: [[135.76, 34.69], [135.77, 34.7]] } },
      { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: [[[135.78, 34.71]]] } },
    ],
  },
  ...over,
});

describe('navitime', () => {
  beforeEach(() => localStorage.clear());

  it('buildNavitimeParams maps time types', () => {
    const from = { lat: 34.69, lng: 135.76 };
    const to = { lat: 34.7, lng: 135.75 };
    const dep = buildNavitimeParams(from, to, 'departure', '2026-09-20T14:00');
    expect(dep).toMatchObject({ start: '34.69,135.76', goal: '34.7,135.75', start_time: '2026-09-20T14:00:00', limit: '10', datum: 'wgs84', shape: 'true' });
    expect(dep.order).toBeUndefined();
    expect(buildNavitimeParams(from, to, 'departure', '2026-09-20T14:00', 10, 'all', 'fare').order).toBe('fare');
    expect(dep.lang).toBeUndefined();
    expect(dep.bus_data).toBe('timetable');
    expect(dep.unuse).toBeUndefined();
    expect(stripOptionalParams(dep)).toEqual({ start: '34.69,135.76', goal: '34.7,135.75', start_time: '2026-09-20T14:00:00', limit: '10' });
    expect(buildNavitimeParams(from, to, 'departure', '2026-09-20T14:00', 5, 'bus').unuse).toBe(
      'local_train.rapid_train.semiexpress_train.express_train.ultraexpress_train.sleeper_ultraexpress.superexpress_train.domestic_flight.ferry',
    );
    expect(buildNavitimeParams(from, to, 'departure', '2026-09-20T14:00', 5, 'train').unuse).toBe('local_bus.highway_bus.shuttle_bus');
    expect(buildNavitimeParams(from, to, 'departure', '2026-09-20T14:00', 5, 'no_express').unuse).toBe('superexpress_train.ultraexpress_train.sleeper_ultraexpress.domestic_flight');
    expect(stripOptionalParams(buildNavitimeParams(from, to, 'departure', undefined, 5, 'bus')).unuse).toBeDefined();
    expect(buildNavitimeParams(from, to, 'arrival', '2026-09-20T14:00').goal_time).toBe('2026-09-20T14:00:00');
    expect(buildNavitimeParams(from, to, 'first', '2026-09-20T14:00').first_operation).toBe('2026-09-20');
    expect(buildNavitimeParams(from, to, 'last', '2026-09-20T14:00').last_operation).toBe('2026-09-20');
    expect(buildNavitimeParams(from, to, 'departure').start_time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/);
    expect(navitimeUrl(dep)).toContain(`https://${NAVITIME_HOST}/route_transit?start=34.69%2C135.76`);
  });

  it('vehicleFromMove and shapesToPath', () => {
    expect(vehicleFromMove('local_bus')).toBe('BUS');
    expect(vehicleFromMove('superexpress_train')).toBe('TRAIN');
    expect(vehicleFromMove('local_train')).toBe('RAIL');
    expect(vehicleFromMove('domestic_flight')).toBe('OTHER');
    expect(shapesToPath(item().shapes)).toEqual([{ lat: 34.69, lng: 135.76 }, { lat: 34.7, lng: 135.77 }, { lat: 34.71, lng: 135.78 }]);
    expect(shapesToPath(undefined)).toEqual([]);
  });

  it('itemToPlan converts sections, stops, fare and merges walks', () => {
    const p = itemToPlan(item(), 0);
    expect(p.segments.map((s) => s.kind)).toEqual(['walk', 'transit', 'transit', 'walk']);
    expect(p.segments[0]).toMatchObject({ kind: 'walk', durationSec: 300, distanceM: 300 });
    const bus = p.segments[1];
    expect(bus.kind === 'transit' && bus).toMatchObject({
      lineName: '奈良交通バス 学園前駅行',
      lineColor: '#3366CC',
      vehicle: 'BUS',
      headsign: '学園前駅',
      departureStop: '鶴舞',
      arrivalStop: '学園前駅',
      agency: '奈良交通',
      durationSec: 780,
    });
    const train = p.segments[2];
    expect(train.kind === 'transit' && train).toMatchObject({ lineName: '近鉄奈良線', lineColor: '#E60012', vehicle: 'RAIL', vehicleName: '普通', departureStop: '学園前駅', arrivalStop: '近鉄奈良駅' });
    expect(p.segments[3]).toMatchObject({ kind: 'walk', durationSec: 120, distanceM: 100 });
    expect(p.transfers).toBe(1);
    expect(p.durationSec).toBe(33 * 60);
    expect(p.walkSec).toBe(420);
    expect(p.fare).toEqual({ value: 252, currency: 'JPY', text: '¥252' });
    expect(p.departureTime.toISOString()).toBe('2026-09-20T05:02:00.000Z');
    expect(p.overviewPath).toHaveLength(3);
    expect(p.summary).toBe('奈良交通バス 学園前駅行 → 近鉄奈良線');
  });

  it('mergePlans dedupes identical routes and re-assigns ids and badges', () => {
    const a = navitimeToPlans({ items: [item()] });
    const b = navitimeToPlans({ items: [item(), item({ summary: { ...item().summary, move: { ...item().summary.move, from_time: '2026-09-20T14:30:00+09:00', to_time: '2026-09-20T15:00:00+09:00', time: 30, transit_count: 0, fare: { unit_0: 300 } } }, sections: item().sections.slice(0, 5) })] });
    const merged = mergePlans([a, b]);
    expect(merged).toHaveLength(2);
    expect(merged.map((p) => p.id)).toEqual(['nt-0', 'nt-1']);
    expect(merged[0].badges).toContain('cheapest');
    expect(merged[1].badges).toContain('fastest');
  });

  it('navitimeToPlans sorts and assigns badges; empty items yield none', () => {
    // 1 時間後の別の列車（同じ列車は 1 件にまとめられるので、乗車時刻もずらす）
    const shift = (t?: string) => (t ? t.replace('T14:', 'T15:') : t);
    const late = item({
      summary: { ...item().summary, move: { ...item().summary.move, from_time: '2026-09-20T15:00:00+09:00', time: 20, fare: { unit_0: 500 } } },
      sections: item().sections.map((s) => (s.type === 'move' ? { ...s, from_time: shift(s.from_time), to_time: shift(s.to_time) } : s)),
    });
    const plans = navitimeToPlans({ items: [late, item()] });
    expect(plans.map((p) => p.fare?.value)).toEqual([252, 500]);
    expect(plans[1].badges).toContain('fastest');
    expect(plans[0].badges).toContain('cheapest');
    expect(navitimeToPlans({})).toEqual([]);
  });

  it('contractOptionParams names only the option the error mentions', () => {
    expect(contractOptionParams('bad usage on this contract　:　Multilingual')).toEqual(['lang']);
    expect(contractOptionParams('bad usage on this contract : Shape')).toEqual(['shape', 'shape_color']);
    expect(contractOptionParams('bad usage on this contract : Bus Data')).toEqual(['bus_data']);
    expect(contractOptionParams('bad usage on this contract : Unknown')).toBeUndefined();
    expect(contractOptionParams('invalid start_time')).toBeUndefined();
    expect(contractOptionParams(undefined)).toBeUndefined();
    expect(stripOptionalParams({ shape: 'true', lang: 'ja', start: '1,2' }, ['lang'])).toEqual({ shape: 'true', start: '1,2' });
  });

  it('sectionPath joins point coordinates and is used when shapes are missing', () => {
    const coords = [
      { lat: 34.69, lon: 135.76 },
      { lat: 34.69, lon: 135.76 }, // 徒歩 0m で同じ座標が続く → 1 点にまとめる
      { lat: 34.7, lon: 135.77 },
      { lat: 34.71, lon: 135.78 },
      undefined, // 座標なしの地点は飛ばす
    ];
    let i = 0;
    const sections = item().sections.map((s) => (s.type === 'point' ? { ...s, coord: coords[i++] } : s));
    expect(sectionPath(sections)).toEqual([
      { lat: 34.69, lng: 135.76 },
      { lat: 34.7, lng: 135.77 },
      { lat: 34.71, lng: 135.78 },
    ]);
    expect(sectionPath(undefined)).toEqual([]);
    const noShape = itemToPlan({ ...item(), sections, shapes: undefined }, 0);
    expect(noShape.overviewPath).toHaveLength(3);
    // 地点が 1 つしか無ければ線は引けない
    expect(itemToPlan({ ...item(), shapes: undefined }, 0).overviewPath).toBeUndefined();
    expect(noShape.pathDetailed).toBe(false);
    expect(itemToPlan(item(), 0).pathDetailed).toBe(true);
  });

  it('accepts station codes as start/goal', () => {
    const p = buildNavitimeParams('00006589', '00000838', 'departure', '2026-09-26T18:39');
    expect(p.start).toBe('00006589');
    expect(p.goal).toBe('00000838');
    expect(p.start_time).toBe('2026-09-26T18:39:00');
  });

  it('adds express surcharges only for express-type rides, taking one unit by priority', () => {
    // 近鉄特急: 運賃 530 + 特急料金（指定席 unit_128）520 = 1,050。自由席 unit_130 が同時にあっても 128 を採る
    const f = { unit_0: 530, unit_1: 270, unit_48: 530, unit_49: 270, unit_128: 520, unit_130: 320, unit_132: 1000 };
    expect(surchargeOf(f, 'ultraexpress_train')).toBe(520);
    expect(surchargeOf({ unit_0: 530, unit_48: 530, unit_130: 320 }, 'ultraexpress_train')).toBe(320);
    expect(surchargeOf(f, 'superexpress_train')).toBe(520);
    // 急行・快速急行・普通は料金 unit が付いていても足さない
    expect(surchargeOf(f, 'express_train')).toBe(0);
    expect(surchargeOf(f, 'rapid_train')).toBe(0);
    expect(surchargeOf(f, 'local_train')).toBe(0);
    expect(surchargeOf({ unit_0: 530, unit_1: 270, unit_48: 530 }, 'ultraexpress_train')).toBe(0);
    expect(surchargeOf(undefined, 'ultraexpress_train')).toBe(0);

    const express = {
      ...item(),
      summary: { ...item().summary, move: { ...item().summary.move, fare: { unit_0: 560, unit_48: 542 } } },
      sections: item().sections.map((s) =>
        s.type === 'move' && s.move === 'local_train'
          ? { ...s, move: 'ultraexpress_train', transport: { ...s.transport, fare: { unit_0: 260, unit_48: 252, unit_128: 520 } } }
          : s.type === 'move' && s.move === 'local_bus'
            ? { ...s, transport: { ...s.transport, fare: { unit_0: 300, unit_48: 290 } } }
            : s,
      ),
    };
    const plan = itemToPlan(express, 0);
    expect(plan.fare?.value).toBe(542 + 520);
    expect(plan.surcharge).toBe(520);
    expect(plan.fareUnits).toEqual({ unit_0: 560, unit_48: 542 });
    // 区間運賃の合計（290 + 252）が経路の運賃（542）と一致するので区間の運賃も出す
    const rides = plan.segments.filter((x) => x.kind === 'transit');
    expect(rides.map((r) => (r.kind === 'transit' ? r.fare?.value : undefined))).toEqual([290, 252 + 520]);
    expect(rides[1].kind === 'transit' && rides[1].surcharge).toBe(520);
    expect(rides[1].kind === 'transit' && rides[1].fareUnits).toEqual({ unit_0: 260, unit_48: 252, unit_128: 520 });
    // 料金の無い経路は今までどおり
    expect(itemToPlan(item(), 0).surcharge).toBeUndefined();
  });

  it('drops per-ride fares when they do not add up to the route fare (through fares)', () => {
    // 通し運賃: NAVITIME が最初の区間に全額を付け、2 区間目が 0 のようなケース
    const through = {
      ...item(),
      summary: { ...item().summary, move: { ...item().summary.move, fare: { unit_0: 560, unit_48: 542 } } },
      sections: item().sections.map((s) =>
        s.type === 'move' && s.move === 'local_bus'
          ? { ...s, transport: { ...s.transport, fare: { unit_0: 560, unit_48: 542 } } }
          : s.type === 'move' && s.move === 'local_train'
            ? { ...s, transport: { ...s.transport, fare: { unit_0: 260, unit_48: 252 } } }
            : s,
      ),
    };
    const plan = itemToPlan(through, 0);
    expect(plan.fare?.value).toBe(542);
    expect(plan.segments.filter((x) => x.kind === 'transit').every((x) => x.kind === 'transit' && x.fare === undefined)).toBe(true);
  });

  it('records the boarding and alighting station codes', () => {
    const plan = itemToPlan(item(), 0);
    expect(plan.boardNode).toEqual({ id: 'b1', name: '鶴舞' });
    expect(plan.alightNode).toEqual({ id: 's1', name: '学園前駅' });
  });

  it('planKey identifies a plan by its trains, so a trimmed walk does not create a duplicate', () => {
    const a = itemToPlan(item(), 0);
    const b = { ...a, departureTime: new Date(a.departureTime.getTime() + 60_000), walkSec: 0, segments: a.segments.slice(1) };
    expect(planKey(a)).toBe(planKey(b));
    expect(mergePlans([[a], [b]])).toHaveLength(1);
    const other = itemToPlan(
      { ...item(), sections: item().sections.map((s) => (s.type === 'move' && s.move === 'local_bus' ? { ...s, from_time: '2026-09-20T14:17:00+09:00' } : s)) },
      1,
    );
    expect(planKey(other)).not.toBe(planKey(a));
  });

  it('keeps per-ride distance and fare, and the total distance', () => {
    const plan = itemToPlan(item(), 0);
    const rides = plan.segments.filter((s) => s.kind === 'transit');
    expect(rides.map((r) => (r.kind === 'transit' ? r.distanceM : undefined))).toEqual([3000, 2800]);
    expect(plan.distanceM).toBe(6200);
    // 区間の運賃（290 + 252）が経路の運賃（542）と一致するときだけ区間ごとに出す
    const withFare = itemToPlan(
      {
        ...item(),
        summary: { ...item().summary, move: { ...item().summary.move, fare: { unit_0: 560, unit_48: 542 } } },
        sections: item().sections.map((s) =>
          s.type === 'move' && s.move === 'local_bus'
            ? { ...s, transport: { ...s.transport, fare: { unit_0: 300, unit_48: 290 } } }
            : s.type === 'move' && s.move === 'local_train'
              ? { ...s, transport: { ...s.transport, fare: { unit_0: 260, unit_48: 252 } } }
              : s,
        ),
      },
      0,
    );
    const bus = withFare.segments.find((s) => s.kind === 'transit');
    expect(bus?.kind === 'transit' && bus.fare?.value).toBe(290);
  });

  it('builds journey legs so the token can walk and ride along the route', () => {
    const coords = [
      { lat: 34.69, lon: 135.76 },
      { lat: 34.7, lon: 135.77 },
      { lat: 34.71, lon: 135.78 },
      { lat: 34.72, lon: 135.79 },
      { lat: 34.73, lon: 135.8 },
    ];
    let i = 0;
    const sections = item().sections.map((s) => (s.type === 'point' ? { ...s, coord: coords[i++] } : s));
    // 徒歩 → バス → 電車 → 徒歩（連続する徒歩は 1 区間にまとまる）
    expect(legBoundaries(sections)).toHaveLength(3);

    const plan = itemToPlan({ ...item(), sections, shapes: undefined }, 0);
    expect(plan.legs?.map((l) => l.kind)).toEqual(['walk', 'transit', 'transit', 'walk']);
    expect(plan.legs?.[1].label).toBe('奈良交通バス 学園前駅行');
    expect(plan.legs?.[1].vehicle).toBe('BUS');
    expect(plan.legs?.[2].vehicle).toBe('RAIL');
    // 各区間は線が引ける長さがあり、最後は目的地で終わる
    expect(plan.legs?.every((l) => l.path.length >= 2)).toBe(true);
    expect(plan.legs?.[plan.legs.length - 1].path.at(-1)).toEqual({ lat: 34.73, lng: 135.8 });

    // 座標が欠けていても落ちない（時間の比で分ける）
    expect(legBoundaries(item().sections)).toEqual([]);
    expect(legBoundaries(undefined)).toEqual([]);
  });

  it('requestNavitimePlans strips only the named option on a contract error, keeping shape', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(url);
      if (calls.length === 1) {
        return new Response(JSON.stringify({ status_code: 400, message: 'bad usage on this contract　:　Multilingual' }), { status: 400, statusText: 'Bad Request' });
      }
      return new Response(JSON.stringify({ items: [item()] }), { status: 200, statusText: 'OK' });
    });
    const plans = await requestNavitimePlans('KEY', { start: '1,2', goal: '3,4', lang: 'ja', shape: 'true', datum: 'wgs84' }, fetchImpl as unknown as typeof fetch);
    expect(plans).toHaveLength(1);
    expect(calls).toHaveLength(2);
    expect(calls[1]).not.toContain('lang=');
    expect(calls[1]).toContain('shape=true');
    expect(calls[1]).toContain('datum=wgs84');
  });

  it('requestNavitimePlans retries without optional params on a contract error', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(url);
      if (calls.length === 1) {
        return new Response(JSON.stringify({ status_code: 400, message: 'bad usage on this contract　:　Multilingual' }), { status: 400, statusText: 'Bad Request' });
      }
      return new Response(JSON.stringify({ items: [item()] }), { status: 200, statusText: 'OK' });
    });
    const plans = await requestNavitimePlans('KEY', { start: '1,2', goal: '3,4', start_time: '2026-09-20T14:00:00', limit: '5', shape: 'true', datum: 'wgs84' }, fetchImpl as unknown as typeof fetch);
    expect(plans).toHaveLength(1);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('shape=true');
    expect(calls[1]).not.toContain('shape=');
    expect(calls[1]).not.toContain('datum=');
    expect(calls[1]).toContain('start_time=');

    const alwaysBad = vi.fn(async () => new Response(JSON.stringify({ message: 'bad usage on this contract : X' }), { status: 400, statusText: 'Bad Request' }));
    const err = await requestNavitimePlans('KEY', { start: '1,2', goal: '3,4', shape: 'true' }, alwaysBad as unknown as typeof fetch).catch((e: unknown) => e);
    expect((err as NavitimeError).status).toBe('INVALID');
    expect(alwaysBad).toHaveBeenCalledTimes(2);

    const otherBad = vi.fn(async () => new Response(JSON.stringify({ message: 'invalid start_time' }), { status: 400, statusText: 'Bad Request' }));
    await expect(requestNavitimePlans('KEY', { start: '1,2', goal: '3,4', shape: 'true' }, otherBad as unknown as typeof fetch)).rejects.toMatchObject({ status: 'INVALID' });
    expect(otherBad).toHaveBeenCalledTimes(1);
  });

  it('fetchNavitimeRoutes maps HTTP statuses and counts usage', async () => {
    const mk = (status: number, body: unknown = {}) =>
      vi.fn(async () => new Response(JSON.stringify(body), { status, statusText: status === 200 ? 'OK' : 'ERR', headers: { 'content-type': 'application/json' } }));
    const ok = mk(200, { items: [item()] });
    const json = await fetchNavitimeRoutes('KEY', { start: '1,2', goal: '3,4' }, ok as unknown as typeof fetch);
    expect(json.items).toHaveLength(1);
    const call = ok.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toContain(NAVITIME_HOST);
    expect((call[1].headers as Record<string, string>)['x-rapidapi-key']).toBe('KEY');
    expect(readNavitimeUsage().count).toBe(1);

    for (const [status, expected] of [
      [401, 'AUTH'],
      [403, 'AUTH'],
      [429, 'QUOTA'],
      [400, 'INVALID'],
      [500, 'SERVER'],
    ] as const) {
      const err = await fetchNavitimeRoutes('KEY', {}, mk(status, { message: 'x' }) as unknown as typeof fetch).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(NavitimeError);
      expect((err as NavitimeError).status).toBe(expected);
      expect((err as NavitimeError).detail).toContain(`HTTP ${status}`);
    }
    expect(readNavitimeUsage().count).toBe(1);

    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const err = await fetchNavitimeRoutes('KEY', {}, offline as unknown as typeof fetch).catch((e: unknown) => e);
    expect((err as NavitimeError).status).toBe('NETWORK');
  });
});
