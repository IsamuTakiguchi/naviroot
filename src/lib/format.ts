import type { TravelMode, TransitVehicle } from '../types';
import type { IconName } from '../components/Icon';

const pad2 = (n: number) => n.toString().padStart(2, '0');

/** 4980 → 「1時間23分」、300 → 「5分」、30 → 「1分」 */
export function formatDuration(sec: number): string {
  const minutes = Math.max(1, Math.round(sec / 60));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

/** 3250 → 「3.3km」、850 → 「850m」 */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)}km`;
}

/** 1234 → 「¥1,234」 */
export function formatFare(value: number, currency = 'JPY'): string {
  if (currency === 'JPY') return `¥${Math.round(value).toLocaleString('ja-JP')}`;
  return `${value.toLocaleString('ja-JP')} ${currency}`;
}

/** Date → 「08:05」 */
export function formatTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Date → 「9/19(土)」 */
export function formatDateJa(d: Date): string {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

/** <input type="datetime-local"> 用の値（ローカル時刻） */
export function toDateTimeLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function fromDateTimeLocal(s: string | undefined | null): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Google の instructions（HTML）をプレーンテキスト化 */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?div[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export const MODE_LABEL: Record<TravelMode, string> = {
  TRANSIT: '電車・バス',
  WALKING: '徒歩',
  DRIVING: '車',
  BICYCLING: '自転車',
};

export const MODE_ICON: Record<TravelMode, IconName> = {
  TRANSIT: 'train',
  WALKING: 'walk',
  DRIVING: 'car',
  BICYCLING: 'bicycle',
};

export const VEHICLE_ICON: Record<TransitVehicle, IconName> = {
  BUS: 'bus',
  RAIL: 'train',
  SUBWAY: 'subway',
  TRAIN: 'express',
  TRAM: 'tram',
  OTHER: 'train',
};
