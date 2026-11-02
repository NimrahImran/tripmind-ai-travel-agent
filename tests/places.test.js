import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../api/places.js';
import { clearCache, resetLimiter } from '../api/_lib/http.js';
import { jsonRes } from './helpers.js';

const call = (q) => GET(new Request(`https://tripmind.example/api/places?q=${encodeURIComponent(q)}`));

beforeEach(() => {
  clearCache();
  resetLimiter();
});
afterEach(() => vi.unstubAllGlobals());

describe('GET /api/places', () => {
  it('returns the biggest matching places first, without duplicates', async () => {
    vi.stubGlobal('fetch', async () =>
      jsonRes(200, {
        results: [
          { name: 'Dubai', country: 'United States', country_code: 'US', latitude: 1, longitude: 1, population: 50, feature_code: 'PPL' },
          { name: 'Dubai', country: 'United Arab Emirates', admin1: 'Dubai', country_code: 'AE', latitude: 25.2, longitude: 55.3, population: 3_000_000, feature_code: 'PPLA' },
          { name: 'Dubai', country: 'United Arab Emirates', admin1: 'Dubai', country_code: 'AE', latitude: 25.1, longitude: 55.2, population: 10, feature_code: 'PPL' },
        ],
      }),
    );
    const { places } = await (await call('Dub')).json();
    expect(places).toHaveLength(2);
    expect(places[0]).toMatchObject({ name: 'Dubai', country: 'United Arab Emirates', region: '' });
  });

  it('needs at least two letters', async () => {
    const fake = vi.fn();
    vi.stubGlobal('fetch', fake);
    expect((await (await call('D')).json()).places).toEqual([]);
    expect(fake).not.toHaveBeenCalled();
  });

  it('never fails while typing, even if the search service is down', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('offline');
    });
    const res = await call('Paris');
    expect(res.status).toBe(200);
    expect((await res.json()).places).toEqual([]);
  });
});
