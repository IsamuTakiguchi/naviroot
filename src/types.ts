export interface LatLng {
  lat: number;
  lng: number;
}

/** 出発地・目的地として扱う場所 */
export interface Place {
  /** 表示名（駅名・スポット名・住所） */
  name: string;
  /** 住所（あれば） */
  address?: string;
  location?: LatLng;
  placeId?: string;
}

export type TravelMode = 'TRANSIT' | 'WALKING' | 'DRIVING' | 'BICYCLING';

export type TimeType = 'departure' | 'arrival' | 'first' | 'last';

export interface RouteQuery {
  from: Place;
  to: Place;
  mode: TravelMode;
  /** ISO 文字列（ローカル時刻）。first/last では日付のみ意味を持つ */
  time?: string;
  timeType: TimeType;
}

export type TransitVehicle = 'BUS' | 'RAIL' | 'SUBWAY' | 'TRAIN' | 'TRAM' | 'OTHER';

export interface WalkSegment {
  kind: 'walk';
  durationSec: number;
  distanceM: number;
  instruction: string;
}

export interface TransitSegment {
  kind: 'transit';
  lineName: string;
  lineShortName?: string;
  lineColor?: string;
  lineTextColor?: string;
  vehicle: TransitVehicle;
  vehicleName: string;
  headsign: string;
  agency?: string;
  departureStop: string;
  arrivalStop: string;
  departureTime: Date;
  arrivalTime: Date;
  numStops: number;
  durationSec: number;
}

export type PlanSegment = WalkSegment | TransitSegment;

export interface TransitPlan {
  id: string;
  departureTime: Date;
  arrivalTime: Date;
  durationSec: number;
  transfers: number;
  fare?: { value: number; currency: string; text: string };
  walkSec: number;
  segments: PlanSegment[];
  summary: string;
  bounds?: google.maps.LatLngBounds;
  overviewPath?: LatLng[];
  /** 「早」「安」「楽」 */
  badges: PlanBadge[];
}

export type PlanBadge = 'fastest' | 'cheapest' | 'easiest';

export interface RouteStep {
  instruction: string;
  distanceM: number;
  durationSec: number;
  maneuver?: string;
}

export interface MapRoute {
  mode: TravelMode;
  distanceM: number;
  durationSec: number;
  summary: string;
  steps: RouteStep[];
  overviewPath: LatLng[];
  bounds?: google.maps.LatLngBounds;
  startAddress: string;
  endAddress: string;
}

export interface TimetableEntry {
  departureTime: Date;
  arrivalTime: Date;
  lineName: string;
  lineShortName?: string;
  lineColor?: string;
  headsign: string;
  vehicle: TransitVehicle;
  vehicleName: string;
  departureStop: string;
  arrivalStop: string;
  numStops: number;
  transfers: number;
  durationSec: number;
}

export type FavoriteLabel = 'home' | 'work' | 'other';

export interface FavoritePlace {
  id: string;
  kind: 'place';
  label: FavoriteLabel;
  place: Place;
  createdAt: string;
}

export interface FavoriteRoute {
  id: string;
  kind: 'route';
  from: Place;
  to: Place;
  mode: TravelMode;
  createdAt: string;
}

export type Favorite = FavoritePlace | FavoriteRoute;

export interface HistoryItem {
  id: string;
  from: Place;
  to: Place;
  mode: TravelMode;
  searchedAt: string;
}

export interface Settings {
  defaultMode: TravelMode;
  saveHistory: boolean;
}
