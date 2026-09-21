import { beforeEach, describe, expect, it } from 'vitest';
import { loadJson, loadString, newId, removeKey, requestPersistentStorage, saveJson } from './storage';

describe('storage', () => {
  beforeEach(() => localStorage.clear());
  it('saves and loads JSON with a prefix', () => {
    expect(saveJson('k', { a: 1 })).toBe(true);
    expect(localStorage.getItem('naviroot:k')).toBe('{"a":1}');
    expect(loadJson('k', null)).toEqual({ a: 1 });
    removeKey('k');
    expect(loadJson('k', 'fb')).toBe('fb');
  });
  it('falls back on corrupt data', () => {
    localStorage.setItem('naviroot:bad', '{oops');
    expect(loadJson('bad', 42)).toBe(42);
  });
  it('loadString accepts JSON strings and raw strings, never throws on other types', () => {
    saveJson('s', 'AIzaKEY');
    expect(loadString('s')).toBe('AIzaKEY');
    localStorage.setItem('naviroot:raw', 'plain-key');
    expect(loadString('raw')).toBe('plain-key');
    localStorage.setItem('naviroot:num', '42');
    expect(loadString('num')).toBe('');
    localStorage.setItem('naviroot:nul', 'null');
    expect(loadString('nul', 'fb')).toBe('fb');
    expect(loadString('missing')).toBe('');
  });
  it('requestPersistentStorage tolerates missing or failing APIs', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'storage');
    Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true });
    await expect(requestPersistentStorage()).resolves.toBe(false);
    Object.defineProperty(navigator, 'storage', {
      value: { persisted: async () => false, persist: async () => true },
      configurable: true,
    });
    await expect(requestPersistentStorage()).resolves.toBe(true);
    Object.defineProperty(navigator, 'storage', {
      value: { persisted: async () => true, persist: async () => { throw new Error('x'); } },
      configurable: true,
    });
    await expect(requestPersistentStorage()).resolves.toBe(true);
    if (original) Object.defineProperty(navigator, 'storage', original);
    else delete (navigator as { storage?: unknown }).storage;
  });
  it('newId is unique', () => {
    expect(newId()).not.toBe(newId());
  });
});
