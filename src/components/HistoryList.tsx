import type { HistoryItem } from '../types';
import { formatDateJa, formatTime, MODE_ICON } from '../lib/format';

interface Props {
  history: HistoryItem[];
  onOpen: (h: HistoryItem) => void;
  onRemove: (id: string) => void;
  onClear?: () => void;
  limit?: number;
}

export function HistoryList({ history, onOpen, onRemove, onClear, limit }: Props) {
  const items = limit ? history.slice(0, limit) : history;
  if (items.length === 0) return <div className="empty">検索履歴はありません。</div>;
  return (
    <>
      <ul className="list">
        {items.map((h) => {
          const d = new Date(h.searchedAt);
          return (
            <li key={h.id}>
              <span style={{ fontSize: 20 }}>{MODE_ICON[h.mode]}</span>
              <button type="button" className="main" onClick={() => onOpen(h)}>
                <div className="title">
                  {h.from.name} → {h.to.name}
                </div>
                <div className="sub">
                  {formatDateJa(d)} {formatTime(d)}
                </div>
              </button>
              <button type="button" className="icon-btn" aria-label="削除" onClick={() => onRemove(h.id)}>
                ×
              </button>
            </li>
          );
        })}
      </ul>
      {onClear && history.length > 0 && (
        <button type="button" className="btn small ghost danger" onClick={onClear} style={{ marginTop: 6 }}>
          履歴をすべて削除
        </button>
      )}
    </>
  );
}
