import { describe, expect, it } from 'vitest';
import { ValidationError, validateRequest } from '../api/_lib/validate.js';

describe('validateRequest', () => {
  it('fills safe defaults for a minimal plan request', () => {
    const r = validateRequest({ mode: 'plan', trip: { destination: '  Hunza  ' } });
    expect(r.trip).toMatchObject({
      destination: 'Hunza',
      days: 5,
      travelers: 2,
      currency: 'PKR',
      style: 'balanced',
      lang: 'en',
      interests: [],
    });
  });

  it('clamps numbers into range', () => {
    const r = validateRequest({ mode: 'plan', trip: { destination: 'Bali', days: 99, travelers: -3, budget: '2500.7' } });
    expect(r.trip.days).toBe(14);
    expect(r.trip.travelers).toBe(1);
    expect(r.trip.budget).toBe(2501);
  });

  it('rejects unknown currencies, styles and bad dates', () => {
    const r = validateRequest({ mode: 'plan', trip: { destination: 'Bali', currency: 'BTC', style: 'pirate', startDate: 'tomorrow' } });
    expect(r.trip.currency).toBe('PKR');
    expect(r.trip.style).toBe('balanced');
    expect(r.trip.startDate).toBe('');
  });

  it('strips control characters and angle brackets', () => {
    const r = validateRequest({ mode: 'plan', trip: { destination: 'Ba<script>li\u0000', notes: 'a'.repeat(1000) } });
    expect(r.trip.destination).not.toMatch(/[<>\u0000]/);
    expect(r.trip.notes).toHaveLength(400);
  });

  it('keeps Roman Urdu only when asked', () => {
    expect(validateRequest({ mode: 'plan', trip: { destination: 'Swat', lang: 'ur' } }).trip.lang).toBe('ur');
    expect(validateRequest({ mode: 'plan', trip: { destination: 'Swat', lang: 'fr' } }).trip.lang).toBe('en');
  });

  it('requires a destination', () => {
    expect(() => validateRequest({ mode: 'plan', trip: { destination: ' ' } })).toThrow(ValidationError);
  });

  it('requires both places when comparing', () => {
    expect(() => validateRequest({ mode: 'compare', compare: { a: 'Hunza' } })).toThrow('two destinations');
    const r = validateRequest({ mode: 'compare', compare: { a: 'Hunza', b: 'Skardu' } });
    expect(r.compare).toMatchObject({ a: 'Hunza', b: 'Skardu', days: 5 });
  });

  it('requires a message and an existing plan for follow-ups', () => {
    expect(() => validateRequest({ mode: 'chat', chat: { message: 'cheaper' } })).toThrow('Create a plan first');
    const r = validateRequest({
      mode: 'chat',
      chat: { message: 'cheaper', plan: '## Trip snapshot\nSome plan text', history: Array(9).fill({ role: 'user', content: 'x' }) },
    });
    expect(r.chat.history).toHaveLength(4);
  });

  it('rejects non-object bodies', () => {
    expect(() => validateRequest(null)).toThrow(ValidationError);
    expect(() => validateRequest('hello')).toThrow(ValidationError);
  });
});
