import { useCallback } from 'react';
import type { HistoryItem, Place, TravelMode } from '../types';
import { newId } from '../lib/storage';
import { HISTORY_LIMIT } from '../config';
import { useLocalState } from './useLocalState';
import { samePlace } from './useFavorites';
import { useSettings } from './useSettings';

export const HISTORY_KEY = 'history';

export function useHistory() {
  const [history, setHistory] = useLocalState<HistoryItem[]>(HISTORY_KEY, []);
  const { settings } = useSettings();

  const add = useCallback(
    (from: Place, to: Place, mode: TravelMode) => {
      if (!settings.saveHistory) return;
      setHistory((prev) => {
        const rest = prev.filter((h) => !(h.mode === mode && samePlace(h.from, from) && samePlace(h.to, to)));
        return [{ id: newId(), from, to, mode, searchedAt: new Date().toISOString() }, ...rest].slice(0, HISTORY_LIMIT);
      });
    },
    [setHistory, settings.saveHistory],
  );

  const remove = useCallback((id: string) => setHistory((prev) => prev.filter((h) => h.id !== id)), [setHistory]);
  const clear = useCallback(() => setHistory([]), [setHistory]);

  return { history, add, remove, clear };
}
