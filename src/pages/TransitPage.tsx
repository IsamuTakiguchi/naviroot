import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Place, RouteQuery, TimeType, TransitPlan } from '../types';
import { RouteForm } from '../components/RouteForm';
import { TransitResultList } from '../components/TransitResultList';
import { TransitDetail } from '../components/TransitDetail';
import { HistoryList } from '../components/HistoryList';
import { MapView } from '../components/MapView';
import { ErrorDetail } from '../components/ErrorDetail';
import { ExternalTransitLinks } from '../components/ExternalTransitLinks';
import { NavitimeKeyNotice } from '../components/NavitimeKeyNotice';
import { useTransitSearch } from '../hooks/useTransitSearch';
import { useHistory } from '../hooks/useHistory';
import { useFavorites } from '../hooks/useFavorites';
import { paramsToQuery, queryToParams } from '../lib/query';
import { formatDateJa, formatTime } from '../lib/format';

export function TransitPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const initial = useMemo(() => paramsToQuery(params), [params]);
  const [from, setFrom] = useState<Place | undefined>(initial.from);
  const [to, setTo] = useState<Place | undefined>(initial.to);
  const [time, setTime] = useState<string | undefined>(initial.time);
  const [timeType, setTimeType] = useState<TimeType>(initial.timeType ?? 'departure');
  const [selected, setSelected] = useState<TransitPlan | undefined>();
  const [showMap, setShowMap] = useState(false);
  const transit = useTransitSearch();
  const history = useHistory();
  const favorites = useFavorites();
  const lastRun = useRef<string>('');
  const plans = transit.plans;

  const run = useCallback(
    async (q: RouteQuery) => {
      setSelected(undefined);
      setShowMap(false);
      let resolvedFrom = q.from;
      let resolvedTo = q.to;
      const result = await transit.search(q, {
        onResolved: (f, t) => {
          resolvedFrom = f;
          resolvedTo = t;
          setFrom(f);
          setTo(t);
        },
      });
      if (result) history.add(resolvedFrom, resolvedTo, 'TRANSIT');
    },
    [transit, history],
  );

  // URL に条件が揃っていれば自動検索（共有リンク・履歴からの遷移）。
  // Places ライブラリの読み込みを待つが、Google Maps が読み込めない環境でも外部サービスへの引き渡しはできるよう、数秒で諦めて実行する。
  useEffect(() => {
    const q = paramsToQuery(params);
    if (!q.from?.name || !q.to?.name) return;
    const key = params.toString();
    if (lastRun.current === key) return;
    const start = () => {
      lastRun.current = key;
      setFrom(q.from);
      setTo(q.to);
      setTime(q.time);
      setTimeType(q.timeType ?? 'departure');
      void run({ from: q.from!, to: q.to!, mode: 'TRANSIT', time: q.time, timeType: q.timeType ?? 'departure' });
    };
    if (transit.ready) {
      start();
      return;
    }
    const timer = window.setTimeout(start, 4000);
    return () => window.clearTimeout(timer);
  }, [params, transit.ready, run]);

  const submit = () => {
    if (!from || !to) return;
    const q: RouteQuery = { from, to, mode: 'TRANSIT', time, timeType };
    const next = queryToParams(q);
    if (next.toString() === params.toString()) {
      lastRun.current = next.toString();
      void run(q);
    } else {
      setParams(next);
    }
  };

  const openMap = (plan: TransitPlan) => {
    setSelected(plan);
    setShowMap(true);
  };

  const baseDate = time ? new Date(time) : new Date();
  const isFav = from && to ? favorites.hasRoute(from, to, 'TRANSIT') : false;
  const showExternal = !!(from && to) && !!transit.error;

  return (
    <div className="page">
      <RouteForm
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        time={time}
        timeType={timeType}
        onTimeChange={(t, tt) => {
          setTime(t);
          setTimeType(tt);
        }}
        showTime
        onSubmit={submit}
        loading={transit.loading}
      />

      {transit.error && transit.errorStatus !== 'NO_PROVIDER' && (
        <div className="alert error">
          {transit.error}
          {showExternal && from && to && <ExternalTransitLinks from={from} to={to} time={time} timeType={timeType} />}
          {transit.errorStatus === 'ZERO_RESULTS' && from && to && (
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn small"
                onClick={() =>
                  navigate({ pathname: '/map', search: queryToParams({ from, to, mode: 'WALKING', timeType: 'departure' }).toString() })
                }
              >
                🚶 徒歩ルートで検索する
              </button>
            </div>
          )}
          <ErrorDetail detail={transit.errorDetail} />
        </div>
      )}

      {transit.errorStatus === 'NO_PROVIDER' && from && to && (
        <>
          <div className="alert info">
            {from.name} → {to.name} の乗換案内を、外部サービスで開けます。
            <ExternalTransitLinks from={from} to={to} time={time} timeType={timeType} />
          </div>
          <NavitimeKeyNotice />
        </>
      )}

      {transit.loading && (
        <div className="loading">
          <span className="spinner" /> 経路を検索しています…
        </div>
      )}

      {!transit.loading && plans.length > 0 && from && to && (
        <>
          <div className="section-title">
            {formatDateJa(baseDate)}{' '}
            {timeType === 'first' ? '始発' : timeType === 'last' ? '終電' : `${formatTime(baseDate)} ${timeType === 'arrival' ? '到着' : '出発'}`}
            ・ {plans.length}件
          </div>
          {selected ? (
            <>
              <button type="button" className="btn small ghost" onClick={() => setSelected(undefined)}>
                ← 一覧に戻る
              </button>
              {showMap && (
                <div className="card" style={{ padding: 0, overflow: 'hidden', height: 260 }}>
                  <MapView
                    path={selected.overviewPath}
                    bounds={selected.bounds}
                    origin={from.location}
                    destination={to.location}
                  />
                </div>
              )}
              <TransitDetail
                plan={selected}
                fromName={from.name}
                toName={to.name}
                isFavorite={isFav}
                onToggleFavorite={() => {
                  if (isFav) favorites.removeRoute(from, to, 'TRANSIT');
                  else favorites.addRoute(from, to, 'TRANSIT');
                }}
                onShowMap={() => setShowMap((v) => !v)}
              />
            </>
          ) : (
            <TransitResultList plans={plans} onSelect={openMap} />
          )}
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>乗換データ: NAVITIME API</p>
        </>
      )}

      {!transit.loading && plans.length === 0 && !transit.error && (
        <>
          {!transit.hasKey && (
            <div className="alert info" style={{ fontSize: 13 }}>
              乗換案内は NAVITIME API キーを設定するとアプリ内に表示されます。未設定の場合は検索後に Google マップ・Yahoo!乗換案内へ引き渡します。
            </div>
          )}
          {history.history.length > 0 && (
            <>
              <div className="section-title">最近の検索</div>
              <div className="card">
                <HistoryList
                  history={history.history.filter((h) => h.mode === 'TRANSIT')}
                  limit={5}
                  onOpen={(h) => navigate({ pathname: '/', search: queryToParams({ from: h.from, to: h.to, mode: 'TRANSIT', timeType: 'departure' }).toString() })}
                  onRemove={history.remove}
                />
              </div>
            </>
          )}
          {favorites.favorites.some((f) => f.kind === 'route') && (
            <>
              <div className="section-title">お気に入りルート</div>
              <div className="card">
                <ul className="list">
                  {favorites.favorites
                    .filter((f) => f.kind === 'route')
                    .map((f) =>
                      f.kind === 'route' ? (
                        <li key={f.id}>
                          <span style={{ fontSize: 20 }}>★</span>
                          <button
                            type="button"
                            className="main"
                            onClick={() =>
                              navigate({
                                pathname: f.mode === 'TRANSIT' ? '/' : '/map',
                                search: queryToParams({ from: f.from, to: f.to, mode: f.mode, timeType: 'departure' }).toString(),
                              })
                            }
                          >
                            <div className="title">
                              {f.from.name} → {f.to.name}
                            </div>
                          </button>
                        </li>
                      ) : null,
                    )}
                </ul>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
