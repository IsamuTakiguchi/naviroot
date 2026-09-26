import type { LatLng, PlanSegment, TimeType, TransitFilter, TransitPlan, TransitSegment, TransitVehicle, WalkSegment } from '../types';
import { formatFare, toDateTimeLocal } from './format';
import { assignBadges, mergeWalks } from './transit';
import { buildLegs } from './journey';
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

const TRAIN_TYPES = [
  'local_train',
  'rapid_train',
  'semiexpress_train',
  'express_train',
  'ultraexpress_train',
  'sleeper_ultraexpress',
  'superexpress_train',
];
const BUS_TYPES = ['local_bus', 'highway_bus', 'shuttle_bus'];
const EXPRESS_TYPES = ['superexpress_train', 'ultraexpress_train', 'sleeper_ultraexpress', 'domestic_flight'];

/** 絞り込み → NAVITIME の unuse（使わない交通手段）パラメータ */
export const UNUSE_BY_FILTER: Record<TransitFilter, string[]> = {
  all: [],
  bus: [...TRAIN_TYPES, 'domestic_flight', 'ferry'],
  train: [...BUS_TYPES],
  no_express: EXPRESS_TYPES,
};

export const FILTER_LABEL: Record<TransitFilter, string> = {
  all: '電車・バス',
  bus: 'バスのみ',
  train: '電車のみ',
  no_express: '新幹線・特急なし',
};

/** 候補の並び順（NAVITIME の order パラメータ） */
export type NavitimeOrder = 'time_optimized' | 'fare' | 'transit' | 'walk_distance' | 'total_distance';

/** 「別の経路も探す」で追加取得する並び順 */
export const EXTRA_ORDERS: NavitimeOrder[] = ['fare', 'transit', 'walk_distance'];

/** 1 回の検索で取得する候補数（NAVITIME の上限） */
export const NAVITIME_LIMIT = 10;

/** 地点の指定: 緯度経度、または NAVITIME の駅コード（ノード ID。例 '00006589'） */
export type NavitimeLocation = LatLng | string;

export function locationParam(loc: NavitimeLocation): string {
  return typeof loc === 'string' ? loc : `${loc.lat},${loc.lng}`;
}

/** パラメータが駅コード（ノード ID）で指定されているか */
export function isNodeParam(value: string | undefined): boolean {
  return !!value && !value.includes(',');
}

