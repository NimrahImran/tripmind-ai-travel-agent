// @ts-check
// Streams text from Google Gemini. The API key is read from the server
// environment (GEMINI_API_KEY) and never reaches the browser.

const API = 'https://generativelanguage.googleapis.com/v1beta/models';

export const DEFAULT_MODELS = 'gemini-2.5-flash,gemini-2.5-flash-lite,gemini-flash-latest';

/** Models tried in order. If Google retires or rate-limits one, the next is used. */
export function models() {
  return (process.env.GEMINI_MODEL || DEFAULT_MODELS)
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
}

/** An expected failure with a stable code the UI understands. */
export class AgentError extends Error {
  /**
   * @param {'NO_KEY'|'BAD_KEY'|'RATE_LIMIT'|'MODEL'|'UPSTREAM'|'NETWORK'|'BLOCKED'|'INTERNAL'} code
   * @param {string} message
   * @param {{ retryAfter?: number }} [extra]
   */
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'AgentError';
    this.code = code;
    /** @type {number | undefined} seconds the browser should wait before retrying */
    this.retryAfter = extra.retryAfter;
  }
}

export function hasKey() {
  return Boolean(process.env.GEMINI_API_KEY) || process.env.MOCK_GEMINI === '1';
}

export function activeModel() {
  return process.env.MOCK_GEMINI === '1' ? 'mock' : models()[0];
}

/**
 * Streams the model's answer. Calls onText(delta) for each chunk and
 * resolves with the full text.
 * @param {{ system: string, prompt: string, temperature?: number, maxTokens?: number, onText: (delta: string) => void }} opts
 * @returns {Promise<string>}
 */
