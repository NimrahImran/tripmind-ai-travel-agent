const fmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

export default function WeatherStrip({ weather, title }) {
  if (!weather?.days?.length) return null;
  return (
    <section className="panel weather" aria-label={title || 'Weather'}>
      <header className="panel-head">
        <h3>{title || 'Weather on your days'}</h3>
        <span className="panel-note">{weather.source === 'forecast' ? 'Live forecast' : 'Typical for these dates'}</span>
      </header>
      <ol className="wx-row">
        {weather.days.map((d, i) => (
          <li key={d.date} className={`wx ${d.rainChance >= 50 || d.rainMm >= 4 ? 'is-wet' : ''}`}>
            <span className="wx-day">Day {i + 1}</span>
            <span className="wx-date">{fmt.format(new Date(d.date + 'T12:00:00'))}</span>
            <span className="wx-icon" role="img" aria-label={d.label}>
              {d.icon}
            </span>
            <span className="wx-temp">
              <strong>{d.max}°</strong> {d.min}°
            </span>
            <span className="wx-rain">
              {d.rainChance != null ? `${d.rainChance}% rain` : d.rainMm ? `${d.rainMm} mm` : d.label}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
