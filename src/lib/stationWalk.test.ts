import { describe, expect, it } from 'vitest';
import { itemToPlan, type NavitimeItem } from './navitime';
import { normalizeStationName, sameStation, trimStationWalks } from './stationWalk';

/** 実機の結果を再現: 近鉄奈良駅 → 徒歩 2分 52m → 近鉄奈良 → 急行 → 大阪難波（近鉄・阪神線）→ 徒歩 6分 346m → 大阪難波駅 */
function kintetsuItem(opts: { headWalk?: [number, number]; tailWalk?: [number, number]; board?: string; alight?: string } = {}): NavitimeItem {
  const [hMin, hM] = opts.headWalk ?? [2, 52];
  const [tMin, tM] = opts.tailWalk ?? [6, 346];
  return {
    summary: {
      move: {
        from_time: '2026-09-23T15:30:00+09:00',
        to_time: '2026-09-23T16:22:00+09:00',
        time: 52,
        distance: 33200,
        transit_count: 0,
        walk_distance: hM + tM,
        fare: { unit_0: 680, unit_48: 680 },
      },
    },
    sections: [
      { type: 'point', name: 'start', coord: { lat: 34.6844, lon: 135.8272 } },
      { type: 'move', move: 'walk', time: hMin, distance: hM },
      { type: 'point', name: opts.board ?? '近鉄奈良', node_id: '00006589', coord: { lat: 34.6848, lon: 135.8264 } },
      {
        type: 'move',
        move: 'local_train',
        line_name: '近鉄奈良線急行',
        from_time: '2026-09-23T15:37:00+09:00',
        to_time: '2026-09-23T16:16:00+09:00',
        time: 39,
        distance: 32800,
        transport: { name: '近鉄奈良線急行', color: 'B5263F', fare: { unit_0: 680, unit_48: 680 }, links: [{ destination: { name: '大阪上本町' } }] },
      },
      { type: 'point', name: opts.alight ?? '大阪難波（近鉄・阪神線）', node_id: '00000838', coord: { lat: 34.6655, lon: 135.4995 } },
      { type: 'move', move: 'walk', time: tMin, distance: tM },
      { type: 'point', name: 'goal', coord: { lat: 34.6641, lon: 135.5012 } },
    ],
  };
}

describe('stationWalk', () => {
  it('normalizes station names from Google and NAVITIME the same way', () => {
    expect(normalizeStationName('近鉄奈良駅')).toBe('近鉄奈良');
    expect(normalizeStationName('近鉄奈良')).toBe('近鉄奈良');
    expect(normalizeStationName('大阪難波（近鉄・阪神線）')).toBe('大阪難波');
    expect(normalizeStationName('大阪難波駅')).toBe('大阪難波');
    expect(normalizeStationName('京都（ＪＲ）')).toBe('京都');
    expect(normalizeStationName('県庁前 停留所')).toBe('県庁前');
    expect(normalizeStationName(undefined)).toBe('');
    expect(sameStation('近鉄奈良駅', '近鉄奈良')).toBe(true);
    expect(sameStation('奈良駅', '近鉄奈良')).toBe(false);
    expect(sameStation('JR難波駅', '大阪難波')).toBe(false);
    expect(sameStation('', '')).toBe(false);
  });

  it('drops the in-station walks when the origin and destination are the stations themselves', () => {
    const raw = itemToPlan(kintetsuItem(), 0);
    expect(raw.segments.map((s) => s.kind)).toEqual(['walk', 'transit', 'walk']);

    const p = trimStationWalks(raw, '近鉄奈良駅', '大阪難波駅');
    expect(p.segments.map((s) => s.kind)).toEqual(['transit']);
    // 駅の発車時刻から始まり、降車時刻で終わる（NAVITIME アプリと同じ）
    expect(p.departureTime.toISOString()).toBe(new Date('2026-09-23T15:37:00+09:00').toISOString());
    expect(p.arrivalTime.toISOString()).toBe(new Date('2026-09-23T16:16:00+09:00').toISOString());
    expect(p.durationSec).toBe(39 * 60);
    expect(p.walkSec).toBe(0);
    expect(p.distanceM).toBe(33200 - 52 - 346);
    // 地図の区間も乗車だけになる
    expect(p.legs?.map((l) => l.kind)).toEqual(['transit']);
    expect(p.overviewPath?.[0]).toEqual({ lat: 34.6848, lng: 135.8264 });
    expect(p.overviewPath?.at(-1)).toEqual({ lat: 34.6655, lng: 135.4995 });
    // 運賃・乗換回数は変わらない
    expect(p.fare?.value).toBe(680);
    expect(p.transfers).toBe(0);
  });

  it('keeps real walks: different station, long walk, or only one end matching', () => {
    const raw = itemToPlan(kintetsuItem(), 0);
    // 「奈良駅」（JR）を指定して近鉄奈良から乗る → 歩く必要がある
    expect(trimStationWalks(raw, '奈良駅', '大阪難波駅').segments.map((s) => s.kind)).toEqual(['walk', 'transit']);
    // 目的地が駅でない場合は到着側の徒歩を残す
    const onlyHead = trimStationWalks(raw, '近鉄奈良駅', '道頓堀');
    expect(onlyHead.segments.map((s) => s.kind)).toEqual(['transit', 'walk']);
    expect(onlyHead.arrivalTime.toISOString()).toBe(raw.arrivalTime.toISOString());
    expect(onlyHead.walkSec).toBe(6 * 60);
    // 名前が同じでも 700m を超える徒歩は本当の移動として残す
    const long = itemToPlan(kintetsuItem({ headWalk: [12, 900] }), 0);
    expect(trimStationWalks(long, '近鉄奈良駅', '大阪難波駅').segments[0].kind).toBe('walk');
    // 何も外さないときは同じオブジェクト
    expect(trimStationWalks(raw, '東大寺', '道頓堀')).toBe(raw);
  });

  it('leaves walking-only plans alone', () => {
    const walkOnly = itemToPlan(
      {
        summary: { move: { from_time: '2026-09-23T15:30:00+09:00', to_time: '2026-09-23T15:40:00+09:00', time: 10, transit_count: 0 } },
        sections: [
          { type: 'point', name: 'start' },
          { type: 'move', move: 'walk', time: 10, distance: 700 },
          { type: 'point', name: 'goal' },
        ],
      },
      0,
    );
    expect(trimStationWalks(walkOnly, '近鉄奈良駅', '奈良公園')).toBe(walkOnly);
  });
});
