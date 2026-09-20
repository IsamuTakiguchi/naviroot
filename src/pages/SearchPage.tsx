import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FavoriteLabel, LatLng, Place } from '../types';
import { PlaceInput } from '../components/PlaceInput';
import { MapView } from '../components/MapView';
import { useGeolocation } from '../hooks/useGeolocation';
import { useFavorites } from '../hooks/useFavorites';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { queryToParams } from '../lib/query';

export function SearchPage() {
  const navigate = useNavigate();
  const [place, setPlace] = useState<Place | undefined>();
  const [center, setCenter] = useState<LatLng | undefined>();
  const [error, setError] = useState<string | undefined>();
  const geo = useGeolocation();
  const favorites = useFavorites();
  const geocoding = useMapsLibrary('geocoding');

  const resolve = async (p: Place | undefined) => {
    setError(undefined);
    if (!p) {
      setPlace(undefined);
      return;
    }
    if (p.location) {
      setPlace(p);
      setCenter(p.location);
      return;
    }
    if (!geocoding) {
      setPlace(p);
      return;
    }
    try {
      const geocoder = new geocoding.Geocoder();
      const res = await geocoder.geocode({ address: p.name, region: 'jp', language: 'ja' });
      const r = res.results[0];
      if (!r) {
        setError('場所が見つかりませんでした。');
        setPlace(p);
        return;
      }
      const loc = { lat: r.geometry.location.lat(), lng: r.geometry.location.lng() };
      const resolved: Place = { name: p.name, address: r.formatted_address, placeId: r.place_id, location: loc };
      setPlace(resolved);
      setCenter(loc);
    } catch {
      setError('場所を特定できませんでした。');
      setPlace(p);
    }
  };

  const reverse = async (pos: LatLng) => {
    if (!geocoding) {
      setPlace({ name: `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`, location: pos });
      return;
    }
    try {
      const geocoder = new geocoding.Geocoder();
      const res = await geocoder.geocode({ location: pos, language: 'ja' });
      const r = res.results[0];
      setPlace({
        name: r?.formatted_address?.replace(/^日本、?/, '') ?? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`,
        address: r?.formatted_address,
        placeId: r?.place_id,
        location: pos,
      });
    } catch {
      setPlace({ name: `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`, location: pos });
    }
  };

  const locate = async () => {
    const pos = await geo.locate();
    if (pos) setCenter({ ...pos });
  };

  const go = (path: '/' | '/map', key: 'from' | 'to') => {
    if (!place) return;
    navigate({ pathname: path, search: queryToParams({ [key]: place, mode: path === '/' ? 'TRANSIT' : 'WALKING', timeType: 'departure' }).toString() });
  };

  const addFav = (label: FavoriteLabel) => {
    if (!place) return;
    favorites.addPlace(place, label);
  };

  return (
    <div className="map-page">
      <div className="map-area">
        <MapView
          center={center}
          zoom={center ? 16 : undefined}
          spot={place?.location}
          spotTitle={place?.name}
          currentLocation={geo.position}
          onClick={reverse}
        />
        <button type="button" className="map-fab" aria-label="現在地" onClick={locate} disabled={geo.loading}>
          {geo.loading ? '…' : '◎'}
        </button>
      </div>
      <div className="panel">
        <PlaceInput value={place} placeholder="駅名・住所・スポット名で検索" onChange={(p) => void resolve(p)} autoFocus />
        {geo.error && <div className="alert error">{geo.error}</div>}
        {error && <div className="alert error">{error}</div>}
        {place ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{place.name}</div>
            {place.address && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{place.address}</div>}
            <div className="row wrap" style={{ marginTop: 10 }}>
              <button type="button" className="btn primary" onClick={() => go('/', 'to')}>
                🚃 ここへ行く
              </button>
              <button type="button" className="btn" onClick={() => go('/', 'from')}>
                ここから出発
              </button>
              <button type="button" className="btn" onClick={() => go('/map', 'to')}>
                🗺️ 徒歩・車ルート
              </button>
            </div>
            <div className="row wrap" style={{ marginTop: 8 }}>
              <button type="button" className="btn small" onClick={() => addFav('other')}>
                ☆ お気に入り
              </button>
              <button type="button" className="btn small" onClick={() => addFav('home')}>
                🏠 自宅に設定
              </button>
              <button type="button" className="btn small" onClick={() => addFav('work')}>
                🏢 職場に設定
              </button>
            </div>
          </div>
        ) : (
          <div className="alert info" style={{ marginTop: 10 }}>
            検索するか、地図をタップして場所を選択できます。
          </div>
        )}
      </div>
    </div>
  );
}
