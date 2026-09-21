import { afterEach, describe, expect, it, vi } from 'vitest';
import { dashOffset, drawDuration, drawRoute, easeOut, prefersReducedMotion, revealCount, runJourney } from './routeAnim';
import { buildLegs } from './journey';
import type { PlanSegment } from '../types';

/** google.maps.Polyline の代わり。呼ばれた内容を記録する。 */
class FakePolyline {
  static made: FakePolyline[] = [];
  opts: Record<string, unknown>;
  path: unknown[];
  map: unknown;
  constructor(opts: Record<string, unknown>) {
    this.opts = opts;
    this.path = (opts.path as unknown[]) ?? [];
    this.map = opts.map;
    FakePolyline.made.push(this);
  }
  setPath(p: unknown[]) {
    this.path = p;
  }
  setMap(m: unknown) {
    this.map = m;
  }
  get(k: string) {
    return this.opts[k];
  }
  set(k: string, v: unknown) {
    this.opts[k] = v;
  }
}

/** 手動で進められる requestAnimationFrame */
function fakeClock() {
  let next = 1;
  const pending = new Map<number, (now: number) => void>();
  return {
    raf: (cb: (now: number) => void) => {
      const id = next++;
      pending.set(id, cb);
      return id;
    },
    cancel: (id: number) => pending.delete(id),
    /** 最後に登録されたコールバックを now で呼ぶ */
    step(now: number) {
      const last = [...pending.entries()].pop();
      if (!last) return false;
      pending.delete(last[0]);
      last[1](now);
      return true;
    },
    get pendingCount() {
      return pending.size;
    },
  };
}

