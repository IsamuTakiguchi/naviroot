import type { LatLng, PlanSegment, TimeType, TransitPlan, TransitSegment, TransitVehicle, WalkSegment } from '../types';
import { formatFare, toDateTimeLocal } from './format';
import { assignBadges, mergeWalks } from './transit';
import { bumpNavitimeUsage, NAVITIME_HOST } from '../config';

/**
 * NAVITIME Route(totalnavi) API（RapidAPI 経由）のクライアント。
 * 仕様: https://api-sdk.navitime.co.jp/api/specs/api_guide/route_transit.html
 */

export type NavitimeStatus = 'NO_PROVIDER' | 'RESOLVE' | 'AUTH' | 'QUOTA' | 'INVALID' | 'SERVER' | 'NETWORK' | 'ZERO_RESULTS';

export class NavitimeError extends Error {
  constructor(
    public readonly status: NavitimeStatus,
    message: string,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = 'NavitimeError';
  }
}

export const NAVITIME_MESSAGES: Record<NavitimeStatus, string> = {
  NO_PROVIDER: 'アプリ内で乗換案内を表示するには NAVITIME API キーが必要です。キーが無い場合は下のボタンから Google マップ等で検索できます。',
  RESOLVE: '出発地または目的地の位置を特定できませんでした。入力中に出る候補から選び直してください。',
  AUTH: 'NAVITIME API に接続できませんでした。RapidAPI のキーが正しいか、NAVITIME Route(totalnavi) を Subscribe 済みか確認してください。',
  QUOTA: 'NAVITIME API の今月の無料枠（500 回）または 1 分あたりの上限に達しました。下のボタンから Google マップ等で検索できます。',
  INVALID: 'NAVITIME API が検索条件を受け付けませんでした。日時や地点を変えてお試しください。',
  SERVER: 'NAVITIME API でエラーが発生しました。しばらくしてからお試しください。',
  NETWORK: 'NAVITIME API に接続できませんでした。ネットワーク接続を確認してください。',
  ZERO_RESULTS: '該当する経路が見つかりませんでした。日時や地点を変えてお試しください。近距離の場合は徒歩ルートで検索できます。',
};

/** NAVITIME のレスポンスのうち、このアプリが使う部分の型 */
export interface NavitimeFare {
  unit_0?: number;
  unit_48?: number;
  [key: string]: number | undefined;
}

export interface NavitimePoint {
  type: 'point';
  name?: string;
  coord?: { lat: number; lon: number };
  node_id?: string;
  node_types?: string[];
}

export interface NavitimeMove {
  type: 'move';
  move: string;
  line_name?: string;
  from_time?: string;
  to_time?: string;
  time?: number;
  distance?: number;
  transport?: {
    name?: string;
    color?: string;
    type?: string;
    fare?: NavitimeFare;
    company?: { id?: string; name?: string };
    links?: { id?: string; name?: string; direction?: string; destination?: { id?: string; name?: string } }[];
  };
}

export type NavitimeSection = NavitimePoint | NavitimeMove;

export interface NavitimeItem {
  summary: {
    start?: { name?: string; coord?: { lat: number; lon: number } };
    goal?: { name?: string; coord?: { lat: number; lon: number } };
    move: {
      from_time: string;
      to_time: string;
      time: number;
      distance?: number;
      transit_count: number;
      walk_distance?: number;
      fare?: NavitimeFare;
      move_types?: string[];
    };
  };
  sections: NavitimeSection[];
  shapes?: {
    type: 'FeatureCollection';
    features: { type: 'Feature'; geometry: { type: string; coordinates: unknown } }[];
  };
}

export interface NavitimeResponse {
  items?: NavitimeItem[];
  unit?: Record<string, string>;
}

/** ローカル時刻の 'YYYY-MM-DDTHH:mm' → NAVITIME の 'YYYY-MM-DDTHH:mm:ss' */
function toNavitimeTime(local: string | undefined): string {
  const base = local && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(local) ? local.slice(0, 16) : toDateTimeLocal(new Date());
  return `${base}:00`;
}

