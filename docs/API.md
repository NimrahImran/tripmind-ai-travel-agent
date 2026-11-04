# TripMind API Reference

The TripMind backend is a set of serverless functions on Vercel. It takes a destination, dates, travellers and a budget, looks up live data, then streams a day-by-day plan written by Google Gemini.

- **Interactive reference:** [tripmind-travel-agent.vercel.app/docs](https://tripmind-travel-agent.vercel.app/docs)
- **OpenAPI 3.1 spec:** [`/openapi.json`](https://tripmind-travel-agent.vercel.app/openapi.json) (source: [`scripts/build-openapi.mjs`](../scripts/build-openapi.mjs))

| Endpoint                           | Method | What it does                                                    | Rate limit     |
| ---------------------------------- | ------ | --------------------------------------------------------------- | -------------- |
| [`/api/plan`](#post-apiplan)       | POST   | Plan a trip, compare two places, or edit a plan (NDJSON stream) | 12 / minute    |
| [`/api/places`](#get-apiplaces)    | GET    | Worldwide place suggestions while typing                        | 90 / minute    |
| [`/api/contact`](#post-apicontact) | POST   | The Hire Me form                                                | 5 / 10 minutes |
| [`/api/health`](#get-apihealth)    | GET    | Service status                                                  | none           |

## Basics

**Base URL.** `https://tripmind-travel-agent.vercel.app` in production, `http://localhost:5173` with `npm run dev`.

**Access.** No API key is needed. Browser requests from other websites are refused with `403`, unless their domain is listed in the `ALLOWED_ORIGINS` setting. Requests with no `Origin` header (curl, servers) are accepted and rate-limited. The Gemini key lives only on the server and is never sent to the browser.

**Lenient inputs.** Text is trimmed and cut to its maximum length. Numbers outside their range are clamped to the nearest limit, and an unknown `style`, `currency` or `mode` falls back to its default. Only a missing destination, message or plan is rejected (`400`).

**Tracing.** Every `/api/plan` and `/api/contact` response carries an `x-request-id` header. The same ID appears in the server log line for that request and in the final `done` or `error` event.

**Rate limits.** Limits are counted per visitor IP. A `429` from `/api/plan` includes `retryAfter` (seconds).

## POST /api/plan

One endpoint runs the agent. Pick the job with `mode`.

### Request

**`mode: "plan"`**: a full trip plan.

```json
{
  "mode": "plan",
  "trip": {
    "destination": "Hunza, Pakistan",
    "origin": "Karachi",
    "days": 5,
    "travelers": 2,
    "budget": 80000,
    "currency": "PKR",
    "style": "balanced",
    "startDate": "2026-12-10",
    "interests": ["Nature", "History"],
    "notes": "No long hikes",
    "lang": "en"
  }
}
```

| Field         | Type     | Rules                                                                 | Default      |
| ------------- | -------- | --------------------------------------------------------------------- | ------------ |
| `destination` | string   | **Required**, 2–80 characters                                         | —            |
| `origin`      | string   | Up to 80 characters                                                   | empty        |
| `days`        | integer  | 1–14                                                                  | 5            |
| `travelers`   | integer  | 1–20                                                                  | 2            |
| `budget`      | integer  | Total for the whole trip, 1–1,000,000,000                             | 100000       |
| `currency`    | string   | `PKR` `USD` `EUR` `GBP` `AED` `SAR` `INR` `CAD` `AUD` `TRY` `MYR`     | `PKR`        |
| `style`       | string   | `balanced` `backpacker` `family` `honeymoon` `luxury`                 | `balanced`   |
| `startDate`   | string   | `YYYY-MM-DD`; a missing or past date becomes one week from today      | one week out |
| `interests`   | string[] | Up to 8, each up to 24 characters                                     | none         |
| `notes`       | string   | Up to 400 characters                                                  | empty        |
| `lang`        | string   | `en`, or `ur` for Roman Urdu (place names and prices stay in English) | `en`         |

**`mode: "compare"`**: two destinations side by side, with fit scores.

```json
{
  "mode": "compare",
  "compare": {
    "a": "Hunza",
    "b": "Skardu",
    "days": 5,
    "travelers": 2,
    "budget": 90000,
    "currency": "PKR"
  }
}
```

`a` and `b` are required (2–60 characters). `days`, `travelers`, `budget`, `currency`, `style`, `startDate` and `lang` work as in plan mode.

**`mode: "chat"`**: change an existing plan.

```json
{
  "mode": "chat",
  "chat": {
    "message": "Make day 2 cheaper",
    "plan": "## Trip snapshot\nFive slow, scenic days in Hunza…",
    "destination": "Hunza, Pakistan",
    "history": [{ "role": "user", "content": "Add a food tour" }],
    "lang": "en"
  }
}
```

| Field         | Rules                                                                                |
| ------------- | ------------------------------------------------------------------------------------ |
| `message`     | **Required**, 2–600 characters                                                       |
| `plan`        | **Required**, the current plan in Markdown, 20–14,000 characters                     |
| `destination` | The current destination, so the agent can tell when a different place is asked about |
| `history`     | The last 4 turns are kept; each `content` up to 2,000 characters                     |

If the message asks about a different destination ("plan Dubai instead"), the agent does not rewrite the old plan. It sends a `switch` step and a `newTrip` data event, and the client starts a full plan for the new place.

### Response: an event stream

A successful request answers `200` with `content-type: application/x-ndjson`: one JSON object per line, sent as soon as it is ready. The last line is always `done` or `error`.

```text
{"type":"step","id":"locate","label":"Finding Hunza on the map","status":"running"}
{"type":"data","key":"place","value":{"name":"Hunza","country":"Pakistan","countryCode":"PK","lat":36.32,"lng":74.65}}
{"type":"step","id":"locate","label":"Finding Hunza on the map","status":"done","ms":184,"detail":"Hunza, Pakistan · 36.32°, 74.65°"}
{"type":"step","id":"weather","label":"Checking the weather for your dates","status":"running"}
{"type":"step","id":"currency","label":"Converting your budget to PKR","status":"running"}
{"type":"text","delta":"## Trip snapshot\nFive slow, scenic days…"}
{"type":"data","key":"trip","value":{"currency":"PKR","total":72000,"budget":[…],"days":[…]}}
{"type":"done","requestId":"564b28d1"}
```

| Event   | Fields                                        | Meaning                                                                                                                                |
| ------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `step`  | `id`, `label`, `status`, `ms?`, `detail?`     | A step started (`running`) or finished (`done`, `skipped`, `error`). `skipped` means a tool failed and the plan carried on without it. |
| `data`  | `key`, `value`                                | Structured results (table below).                                                                                                      |
| `text`  | `delta`                                       | The next piece of the plan in Markdown. Join the deltas in order.                                                                      |
| `done`  | `requestId`                                   | The stream finished normally.                                                                                                          |
| `error` | `code`, `message`, `retryAfter?`, `requestId` | The stream stopped. `message` is safe to show to visitors.                                                                             |

**Step IDs.** Plan mode: `read`, `locate`, `weather`, `currency`, `write`, `map`, `budget`. Compare mode: `read`, `locateA`, `locateB`, `weatherA`, `weatherB`, `write`. Chat mode: `context`, `write`, and `switch` for a new destination.

| Data key         | Value                                                                                                                 | When                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `place`          | `{ name, region, country, countryCode, lat, lng }`                                                                    | Plan, after locating                                                                       |
| `weather`        | `{ source: "forecast" \| "typical", days: [{ date, label, icon, max, min, rainChance, rainMm }] }`                    | Plan. `forecast` within 15 days; otherwise `typical`, observed on the same dates last year |
| `fx`             | `{ from, to, rate, amount, converted }`                                                                               | Plan, when the destination uses another currency                                           |
| `places`         | `[placeA, placeB]`                                                                                                    | Compare                                                                                    |
| `compareWeather` | `[weatherA, weatherB]`                                                                                                | Compare                                                                                    |
| `trip`           | `{ currency, total, budget: [{ category, amount }], days: [{ day, title, places: [{ name, lat, lng }] }], compare? }` | After the text: map pins, budget chart and compare scores                                  |
| `newTrip`        | The trip fields for the new destination                                                                               | Chat, when a different place is asked about                                                |

### Reading the stream (JavaScript)

```js
const res = await fetch("/api/plan", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    mode: "plan",
    trip: { destination: "Hunza", days: 5 },
  }),
});
if (!res.ok) throw new Error((await res.json()).error.message);

const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
let buffer = "";
let plan = "";
for (;;) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += value;
  const lines = buffer.split("\n");
  buffer = lines.pop(); // keep a half-received line for the next chunk
  for (const line of lines.filter(Boolean)) {
    const event = JSON.parse(line);
    if (event.type === "step") console.log(event.status, event.label);
    if (event.type === "text") plan += event.delta;
    if (event.type === "error") throw new Error(event.message);
  }
}
```

### With curl

```bash
curl -N https://tripmind-travel-agent.vercel.app/api/plan \
  -H 'content-type: application/json' \
  -d '{"mode":"plan","trip":{"destination":"Istanbul","days":3,"budget":1500,"currency":"USD"}}'
```

## GET /api/places

Suggests cities, regions and countries worldwide (GeoNames data via Open-Meteo), with the biggest matches first.

```bash
curl 'https://tripmind-travel-agent.vercel.app/api/places?q=Dub'
```

```json
{
  "places": [
    {
      "name": "Dubai",
      "region": "",
      "country": "United Arab Emirates",
      "countryCode": "AE",
      "lat": 25.07,
      "lng": 55.31
    }
  ]
}
```

- `q` takes 2–60 characters. A shorter query returns `{ "places": [] }`.
- Returns up to 7 places. Results are cached for a day.
- Always answers `200` (even when the lookup fails) so typing is never interrupted. Past the rate limit it answers `429` with an empty list.

## POST /api/contact

Receives a Hire Me message.

```json
{
  "name": "Ali Khan",
  "email": "ali@example.com",
  "message": "I need a booking chatbot for my agency."
}
```

| Field     | Rules                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------- |
| `name`    | 2–80 characters                                                                                       |
| `email`   | A valid email, up to 120 characters                                                                   |
| `message` | 10–3,000 characters                                                                                   |
| `_honey`  | Hidden bot trap. Leave it empty; if filled, the server answers `{ "ok": true }` and drops the message |

Every message is written to the server logs, so none is lost. Delivery then depends on the settings:

- With `RESEND_API_KEY` and `CONTACT_TO_EMAIL` set, the server emails it and answers `{ "ok": true }`.
- Without them, it answers `{ "ok": false, "useBrowser": true }` and the website delivers the message through FormSubmit.

| Status | Body                                                                               |
| ------ | ---------------------------------------------------------------------------------- |
| 200    | `{ "ok": true }` or `{ "ok": false, "useBrowser": true }`                          |
| 400    | `{ "ok": false, "error": "…" }`: not JSON, over 12 KB, or a field failed the rules |
| 403    | Sent from another website                                                          |
| 429    | More than 5 messages in 10 minutes                                                 |

## GET /api/health

```json
{
  "ok": true,
  "service": "TripMind agent",
  "model": "gemini-3.8-flash",
  "aiConfigured": true,
  "tools": ["open-meteo geocoding", "open-meteo weather", "exchange rates"],
  "time": "2026-11-04T15:00:00.000Z"
}
```

`aiConfigured` says whether a Gemini key is set, without revealing it. `model` is the first model the agent will try.

## Errors

Errors before the stream starts are ordinary JSON responses:

```json
{
  "error": {
    "code": "RATE_LIMIT",
    "message": "Too many requests. Please wait a moment.",
    "retryAfter": 42
  }
}
```

| Code         | Status       | Where    | Meaning                                                                                             |
| ------------ | ------------ | -------- | --------------------------------------------------------------------------------------------------- |
| `BAD_INPUT`  | 400          | Response | Not JSON, over 32 KB, or a required field is missing                                                |
| `FORBIDDEN`  | 403          | Response | Sent from another website                                                                           |
| `METHOD`     | 405          | Response | Use POST                                                                                            |
| `RATE_LIMIT` | 429 / stream | Both     | Too many requests from this visitor, or the Gemini free quota is used up. Wait `retryAfter` seconds |
| `NO_KEY`     | stream       | Stream   | `GEMINI_API_KEY` is not set on the server                                                           |
| `BAD_KEY`    | stream       | Stream   | Google rejected the key                                                                             |
| `MODEL`      | stream       | Stream   | No Gemini model in the list is available. The agent already tried every fallback                    |
| `UPSTREAM`   | stream       | Stream   | Gemini is busy or returned an error. Retrying usually works                                         |
| `NETWORK`    | stream       | Stream   | Gemini could not be reached, or stopped sending for too long                                        |
| `BLOCKED`    | stream       | Stream   | Gemini's safety filter declined the request                                                         |
| `INTERNAL`   | stream       | Stream   | Unexpected server error, logged with the request ID                                                 |

Once the stream has started, the status is already `200`, so problems arrive as an `error` event instead.

## Reliability

- **Parallel tools.** Weather and currency run at the same time, so the plan starts in about two seconds.
- **Graceful tools.** If a weather or currency lookup fails, its step is marked `skipped` and the plan continues.
- **Model fallback.** The agent tries each model in `GEMINI_MODEL` (default `gemini-3.8-flash`, then lighter models) and follows Google's suggested replacement when a model is retired.
- **Timeouts.** A model that does not start answering, or stops mid-answer, is abandoned for the next one. Functions may run up to 120 seconds.
- **Caching.** Geocoding, weather, exchange rates and place suggestions are cached in memory.

## Settings (Vercel environment variables)

| Variable                                                   | Required | Purpose                                                      |
| ---------------------------------------------------------- | -------- | ------------------------------------------------------------ |
| `GEMINI_API_KEY`                                           | Yes      | Free key from Google AI Studio                               |
| `GEMINI_MODEL`                                             | No       | Comma-separated model list, tried in order                   |
| `ALLOWED_ORIGINS`                                          | No       | Extra domains allowed to call the API from a browser         |
| `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` | No       | Send contact messages from the server instead of the browser |
