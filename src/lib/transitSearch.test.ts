import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Place, RouteQuery, TransitPlan } from '../types';
import { NavitimeError } from './navitime';
import { getStationNode, learnStationNodes, rememberStationNode } from './stationNodes';
import { resetNodeSupport, searchFromStations } from './transitSearch';

const from: Place & { location: { lat: number; lng: number } } = { name: '学園前駅', location: { lat: 34.7, lng: 135.73 } };
const to: Place & { location: { lat: number; lng: number } } = { name: '大阪難波駅', location: { lat: 34.66, lng: 135.5 } };
const query: RouteQuery = { from, to, mode: 'TRANSIT', timeType: 'departure', time: '2026-09-26T18:39' };

const plan = (board: string, boardId: string, alight: string, alightId: string, dep = 0): TransitPlan => ({
  id: 'p',
  departureTime: new Date(2026, 8, 26, 18, 44 + dep),
  arrivalTime: new Date(2026, 8, 26, 19, 12 + dep),
  durationSec: 28 * 60,
  transfers: 0,
  walkSec: 0,
  summary: '近鉄奈良線',
  badges: [],
  boardNode: { id: boardId, name: board },
  alightNode: { id: alightId, name: alight },
  segments: [],
});

describe('stationNodes', () => {
  beforeEach(() => localStorage.clear());

  it('remembers station codes by normalized name', () => {
    expect(getStationNode('学園前駅')).toBeUndefined();
    rememberStationNode('学園前駅', '00001', '学園前（奈良県）');
    expect(getStationNode('学園前駅')).toBe('00001');
    expect(getStationNode('学園前')).toBe('00001');
    expect(getStationNode('学園前（奈良県）')).toBe('00001');
    expect(getStationNode('近鉄奈良')).toBeUndefined();
    expect(getStationNode('')).toBeUndefined();
  });

  it('learns the codes from plans whose boarding/alighting stop matches the names', () => {
    const plans = [
      plan('学園前（奈良県）', '00001', '大阪難波（近鉄・阪神線）', '00002'),
      plan('学園前（奈良県）', '00001', '大阪難波（近鉄・阪神線）', '00002', 5),
      plan('富雄', '00009', '大阪難波（近鉄・阪神線）', '00002', 10),
    ];
    expect(learnStationNodes(plans, '学園前駅', '大阪難波駅')).toEqual({ from: '00001', to: '00002' });
    // 名前が合わなければ学ばない（本当に歩く必要がある地点）
    expect(learnStationNodes(plans, '奈良公園', '道頓堀')).toEqual({});
    expect(learnStationNodes(plans, undefined, '大阪難波駅')).toEqual({ to: '00002' });
  });
});

describe('searchFromStations', () => {
  beforeEach(() => {
    localStorage.clear();
    resetNodeSupport();
  });

  it('searches by coordinates first, learns the codes, then searches again by station code', async () => {
    const calls: Record<string, string>[] = [];
    const fetch = vi.fn(async (params: Record<string, string>) => {
      calls.push(params);
      return [plan('学園前（奈良県）', '00001', '大阪難波（近鉄・阪神線）', '00002', calls.length)];
    });
    const r = await searchFromStations(from, to, query, fetch);
    expect(calls).toHaveLength(2);
    expect(calls[0].start).toBe('34.7,135.73');
    expect(calls[0].goal).toBe('34.66,135.5');
    expect(calls[1].start).toBe('00001');
    expect(calls[1].goal).toBe('00002');
    expect(calls[1].start_time).toBe('2026-09-26T18:39:00');
    expect(r.calls).toBe(2);
    expect(r.usedNodes).toBe(true);
    expect(r.params.start).toBe('00001');
    // 2 回目の結果を採用する
    expect(r.plans[0].departureTime.getMinutes()).toBe(46);
    // 駅コードを覚えたので、次回は 1 回で済む
    expect(getStationNode('学園前駅')).toBe('00001');
    expect(getStationNode('大阪難波駅')).toBe('00002');

    calls.length = 0;
    const r2 = await searchFromStations(from, to, query, fetch);
    expect(calls).toHaveLength(1);
    expect(calls[0].start).toBe('00001');
    expect(calls[0].goal).toBe('00002');
    expect(r2.calls).toBe(1);
    expect(r2.usedNodes).toBe(true);
  });

  it('keeps the coordinate results when nothing can be learned', async () => {
    const fetch = vi.fn(async () => [plan('富雄', '00009', '日本橋', '00008')]);
    const r = await searchFromStations(from, to, query, fetch);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(r.usedNodes).toBe(false);
    expect(r.calls).toBe(1);
    expect(getStationNode('学園前駅')).toBeUndefined();
  });

  it('falls back to coordinates when the contract rejects station codes', async () => {
    rememberStationNode('学園前駅', '00001');
    rememberStationNode('大阪難波駅', '00002');
    const calls: Record<string, string>[] = [];
    const fetch = vi.fn(async (params: Record<string, string>) => {
      calls.push(params);
      if (params.start === '00001') throw new NavitimeError('INVALID', 'bad', 'invalid start');
      return [plan('学園前（奈良県）', '00001', '大阪難波（近鉄・阪神線）', '00002')];
    });
    const r = await searchFromStations(from, to, query, fetch);
    expect(calls.map((c) => c.start)).toEqual(['00001', '34.7,135.73']);
    expect(r.usedNodes).toBe(false);
    expect(r.calls).toBe(1);
    // 以降は駅コードを試さない
    calls.length = 0;
    await searchFromStations(from, to, query, fetch);
    expect(calls.map((c) => c.start)).toEqual(['34.7,135.73']);
  });

  it('propagates other errors', async () => {
    const fetch = vi.fn(async () => {
      throw new NavitimeError('QUOTA', 'quota');
    });
    await expect(searchFromStations(from, to, query, fetch)).rejects.toMatchObject({ status: 'QUOTA' });
  });
});
