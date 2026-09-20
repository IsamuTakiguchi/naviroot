import { describe, expect, it } from 'vitest';
import { googleMapsTransitUrl, yahooTransitUrl } from './externalLinks';

describe('externalLinks', () => {
  it('googleMapsTransitUrl prefers coordinates and adds place ids', () => {
    const u = new URL(
      googleMapsTransitUrl({ name: '東京駅', location: { lat: 35.68, lng: 139.76 }, placeId: 'pid1' }, { name: '新宿駅' }),
    );
    expect(u.origin + u.pathname).toBe('https://www.google.com/maps/dir/');
    expect(u.searchParams.get('api')).toBe('1');
    expect(u.searchParams.get('origin')).toBe('35.68,139.76');
    expect(u.searchParams.get('origin_place_id')).toBe('pid1');
    expect(u.searchParams.get('destination')).toBe('新宿駅');
    expect(u.searchParams.get('destination_place_id')).toBeNull();
    expect(u.searchParams.get('travelmode')).toBe('transit');
  });

  it('yahooTransitUrl encodes names, type and time', () => {
    const u = new URL(yahooTransitUrl({ name: '学園前' }, { name: '奈良' }, '2026-09-20T14:05', 'arrival'));
    expect(u.host).toBe('transit.yahoo.co.jp');
    expect(u.searchParams.get('from')).toBe('学園前');
    expect(u.searchParams.get('to')).toBe('奈良');
    expect(u.searchParams.get('type')).toBe('4');
    expect(u.searchParams.get('y')).toBe('2026');
    expect(u.searchParams.get('m')).toBe('09');
    expect(u.searchParams.get('d')).toBe('20');
    expect(u.searchParams.get('hh')).toBe('14');
    expect(u.searchParams.get('m1')).toBe('0');
    expect(u.searchParams.get('m2')).toBe('5');
    const noTime = new URL(yahooTransitUrl({ name: 'a' }, { name: 'b' }));
    expect(noTime.searchParams.get('type')).toBe('1');
    expect(noTime.searchParams.get('y')).toBeNull();
  });
});
