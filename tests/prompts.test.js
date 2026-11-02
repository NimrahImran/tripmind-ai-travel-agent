import { describe, expect, it } from 'vitest';
import { DATA_MARKER, chatPrompt, cleanTripData, comparePrompt, planPrompt, splitData } from '../api/_lib/prompts.js';

const trip = {
  destination: 'Hunza',
  origin: 'Karachi',
  days: 3,
  travelers: 2,
  budget: 80000,
  currency: 'PKR',
  style: 'family',
  interests: ['Food'],
  notes: '',
  lang: 'ur',
};

describe('splitData', () => {
  it('separates the visible plan from the hidden JSON', () => {
    const { markdown, data } = splitData(`## Hi\nText\n${DATA_MARKER}\n{"currency":"PKR","budget":[]}`);
    expect(markdown).toBe('## Hi\nText');
    expect(data).toEqual({ currency: 'PKR', budget: [] });
  });

  it('copes with code fences and trailing text around the JSON', () => {
    const { data } = splitData(`x\n${DATA_MARKER}\n\`\`\`json\n{"a":1}\n\`\`\``);
    expect(data).toEqual({ a: 1 });
  });

  it('returns null data for missing or broken JSON', () => {
    expect(splitData('just text').data).toBeNull();
    expect(splitData(`x\n${DATA_MARKER}\n{broken`).data).toBeNull();
  });
});

describe('cleanTripData', () => {
  it('turns numbers written as text into numbers and drops bad places', () => {
    const out = cleanTripData({
      currency: 'PKR',
      budget: [
        { category: 'Stay', amount: '30,000' },
        { category: 'Food', amount: 0 },
        { category: '', amount: 5 },
      ],
      days: [{ day: 1, title: 'A', places: [{ name: 'Ok', lat: 36.3, lng: 74.6 }, { name: 'Off map', lat: 300, lng: 0 }, { name: '', lat: 1, lng: 1 }] }],
    });
    expect(out.budget).toEqual([{ category: 'Stay', amount: 30000 }]);
    expect(out.total).toBe(30000);
    expect(out.days[0].places).toEqual([{ name: 'Ok', lat: 36.3, lng: 74.6 }]);
  });

  it('keeps compare scores between 0 and 10', () => {
    const out = cleanTripData({ currency: 'USD', compare: [{ name: 'A', score: 14, estimate: '900' }, { name: 'B', score: -2, estimate: 1 }] });
    expect(out.compare.map((c) => c.score)).toEqual([10, 0]);
    expect(out.compare[0].estimate).toBe(900);
  });

  it('ignores non-objects', () => {
    expect(cleanTripData(null)).toBeNull();
    expect(cleanTripData('x')).toBeNull();
  });
});

describe('prompts', () => {
  it('puts tool data, style, language and the fixed section order in the plan prompt', () => {
    const p = planPrompt(trip, {
      place: { name: 'Hunza', country: 'Pakistan', lat: 36.3, lng: 74.6 },
      startDate: '2026-11-10',
      fx: { from: 'PKR', to: 'PKR', rate: 1, amount: 80000, converted: 80000 },
      weather: { source: 'forecast', days: [{ date: '2026-11-10', label: 'Rain', min: 5, max: 12, rainChance: 80 }] },
    });
    expect(p).toContain('rain chance 80%');
    expect(p).toContain('Family');
    expect(p).toContain('Roman Urdu');
    const order = ['## Trip snapshot', '## Day by day', '## Budget breakdown', '## Travel kit', '## Before you go', DATA_MARKER];
    const idx = order.map((s) => p.indexOf(s));
    expect(idx.every((i) => i > 0)).toBe(true);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });

  it('says when weather is typical rather than a forecast', () => {
    const p = planPrompt(trip, { place: null, startDate: '2027-06-01', fx: null, weather: { source: 'typical', days: [{ date: 'd', label: 'Sun', min: 1, max: 2 }] } });
    expect(p).toContain('observed last year');
    expect(p).toContain('exchange rate unavailable');
  });

  it('names both places in the compare prompt', () => {
    const p = comparePrompt({ a: 'Hunza', b: 'Skardu', days: 4, travelers: 2, budget: 90000, currency: 'PKR', style: 'balanced', lang: 'en' }, { startDate: '2026-11-10' });
    expect(p).toContain('## Choose Hunza if');
    expect(p).toContain('## Choose Skardu if');
  });

  it('limits the follow-up prompt to recent history', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({ role: 'user', content: `msg ${i}` }));
    const p = chatPrompt({ message: 'cheaper', plan: 'plan', history, lang: 'en' });
    expect(p).toContain('msg 9');
    expect(p).not.toContain('msg 5');
  });
});
