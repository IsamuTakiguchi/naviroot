import type { PlanSegment, TransitPlan, TransitSegment, TransitVehicle, WalkSegment, PlanBadge } from '../types';
import { stripHtml } from './format';

const VEHICLE_MAP: Record<string, TransitVehicle> = {
  BUS: 'BUS',
  INTERCITY_BUS: 'BUS',
  TROLLEYBUS: 'BUS',
  RAIL: 'RAIL',
  HEAVY_RAIL: 'RAIL',
  COMMUTER_TRAIN: 'TRAIN',
  HIGH_SPEED_TRAIN: 'TRAIN',
  LONG_DISTANCE_TRAIN: 'TRAIN',
  METRO_RAIL: 'SUBWAY',
  SUBWAY: 'SUBWAY',
  MONORAIL: 'RAIL',
  TRAM: 'TRAM',
};

export function normalizeVehicle(type: string | undefined): TransitVehicle {
  if (!type) return 'OTHER';
  return VEHICLE_MAP[type] ?? 'OTHER';
}

/**
 * Google の DirectionsStep から乗換案内用のセグメントへ変換。
 * 型は google.maps.DirectionsStep の一部だけを使う（テストしやすいように構造的に受ける）。
 */
export interface StepLike {
  travel_mode: string;
  duration?: { value: number };
  distance?: { value: number };
  instructions?: string;
  transit?: {
    line: {
      name?: string;
      short_name?: string;
      color?: string;
      text_color?: string;
      agencies?: { name: string }[];
      vehicle?: { type?: string; name?: string };
    };
    headsign?: string;
    departure_stop: { name: string };
    arrival_stop: { name: string };
    departure_time: { value: Date };
    arrival_time: { value: Date };
    num_stops: number;
  };
}

export interface RouteLike {
  summary?: string;
  fare?: { value: number; currency: string; text: string };
  legs: {
    duration?: { value: number };
    departure_time?: { value: Date };
    arrival_time?: { value: Date };
    steps: StepLike[];
  }[];
  bounds?: google.maps.LatLngBounds;
  overview_path?: google.maps.LatLng[];
}

export function stepToSegment(step: StepLike): PlanSegment | null {
  if (step.travel_mode === 'TRANSIT' && step.transit) {
    const t = step.transit;
    const seg: TransitSegment = {
      kind: 'transit',
      lineName: t.line.name ?? t.line.short_name ?? '路線',
      lineShortName: t.line.short_name,
      lineColor: t.line.color,
      lineTextColor: t.line.text_color,
      vehicle: normalizeVehicle(t.line.vehicle?.type),
      vehicleName: t.line.vehicle?.name ?? '',
      headsign: t.headsign ?? '',
      agency: t.line.agencies?.[0]?.name,
      departureStop: t.departure_stop.name,
      arrivalStop: t.arrival_stop.name,
      departureTime: t.departure_time.value,
      arrivalTime: t.arrival_time.value,
      numStops: t.num_stops,
      durationSec: step.duration?.value ?? 0,
    };
    return seg;
  }
  const walk: WalkSegment = {
    kind: 'walk',
    durationSec: step.duration?.value ?? 0,
    distanceM: step.distance?.value ?? 0,
    instruction: stripHtml(step.instructions ?? '徒歩'),
  };
  return walk;
}

/** 連続する徒歩区間をひとつにまとめる */
function mergeWalks(segments: PlanSegment[]): PlanSegment[] {
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

export function routeToPlan(route: RouteLike, index: number, now: Date = new Date()): TransitPlan {
  const legs = route.legs;
  const segments = mergeWalks(
    legs.flatMap((leg) => leg.steps.map(stepToSegment).filter((s): s is PlanSegment => s !== null)),
  );
  const transitSegs = segments.filter((s): s is TransitSegment => s.kind === 'transit');
  const durationSec = legs.reduce((a, l) => a + (l.duration?.value ?? 0), 0);
  const departureTime = legs[0]?.departure_time?.value ?? transitSegs[0]?.departureTime ?? now;
  const arrivalTime =
    legs[legs.length - 1]?.arrival_time?.value ??
    transitSegs[transitSegs.length - 1]?.arrivalTime ??
    new Date(departureTime.getTime() + durationSec * 1000);
  const walkSec = segments.filter((s) => s.kind === 'walk').reduce((a, s) => a + s.durationSec, 0);
  const summary =
    transitSegs.map((s) => s.lineShortName ?? s.lineName).join(' → ') || (route.summary ?? '徒歩');
  return {
    id: `plan-${index}`,
    departureTime,
    arrivalTime,
    durationSec,
    transfers: Math.max(0, transitSegs.length - 1),
    fare: route.fare,
    walkSec,
    segments,
    summary,
    bounds: route.bounds,
    overviewPath: route.overview_path,
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

export function resultToPlans(result: { routes: RouteLike[] }, now: Date = new Date()): TransitPlan[] {
  const plans = result.routes.map((r, i) => routeToPlan(r, i, now));
  plans.sort((a, b) => a.departureTime.getTime() - b.departureTime.getTime());
  return assignBadges(plans);
}
