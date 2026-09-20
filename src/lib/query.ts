import type { Place, RouteQuery, TravelMode, TimeType, TransitFilter } from '../types';

const MODES: TravelMode[] = ['TRANSIT', 'WALKING', 'DRIVING', 'BICYCLING'];
const TIME_TYPES: TimeType[] = ['departure', 'arrival', 'first', 'last'];
export const TRANSIT_FILTERS: TransitFilter[] = ['all', 'bus', 'train', 'no_express'];

export function encodePlace(p: Place): string {
  return JSON.stringify({ n: p.name, a: p.address, i: p.placeId, l: p.location });
}

export function decodePlace(s: string | null): Place | undefined {
  if (!s) return undefined;
  try {
    const o = JSON.parse(s) as { n?: string; a?: string; i?: string; l?: { lat: number; lng: number } };
    if (!o || typeof o.n !== 'string' || !o.n) return { name: s };
    return { name: o.n, address: o.a, placeId: o.i, location: o.l };
  } catch {
    return { name: s };
  }
}

export function queryToParams(q: Partial<RouteQuery>): URLSearchParams {
  const p = new URLSearchParams();
  if (q.from) p.set('from', encodePlace(q.from));
  if (q.to) p.set('to', encodePlace(q.to));
  if (q.mode) p.set('mode', q.mode);
  if (q.time) p.set('time', q.time);
  if (q.timeType) p.set('timeType', q.timeType);
  if (q.filter && q.filter !== 'all') p.set('filter', q.filter);
  return p;
}

export function paramsToQuery(p: URLSearchParams): Partial<RouteQuery> {
  const mode = p.get('mode') as TravelMode | null;
  const timeType = p.get('timeType') as TimeType | null;
  const filter = p.get('filter') as TransitFilter | null;
  return {
    from: decodePlace(p.get('from')),
    to: decodePlace(p.get('to')),
    mode: mode && MODES.includes(mode) ? mode : undefined,
    time: p.get('time') ?? undefined,
    timeType: timeType && TIME_TYPES.includes(timeType) ? timeType : undefined,
    filter: filter && TRANSIT_FILTERS.includes(filter) ? filter : undefined,
  };
}

export function isComplete(q: Partial<RouteQuery>): q is RouteQuery {
  return !!q.from?.name && !!q.to?.name && !!q.mode && !!q.timeType;
}
