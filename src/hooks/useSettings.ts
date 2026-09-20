import { useCallback } from 'react';
import type { Settings } from '../types';
import { useLocalState } from './useLocalState';

export const SETTINGS_KEY = 'settings';
export const DEFAULT_SETTINGS: Settings = { defaultMode: 'TRANSIT', saveHistory: true, autoFollowups: true };

export function useSettings() {
  const [stored, setStored] = useLocalState<Partial<Settings>>(SETTINGS_KEY, {});
  const settings: Settings = { ...DEFAULT_SETTINGS, ...stored };
  const update = useCallback((patch: Partial<Settings>) => setStored((prev) => ({ ...prev, ...patch })), [setStored]);
  return { settings, update };
}