export function buildNavitimeParams(
  from: NavitimeLocation,
  to: NavitimeLocation,
  timeType: TimeType,
  time?: string,
  limit = NAVITIME_LIMIT,
  filter: TransitFilter = 'all',
  order?: NavitimeOrder,
): Record<string, string> {
  const params: Record<string, string> = {
    start: locationParam(from),
    goal: locationParam(to),
    limit: String(limit),
    datum: 'wgs84',
    coord_unit: 'degree',
    shape: 'true',
    // 路線バスを時刻表ベースで探索に含める
    bus_data: 'timetable',
  };
  const unuse = UNUSE_BY_FILTER[filter] ?? [];
  if (unuse.length) params.unuse = unuse.join('.');
  if (order) params.order = order;
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
export const OPTIONAL_PARAMS = ['shape', 'shape_color', 'datum', 'coord_unit', 'lang', 'options', 'walk_route', 'walk_speed', 'bus_data'];

/** エラーが名指しするオプション名 → 外すべきパラメータ */
const OPTION_PARAMS: Record<string, string[]> = {
  multilingual: ['lang'],
  language: ['lang'],
  shape: ['shape', 'shape_color'],
  routeshape: ['shape', 'shape_color'],
  busdata: ['bus_data'],
  bus: ['bus_data'],
  bustimetable: ['bus_data'],
  datum: ['datum'],
  coordunit: ['coord_unit'],
  order: ['order'],
  unuse: ['unuse'],
  walkroute: ['walk_route'],
  walkspeed: ['walk_speed'],
  options: ['options'],
};

/** 'bad usage on this contract : Multilingual' のような文言からオプション名を取り出す */
export function contractOptionParams(detail: string | undefined): string[] | undefined {
  if (!detail) return undefined;
  const m = /contract[^:：]*[:：]\s*([A-Za-z_ ]+)/.exec(detail);
  if (!m) return undefined;
  const key = m[1].replace(/[\s_]/g, '').toLowerCase();
  return OPTION_PARAMS[key];
}

export function stripOptionalParams(params: Record<string, string>, only?: string[]): Record<string, string> {
  const remove = only ?? OPTIONAL_PARAMS;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) if (!remove.includes(k)) out[k] = v;
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
    if (!isContractError(err)) throw err;
    // まずエラーが名指しするオプションだけを外し（経路形状などを不必要に失わないため）、
    // それでも契約外と言われたら任意パラメータをすべて外して最後の試行をする
    const named = contractOptionParams(err instanceof NavitimeError ? err.detail : undefined);
    const attempts: Record<string, string>[] = [];
    for (const candidate of [stripOptionalParams(params, named), stripOptionalParams(params)]) {
      const prev = attempts[attempts.length - 1] ?? params;
      if (Object.keys(candidate).length < Object.keys(prev).length) attempts.push(candidate);
    }
    if (attempts.length === 0) throw err;
    let result: NavitimeResponse | undefined;
    for (let i = 0; i < attempts.length; i++) {
      try {
        result = await fetchNavitimeRoutes(key, attempts[i], fetchImpl);
        break;
      } catch (retryErr) {
        if (!isContractError(retryErr) || i === attempts.length - 1) throw retryErr;
      }
    }
    json = result as NavitimeResponse;
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

/** 運賃（IC があれば IC、無ければきっぷ） */
function baseFare(f: NavitimeFare | undefined): number | undefined {
  if (!f) return undefined;
  const v = f.unit_48 ?? f.unit_0;
  return v != null && Number.isFinite(v) ? v : undefined;
}

/** 追加料金（特急料金など）が要る移動の種別。急行・快速などは運賃だけ */
export const SURCHARGE_MOVES = new Set(['ultraexpress_train', 'superexpress_train', 'sleeper_ultraexpress', 'domestic_flight']);

/**
 * 追加料金として採る unit の優先順位（大人）。
 * 128: 特急料金（指定席・通常期）, 130: 特急料金（自由席）, 134 / 136: 期別の指定席料金。
 * 複数あっても 1 つだけ採り、グリーン・寝台などは足さない。
 */
const SURCHARGE_UNIT_ORDER = ['unit_128', 'unit_130', 'unit_134', 'unit_136'];

/**
 * 特急料金などの追加料金。NAVITIME アプリの「有料」ルートは運賃にこれを足して表示する。
 * 追加料金が要る種別の移動でだけ、決まった unit を 1 つ採る（応答の unit は単位表で、料金の名前表ではない）。
 */
export function surchargeOf(f: NavitimeFare | undefined, move: string | undefined): number {
  if (!f || !move || !SURCHARGE_MOVES.has(move)) return 0;
  for (const k of SURCHARGE_UNIT_ORDER) {
    const v = f[k];
    if (typeof v === 'number' && v > 0) return v;
  }
  return 0;
}

/** 料金の生データ（数値の unit だけ）。内訳表示・診断用 */
export function fareUnitsOf(f: NavitimeFare | undefined): Record<string, number> | undefined {
  if (!f) return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(f)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  return Object.keys(out).length ? out : undefined;
}

function fareOf(f: NavitimeFare | undefined, surcharge = 0): TransitPlan['fare'] {
  const base = baseFare(f);
  if (base == null) return undefined;
  const v = base + surcharge;
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

export function boundsOf(path: LatLng[]): google.maps.LatLngBounds | undefined {
  const g = (globalThis as { google?: typeof google }).google;
  if (!g?.maps?.LatLngBounds || path.length === 0) return undefined;
  const b = new g.maps.LatLngBounds();
  for (const p of path) b.extend(p);
  return b;
}

/** shapes が無いとき用: sections の地点座標を順につないだ簡易経路 */
export function sectionPath(sections: NavitimeSection[] | undefined): LatLng[] {
  const out: LatLng[] = [];
  for (const s of sections ?? []) {
    if (s.type !== 'point') continue;
    const c = s.coord;
    if (!c || typeof c.lat !== 'number' || typeof c.lon !== 'number') continue;
    const last = out[out.length - 1];
    if (last && last.lat === c.lat && last.lng === c.lon) continue;
    out.push({ lat: c.lat, lng: c.lon });
  }
  return out;
}

/**
 * 移動区間の境目（乗換地点など）の座標。mergeWalks と同じく、連続する徒歩は 1 区間として扱う。
 * 途中の座標が欠けている場合は空を返し、呼び出し側で所要時間の比による分割に任せる。
 */
export function legBoundaries(sections: NavitimeSection[] | undefined): LatLng[] {
  const out: LatLng[] = [];
  let prevKind: 'walk' | 'transit' | undefined;
  let pending: LatLng | undefined;
  for (const s of sections ?? []) {
    if (s.type === 'point') {
      const c = s.coord;
      pending = c && typeof c.lat === 'number' && typeof c.lon === 'number' ? { lat: c.lat, lng: c.lon } : undefined;
      continue;
    }
    if (s.type !== 'move') continue;
    const kind: 'walk' | 'transit' = s.move === 'walk' ? 'walk' : 'transit';
    if (prevKind !== undefined && !(prevKind === 'walk' && kind === 'walk')) {
      if (!pending) return [];
      out.push(pending);
    }
    prevKind = kind;
  }
  return out;
}

export function itemToPlan(item: NavitimeItem, index: number, now: Date = new Date()): TransitPlan {
  const segments: PlanSegment[] = [];
  const sections = item.sections ?? [];
  let boardNode: TransitPlan['boardNode'];
  let alightNode: TransitPlan['alightNode'];
  let surchargeTotal = 0;
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    if (s.type !== 'move') continue;
    const prev = sections[i - 1];
    const next = sections[i + 1];
    const prevName = prev?.type === 'point' ? (prev.name ?? '') : '';
    const nextName = next?.type === 'point' ? (next.name ?? '') : '';
    if (s.move !== 'walk') {
      // 最初に乗る駅と最後に降りる駅のノードを控える（駅コードでの再検索用）
      if (!boardNode && prev?.type === 'point' && prev.node_id && prevName) boardNode = { id: prev.node_id, name: prevName };
      if (next?.type === 'point' && next.node_id && nextName) alightNode = { id: next.node_id, name: nextName };
    }
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
      distanceM: s.distance,
    };
    const surcharge = surchargeOf(t?.fare, s.move);
    if (surcharge > 0) {
      seg.surcharge = surcharge;
      surchargeTotal += surcharge;
    }
    seg.fare = fareOf(t?.fare, surcharge);
    seg.fareUnits = fareUnitsOf(t?.fare);
    segments.push(seg);
  }
  const merged = mergeWalks(segments);
  const transit = merged.filter((x): x is TransitSegment => x.kind === 'transit');
  const move = item.summary.move;
  // 区間ごとの運賃は、足し合わせて経路の運賃と一致するときだけ出す
  //（NAVITIME は通し運賃を最初の区間にまとめることがあり、その場合は区間の額が実態と合わない）
  const planBase = baseFare(move.fare);
  const segBases = transit.map((x) => (x.fare ? x.fare.value - (x.surcharge ?? 0) : undefined));
  const consistent =
    planBase != null && segBases.every((b) => b != null) && segBases.reduce((a, b) => a + (b ?? 0), 0) === planBase;
  if (!consistent) for (const x of transit) delete x.fare;
  const shape = shapesToPath(item.shapes);
  // 形状データが無い契約でも地図に線を引けるよう、地点座標をつないだ簡易経路で代用する
  const path = shape.length > 1 ? shape : sectionPath(item.sections);
  return {
    id: `nt-${index}`,
    departureTime: parseDate(move.from_time, now),
    arrivalTime: parseDate(move.to_time, new Date(now.getTime() + (move.time ?? 0) * 60_000)),
    durationSec: Math.round((move.time ?? 0) * 60),
    transfers: move.transit_count ?? Math.max(0, transit.length - 1),
    fare: fareOf(move.fare, surchargeTotal),
    surcharge: surchargeTotal > 0 ? surchargeTotal : undefined,
    fareUnits: fareUnitsOf(move.fare),
    walkSec: merged.filter((x) => x.kind === 'walk').reduce((a, x) => a + x.durationSec, 0),
    distanceM: move.distance,
    boardNode,
    alightNode,
    segments: merged,
    summary: transit.map((x) => x.lineName).join(' → ') || '徒歩',
    bounds: boundsOf(path),
    overviewPath: path.length > 1 ? path : undefined,
    pathDetailed: shape.length > 1,
    legs: buildLegs(path, merged, legBoundaries(item.sections)),
    badges: [],
  };
}

