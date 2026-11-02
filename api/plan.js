// @ts-check
// POST /api/plan — the TripMind agent.
//
// Streams newline-delimited JSON events so the UI can show each step as it
// happens ("Checking the weather… ✓") and type the plan out word by word.
// Tools run in parallel before one single model call, which keeps the agent
// fast and well inside Gemini's free-tier limits.

import { AgentError, streamGemini } from './_lib/gemini.js';
import { allowRequest, clientIp, createEventStream, isSameOrigin, json, log, newRequestId, step } from './_lib/http.js';
import {
  DATA_MARKER,
  NEW_TRIP_MARKER,
  SYSTEM_PROMPT,
  chatPrompt,
  cleanTripData,
  comparePrompt,
  parseNewTrip,
  planPrompt,
  splitData,
} from './_lib/prompts.js';
import { convert, currencyFor, geocode, weatherFor } from './_lib/tools.js';
import { ValidationError, validateRequest } from './_lib/validate.js';

const MAX_BODY_BYTES = 32 * 1024;

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function POST(request) {
  const requestId = newRequestId();
  const started = Date.now();

  // Only this site may use the agent (stops other sites spending the AI quota).
  if (!isSameOrigin(request)) {
    return json({ error: { code: 'FORBIDDEN', message: 'This API only serves the TripMind website.' } }, 403, requestId);
  }

  const limit = allowRequest(clientIp(request));
  if (!limit.ok) {
    return json(
      { error: { code: 'RATE_LIMIT', message: 'Too many requests. Please wait a moment.', retryAfter: limit.retryAfter } },
      429,
      requestId,
    );
  }

  let input;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) throw new ValidationError('That request is too large.');
    input = validateRequest(JSON.parse(raw));
  } catch (err) {
    const message = err instanceof ValidationError ? err.message : 'Send the trip details as JSON.';
    return json({ error: { code: 'BAD_INPUT', message } }, 400, requestId);
  }

  const { stream, send, close } = createEventStream();

  (async () => {
    /** @type {string} */
    let outcome = 'done';
    try {
      if (input.mode === 'plan') await runPlan(input.trip, send);
      else if (input.mode === 'compare') await runCompare(input.compare, send);
      else await runChat(input.chat, send);
      send({ type: 'done', requestId });
    } catch (err) {
      const e = err instanceof AgentError ? err : new AgentError('INTERNAL', 'Something went wrong while planning. Please try again.');
      outcome = e.code;
      if (!(err instanceof AgentError)) log('error', { requestId, error: String(/** @type {any} */ (err)?.stack || err) });
      send({ type: 'error', code: e.code, message: e.message, retryAfter: e.retryAfter, requestId });
    } finally {
      close();
      log('info', { requestId, mode: input.mode, outcome, ms: Date.now() - started });
    }
  })();

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
      'x-request-id': requestId,
    },
  });
}

export function GET() {
  return json({ error: { code: 'METHOD', message: 'Use POST with trip details.' } }, 405);
}

/* ------------------------------------------------------------------ */

const today = () => new Date().toISOString().slice(0, 10);
const inAWeek = () => new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);

async function runPlan(trip, send) {
  const startDate = trip.startDate && trip.startDate >= today() ? trip.startDate : inAWeek();

  send({
    type: 'step',
    id: 'read',
    label: 'Reading your trip details',
    status: 'done',
    ms: 0,
    detail: `${trip.days} days · ${trip.travelers} traveller${trip.travelers > 1 ? 's' : ''} · ${trip.currency} ${trip.budget.toLocaleString('en-US')}`,
  });

  const place = await step(send, 'locate', `Finding ${trip.destination} on the map`, async () => {
    const p = await geocode(trip.destination);
    send({ type: 'data', key: 'place', value: p });
    return { ...p, __detail: `${p.name}, ${p.country} · ${p.lat.toFixed(2)}°, ${p.lng.toFixed(2)}°` };
  });

  const destCurrency = place ? currencyFor(place.countryCode) : null;

  // Weather and currency don't depend on each other, so they run together.
  const [weather, fx] = await Promise.all([
    place
      ? step(send, 'weather', 'Checking the weather for your dates', async () => {
          const w = await weatherFor(place, startDate, trip.days);
          send({ type: 'data', key: 'weather', value: w });
          return { ...w, __detail: w.source === 'forecast' ? 'Live forecast' : 'Typical weather from last year' };
        })
      : null,
    destCurrency && destCurrency !== trip.currency
      ? step(send, 'currency', `Converting your budget to ${destCurrency}`, async () => {
          const r = await convert(trip.budget, trip.currency, destCurrency);
          send({ type: 'data', key: 'fx', value: r });
          return {
            ...r,
            __detail: r.from === r.to ? 'Same currency' : `1 ${r.from} = ${r.rate} ${r.to}`,
          };
        })
      : null,
  ]);

  const full = await writeWithModel(send, 'write', 'Writing your day-by-day plan', {
    system: SYSTEM_PROMPT,
    prompt: planPrompt(trip, { place, weather, fx, startDate }),
  });

  await finishData(send, full);
}

