import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST, GET } from '../api/plan.js';
import { GET as health } from '../api/health.js';
import { clearCache, resetLimiter } from '../api/_lib/http.js';
import { DATA_MARKER } from '../api/_lib/prompts.js';
import { SAMPLE_PLAN, geminiSse, installFetch, jsonRes, planRequest, readEvents, visibleText } from './helpers.js';

const plan = { mode: 'plan', trip: { destination: 'Hunza', days: 2, budget: 100000, currency: 'USD', travelers: 2 } };

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key';
  clearCache();
  resetLimiter();
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GEMINI_API_KEY;
});

describe('POST /api/plan', () => {
  it('streams steps, tool data, clean text and the map/budget data', async () => {
    installFetch();
    const res = await POST(planRequest(plan));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('ndjson');
    expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f]{8}$/);

    const events = await readEvents(res);
    const stepIds = [...new Set(events.filter((e) => e.type === 'step').map((e) => e.id))];
    expect(stepIds).toEqual(['read', 'locate', 'weather', 'currency', 'write', 'map', 'budget']);
    expect(events.find((e) => e.key === 'place').value.country).toBe('Pakistan');
    expect(events.find((e) => e.key === 'weather').value.days).toHaveLength(2);
    expect(events.find((e) => e.key === 'fx').value).toMatchObject({ from: 'USD', to: 'PKR' });

    const text = visibleText(events);
    expect(text).toContain('## Trip snapshot');
    expect(text).not.toContain('<<<');
    expect(text).not.toContain('"budget"');

    const trip = events.find((e) => e.key === 'trip').value;
    expect(trip.budget[0]).toEqual({ category: 'Stay', amount: 30000 });
    expect(events.at(-1)).toMatchObject({ type: 'done' });
  });

  it('never leaks the hidden marker, however the stream is split', async () => {
    for (const chunk of [1, 3, 5, 13, 14, 15, 40]) {
      installFetch({ gemini: () => geminiSse(SAMPLE_PLAN, { chunk }) });
      const events = await readEvents(await POST(planRequest(plan)));
      const text = visibleText(events);
      expect(text, `chunk ${chunk}`).not.toContain('<');
      expect(text.trim().endsWith('Baltit Fort'), `chunk ${chunk}`).toBe(true);
      resetLimiter();
    }
  });

  it('keeps planning when a tool is down', async () => {
    installFetch();
    const real = globalThis.fetch;
    vi.stubGlobal('fetch', (url, init) => (String(url).includes('open-meteo.com/v1/forecast') ? Promise.reject(new Error('offline')) : real(url, init)));
    const events = await readEvents(await POST(planRequest(plan)));
    expect(events.find((e) => e.id === 'weather' && e.status === 'skipped')).toBeTruthy();
    expect(events.at(-1).type).toBe('done');
  });

  it('streams a friendly error when the AI quota is busy', async () => {
    installFetch({ gemini: () => jsonRes(429, { error: { message: 'quota' } }) });
    const events = await readEvents(await POST(planRequest(plan)));
    expect(events.at(-1)).toMatchObject({ type: 'error', code: 'RATE_LIMIT', retryAfter: 20 });
    expect(events.at(-1).requestId).toMatch(/^[0-9a-f]{8}$/);
  });

  it('runs a comparison', async () => {
    installFetch({
      gemini: () => geminiSse(`## Quick verdict\nHunza.\n${DATA_MARKER}\n{"currency":"PKR","compare":[{"name":"Hunza","score":9,"estimate":70000},{"name":"Skardu","score":7,"estimate":80000}]}`),
    });
    const events = await readEvents(await POST(planRequest({ mode: 'compare', compare: { a: 'Hunza', b: 'Hunza' } })));
    expect(events.find((e) => e.key === 'places').value).toHaveLength(2);
    expect(events.find((e) => e.key === 'trip').value.compare[0].score).toBe(9);
  });

  it('answers a follow-up without the map step when nothing changed', async () => {
    installFetch({ gemini: () => geminiSse('Sure, here is a cheaper Day 2.') });
    const events = await readEvents(
      await POST(planRequest({ mode: 'chat', chat: { message: 'cheaper', plan: '## Trip snapshot\nold plan text' } })),
    );
    expect(visibleText(events)).toBe('Sure, here is a cheaper Day 2.');
    expect(events.some((e) => e.id === 'map')).toBe(false);
  });

  it('turns a follow-up about another place into a new-trip signal, never shown as text', async () => {
    for (const chunk of [1, 4, 9, 50]) {
      installFetch({ gemini: () => geminiSse('<<<NEW_TRIP>>>{"destination":"Maldives","days":4}', { chunk }) });
      const events = await readEvents(
        await POST(planRequest({ mode: 'chat', chat: { message: 'what about Maldives?', destination: 'Dubai', plan: '## Trip snapshot\nDubai plan text' } })),
      );
      expect(visibleText(events), `chunk ${chunk}`).toBe('');
      expect(events.find((e) => e.key === 'newTrip').value).toEqual({ destination: 'Maldives', days: 4 });
      expect(events.at(-1).type).toBe('done');
      resetLimiter();
    }
  });

  it('refuses requests from other websites', async () => {
    const res = await POST(planRequest(plan, { origin: 'https://someone-else.example' }));
    expect(res.status).toBe(403);
  });

  it('rejects bad JSON, missing fields and huge bodies', async () => {
    expect((await POST(planRequest('{not json'))).status).toBe(400);
    expect((await POST(planRequest({ mode: 'plan', trip: {} }))).status).toBe(400);
    const huge = await POST(planRequest({ mode: 'plan', trip: { destination: 'Bali', notes: 'x'.repeat(40000) } }));
    expect(huge.status).toBe(400);
    expect((await huge.json()).error.message).toContain('too large');
  });

  it('rate limits a single visitor', async () => {
    installFetch();
    let last;
    for (let i = 0; i < 13; i++) {
      last = await POST(planRequest({ mode: 'plan', trip: {} }, { 'x-forwarded-for': '9.9.9.9' }));
    }
    expect(last.status).toBe(429);
  });

  it('only accepts POST', async () => {
    expect(GET().status).toBe(405);
  });
});

describe('GET /api/health', () => {
  it('reports whether the AI is configured without exposing the key', async () => {
    const body = await health().json();
    expect(body).toMatchObject({ ok: true, aiConfigured: true });
    expect(JSON.stringify(body)).not.toContain('test-key');
  });
});
