import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, getStoredTheme, isThemeMode, nextTheme, resolveTheme, saveTheme, THEME_KEY, watchSystemTheme } from './theme';

describe('theme', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    delete document.documentElement.dataset.theme;
    vi.unstubAllGlobals();
  });

  it('isThemeMode accepts only the three modes', () => {
    expect(isThemeMode('system')).toBe(true);
    expect(isThemeMode('dark')).toBe(true);
    expect(isThemeMode('sepia')).toBe(false);
    expect(isThemeMode(null)).toBe(false);
  });

  it('stores and reads the mode, falling back to system', () => {
    expect(getStoredTheme()).toBe('system');
    saveTheme('dark');
    expect(localStorage.getItem(`naviroot:${THEME_KEY}`)).toBe('"dark"');
    expect(getStoredTheme()).toBe('dark');
    localStorage.setItem(`naviroot:${THEME_KEY}`, '"sepia"');
    expect(getStoredTheme()).toBe('system');
  });

  it('resolveTheme follows the system preference only for system', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('applyTheme sets data-theme on the html element', () => {
    expect(applyTheme('dark', false)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    applyTheme('system', false);
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('nextTheme flips between light and dark', () => {
    expect(nextTheme('light', false)).toBe('dark');
    expect(nextTheme('dark', false)).toBe('light');
    expect(nextTheme('system', true)).toBe('light');
    expect(nextTheme('system', false)).toBe('dark');
  });

  it('watchSystemTheme subscribes and unsubscribes', () => {
    const add = vi.fn();
    const remove = vi.fn();
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: add, removeEventListener: remove }));
    const off = watchSystemTheme(() => {});
    expect(add).toHaveBeenCalledWith('change', expect.any(Function));
    off();
    expect(remove).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