async function runCompare(cmp, send) {
  const startDate = cmp.startDate && cmp.startDate >= today() ? cmp.startDate : inAWeek();
  send({ type: 'step', id: 'read', label: 'Reading your comparison', status: 'done', ms: 0, detail: `${cmp.a} vs ${cmp.b}` });

  const [placeA, placeB] = await Promise.all([
    step(send, 'locateA', `Finding ${cmp.a}`, async () => {
      const p = await geocode(cmp.a);
      return { ...p, __detail: `${p.name}, ${p.country}` };
    }),
    step(send, 'locateB', `Finding ${cmp.b}`, async () => {
      const p = await geocode(cmp.b);
      return { ...p, __detail: `${p.name}, ${p.country}` };
    }),
  ]);
  send({ type: 'data', key: 'places', value: [placeA, placeB] });

  const [weatherA, weatherB] = await Promise.all([
    placeA ? step(send, 'weatherA', `Checking weather in ${cmp.a}`, () => weatherFor(placeA, startDate, cmp.days)) : null,
    placeB ? step(send, 'weatherB', `Checking weather in ${cmp.b}`, () => weatherFor(placeB, startDate, cmp.days)) : null,
  ]);
  send({ type: 'data', key: 'compareWeather', value: [weatherA, weatherB] });

  const full = await writeWithModel(send, 'write', 'Weighing up both destinations', {
    system: SYSTEM_PROMPT,
    prompt: comparePrompt(cmp, { placeA, placeB, weatherA, weatherB, startDate }),
    maxTokens: 3000,
  });
  await finishData(send, full);
}

async function runChat(chat, send) {
  send({ type: 'step', id: 'context', label: 'Reading your current plan', status: 'done', ms: 0 });
  const full = await writeWithModel(send, 'write', 'Updating the plan', {
    system: SYSTEM_PROMPT,
    prompt: chatPrompt(chat),
    maxTokens: 3500,
    gate: NEW_TRIP_MARKER,
  });

  // A different destination: tell the browser to run the full agent for it
  // (location, weather, budget, map), keeping the rest of the trip details.
  const newTrip = parseNewTrip(full);
  if (newTrip) {
    send({ type: 'step', id: 'switch', label: `Switching to ${newTrip.destination}`, status: 'done', ms: 0 });
    send({ type: 'data', key: 'newTrip', value: newTrip });
    return;
  }
  await finishData(send, full, { optional: true });
}

/**
 * Streams the model output to the browser, holding back the hidden JSON
 * block that follows DATA_MARKER so visitors only ever see clean text.
 */
async function writeWithModel(send, id, label, opts) {
  const t0 = Date.now();
  send({ type: 'step', id, label, status: 'running' });
  const { gate, ...modelOpts } = opts;
  let full = '';
  let sent = 0;
  let firstAt = 0;
  const flush = (final) => {
    // A reply that starts with the gate marker is a signal, never shown.
    if (gate) {
      const t = full.trimStart();
      if (t.startsWith(gate) || (!final && gate.startsWith(t))) return;
    }
    const cut = full.indexOf(DATA_MARKER);
    // Without the marker yet, keep a tail back in case it is arriving split.
    const visibleEnd = cut >= 0 ? cut : final ? full.length : Math.max(sent, full.length - DATA_MARKER.length);
    if (visibleEnd > sent) {
      send({ type: 'text', delta: full.slice(sent, visibleEnd) });
      sent = visibleEnd;
    }
  };
  await streamGemini({
    ...modelOpts,
    onText: (delta) => {
      if (!firstAt) firstAt = Date.now();
      full += delta;
      flush(false);
    },
  });
  flush(true);
  send({
    type: 'step',
    id,
    label,
    status: 'done',
    ms: Date.now() - t0,
    detail: firstAt ? `First words after ${((firstAt - t0) / 1000).toFixed(1)}s` : undefined,
  });
  return full;
}

async function finishData(send, full, { optional = false } = {}) {
  const { data } = splitData(full);
  const clean = cleanTripData(data);
  if (!clean) {
    if (!optional) {
      send({ type: 'step', id: 'map', label: 'Pinning places on the map', status: 'skipped', ms: 0, detail: 'No map data this time' });
    }
    return;
  }
  if (clean.days?.length) {
    const count = clean.days.reduce((s, d) => s + d.places.length, 0);
    send({ type: 'step', id: 'map', label: 'Pinning places on the map', status: 'done', ms: 0, detail: `${count} places across ${clean.days.length} days` });
  }
  if (clean.budget?.length) {
    send({
      type: 'step',
      id: 'budget',
      label: 'Balancing the budget',
      status: 'done',
      ms: 0,
      detail: `Estimated ${clean.currency} ${Math.round(clean.total).toLocaleString('en-US')}`,
    });
  }
  send({ type: 'data', key: 'trip', value: clean });
}
