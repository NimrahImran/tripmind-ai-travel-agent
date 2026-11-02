import { Sparkle, Swap } from '../Icons.jsx';
import PlaceInput from './PlaceInput.jsx';

export const CURRENCIES = ['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'INR', 'CAD', 'AUD', 'TRY', 'MYR'];
export const STYLES = [
  ['balanced', 'Balanced'],
  ['backpacker', 'Backpacker'],
  ['family', 'Family'],
  ['honeymoon', 'Honeymoon'],
  ['luxury', 'Luxury'],
];
export const INTERESTS = ['Food', 'History', 'Nature', 'Adventure', 'Culture', 'Beaches', 'Shopping', 'Photography'];

export const EXAMPLES = [
  { label: 'Hunza, 5 days, PKR 80k for 2', trip: { destination: 'Hunza, Pakistan', days: 5, budget: 80000, currency: 'PKR', travelers: 2, style: 'balanced', interests: ['Nature', 'History'] } },
  { label: 'Istanbul honeymoon, USD 2,500', trip: { destination: 'Istanbul, Türkiye', days: 6, budget: 2500, currency: 'USD', travelers: 2, style: 'honeymoon', interests: ['Food', 'History'] } },
  { label: 'Bali on a backpacker budget', trip: { destination: 'Bali, Indonesia', days: 7, budget: 900, currency: 'USD', travelers: 1, style: 'backpacker', interests: ['Beaches', 'Nature'] } },
  { label: 'Family week in Dubai, AED 9,000', trip: { destination: 'Dubai, United Arab Emirates', days: 5, budget: 9000, currency: 'AED', travelers: 4, style: 'family', interests: ['Shopping', 'Adventure'] } },
];

export const COMPARE_EXAMPLES = [
  { label: 'Hunza or Skardu?', compare: { a: 'Hunza', b: 'Skardu', days: 5, budget: 90000, currency: 'PKR', travelers: 2 } },
  { label: 'Bali or Maldives?', compare: { a: 'Bali', b: 'Maldives', days: 6, budget: 3000, currency: 'USD', travelers: 2, style: 'honeymoon' } },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

function Stepper({ label, value, min, max, onChange, id }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="stepper">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min}>
          −
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
        />
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label={`More ${label.toLowerCase()}`} disabled={value >= max}>
          +
        </button>
      </div>
    </div>
  );
}

