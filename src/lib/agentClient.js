// Talks to /api/plan and turns the NDJSON stream into callbacks.

export async function streamAgent(body, onEvent, signal) {
  let res;
  try {
    res = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') return;
    onEvent({ type: 'error', code: 'OFFLINE', message: 'Could not reach TripMind. Check your internet connection and try again.' });
    return;
  }

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    onEvent({
      type: 'error',
      code: data?.error?.code || 'HTTP',
      message: data?.error?.message || `The planner returned an error (${res.status}).`,
      retryAfter: data?.error?.retryAfter,
    });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawEnd = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let i;
      while ((i = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, i).trim();
        buffer = buffer.slice(i + 1);
        if (!line) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === 'done' || event.type === 'error') sawEnd = true;
          onEvent(event);
        } catch {
          /* ignore a malformed line */
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
  }
  if (!sawEnd) {
    onEvent({ type: 'error', code: 'CUT', message: 'The connection dropped before the plan finished. Try again.' });
  }
}

/** Saved trips live in this browser only. Every access is guarded. */
const KEY = 'tripmind.saved.v1';
export const savedTrips = {
  list() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
      return [];
    }
  },
  save(trip) {
    try {
      const list = savedTrips.list().filter((t) => t.id !== trip.id);
      list.unshift(trip);
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, 12)));
      return true;
    } catch {
      return false;
    }
  },
  remove(id) {
    try {
      localStorage.setItem(KEY, JSON.stringify(savedTrips.list().filter((t) => t.id !== id)));
    } catch {
      /* storage unavailable */
    }
  },
};
