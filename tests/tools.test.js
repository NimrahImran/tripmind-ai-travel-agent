import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCache } from '../api/_lib/http.js';
import { convert, currencyFor, geocode, weatherFor } from '../api/_lib/tools.js';
import { installFetch } from './helpers.js';

const iso = (d) => d.toISOString().slice(0, 10);
const inDays = (n) => iso(new Date(Date.now() + n * 86400_000));

beforeEach(() => clearCache());
afterEach(() => vi.unstubAllGlobals());

describe('geocode', () => {
  it('prefers the real, well-known place over a tiny namesake', async () => {
    installFetch();
    const p = await geocode('Hunza');
    expect(p).toMatchObject({ name: 'Hunza', country: 'Pakistan', countryCode: 'PK' });
  });

  it('caches lookups', async () => {
    const { calls } = installFetch();
    await geocode('Hunza');
    await geocode('hunza');
    expect(calls.filter((u) => u.includes('geocoding')).length).toBe(1);
  });
});

describe('weatherFor', () => {
  const place = { lat: 36.3, lng: 74.6 };

  it('uses the live forecast for trips in the next two weeks', async () => {
    const { calls } = installFetch();
    const w = await weatherFor(place, inDays(3), 2);
    expect(w.source).toBe('forecast');
    expect(calls.some((u) => u.includes('api.open-meteo.com/v1/forecast'))).toBe(true);
    expect(w.days[0]).toMatchObject({ icon: '☀️', label: 'Clear sky', max: 21, min: 10, rainChance: 5 });
    expect(w.days[1].label).toBe('Rain');
  });

  it("uses last year's observed weather for trips further away", async () => {
    const { calls } = installFetch();
    const start = inDays(60);
    const w = await weatherFor(place, start, 2);
    expect(w.source).toBe('typical');
    const archive = calls.find((u) => u.includes('archive-api'));
    expect(archive).toBeTruthy();
    const qStart = new URL(archive).searchParams.get('start_date');
    expect(qStart < iso(new Date())).toBe(true);
    expect(w.days[0].date).toBe(start); // shown with the real trip dates
  });

  it('moves a past start date to today and caps trips at 14 days', async () => {
    const { calls } = installFetch();
    await weatherFor(place, '2001-01-01', 30);
    const url = new URL(calls.find((u) => u.includes('open-meteo')));
    expect(url.searchParams.get('start_date')).toBe(iso(new Date()));
  });
});

describe('currency', () => {
  it('maps countries to currencies', () => {
    expect(currencyFor('pk')).toBe('PKR');
    expect(currencyFor('IT')).toBe('EUR');
    expect(currencyFor('ZZ')).toBe('USD');
  });

  it('converts using the live rate', async () => {
    installFetch();
    const r = await convert(100000, 'PKR', 'USD');
    expect(r).toMatchObject({ from: 'PKR', to: 'USD', rate: 0.0036, converted: 360 });
  });

  it('skips the network for the same currency', async () => {
    const { calls } = installFetch();
    const r = await convert(5000, 'PKR', 'PKR');
    expect(r.converted).toBe(5000);
    expect(calls).toHaveLength(0);
  });
});
