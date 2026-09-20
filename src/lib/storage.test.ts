import { beforeEach, describe, expect, it } from 'vitest';
import { loadJson, newId, removeKey, saveJson } from './storage';

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
  it('newId is unique', () => {
    expect(newId()).not.toBe(newId());
  });
});