export function buildNavitimeParams(
  from: LatLng,
  to: LatLng,
  timeType: TimeType,
  time?: string,
  limit = 5,
): Record<string, string> {
  const params: Record<string, string> = {
    start: `${from.lat},${from.lng}`,
    goal: `${to.lat},${to.lng}`,
    limit: String(limit),
    datum: 'wgs84',
    coord_unit: 'degree',
    shape: 'true',
  };
  const t = toNavitimeTime(time);
  const date = t.slice(0, 10);
  switch (timeType) {
    case 'arrival':
      params.goal_time = t;
      break;
    case 'first':
      params.first_operation = date;
      break;
    case 'last':
      params.last_operation = date;
      break;
    default:
      params.start_time = t;
  }
  return params;
}

/**
 * RapidAPI の契約（Basic プラン）に含まれないオプションを付けると
 * 400 "bad usage on this contract : <オプション名>" が返る。再試行時に外す任意パラメータ。
 * （`lang` は Multilingual オプション扱いのため最初から送らない）
 */
export const OPTIONAL_PARAMS = ['shape', 'shape_color', 'datum', 'coord_unit', 'lang', 'options', 'walk_route', 'walk_speed'];

export function stripOptionalParams(params: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) if (!OPTIONAL_PARAMS.includes(k)) out[k] = v;
  return out;
}

export function isContractError(err: unknown): boolean {
  return err instanceof NavitimeError && err.status === 'INVALID' && /contract/i.test(err.detail ?? '');
}

/**
 * 乗換検索を実行して TransitPlan[] を返す。
 * 契約外オプションによる 400 の場合は、任意パラメータを外して 1 回だけ再試行する。
 */
export async function requestNavitimePlans(
  key: string,
  params: Record<string, string>,
  fetchImpl: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<TransitPlan[]> {
  let json: NavitimeResponse;
  try {
    json = await fetchNavitimeRoutes(key, params, fetchImpl);
  } catch (err) {
    const stripped = stripOptionalParams(params);
    if (!isContractError(err) || Object.keys(stripped).length === Object.keys(params).length) throw err;
    json = await fetchNavitimeRoutes(key, stripped, fetchImpl);
  }
  return navitimeToPlans(json, now);
}

export function navitimeUrl(params: Record<string, string>): string {
  return `https://${NAVITIME_HOST}/route_transit?${new URLSearchParams(params).toString()}`;
}

/** RapidAPI 経由で NAVITIME を呼ぶ。HTTP ステータスを NavitimeError に変換する。 */
export async function fetchNavitimeRoutes(
  key: string,
  params: Record<string, string>,
  fetchImpl: typeof fetch = fetch,
): Promise<NavitimeResponse> {
  let res: Response;
  try {
    res = await fetchImpl(navitimeUrl(params), {
      method: 'GET',
      headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': NAVITIME_HOST },
    });
  } catch (err) {
    throw new NavitimeError('NETWORK', NAVITIME_MESSAGES.NETWORK, err instanceof Error ? err.message : String(err));
  }
  const detail = async () => {
    let body = '';
    try {
      body = (await res.text()).slice(0, 300);
    } catch {
      /* ignore */
    }
    return `HTTP ${res.status} ${res.statusText} ${body}`.trim();
  };
  if (res.status === 401 || res.status === 403) throw new NavitimeError('AUTH', NAVITIME_MESSAGES.AUTH, await detail());
  if (res.status === 429) throw new NavitimeError('QUOTA', NAVITIME_MESSAGES.QUOTA, await detail());
  if (res.status === 400 || res.status === 422) throw new NavitimeError('INVALID', NAVITIME_MESSAGES.INVALID, await detail());
  if (!res.ok) throw new NavitimeError('SERVER', NAVITIME_MESSAGES.SERVER, await detail());
  let json: NavitimeResponse;
  try {
    json = (await res.json()) as NavitimeResponse;
  } catch (err) {
    throw new NavitimeError('SERVER', NAVITIME_MESSAGES.SERVER, err instanceof Error ? err.message : String(err));
  }
  bumpNavitimeUsage();
  return json;
}

export function vehicleFromMove(move: string): TransitVehicle {
  if (/bus/.test(move)) return 'BUS';
  if (move === 'superexpress_train') return 'TRAIN';
  if (/train|rail/.test(move)) return 'RAIL';
  return 'OTHER';
}

const MOVE_LABEL: Record<string, string> = {
  local_train: '普通',
  rapid_train: '快速',
  express_train: '急行',
  superexpress_train: '新幹線',
  local_bus: 'バス',
  highway_bus: '高速バス',
  shuttle_bus: 'シャトルバス',
  domestic_flight: '飛行機',
  ferry: 'フェリー',
};

function fareOf(f: NavitimeFare | undefined): TransitPlan['fare'] {
  if (!f) return undefined;
  const v = f.unit_48 ?? f.unit_0;
  if (v == null || !Number.isFinite(v)) return undefined;
  return { value: v, currency: 'JPY', text: formatFare(v, 'JPY') };
}

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

/** shapes（GeoJSON）→ 経路の座標列 */
export function shapesToPath(shapes: NavitimeItem['shapes']): LatLng[] {
  if (!shapes?.features) return [];
  const out: LatLng[] = [];
  const pushLine = (coords: unknown) => {
    if (!Array.isArray(coords)) return;
    for (const c of coords) {
      if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') out.push({ lat: c[1], lng: c[0] });
    }
  };
  for (const f of shapes.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'LineString') pushLine(g.coordinates);
    else if (g.type === 'MultiLineString' && Array.isArray(g.coordinates)) for (const line of g.coordinates) pushLine(line);
  }
  return out;
}

