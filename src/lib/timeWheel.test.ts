import { describe, expect, it } from 'vitest';
import { conditionLabel, dayKey, dayOptions, joinLocal, shiftMinutes, splitLocal } from './timeWheel';

// 2026-09-23（水）15:34
const now = new Date(2026, 8, 23, 15, 34);

describe('timeWheel', () => {
  it('lists days around today with weekday tones', () => {
    const days = dayOptions(now, 7, 30);
    expect(days).toHaveLength(38);
    const today = days.findIndex((d) => d.tone === 'today');
    expect(today).toBe(7);
    expect(days[today]).toMatchObject({ key: '2026-09-23', label: '今日', weekday: '水' });
    expect(days[today + 1]).toMatchObject({ label: '9月24日', weekday: '木', tone: 'normal' });
    expect(days.find((d) => d.key === '2026-09-26')?.tone).toBe('sat');
    expect(days.find((d) => d.key === '2026-09-20')?.tone).toBe('sun');
    // 月をまたいでも連続している
    expect(days.find((d) => d.key === '2026-10-01')?.label).toBe('10月1日');
  });

  it('splits and joins local times, defaulting to now', () => {
    expect(splitLocal('2026-09-24T07:05', now)).toEqual({ day: '2026-09-24', hour: 7, minute: 5 });
    expect(splitLocal(undefined, now)).toEqual({ day: '2026-09-23', hour: 15, minute: 34 });
    expect(splitLocal('garbage', now)).toEqual({ day: '2026-09-23', hour: 15, minute: 34 });
    expect(joinLocal({ day: '2026-09-24', hour: 7, minute: 5 })).toBe('2026-09-24T07:05');
    expect(dayKey(now)).toBe('2026-09-23');
  });

  it('shifts by minutes across hours, days and months', () => {
    expect(shiftMinutes({ day: '2026-09-23', hour: 15, minute: 34 }, 5)).toEqual({ day: '2026-09-23', hour: 15, minute: 39 });
    expect(shiftMinutes({ day: '2026-09-23', hour: 15, minute: 58 }, 5)).toEqual({ day: '2026-09-23', hour: 16, minute: 3 });
    expect(shiftMinutes({ day: '2026-09-30', hour: 23, minute: 57 }, 5)).toEqual({ day: '2026-10-01', hour: 0, minute: 2 });
    expect(shiftMinutes({ day: '2026-10-01', hour: 0, minute: 2 }, -5)).toEqual({ day: '2026-09-30', hour: 23, minute: 57 });
  });

  it('labels the condition button like NAVITIME', () => {
    expect(conditionLabel(undefined, 'departure', now)).toBe('現在時刻 - 出発');
    expect(conditionLabel(undefined, 'arrival', now)).toBe('現在時刻 - 到着');
    expect(conditionLabel('2026-09-23T15:40', 'departure', now)).toBe('今日 15:40 - 出発');
    expect(conditionLabel('2026-09-24T08:05', 'arrival', now)).toBe('9月24日(木) 08:05 - 到着');
    expect(conditionLabel('2026-09-24T12:00', 'first', now)).toBe('9月24日(木) 始発');
    expect(conditionLabel(undefined, 'last', now)).toBe('今日 終電');
  });
});
