import type { Favorite } from '../types';
import { MODE_ICON } from '../lib/format';
import { Icon, type IconName } from './Icon';

const LABEL_ICON: Record<'home' | 'work' | 'other', IconName> = { home: 'home', work: 'work', other: 'pin' };
const LABEL_TEXT = { home: '自宅', work: '職場', other: 'スポット' } as const;

interface Props {
  favorites: Favorite[];
  onOpen: (f: Favorite) => void;
  onGoTo?: (f: Favorite) => void;
  onRemove: (id: string) => void;
}

export function FavoriteList({ favorites, onOpen, onGoTo, onRemove }: Props) {
  if (favorites.length === 0) return <div className="empty">お気に入りはまだありません。</div>;
  return (
    <ul className="list">
      {favorites.map((f) => (
        <li key={f.id}>
          <span style={{ color: 'var(--accent)', display: 'inline-flex' }}>
            <Icon name={f.kind === 'place' ? LABEL_ICON[f.label] : MODE_ICON[f.mode]} size={22} />
          </span>
          <button type="button" className="main" onClick={() => onOpen(f)}>
            {f.kind === 'place' ? (
              <>
                <div className="title">
                  {f.place.name}
                  <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 6, color: 'var(--color-text-muted)' }}>
                    {LABEL_TEXT[f.label]}
                  </span>
                </div>
                <div className="sub">{f.place.address ?? '地図で表示'}</div>
              </>
            ) : (
              <>
                <div className="title">
                  {f.from.name} → {f.to.name}
                </div>
                <div className="sub">タップで検索</div>
              </>
            )}
          </button>
          {f.kind === 'place' && onGoTo && (
            <button type="button" className="btn small" onClick={() => onGoTo(f)}>
              ここへ
            </button>
          )}
          <button type="button" className="icon-btn" aria-label="削除" onClick={() => onRemove(f.id)}>
            <Icon name="trash" size={18} />
          </button>
        </li>
      ))}
    </ul>
  );
}
