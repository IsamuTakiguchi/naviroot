import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { LatLng, MapRoute, Place, RouteQuery, TravelMode } from '../types';
import { RouteForm } from '../components/RouteForm';
import { MapView } from '../components/MapView';
import { RouteSummary } from '../components/RouteSummary';
import { ErrorDetail } from '../components/ErrorDetail';
import { useDirections } from '../hooks/useDirections';
import { useGeolocation } from '../hooks/useGeolocation';
import { useHistory } from '../hooks/useHistory';
import { useFavorites } from '../hooks/useFavorites';
import { useSettings } from '../hooks/useSettings';
import { toMapRoutes } from '../lib/directions';
import { paramsToQuery, queryToParams } from '../lib/query';
import { MODE_ICON, MODE_LABEL } from '../lib/format';

const MODES: TravelMode[] = ['WALKING', 'DRIVING', 'BICYCLING'];
const MODE_COLOR: Record<TravelMode, string> = {
  WALKING: '#188038',
  DRIVING: '#0b57d0',
  BICYCLING: '#f2662e',
  TRANSIT: '#0b57d0',
};

export function MapRoutePage() {
  const [params, setParams] = useSearchParams();
  const initial = useMemo(() => paramsToQuery(params), [params]);
  const { settings } = useSettings();
  const [from, setFrom] = useState<Place | undefined>(initial.from);
  const [to, setTo] = useState<Place | undefined>(initial.to);
  const [mode, setMode] = useState<TravelMode>(
    initial.mode && initial.mode !== 'TRANSIT' ? initial.mode : settings.defaultMode !== 'TRANSIT' ? settings.defaultMode : 'WALKING',
  );
  const [routes, setRoutes] = useState<MapRoute[]>([]);
  const [routeIdx, setRouteIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [formOpen, setFormOpen] = useState(true);
  const [center, setCenter] = useState<LatLng | undefined>();
  const directions = useDirections();
  const geo = useGeolocation();
  const history = useHistory();
  const favorites = useFavorites();
  const lastRun = useRef('');

  const run = useCallback(
    async (q: RouteQuery) => {
      setRoutes([]);
      setRouteIdx(0);
      setExpanded(false);
      let resolvedFrom = q.from;
      let resolvedTo = q.to;
      const result = await directions.search(q, {
        onResolved: (f, t) => {
          resolvedFrom = f;
          resolvedTo = t;
          setFrom(f);
          setTo(t);
        },
      });
      if (!result) return;
      setRoutes(toMapRoutes(result, q.mode));
      setFormOpen(false);
      history.add(resolvedFrom, resolvedTo, q.mode);
    },
    [directions, history],
  );

  useEffect(() => {
    if (!directions.ready) return;
    const q = paramsToQuery(params);
    if (!q.from?.name || !q.to?.name) return;
    const key = params.toString();
    if (lastRun.current === key) return;
    lastRun.current = key;
    const m = q.mode && q.mode !== 'TRANSIT' ? q.mode : mode;
    setFrom(q.from);
    setTo(q.to);
    setMode(m);
    void run({ from: q.from, to: q.to, mode: m, timeType: 'departure' });
  }, [params, directions.ready, run, mode]);

  const submit = (m: TravelMode = mode) => {
    if (!from || !to) return;
    const q: RouteQuery = { from, to, mode: m, timeType: 'departure' };
    const next = queryToParams(q);
    if (next.toString() === params.toString()) {
      lastRun.current = next.toString();
      void run(q);
    } else setParams(next);
  };

  const changeMode = (m: TravelMode) => {
    setMode(m);
    if (from && to) submit(m);
  };

  const locate = async () => {
    const pos = await geo.locate();
    if (pos) setCenter({ ...pos });
  };

  const route = routes[routeIdx];
  const isFav = from && to ? favorites.hasRoute(from, to, mode) : false;

  return (
    <div className="map-page">
      <div className="map-area">
        <MapView
          center={center}
          zoom={center ? 15 : undefined}
          path={route?.overviewPath}
          pathColor={MODE_COLOR[mode]}
          bounds={route?.bounds}
          origin={from?.location ?? route?.overviewPath?.[0]}
          destination={to?.location ?? route?.overviewPath?.[route.overviewPath.length - 1]}
          currentLocation={geo.position}
        />
        <button type="button" className="map-fab" aria-label="現在地" onClick={locate} disabled={geo.loading}>
          {geo.loading ? '…' : '◎'}
        </button>
      </div>
      <div className={`panel ${!formOpen && route && !expanded ? 'collapsed' : ''}`}>
        <div className="segmented" style={{ marginBottom: 8 }}>
          {MODES.map((m) => (
            <button key={m} type="button" className={mode === m ? 'active' : ''} onClick={() => changeMode(m)}>
              {MODE_ICON[m]} {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        {formOpen ? (
          <RouteForm
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
            onSubmit={() => submit()}
            submitLabel="ルート検索"
            loading={directions.loading}
          />
        ) : (
          <button type="button" className="btn small ghost" onClick={() => setFormOpen(true)}>
            {from?.name} → {to?.name} ✎
          </button>
        )}
        {geo.error && <div className="alert error">{geo.error}</div>}
        {directions.error && (
          <div className="alert error">
            {directions.error}
            <ErrorDetail detail={directions.errorDetail} />
            {mode === 'BICYCLING' && (
              <div>
                <button type="button" className="btn small" style={{ marginTop: 6 }} onClick={() => changeMode('WALKING')}>
                  徒歩で検索する
                </button>
              </div>
            )}
          </div>
        )}
        {directions.loading && (
          <div className="loading">
            <span className="spinner" /> ルートを検索しています…
          </div>
        )}
        {route && !directions.loading && (
          <>
            {routes.length > 1 && (
              <div className="chips">
                {routes.map((r, i) => (
                  <button key={i} type="button" className={`chip ${i === routeIdx ? 'active' : ''}`} onClick={() => setRouteIdx(i)}>
                    ルート{i + 1} {r.summary && `(${r.summary})`}
                  </button>
                ))}
              </div>
            )}
            <RouteSummary route={route} expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
            {from && to && (
              <div className="row" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => {
                    if (isFav) favorites.removeRoute(from, to, mode);
                    else favorites.addRoute(from, to, mode);
                  }}
                >
                  {isFav ? '★ 登録済み' : '☆ お気に入り'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
