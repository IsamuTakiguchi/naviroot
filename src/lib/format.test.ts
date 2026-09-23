import { describe, expect, it } from 'vitest';
import { formatDistance, formatDuration, formatFare, formatTime, stripHtml, toDateTimeLocal, fromDateTimeLocal } from './format';

describe('format', () => {
  it('formatDuration', () => {
    expect(formatDuration(30)).toBe('1分');
    expect(formatDuration(300)).toBe('5分');
    expect(formatDuration(3600)).toBe('1時間');
    expect(formatDuration(4980)).toBe('1時間23分');
  });
  it('formatDistance', () => {
    expect(formatDistance(850)).toBe('850m');
    expect(formatDistance(3250)).toBe('3.3km');
    expect(formatDistance(12400)).toBe('12.4km');
    expect(formatDistance(32802)).toBe('32.8km');
    expect(formatDistance(123400)).toBe('123km');
  });
  it('formatFare', () => {
    expect(formatFare(1234)).toBe('¥1,234');
    expect(formatFare(200, 'JPY')).toBe('¥200');
  });
  it('formatTime pads', () => {
    expect(formatTime(new Date(2026, 8, 19, 8, 5))).toBe('08:05');
  });
  it('stripHtml', () => {
    expect(stripHtml('<b>東京駅</b>で<div style="x">右折</div>&nbsp;100m')).toBe('東京駅で 右折 100m');
  });
  it('datetime-local round trip', () => {
    const d = new Date(2026, 8, 19, 8, 5);
    expect(toDateTimeLocal(d)).toBe('2026-09-19T08:05');
    expect(fromDateTimeLocal('2026-09-19T08:05')?.getTime()).toBe(d.getTime());
    expect(fromDateTimeLocal('bad')).toBeUndefined();
    expect(fromDateTimeLocal(undefined)).toBeUndefined();
  });
});
