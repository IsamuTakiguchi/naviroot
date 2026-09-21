import type { LatLng } from '../types';
import { journeyAt, legTimings, type JourneyLeg } from './journey';
import { glyphFor, stepPhase, tokenDataUrl } from './token';

/** 地図上の経路を「描いていく」演出のための計算（DOM に依存しない部分） */

/** 経路を描き切るまでの時間。長い経路ほど少し長くかける（上限あり） */
export function drawDuration(points: number): number {
  if (points <= 1) return 0;
  return Math.min(3600, 1100 + points * 12);
}

/** 流れる破線が一周する時間 */
export const DASH_PERIOD_MS = 3600;

/** ease-out cubic（最初は速く、終わりはゆっくり） */
export function easeOut(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - x, 3);
}

/**
 * 経過時間から「今どこまで描かれているか」の点数を返す。
 * 始点だけでは線にならないので最低 2 点、最後は必ず全点になる。
 */
export function revealCount(elapsed: number, duration: number, total: number): number {
  if (total <= 2 || duration <= 0 || elapsed >= duration) return total;
  const n = Math.round(2 + easeOut(elapsed / duration) * (total - 2));
  return Math.min(total, Math.max(2, n));
}

/** 流れる破線のオフセット（% 表記）。0→100% を繰り返す。 */
export function dashOffset(elapsed: number, period = DASH_PERIOD_MS): string {
  const t = ((elapsed % period) + period) % period;
  return `${((t / period) * 100).toFixed(1)}%`;
}

/** 端末が「視差効果を減らす」設定かどうか */
export function prefersReducedMotion(): boolean {
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

type PolylineCtor = new (opts: google.maps.PolylineOptions) => google.maps.Polyline;

export interface DrawRouteParams {
  Polyline: PolylineCtor;
  map: google.maps.Map;
  path: Array<google.maps.LatLng | LatLng>;
  color: string;
  /** 動きを減らす設定。true なら最初から完成した経路を出す */
  reducedMotion?: boolean;
  raf?: (cb: (now: number) => void) => number;
  cancel?: (id: number) => void;
}

/**
 * 地図上に経路を描く。出発地から目的地へ線が伸び、そのあと白い破線が進行方向へ流れ続ける。
 * 後片付け用の関数を返す。
 */
export function drawRoute(params: DrawRouteParams): () => void {
  const { Polyline, map, path, color, reducedMotion = false } = params;
  const raf = params.raf ?? ((cb) => requestAnimationFrame(cb));
  const cancel = params.cancel ?? ((id) => cancelAnimationFrame(id));

  const casing = new Polyline({ path, map, strokeColor: '#ffffff', strokeOpacity: 0.9, strokeWeight: 10, zIndex: -1 });
  const line = new Polyline({ path, map, strokeColor: color, strokeOpacity: 0.9, strokeWeight: 6 });
  // 進行方向が分かるように、経路の上を白い破線が流れる
  const flow = new Polyline({
    path,
    map,
    strokeOpacity: 0,
    zIndex: 1,
    icons: [
      {
        icon: { path: 'M 0,-1 0,1', strokeColor: '#ffffff', strokeOpacity: 0.95, strokeWeight: 4, scale: 1 },
        offset: '0',
        repeat: '22px',
      },
    ],
  });
  const lines = [casing, line, flow];
  const remove = () => lines.forEach((l) => l.setMap(null));

  if (reducedMotion || path.length < 2) return remove;

  const duration = drawDuration(path.length);
  let frame = 0;
  let start: number | undefined;
  let lastFlow = 0;
  let drawn = false;

  const tick = (now: number) => {
    start ??= now;
    const elapsed = now - start;
    if (!drawn) {
      const partial = elapsed < duration ? path.slice(0, revealCount(elapsed, duration, path.length)) : path;
      lines.forEach((l) => l.setPath(partial));
      drawn = elapsed >= duration;
    }
    // 破線の流れは 20fps 程度で十分（電池への負担を抑える）
    if (now - lastFlow >= 50) {
      lastFlow = now;
      const icons = flow.get('icons') as google.maps.IconSequence[] | undefined;
      if (icons?.[0]) {
        icons[0].offset = dashOffset(elapsed);
        flow.set('icons', icons);
      }
    }
    frame = raf(tick);
  };
  frame = raf(tick);

  return () => {
    cancel(frame);
    remove();
  };
}

/** コマの移動に使う地図 API（テストで差し替えられるよう最小限を受け取る） */
export interface MarkerNs {
  Marker: new (opts: Record<string, unknown>) => {
    setPosition(p: LatLng): void;
    setIcon(icon: unknown): void;
    setTitle(t: string): void;
    setMap(m: unknown): void;
  };
  Size: new (w: number, h: number) => unknown;
  Point: new (x: number, y: number) => unknown;
}

export interface RunJourneyParams {
  maps: MarkerNs;
  map: google.maps.Map;
  legs: JourneyLeg[];
  /** 既定の色（路線色が無い区間で使う） */
  color: string;
  /** 全区間を走り切ったあと、少し止まってから繰り返す */
  loop?: boolean;
  pauseMs?: number;
  raf?: (cb: (now: number) => void) => number;
  cancel?: (id: number) => void;
}

/**
 * 桃鉄のコマのように、経路の上を人／電車／バスが進んでいく。
 * 区間が変わると絵柄も変わり、歩いているときは足が動く。後片付け用の関数を返す。
 */
export function runJourney(params: RunJourneyParams): () => void {
  const { maps, map, legs, color, loop = true, pauseMs = 1400 } = params;
  const raf = params.raf ?? ((cb) => requestAnimationFrame(cb));
  const cancel = params.cancel ?? ((id) => cancelAnimationFrame(id));
  if (legs.length === 0) return () => {};

  const timings = legTimings(legs);
  const total = timings.reduce((a, x) => a + x, 0);
  const cycle = total + (loop ? pauseMs : 0);

  const iconFor = (glyph: ReturnType<typeof glyphFor>, c: string, step: number) => ({
    url: tokenDataUrl(glyph, c, step),
    scaledSize: new maps.Size(48, 48),
    anchor: new maps.Point(24, 34),
  });

  const first = journeyAt(legs, timings, 0)!;
  const firstGlyph = glyphFor(first.leg);
  const marker = new maps.Marker({
    position: first.pos,
    map,
    icon: iconFor(firstGlyph, first.leg.color || color, 0),
    title: first.leg.label,
    zIndex: 20,
    optimized: false,
  });

  let frame = 0;
  let start: number | undefined;
  let shown = `${firstGlyph}|0`;

  const tick = (now: number) => {
    start ??= now;
    const elapsed = loop ? (now - start) % cycle : Math.min(now - start, total);
    const at = journeyAt(legs, timings, elapsed);
    if (at) {
      marker.setPosition(at.pos);
      const glyph = glyphFor(at.leg);
      const step = stepPhase(glyph, elapsed);
      const key = `${glyph}|${step}`;
      // 絵柄が変わったときだけ差し替える（毎フレーム作り直さない）
      if (key !== shown) {
        shown = key;
        marker.setIcon(iconFor(glyph, at.leg.color || color, step));
        marker.setTitle(at.leg.label);
      }
    }
    frame = raf(tick);
  };
  frame = raf(tick);

  return () => {
    cancel(frame);
    marker.setMap(null);
  };
}
