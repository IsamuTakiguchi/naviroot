import { describe, expect, it, vi } from 'vitest';
import { resolvePair, resolvePlace, type PlacesLibLike } from './places';

const hit = (name: string, lat: number, lng: number) => ({
  id: `id-${name}`,
  displayName: name,
  formattedAddress: `奈良県奈良市${name}`,
  location: { lat: () => lat, lng: () => lng },
});

function lib(results: Record<string, ReturnType<typeof hit>[]>): PlacesLibLike & { calls: google.maps.places.SearchByTextRequest[] } {
  const calls: google.maps.places.SearchByTextRequest[] = [];
  return {
    calls,
    Place: {
      searchByText: async (req) => {
        calls.push(req);
        return { places: results[req.textQuery ?? ''] ?? [] };
      },
    },
  };
}

describe('places', () => {
  it('resolvePlace returns the input when it already has a location or no lib', async () => {
    const p = { name: 'x', location: { lat: 1, lng: 2 } };
    expect(await resolvePlace(lib({}), p)).toBe(p);
    expect(await resolvePlace(null, { name: 'x' })).toEqual({ name: 'x' });
  });

  it('resolvePlace fills id / address / location from text search', async () => {
    const l = lib({ '鶴舞西町１−１２': [hit('鶴舞西町1-12', 34.69, 135.76)] });
    const r = await resolvePlace(l, { name: '鶴舞西町１−１２' }, { lat: 34.7, lng: 135.75 });
    expect(r).toEqual({ name: '鶴舞西町1-12', address: '奈良県奈良市鶴舞西町1-12', placeId: 'id-鶴舞西町1-12', location: { lat: 34.69, lng: 135.76 } });
    expect(l.calls[0].locationBias).toEqual({ center: { lat: 34.7, lng: 135.75 }, radius: 50_000 });
    expect(l.calls[0].region).toBe('jp');
  });

  it('resolvePlace keeps the input on no result or failure', async () => {
    expect(await resolvePlace(lib({}), { name: 'nowhere' })).toEqual({ name: 'nowhere' });
    const failing: PlacesLibLike = { Place: { searchByText: vi.fn().mockRejectedValue(new Error('x')) } };
    expect(await resolvePlace(failing, { name: 'boom' })).toEqual({ name: 'boom' });
  });

  it('resolvePair biases the unresolved side toward the resolved one', async () => {
    const l = lib({ 鶴舞西町: [hit('鶴舞西町', 34.69, 135.76)] });
    const { from, to } = await resolvePair(l, { name: '鶴舞西町' }, { name: '学園前駅', location: { lat: 34.7, lng: 135.75 } });
    expect(from.location).toEqual({ lat: 34.69, lng: 135.76 });
    expect(to.name).toBe('学園前駅');
    expect(l.calls).toHaveLength(1);
    expect(l.calls[0].locationBias).toEqual({ center: { lat: 34.7, lng: 135.75 }, radius: 50_000 });

    const l2 = lib({ a: [hit('a', 1, 2)], b: [hit('b', 3, 4)] });
    const both = await resolvePair(l2, { name: 'a' }, { name: 'b' });
    expect(both.from.location).toEqual({ lat: 1, lng: 2 });
    expect(both.to.location).toEqual({ lat: 3, lng: 4 });
    expect(l2.calls[1].locationBias).toEqual({ center: { lat: 1, lng: 2 }, radius: 50_000 });
  });
});
