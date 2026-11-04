// Keeps public/openapi.json honest: every endpoint, method, limit and error
// code the backend really has must be documented, and nothing invented.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const spec = JSON.parse(readFileSync(new URL('../public/openapi.json', import.meta.url), 'utf8'));
const apiDir = new URL('../api/', import.meta.url);
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

describe('OpenAPI spec', () => {
  it('is OpenAPI 3.1 with a public, keyless security model', () => {
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.security).toEqual([]);
  });

  it('documents every endpoint and every method that does real work', async () => {
    const files = readdirSync(apiDir).filter((f) => f.endsWith('.js'));
    expect(Object.keys(spec.paths).sort()).toEqual(files.map((f) => `/api/${f.replace('.js', '')}`).sort());

    for (const file of files) {
      const mod = await import(new URL(file, apiDir).href);
      const path = `/api/${file.replace('.js', '')}`;
      for (const m of METHODS.filter((name) => typeof mod[name] === 'function')) {
        const documented = Boolean(spec.paths[path][m.toLowerCase()]);
        // A handler that only answers 405 is a guard, documented in the overview.
        const guard = m === 'GET' && mod.POST && mod[m].length === 0 && (await mod[m]()).status === 405;
        expect(documented || guard, `${m} ${path}`).toBe(true);
      }
      for (const m of Object.keys(spec.paths[path]))
        expect(typeof mod[m.toUpperCase()], `${m} ${path}`).toBe('function');
    }
  });

  it('lists exactly the stream error codes the agent can send', () => {
    const src = readFileSync(new URL('../api/_lib/gemini.js', import.meta.url), 'utf8');
    const codes = src.match(/@param \{('[A-Z_]+'\|?)+\} code/)[0].match(/[A-Z_]{3,}/g);
    expect([...spec.components.schemas.StreamError.properties.code.enum].sort()).toEqual([...new Set(codes)].sort());
  });

  it('lists every step id and data key that /api/plan sends', () => {
    const src = readFileSync(new URL('../api/plan.js', import.meta.url), 'utf8');
    const steps = new Set(
      [...src.matchAll(/step\(send, '(\w+)'|id: '(\w+)'|writeWithModel\(send, '(\w+)'/g)].map(
        (m) => m[1] || m[2] || m[3],
      ),
    );
    const keys = new Set([...src.matchAll(/key: '(\w+)'/g)].map((m) => m[1]));
    const { StepEvent, DataEvent } = spec.components.schemas;
    expect([...steps].sort()).toEqual([...StepEvent.properties.id.enum].sort());
    expect([...keys].sort()).toEqual([...DataEvent.properties.key.enum].sort());
  });

  it('matches the validation rules', () => {
    const src = readFileSync(new URL('../api/_lib/validate.js', import.meta.url), 'utf8');
    const list = (name) => JSON.parse(src.match(new RegExp(`const ${name} = (\\[.*?\\]);`))[1].replace(/'/g, '"'));
    const trip = spec.components.schemas.PlanRequest.properties.trip.properties;
    expect([...trip.style.enum].sort()).toEqual(list('STYLES').sort());
    expect(trip.currency.enum).toEqual(list('CURRENCIES'));
    expect([trip.days.minimum, trip.days.maximum, trip.travelers.maximum, trip.budget.maximum]).toEqual([
      1, 14, 20, 1_000_000_000,
    ]);
  });

  it('states the real rate limits', () => {
    expect(spec.paths['/api/plan'].post.description).toContain('12 requests per minute');
    expect(spec.paths['/api/places'].get.description).toContain('90 per minute');
    expect(spec.paths['/api/contact'].post.description).toContain('5 messages per 10 minutes');
  });
});
