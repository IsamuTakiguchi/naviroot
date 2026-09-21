import { useEffect } from 'react';
import { Map, Marker, useMap } from '@vis.gl/react-google-maps';
import type { LatLng } from '../types';
import { DEFAULT_CENTER, DEFAULT_ZOOM, GOOGLE_MAPS_MAP_ID } from '../config';
import { drawDuration, drawRoute, prefersReducedMotion, runJourney } from '../lib/routeAnim';
import type { JourneyLeg } from '../lib/journey';

export interface MapViewProps {
  center?: LatLng;
  zoom?: number;
  path?: google.maps.LatLng[] | LatLng[];
  pathColor?: string;
  /** 経路の上をコマが進む演出。区間ごとに徒歩・電車・バスの絵柄が変わる */
  journey?: JourneyLeg[];
  bounds?: google.maps.LatLngBounds;
  origin?: LatLng;
  destination?: LatLng;
  /** マーカーのラベル（既定は 発 / 着） */
  originLabel?: string;
  destinationLabel?: string;
  spot?: LatLng;
  spotTitle?: string;
  currentLocation?: LatLng;
  onClick?: (pos: LatLng) => void;
  children?: React.ReactNode;
}

function RoutePolyline({ path, color }: { path?: google.maps.LatLng[] | LatLng[]; color?: string }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !path || path.length === 0) return;
    return drawRoute({
      Polyline: google.maps.Polyline,
      map,
      path,
      color: color ?? '#14a34e',
      reducedMotion: prefersReducedMotion(),
    });
  }, [map, path, color]);
  return null;
}

/** 経路の上を進むコマ（徒歩・電車・バス） */
function JourneyToken({ legs, color }: { legs?: JourneyLeg[]; color?: string }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !legs || legs.length === 0 || prefersReducedMotion()) return;
    // 線を描き終えたころにコマが動き出す
    const points = legs.reduce((a, l) => a + l.path.length, 0);
    let stop: (() => void) | undefined;
    const timer = setTimeout(() => {
      stop = runJourney({ maps: google.maps, map, legs, color: color ?? '#14a34e' });
    }, drawDuration(points) * 0.6);
    return () => {
      clearTimeout(timer);
      stop?.();
    };
  }, [map, legs, color]);
  return null;
}

/** 表示範囲を決める座標をまとめる（bounds → 経路 → 出発地/目的地 の順に採用） */
export function fitPoints(
  bounds: google.maps.LatLngBounds | undefined,
  path: google.maps.LatLng[] | LatLng[] | undefined,
  origin?: LatLng,
  destination?: LatLng,
): Array<google.maps.LatLng | LatLng> {
  if (bounds) return [bounds.getNorthEast(), bounds.getSouthWest()];
  if (path && path.length > 0) return path;
  return [origin, destination].filter((p): p is LatLng => !!p);
}

function FitBounds({
  bounds,
  path,
  origin,
  destination,
}: {
  bounds?: google.maps.LatLngBounds;
  path?: google.maps.LatLng[] | LatLng[];
  origin?: LatLng;
  destination?: LatLng;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    // 経路形状が無い場合でも出発地・目的地が見える範囲に合わせる
    const points = fitPoints(bounds, path, origin, destination);
    if (points.length === 0) return;
    const b = new google.maps.LatLngBounds();
    for (const p of points) b.extend(p);
    if (points.length === 1) {
      map.panTo(points[0]);
      return;
    }
    map.fitBounds(b, { top: 40, bottom: 40, left: 30, right: 30 });
  }, [map, bounds, path, origin, destination]);
  return null;
}

function PanTo({ center, zoom }: { center?: LatLng; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !center) return;
    map.panTo(center);
    if (zoom) map.setZoom(zoom);
  }, [map, center, zoom]);
  return null;
}

const BLUE_DOT: google.maps.Symbol = {
  path: 0 as unknown as google.maps.SymbolPath, // CIRCLE
  scale: 8,
  fillColor: '#2f9bf0',
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: 3,
};

export function MapView(props: MapViewProps) {
  const {
    center,
    zoom,
    path,
    pathColor,
    journey,
    bounds,
    origin,
    destination,
    originLabel = '発',
    destinationLabel = '着',
    spot,
    spotTitle,
    currentLocation,
    onClick,
  } = props;
  return (
    <div className="map-wrap">
      <Map
        defaultCenter={center ?? DEFAULT_CENTER}
        defaultZoom={zoom ?? DEFAULT_ZOOM}
        mapId={GOOGLE_MAPS_MAP_ID}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        clickableIcons={false}
        style={{ width: '100%', height: '100%' }}
        onClick={(e) => {
          const ll = e.detail.latLng;
          if (ll && onClick) onClick({ lat: ll.lat, lng: ll.lng });
        }}
      >
        <RoutePolyline path={path} color={pathColor} />
        <JourneyToken legs={journey} color={pathColor} />
        <FitBounds bounds={bounds} path={path} origin={origin} destination={destination} />
        <PanTo center={center} zoom={zoom} />
        {origin && (
          <Marker position={origin} label={{ text: originLabel, color: '#fff', fontWeight: '700', fontSize: '12px' }} title="出発地" />
        )}
        {destination && (
          <Marker
            position={destination}
            label={{ text: destinationLabel, color: '#fff', fontWeight: '700', fontSize: '12px' }}
            title="目的地"
          />
        )}
        {spot && <Marker position={spot} title={spotTitle} />}
        {currentLocation && <Marker position={currentLocation} icon={BLUE_DOT} title="現在地" zIndex={10} />}
        {props.children}
      </Map>
    </div>
  );
}
