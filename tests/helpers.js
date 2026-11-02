// Test helpers: a fake fetch that answers like Google, Open-Meteo and the
// exchange-rate API, so tests run offline and always give the same result.
import { vi } from 'vitest';

export const jsonRes = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Builds a Gemini SSE body that streams `text` in small chunks. */
export function geminiSse(text, { chunk = 7, thoughts = false } = {}) {
  const parts = text.match(new RegExp(`[\\s\\S]{1,${chunk}}`, 'g')) || [];
  let out = '';
  if (thoughts) out += `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'secret thinking', thought: true }] } }] })}\r\n\r\n`;
  for (const p of parts) out += `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: p }] } }] })}\r\n\r\n`;
  out += `data: ${JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [] } }] })}\r\n\r\n`;
  return new Response(out, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

export const SAMPLE_PLAN =
  '## Trip snapshot\nTwo calm days.\n\n## Day by day\n### Day 1: Forts\n- **Morning:** Baltit Fort\n\n<<<TRIPDATA>>>\n' +
  JSON.stringify({
    currency: 'PKR',
    total_estimate: 50000,
    budget: [
      { category: 'Stay', amount: '30,000' },
      { category: 'Food', amount: 20000 },
    ],
    days: [{ day: 1, title: 'Forts', places: [{ name: 'Baltit Fort', lat: 36.3256, lng: 74.6698 }] }],
  });

/**
 * Installs a fake global fetch. `gemini` decides how the AI responds and
 * receives the model name; `calls` records every URL requested.
 */
export function installFetch({ gemini = () => geminiSse(SAMPLE_PLAN) } = {}) {
  const calls = [];
  const fake = vi.fn(async (url) => {
    const u = String(url);
    calls.push(u);
    if (u.includes('generativelanguage.googleapis.com')) {
      const model = u.split('/models/')[1].split(':')[0];
      return gemini(model);
    }
    if (u.includes('geocoding-api.open-meteo.com')) {
      return jsonRes(200, {
        results: [
          { name: 'Hunza', country: 'United States', country_code: 'US', latitude: 40, longitude: -100, feature_code: 'PPL', population: 120 },
          { name: 'Hunza', country: 'Pakistan', country_code: 'PK', latitude: 36.3167, longitude: 74.65, feature_code: 'VAL', population: 50000 },
        ],
      });
    }
    if (u.includes('open-meteo.com')) {
      const start = new URL(u).searchParams.get('start_date');
      return jsonRes(200, {
        daily: {
          time: [start, start],
          weather_code: [0, 63],
          temperature_2m_max: [21.4, 18.2],
          temperature_2m_min: [9.6, 8.1],
          precipitation_sum: [0, 6.2],
          precipitation_probability_max: u.includes('archive') ? undefined : [5, 80],
        },
      });
    }
    if (u.includes('open.er-api.com')) {
      return jsonRes(200, { rates: { USD: 0.0036, EUR: 0.0031, PKR: 1 }, time_last_update_utc: 'today' });
    }
    return jsonRes(404, {});
  });
  vi.stubGlobal('fetch', fake);
  return { calls, fake };
}

/** Reads an NDJSON Response into an array of events. */
export async function readEvents(res) {
  const text = await res.text();
  return text
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

export const visibleText = (events) =>
  events
    .filter((e) => e.type === 'text')
    .map((e) => e.delta)
    .join('');

export function planRequest(body, headers = {}) {
  return new Request('https://tripmind.example/api/plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'tripmind.example', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