function boundsOf(path: LatLng[]): google.maps.LatLngBounds | undefined {
  const g = (globalThis as { google?: typeof google }).google;
  if (!g?.maps?.LatLngBounds || path.length === 0) return undefined;
  const b = new g.maps.LatLngBounds();
  for (const p of path) b.extend(p);
  return b;
}

export function itemToPlan(item: NavitimeItem, index: number, now: Date = new Date()): TransitPlan {
  const segments: PlanSegment[] = [];
  const sections = item.sections ?? [];
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    if (s.type !== 'move') continue;
    const prev = sections[i - 1];
    const next = sections[i + 1];
    const prevName = prev?.type === 'point' ? (prev.name ?? '') : '';
    const nextName = next?.type === 'point' ? (next.name ?? '') : '';
    const durationSec = Math.round((s.time ?? 0) * 60);
    if (s.move === 'walk') {
      const walk: WalkSegment = { kind: 'walk', durationSec, distanceM: s.distance ?? 0, instruction: '徒歩' };
      segments.push(walk);
      continue;
    }
    const t = s.transport;
    const lineName = s.line_name || t?.name || MOVE_LABEL[s.move] || '路線';
    const seg: TransitSegment = {
      kind: 'transit',
      lineName,
      lineShortName: undefined,
      lineColor: t?.color ? (t.color.startsWith('#') ? t.color : `#${t.color}`) : undefined,
      lineTextColor: undefined,
      vehicle: vehicleFromMove(s.move),
      vehicleName: Array.from(new Set([MOVE_LABEL[s.move], t?.type].filter((x): x is string => !!x))).join(' '),
      headsign: t?.links?.[0]?.destination?.name ?? '',
      agency: t?.company?.name,
      departureStop: prevName,
      arrivalStop: nextName,
      departureTime: parseDate(s.from_time, now),
      arrivalTime: parseDate(s.to_time, now),
      numStops: 0,
      durationSec,
    };
    segments.push(seg);
  }
  const merged = mergeWalks(segments);
  const transit = merged.filter((x): x is TransitSegment => x.kind === 'transit');
  const move = item.summary.move;
  const path = shapesToPath(item.shapes);
  return {
    id: `nt-${index}`,
    departureTime: parseDate(move.from_time, now),
    arrivalTime: parseDate(move.to_time, new Date(now.getTime() + (move.time ?? 0) * 60_000)),
    durationSec: Math.round((move.time ?? 0) * 60),
    transfers: move.transit_count ?? Math.max(0, transit.length - 1),
    fare: fareOf(move.fare),
    walkSec: merged.filter((x) => x.kind === 'walk').reduce((a, x) => a + x.durationSec, 0),
    segments: merged,
    summary: transit.map((x) => x.lineName).join(' → ') || '徒歩',
    bounds: boundsOf(path),
    overviewPath: path.length ? path : undefined,
    badges: [],
  };
}

export function navitimeToPlans(json: NavitimeResponse, now: Date = new Date()): TransitPlan[] {
  const items = json.items ?? [];
  const plans = items.map((it, i) => itemToPlan(it, i, now));
  plans.sort((a, b) => a.departureTime.getTime() - b.departureTime.getTime());
  return assignBadges(plans);
}
