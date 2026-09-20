import { NAVITIME_FREE_LIMIT, saveNavitimeKey } from '../config';
import { ApiKeyForm } from './ApiKeyForm';

const RAPIDAPI_URL = 'https://rapidapi.com/navitimejapan-navitimejapan/api/navitime-route-totalnavi';

export const validateNavitimeKey = (k: string) =>
  k.length < 20 || !/^[A-Za-z0-9_-]+$/.test(k) ? 'RapidAPI のキー（英数字 50 文字前後）を貼り付けてください。' : undefined;

/** NAVITIME 乗換 API（RapidAPI）のキー取得手順と入力欄 */
export function NavitimeKeyNotice({ compact }: { compact?: boolean }) {
  return (
    <div className="card">
      <h2>アプリ内で乗換案内を表示するには（無料・約 3 分）</h2>
      <p style={{ marginTop: 0, fontSize: 14 }}>
        Google の API は日本の電車・バスの乗換案内に対応していないため、乗換案内には NAVITIME の API を使います。RapidAPI
        で無料登録すると、月 {NAVITIME_FREE_LIMIT} 回まで無料で検索できます。
      </p>
      {!compact && (
        <ol style={{ fontSize: 14 }}>
          <li>
            <a href={RAPIDAPI_URL} target="_blank" rel="noreferrer">
              RapidAPI の NAVITIME Route(totalnavi) ページ
            </a>
            を開き、右上の Sign Up からアカウントを作成します（Google アカウントでも可）。
          </li>
          <li>「Pricing」タブで <strong>Basic（$0 / 月 {NAVITIME_FREE_LIMIT} 回）</strong> の「Subscribe」を押します。</li>
          <li>
            「Endpoints」タブに戻ると、コード例の中に <code>X-RapidAPI-Key</code> の値（英数字の長い文字列）が表示されます。それをコピーして下に貼り付けます。
          </li>
        </ol>
      )}
      <ApiKeyForm
        save={saveNavitimeKey}
        validate={validateNavitimeKey}
        placeholder="RapidAPI の X-RapidAPI-Key を貼り付け"
        ariaLabel="NAVITIME API キー"
        submitLabel="保存"
        compact
      />
      <p className="alert info" style={{ fontSize: 13, marginBottom: 0 }}>
        キーはこの端末のブラウザ内にだけ保存されます。無料枠を超えた場合や、キーを設定しない場合は Google マップ・Yahoo!乗換案内に検索条件を引き渡します。
      </p>
    </div>
  );
}
