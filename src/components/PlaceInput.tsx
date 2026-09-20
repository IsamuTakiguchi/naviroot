import { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import type { Place } from '../types';

interface Props {
  value?: Place;
  placeholder: string;
  onChange: (place: Place | undefined) => void;
  onLocate?: () => void;
  locating?: boolean;
  autoFocus?: boolean;
  onSubmit?: () => void;
}

/** Google Places Autocomplete を組み込んだ入力欄。自由入力（駅名など）も Place として扱う。 */
export function PlaceInput({ value, placeholder, onChange, onLocate, locating, autoFocus, onSubmit }: Props) {
  const places = useMapsLibrary('places');
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(value?.name ?? '');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    setText(value?.name ?? '');
  }, [value?.name, value?.placeId]);

  useEffect(() => {
    if (!places || !inputRef.current) return;
    const ac = new places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'jp' },
      fields: ['place_id', 'name', 'formatted_address', 'geometry'],
    });
    const listener = ac.addListener('place_changed', () => {
      const p = ac.getPlace();
      if (!p || !p.place_id) {
        if (p?.name) onChangeRef.current({ name: p.name });
        return;
      }
      const loc = p.geometry?.location;
      const place: Place = {
        name: p.name || p.formatted_address || '',
        address: p.formatted_address,
        placeId: p.place_id,
        location: loc ? { lat: loc.lat(), lng: loc.lng() } : undefined,
      };
      setText(place.name);
      onChangeRef.current(place);
    });
    return () => {
      listener.remove();
      google.maps.event.clearInstanceListeners(ac);
    };
  }, [places]);

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
    <div className="place-input">
      <input
        ref={inputRef}
        value={text}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="search"
        onChange={(e) => setText(e.target.value)}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            // Autocomplete のドロップダウン選択中は place_changed に任せる
            const pacVisible = document.querySelector('.pac-container') as HTMLElement | null;
            if (pacVisible && pacVisible.style.display !== 'none' && pacVisible.querySelector('.pac-item-selected')) return;
            e.preventDefault();
            commitText();
            onSubmit?.();
          }
        }}
      />
      {text && (
        <button
          type="button"
          className="icon-btn"
          aria-label="クリア"
          onClick={() => {
            setText('');
            onChange(undefined);
            inputRef.current?.focus();
          }}
        >
          ×
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
          {locating ? '…' : '◎'}
        </button>
      )}
    </div>
  );
}
