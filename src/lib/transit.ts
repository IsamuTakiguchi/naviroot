import type { LatLng, PlanSegment, TransitPlan, TransitSegment, TransitVehicle, WalkSegment, PlanBadge } from '../types';
import { formatFare, stripHtml } from './format';

const VEHICLE_MAP: Record<string, TransitVehicle> = {
  BUS: 'BUS',
  INTERCITY_BUS: 'BUS',
  TROLLEYBUS: 'BUS',
  COACH: 'BUS',
  SHARE_TAXI: 'BUS',
  RAIL: 'RAIL',
  HEAVY_RAIL: 'RAIL',
  MONORAIL: 'RAIL',
  COMMUTER_TRAIN: 'TRAIN',
  HIGH_SPEED_TRAIN: 'TRAIN',
  LONG_DISTANCE_TRAIN: 'TRAIN',
  METRO_RAIL: 'SUBWAY',
  SUBWAY: 'SUBWAY',
  TRAM: 'TRAM',
  LIGHT_RAIL: 'TRAM',
};

export function normalizeVehicle(type: string | null | undefined): TransitVehicle {
  if (!type) return 'OTHER';
  return VEHICLE_MAP[type] ?? 'OTHER';
}

/**
 * Routes API（google.maps.routes.Route）の構造のうち、乗換案内に必要な部分だけを表す型。
 * 実際の Route インスタンスも、テスト用のプレーンオブジェクトもこの型に適合する。
 */
export interface StepLike {
  travelMode?: string | null;
  distanceMeters?: number;
  staticDurationMillis?: number | null;
  instructions?: string | null;
  maneuver?: string | null;
  transitDetails?: {
    departureStop?: { name: string | null } | null;
    arrivalStop?: { name: string | null } | null;
    departureTime?: Date | null;
    arrivalTime?: Date | null;
    headsign?: string | null;
    stopCount?: number;
    transitLine?: {
      name?: string | null;
      shortName?: string | null;
      color?: string | null;
      textColor?: string | null;
      vehicle?: { vehicleType?: string | null; name?: string | null } | null;
      agencies?: { name: string | null }[];
    } | null;
  } | null;
}

export interface LegLike {
  steps: StepLike[];
  distanceMeters?: number;
  durationMillis?: number | null;
  staticDurationMillis?: number | null;
}

export interface MoneyLike {
  currencyCode: string;
  units: number;
  nanos: number;
}

export interface RouteLike {
  description?: string | null;
  legs?: LegLike[];
  durationMillis?: number | null;
  distanceMeters?: number;
  path?: ArrayLike<{ toJSON(): { lat: number; lng: number } } | LatLng>;
  viewport?: google.maps.LatLngBounds | null;
  travelAdvisory?: { transitFare?: MoneyLike | null } | null;
  localizedValues?: { transitFare?: string | null } | null;
}

export function moneyToFare(m: MoneyLike | null | undefined, text?: string | null): TransitPlan['fare'] {
  if (!m) return undefined;
  const value = (m.units ?? 0) + (m.nanos ?? 0) / 1e9;
  if (!Number.isFinite(value) || (value === 0 && !text)) return undefined;
  return { value, currency: m.currencyCode || 'JPY', text: text ?? formatFare(value, m.currencyCode || 'JPY') };
}

export function stepToSegment(step: StepLike): PlanSegment {
  const durationSec = Math.round((step.staticDurationMillis ?? 0) / 1000);
  const t = step.transitDetails;
  if (step.travelMode === 'TRANSIT' && t) {
    const line = t.transitLine;
    const seg: TransitSegment = {
      kind: 'transit',
      lineName: line?.name ?? line?.shortName ?? '路線',
      lineShortName: line?.shortName ?? undefined,
      lineColor: line?.color ?? undefined,
      lineTextColor: line?.textColor ?? undefined,
      vehicle: normalizeVehicle(line?.vehicle?.vehicleType),
      vehicleName: line?.vehicle?.name ?? '',
      headsign: t.headsign ?? '',
      agency: line?.agencies?.[0]?.name ?? undefined,
      departureStop: t.departureStop?.name ?? '',
      arrivalStop: t.arrivalStop?.name ?? '',
      departureTime: t.departureTime ?? new Date(NaN),
      arrivalTime: t.arrivalTime ?? new Date(NaN),
      numStops: t.stopCount ?? 0,
      durationSec,
    };
    return seg;
  }
  const walk: WalkSegment = {
    kind: 'walk',
    durationSec,
    distanceM: step.distanceMeters ?? 0,
    instruction: stripHtml(step.instructions ?? '徒歩'),
  };
  return walk;
}

