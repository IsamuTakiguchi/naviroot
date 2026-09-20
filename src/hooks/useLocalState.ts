import { useCallback, useEffect, useState } from 'react';
import { loadJson, saveJson } from '../lib/storage';

const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

/** localStorage と同期する useState。同じキーを使うコンポーネント間で同期される。 */
export function useLocalState<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => loadJson(key, fallback));

  useEffect(() => {
    const fn = () => setValue(loadJson(key, fallback));
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key)!.add(fn);
    return () => {
      listeners.get(key)?.delete(fn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(loadJson(key, fallback)) : next;
      saveJson(key, resolved);
      setValue(resolved);
      notify(key);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return [value, set];
}
