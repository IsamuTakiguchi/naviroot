import { describe, expect, it } from 'vitest';
import { decodePlace, encodePlace, isComplete, paramsToQuery, queryToParams } from './query';

describe('query', () => {
  it('place round trip', () => {
    const p = { name: '東京駅', address: '東京都千代田区', placeId: 'abc', location: { lat: 35.68, lng: 139.76 } };
    expect(decodePlace(encodePlace(p))).toEqual(p);
    expect(decodePlace('新宿')).toEqual({ name: '新宿' });
    expect(decodePlace(null)).toBeUndefined();
  });
  it('query round trip and validation', () => {
    const q = { from: { name: 'A' }, to: { name: 'B' }, mode: 'TRANSIT' as const, time: '2026-09-19T08:00', timeType: 'arrival' as const };
    const back = paramsToQuery(queryToParams(q));
    expect(back).toEqual({ from: { name: 'A', address: undefined, placeId: undefined, location: undefined }, to: { name: 'B', address: undefined, placeId: undefined, location: undefined }, mode: 'TRANSIT', time: '2026-09-19T08:00', timeType: 'arrival' });
    expect(isComplete(back)).toBe(true);
    expect(isComplete(paramsToQuery(new URLSearchParams('mode=BOGUS&timeType=x')))).toBe(false);
    expect(paramsToQuery(new URLSearchParams('mode=BOGUS')).mode).toBeUndefined();
  });
});
