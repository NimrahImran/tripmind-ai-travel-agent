// @ts-check
// POST /api/contact — delivers the Hire Me form to the owner's inbox.
//
// The browser posts here (same site, never blocked by ad blockers); this
// function forwards it to FormSubmit, which emails it. The FormSubmit form id
// is an alias, so the owner's email address appears nowhere in the code.

import { allowRequest, clientIp, isSameOrigin, json, log, newRequestId } from './_lib/http.js';

const FORM_ID = () => process.env.CONTACT_FORM_ID || 'a9b8967beaa15198a66de157fe886353';
const SITE = () => (process.env.SITE_URL || 'https://tripmind-travel-agent.vercel.app').replace(/\/$/, '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f<>]/g, ' ').trim().slice(0, max);

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function POST(request) {
  const requestId = newRequestId();
  if (!isSameOrigin(request)) {
    return json({ ok: false, error: 'This form only works on the TripMind website.' }, 403, requestId);
  }
  // A person rarely sends more than a few messages; bots send many.
  const limit = allowRequest(`contact:${clientIp(request)}`, 5, 10 * 60_000);
  if (!limit.ok) {
    return json({ ok: false, error: 'Too many messages. Please try again in a few minutes.' }, 429, requestId);
  }

  /** @type {any} */
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 12_000) throw new Error('too large');
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: 'Send the form as JSON.' }, 400, requestId);
  }

  // Hidden field only bots fill in: pretend success, send nothing.
  if (body._honey) return json({ ok: true }, 200, requestId);

  const name = clean(body.name, 80);
  const email = clean(body.email, 120);
  const message = clean(body.message, 3000);
  if (name.length < 2 || !EMAIL_RE.test(email) || message.length < 10) {
    return json({ ok: false, error: 'Please fill in your name, a valid email and a short message.' }, 400, requestId);
  }

  try {
    const res = await fetch(`https://formsubmit.co/ajax/${FORM_ID()}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        // FormSubmit checks which website a form belongs to.
        origin: SITE(),
        referer: `${SITE()}/`,
      },
      body: JSON.stringify({
        name,
        email,
        message,
        _subject: `New TripMind enquiry from ${name}`,
        _template: 'table',
        _replyto: email,
        _captcha: 'false',
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    /** @type {any} */
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text.slice(0, 200) };
    }
    const delivered = res.ok && String(data.success) !== 'false';
    log(delivered ? 'info' : 'warn', {
      requestId,
      event: 'contact',
      status: res.status,
      delivered,
      note: String(data.message || '').slice(0, 200),
    });
    if (delivered) return json({ ok: true }, 200, requestId);
    const activation = /activat/i.test(String(data.message || ''));
    return json(
      {
        ok: false,
        activation,
        error: activation
          ? 'The contact form is being switched on. Please try again in a little while.'
          : 'The message could not be delivered right now. Please try again shortly.',
      },
      502,
      requestId,
    );
  } catch (err) {
    log('warn', { requestId, event: 'contact', delivered: false, note: String(/** @type {any} */ (err)?.message || err) });
    return json({ ok: false, error: 'The message could not be delivered right now. Please try again shortly.' }, 502, requestId);
  }
}

export function GET() {
  return json({ ok: false, error: 'Use POST.' }, 405);
}
