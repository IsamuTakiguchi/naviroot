import type { TransitPlan, TransitSegment } from '../types';
import { formatDistance, formatDuration, formatFare, formatTime } from './format';

/** iCalendar（.ics）の生成。カレンダーアプリに経路を登録するために使う。 */

const pad = (n: number) => String(n).padStart(2, '0');

/** Date → iCalendar の UTC 日時（20260921T015000Z） */
export function toIcsDate(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** iCalendar のテキスト値をエスケープ（RFC 5545） */
export function escapeIcsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** 経路の区間を 1 行ずつの説明文にする */
export function planDescription(plan: TransitPlan, fromName: string, toName: string): string {
  const lines: string[] = [`${formatTime(plan.departureTime)} ${fromName} 発`];
  for (const s of plan.segments) {
    if (s.kind === 'walk') {
      lines.push(`  徒歩 ${formatDuration(s.durationSec)}（${formatDistance(s.distanceM)}）`);
      continue;
    }
    const t = s as TransitSegment;
    lines.push(`  ${formatTime(t.departureTime)} ${t.departureStop} → ${formatTime(t.arrivalTime)} ${t.arrivalStop}`);
    lines.push(`    ${t.lineName}${t.headsign ? ` ${t.headsign} 行` : ''}`);
  }
  lines.push(`${formatTime(plan.arrivalTime)} ${toName} 着`);
  lines.push('');
  lines.push(`所要 ${formatDuration(plan.durationSec)} ・ 乗換 ${plan.transfers}回`);
  if (plan.fare) lines.push(`運賃 ${formatFare(plan.fare.value, plan.fare.currency)}`);
  return lines.join('\n');
}

/** 75 オクテットで折り返す（続き行は先頭に空白） */
function foldLine(line: string): string[] {
  if (line.length <= 73) return [line];
  const out: string[] = [];
  let rest = line;
  out.push(rest.slice(0, 73));
  rest = rest.slice(73);
  while (rest.length > 72) {
    out.push(` ${rest.slice(0, 72)}`);
    rest = rest.slice(72);
  }
  if (rest) out.push(` ${rest}`);
  return out;
}

export function buildIcs(plan: TransitPlan, fromName: string, toName: string, now: Date = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//naviroot//transit//JA',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${plan.id}-${plan.departureTime.getTime()}@naviroot`,
    `DTSTAMP:${toIcsDate(now)}`,
    `DTSTART:${toIcsDate(plan.departureTime)}`,
    `DTEND:${toIcsDate(plan.arrivalTime)}`,
    `SUMMARY:${escapeIcsText(`${fromName} → ${toName}`)}`,
    `LOCATION:${escapeIcsText(fromName)}`,
    `DESCRIPTION:${escapeIcsText(planDescription(plan, fromName, toName))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.flatMap(foldLine).join('\r\n');
}

/** .ics をダウンロードさせる */
export function downloadIcs(plan: TransitPlan, fromName: string, toName: string): void {
  const blob = new Blob([buildIcs(plan, fromName, toName)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `naviroot-${formatTime(plan.departureTime).replace(':', '')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
