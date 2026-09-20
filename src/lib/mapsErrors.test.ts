import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetMapsErrorCapture,
  explainMapsError,
  extractMapsErrorCode,
  getLastMapsErrorCode,
  installMapsErrorCapture,
  MAPS_AUTH_ERROR_EVENT,
} from './mapsErrors';

describe('mapsErrors', () => {
  const originalError = console.error;
  beforeEach(() => _resetMapsErrorCapture());
  afterEach(() => {
    console.error = originalError;
    _resetMapsErrorCapture();
  });

  it('extracts the error code from Google console messages', () => {
    expect(
      extractMapsErrorCode([
        'Google Maps JavaScript API error: BillingNotEnabledMapError https://developers.google.com/maps/documentation/javascript/error-messages#billing-not-enabled-map-error',
      ]),
    ).toBe('BillingNotEnabledMapError');
    expect(extractMapsErrorCode(['Google Maps JavaScript API warning: NoApiKeys'])).toBe('NoApiKeys');
    expect(extractMapsErrorCode(['unrelated', 42])).toBeUndefined();
  });

  it('dispatches an event when Google logs an auth error', () => {
    installMapsErrorCapture();
    const handler = vi.fn();
    window.addEventListener(MAPS_AUTH_ERROR_EVENT, handler);
    console.error('Google Maps JavaScript API error: RefererNotAllowedMapError https://x');
    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0][0] as CustomEvent<{ code: string }>).detail.code).toBe('RefererNotAllowedMapError');
    expect(getLastMapsErrorCode()).toBe('RefererNotAllowedMapError');
    window.removeEventListener(MAPS_AUTH_ERROR_EVENT, handler);
  });

  it('falls back to a generic code via gm_authFailure', () => {
    installMapsErrorCapture();
    const handler = vi.fn();
    window.addEventListener(MAPS_AUTH_ERROR_EVENT, handler);
    (window as unknown as { gm_authFailure: () => void }).gm_authFailure();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(getLastMapsErrorCode()).toBe('AuthFailure');
    window.removeEventListener(MAPS_AUTH_ERROR_EVENT, handler);
  });

  it('explains known and unknown codes in Japanese', () => {
    expect(explainMapsError('BillingNotEnabledMapError').title).toContain('課金');
    expect(explainMapsError('SomethingElseMapError').title).toContain('SomethingElseMapError');
  });
});
