import type { Place, RouteQuery, TravelMode, MapRoute, RouteStep } from '../types';
import { stripHtml } from './format';

export class DirectionsError extends Error {
  constructor(
    public readonly status: string,
    message: string,
  ) {
    super(message);
    this.name = 'DirectionsError';
  }
}

const STATUS_MESSAGES: Record<string, string> = {
  ZERO_RESULTS: '経路が見つかりませんでした。出発地・目的地や移動手段を変えてお試しください。',
  NOT_FOUND: '出発地または目的地を特定できませんでした。地名や住所を確認してください。',
  MAX_WAYPOINTS_EXCEEDED: '経由地が多すぎます。',
  MAX_ROUTE_LENGTH_EXCEEDED: '経路が長すぎます。',
  INVALID_REQUEST: '検索条件が不正です。出発地と目的地を入力してください。',
  OVER_QUERY_LIMIT: 'API の利用上限に達しました。しばらくしてからお試しください。',
  REQUEST_DENIED: 'Directions API の利用が拒否されました。API キーの設定と API の有効化を確認してください。',
  UNKNOWN_ERROR: 'サーバーエラーが発生しました。もう一度お試しください。',
};

export function messageForStatus(status: string, mode?: TravelMode): string {
  if (status === 'ZERO_RESULTS' && mode === 'BICYCLING') {
    return '自転車ルートはこの地域では提供されていません。徒歩ルートをお試しください。';
  }
  return STATUS_MESSAGES[status] ?? `経路検索に失敗しました (${status})`;
}

export function placeToLocation(p: Place): string | google.maps.LatLngLiteral | google.maps.Place {
  if (p.placeId) return { placeId: p.placeId };
  if (p.location) return p.location;
  return p.name;
}

function transitModes(): google.maps.TransitMode[] {
  const TM = google.maps.TransitMode;
  return [TM.BUS, TM.RAIL, TM.SUBWAY, TM.TRAIN, TM.TRAM];
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

export function buildRequest(query: RouteQuery, opts?: { alternatives?: boolean }): google.maps.DirectionsRequest {
  const req: google.maps.DirectionsRequest = {
    origin: placeToLocation(query.from),
    destination: placeToLocation(query.to),
    travelMode: query.mode as google.maps.TravelMode,
    provideRouteAlternatives: opts?.alternatives ?? true,
    region: 'jp',
  };
  if (query.mode === 'TRANSIT') {
    const t = resolveTimeOption(query);
    req.transitOptions = {
      ...t,
      modes: transitModes(),
      routingPreference: google.maps.TransitRoutePreference.FEWER_TRANSFERS,
    };
  } else if (query.mode === 'DRIVING') {
    const t = resolveTimeOption(query);
    if (t.departureTime && t.departureTime.getTime() > Date.now()) {
      req.drivingOptions = { departureTime: t.departureTime };
    }
  }
  return req;
}

/** DirectionsService.route を Promise 化 */
export function requestDirections(
  service: google.maps.DirectionsService,
  request: google.maps.DirectionsRequest,
): Promise<google.maps.DirectionsResult> {
  return new Promise((resolve, reject) => {
    void service
      .route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          resolve(result);
        } else {
          reject(new DirectionsError(String(status), messageForStatus(String(status), request.travelMode as TravelMode)));
        }
      })
      .catch((err: unknown) => {
        const status = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : 'UNKNOWN_ERROR';
        reject(new DirectionsError(status, messageForStatus(status, request.travelMode as TravelMode)));
      });
  });
}

/** 徒歩・車・自転車用の整形 */
export function toMapRoutes(result: google.maps.DirectionsResult, mode: TravelMode): MapRoute[] {
  return result.routes.map((route) => {
    const legs = route.legs;
    const steps: RouteStep[] = legs.flatMap((leg) =>
      leg.steps.map((s) => ({
        instruction: stripHtml(s.instructions ?? ''),
        distanceM: s.distance?.value ?? 0,
        durationSec: s.duration?.value ?? 0,
        maneuver: (s as { maneuver?: string }).maneuver,
      })),
    );
    return {
      mode,
      distanceM: legs.reduce((a, l) => a + (l.distance?.value ?? 0), 0),
      durationSec: legs.reduce((a, l) => a + (l.duration?.value ?? 0), 0),
      summary: route.summary ?? '',
      steps,
      overviewPath: route.overview_path ?? [],
      bounds: route.bounds,
      startAddress: legs[0]?.start_address ?? '',
      endAddress: legs[legs.length - 1]?.end_address ?? '',
    };
  });
}
