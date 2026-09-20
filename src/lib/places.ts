import type { LatLng, Place } from '../types';

/** Place.searchByText の必要最小限の型（テスト差し替え用） */
export interface PlacesLibLike {
  Place: {
    searchByText(request: google.maps.places.SearchByTextRequest): Promise<{ places: PlaceResultLike[] }>;
  };
}

export interface PlaceResultLike {
  id?: string | null;
  displayName?: string | null;
  formattedAddress?: string | null;
  location?: { lat(): number; lng(): number } | null;
}

/**
 * 座標の無い場所（自由入力の駅名・住所）を Places API (New) のテキスト検索で解決する。
 * 解決できなければ元の Place をそのまま返す（Routes API 側の住所解決に任せる）。
 */
export async function resolvePlace(lib: PlacesLibLike | null | undefined, place: Place, bias?: LatLng): Promise<Place> {
  if (place.location || !lib) return place;
  const query = place.name.trim();
  if (!query) return place;
  try {
    const { places } = await lib.Place.searchByText({
      textQuery: query,
      fields: ['id', 'location', 'formattedAddress', 'displayName'],
      region: 'jp',
      language: 'ja',
      maxResultCount: 1,
      locationBias: bias ? { center: bias, radius: 50_000 } : undefined,
    });
    const r = places[0];
    if (!r?.location) return place;
    return {
      name: r.displayName || place.name,
      address: r.formattedAddress ?? undefined,
      placeId: r.id ?? place.placeId,
      location: { lat: r.location.lat(), lng: r.location.lng() },
    };
  } catch {
    return place;
  }
}

/** 出発地・目的地をまとめて解決する。片方に座標があれば、もう片方の検索をその周辺に寄せる。 */
export async function resolvePair(lib: PlacesLibLike | null | undefined, from: Place, to: Place): Promise<{ from: Place; to: Place }> {
  let f = from;
  let t = to;
  if (f.location && !t.location) {
    t = await resolvePlace(lib, t, f.location);
  } else if (t.location && !f.location) {
    f = await resolvePlace(lib, f, t.location);
  } else if (!f.location && !t.location) {
    f = await resolvePlace(lib, f);
    t = await resolvePlace(lib, t, f.location);
  }
  return { from: f, to: t };
}
