import { useEffect, useMemo, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import type { LatLng, Place } from '../types';
import { DEFAULT_CENTER } from '../config';
import { Icon } from './Icon';

interface Props {
  value?: Place;
  placeholder: string;
  onChange: (place: Place | undefined) => void;
  onLocate?: () => void;
  locating?: boolean;
  autoFocus?: boolean;
  onSubmit?: () => void;
  /** 候補の優先地域（現在地など） */
  bias?: LatLng;
}

interface Suggestion {
  placeId: string;
  main: string;
  secondary: string;
  prediction: google.maps.places.PlacePrediction;
}

const DEBOUNCE_MS = 250;

/**
 * Places API (New) の AutocompleteSuggestion を使った入力欄。
 * 候補を選ぶと Place.fetchFields で座標・住所を取得する。自由入力（Enter）も Place として扱う。
 */
export function PlaceInput({ value, placeholder, onChange, onLocate, locating, autoFocus, onSubmit, bias }: Props) {
  const places = useMapsLibrary('places');
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(value?.name ?? '');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const seq = useRef(0);
  const skipNextFetch = useRef(false);

  useEffect(() => {
    setText(value?.name ?? '');
    skipNextFetch.current = true;
  }, [value?.name, value?.placeId]);

  const biasCenter = useMemo(() => bias ?? DEFAULT_CENTER, [bias]);

  // 入力のデバウンス → 候補取得
  useEffect(() => {
    if (!places) return;
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    const q = text.trim();
    if (q.length < 1) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const my = ++seq.current;
    const timer = window.setTimeout(async () => {
      try {
        if (!sessionRef.current) sessionRef.current = new places.AutocompleteSessionToken();
        const { suggestions: list } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: q,
          includedRegionCodes: ['jp'],
          language: 'ja',
          region: 'jp',
          sessionToken: sessionRef.current,
          locationBias: { center: biasCenter, radius: 50_000 },
        });
        if (my !== seq.current) return;
        const next: Suggestion[] = list
          .map((s) => s.placePrediction)
          .filter((p): p is google.maps.places.PlacePrediction => !!p)
          .map((p) => ({
            placeId: p.placeId,
            main: p.mainText?.text ?? p.text.text,
            secondary: p.secondaryText?.text ?? '',
            prediction: p,
          }));
        setSuggestions(next);
        setOpen(next.length > 0);
        setActive(-1);
      } catch {
        if (my !== seq.current) return;
        setSuggestions([]);
        setOpen(false);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [text, places, biasCenter]);

  // 外側クリックで閉じる
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, []);

  const choose = async (s: Suggestion) => {
    setOpen(false);
    setBusy(true);
    skipNextFetch.current = true;
    setText(s.main);
    try {
      const { place } = await s.prediction.toPlace().fetchFields({ fields: ['location', 'formattedAddress', 'displayName'] });
      const loc = place.location;
      onChange({
        name: place.displayName || s.main,
        address: place.formattedAddress ?? s.secondary,
        placeId: s.placeId,
        location: loc ? { lat: loc.lat(), lng: loc.lng() } : undefined,
      });
    } catch {
      // 詳細取得に失敗しても placeId は使える（Routes API 側で解決される）
      onChange({ name: s.main, address: s.secondary, placeId: s.placeId });
    } finally {
      sessionRef.current = null; // セッション終了（次の入力で新規発行）
      setBusy(false);
    }
  };

  const commitText = () => {
    const t = text.trim();
    if (!t) {
      onChange(undefined);
      return;
    }
    if (value && value.name === t) return;
    onChange({ name: t });
  };

  return (
    <div className="place-input-wrap" ref={wrapRef}>
      <div className="place-input">
        <input
          ref={inputRef}
          value={text}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          enterKeyHint="search"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          onChange={(e) => setText(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => {
            // 候補のクリックは onMouseDown で preventDefault しているので blur は起きない。
            // それ以外（検索ボタンのタップ等）ではその場で確定し、1 回のタップで検索できるようにする。
            setOpen(false);
            commitText();
          }}
          onKeyDown={(e) => {
            if (open && e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, suggestions.length - 1));
            } else if (open && e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Escape') {
              setOpen(false);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (open && active >= 0 && suggestions[active]) {
                void choose(suggestions[active]);
                return;
              }
              setOpen(false);
              commitText();
              onSubmit?.();
            }
          }}
        />
        {busy && <span className="spinner" style={{ width: 16, height: 16, marginRight: 6 }} />}
        {text && !busy && (
          <button
            type="button"
            className="icon-btn"
            aria-label="クリア"
            onClick={() => {
              setText('');
              setSuggestions([]);
              setOpen(false);
              onChange(undefined);
              inputRef.current?.focus();
            }}
          >
            <Icon name="close" size={16} />
          </button>
        )}
        {onLocate && (
          <button
            type="button"
            className="icon-btn primary"
            aria-label="現在地を使う"
            title="現在地を使う"
            onClick={onLocate}
            disabled={locating}
          >
            {locating ? '…' : <Icon name="locate" size={20} />}
          </button>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <ul className="suggestions" role="listbox">
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              role="option"
              aria-selected={i === active}
              className={`suggestion ${i === active ? 'active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void choose(s)}
            >
              <span className="main">{s.main}</span>
              {s.secondary && <span className="sub">{s.secondary}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
