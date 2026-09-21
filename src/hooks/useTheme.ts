import { useCallback, useEffect, useState } from 'react';
import { applyTheme, prefersDark, resolveTheme, saveTheme, THEME_KEY, watchSystemTheme, type ThemeMode } from '../lib/theme';
import { useLocalState } from './useLocalState';

/** テーマの選択（端末の設定 / ライト / ダーク）。html の data-theme に反映する。 */
export function useTheme() {
  const [mode, setMode] = useLocalState<ThemeMode>(THEME_KEY, 'system');
  const [systemDark, setSystemDark] = useState(prefersDark);

  useEffect(() => watchSystemTheme(setSystemDark), []);
  useEffect(() => {
    applyTheme(mode, systemDark);
  }, [mode, systemDark]);

  const update = useCallback(
    (next: ThemeMode) => {
      saveTheme(next);
      setMode(next);
    },
    [setMode],
  );

  return { mode, resolved: resolveTheme(mode, systemDark), setMode: update };
}