function Budget({ value, currency, onValue, onCurrency, id }) {
  return (
    <div className="field field-wide">
      <label htmlFor={id}>Total budget</label>
      <div className="budget-input">
        <select aria-label="Currency" value={currency} onChange={(e) => onCurrency(e.target.value)}>
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min="1"
          step="any"
          required
          value={value}
          onChange={(e) => onValue(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="80000"
        />
      </div>
    </div>
  );
}

function StylePicker({ value, onChange }) {
  return (
    <fieldset className="field field-wide">
      <legend>Travel style</legend>
      <div className="chips">
        {STYLES.map(([v, l]) => (
          <button type="button" key={v} className={`chip ${value === v ? 'is-on' : ''}`} aria-pressed={value === v} onClick={() => onChange(v)}>
            {l}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function LanguageToggle({ value, onChange }) {
  return (
    <div className="lang" role="group" aria-label="Reply language">
      <span>Reply in</span>
      {[
        ['en', 'English'],
        ['ur', 'Roman Urdu'],
      ].map(([v, l]) => (
        <button type="button" key={v} className={value === v ? 'is-on' : ''} aria-pressed={value === v} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function TripForm({ trip, setTrip, onSubmit, busy, destRef, lang, setLang }) {
  const set = (k) => (v) => setTrip((t) => ({ ...t, [k]: v }));
  const toggleInterest = (i) =>
    setTrip((t) => ({ ...t, interests: t.interests.includes(i) ? t.interests.filter((x) => x !== i) : [...t.interests, i] }));

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="field field-wide">
        <label htmlFor="f-dest">Where to?</label>
        <PlaceInput
          id="f-dest"
          ref={destRef}
          required
          placeholder="Start typing a city or country, e.g. Dubai"
          value={trip.destination}
          onChange={set('destination')}
        />
      </div>
      <div className="field">
        <label htmlFor="f-from">From</label>
        <PlaceInput id="f-from" placeholder="Karachi" value={trip.origin} onChange={set('origin')} />
      </div>
      <div className="field">
        <label htmlFor="f-date">Start date</label>
        <input id="f-date" type="date" min={todayIso()} value={trip.startDate} onChange={(e) => set('startDate')(e.target.value)} />
      </div>
      <Stepper id="f-days" label="Days" value={trip.days} min={1} max={14} onChange={set('days')} />
      <Stepper id="f-people" label="Travellers" value={trip.travelers} min={1} max={20} onChange={set('travelers')} />
      <Budget id="f-budget" value={trip.budget} currency={trip.currency} onValue={set('budget')} onCurrency={set('currency')} />
      <StylePicker value={trip.style} onChange={set('style')} />
      <fieldset className="field field-wide">
        <legend>Interests</legend>
        <div className="chips">
          {INTERESTS.map((i) => (
            <button
              type="button"
              key={i}
              className={`chip ${trip.interests.includes(i) ? 'is-on' : ''}`}
              aria-pressed={trip.interests.includes(i)}
              onClick={() => toggleInterest(i)}
            >
              {i}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="field field-wide">
        <label htmlFor="f-notes">Anything else? (optional)</label>
        <textarea
          id="f-notes"
          rows="2"
          maxLength={400}
          placeholder="Vegetarian food, no long hikes, travelling with grandparents…"
          value={trip.notes}
          onChange={(e) => set('notes')(e.target.value)}
        />
      </div>
      <div className="form-foot field-wide">
        <LanguageToggle value={lang} onChange={setLang} />
        <button className="btn btn-primary submit" disabled={busy}>
          <Sparkle />
          {busy ? 'Planning…' : 'Plan my trip'}
        </button>
      </div>
    </form>
  );
}

export function CompareForm({ cmp, setCmp, onSubmit, busy, lang, setLang }) {
  const set = (k) => (v) => setCmp((c) => ({ ...c, [k]: v }));
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="compare-pair field-wide">
        <div className="field">
          <label htmlFor="c-a">First place</label>
          <PlaceInput id="c-a" required maxLength={60} placeholder="Hunza" value={cmp.a} onChange={set('a')} />
        </div>
        <button type="button" className="swap" aria-label="Swap places" onClick={() => setCmp((c) => ({ ...c, a: c.b, b: c.a }))}>
          <Swap width="18" />
        </button>
        <div className="field">
          <label htmlFor="c-b">Second place</label>
          <PlaceInput id="c-b" required maxLength={60} placeholder="Skardu" value={cmp.b} onChange={set('b')} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="c-date">Start date</label>
        <input id="c-date" type="date" min={todayIso()} value={cmp.startDate} onChange={(e) => set('startDate')(e.target.value)} />
      </div>
      <Stepper id="c-days" label="Days" value={cmp.days} min={1} max={14} onChange={set('days')} />
      <Stepper id="c-people" label="Travellers" value={cmp.travelers} min={1} max={20} onChange={set('travelers')} />
      <Budget id="c-budget" value={cmp.budget} currency={cmp.currency} onValue={set('budget')} onCurrency={set('currency')} />
      <StylePicker value={cmp.style} onChange={set('style')} />
      <div className="form-foot field-wide">
        <LanguageToggle value={lang} onChange={setLang} />
        <button className="btn btn-primary submit" disabled={busy}>
          <Sparkle />
          {busy ? 'Comparing…' : 'Compare places'}
        </button>
      </div>
    </form>
  );
}
