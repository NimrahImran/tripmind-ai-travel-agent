// @ts-check
// POST /api/contact — delivers the Hire Me form to the owner's inbox.
//
// Default: every message is saved in the Vercel logs, then the browser
// delivers it to the inbox through FormSubmit (free, no account; the owner
// clicks "Activate" once in the first email FormSubmit sends).
// Optional: with RESEND_API_KEY and CONTACT_TO_EMAIL set, the server emails it
// with Resend instead.

import { allowRequest, clientIp, isSameOrigin, json, log, newRequestId } from './_lib/http.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f<>]/g, ' ').trim().slice(0, max);
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);

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

  // The browser reports what FormSubmit answered when it refused a message,
  // so the reason is visible in the logs (and the message is kept there too).
  if (typeof body.report === 'string') {
    log('warn', {
      requestId,
      event: 'formsubmit_refused',
      note: clean(body.report, 300),
      name: clean(body.name, 80),
      email: clean(body.email, 120),
      message: clean(body.message, 3000),
    });
    return json({ ok: true }, 200, requestId);
  }

  const name = clean(body.name, 80);
  const email = clean(body.email, 120);
  const message = clean(body.message, 3000);
  if (name.length < 2 || !EMAIL_RE.test(email) || message.length < 10) {
    return json({ ok: false, error: 'Please fill in your name, a valid email and a short message.' }, 400, requestId);
  }

  const key = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!key || !to) {
    // Every message is also kept in the Vercel logs (Logs → search
    // "contact_received"), so none is ever lost. The browser then delivers
    // it to the inbox through FormSubmit.
    log('info', { requestId, event: 'contact_received', name, email, message });
    return json({ ok: false, useBrowser: true }, 200, requestId);
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM_EMAIL || 'TripMind <onboarding@resend.dev>',
        to: to.split(',').map((s) => s.trim()).filter(Boolean),
        reply_to: email,
        subject: `New TripMind enquiry from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
        html: `<p><strong>Name:</strong> ${escapeHtml(name)}<br><strong>Email:</strong> ${escapeHtml(email)}</p><p>${escapeHtml(message).replace(/\n/g, '<br>')}</p><p style="color:#888">Sent from the TripMind contact form. Reply to this email to answer ${escapeHtml(name)}.</p>`,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) {
      log('info', { requestId, event: 'contact', delivered: true, via: 'resend' });
      return json({ ok: true }, 200, requestId);
    }
    const detail = await res.text().catch(() => '');
    // Keep the message so it is never lost, and the reason so it can be fixed.
    log('warn', { requestId, event: 'contact', delivered: false, via: 'resend', status: res.status, note: detail.slice(0, 300), name, email, message });
  } catch (err) {
    log('warn', { requestId, event: 'contact', delivered: false, via: 'resend', note: String(/** @type {any} */ (err)?.message || err), name, email, message });
  }
  return json({ ok: false, useBrowser: true }, 200, requestId);
}

export function GET() {
  return json({ ok: false, error: 'Use POST.' }, 405);
}
