// @ts-check
// The agent's tools: free public APIs, no keys required.
//   Geocoding + weather: Open-Meteo (https://open-meteo.com)
//   Exchange rates:      ExchangeRate-API open access (https://www.exchangerate-api.com)
import { cached, fetchJson } from './http.js';

const MOCK = process.env.MOCK_TOOLS === '1';

/* ------------------------------------------------------------------ */
/* Geocoding                                                           */
/* ------------------------------------------------------------------ */

const PREFERRED_FEATURES = { PCLI: 40, PPLC: 30, ADM1: 22, PPLA: 18, RGN: 18, VAL: 18, ISL: 16, PPLA2: 10 };

export async function geocode(name) {
  if (MOCK) return mockPlace(name);
  const key = `geo:${name.toLowerCase()}`;
  return cached(key, 24 * 3600_000, async () => {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      name.split(',')[0].trim(),
    )}&count=8&language=en&format=json`;
    const data = await fetchJson(url);
    const results = data.results || [];
    if (!results.length) throw new Error(`Could not find "${name}"`);
    const want = name.toLowerCase();
    const hint = name.includes(',') ? name.split(',').slice(1).join(',').trim().toLowerCase() : '';
    const score = (r) =>
      (r.name?.toLowerCase() === want.split(',')[0].trim() ? 25 : 0) +
      (PREFERRED_FEATURES[r.feature_code] || 0) +
      (hint && r.country?.toLowerCase().includes(hint) ? 30 : 0) +
      Math.log10((r.population || 0) + 1) * 3;
    const best = [...results].sort((a, b) => score(b) - score(a))[0];
    return {
      name: best.name,
      country: best.country || '',
      countryCode: best.country_code || '',
      lat: best.latitude,
      lng: best.longitude,
      timezone: best.timezone,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Weather                                                             */
/* ------------------------------------------------------------------ */

const WMO = {
  0: ['Clear sky', '☀️'], 1: ['Mostly clear', '🌤️'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁️'],
  45: ['Fog', '🌫️'], 48: ['Icy fog', '🌫️'],
  51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Heavy drizzle', '🌧️'],
  56: ['Freezing drizzle', '🌧️'], 57: ['Freezing drizzle', '🌧️'],
  61: ['Light rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'],
  66: ['Freezing rain', '🌧️'], 67: ['Freezing rain', '🌧️'],
  71: ['Light snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy snow', '❄️'], 77: ['Snow grains', '🌨️'],
  80: ['Showers', '🌦️'], 81: ['Showers', '🌧️'], 82: ['Violent showers', '⛈️'],
  85: ['Snow showers', '🌨️'], 86: ['Snow showers', '❄️'],
  95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm, hail', '⛈️'], 99: ['Thunderstorm, hail', '⛈️'],
};

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400_000);

/**
 * Day-by-day weather for the trip. Uses the live forecast when the trip is
 * within the next 15 days, otherwise last year's observed weather for the
 * same dates as a "typical" guide.
 */
export async function weatherFor(place, startDate, days) {
  const n = Math.min(Math.max(days, 1), 14);
  const today = new Date(iso(new Date()));
  let start = startDate ? new Date(startDate) : addDays(today, 7);
  if (Number.isNaN(start.getTime())) start = addDays(today, 7);
  if (start < today) start = today;
  const end = addDays(start, n - 1);
  const horizon = addDays(today, 15);

  let source = 'forecast';
  let qStart = start;
  let qEnd = end;
  if (end > horizon) {
    source = 'typical';
    // Same dates, shifted back whole years until they are safely in the past.
    let years = 1;
    while (addDays(end, -365 * years) > addDays(today, -6)) years++;
    qStart = new Date(start);
    qStart.setFullYear(start.getFullYear() - years);
    qEnd = addDays(qStart, n - 1);
  }

  if (MOCK) return mockWeather(start, n, source);

  const daily = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum';
  const base =
    source === 'forecast'
      ? `https://api.open-meteo.com/v1/forecast?daily=${daily},precipitation_probability_max`
      : `https://archive-api.open-meteo.com/v1/archive?daily=${daily}`;
  const url = `${base}&latitude=${place.lat}&longitude=${place.lng}&timezone=auto&start_date=${iso(
    qStart,
  )}&end_date=${iso(qEnd)}`;

  const data = await cached(`wx:${url}`, 3 * 3600_000, () => fetchJson(url));
  const d = data.daily || {};
  const out = (d.time || []).map((_, i) => {
    const code = d.weather_code?.[i] ?? 0;
    const [label, icon] = WMO[code] || ['Mixed', '🌤️'];
    return {
      date: iso(addDays(start, i)),
      code,
      label,
      icon,
      max: round(d.temperature_2m_max?.[i]),
      min: round(d.temperature_2m_min?.[i]),
      rainChance: d.precipitation_probability_max?.[i] ?? null,
      rainMm: round(d.precipitation_sum?.[i], 1),
    };
  });
  return { source, days: out };
}

