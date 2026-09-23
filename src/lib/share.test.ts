import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransitPlan } from '../types';
import { planShareText, shareText } from './share';

const plan: TransitPlan = {
  id: 'p',
  departureTime: new Date(2026, 8, 23, 15, 37),
  arrivalTime: new Date(2026, 8, 23, 16, 16),
  durationSec: 39 * 60,
  transfers: 0,
  fare: { value: 680, currency: 'JPY', text: '¥680' },
  walkSec: 0,
  summary: '近鉄奈良線急行',
  badges: [],
  segments: [
    {
      kind: 'transit',
      lineName: '近鉄奈良線急行',
      vehicle: 'RAIL',
      vehicleName: '急行',
      headsign: '大阪上本町',
      departureStop: '近鉄奈良',
      arrivalStop: '大阪難波（近鉄・阪神線）',
      departureTime: new Date(2026, 8, 23, 15, 37),
      arrivalTime: new Date(2026, 8, 23, 16, 16),
      numStops: 0,
      durationSec: 39 * 60,
    },
  ],
};

describe('share', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('writes a readable summary of the route', () => {
    expect(planShareText(plan, '近鉄奈良駅', '大阪難波駅')).toBe(
      [
        '近鉄奈良駅 → 大阪難波駅',
        '9月23日(水) 15:37発 → 16:16着',
        '39分 / 680円 / 乗換0回',
        '15:37 近鉄奈良 → 近鉄奈良線急行 → 16:16 大阪難波（近鉄・阪神線）',
      ].join('\n'),
    );
  });

  it('uses the share sheet, falls back to the clipboard, and reports cancel', async () => {
    const share = vi.fn(async () => {});
    vi.stubGlobal('navigator', { share });
    await expect(shareText('t', 'x', 'https://e')).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 't', text: 'x', url: 'https://e' });

    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(shareText('t', 'x', 'https://e')).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('x\nhttps://e');

    vi.stubGlobal('navigator', {
      share: async () => {
        throw new DOMException('cancel', 'AbortError');
      },
    });
    await expect(shareText('t', 'x')).resolves.toBe('cancelled');

    vi.stubGlobal('navigator', {});
    await expect(shareText('t', 'x')).resolves.toBe('failed');
  });
});
