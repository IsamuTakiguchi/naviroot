import type { LatLng, MapRoute, Place, RouteQuery, RouteStep, TravelMode } from '../types';
import { stripHtml } from './format';
import type { RouteLike } from './transit';

export class DirectionsError extends Error {
  constructor(
    public readonly status: string,
    message: string,
    /** 生のエラー情報（name / code / endpoint / message）。画面の「詳細」に表示する */
    public readonly detail?: string,
  ) {
    super(message);
    this.name = 'DirectionsError';
  }
}

/** 例外オブジェクトから人間が読める詳細文字列を作る */
export function describeError(err: unknown): string {
  if (err instanceof Error) {
    const e = err as Error & { code?: unknown; endpoint?: unknown };
    return [e.name, e.code != null ? `code=${String(e.code)}` : '', e.endpoint != null ? `endpoint=${String(e.endpoint)}` : '', e.message]
      .filter(Boolean)
      .join(' ');
  }
  if (typeof err === 'object' && err) {
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

const STATUS_MESSAGES: Record<string, string> = {
  ZERO_RESULTS: '経路が見つかりませんでした。出発地・目的地や移動手段、日時を変えてお試しください。',
  NOT_FOUND: '出発地または目的地を特定できませんでした。候補から選ぶか、駅名・住所を確認してください。',
  INVALID_REQUEST:
    '検索条件が受け付けられませんでした。出発地・目的地を候補から選び直すか、日時（過去や 7 日以上前は指定できません）を確認してください。',
  OVER_QUERY_LIMIT: 'API の利用上限に達しました。しばらくしてからお試しください。',
  REQUEST_DENIED:
    '経路検索が拒否されました。Google Cloud Console の「API とサービス → ライブラリ」で Routes API を有効化し、API キーの「API の制限」で Routes API が許可されているか確認してください。',
  UNKNOWN_ERROR: 'Google 側でエラーが発生しました。しばらくしてからもう一度お試しください（下の「詳細」に原因が表示されます）。',
};

export function messageForStatus(status: string, mode?: TravelMode): string {
  if (status === 'ZERO_RESULTS' && mode === 'BICYCLING') {
    return '自転車ルートはこの地域では提供されていません。徒歩ルートをお試しください。';
  }
  return STATUS_MESSAGES[status] ?? `経路検索に失敗しました (${status})`;
}

/** Routes API の例外（MapsRequestError など）から状態コードを推定する */
export function statusFromError(err: unknown): string {
  if (typeof err !== 'object' || !err) return 'UNKNOWN_ERROR';
  const e = err as { code?: unknown; name?: unknown; message?: unknown };
  const raw = `${String(e.code ?? '')} ${String(e.name ?? '')} ${String(e.message ?? '')}`;
  if (/NOT_FOUND/i.test(raw)) return 'NOT_FOUND';
  if (/INVALID_ARGUMENT|INVALID_REQUEST|FAILED_PRECONDITION|OUT_OF_RANGE/i.test(raw)) return 'INVALID_REQUEST';
  if (
    /PERMISSION_DENIED|REQUEST_DENIED|UNAUTHENTICATED|API_KEY|apiNotActivated|not authorized|denied|disabled|has not been used|not enabled|SERVICE_DISABLED/i.test(
      raw,
    )
  )
    return 'REQUEST_DENIED';
  if (/RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT|quota/i.test(raw)) return 'OVER_QUERY_LIMIT';
  if (/ZERO_RESULTS/i.test(raw)) return 'ZERO_RESULTS';
  return 'UNKNOWN_ERROR';
}

type RouteLocation = google.maps.routes.ComputeRoutesRequest['origin'];

/** 場所 → Routes API の origin/destination。座標があれば座標、無ければ placeId、最後に文字列。 */
export function placeToLocation(p: Place): RouteLocation {
  if (p.location) return { lat: p.location.lat, lng: p.location.lng };
  const PlaceCtor = (globalThis as { google?: typeof google }).google?.maps?.places?.Place;
  if (p.placeId && PlaceCtor) return new PlaceCtor({ id: p.placeId });
  return p.name;
}

/** 「始発」「終電」の基準時刻: その日の 04:00 出発 / 翌日 01:30 到着 */
export function resolveTimeOption(query: RouteQuery): { departureTime?: Date; arrivalTime?: Date } {
  const base = query.time ? new Date(query.time) : new Date();
  if (Number.isNaN(base.getTime())) return { departureTime: new Date() };
  switch (query.timeType) {
    case 'arrival':
      return { arrivalTime: base };
    case 'first': {
      const d = new Date(base);
      d.setHours(4, 0, 0, 0);
      return { departureTime: d };
    }
    case 'last': {
      const d = new Date(base);
      d.setDate(d.getDate() + 1);
      d.setHours(1, 30, 0, 0);
      return { arrivalTime: d };
    }
    default:
      return { departureTime: base };
  }
}

export const ROUTE_FIELDS = ['legs', 'path', 'viewport', 'durationMillis', 'distanceMeters', 'localizedValues', 'travelAdvisory', 'routeLabels'];

/** 公式の transit 例と同じ一覧（TRAM は Routes API では指定不可） */
export const TRANSIT_MODES: google.maps.TransitModeString[] = ['BUS', 'SUBWAY', 'TRAIN', 'LIGHT_RAIL', 'RAIL'];

export function buildRequest(query: RouteQuery, opts?: { alternatives?: boolean }): google.maps.routes.ComputeRoutesRequest {
  const req: google.maps.routes.ComputeRoutesRequest = {
    origin: placeToLocation(query.from),
    destination: placeToLocation(query.to),
    travelMode: query.mode,
    computeAlternativeRoutes: opts?.alternatives ?? true,
    language: 'ja',
    region: 'jp',
    fields: ROUTE_FIELDS,
  };
  if (query.mode === 'TRANSIT') {
    const t = resolveTimeOption(query);
    if (t.arrivalTime) req.arrivalTime = t.arrivalTime;
    else if (t.departureTime) {
      // 過去時刻は API がエラーにするため、現在より前なら現在時刻に丸める
      req.departureTime = t.departureTime.getTime() < Date.now() ? new Date() : t.departureTime;
    }
    req.transitPreference = { allowedTransitModes: TRANSIT_MODES, routingPreference: 'FEWER_TRANSFERS' };
  }
  return req;
}

type RouteClass = Pick<typeof google.maps.routes.Route, 'computeRoutes'>;

/** INVALID_ARGUMENT 時の再試行用: フィールドを '*' にし、乗り物の絞り込みを外す */
export function relaxRequest(request: google.maps.routes.ComputeRoutesRequest): google.maps.routes.ComputeRoutesRequest {
  const relaxed: google.maps.routes.ComputeRoutesRequest = { ...request, fields: ['*'] };
  if (request.transitPreference) {
    const { routingPreference } = request.transitPreference;
    relaxed.transitPreference = routingPreference ? { routingPreference } : undefined;
  }
  return relaxed;
}

/** Route.computeRoutes を呼び、結果が空ならエラーにする。INVALID_ARGUMENT の場合は条件を緩めて 1 回だけ再試行する。 */
export async function requestRoutes(
  RouteCls: RouteClass,
  request: google.maps.routes.ComputeRoutesRequest,
): Promise<google.maps.routes.Route[]> {
  const mode = request.travelMode as TravelMode | undefined;
  const attempt = async (req: google.maps.routes.ComputeRoutesRequest) => {
    try {
      return await RouteCls.computeRoutes(req);
    } catch (err) {
      console.error('[naviroot] Routes API error', err);
      const status = statusFromError(err);
      throw new DirectionsError(status, messageForStatus(status, mode), describeError(err));
    }
  };
  let result: Awaited<ReturnType<RouteClass['computeRoutes']>>;
  try {
    result = await attempt(request);
  } catch (err) {
    if (err instanceof DirectionsError && err.status === 'INVALID_REQUEST') {
      result = await attempt(relaxRequest(request));
    } else {
      throw err;
    }
  }
  const routes = result.routes ?? [];
  if (routes.length === 0) throw new DirectionsError('ZERO_RESULTS', messageForStatus('ZERO_RESULTS', mode));
  return routes;
}

export function pathToLatLngs(path: RouteLike['path']): LatLng[] {
  if (!path) return [];
  return Array.from(path, (p) => {
    const j = typeof (p as { toJSON?: unknown }).toJSON === 'function' ? (p as { toJSON(): LatLng }).toJSON() : (p as LatLng);
    return { lat: j.lat, lng: j.lng };
  });
}

/** 徒歩・車・自転車用の整形 */
export function toMapRoutes(routes: RouteLike[], mode: TravelMode): MapRoute[] {
  return routes.map((route) => {
    const legs = route.legs ?? [];
    const steps: RouteStep[] = legs.flatMap((leg) =>
      leg.steps.map((s) => ({
        instruction: stripHtml(s.instructions ?? ''),
        distanceM: s.distanceMeters ?? 0,
        durationSec: Math.round((s.staticDurationMillis ?? 0) / 1000),
        maneuver: s.maneuver ?? undefined,
      })),
    );
    const distanceM = route.distanceMeters ?? legs.reduce((a, l) => a + (l.distanceMeters ?? 0), 0);
    const durationMs = route.durationMillis ?? legs.reduce((a, l) => a + (l.durationMillis ?? l.staticDurationMillis ?? 0), 0);
    return {
      mode,
      distanceM,
      durationSec: Math.round(durationMs / 1000),
      summary: route.description ?? '',
      steps,
      overviewPath: pathToLatLngs(route.path),
      bounds: route.viewport ?? undefined,
      startAddress: '',
      endAddress: '',
    };
  });
}
