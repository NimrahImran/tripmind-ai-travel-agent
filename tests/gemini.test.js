import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentError, streamGemini } from '../api/_lib/gemini.js';
import { geminiSse, installFetch, jsonRes } from './helpers.js';

const run = () => {
  const chunks = [];
  return streamGemini({ system: 's', prompt: 'p', onText: (t) => chunks.push(t) }).then((full) => ({ full, chunks }));
};

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key';
  delete process.env.GEMINI_MODEL;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GEMINI_API_KEY;
});

describe('streamGemini', () => {
  it('streams text chunk by chunk and returns the full answer', async () => {
    installFetch({ gemini: () => geminiSse('Hello traveller, here is your plan.') });
    const { full, chunks } = await run();
    expect(full).toBe('Hello traveller, here is your plan.');
    expect(chunks.length).toBeGreaterThan(3);
  });

  it('never forwards hidden "thinking" parts', async () => {
    installFetch({ gemini: () => geminiSse('Visible', { thoughts: true }) });
    const { full } = await run();
    expect(full).toBe('Visible');
  });

  it('sends the key in a header, never in the URL', async () => {
    const { fake } = installFetch();
    await run();
    const [url, init] = fake.mock.calls[0];
    expect(String(url)).not.toContain('test-key');
    expect(init.headers['x-goog-api-key']).toBe('test-key');
  });

  it('falls back to the next model when one is retired', async () => {
    const { calls } = installFetch({
      gemini: (model) => (model === 'gemini-2.5-flash' ? jsonRes(404, { error: { message: 'model not found' } }) : geminiSse('From lite')),
    });
    const { full } = await run();
    expect(full).toBe('From lite');
    expect(calls).toHaveLength(2);
  });

  it('tries another model when one hits its free quota', async () => {
    installFetch({
      gemini: (model) => (model === 'gemini-2.5-flash' ? jsonRes(429, { error: { message: 'quota' } }) : geminiSse('Second model')),
    });
    expect((await run()).full).toBe('Second model');
  });

  it('reports RATE_LIMIT with Google’s retry delay when every model is busy', async () => {
    installFetch({
      gemini: () => jsonRes(429, { error: { details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '23s' }] } }),
    });
    await expect(run()).rejects.toMatchObject({ code: 'RATE_LIMIT', retryAfter: 23 });
  });

  it('explains a rejected key', async () => {
    installFetch({ gemini: () => jsonRes(400, { error: { message: 'API key not valid.' } }) });
    await expect(run()).rejects.toMatchObject({ code: 'BAD_KEY' });
  });

  it('explains a missing key without calling Google', async () => {
    delete process.env.GEMINI_API_KEY;
    const { calls } = installFetch();
    const err = await run().catch((e) => e);
    expect(err).toBeInstanceOf(AgentError);
    expect(err.code).toBe('NO_KEY');
    expect(calls).toHaveLength(0);
  });

  it('asks the user to retry on Google server errors', async () => {
    installFetch({ gemini: () => jsonRes(503, { error: { message: 'overloaded' } }) });
    await expect(run()).rejects.toMatchObject({ code: 'UPSTREAM', retryAfter: 8 });
  });

  it('turns an empty safety-blocked answer into a clear error', async () => {
    const blocked = `data: ${JSON.stringify({ candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }] })}\n\n`;
    installFetch({ gemini: () => new Response(blocked, { status: 200 }) });
    await expect(run()).rejects.toMatchObject({ code: 'BLOCKED' });
  });

  it('respects a custom model list', async () => {
    process.env.GEMINI_MODEL = 'my-model';
    const { calls } = installFetch();
    await run();
    expect(calls[0]).toContain('/models/my-model:streamGenerateContent');
  });
});
