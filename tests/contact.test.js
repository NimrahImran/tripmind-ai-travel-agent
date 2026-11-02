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
const good = { name: 'Ali Khan', email: 'ali@example.com', message: 'I need a booking chatbot for my agency.' };

beforeEach(() => resetLimiter());
afterEach(() => vi.unstubAllGlobals());

describe('POST /api/contact', () => {
  it('forwards a valid message to FormSubmit as this website', async () => {
    const fake = vi.fn(async () => jsonRes(200, { success: 'true' }));
    vi.stubGlobal('fetch', fake);
    const res = await send(good);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const [url, init] = fake.mock.calls[0];
    expect(url).toMatch(/^https:\/\/formsubmit\.co\/ajax\/[0-9a-f]{32}$/);
    expect(init.headers.referer).toMatch(/^https:\/\//);
    expect(JSON.parse(init.body)).toMatchObject({ name: 'Ali Khan', _replyto: 'ali@example.com' });
  });

  it('explains when the form still needs activation', async () => {
    vi.stubGlobal('fetch', async () => jsonRes(200, { success: 'false', message: 'This form needs Activation. We sent you an email.' }));
    const res = await send(good);
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body).toMatchObject({ ok: false, activation: true });
  });

  it('reports a clear error when FormSubmit is unreachable', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('offline');
    });
    const body = await (await send(good)).json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/try again/);
  });

  it('rejects incomplete forms without calling FormSubmit', async () => {
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
    vi.stubGlobal('fetch', async () => jsonRes(200, { success: 'true' }));
    expect((await send(good, { origin: 'https://spam.example' })).status).toBe(403);
    let last;
    for (let i = 0; i < 6; i++) last = await send(good, { 'x-forwarded-for': '7.7.7.7' });
    expect(last.status).toBe(429);
  });
});
