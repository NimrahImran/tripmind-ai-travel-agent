// @ts-check
// Small helpers shared by the API routes.

/**
 * @typedef {{ type: 'step', id: string, label: string, status: 'running'|'done'|'skipped'|'error', ms?: number, detail?: string }
 *   | { type: 'data', key: string, value: unknown }
 *   | { type: 'text', delta: string }
 *   | { type: 'error', code: string, message: string, retryAfter?: number, requestId?: string }
 *   | { type: 'done', requestId?: string }} AgentEvent
 * @typedef {(event: AgentEvent) => void} Send
 */

/* ------------------------------------------------------------------ */
/* Cache                                                               */
/* ------------------------------------------------------------------ */

/** @type {Map<string, { value: unknown, expires: number }>} */
const cache = new Map();
const CACHE_MAX = 500;

/**
 * In-memory TTL cache. Lives as long as a warm serverless instance.
 * @template T
 * @param {string} key
 * @param {number} ttlMs
 * @param {() => Promise<T>} loader
 * @returns {Promise<T>}
 */
export async function cached(key, ttlMs, loader) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return /** @type {T} */ (hit.value);
  const value = await loader();
  cache.set(key, { value, expires: Date.now() + ttlMs });
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return value;
}

/** Clears the cache (used by tests). */
export function clearCache() {
  cache.clear();
}

/**
 * fetch JSON with a hard timeout so one slow API never blocks the agent.
 * @param {string} url
 * @param {RequestInit & { timeoutMs?: number }} [init]
 * @returns {Promise<any>}
 */
export async function fetchJson(url, { timeoutMs = 7000, ...init } = {}) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
  return res.json();
}

/* ------------------------------------------------------------------ */
/* Request guards                                                      */
/* ------------------------------------------------------------------ */

/** @type {Map<string, number[]>} */
const hits = new Map();

/**
 * Sliding-window limiter per IP (per warm instance) to stop accidental spam.
 * @param {string} ip
 * @param {number} [limit]
 * @param {number} [windowMs]
 * @returns {{ ok: true } | { ok: false, retryAfter: number }}
 */
export function allowRequest(ip, limit = 12, windowMs = 60_000) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    hits.set(ip, list);
    return { ok: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - list[0])) / 1000)) };
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 2000) {
    const oldest = hits.keys().next().value;
    if (oldest !== undefined) hits.delete(oldest);
  }
  return { ok: true };
}

/** Resets the limiter (used by tests). */
export function resetLimiter() {
  hits.clear();
}

/** @param {Request} request */
export function clientIp(request) {
  const fwd = request.headers.get('x-forwarded-for') || '';
  return fwd.split(',')[0].trim() || request.headers.get('x-real-ip') || 'local';
}

/**
 * Browsers always send Origin on cross-site POSTs. Requests from this site,
 * from localhost, or without an Origin (server-to-server, curl) are allowed;
 * other websites are refused. Extra hosts can be allowed via ALLOWED_ORIGINS.
 * @param {Request} request
 */
export function isSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  let host;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  const self = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const extra = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().replace(/^https?:\/\//, ''))
    .filter(Boolean);
  return host === self || /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) || extra.includes(host);
}

/* ------------------------------------------------------------------ */
/* Responses, ids and logs                                             */
/* ------------------------------------------------------------------ */

/** Short random id that ties a browser request to its server log line. */
export function newRequestId() {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * @param {unknown} data
 * @param {number} [status]
 * @param {string} [requestId]
 */
export function json(data, status = 200, requestId) {
  /** @type {Record<string, string>} */
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  if (requestId) headers['x-request-id'] = requestId;
  return new Response(JSON.stringify(data), { status, headers });
}

/**
 * One JSON line per log entry, easy to search in Vercel → Logs.
 * Never logs trip details or keys, only ids, modes, outcomes and timings.
 * @param {'info'|'warn'|'error'} level
 * @param {Record<string, unknown>} fields
 */
export function log(level, fields) {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return;
  const line = JSON.stringify({ level, service: 'tripmind', time: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else console.log(line);
}

/* ------------------------------------------------------------------ */
/* Streaming                                                           */
/* ------------------------------------------------------------------ */

/**
 * Creates an NDJSON stream: one JSON event per line.
 * @returns {{ stream: ReadableStream<Uint8Array>, send: Send, close: () => void, isClosed: () => boolean }}
 */
export function createEventStream() {
  const encoder = new TextEncoder();
  /** @type {ReadableStreamDefaultController<Uint8Array> | undefined} */
  let controller;
  let closed = false;
  const stream = new ReadableStream({
    start(c) {
      controller = c;
    },
    cancel() {
      closed = true;
    },
  });
  /** @type {Send} */
  const send = (event) => {
    if (closed || !controller) return;
    try {
      controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
    } catch {
      closed = true;
    }
  };
  const close = () => {
    if (closed) return;
    closed = true;
    try {
      controller?.close();
    } catch {
      /* already closed */
    }
  };
  return { stream, send, close, isClosed: () => closed };
}

/**
 * Runs a named agent step and reports running → done/skipped with timing.
 * A step may return `__detail` to show a short note under its label.
 * @template T
 * @param {Send} send
 * @param {string} id
 * @param {string} label
 * @param {() => Promise<T>} fn
 * @param {{ soft?: boolean }} [opts] soft steps never stop the agent
 * @returns {Promise<Omit<T, '__detail'> | null>}
 */
export async function step(send, id, label, fn, { soft = true } = {}) {
  const t0 = Date.now();
  send({ type: 'step', id, label, status: 'running' });
  try {
    const result = await fn();
    const detail = result && typeof result === 'object' && '__detail' in result ? /** @type {any} */ (result).__detail : undefined;
    send({ type: 'step', id, label, status: 'done', ms: Date.now() - t0, detail });
    if (result && typeof result === 'object' && '__detail' in result) {
      const { __detail, ...rest } = /** @type {any} */ (result);
      return rest;
    }
    return /** @type {any} */ (result);
  } catch (err) {
    send({
      type: 'step',
      id,
      label,
      status: soft ? 'skipped' : 'error',
      ms: Date.now() - t0,
      detail: soft ? 'Skipped — the plan continues without it' : String(/** @type {Error} */ (err).message || err),
    });
    if (!soft) throw err;
    return null;
  }
}