/** 連続する徒歩区間をひとつにまとめる */
export function mergeWalks(segments: PlanSegment[]): PlanSegment[] {
  const out: PlanSegment[] = [];
  for (const s of segments) {
    const last = out[out.length - 1];
    if (s.kind === 'walk' && last?.kind === 'walk') {
      last.durationSec += s.durationSec;
      last.distanceM += s.distanceM;
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

function pathToLatLngs(path: RouteLike['path']): LatLng[] | undefined {
  if (!path) return undefined;
  return Array.from(path, (p) => {
    const j = typeof (p as { toJSON?: unknown }).toJSON === 'function' ? (p as { toJSON(): LatLng }).toJSON() : (p as LatLng);
    return { lat: j.lat, lng: j.lng };
  });
}

export function routeToPlan(route: RouteLike, index: number, now: Date = new Date()): TransitPlan {
  const legs = route.legs ?? [];
  const segments = mergeWalks(legs.flatMap((leg) => leg.steps.map(stepToSegment)));
  const transitSegs = segments.filter((s): s is TransitSegment => s.kind === 'transit');
  const durationSec = Math.round(
    (route.durationMillis ?? legs.reduce((a, l) => a + (l.durationMillis ?? l.staticDurationMillis ?? 0), 0)) / 1000,
  );

  // 出発 = 最初の乗車時刻 − それ以前の徒歩、到着 = 最後の降車時刻 + それ以後の徒歩
  let departureTime: Date;
  let arrivalTime: Date;
  const firstIdx = segments.findIndex((s) => s.kind === 'transit');
  if (firstIdx >= 0) {
    const first = segments[firstIdx] as TransitSegment;
    const before = segments.slice(0, firstIdx).reduce((a, s) => a + s.durationSec, 0);
    departureTime = new Date(first.departureTime.getTime() - before * 1000);
    const lastIdx = segments.length - 1 - [...segments].reverse().findIndex((s) => s.kind === 'transit');
    const last = segments[lastIdx] as TransitSegment;
    const after = segments.slice(lastIdx + 1).reduce((a, s) => a + s.durationSec, 0);
    arrivalTime = new Date(last.arrivalTime.getTime() + after * 1000);
  } else {
    departureTime = now;
    arrivalTime = new Date(now.getTime() + durationSec * 1000);
  }

  const walkSec = segments.filter((s) => s.kind === 'walk').reduce((a, s) => a + s.durationSec, 0);
  const summary =
    transitSegs.map((s) => s.lineShortName ?? s.lineName).join(' → ') || (route.description ?? '徒歩');
  return {
    id: `plan-${index}`,
    departureTime,
    arrivalTime,
    durationSec,
    transfers: Math.max(0, transitSegs.length - 1),
    fare: moneyToFare(route.travelAdvisory?.transitFare, route.localizedValues?.transitFare),
    walkSec,
    segments,
    summary,
    bounds: route.viewport ?? undefined,
    overviewPath: pathToLatLngs(route.path),
    badges: [],
  };
}

/** 最短・最安・乗換最少にバッジを付ける（NAVITIME 風の「早」「安」「楽」） */
export function assignBadges(plans: TransitPlan[]): TransitPlan[] {
  if (plans.length === 0) return plans;
  const fastest = plans.reduce((a, b) => (b.durationSec < a.durationSec ? b : a));
  const withFare = plans.filter((p) => p.fare);
  const cheapest = withFare.length ? withFare.reduce((a, b) => (b.fare!.value < a.fare!.value ? b : a)) : undefined;
  const easiest = plans.reduce((a, b) =>
    b.transfers < a.transfers || (b.transfers === a.transfers && b.walkSec < a.walkSec) ? b : a,
  );
  return plans.map((p) => {
    const badges: PlanBadge[] = [];
    if (p === fastest) badges.push('fastest');
    if (cheapest && p === cheapest) badges.push('cheapest');
    if (p === easiest) badges.push('easiest');
    return { ...p, badges };
  });
}

export function resultToPlans(routes: RouteLike[], now: Date = new Date()): TransitPlan[] {
  const plans = routes.map((r, i) => routeToPlan(r, i, now));
  plans.sort((a, b) => a.departureTime.getTime() - b.departureTime.getTime());
  return assignBadges(plans);
}
