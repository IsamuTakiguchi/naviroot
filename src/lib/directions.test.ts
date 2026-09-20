import { describe, expect, it } from 'vitest';
import { buildRequest, DirectionsError, pathToLatLngs, requestRoutes, statusFromError, toMapRoutes } from './directions';
import type { RouteLike } from './transit';

describe('directions', () => {
  it('buildRequest for transit uses arrival/departure time and transit preference', () => {
    const arrival = buildRequest({ from: { name: '東京' }, to: { name: '新宿', location: { lat: 35.69, lng: 139.7 } }, mode: 'TRANSIT', time: '2030-01-01T09:00', timeType: 'arrival' });
    expect(arrival.origin).toBe('東京');
    expect(arrival.destination).toEqual({ lat: 35.69, lng: 139.7 });
    expect(arrival.travelMode).toBe('TRANSIT');
    expect(arrival.arrivalTime).toEqual(new Date('2030-01-01T09:00'));
    expect(arrival.departureTime).toBeUndefined();
    expect(arrival.transitPreference?.routingPreference).toBe('FEWER_TRANSFERS');
    expect(arrival.computeAlternativeRoutes).toBe(true);
    expect(arrival.fields).toContain('legs');

    const past = buildRequest({ from: { name: 'a' }, to: { name: 'b' }, mode: 'TRANSIT', time: '2000-01-01T09:00', timeType: 'departure' });
    expect(past.departureTime!.getTime()).toBeGreaterThan(Date.now() - 5000);

    const walk = buildRequest({ from: { name: 'a' }, to: { name: 'b' }, mode: 'WALKING', timeType: 'departure' }, { alternatives: false });
    expect(walk.transitPreference).toBeUndefined();
    expect(walk.computeAlternativeRoutes).toBe(false);
  });

  it('statusFromError maps Routes API errors', () => {
    expect(statusFromError({ code: 'NOT_FOUND', message: 'x' })).toBe('NOT_FOUND');
    expect(statusFromError({ name: 'MapsRequestError', message: 'PERMISSION_DENIED: API key not valid' })).toBe('REQUEST_DENIED');
    expect(statusFromError({ code: 'RESOURCE_EXHAUSTED' })).toBe('OVER_QUERY_LIMIT');
    expect(statusFromError(new Error('INVALID_ARGUMENT: bad'))).toBe('INVALID_REQUEST');
    expect(statusFromError('???')).toBe('UNKNOWN_ERROR');
  });

  it('requestRoutes throws ZERO_RESULTS on empty and wraps failures', async () => {
    const empty = { computeRoutes: async () => ({ routes: [], fallbackInfo: null, geocodingResults: null }) };
    await expect(requestRoutes(empty as never, { origin: 'a', destination: 'b', fields: ['*'], travelMode: 'BICYCLING' })).rejects.toMatchObject({ status: 'ZERO_RESULTS', message: expect.stringContaining('自転車') });
    const denied = { computeRoutes: async () => { throw { code: 'PERMISSION_DENIED' }; } };
    const err = await requestRoutes(denied as never, { origin: 'a', destination: 'b', fields: ['*'] }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DirectionsError);
    expect((err as DirectionsError).status).toBe('REQUEST_DENIED');
  });

  it('toMapRoutes and pathToLatLngs shape the result', () => {
    const r: RouteLike = {
      description: '甲州街道',
      distanceMeters: 3200,
      durationMillis: 2_400_000,
      path: [{ toJSON: () => ({ lat: 1, lng: 2 }) }, { lat: 3, lng: 4 }],
      legs: [{ steps: [{ instructions: '<b>右折</b>', distanceMeters: 100, staticDurationMillis: 90_000, maneuver: 'TURN_RIGHT' }] }],
    };
    const [m] = toMapRoutes([r], 'WALKING');
    expect(m).toMatchObject({ mode: 'WALKING', distanceM: 3200, durationSec: 2400, summary: '甲州街道' });
    expect(m.steps[0]).toEqual({ instruction: '右折', distanceM: 100, durationSec: 90, maneuver: 'TURN_RIGHT' });
    expect(m.overviewPath).toEqual([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }]);
    expect(pathToLatLngs(undefined)).toEqual([]);
  });
});
