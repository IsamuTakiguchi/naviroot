import { useEffect, useRef, type ReactNode } from 'react';

/** 1 行の高さ（px）。CSS の .wheel-item と合わせる */
export const WHEEL_ITEM_H = 44;

export interface WheelItem<T> {
  value: T;
  label: ReactNode;
  className?: string;
}

interface Props<T> {
  items: WheelItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}

/**
 * iOS の日時ピッカーのような縦スクロールのホイール。
 * scroll-snap で 1 行ずつ止まり、中央の行が選択値になる。行をタップしても選べる。
 */
export function WheelPicker<T extends string | number>({ items, value, onChange, ariaLabel, disabled, className }: Props<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const mounted = useRef(false);
  const index = Math.max(0, items.findIndex((it) => it.value === value));

  // 値が外から変わったら（5分後・現在時刻など）その行までスクロールする
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const current = Math.round(el.scrollTop / WHEEL_ITEM_H);
    if (current === index && mounted.current) return;
    el.scrollTo({ top: index * WHEEL_ITEM_H, behavior: mounted.current ? 'smooth' : 'auto' });
    mounted.current = true;
  }, [index]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const settle = () => {
    const el = ref.current;
    if (!el || disabled) return;
    const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / WHEEL_ITEM_H)));
    if (items[i] && items[i].value !== value) onChange(items[i].value);
  };

  return (
    <div className={`wheel ${disabled ? 'disabled' : ''} ${className ?? ''}`}>
      <div className="wheel-band" aria-hidden />
      <div
        ref={ref}
        className="wheel-scroll"
        role="listbox"
        aria-label={ariaLabel}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onScroll={() => {
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(settle, 110);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const next = items[index + (e.key === 'ArrowDown' ? 1 : -1)];
            if (next) onChange(next.value);
          }
        }}
      >
        {items.map((it, i) => (
          <div
            key={String(it.value)}
            role="option"
            aria-selected={i === index}
            className={`wheel-item ${i === index ? 'selected' : ''} ${it.className ?? ''}`}
            onClick={() => !disabled && onChange(it.value)}
          >
            {it.label}
          </div>
        ))}
      </div>
    </div>
  );
}
