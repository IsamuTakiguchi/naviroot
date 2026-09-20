import { useCallback } from 'react';
import type { Favorite, FavoriteLabel, Place, TravelMode } from '../types';
import { newId } from '../lib/storage';
import { useLocalState } from './useLocalState';

export const FAVORITES_KEY = 'favorites';

export function samePlace(a: Place, b: Place): boolean {
  if (a.placeId && b.placeId) return a.placeId === b.placeId;
  return a.name === b.name;
}

export function useFavorites() {
  const [favorites, setFavorites] = useLocalState<Favorite[]>(FAVORITES_KEY, []);

  const addPlace = useCallback(
    (place: Place, label: FavoriteLabel = 'other') => {
      setFavorites((prev) => {
        const rest = label === 'other' ? prev : prev.filter((f) => !(f.kind === 'place' && f.label === label));
        if (rest.some((f) => f.kind === 'place' && f.label === label && samePlace(f.place, place))) return rest;
        return [{ id: newId(), kind: 'place', label, place, createdAt: new Date().toISOString() }, ...rest];
      });
    },
    [setFavorites],
  );

  const addRoute = useCallback(
    (from: Place, to: Place, mode: TravelMode) => {
      setFavorites((prev) => {
        if (prev.some((f) => f.kind === 'route' && f.mode === mode && samePlace(f.from, from) && samePlace(f.to, to)))
          return prev;
        return [{ id: newId(), kind: 'route', from, to, mode, createdAt: new Date().toISOString() }, ...prev];
      });
    },
    [setFavorites],
  );

  const remove = useCallback((id: string) => setFavorites((prev) => prev.filter((f) => f.id !== id)), [setFavorites]);

  const removeRoute = useCallback(
    (from: Place, to: Place, mode: TravelMode) =>
      setFavorites((prev) =>
        prev.filter((f) => !(f.kind === 'route' && f.mode === mode && samePlace(f.from, from) && samePlace(f.to, to))),
      ),
    [setFavorites],
  );

  const hasRoute = useCallback(
    (from: Place, to: Place, mode: TravelMode) =>
      favorites.some((f) => f.kind === 'route' && f.mode === mode && samePlace(f.from, from) && samePlace(f.to, to)),
    [favorites],
  );

  const home = favorites.find((f) => f.kind === 'place' && f.label === 'home');
  const work = favorites.find((f) => f.kind === 'place' && f.label === 'work');

  return {
    favorites,
    addPlace,
    addRoute,
    remove,
    removeRoute,
    hasRoute,
    home: home?.kind === 'place' ? home.place : undefined,
    work: work?.kind === 'place' ? work.place : undefined,
  };
}
