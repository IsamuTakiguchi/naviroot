import { describe, expect, it } from 'vitest';
import { buildIcs, escapeIcsText, planDescription, toIcsDate } from './ics';
import type { TransitPlan } from '../types';

const t = (h: number, m: number) => new Date(2026, 8, 21, h, m);

const plan: TransitPlan = {
  id: 'nt-0',
  departureTime: t(10, 50),
  arrivalTime: t(12, 42),
  durationSec: 112 * 60,
  transfers: 2,
  fare: { value: 7590, currency: 'JPY', text: '¥7,590' },
  walkSec: 720,
  summary: '近鉄奈良線 → 近鉄京都線特急',
  badges: ['fastest'],
  segments: [
    { kind: 'walk', durationSec: 720, distanceM: 720, instruction: '徒歩' },
    {
      kind: 'transit',
      lineName: '近鉄難波・奈良線 近鉄奈良行',
      vehicle: 'RAIL',
      vehicleName: '普通',
      headsign: '近鉄奈良',
      departureStop: '学園前（奈良県）',
      arrivalStop: '大和西大寺',
      departureTime: t(11, 5),
      arrivalTime: t(11, 10),
      numStops: 2,
      durationSec: 300,
    },
  ],
};

describe('ics', () => {
  it('toIcsDate uses UTC', () => {
    expect(toIcsDate(new Date(Date.UTC(2026, 8, 21, 1, 50, 0)))).toBe('20260921T015000Z');
  });

  it('escapeIcsText escapes separators and newlines', () => {
    expect(escapeIcsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('planDescription lists each leg', () => {
    const d = planDescription(plan, '鶴舞西町', '近鉄名古屋');
    expect(d).toContain('10:50 鶴舞西町 発');
    expect(d).toContain('徒歩 12分（720m）');
    expect(d).toContain('11:05 学園前（奈良県） → 11:10 大和西大寺');
    expect(d).toContain('近鉄難波・奈良線 近鉄奈良行 近鉄奈良 行');
    expect(d).toContain('12:42 近鉄名古屋 着');
    expect(d).toContain('所要 1時間52分 ・ 乗換 2回');
    expect(d).toContain('運賃 ¥7,590');
  });

  it('buildIcs produces a single folded VEVENT', () => {
    const ics = buildIcs(plan, '鶴舞西町', '近鉄名古屋', new Date(Date.UTC(2026, 8, 21, 0, 0, 0)));
    const lines = ics.split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines.at(-1)).toBe('END:VCALENDAR');
    expect(ics).toContain('DTSTAMP:20260921T000000Z');
    expect(ics).toContain(`DTSTART:${toIcsDate(t(10, 50))}`);
    expect(ics).toContain(`DTEND:${toIcsDate(t(12, 42))}`);
    expect(ics).toContain('SUMMARY:鶴舞西町 → 近鉄名古屋');
    expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
    // 折り返し後の継続行は空白始まり、どの行も 74 文字以内
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(74);
    expect(lines.some((l) => l.startsWith(' '))).toBe(true);
  });
});
