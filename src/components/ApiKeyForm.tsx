import { useState } from 'react';
import { saveApiKey } from '../config';

interface Props {
  onSaved?: () => void;
  compact?: boolean;
  /** 保存処理。既定は Google Maps API キー */
  save?: (key: string) => boolean;
  /** 形式チェック。エラー文言を返すと保存しない */
  validate?: (key: string) => string | undefined;
  placeholder?: string;
  ariaLabel?: string;
  submitLabel?: string;
  /** 保存後にページを再読み込みするか（既定: true。地図ライブラリの再初期化に必要） */
  reload?: boolean;
}

const validateGoogleKey = (k: string) =>
  k.length < 20 || !/^[A-Za-z0-9_-]+$/.test(k)
    ? 'API キーの形式が正しくないようです。「AIza」で始まる 39 文字前後の文字列を貼り付けてください。'
    : undefined;

/** API キーの貼り付け・保存フォーム（Google Maps / NAVITIME 共用） */
export function ApiKeyForm({
  onSaved,
  compact,
  save = saveApiKey,
  validate = validateGoogleKey,
  placeholder = 'AIza… で始まる API キーを貼り付け',
  ariaLabel = 'Google Maps API キー',
  submitLabel,
  reload = true,
}: Props) {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    const k = key.trim();
    const problem = validate(k);
    if (problem) {
      setError(problem);
      return;
    }
    if (!save(k)) {
      setError('この端末に保存できませんでした。ブラウザのプライベートモードでは保存できない場合があります。');
      return;
    }
    onSaved?.();
    if (reload) window.location.reload();
    else setKey('');
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
            placeholder={placeholder}
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setError(undefined);
            }}
            aria-label={ariaLabel}
          />
        </div>
        <button type="submit" className="btn primary" disabled={!key.trim()}>
          {submitLabel ?? (compact ? '保存' : '保存して開始')}
        </button>
      </div>
      {error && <div className="alert error">{error}</div>}
    </form>
  );
}
