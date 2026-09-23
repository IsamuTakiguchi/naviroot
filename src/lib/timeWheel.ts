import type { TimeType } from '../types';

/**
 * 日時指定シート（NAVITIME 風のホイール）で使う日時の計算。
 * 時刻はアプリ全体と同じく、ローカル時刻の 'YYYY-MM-DDTHH:mm' 文字列で扱う。
 */

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export type DayTone = 'today' | 'sun' | 'sat' | 'normal';

export interface DayOption {
  /** 'YYYY-MM-DD' */
  key: string;
  /** 「今日」または「9月24日」 */
  label: string;
  /** 「水」 */
  weekday: string;
  tone: DayTone;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** ホイールに並べる日付（今日の before 日前〜 after 日後） */
export function dayOptions(now: Date = new Date(), before = 7, after = 30): DayOption[] {
  const today = dayKey(now);
  const out: DayOption[] = [];
  for (let i = -before; i <= after; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const key = dayKey(d);
    const w = d.getDay();
    out.push({
      key,
      label: key === today ? '今日' : `${d.getMonth() + 1}月${d.getDate()}日`,
      weekday: WEEKDAYS[w],
      tone: key === today ? 'today' : w === 0 ? 'sun' : w === 6 ? 'sat' : 'normal',
    });
  }
  return out;
}

export interface TimeParts {
  day: string;
  hour: number;
  minute: number;
}

/** 'YYYY-MM-DDTHH:mm' → 日・時・分（未指定なら now） */
export function splitLocal(time: string | undefined, now: Date = new Date()): TimeParts {
  const m = time ? /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(time) : null;
  if (!m) return { day: dayKey(now), hour: now.getHours(), minute: now.getMinutes() };
  return { day: m[1], hour: Number(m[2]), minute: Number(m[3]) };
}

export function joinLocal(p: TimeParts): string {
  return `${p.day}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** 分をずらす（日付・月をまたいでも正しく繰り上げ／繰り下げる） */
export function shiftMinutes(p: TimeParts, delta: number): TimeParts {
  const base = parseDayKey(p.day);
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), p.hour, p.minute + delta);
  return { day: dayKey(d), hour: d.getHours(), minute: d.getMinutes() };
}

const TYPE_LABEL: Record<TimeType, string> = { departure: '出発', arrival: '到着', first: '始発', last: '終電' };

/** 検索フォームの条件ボタンの文言（「現在時刻 - 出発」「今日 15:34 - 到着」「9月24日(木) 始発」） */
export function conditionLabel(time: string | undefined, timeType: TimeType, now: Date = new Date()): string {
  const label = TYPE_LABEL[timeType];
  if (!time && (timeType === 'departure' || timeType === 'arrival')) return `現在時刻 - ${label}`;
  const p = splitLocal(time, now);
  const d = parseDayKey(p.day);
  const day = p.day === dayKey(now) ? '今日' : `${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAYS[d.getDay()]})`;
  if (timeType === 'first' || timeType === 'last') return `${day} ${label}`;
  return `${day} ${pad(p.hour)}:${pad(p.minute)} - ${label}`;
}
