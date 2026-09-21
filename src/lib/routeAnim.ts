import type { LatLng } from '../types';

/** 地図上の経路を「描いていく」演出のための計算（DOM に依存しない部分） */

/** 経路を描き切るまでの時間。長い経路ほど少し長くかける（上限あり） */
export function drawDuration(points: number): number {
  if (points <= 1) return 0;
  return Math.min(1600, 500 + points * 6);
}

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
export function dashOffset(elapsed: number, period = 1600): string {
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
