import { useEffect } from 'react';
import { Map, Marker, useMap } from '@vis.gl/react-google-maps';
import type { LatLng } from '../types';
import { DEFAULT_CENTER, DEFAULT_ZOOM, GOOGLE_MAPS_MAP_ID } from '../config';

export interface MapViewProps {
  center?: LatLng;
  zoom?: number;
  path?: google.maps.LatLng[] | LatLng[];
  pathColor?: string;
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
    const line = new google.maps.Polyline({
      path,
      map,
      strokeColor: color ?? '#0ea5c4',
      strokeOpacity: 0.9,
      strokeWeight: 6,
    });
    const casing = new google.maps.Polyline({
      path,
      map,
      strokeColor: '#ffffff',
      strokeOpacity: 0.9,
      strokeWeight: 10,
      zIndex: -1,
    });
    return () => {
      line.setMap(null);
      casing.setMap(null);
    };
  }, [map, path, color]);
  return null;
}

function FitBounds({ bounds }: { bounds?: google.maps.LatLngBounds }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !bounds) return;
    map.fitBounds(bounds, { top: 40, bottom: 40, left: 30, right: 30 });
  }, [map, bounds]);
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
  fillColor: '#0ea5c4',
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
        <FitBounds bounds={bounds} />
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
