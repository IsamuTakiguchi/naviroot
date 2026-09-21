import { loadJson, saveJson } from './storage';

/**
 * テーマの切り替え。`<html data-theme="light|dark">` を付け替えることで配色を決める。
 * 'system' は端末の設定（prefers-color-scheme）に追従する。
 */

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_KEY = 'theme';
export const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark'];

export const THEME_LABEL: Record<ThemeMode, string> = {
  system: '端末の設定',
  light: 'ライト',
  dark: 'ダーク',
};

export function isThemeMode(v: unknown): v is ThemeMode {
  return typeof v === 'string' && (THEME_MODES as string[]).includes(v);
}

export function getStoredTheme(): ThemeMode {
  const v = loadJson<unknown>(THEME_KEY, 'system');
  return isThemeMode(v) ? v : 'system';
}

export function saveTheme(mode: ThemeMode): void {
  saveJson(THEME_KEY, mode);
}

/** 端末がダークを好むか */
export function prefersDark(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

/** 'system' を実際の配色に解決する */
export function resolveTheme(mode: ThemeMode, systemDark: boolean = prefersDark()): ResolvedTheme {
  if (mode === 'light' || mode === 'dark') return mode;
  return systemDark ? 'dark' : 'light';
}

/** html 要素に配色を反映する */
export function applyTheme(mode: ThemeMode, systemDark: boolean = prefersDark()): ResolvedTheme {
  const resolved = resolveTheme(mode, systemDark);
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = resolved;
  return resolved;
}

/** 'system' のときだけ端末設定の変化に追従する。戻り値は解除関数。 */
export function watchSystemTheme(onChange: (systemDark: boolean) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => onChange(e.matches);
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}

/** 切り替えボタン用: ライト ⇄ ダークを往復する */
export function nextTheme(mode: ThemeMode, systemDark: boolean = prefersDark()): ThemeMode {
  return resolveTheme(mode, systemDark) === 'dark' ? 'light' : 'dark';
}
