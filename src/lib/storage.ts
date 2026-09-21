/** localStorage の安全なラッパー。プライベートモード等で例外が出ても落ちない。 */

const PREFIX = 'naviroot:';

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * 文字列値の読み出し。JSON で保存された文字列を返し、JSON でない生の文字列もそのまま受け付ける。
 * 文字列以外（null や数値など）が入っていても例外にせず fallback を返す。
 */
export function loadString(key: string, fallback = ''): string {
  try {
    const raw = globalThis.localStorage?.getItem(PREFIX + key);
    if (raw == null) return fallback;
    try {
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === 'string' ? parsed : fallback;
    } catch {
      return raw;
    }
  } catch {
    return fallback;
  }
}

/**
 * ブラウザに保存領域の永続化を要求する（容量逼迫時の自動削除を避けるため）。
 * 対応していない環境や拒否された場合は false。
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    const st = globalThis.navigator?.storage;
    if (!st?.persist) return false;
    if (st.persisted && (await st.persisted())) return true;
    return await st.persist();
  } catch {
    return false;
  }
}

export function saveJson<T>(key: string, value: T): boolean {
  try {
    globalThis.localStorage?.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    globalThis.localStorage?.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

export function newId(): string {
  const c = globalThis.crypto;
  if (c && 'randomUUID' in c) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