describe('routeAnim', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('drawDuration grows with the path but stays bounded', () => {
    expect(drawDuration(0)).toBe(0);
    expect(drawDuration(1)).toBe(0);
    expect(drawDuration(10)).toBe(1220);
    expect(drawDuration(5000)).toBe(3600);
    expect(drawDuration(50)).toBeLessThan(drawDuration(100));
  });

  it('easeOut starts fast and is clamped to 0..1', () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(-5)).toBe(0);
    expect(easeOut(9)).toBe(1);
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
  });

  it('revealCount goes from 2 points to the whole path and never overshoots', () => {
    expect(revealCount(0, 1000, 100)).toBe(2);
    expect(revealCount(1000, 1000, 100)).toBe(100);
    expect(revealCount(5000, 1000, 100)).toBe(100);
    const mid = revealCount(500, 1000, 100);
    expect(mid).toBeGreaterThan(2);
    expect(mid).toBeLessThan(100);
    // 進むほど点が増える（後戻りしない）
    expect(revealCount(700, 1000, 100)).toBeGreaterThanOrEqual(mid);
    // 2 点以下の経路や時間 0 のときはそのまま全部
    expect(revealCount(0, 1000, 2)).toBe(2);
    expect(revealCount(0, 0, 40)).toBe(40);
  });

  it('dashOffset cycles through 0..100%', () => {
    expect(dashOffset(0, 1000)).toBe('0.0%');
    expect(dashOffset(500, 1000)).toBe('50.0%');
    expect(dashOffset(1000, 1000)).toBe('0.0%');
    expect(dashOffset(1500, 1000)).toBe('50.0%');
  });

  it('drawRoute grows the line from the start to the whole path, then flows the dashes', () => {
    FakePolyline.made = [];
    const clock = fakeClock();
    const path = Array.from({ length: 60 }, (_, i) => ({ lat: 34 + i * 0.01, lng: 135 + i * 0.01 }));
    const map = {} as google.maps.Map;
    const cleanup = drawRoute({
      Polyline: FakePolyline as unknown as new (o: google.maps.PolylineOptions) => google.maps.Polyline,
      map,
      path,
      color: '#14a34e',
      raf: clock.raf,
      cancel: clock.cancel,
    });

    // 白い縁取り / 本体 / 流れる破線 の 3 本
    const [casing, line, flow] = FakePolyline.made;
    expect(FakePolyline.made).toHaveLength(3);
    expect(casing.opts.strokeColor).toBe('#ffffff');
    expect(line.opts.strokeColor).toBe('#14a34e');
    expect(flow.opts.strokeOpacity).toBe(0);

    const duration = drawDuration(path.length);
    clock.step(1000); // 開始時刻
    expect(line.path).toHaveLength(2);

    clock.step(1000 + duration / 2);
    const mid = line.path.length;
    expect(mid).toBeGreaterThan(2);
    expect(mid).toBeLessThan(path.length);
    expect(casing.path).toHaveLength(mid);
    expect(flow.path).toHaveLength(mid);

    clock.step(1000 + duration + 10);
    expect(line.path).toHaveLength(path.length);

    // 描き終わったあとも破線のオフセットだけ動き続ける
    const before = (flow.opts.icons as google.maps.IconSequence[])[0].offset;
    clock.step(1000 + duration + 500);
    expect((flow.opts.icons as google.maps.IconSequence[])[0].offset).not.toBe(before);
    expect(line.path).toHaveLength(path.length);

    // 後片付けで 3 本とも地図から外れ、次のフレームも止まる
    cleanup();
    expect([casing.map, line.map, flow.map]).toEqual([null, null, null]);
    expect(clock.pendingCount).toBe(0);
  });

  it('drawRoute skips the animation when motion is reduced or the path is too short', () => {
    FakePolyline.made = [];
    const clock = fakeClock();
    const path = Array.from({ length: 40 }, (_, i) => ({ lat: 34 + i * 0.01, lng: 135 }));
    const Polyline = FakePolyline as unknown as new (o: google.maps.PolylineOptions) => google.maps.Polyline;
    const map = {} as google.maps.Map;

    const cleanup = drawRoute({ Polyline, map, path, color: '#14a34e', reducedMotion: true, raf: clock.raf, cancel: clock.cancel });
    expect(clock.pendingCount).toBe(0); // アニメーションを始めない
    expect(FakePolyline.made[1].path).toHaveLength(path.length); // 最初から全部描かれている
    cleanup();
    expect(FakePolyline.made.every((l) => l.map === null)).toBe(true);

    FakePolyline.made = [];
    drawRoute({ Polyline, map, path: [path[0]], color: '#14a34e', raf: clock.raf, cancel: clock.cancel });
    expect(clock.pendingCount).toBe(0);
  });

  it('runJourney moves a token along the legs and swaps the icon per mode', () => {
    const clock = fakeClock();
    const path = Array.from({ length: 20 }, (_, i) => ({ lat: 34, lng: 135 + i * 0.01 }));
    const walk: PlanSegment = { kind: 'walk', durationSec: 300, distanceM: 400, instruction: '徒歩' };
    const ride: PlanSegment = {
      kind: 'transit', lineName: '近鉄奈良線', vehicle: 'BUS', vehicleName: 'バス', headsign: '行',
      departureStop: 'A', arrivalStop: 'B', departureTime: new Date(0), arrivalTime: new Date(1), numStops: 3, durationSec: 1800,
    };
    const legs = buildLegs(path, [walk, ride], [{ lat: 34, lng: 135.05 }]);
    expect(legs).toHaveLength(2);

    const calls: { position?: unknown; icon?: string; title?: string; map?: unknown } = {};
    const positions: Array<{ lat: number; lng: number }> = [];
    const icons: string[] = [];
    class FakeMarker {
      constructor(opts: Record<string, unknown>) {
        calls.position = opts.position;
        icons.push(((opts.icon as { url: string }).url ?? '').slice(0, 60));
        calls.title = opts.title as string;
      }
      setPosition(p: { lat: number; lng: number }) { positions.push(p); }
      setIcon(i: { url: string }) { icons.push(i.url.slice(0, 60)); }
      setTitle(t: string) { calls.title = t; }
      setMap(m: unknown) { calls.map = m; }
    }
    const maps = {
      Marker: FakeMarker as unknown as never,
      Size: class { constructor(public w: number, public h: number) {} } as unknown as never,
      Point: class { constructor(public x: number, public y: number) {} } as unknown as never,
    };

    const stop = runJourney({
      maps, map: {} as google.maps.Map, legs, color: '#14a34e', raf: clock.raf, cancel: clock.cancel,
    });

    // 出発地から始まり、徒歩の絵柄
    expect(calls.position).toEqual(path[0]);
    expect(calls.title).toBe('徒歩');

    for (const t of [0, 400, 1200, 2400, 4000, 6000, 8000]) clock.step(1000 + t);
    expect(positions.length).toBeGreaterThan(3);
    // 前に進んでいる
    expect(positions[positions.length - 1].lng).toBeGreaterThan(positions[0].lng);
    // 区間が変わって乗り物の絵柄に差し替わった
    expect(calls.title).toBe('近鉄奈良線');
    expect(icons.length).toBeGreaterThan(1);

    stop();
    expect(calls.map).toBe(null);
    expect(clock.pendingCount).toBe(0);
  });

  it('runJourney does nothing without legs', () => {
    const clock = fakeClock();
    const stop = runJourney({
      maps: { Marker: class {} as never, Size: class {} as never, Point: class {} as never },
      map: {} as google.maps.Map, legs: [], color: '#14a34e', raf: clock.raf, cancel: clock.cancel,
    });
    expect(clock.pendingCount).toBe(0);
    expect(() => stop()).not.toThrow();
  });

  it('prefersReducedMotion reads the media query and tolerates its absence', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }));
    expect(prefersReducedMotion()).toBe(true);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(prefersReducedMotion()).toBe(false);
    vi.stubGlobal('matchMedia', undefined);
    expect(prefersReducedMotion()).toBe(false);
    vi.stubGlobal('matchMedia', () => {
      throw new Error('nope');
    });
    expect(prefersReducedMotion()).toBe(false);
  });
});
