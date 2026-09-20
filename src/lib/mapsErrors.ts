/**
 * Google Maps JavaScript API の認証エラー（gm_authFailure / console の "Google Maps JavaScript API error: XxxMapError"）を
 * 捕捉して、アプリ内で日本語の原因説明を出せるようにする。
 */

export const MAPS_AUTH_ERROR_EVENT = 'naviroot:maps-auth-error';

export interface MapsAuthErrorDetail {
  code: string;
}

interface Explanation {
  title: string;
  fix: string;
}

const EXPLANATIONS: Record<string, Explanation> = {
  BillingNotEnabledMapError: {
    title: 'API キーのプロジェクトで課金が有効になっていません',
    fix: 'Google Cloud Console で、キーを作成したプロジェクトに請求先アカウントを紐付けてください。課金が有効な別のプロジェクトでキーを作り直すのが最も簡単です。',
  },
  RefererNotAllowedMapError: {
    title: 'このサイトの URL が API キーの「ウェブサイトの制限」に含まれていません',
    fix: 'Google Cloud Console → 認証情報 → 該当キー → アプリケーションの制限「ウェブサイト」に、下に表示した URL を追加してください（反映まで数分かかります）。',
  },
  ApiNotActivatedMapError: {
    title: 'Maps JavaScript API が有効になっていません',
    fix: 'Google Cloud Console → API とサービス → ライブラリで「Maps JavaScript API」を有効にしてください。',
  },
  ApiTargetBlockedMapError: {
    title: 'API キーの「API の制限」で Maps JavaScript API が許可されていません',
    fix: 'キーの API の制限を「制限なし」にするか、Maps JavaScript API・Places API (New)・Routes API を許可リストに追加してください。',
  },
  InvalidKeyMapError: {
    title: 'API キーが正しくありません',
    fix: 'Google Cloud Console の認証情報に表示されているキーをそのままコピーして、マイページから設定し直してください。',
  },
  ExpiredKeyMapError: {
    title: 'API キーがまだ有効になっていないか、期限切れです',
    fix: '作成直後の場合は数分待ってから再読み込みしてください。それでも直らなければキーを作り直してください。',
  },
  DeletedApiProjectMapError: {
    title: 'キーのプロジェクトが削除されています',
    fix: '課金が有効なプロジェクトで新しい API キーを作成してください。',
  },
  ProjectDeniedMapError: {
    title: 'プロジェクト側でリクエストが拒否されました',
    fix: 'Google Cloud Console の通知や「API とサービス」のエラー詳細を確認してください。',
  },
  OverQuotaMapError: {
    title: '利用上限（割り当て）を超えています',
    fix: '翌日まで待つか、Google Cloud Console で割り当てを増やしてください。',
  },
  MissingKeyMapError: {
    title: 'API キーが送信されていません',
    fix: 'マイページから API キーを設定してください。',
  },
};

export function explainMapsError(code: string): Explanation {
  return (
    EXPLANATIONS[code] ?? {
      title: `Google Maps の認証に失敗しました（${code}）`,
      fix: 'キーのプロジェクトで課金が有効か、Maps JavaScript API が有効か、キーの制限設定を確認してください。',
    }
  );
}

const PATTERN = /Google Maps JavaScript API (?:error|warning): (\w+)/;

export function extractMapsErrorCode(args: unknown[]): string | undefined {
  for (const a of args) {
    if (typeof a !== 'string') continue;
    const m = PATTERN.exec(a);
    if (m) return m[1];
  }
  return undefined;
}

let installed = false;
let lastCode: string | undefined;

export function getLastMapsErrorCode(): string | undefined {
  return lastCode;
}

function emit(code: string) {
  lastCode = code;
  window.dispatchEvent(new CustomEvent<MapsAuthErrorDetail>(MAPS_AUTH_ERROR_EVENT, { detail: { code } }));
}

/** Maps スクリプトの読み込み前（アプリ起動時）に一度だけ呼ぶ。 */
export function installMapsErrorCapture(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const wrap = (method: 'error' | 'warn') => {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      original(...args);
      const code = extractMapsErrorCode(args);
      if (code && code.endsWith('MapError')) emit(code);
    };
  };
  wrap('error');
  wrap('warn');

  // Google が認証失敗時に呼ぶグローバルコールバック。コンソール出力の方が先に届くことが多いが、保険として定義する。
  (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
    if (!lastCode) emit('AuthFailure');
  };
}

/** テスト用 */
export function _resetMapsErrorCapture(): void {
  installed = false;
  lastCode = undefined;
}
