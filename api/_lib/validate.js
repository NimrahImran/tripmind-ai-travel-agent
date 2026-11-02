// @ts-check
// Input validation: every field is trimmed, bounded and typed before the
// agent uses it, so bad input can never reach the model or the tools raw.

const STYLES = ['backpacker', 'family', 'honeymoon', 'luxury', 'balanced'];
const CURRENCIES = ['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'INR', 'CAD', 'AUD', 'TRY', 'MYR'];

const text = (v, max) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, max);
const int = (v, min, max, dflt) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};

export class ValidationError extends Error {}

function common(src) {
  const currency = CURRENCIES.includes(src.currency) ? src.currency : 'PKR';
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(src.startDate || '') ? src.startDate : '';
  return {
    days: int(src.days, 1, 14, 5),
    budget: int(src.budget, 1, 1_000_000_000, 100000),
    currency,
    travelers: int(src.travelers, 1, 20, 2),
    style: STYLES.includes(src.style) ? src.style : 'balanced',
    startDate,
    lang: src.lang === 'ur' ? 'ur' : 'en',
  };
}

export function validateRequest(body) {
  if (!body || typeof body !== 'object') throw new ValidationError('Send the trip details as JSON.');
  const mode = ['plan', 'compare', 'chat'].includes(body.mode) ? body.mode : 'plan';

  if (mode === 'plan') {
    const t = body.trip || {};
    const destination = text(t.destination, 80);
    if (destination.length < 2) throw new ValidationError('Tell TripMind where you want to go.');
    return {
      mode,
      trip: {
        ...common(t),
        destination,
        origin: text(t.origin, 80),
        interests: (Array.isArray(t.interests) ? t.interests : []).map((i) => text(i, 24)).filter(Boolean).slice(0, 8),
        notes: text(t.notes, 400),
      },
    };
  }

  if (mode === 'compare') {
    const c = body.compare || {};
    const a = text(c.a, 60);
    const b = text(c.b, 60);
    if (a.length < 2 || b.length < 2) throw new ValidationError('Enter two destinations to compare.');
    return { mode, compare: { ...common(c), a, b } };
  }

  const c = body.chat || {};
  const message = text(c.message, 600);
  const plan = String(c.plan ?? '').slice(0, 14000);
  if (message.length < 2) throw new ValidationError('Type what you would like to change.');
  if (plan.length < 20) throw new ValidationError('Create a plan first, then ask for changes.');
  const history = (Array.isArray(c.history) ? c.history : [])
    .slice(-4)
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content ?? '').slice(0, 2000) }));
  return { mode, chat: { message, plan, history, destination: text(c.destination, 80), lang: c.lang === 'ur' ? 'ur' : 'en' } };
}
