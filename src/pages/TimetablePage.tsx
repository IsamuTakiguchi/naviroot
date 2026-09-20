import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import type { Place, TimetableEntry } from '../types';
import { RouteForm } from '../components/RouteForm';
import { TimetableView } from '../components/TimetableView';
import { ErrorDetail } from '../components/ErrorDetail';
import { buildRequest, describeError, DirectionsError, requestRoutes } from '../lib/directions';
import { collectTimetable } from '../lib/timetable';
import { paramsToQuery, queryToParams } from '../lib/query';
import { TIMETABLE_MAX_QUERIES } from '../config';
import { formatDateJa, formatTime, fromDateTimeLocal, toDateTimeLocal } from '../lib/format';

export function TimetablePage() {
  const [params, setParams] = useSearchParams();
  const initial = useMemo(() => paramsToQuery(params), [params]);
  const [from, setFrom] = useState<Place | undefined>(initial.from);
  const [to, setTo] = useState<Place | undefined>(initial.to);
  const [time, setTime] = useState<string | undefined>(initial.time);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | undefined>();
  const [errorDetail, setErrorDetail] = useState<string | undefined>();
  const [searchedAt, setSearchedAt] = useState<Date | undefined>();
  const routesLib = useMapsLibrary('routes');

  const submit = async () => {
    if (!from || !to || !routesLib) return;
    const RouteCls = routesLib.Route;
    const start = fromDateTimeLocal(time) ?? new Date();
    setLoading(true);
    setError(undefined);
    setErrorDetail(undefined);
    setEntries([]);
    setProgress(0);
    setSearchedAt(start);
    setParams(queryToParams({ from, to, mode: 'TRANSIT', time, timeType: 'departure' }));
    try {
      const result = await collectTimetable(
        async (dep) => {
          const req = buildRequest(
            { from, to, mode: 'TRANSIT', time: toDateTimeLocal(dep), timeType: 'departure' },
            { alternatives: true },
          );
          return requestRoutes(RouteCls, req);
        },
        start,
        TIMETABLE_MAX_QUERIES,
        (list, done) => {
          setEntries(list);
          setProgress(done);
        },
      );
      setEntries(result);
    } catch (err) {
      setError(err instanceof DirectionsError ? err.message : '時刻表を取得できませんでした。');
      setErrorDetail(err instanceof DirectionsError ? err.detail : describeError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="alert info">
        出発駅から到着駅への直近の出発便を表示します（Google の経路検索を最大 {TIMETABLE_MAX_QUERIES} 回呼び出します）。
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
      {error && (
        <div className="alert error">
          {error}
          <ErrorDetail detail={errorDetail} />
        </div>
      )}
      {loading && (
        <div className="loading">
          <span className="spinner" /> 出発便を取得中… ({progress}/{TIMETABLE_MAX_QUERIES})
        </div>
      )}
      {(entries.length > 0 || (!loading && searchedAt)) && from && to && (
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
        </div>
      )}
    </div>
  );
}
