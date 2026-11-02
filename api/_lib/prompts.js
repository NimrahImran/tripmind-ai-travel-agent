// @ts-check
// Prompt templates. The format rules keep replies clean: real Markdown
// (rendered by the UI), a fixed section order, and no stray symbols.

export const DATA_MARKER = '<<<TRIPDATA>>>';

const STYLE_GUIDE = {
  backpacker: 'Backpacker: hostels and guesthouses, street food, public transport, free sights first.',
  family: 'Family: easy pacing, kid-friendly stops, rest time after lunch, safe central stays.',
  honeymoon: 'Honeymoon: romantic stays, sunset spots, private experiences, one special dinner.',
  luxury: 'Luxury: premium hotels, private transfers, fine dining, skip-the-line experiences.',
  balanced: 'Balanced: comfortable mid-range stays with a mix of must-sees and local spots.',
};

const LANGUAGE = {
  en: 'Write in clear, friendly English.',
  ur: 'Write all sentences in Roman Urdu (Urdu written with English letters, e.g. "Subah jaldi nikalna behtar hai"). Keep place names, prices and the section headings in English.',
};

const FORMAT_RULES = `
FORMAT RULES (follow exactly):
- Use Markdown. Headings only with "## " and "### ". Bullets only with "- ". Bold with **text** for key names.
- Never use hashtags, emoji strings, horizontal rules, code blocks, or underscores for emphasis.
- Keep bullets short (one line each). No filler like "Certainly!" or "I hope this helps".
- Prices always include the currency code, e.g. "PKR 4,500".`;

export const SYSTEM_PROMPT = `You are TripMind, an expert travel advisor agent. You receive live data from tools (location, weather, exchange rates) and turn it into practical, honest trip plans.
- Use the tool data you are given. If weather shows rain on a day, plan indoor or flexible activities for that day and say why.
- Be realistic about prices for the destination and travel style. If the budget is too small, say so plainly and suggest how to make it work.
- Recommend real, well-known places with correct coordinates.
${FORMAT_RULES}`;

function weatherLines(weather) {
  if (!weather?.days?.length) return 'Weather: not available.';
  const head =
    weather.source === 'forecast'
      ? 'Weather forecast for the trip dates:'
      : 'Typical weather for these dates (observed last year, the trip is beyond the 15-day forecast):';
  return (
    head +
    '\n' +
    weather.days
      .map((d, i) => `Day ${i + 1} (${d.date}): ${d.label}, ${d.min}–${d.max}°C${d.rainChance != null ? `, rain chance ${d.rainChance}%` : ''}`)
      .join('\n')
  );
}

function fxLine(fx, budget, currency) {
  if (!fx) return `Budget: ${currency} ${budget.toLocaleString('en-US')} total (exchange rate unavailable).`;
  if (fx.from === fx.to) return `Budget: ${currency} ${budget.toLocaleString('en-US')} total (local currency).`;
  return `Budget: ${currency} ${budget.toLocaleString('en-US')} total ≈ ${fx.to} ${fx.converted.toLocaleString('en-US')} at 1 ${fx.from} = ${fx.rate} ${fx.to}.`;
}

export function planPrompt(trip, ctx) {
  return `Create a ${trip.days}-day trip plan.

TRIP
- Destination: ${trip.destination}${ctx.place ? ` (resolved: ${ctx.place.name}, ${ctx.place.country}; ${ctx.place.lat.toFixed(3)}, ${ctx.place.lng.toFixed(3)})` : ''}
- Travelling from: ${trip.origin || 'not specified'}
- Start date: ${ctx.startDate}
- Travellers: ${trip.travelers}
- Style: ${STYLE_GUIDE[trip.style] || STYLE_GUIDE.balanced}
- Interests: ${trip.interests.length ? trip.interests.join(', ') : 'a bit of everything'}
- Extra notes from the traveller: ${trip.notes || 'none'}

TOOL DATA
${fxLine(ctx.fx, trip.budget, trip.currency)}
${weatherLines(ctx.weather)}

LANGUAGE: ${LANGUAGE[trip.lang] || LANGUAGE.en}

Write these sections in this exact order:
## Trip snapshot
Two or three sentences, then 3 bullets: best area to stay, how to get around, whether the budget fits.
## Day by day
For every day: "### Day N: short title", then bullets "**Morning:**", "**Afternoon:**", "**Evening:**" with specific places and an approximate cost where useful.
## Budget breakdown
A Markdown table with columns Category | Estimated cost | Notes. Rows: Stay, Food, Transport, Activities, and Other if needed, then a bold Total row. All amounts in ${trip.currency}.
## Travel kit
"### Packing list" (4–6 bullets based on the weather), "### Useful phrases" (4 local phrases with meaning), "### Safety and etiquette" (3 bullets), "### Hidden gems" (2–3 bullets).
## Before you go
Three practical bullets (visa/entry, money, connectivity or bookings).

After the last section, output a line containing exactly ${DATA_MARKER} and then ONE line of minified JSON, nothing after it:
{"currency":"${trip.currency}","total_estimate":number,"budget":[{"category":"Stay","amount":number},...],"days":[{"day":1,"title":"string","places":[{"name":"string","lat":number,"lng":number}]}]}
Include 2–4 real places per day with accurate coordinates. Amounts are numbers in ${trip.currency} without separators.`;
}

