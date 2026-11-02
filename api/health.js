// @ts-check
// GET /api/health — quick status check (never reveals the key itself).
import { activeModel, hasKey } from './_lib/gemini.js';
import { json } from './_lib/http.js';

export function GET() {
  return json({
    ok: true,
    service: 'TripMind agent',
    model: activeModel(),
    aiConfigured: hasKey(),
    tools: ['open-meteo geocoding', 'open-meteo weather', 'exchange rates'],
    time: new Date().toISOString(),
  });
}
