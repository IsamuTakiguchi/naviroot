import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FavoriteLabel, LatLng, Place } from '../types';
import { PlaceInput } from '../components/PlaceInput';
import { MapView } from '../components/MapView';
import { useGeolocation } from '../hooks/useGeolocation';
import { useFavorites } from '../hooks/useFavorites';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { queryToParams } from '../lib/query';
import { resolvePlace } from '../lib/places';
import { Icon } from '../components/Icon';

export function SearchPage() {
  const navigate = useNavigate();
  const [place, setPlace] = useState<Place | undefined>();
  const [center, setCenter] = useState<LatLng | undefined>();
  const [error, setError] = useState<string | undefined>();
  const geo = useGeolocation({ auto: true });
  const favorites = useFavorites();
  const geocoding = useMapsLibrary('geocoding');
  const places = useMapsLibrary('places');

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
    const resolved = await resolvePlace(places, p, geo.position);
    if (!resolved.location) {
      setError('場所が見つかりませんでした。入力中に出る候補から選ぶか、市区町村名を付けてお試しください。');
      setPlace(p);
      return;
    }
    setPlace(resolved);
    setCenter(resolved.location);
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

  // スポット未選択のうちは、最初に現在地が分かった時点で地図をそこへ寄せる
  const centeredOnce = useRef(false);
  useEffect(() => {
    if (centeredOnce.current || center || place || !geo.position) return;
    centeredOnce.current = true;
    setCenter({ ...geo.position });
  }, [geo.position, center, place]);

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
          {geo.loading ? '…' : <Icon name="locate" size={22} />}
        </button>
      </div>
      <div className="panel">
        <PlaceInput value={place} placeholder="駅名・住所・スポット名で検索" onChange={(p) => void resolve(p)} autoFocus bias={geo.position} />
        {geo.error && <div className="alert error">{geo.error}</div>}
        {error && <div className="alert error">{error}</div>}
        {place ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{place.name}</div>
            {place.address && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{place.address}</div>}
            <div className="row wrap" style={{ marginTop: 10 }}>
              <button type="button" className="btn primary" onClick={() => go('/', 'to')}>
                <Icon name="train" size={16} /> ここへ行く
              </button>
              <button type="button" className="btn" onClick={() => go('/', 'from')}>
                ここから出発
              </button>
              <button type="button" className="btn" onClick={() => go('/map', 'to')}>
                <Icon name="map" size={16} /> 徒歩・車ルート
              </button>
            </div>
            <div className="row wrap" style={{ marginTop: 8 }}>
              <button type="button" className="btn small" onClick={() => addFav('other')}>
                <Icon name="star-outline" size={15} /> お気に入り
              </button>
              <button type="button" className="btn small" onClick={() => addFav('home')}>
                <Icon name="home" size={15} /> 自宅に設定
              </button>
              <button type="button" className="btn small" onClick={() => addFav('work')}>
                <Icon name="work" size={15} /> 職場に設定
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
