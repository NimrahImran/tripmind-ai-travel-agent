import { beforeEach, describe, expect, it } from 'vitest';
import { allowRequest, createEventStream, isSameOrigin, resetLimiter, step } from '../api/_lib/http.js';

const req = (headers) => new Request('https://tripmind.example/api/plan', { method: 'POST', headers });

describe('allowRequest', () => {
  beforeEach(() => resetLimiter());

  it('allows up to the limit, then asks the caller to wait', () => {
    for (let i = 0; i < 3; i++) expect(allowRequest('1.1.1.1', 3).ok).toBe(true);
    const blocked = allowRequest('1.1.1.1', 3);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(allowRequest('2.2.2.2', 3).ok).toBe(true); // other visitors unaffected
  });
});

describe('isSameOrigin', () => {
  it('allows the site itself, localhost and non-browser calls', () => {
    expect(isSameOrigin(req({ origin: 'https://tripmind.example', host: 'tripmind.example' }))).toBe(true);
    expect(isSameOrigin(req({ origin: 'http://localhost:5173', host: 'x' }))).toBe(true);
    expect(isSameOrigin(req({ host: 'tripmind.example' }))).toBe(true);
  });

  it('refuses other websites', () => {
    expect(isSameOrigin(req({ origin: 'https://evil.example', host: 'tripmind.example' }))).toBe(false);
    expect(isSameOrigin(req({ origin: 'not a url', host: 'tripmind.example' }))).toBe(false);
  });

  it('accepts extra hosts from ALLOWED_ORIGINS', () => {
    process.env.ALLOWED_ORIGINS = 'https://portfolio.example';
    expect(isSameOrigin(req({ origin: 'https://portfolio.example', host: 'tripmind.example' }))).toBe(true);
    delete process.env.ALLOWED_ORIGINS;
  });
});

describe('createEventStream + step', () => {
  it('writes one JSON event per line and reports step timing', async () => {
    const { stream, send, close } = createEventStream();
    const result = await step(send, 'w', 'Checking weather', async () => ({ temp: 20, __detail: 'Live' }));
    await step(send, 'x', 'Flaky tool', async () => {
      throw new Error('down');
    });
    close();
    send({ type: 'done' }); // ignored after close
    const lines = (await new Response(stream).text()).trim().split('\n').map((l) => JSON.parse(l));
    expect(result).toEqual({ temp: 20 });
    expect(lines.map((l) => l.status)).toEqual(['running', 'done', 'running', 'skipped']);
    expect(lines[1].detail).toBe('Live');
    expect(typeof lines[1].ms).toBe('number');
  });

  it('can make a step required', async () => {
    const { send } = createEventStream();
    await expect(step(send, 'r', 'Required', async () => Promise.reject(new Error('boom')), { soft: false })).rejects.toThrow('boom');
  });
});
