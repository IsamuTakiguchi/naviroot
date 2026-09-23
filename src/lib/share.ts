import type { TransitPlan } from '../types';
import { formatDateLong, formatDuration, formatTime, formatYen } from './format';

/** 経路を共有するときの文面（LINE・メール等に貼って読める形） */
export function planShareText(plan: TransitPlan, fromName: string, toName: string): string {
  const head = `${fromName} → ${toName}`;
  const when = `${formatDateLong(plan.departureTime)} ${formatTime(plan.departureTime)}発 → ${formatTime(plan.arrivalTime)}着`;
  const facts = [formatDuration(plan.durationSec), plan.fare ? formatYen(plan.fare.value) : undefined, `乗換${plan.transfers}回`]
    .filter(Boolean)
    .join(' / ');
  const rides = plan.segments
    .filter((s) => s.kind === 'transit')
    .map((s) => (s.kind === 'transit' ? `${formatTime(s.departureTime)} ${s.departureStop} → ${s.lineName} → ${formatTime(s.arrivalTime)} ${s.arrivalStop}` : ''));
  return [head, when, facts, ...rides].join('\n');
}

export type ShareResult = 'shared' | 'copied' | 'failed' | 'cancelled';

/** Web Share API で共有。使えない端末ではクリップボードにコピーする */
export async function shareText(title: string, text: string, url?: string): Promise<ShareResult> {
  const nav = globalThis.navigator as Navigator | undefined;
  if (nav?.share) {
    try {
      await nav.share({ title, text, url });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await nav?.clipboard?.writeText(url ? `${text}\n${url}` : text);
    return nav?.clipboard ? 'copied' : 'failed';
  } catch {
    return 'failed';
  }
}
