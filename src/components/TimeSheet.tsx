import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TimeType } from '../types';
import { dayOptions, joinLocal, shiftMinutes, splitLocal, type TimeParts } from '../lib/timeWheel';
import { WheelPicker, type WheelItem } from './WheelPicker';

interface Props {
  open: boolean;
  time?: string;
  timeType: TimeType;
  onCancel: () => void;
  /** 「完了」: 条件だけ確定する */
  onDone: (time: string | undefined, timeType: TimeType) => void;
  /** 「この条件で検索」: 確定してそのまま検索する */
  onSearch: (time: string | undefined, timeType: TimeType) => void;
}

const TIME_TYPES: { key: TimeType; label: string }[] = [
  { key: 'departure', label: '出発' },
  { key: 'arrival', label: '到着' },
  { key: 'first', label: '始発' },
  { key: 'last', label: '終電' },
];

const HOURS: WheelItem<number>[] = Array.from({ length: 24 }, (_, h) => ({ value: h, label: String(h) }));
const MINUTES: WheelItem<number>[] = Array.from({ length: 60 }, (_, m) => ({ value: m, label: String(m).padStart(2, '0') }));

/** NAVITIME の日時指定シート（出発/到着/始発/終電 と 日付・時・分のホイール） */
export function TimeSheet({ open, time, timeType, onCancel, onDone, onSearch }: Props) {
  const [type, setType] = useState<TimeType>(timeType);
  const [parts, setParts] = useState<TimeParts>(() => splitLocal(time));
  /** 「現在時刻」のまま（検索時点の時刻を使う） */
  const [isNow, setIsNow] = useState(!time);
  const days = useMemo(() => (open ? dayOptions(new Date()) : []), [open]);

  // 開くたびに、今の条件から始める
  useEffect(() => {
    if (!open) return;
    setType(timeType);
    setParts(splitLocal(time));
    setIsNow(!time);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const dayItems: WheelItem<string>[] = days.map((d) => ({
    value: d.key,
    className: `tone-${d.tone}`,
    label: (
      <>
        <span className="wd-date">{d.label}</span>
        <span className="wd-week">{d.weekday}</span>
      </>
    ),
  }));

  const dayOnly = type === 'first' || type === 'last';
  const set = (next: Partial<TimeParts>) => {
    setParts((p) => ({ ...p, ...next }));
    setIsNow(false);
  };
  const result = (): string | undefined => {
    if (dayOnly) return `${parts.day}T12:00`;
    return isNow ? undefined : joinLocal(parts);
  };

  return createPortal(
    <div className="sheet-root" role="dialog" aria-modal="true" aria-label="日時の指定">
      <div className="sheet-backdrop" onClick={onCancel} />
      <div className="sheet">
        <div className="sheet-head">
          <button type="button" className="sheet-link" onClick={onCancel}>
            キャンセル
          </button>
          <button type="button" className="sheet-link strong" onClick={() => onDone(result(), type)}>
            完了
          </button>
        </div>

        <div className="nv-segmented" role="radiogroup" aria-label="出発・到着">
          {TIME_TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={type === t.key}
              className={type === t.key ? 'active' : ''}
              onClick={() => setType(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="wheels">
          <WheelPicker items={dayItems} value={parts.day} onChange={(day) => set({ day })} ariaLabel="日付" className="w-day" />
          <WheelPicker
            items={HOURS}
            value={parts.hour}
            onChange={(hour) => set({ hour })}
            ariaLabel="時"
            disabled={dayOnly}
            className="w-num"
          />
          <WheelPicker
            items={MINUTES}
            value={parts.minute}
            onChange={(minute) => set({ minute })}
            ariaLabel="分"
            disabled={dayOnly}
            className="w-num"
          />
        </div>

        <div className="sheet-quick">
          <button type="button" className="sheet-link" disabled={dayOnly} onClick={() => set(shiftMinutes(parts, -5))}>
            5分前
          </button>
          <button
            type="button"
            className="sheet-link"
            onClick={() => {
              setParts(splitLocal(undefined));
              setIsNow(true);
            }}
          >
            現在時刻
          </button>
          <button type="button" className="sheet-link" disabled={dayOnly} onClick={() => set(shiftMinutes(parts, 5))}>
            5分後
          </button>
        </div>

        <button type="button" className="sheet-search" onClick={() => onSearch(result(), type)}>
          この条件で検索
        </button>
      </div>
    </div>,
    document.body,
  );
}