export function comparePrompt(cmp, ctx) {
  const side = (p, w, label) =>
    `${label}: ${p ? `${p.name}, ${p.country}` : 'unknown'}\n${weatherLines(w)}`;
  return `COMPARE MODE. Compare two destinations for this traveller and recommend one.

TRAVELLER
- Trip length: ${cmp.days} days, starting ${ctx.startDate}
- Travellers: ${cmp.travelers}
- Budget: ${cmp.currency} ${cmp.budget.toLocaleString('en-US')} total
- Style: ${STYLE_GUIDE[cmp.style] || STYLE_GUIDE.balanced}

TOOL DATA
${side(ctx.placeA, ctx.weatherA, `A = ${cmp.a}`)}
${side(ctx.placeB, ctx.weatherB, `B = ${cmp.b}`)}

LANGUAGE: ${LANGUAGE[cmp.lang] || LANGUAGE.en}

Write these sections in this exact order:
## Quick verdict
Two sentences naming the better fit for THIS traveller and why.
## Side by side
A Markdown table with an empty first header and the two destination names as the other headers. Rows: Best for, Estimated total (${cmp.currency}), Weather on these dates, Getting there, Entry and visa, Food scene, Crowds.
## Choose ${cmp.a} if
3 bullets.
## Choose ${cmp.b} if
3 bullets.

After the last section, output a line containing exactly ${DATA_MARKER} and then ONE line of minified JSON, nothing after it:
{"currency":"${cmp.currency}","compare":[{"name":"${cmp.a}","score":number 1-10,"estimate":number},{"name":"${cmp.b}","score":number 1-10,"estimate":number}]}`;
}

export function chatPrompt(chat) {
  const history = (chat.history || [])
    .slice(-4)
    .map((m) => `${m.role === 'user' ? 'Traveller' : 'TripMind'}: ${m.content.slice(0, 1500)}`)
    .join('\n');
  return `FOLLOW-UP REQUEST about an existing trip plan.

CURRENT PLAN
${chat.plan.slice(0, 12000)}

${history ? `RECENT CONVERSATION\n${history}\n` : ''}
TRAVELLER'S REQUEST
${chat.message}

LANGUAGE: ${LANGUAGE[chat.lang] || LANGUAGE.en}

Answer in one short opening sentence, then show ONLY the parts of the plan that change (use the same "### Day N: title" style). Do not repeat unchanged days. If the request is a question, just answer it clearly.
If the places or budget changed, finish with a line containing exactly ${DATA_MARKER} and ONE line of minified JSON describing the FULL updated trip in the same schema as the original plan (currency, total_estimate, budget, days with places). Otherwise do not output the marker.`;
}

/** Splits the model output into the visible Markdown and the JSON payload. */
export function splitData(text) {
  const i = text.indexOf(DATA_MARKER);
  if (i < 0) return { markdown: text.trim(), data: null };
  const markdown = text.slice(0, i).trim();
  const raw = text.slice(i + DATA_MARKER.length).trim().replace(/^```(json)?|```$/g, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < 0) return { markdown, data: null };
  try {
    return { markdown, data: JSON.parse(raw.slice(start, end + 1)) };
  } catch {
    return { markdown, data: null };
  }
}

/** Keeps only well-formed numbers/strings from the model's JSON. */
export function cleanTripData(d) {
  if (!d || typeof d !== 'object') return null;
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(String(v).replace(/[^\d.-]/g, '')) || 0);
  const out = { currency: String(d.currency || '').slice(0, 5) };
  if (Array.isArray(d.budget)) {
    out.budget = d.budget
      .map((b) => ({ category: String(b.category || '').slice(0, 30), amount: num(b.amount) }))
      .filter((b) => b.category && b.amount > 0)
      .slice(0, 8);
    out.total = num(d.total_estimate) || out.budget.reduce((s, b) => s + b.amount, 0);
  }
  if (Array.isArray(d.days)) {
    out.days = d.days.slice(0, 14).map((day, i) => ({
      day: num(day.day) || i + 1,
      title: String(day.title || '').slice(0, 80),
      places: (Array.isArray(day.places) ? day.places : [])
        .map((p) => ({ name: String(p.name || '').slice(0, 80), lat: num(p.lat), lng: num(p.lng) }))
        .filter((p) => p.name && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && (p.lat || p.lng))
        .slice(0, 6),
    }));
  }
  if (Array.isArray(d.compare)) {
    out.compare = d.compare.slice(0, 2).map((c) => ({
      name: String(c.name || '').slice(0, 60),
      score: Math.min(10, Math.max(0, num(c.score))),
      estimate: num(c.estimate),
    }));
  }
  return out;
}
