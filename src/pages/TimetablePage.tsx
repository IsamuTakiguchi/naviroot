import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import type { Place, TimetableEntry, TransitFilter } from '../types';
import { RouteForm } from '../components/RouteForm';
import { TimetableView } from '../components/TimetableView';
import { ErrorDetail } from '../components/ErrorDetail';
import { ExternalTransitLinks } from '../components/ExternalTransitLinks';
import { NavitimeKeyNotice } from '../components/NavitimeKeyNotice';
import { collectTimetable } from '../lib/timetable';
import { resolvePair } from '../lib/places';
import { buildNavitimeParams, NAVITIME_MESSAGES, NavitimeError, requestNavitimePlans } from '../lib/navitime';
import { paramsToQuery, queryToParams } from '../lib/query';
import { getNavitimeKey, TIMETABLE_MAX_QUERIES } from '../config';
import { formatDateJa, formatTime, fromDateTimeLocal, toDateTimeLocal } from '../lib/format';

export function TimetablePage() {
  const [params, setParams] = useSearchParams();
  const initial = useMemo(() => paramsToQuery(params), [params]);
  const [from, setFrom] = useState<Place | undefined>(initial.from);
  const [to, setTo] = useState<Place | undefined>(initial.to);
  const [time, setTime] = useState<string | undefined>(initial.time);
  const [filter, setFilter] = useState<TransitFilter>(initial.filter ?? 'all');
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | undefined>();
  const [errorStatus, setErrorStatus] = useState<string | undefined>();
  const [errorDetail, setErrorDetail] = useState<string | undefined>();
  const [searchedAt, setSearchedAt] = useState<Date | undefined>();
  const placesLib = useMapsLibrary('places');
  const hasKey = !!getNavitimeKey();

  const submit = async () => {
    if (!from || !to) return;
    const key = getNavitimeKey();
    const start = fromDateTimeLocal(time) ?? new Date();
    setLoading(true);
    setError(undefined);
    setErrorStatus(undefined);
    setErrorDetail(undefined);
    setEntries([]);
    setProgress(0);
    setSearchedAt(start);
    setParams(queryToParams({ from, to, mode: 'TRANSIT', time, timeType: 'departure', filter }));
    try {
      const resolved = await resolvePair(placesLib, from, to);
      setFrom(resolved.from);
      setTo(resolved.to);
      if (!key) throw new NavitimeError('NO_PROVIDER', NAVITIME_MESSAGES.NO_PROVIDER);
      const f = resolved.from.location;
      const t = resolved.to.location;
      if (!f || !t) throw new NavitimeError('RESOLVE', NAVITIME_MESSAGES.RESOLVE);
      const result = await collectTimetable(
        async (dep) => requestNavitimePlans(key, buildNavitimeParams(f, t, 'departure', toDateTimeLocal(dep), 5, filter)),
        start,
        TIMETABLE_MAX_QUERIES,
        (list, done) => {
          setEntries(list);
          setProgress(done);
        },
      );
      setEntries(result);
    } catch (err) {
      if (err instanceof NavitimeError) {
        setError(err.message);
        setErrorStatus(err.status);
        setErrorDetail(err.detail);
      } else {
        setError('時刻表を取得できませんでした。');
        setErrorStatus('SERVER');
        setErrorDetail(err instanceof Error ? `${err.name} ${err.message}` : String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="alert info">
        出発駅から到着駅への直近の出発便を表示します（NAVITIME API を最大 {TIMETABLE_MAX_QUERIES} 回呼び出すため、無料枠を消費します）。
      </div>
      <RouteForm
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        time={time}
        timeType="departure"
        onTimeChange={(t) => setTime(t)}
        showTime={false}
        filter={filter}
        onFilterChange={setFilter}
        onSubmit={() => void submit()}
        submitLabel="出発時刻を調べる"
        loading={loading}
      />
      <div className="card">
        <div className="row">
          <label htmlFor="tt-time" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            基準時刻
          </label>
          <input
            id="tt-time"
            type="datetime-local"
            value={time ?? toDateTimeLocal(new Date())}
            onChange={(e) => setTime(e.target.value || undefined)}
            style={{ flex: 1, border: '1px solid var(--color-border)', borderRadius: 10, padding: '8px 10px', background: 'var(--color-surface-2)' }}
          />
          <button type="button" className="btn small" onClick={() => setTime(undefined)}>
            今
          </button>
        </div>
      </div>
      {!hasKey && !error && <NavitimeKeyNotice compact />}
      {error && errorStatus === 'NO_PROVIDER' && from && to && (
        <>
          <div className="alert info">
            {from.name} → {to.name} の時刻表・乗換案内を、外部サービスで開けます。
            <ExternalTransitLinks from={from} to={to} time={time} timeType="departure" />
          </div>
          <NavitimeKeyNotice />
        </>
      )}
      {error && errorStatus !== 'NO_PROVIDER' && (
        <div className="alert error">
          {error}
          {from && to && <ExternalTransitLinks from={from} to={to} time={time} timeType="departure" />}
          <ErrorDetail detail={errorDetail} />
        </div>
      )}
      {loading && (
        <div className="loading">
          <span className="spinner" /> 出発便を取得中… ({progress}/{TIMETABLE_MAX_QUERIES})
        </div>
      )}
      {(entries.length > 0 || (!loading && searchedAt && !error)) && from && to && (
        <div className="card">
          <h2>
            {from.name} → {to.name}
          </h2>
          {searchedAt && (
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 6 }}>
              {formatDateJa(searchedAt)} {formatTime(searchedAt)} 以降 ・ {entries.length}便
            </div>
          )}
          <TimetableView entries={entries} />
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 0 }}>乗換データ: NAVITIME API</p>
        </div>
      )}
    </div>
  );
}