export async function streamGemini({ system, prompt, temperature = 0.7, maxTokens = 6000, onText }) {
  if (process.env.MOCK_GEMINI === '1') return mockStream(prompt, onText);

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new AgentError(
      'NO_KEY',
      'The AI key is not set up yet. Add GEMINI_API_KEY in Vercel → Settings → Environment Variables, then redeploy.',
    );
  }

  let lastErr;
  for (const model of models()) {
    const generationConfig = { temperature, maxOutputTokens: maxTokens };
    // Thinking adds seconds of silence; this agent already gets its facts from tools.
    if (model.startsWith('gemini-2.5')) generationConfig.thinkingConfig = { thinkingBudget: 0 };

    const res = await fetch(`${API}/${model}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
      }),
      signal: AbortSignal.timeout(90_000),
    }).catch((e) => {
      throw new AgentError('NETWORK', `Could not reach Gemini: ${e.message}`);
    });

    if (res.ok) return readSse(res, onText);

    const body = await res.json().catch(() => ({}));
    const msg = body?.error?.message || `Gemini responded ${res.status}`;

    if (res.status === 429) {
      // Each model has its own free quota, so try the next one first.
      const retry = body?.error?.details?.find((d) => d['@type']?.includes('RetryInfo'))?.retryDelay;
      lastErr = new AgentError('RATE_LIMIT', 'The free AI quota is busy right now.', {
        retryAfter: Math.min(Math.max(parseInt(retry, 10) || 20, 5), 60),
      });
      continue;
    }
    if (res.status === 400 && /api key/i.test(msg)) {
      throw new AgentError('BAD_KEY', 'The Gemini API key was rejected. Check GEMINI_API_KEY in Vercel and redeploy.');
    }
    if (res.status === 403) {
      throw new AgentError('BAD_KEY', 'The Gemini API key does not have access. Create a new key in Google AI Studio.');
    }
    // 404 / unsupported model → try the next model.
    if (res.status === 404 || /not found|not supported/i.test(msg)) {
      if (lastErr?.code !== 'RATE_LIMIT') lastErr = new AgentError('MODEL', msg);
      continue;
    }
    if (res.status >= 500) {
      throw new AgentError('UPSTREAM', 'Gemini is having a moment. Please try again in a few seconds.', {
        retryAfter: 8,
      });
    }
    throw new AgentError('UPSTREAM', msg);
  }
  throw lastErr || new AgentError('MODEL', 'No Gemini model is available.');
}

async function readSse(res, onText) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  let finish = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let chunk;
      try {
        chunk = JSON.parse(payload);
      } catch {
        continue;
      }
      const cand = chunk.candidates?.[0];
      if (cand?.finishReason) finish = cand.finishReason;
      for (const part of cand?.content?.parts || []) {
        if (part.thought || !part.text) continue;
        full += part.text;
        onText(part.text);
      }
    }
  }
  if (!full && finish === 'SAFETY') {
    throw new AgentError('BLOCKED', 'That request could not be answered. Try rephrasing your trip details.');
  }
  return full;
}

/* ------------------------------------------------------------------ */
/* Offline mock (MOCK_GEMINI=1) so the UI can be developed without a key */
/* ------------------------------------------------------------------ */

async function mockStream(prompt, onText) {
  const isCompare = prompt.includes('COMPARE MODE');
  const isChat = prompt.includes('FOLLOW-UP REQUEST');
  const text = isCompare ? MOCK_COMPARE : isChat ? MOCK_CHAT : MOCK_PLAN;
  let full = '';
  const tokens = text.match(/[\s\S]{1,14}/g) || [];
  for (const t of tokens) {
    await new Promise((r) => setTimeout(r, 6));
    full += t;
    onText(t);
  }
  return full;
}

const MOCK_PLAN = `## Trip snapshot
Five slow, scenic days in **Hunza** for two people, built around the Karakoram Highway, apricot orchards and two old forts. Mornings are crisp, so the plan front-loads viewpoints and keeps afternoons for walking.

- **Best base:** Karimabad, walking distance to Baltit Fort
- **Getting around:** one hired jeep with driver for days 2 and 4
- **Budget fit:** comfortably inside PKR 80,000

## Day by day
### Day 1: Arrive in Karimabad
- **Morning:** Drive in from Gilgit along the Karakoram Highway, stopping at Rakaposhi View Point.
- **Afternoon:** Check in, then a slow walk up to **Baltit Fort**.
- **Evening:** Sunset at Eagle's Nest over Ultar and Rakaposhi.

### Day 2: Attabad and Passu
- **Morning:** Boat ride on the turquoise **Attabad Lake**.
- **Afternoon:** Cross the Hussaini Suspension Bridge and see the Passu Cones.
- **Evening:** Apricot cake at a Karimabad café.

### Day 3: Altit and the orchards
- **Morning:** Guided visit to **Altit Fort**, the oldest monument in Gilgit-Baltistan.
- **Afternoon:** Walk the Royal Garden and the old irrigation channels.
- **Evening:** Local dinner: chapshuro and walnut soup.

## Budget breakdown
| Category | Estimated cost | Notes |
|---|---|---|
| Stay | PKR 28,000 | 4 nights, mid-range guesthouse |
| Food | PKR 16,000 | Local cafés and dhabas |
| Transport | PKR 22,000 | Jeep with driver, 2 days |
| Activities | PKR 6,000 | Forts, boat ride |
| **Total** | **PKR 72,000** | PKR 8,000 spare |

## Travel kit
### Packing list
- Warm layers: nights drop below 10°C
- Sunscreen and sunglasses for high-altitude sun

### Useful phrases
- **Shukriya**: thank you
- **Kitne ka hai?**: how much is it?

### Hidden gems
- Hopper Glacier viewpoint in Nagar, 45 minutes away

## Before you go
- Carry cash: ATMs in Karimabad run out on weekends.
- Download offline maps; signal drops past Passu.

<<<TRIPDATA>>>
{"currency":"PKR","total_estimate":72000,"budget":[{"category":"Stay","amount":28000},{"category":"Food","amount":16000},{"category":"Transport","amount":22000},{"category":"Activities","amount":6000}],"days":[{"day":1,"title":"Arrive in Karimabad","places":[{"name":"Rakaposhi View Point","lat":36.1,"lng":74.48},{"name":"Baltit Fort","lat":36.3256,"lng":74.6698},{"name":"Eagle's Nest","lat":36.3333,"lng":74.6833}]},{"day":2,"title":"Attabad and Passu","places":[{"name":"Attabad Lake","lat":36.3366,"lng":74.8656},{"name":"Passu Cones","lat":36.4667,"lng":74.8833}]},{"day":3,"title":"Altit and the orchards","places":[{"name":"Altit Fort","lat":36.3164,"lng":74.6806}]}]}`;

const MOCK_COMPARE = `## Quick verdict
For a 5-day trip in June, **Hunza** wins on scenery and cost; **Bali** wins if you want beaches and easy luxury.

## Side by side
| | Hunza | Bali |
|---|---|---|
| Best for | Mountains, culture | Beaches, wellness |
| Estimated total | PKR 72,000 | PKR 240,000 |
| Weather | 12–24°C, dry | 24–31°C, humid |
| Getting there | Fly to Gilgit + road | Flight via Kuala Lumpur |

## Choose Hunza if
- You love mountains and cool air.

## Choose Bali if
- You want the beach and spa days.

<<<TRIPDATA>>>
{"currency":"PKR","compare":[{"name":"Hunza","score":9,"estimate":72000},{"name":"Bali","score":7,"estimate":240000}]}`;

const MOCK_CHAT = `Done — I made **Day 2** lighter on the wallet.

### Day 2: Attabad and Passu (budget version)
- **Morning:** Shared van to Attabad Lake instead of a private jeep.
- **Afternoon:** Hussaini Bridge and Passu Cones on foot.

This saves about **PKR 9,000**.`;
