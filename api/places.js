// @ts-check
// GET /api/places?q=dub — worldwide place suggestions for the destination
// field, from Open-Meteo's free geocoding (GeoNames data, no key needed).

import { allowRequest, cached, clientIp, fetchJson, json } from './_lib/http.js';

/** Bigger, more travelled places first. */
const FEATURE_WEIGHT = { PCLI: 6, PPLC: 5, PPLA: 3, ADM1: 3, RGN: 3, ISL: 3, PPLA2: 1 };

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function GET(request) {
  const q = (new URL(request.url).searchParams.get('q') || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60);
  if (q.length < 2) return json({ places: [] });

  const limit = allowRequest(`places:${clientIp(request)}`, 90);
  if (!limit.ok) return json({ places: [], error: 'slow down' }, 429);

  try {
    const places = await cached(`suggest:${q.toLowerCase()}`, 24 * 3600_000, async () => {
      const data = await fetchJson(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=en&format=json`,
        { timeoutMs: 4000 },
      );
      /** @type {any[]} */
      const results = data.results || [];
      const seen = new Set();
      return results
        .map((r) => ({
          name: r.name,
          region: r.admin1 && r.admin1 !== r.name ? r.admin1 : '',
          country: r.country || '',
          countryCode: r.country_code || '',
          lat: r.latitude,
          lng: r.longitude,
          score: Math.log10((r.population || 0) + 1) + (FEATURE_WEIGHT[r.feature_code] || 0),
        }))
        .sort((a, b) => b.score - a.score)
        .filter((p) => {
          const key = `${p.name}|${p.country}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 7)
        .map(({ score, ...p }) => p);
    });
    return new Response(JSON.stringify({ places }), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=3600, s-maxage=86400' },
    });
  } catch {
    // Suggestions are a convenience: never break typing because of them.
    return json({ places: [] });
  }
}
