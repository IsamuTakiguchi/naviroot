import type { Place, TimeType } from '../types';
import { fromDateTimeLocal } from './format';

function locOrName(p: Place): string {
  return p.location ? `${p.location.lat},${p.location.lng}` : p.name;
}

/** Google マップの乗換案内（API キー不要。スマホではアプリが開く） */
export function googleMapsTransitUrl(from: Place, to: Place): string {
  const q = new URLSearchParams({ api: '1', origin: locOrName(from), destination: locOrName(to), travelmode: 'transit' });
  if (from.placeId) q.set('origin_place_id', from.placeId);
  if (to.placeId) q.set('destination_place_id', to.placeId);
  return `https://www.google.com/maps/dir/?${q.toString()}`;
}

const YAHOO_TYPE: Record<TimeType, string> = { departure: '1', arrival: '4', first: '3', last: '2' };

/** Yahoo!乗換案内（駅名・スポット名で検索。日時は任意） */
export function yahooTransitUrl(from: Place, to: Place, time?: string, timeType: TimeType = 'departure'): string {
  const q = new URLSearchParams({ from: from.name, to: to.name, type: YAHOO_TYPE[timeType] });
  const d = fromDateTimeLocal(time);
  if (d) {
    q.set('y', String(d.getFullYear()));
    q.set('m', String(d.getMonth() + 1).padStart(2, '0'));
    q.set('d', String(d.getDate()).padStart(2, '0'));
    q.set('hh', String(d.getHours()).padStart(2, '0'));
    q.set('m1', String(Math.floor(d.getMinutes() / 10)));
    q.set('m2', String(d.getMinutes() % 10));
  }
  return `https://transit.yahoo.co.jp/search/result?${q.toString()}`;
}

/** Google マップで地点の周辺を開く（「目的地周辺の地図をみる」） */
export function googleMapsPlaceUrl(place: Place): string {
  const q = place.location ? `${place.location.lat},${place.location.lng}` : place.name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
