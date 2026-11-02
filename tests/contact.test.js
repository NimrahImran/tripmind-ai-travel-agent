import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../api/contact.js';
import { resetLimiter } from '../api/_lib/http.js';
import { jsonRes } from './helpers.js';

const send = (body, headers = {}) =>
  POST(
    new Request('https://tripmind.example/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json', host: 'tripmind.example', ...headers },
      body: JSON.stringify(body),
    }),
  );
const good = { name: 'Ali Khan', email: 'ali@example.com', message: 'I need a booking chatbot for my agency <b>now</b>.' };

beforeEach(() => {
  resetLimiter();
  process.env.RESEND_API_KEY = 're_test';
  process.env.CONTACT_TO_EMAIL = 'owner@example.com';
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.RESEND_API_KEY;
  delete process.env.CONTACT_TO_EMAIL;
});

describe('POST /api/contact', () => {
  it('emails the owner through Resend, with reply-to set to the visitor', async () => {
    const fake = vi.fn(async () => jsonRes(200, { id: 'email_1' }));
    vi.stubGlobal('fetch', fake);
    const res = await send(good);
    expect(await res.json()).toEqual({ ok: true });
    const [url, init] = fake.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.authorization).toBe('Bearer re_test');
    const payload = JSON.parse(init.body);
    expect(payload).toMatchObject({ to: ['owner@example.com'], reply_to: 'ali@example.com' });
    expect(payload.html).not.toContain('<b>now'); // visitor text is escaped
  });

  it('tells the browser to use the backup when Resend is not set up', async () => {
    delete process.env.RESEND_API_KEY;
    const fake = vi.fn();
    vi.stubGlobal('fetch', fake);
    expect(await (await send(good)).json()).toEqual({ ok: false, useBrowser: true });
    expect(fake).not.toHaveBeenCalled();
  });

  it('falls back to the backup if Resend refuses or is unreachable', async () => {
    vi.stubGlobal('fetch', async () => jsonRes(403, { message: 'domain not verified' }));
    expect((await (await send(good)).json()).useBrowser).toBe(true);
    vi.stubGlobal('fetch', async () => {
      throw new Error('offline');
    });
    expect((await (await send(good)).json()).useBrowser).toBe(true);
  });

  it('rejects incomplete forms without sending anything', async () => {
    const fake = vi.fn();
    vi.stubGlobal('fetch', fake);
    expect((await send({ name: 'A', email: 'nope', message: 'hi' })).status).toBe(400);
    expect(fake).not.toHaveBeenCalled();
  });

  it('quietly drops bot submissions', async () => {
    const fake = vi.fn();
    vi.stubGlobal('fetch', fake);
    expect(await (await send({ ...good, _honey: 'spam' })).json()).toEqual({ ok: true });
    expect(fake).not.toHaveBeenCalled();
  });

  it('refuses other websites and limits repeated messages', async () => {
    vi.stubGlobal('fetch', async () => jsonRes(200, { id: 'x' }));
    expect((await send(good, { origin: 'https://spam.example' })).status).toBe(403);
    let last;
    for (let i = 0; i < 6; i++) last = await send(good, { 'x-forwarded-for': '7.7.7.7' });
    expect(last.status).toBe(429);
  });
});