/**
 * 同じ経路かどうかの判定キー。乗る列車（路線・乗車駅・発時刻）と最後の降車時刻で見る。
 * 駅までの徒歩の有無や出発時刻の取り方が違っても、同じ列車なら同じ候補として扱う。
 */
export function planKey(p: TransitPlan): string {
  const rides = p.segments.filter((s): s is TransitSegment => s.kind === 'transit');
  if (rides.length === 0) return `walk|${p.departureTime.getTime()}|${p.arrivalTime.getTime()}|${p.summary}`;
  const trains = rides.map((r) => `${r.departureTime.getTime()}|${r.departureStop}|${r.lineName}`).join('>');
  return `${trains}|${rides[rides.length - 1].arrivalTime.getTime()}`;
}

/** 同じ経路（出発・到着・路線構成が同じ）を除き、出発時刻順に並べてバッジを付け直す */
export function mergePlans(lists: TransitPlan[][]): TransitPlan[] {
  const seen = new Set<string>();
  const out: TransitPlan[] = [];
  for (const list of lists) {
    for (const p of list) {
      const k = planKey(p);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(p);
    }
  }
  out.sort((a, b) => a.departureTime.getTime() - b.departureTime.getTime() || a.durationSec - b.durationSec);
  return assignBadges(out.map((p, i) => ({ ...p, id: `nt-${i}` })));
}

export function navitimeToPlans(json: NavitimeResponse, now: Date = new Date()): TransitPlan[] {
  const items = json.items ?? [];
  return mergePlans([items.map((it, i) => itemToPlan(it, i, now))]);
}
