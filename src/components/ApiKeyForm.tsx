import { useState } from 'react';
import { saveApiKey } from '../config';

interface Props {
  onSaved?: () => void;
  compact?: boolean;
}

/** Google Maps API キーの貼り付け・保存フォーム。保存後はページを再読み込みして地図ライブラリを初期化する。 */
export function ApiKeyForm({ onSaved, compact }: Props) {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    const k = key.trim();
    if (k.length < 20 || !/^[A-Za-z0-9_-]+$/.test(k)) {
      setError('API キーの形式が正しくないようです。「AIza」で始まる 39 文字前後の文字列を貼り付けてください。');
      return;
    }
    if (!saveApiKey(k)) {
      setError('この端末に保存できませんでした。ブラウザのプライベートモードでは保存できない場合があります。');
      return;
    }
    onSaved?.();
    window.location.reload();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="row" style={{ alignItems: 'stretch' }}>
        <div className="place-input" style={{ flex: 1 }}>
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="AIza… で始まる API キーを貼り付け"
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setError(undefined);
            }}
            aria-label="Google Maps API キー"
          />
        </div>
        <button type="submit" className="btn primary" disabled={!key.trim()}>
          {compact ? '保存' : '保存して開始'}
        </button>
      </div>
      {error && <div className="alert error">{error}</div>}
    </form>
  );
}
