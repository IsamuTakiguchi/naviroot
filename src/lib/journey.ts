import type { LatLng, PlanSegment, TransitVehicle } from '../types';
import type { TokenGlyph } from './token';

/** 地図の上をコマが進むときの 1 区間（徒歩 / 乗り物） */
export interface JourneyLeg {
  kind: 'walk' | 'transit';
  vehicle?: TransitVehicle;
  /** 絵柄を直接指定する（車・自転車など、乗換案内以外で使う） */
  glyph?: TokenGlyph;
  /** 区間の色（路線色。無ければ既定色） */
  color?: string;
  /** 区間の名前（「徒歩」「近鉄奈良線」など） */
  label: string;
  path: LatLng[];
  durationSec: number;
}

/** 2 点間の距離のかわりに使う簡易的な長さ（緯度経度の差。見た目の補間用途なので十分） */
function dist(a: LatLng, b: LatLng): number {
  const dx = (a.lng - b.lng) * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const dy = a.lat - b.lat;
  return Math.sqrt(dx * dx + dy * dy);
}

/** 経路の各点までの累積距離 */
export function cumulative(path: LatLng[]): number[] {
  const out = [0];
  for (let i = 1; i < path.length; i++) out.push(out[i - 1] + dist(path[i - 1], path[i]));
  return out;
}

/** 経路上の位置（t = 0..1、距離に比例） */
export function pointAt(path: LatLng[], t: number): LatLng {
  if (path.length === 0) return { lat: 0, lng: 0 };
  if (path.length === 1) return path[0];
  const cum = cumulative(path);
  const total = cum[cum.length - 1];
  if (total === 0) return path[0];
  const target = Math.min(1, Math.max(0, t)) * total;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;
  const span = cum[i] - cum[i - 1];
  const r = span === 0 ? 0 : (target - cum[i - 1]) / span;
  const a = path[i - 1];
  const b = path[i];
  return { lat: a.lat + (b.lat - a.lat) * r, lng: a.lng + (b.lng - a.lng) * r };
}

/** 経路の中で指定地点にいちばん近い点の位置（from 以降だけを見る＝後戻りしない） */
export function nearestIndex(path: LatLng[], p: LatLng, from = 0): number {
  let best = from;
  let bestD = Infinity;
  for (let i = from; i < path.length; i++) {
    const d = dist(path[i], p);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * 区切りの添字を整える。必ず単調増加させ、残りの区間にも最低 1 区間分の点を残す
 * （そうしないと最後の区間が点 1 つになって線が引けない）。
 */
function clampBounds(raw: number[], lastIndex: number, legCount: number): number[] {
  const out = [0];
  for (let i = 0; i < legCount - 1; i++) {
    const prev = out[out.length - 1];
    const maxI = lastIndex - (legCount - 1 - i);
    const v = Math.min(Math.max(raw[i] ?? prev + 1, prev + 1), maxI);
    if (v <= prev) break; // 経路の点が足りない
    out.push(v);
  }
  out.push(lastIndex);
  return out;
}

/**
 * 区間の境目になる地点で経路を分ける。
 * 返すのは経路の添字（0 と最終添字を必ず含み、単調増加）。
 */
export function splitIndices(path: LatLng[], waypoints: LatLng[]): number[] {
  const raw: number[] = [];
  let cursor = 0;
  for (const w of waypoints) {
    const i = nearestIndex(path, w, cursor);
    raw.push(i);
    cursor = Math.max(cursor, i);
  }
  return clampBounds(raw, path.length - 1, waypoints.length + 1);
}

/**
 * 区間（徒歩・乗車）と経路から、コマが進む区間の並びを作る。
 * waypoints は区間の境目の座標（乗換駅など）。数が合わないときは所要時間の比で分ける。
 */
export function buildLegs(path: LatLng[], segments: PlanSegment[], waypoints: LatLng[]): JourneyLeg[] {
  if (path.length < 2 || segments.length === 0) return [];
  const legInfo = segments.map((s) => ({
    kind: s.kind === 'walk' ? ('walk' as const) : ('transit' as const),
    vehicle: s.kind === 'transit' ? s.vehicle : undefined,
    color: s.kind === 'transit' ? s.lineColor : undefined,
    label: s.kind === 'walk' ? '徒歩' : s.lineName,
    durationSec: Math.max(1, s.durationSec),
  }));

  let bounds: number[];
  if (waypoints.length === segments.length - 1) {
    bounds = splitIndices(path, waypoints);
  } else {
    // 境目が分からないときは所要時間の比で経路を分ける
    const total = legInfo.reduce((a, l) => a + l.durationSec, 0);
    const cum = cumulative(path);
    const len = cum[cum.length - 1];
    const raw: number[] = [];
    let acc = 0;
    for (let i = 0; i < legInfo.length - 1; i++) {
      acc += legInfo[i].durationSec;
      const target = len * (acc / total);
      let j = 1;
      while (j < cum.length - 1 && cum[j] < target) j++;
      raw.push(j);
    }
    bounds = clampBounds(raw, path.length - 1, legInfo.length);
  }

  const legs: JourneyLeg[] = [];
  for (let i = 0; i < legInfo.length && i < bounds.length - 1; i++) {
    const slice = path.slice(bounds[i], bounds[i + 1] + 1);
    if (slice.length < 2) continue;
    legs.push({ ...legInfo[i], path: slice });
  }
  return legs;
}

/** コマが全区間を進むのにかける時間 */
export function journeyDuration(legs: JourneyLeg[]): number {
  return Math.min(16000, 4000 + legs.length * 1800);
}

/** 各区間に割り当てる時間（実際の所要時間の比。短すぎる区間は見えるように底上げする） */
export function legTimings(legs: JourneyLeg[], totalMs = journeyDuration(legs)): number[] {
  if (legs.length === 0) return [];
  const min = Math.min(900, totalMs / legs.length);
  const totalSec = legs.reduce((a, l) => a + l.durationSec, 0) || 1;
  const raw = legs.map((l) => Math.max(min, (l.durationSec / totalSec) * totalMs));
  const sum = raw.reduce((a, x) => a + x, 0);
  return raw.map((x) => (x / sum) * totalMs);
}

export interface JourneyFrame {
  index: number;
  leg: JourneyLeg;
  pos: LatLng;
  /** 区間内の進み具合 0..1 */
  t: number;
  done: boolean;
}

/** 経過時間から、いまコマがどの区間のどこにいるかを求める */
export function journeyAt(legs: JourneyLeg[], timings: number[], elapsed: number): JourneyFrame | undefined {
  if (legs.length === 0) return undefined;
  let rest = Math.max(0, elapsed);
  for (let i = 0; i < legs.length; i++) {
    const d = timings[i] ?? 0;
    if (rest < d || i === legs.length - 1) {
      const t = d <= 0 ? 1 : Math.min(1, rest / d);
      return { index: i, leg: legs[i], pos: pointAt(legs[i].path, t), t, done: i === legs.length - 1 && rest >= d };
    }
    rest -= d;
  }
  return undefined;
}
