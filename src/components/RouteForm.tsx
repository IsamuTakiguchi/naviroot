import { useState } from 'react';
import type { Place, TimeType, TransitFilter } from '../types';
import { FILTER_LABEL } from '../lib/navitime';
import { Icon, type IconName } from './Icon';
import { PlaceInput } from './PlaceInput';
import { useGeolocation } from '../hooks/useGeolocation';
import { useFavorites } from '../hooks/useFavorites';
import { toDateTimeLocal } from '../lib/format';

interface Props {
  from?: Place;
  to?: Place;
  onFromChange: (p: Place | undefined) => void;
  onToChange: (p: Place | undefined) => void;
  time?: string;
  timeType?: TimeType;
  onTimeChange?: (time: string | undefined, timeType: TimeType) => void;
  showTime?: boolean;
  /** 交通手段の絞り込み（指定するとチップを表示） */
  filter?: TransitFilter;
  onFilterChange?: (f: TransitFilter) => void;
  onSubmit: () => void;
  submitLabel?: string;
  loading?: boolean;
}

const FILTERS: { key: TransitFilter; icons: IconName[] }[] = [
  { key: 'all', icons: ['train', 'bus'] },
  { key: 'bus', icons: ['bus'] },
  { key: 'train', icons: ['train'] },
  { key: 'no_express', icons: ['express'] },
];

const TIME_TYPES: { key: TimeType; label: string }[] = [
  { key: 'departure', label: '出発' },
  { key: 'arrival', label: '到着' },
  { key: 'first', label: '始発' },
  { key: 'last', label: '終電' },
];

export function RouteForm(props: Props) {
  const {
    from,
    to,
    onFromChange,
    onToChange,
    time,
    timeType = 'departure',
    onTimeChange,
    showTime,
    filter = 'all',
    onFilterChange,
    onSubmit,
    loading,
  } = props;
  const geo = useGeolocation();
  const { home, work } = useFavorites();
  const [locatingFor, setLocatingFor] = useState<'from' | 'to' | null>(null);

  const useCurrent = async (target: 'from' | 'to') => {
    setLocatingFor(target);
    const pos = await geo.locate();
    setLocatingFor(null);
    if (!pos) return;
    const place: Place = { name: '現在地', location: pos };
    if (target === 'from') onFromChange(place);
    else onToChange(place);
  };

  const swap = () => {
    onFromChange(to);
    onToChange(from);
  };

  const timeValue = time ?? toDateTimeLocal(new Date());
  const canSubmit = !!from?.name && !!to?.name && !loading;

  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit();
      }}
    >
      <div className="route-form">
        <div className="dots">
          <span className="dot" />
          <span className="line" />
          <span className="dot to" />
        </div>
        <PlaceInput
          value={from}
          placeholder="出発地（駅名・住所・スポット）"
          onChange={onFromChange}
          onLocate={() => useCurrent('from')}
          locating={locatingFor === 'from'}
          bias={geo.position}
        />
        <button type="button" className="icon-btn swap" aria-label="出発地と目的地を入れ替え" onClick={swap}>
          <Icon name="swap" size={20} />
        </button>
        <PlaceInput
          value={to}
          placeholder="目的地（駅名・住所・スポット）"
          onChange={onToChange}
          onLocate={() => useCurrent('to')}
          locating={locatingFor === 'to'}
          bias={geo.position}
          onSubmit={() => {
            if (canSubmit) onSubmit();
          }}
        />
      </div>
      {geo.error && <div className="alert error">{geo.error}</div>}
      {(home || work) && (
        <div className="chips" style={{ marginTop: 8 }}>
          {home && (
            <>
              <button type="button" className="chip" onClick={() => onToChange(home)}>
                <Icon name="home" size={16} /> 自宅へ
              </button>
              <button type="button" className="chip" onClick={() => onFromChange(home)}>
                <Icon name="home" size={16} /> 自宅から
              </button>
            </>
          )}
          {work && (
            <>
              <button type="button" className="chip" onClick={() => onToChange(work)}>
                <Icon name="work" size={16} /> 職場へ
              </button>
              <button type="button" className="chip" onClick={() => onFromChange(work)}>
                <Icon name="work" size={16} /> 職場から
              </button>
            </>
          )}
        </div>
      )}
      {showTime && onTimeChange && (
        <div className="time-row">
          <div className="segmented" style={{ flex: '1 1 100%' }}>
            {TIME_TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                className={timeType === t.key ? 'active' : ''}
                onClick={() => onTimeChange(time, t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {timeType === 'first' || timeType === 'last' ? (
            <input
              type="date"
              value={timeValue.slice(0, 10)}
              onChange={(e) => onTimeChange(e.target.value ? `${e.target.value}T12:00` : undefined, timeType)}
            />
          ) : (
            <input
              type="datetime-local"
              value={timeValue}
              onChange={(e) => onTimeChange(e.target.value || undefined, timeType)}
            />
          )}
          <button type="button" className="btn small" onClick={() => onTimeChange(undefined, timeType)}>
            現在時刻
          </button>
        </div>
      )}
      {onFilterChange && (
        <div className="chips" style={{ marginTop: 10 }} role="radiogroup" aria-label="交通手段">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="radio"
              aria-checked={filter === f.key}
              className={`chip ${filter === f.key ? 'active' : ''}`}
              onClick={() => onFilterChange(f.key)}
            >
              {f.icons.map((ic) => (
                <Icon key={ic} name={ic} size={16} />
              ))}{' '}
              {FILTER_LABEL[f.key]}
            </button>
          ))}
        </div>
      )}
      <button type="submit" className="btn primary block" style={{ marginTop: 12 }} disabled={!canSubmit}>
        {loading ? '検索中…' : (props.submitLabel ?? '検索')}
      </button>
    </form>
  );
}
