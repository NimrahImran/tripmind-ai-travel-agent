import { useCallback, useEffect, useRef, useState } from 'react';
import { destinations, formatCoords } from '../data/destinations.js';
import { ArrowLeft, ArrowRight, Pin, Sparkle } from './Icons.jsx';

const AUTOPLAY_MS = 7000;
const N = destinations.length;

export default function Hero({ onPlan }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle] = useState(0); // restarts the progress bar
  const touch = useRef(null);
  const seen = useRef(new Set([0]));
  seen.current.add(index);

  const go = useCallback((i) => {
    setIndex(((i % N) + N) % N);
    setCycle((c) => c + 1);
  }, []);
  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  // Autoplay, paused while hovered/focused or when the tab is hidden.
  useEffect(() => {
    if (paused) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const t = setTimeout(() => {
      if (!document.hidden) go(index + 1);
      else setCycle((c) => c + 1);
    }, AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [index, paused, cycle, go]);

  // Preload the next two photos so slides never flash empty.
  useEffect(() => {
    const w = window.innerWidth;
    [1, 2].forEach((k) => {
      const d = destinations[(index + k) % N];
      const im = new Image();
      im.src = w <= 760 ? d.imageMobile : w <= 1440 ? d.imageMid : d.image;
    });
  }, [index]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  };
  const onTouchStart = (e) => (touch.current = e.touches[0].clientX);
  const onTouchEnd = (e) => {
    if (touch.current == null) return;
    const dx = e.changedTouches[0].clientX - touch.current;
    if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
    touch.current = null;
  };

  const d = destinations[index];
  const upcoming = Array.from({ length: 4 }, (_, k) => destinations[(index + k + 1) % N]);

  return (
    <section
      id="top"
      className="hero"
      aria-roledescription="carousel"
      aria-label="Featured destinations"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="hero-bg" aria-hidden="true">
        {destinations.map((x, i) => (
          <div
            key={x.id}
            className={`hero-layer ${i === index ? 'is-active' : ''}`}
            style={{ '--tone-a': x.tone[0], '--tone-b': x.tone[1] }}
          >
            {(i === index || seen.current.has(i) || i === (index + 1) % N) && (
              <picture>
                <source media="(max-width: 760px)" srcSet={x.imageMobile} />
                <source media="(max-width: 1440px)" srcSet={x.imageMid} />
                <img src={x.image} alt="" decoding="async" fetchpriority={i === 0 ? 'high' : 'low'} />
              </picture>
            )}
          </div>
        ))}
        <div className="hero-shade" />
      </div>

      <div className="hero-inner wrap">
        <div className="hero-copy" aria-live="polite">
          <p className="hero-where">
            <Pin width="18" />
            <span>
              {d.region}, {d.country}
            </span>
            <span className="hero-coords">{formatCoords(d.lat, d.lng)}</span>
          </p>
          <h1 className={`hero-name ${d.name.length > 9 ? 'is-long' : ''}`} key={d.id}>
            {d.name}
          </h1>
          <p className="hero-blurb" key={`${d.id}-b`}>
            {d.blurb}
          </p>
          <ul className="hero-facts" aria-label="Highlights">
            {d.facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={() => onPlan(d)}>
              <Sparkle />
              Plan a trip to {d.name}
            </button>
            <a href="#how" className="btn btn-ghost">
              See how it works
            </a>
          </div>
        </div>

        <div className="hero-deck" role="list" aria-label="Up next">
          {upcoming.map((u, k) => (
            <button
              role="listitem"
              key={u.id}
              className="deck-card"
              style={{ '--k': k, '--tone-a': u.tone[0], '--tone-b': u.tone[1] }}
              onClick={() => go(destinations.indexOf(u))}
              aria-label={`Show ${u.name}, ${u.country}`}
            >
              <img src={u.thumb} alt="" loading="lazy" decoding="async" />
              <span className="deck-meta">
                <strong>{u.name}</strong>
                <span>{u.country}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="hero-controls wrap">
        <div className="hero-arrows">
          <button className="round-btn" onClick={prev} aria-label="Previous destination">
            <ArrowLeft width="22" />
          </button>
          <button className="round-btn" onClick={next} aria-label="Next destination">
            <ArrowRight width="22" />
          </button>
        </div>
        <div className="hero-progress" aria-hidden="true">
          {destinations.map((x, i) => (
            <span key={x.id} className={i < index ? 'is-past' : i === index ? 'is-now' : ''}>
              {i === index && <i key={cycle} className={paused ? 'is-paused' : ''} />}
            </span>
          ))}
        </div>
        <p className="hero-count">
          <strong>{String(index + 1).padStart(2, '0')}</strong> / {String(N).padStart(2, '0')}
        </p>
      </div>
    </section>
  );
}
