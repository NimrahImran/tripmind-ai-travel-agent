const COLORS = ['#f4b13f', '#2e8b83', '#e9705d', '#7aa9d6', '#b48ad6', '#9bb66b', '#d6c28a', '#6b7f8c'];
const money = (cur, n) => `${cur} ${Math.round(n).toLocaleString('en-US')}`;

/** Budget split as a donut chart, compared with what the traveller planned to spend. */
export default function BudgetDonut({ data, budget, fx }) {
  if (!data?.budget?.length) return null;
  const items = data.budget;
  const total = data.total || items.reduce((s, b) => s + b.amount, 0);
  const cur = data.currency || budget?.currency || '';
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;

  const diff = budget?.amount ? budget.amount - total : null;

  return (
    <section className="panel budget" aria-label="Budget breakdown">
      <header className="panel-head">
        <h3>Where the money goes</h3>
        {fx && fx.from !== fx.to && (
          <span className="panel-note">
            {money(fx.from, fx.amount)} ≈ {money(fx.to, fx.converted)}
          </span>
        )}
      </header>
      <div className="budget-body">
        <svg viewBox="0 0 140 140" className="donut" role="img" aria-label={`Estimated total ${money(cur, total)}`}>
          <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="16" />
          {items.map((b, i) => {
            const len = (b.amount / total) * C;
            const seg = (
              <circle
                key={b.category}
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={COLORS[i % COLORS.length]}
                strokeWidth="16"
                strokeDasharray={`${Math.max(len - 2, 0.5)} ${C}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
              />
            );
            offset += len;
            return seg;
          })}
          <text x="70" y="64" textAnchor="middle" className="donut-cap">
            Estimated
          </text>
          <text x="70" y="84" textAnchor="middle" className="donut-total">
            {compact(total)}
          </text>
        </svg>
        <ul className="legend">
          {items.map((b, i) => (
            <li key={b.category}>
              <span className="swatch" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="legend-name">{b.category}</span>
              <span className="legend-val">{money(cur, b.amount)}</span>
              <span className="legend-pct">{Math.round((b.amount / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
      {diff != null && cur === budget.currency && (
        <p className={`budget-verdict ${diff >= 0 ? 'ok' : 'over'}`}>
          {diff >= 0
            ? `Fits your budget with ${money(cur, diff)} to spare.`
            : `About ${money(cur, -diff)} over your budget. Ask TripMind to make it cheaper.`}
        </p>
      )}
    </section>
  );
}

function compact(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e4) return `${Math.round(n / 1e3)}k`;
  return Math.round(n).toLocaleString('en-US');
}