const round = (v, p = 0) => (v == null ? null : Math.round(v * 10 ** p) / 10 ** p);

/* ------------------------------------------------------------------ */
/* Currency                                                            */
/* ------------------------------------------------------------------ */

// Country → currency for the destinations people ask about most.
const CURRENCY = {
  PK: 'PKR', IN: 'INR', AE: 'AED', SA: 'SAR', QA: 'QAR', OM: 'OMR', TR: 'TRY', EG: 'EGP', MA: 'MAD',
  GB: 'GBP', US: 'USD', CA: 'CAD', AU: 'AUD', NZ: 'NZD', JP: 'JPY', CN: 'CNY', KR: 'KRW', TH: 'THB',
  MY: 'MYR', SG: 'SGD', ID: 'IDR', VN: 'VND', PH: 'PHP', LK: 'LKR', MV: 'MVR', NP: 'NPR', BD: 'BDT',
  CH: 'CHF', NO: 'NOK', SE: 'SEK', DK: 'DKK', IS: 'ISK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RU: 'RUB',
  BR: 'BRL', AR: 'ARS', PE: 'PEN', MX: 'MXN', CL: 'CLP', CO: 'COP', ZA: 'ZAR', KE: 'KES', TZ: 'TZS',
  JO: 'JOD', AZ: 'AZN', GE: 'GEL', UZ: 'UZS', KZ: 'KZT', IR: 'IRR', HK: 'HKD', TW: 'TWD',
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', PT: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', GR: 'EUR',
  IE: 'EUR', FI: 'EUR', HR: 'EUR', SI: 'EUR', SK: 'EUR', EE: 'EUR', LV: 'EUR', LT: 'EUR', MT: 'EUR',
  CY: 'EUR', LU: 'EUR', MC: 'EUR', ME: 'EUR', AL: 'ALL', BA: 'BAM', RS: 'RSD',
};

export function currencyFor(countryCode) {
  return CURRENCY[countryCode?.toUpperCase()] || 'USD';
}

export async function convert(amount, from, to) {
  if (from === to) return { from, to, rate: 1, amount, converted: amount };
  if (MOCK) {
    const rate = 0.0033;
    return { from, to, rate, amount, converted: Math.round(amount * rate) };
  }
  const data = await cached(`fx:${from}`, 6 * 3600_000, () =>
    fetchJson(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`),
  );
  const rate = data?.rates?.[to];
  if (!rate) throw new Error(`No rate for ${from}→${to}`);
  return { from, to, rate, amount, converted: Math.round(amount * rate), updated: data.time_last_update_utc };
}

/* ------------------------------------------------------------------ */
/* Mocks for offline development (MOCK_TOOLS=1)                        */
/* ------------------------------------------------------------------ */

const MOCK_PLACES = {
  hunza: { name: 'Hunza', country: 'Pakistan', countryCode: 'PK', lat: 36.3167, lng: 74.65 },
  bali: { name: 'Bali', country: 'Indonesia', countryCode: 'ID', lat: -8.4095, lng: 115.1889 },
  istanbul: { name: 'Istanbul', country: 'Türkiye', countryCode: 'TR', lat: 41.0082, lng: 28.9784 },
};
function mockPlace(name) {
  const key = name.toLowerCase().split(',')[0].trim();
  return MOCK_PLACES[key] || { name, country: 'Italy', countryCode: 'IT', lat: 40.628, lng: 14.485 };
}
function mockWeather(start, n, source) {
  const codes = [0, 1, 2, 61, 3, 0, 80];
  return {
    source,
    days: Array.from({ length: n }, (_, i) => {
      const code = codes[i % codes.length];
      return {
        date: iso(addDays(start, i)),
        code,
        label: WMO[code][0],
        icon: WMO[code][1],
        max: 18 + (i % 4),
        min: 8 + (i % 3),
        rainChance: [5, 10, 20, 70, 30, 0, 55][i % 7],
        rainMm: 0,
      };
    }),
  };
}
