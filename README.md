# TripMind — AI Travel Advisor Agent

[![CI](https://github.com/NimrahImran/tripmind-ai-travel-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/NimrahImran/tripmind-ai-travel-agent/actions/workflows/ci.yml)

TripMind plans a trip the way a good travel agent would: it looks things up first, then writes the plan. Tell it where, when, how many people and your budget; it finds the place, checks the weather for your exact dates, converts your budget to the local currency, and streams a day-by-day plan with a route map, a budget chart and a travel kit. You can watch every step as it happens.

**Live demo: [tripmind-travel-agent.vercel.app](https://tripmind-travel-agent.vercel.app)** · **API docs: [/docs](https://tripmind-travel-agent.vercel.app/docs)** · **[OpenAPI spec](https://tripmind-travel-agent.vercel.app/openapi.json)**

Built by **Nimra Imran**, AI Engineer.

## Features

- **Agent with tools**: geocoding, live or typical weather and exchange rates run in parallel before a single model call
- **Streaming with a live steps panel**: "Checking the weather… ✓" with timings, then the plan types out word by word
- **Clean output**: real Markdown rendered as headings, lists and tables, in a fixed section order, with no stray symbols
- **Route map** with numbered stops per day (Leaflet + Esri, English labels), **weather strip**, **budget donut** with an over/under-budget check
- **Follow-up edits**: "Make day 2 cheaper" updates only the parts that change, plus the map and budget; asking about another place ("what about Maldives?") runs the full agent for it
- **Worldwide place search** while typing: popular places on the first letter, then every city and region via `/api/places`
- **Compare two places** with fit scores, costs and weather side by side
- **Travel styles** (Backpacker, Family, Honeymoon, Luxury) and **English / Roman Urdu** replies
- **Save trips** in the browser and **download a PDF**
- **Contact form** sent through the site's own `/api/contact` and delivered by email through FormSubmit (Resend optional), every message also saved in the logs, with validation, spam protection, rate limiting, and no message ever lost
- **Hero slider** of 10 destinations, a WebGL globe, fully responsive down to small phones
- **Share card** (Open Graph) so links show a full preview on WhatsApp, LinkedIn and X

## API

| Endpoint | Method | What it does |
| --- | --- | --- |
| `/api/plan` | POST | Plan a trip, compare two places or edit a plan, streamed as NDJSON events |
| `/api/places` | GET | Worldwide place suggestions while typing |
| `/api/contact` | POST | The Hire Me form |
| `/api/health` | GET | Status, including whether the AI key is set |

Full reference with request fields, stream events, error codes and examples: **[docs/API.md](docs/API.md)**, or the interactive version at [`/docs`](https://tripmind-travel-agent.vercel.app/docs). After changing an endpoint, update `scripts/build-openapi.mjs` and run `npm run docs:api`; the tests fail if the spec and the code disagree.

## Architecture

```
Browser ──POST /api/plan──▶ Vercel function (Node)
                               ├─ validate input, rate limit
                               ├─ geocode (Open-Meteo)
                               ├─ weather ┐ in parallel
                               ├─ currency┘
                               └─ Gemini (one streamed call)
        ◀── NDJSON events ──── step · data · text · done | error
```

Each line the browser receives is one JSON event:

```json
{"type":"step","id":"weather","label":"Checking the weather for your dates","status":"done","ms":412}
{"type":"data","key":"weather","value":{"source":"forecast","days":[...]}}
{"type":"text","delta":"## Trip snapshot\n..."}
{"type":"done"}
```

The model writes Markdown followed by a hidden JSON block (map pins and budget). The server strips that block out of the visible text before it is sent, then validates it and sends it as a `data` event.

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Leaflet, cobe (WebGL globe), react-markdown |
| Backend | Vercel serverless functions (Node, Web `Request`/`Response`), JSDoc types checked by TypeScript |
| Quality | Vitest (83 tests), GitHub Actions CI |
| API docs | OpenAPI 3.1 spec, interactive reference at `/docs`, guide in [docs/API.md](docs/API.md) |
| AI | Google Gemini Flash (3.x) via streaming REST, automatic model fallback that follows Google's model replacements |
| Data | Open-Meteo geocoding, forecast and archive APIs; open.er-api.com exchange rates; Esri map tiles with English labels and automatic fallback |

### Reliability and safety

- The API key lives only on the server (`GEMINI_API_KEY`), is sent to Google in a header (never a URL), and never reaches the browser
- Only the TripMind site may call the agent: requests from other websites are refused, so nobody else can spend the AI quota (`ALLOWED_ORIGINS` adds more hosts)
- All input is trimmed, typed and length-limited before use; request bodies over 32 KB are rejected
- Per-IP rate limiting and short in-memory caches for tool calls
- Every request gets an id (`x-request-id` header and in the final event) that matches one JSON log line in Vercel, with mode, outcome and timing but no trip details
- The planner, map and Markdown renderer load separately, so the first page ships about 56 KB of gzipped JavaScript
- Every tool call has a timeout; if one fails the step is marked skipped and the plan continues
- Clear errors for a missing key, a rejected key and free-tier quota limits (with an automatic retry countdown)
- If one Gemini model is busy or retired, the next one in `GEMINI_MODEL` is tried

## Project structure

```
api/
  plan.js            the agent endpoint (streams events)
  places.js          worldwide place suggestions
  contact.js         Hire Me form delivery
  health.js          status check
  _lib/              gemini client, tools, prompts, validation, helpers
src/
  components/        Hero, HowItWorks, UnderTheHood, About, HireMe, Footer…
  components/agent/  form, steps panel, plan text, map, weather, budget, globe
  data/              destinations for the hero slider
  config/site.js     your name and contact links
tests/               Vitest suite for every backend module
scripts/             OpenAPI builder, offline API demo, share-image generator
docs/API.md          full API reference (endpoints, stream events, errors)
public/openapi.json  OpenAPI 3.1 spec, served with the interactive docs at /docs
.github/workflows/   CI: type check, tests and build on every push
```

## Quality checks

The backend is plain JavaScript with JSDoc types, checked by the TypeScript compiler in strict mode. Tests use a fake `fetch` that answers like Google and Open-Meteo, so they run offline in about two seconds.

```bash
npm run typecheck   # TypeScript over api/
npm test            # 83 tests
npm run check       # all of the above plus a production build (what CI runs)
```

What the tests cover:

- **Validation**: defaults, clamping, unknown values, control characters, size limits
- **Tools**: picking the right place from namesakes, forecast vs typical weather, date edge cases, currency conversion, caching
- **Gemini client**: SSE parsing, hidden "thinking" parts, key sent in a header, model fallback on 404 and 429, retry delay, bad or missing key, server errors, safety blocks
- **API docs**: the OpenAPI spec lists every real endpoint, method, step, data key, error code, validation rule and rate limit, and nothing extra
- **Agent endpoint**: event order, tool failures that don't stop the plan, the hidden data block never leaking however the stream is split, compare and follow-up modes, cross-site refusal, bad JSON, oversized bodies, rate limiting

## Run locally

```bash
npm install
cp .env.example .env      # then paste your Gemini key into .env
npm run dev
```

No key yet? Run with built-in sample data: `MOCK_GEMINI=1 MOCK_TOOLS=1 npm run dev`.

See the agent's event stream in the terminal, no key needed: `npm run demo:api`.

## Deploy on Vercel

1. Import the GitHub repo in Vercel (framework: Vite, detected automatically).
2. Get a free key at [Google AI Studio](https://aistudio.google.com/apikey).
3. In Vercel, open **Settings → Environment Variables**, add `GEMINI_API_KEY` with your key, and save.
4. Redeploy. Visit `/api/health` to confirm `"aiConfigured": true`.
5. Contact form: add `GMAIL_USER` (your Gmail address) and `GMAIL_APP_PASSWORD` (a Google [app password](https://myaccount.google.com/apppasswords), needs 2-Step Verification on). Messages then arrive in your Gmail, with Reply going straight to the visitor. Without them the form falls back to Resend (`RESEND_API_KEY` + `CONTACT_TO_EMAIL`) or FormSubmit in the browser. Every message is also written to Vercel → Logs (`contact_received`).

## Credits

Destination photos from [Unsplash](https://unsplash.com). Weather and geocoding by [Open-Meteo](https://open-meteo.com). Maps © OpenStreetMap contributors, © CARTO.
