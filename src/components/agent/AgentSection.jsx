import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { savedTrips, streamAgent } from '../../lib/agentClient.js';
import { destinations, formatCoords } from '../../data/destinations.js';
import { Bookmark, Download, Send, Trash } from '../Icons.jsx';
import { COMPARE_EXAMPLES, CompareForm, EXAMPLES, STYLES, TripForm } from './AgentForms.jsx';
import BudgetDonut from './BudgetDonut.jsx';
import GlobeView from './GlobeView.jsx';
import StepsPanel from './StepsPanel.jsx';
import WeatherStrip from './WeatherStrip.jsx';

// Only needed once a plan exists; fetched as soon as someone starts planning.
const loadPlanText = () => import('./PlanText.jsx');
const loadTripMap = () => import('./TripMap.jsx');
const LazyPlanText = lazy(loadPlanText);
const LazyTripMap = lazy(loadTripMap);
const preloadResultParts = () => {
  loadPlanText();
  loadTripMap();
};

const PlanText = (props) => (
  <Suspense fallback={<div className="md">{props.text}</div>}>
    <LazyPlanText {...props} />
  </Suspense>
);
const TripMap = (props) => (
  <Suspense fallback={<section className="panel map-panel" aria-label="Route map"><div className="map" /></section>}>
    <LazyTripMap {...props} />
  </Suspense>
);

const DEFAULT_TRIP = {
  destination: '',
  origin: '',
  startDate: '',
  days: 5,
  travelers: 2,
  budget: 100000,
  currency: 'PKR',
  style: 'balanced',
  interests: [],
  notes: '',
};
const DEFAULT_CMP = { a: '', b: '', startDate: '', days: 5, travelers: 2, budget: 100000, currency: 'PKR', style: 'balanced' };

const GLOBE_MARKERS = destinations.map((d) => ({ location: [d.lat, d.lng], size: 0.045 }));
const FOLLOW_UPS = ['Make it cheaper', 'Add one more day', 'More local food spots', 'Make day 1 more relaxed'];

/** Applies one stream event to a run (pure). */
function applyEvent(run, e) {
  switch (e.type) {
    case 'step': {
      const steps = [...run.steps];
      const i = steps.findIndex((s) => s.id === e.id);
      const s = { id: e.id, label: e.label, status: e.status, ms: e.ms, detail: e.detail };
      if (i >= 0) steps[i] = { ...steps[i], ...s };
      else steps.push(s);
      return { ...run, steps };
    }
    case 'data':
      return { ...run, [e.key === 'trip' ? 'data' : e.key]: e.value };
    case 'text':
      return { ...run, text: run.text + e.delta };
    case 'error':
      return {
        ...run,
        status: 'error',
        error: e,
        elapsed: Date.now() - run.startedAt,
        steps: run.steps.map((s) => (s.status === 'running' ? { ...s, status: 'error' } : s)),
      };
    case 'done':
      return { ...run, status: 'done', elapsed: Date.now() - run.startedAt };
    default:
      return run;
  }
}

/** Streams a request and calls setState at most once per animation frame. */
function runStream(body, initial, setState, signal) {
  let cur = initial;
  let raf = 0;
  const flush = () => {
    raf = 0;
    setState(cur);
  };
  setState(cur);
  return streamAgent(
    body,
    (e) => {
      cur = applyEvent(cur, e);
      if (e.type === 'done' || e.type === 'error') {
        cancelAnimationFrame(raf);
        flush();
      } else if (!raf) raf = requestAnimationFrame(flush);
    },
    signal,
  ).then(() => cur);
}

const newRun = (mode, request, meta) => ({
  id: `${Date.now()}`,
  mode,
  request,
  ...meta,
  status: 'running',
  steps: [],
  text: '',
  startedAt: Date.now(),
});

export default function AgentSection({ prefill }) {
  const [tab, setTab] = useState('plan');
  const [lang, setLang] = useState('en');
  const [trip, setTrip] = useState(DEFAULT_TRIP);
  const [cmp, setCmp] = useState(DEFAULT_CMP);
  const [run, setRun] = useState(null);
  const [view, setView] = useState('compose');
  const [thread, setThread] = useState([]);
  const [saved, setSaved] = useState([]);
  const [savedNote, setSavedNote] = useState('');
  const abortRef = useRef(null);
  const destRef = useRef(null);
  const topRef = useRef(null);

  useEffect(() => {
    setSaved(savedTrips.list());
    // Warm up the result view once the browser is idle.
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2000));
    idle(preloadResultParts);
  }, []);

  // A destination chosen in the hero lands here.
  useEffect(() => {
    if (!prefill) return;
    setTab('plan');
    setView('compose');
    setTrip((t) => ({ ...t, destination: prefill.destination }));
    const id = setTimeout(() => document.getElementById('f-budget')?.focus({ preventScroll: true }), 700);
    return () => clearTimeout(id);
  }, [prefill]);

  const scrollToTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const start = useCallback((mode, request, meta) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setThread([]);
    setSavedNote('');
    setView('result');
    requestAnimationFrame(scrollToTop);
    runStream(request, newRun(mode, request, meta), setRun, ctrl.signal);
  }, []);

  const submitPlan = () => {
    const t = { ...trip, budget: Number(trip.budget) || 0 };
    if (!t.destination.trim() || t.budget <= 0) return;
    const styleLabel = STYLES.find(([v]) => v === t.style)?.[1];
    start(
      'plan',
      { mode: 'plan', trip: { ...t, lang } },
      {
        title: t.destination,
        chips: [`${t.days} day${t.days > 1 ? 's' : ''}`, `${t.travelers} traveller${t.travelers > 1 ? 's' : ''}`, `${t.currency} ${t.budget.toLocaleString('en-US')}`, styleLabel],
        budget: { amount: t.budget, currency: t.currency },
      },
    );
  };

  const submitCompare = () => {
    const c = { ...cmp, budget: Number(cmp.budget) || 0 };
    if (!c.a.trim() || !c.b.trim() || c.budget <= 0) return;
    start(
      'compare',
      { mode: 'compare', compare: { ...c, lang } },
      {
        title: `${c.a} or ${c.b}?`,
        chips: [`${c.days} days`, `${c.travelers} traveller${c.travelers > 1 ? 's' : ''}`, `${c.currency} ${c.budget.toLocaleString('en-US')}`],
      },
    );
  };

  const retry = useCallback(() => {
    if (!run) return;
    const { mode, request, title, chips, budget } = run;
    start(mode, request, { title, chips, budget });
  }, [run, start]);

  const applyExample = (ex) => {
    setTrip({ ...DEFAULT_TRIP, ...ex.trip });
    destRef.current?.focus({ preventScroll: true });
  };
  const applyCompareExample = (ex) => setCmp({ ...DEFAULT_CMP, ...ex.compare });

  /* ---------- Follow-up questions ---------- */
  const sendFollowUp = (message) => {
    if (!run || !message.trim()) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const history = thread.flatMap((m) => [
      { role: 'user', content: m.question },
      { role: 'assistant', content: m.text },
    ]);
    const id = `${Date.now()}`;
    const body = { mode: 'chat', chat: { message, plan: run.text, history, lang } };
    const initial = { ...newRun('chat', body, {}), id, question: message };
    const setItem = (item) =>
      setThread((list) => (list.some((m) => m.id === id) ? list.map((m) => (m.id === id ? item : m)) : [...list, item]));
    runStream(body, initial, setItem, ctrl.signal).then((final) => {
      if (final?.data?.days?.length || final?.data?.budget?.length) {
        setRun((r) => ({ ...r, data: { ...r.data, ...final.data } }));
      }
    });
  };

  /* ---------- Save / PDF ---------- */
  const save = () => {
    if (!run) return;
    const ok = savedTrips.save({
      id: run.id,
      savedAt: new Date().toISOString(),
      run: { ...run, status: 'done' },
      thread: thread.filter((m) => m.status === 'done'),
    });
    setSaved(savedTrips.list());
    setSavedNote(ok ? 'Saved in this browser' : 'Could not save: browser storage is off');
  };
  const openSaved = (s) => {
    abortRef.current?.abort();
    setRun(s.run);
    setThread(s.thread || []);
    setView('result');
    setSavedNote('');
    requestAnimationFrame(scrollToTop);
  };
  const removeSaved = (id) => {
    savedTrips.remove(id);
    setSaved(savedTrips.list());
  };
  const printPlan = () => {
    document.body.classList.add('printing');
    const done = () => {
      document.body.classList.remove('printing');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1500);
  };

  const busy = run?.status === 'running';

  return (
    <section id="agent" className="section agent on-dark" ref={topRef}>
      <div className="agent-glow" aria-hidden="true" />
      <div className="wrap">
        {view === 'compose' ? (
          <div className="compose">
            <div className="compose-panel">
              <div className="section-head compact">
                <h2>Plan your trip</h2>
                <p>Fill in what you know. TripMind looks up the rest and writes the plan while you watch.</p>
              </div>
              <div className="tabs" role="tablist" aria-label="Planner mode">
                <button role="tab" aria-selected={tab === 'plan'} className={tab === 'plan' ? 'is-on' : ''} onClick={() => setTab('plan')}>
                  Plan a trip
                </button>
                <button role="tab" aria-selected={tab === 'compare'} className={tab === 'compare' ? 'is-on' : ''} onClick={() => setTab('compare')}>
                  Compare two places
                </button>
              </div>
              <div className="examples" aria-label="Try an example">
                <span>Try</span>
                {(tab === 'plan' ? EXAMPLES : COMPARE_EXAMPLES).map((ex) => (
                  <button key={ex.label} type="button" className="example" onClick={() => (tab === 'plan' ? applyExample(ex) : applyCompareExample(ex))}>
                    {ex.label}
                  </button>
                ))}
              </div>
              {tab === 'plan' ? (
                <TripForm trip={trip} setTrip={setTrip} onSubmit={submitPlan} busy={busy} destRef={destRef} lang={lang} setLang={setLang} />
              ) : (
                <CompareForm cmp={cmp} setCmp={setCmp} onSubmit={submitCompare} busy={busy} lang={lang} setLang={setLang} />
              )}
            </div>

            <div className="compose-stage">
              <GlobeView className="globe-hero" markers={GLOBE_MARKERS} label="A globe marking ten featured destinations" />
              <p className="stage-caption">Your plan appears here, step by step.</p>
              {run && (
                <button className="btn btn-ghost btn-sm" onClick={() => setView('result')}>
                  Back to your {run.mode === 'compare' ? 'comparison' : 'plan'}
                </button>
              )}
              {saved.length > 0 && (
                <div className="saved">
                  <h3>Saved in this browser</h3>
                  <ul>
                    {saved.map((s) => (
                      <li key={s.id}>
                        <button className="saved-open" onClick={() => openSaved(s)}>
                          <strong>{s.run.title}</strong>
                          <span>{new Date(s.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                        </button>
                        <button className="icon-btn" aria-label={`Delete ${s.run.title}`} onClick={() => removeSaved(s.id)}>
                          <Trash width="16" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : (
          run && (
            <Result
              run={run}
              thread={thread}
              onEdit={() => {
                setView('compose');
                requestAnimationFrame(scrollToTop);
              }}
              onRetry={retry}
              onSave={save}
              savedNote={savedNote}
              onPrint={printPlan}
              onFollowUp={sendFollowUp}
            />
          )
        )}
      </div>
    </section>
  );
}

/* ================================================================== */

function Result({ run, thread, onEdit, onRetry, onSave, savedNote, onPrint, onFollowUp }) {
  const busy = run.status === 'running';
  const focus = run.place || (run.places && run.places[0]) || null;
  const compareMarkers = useMemo(
    () => (run.places || []).filter(Boolean).map((p) => ({ location: [p.lat, p.lng], size: 0.08 })),
    [run.places],
  );
  const markers = run.mode === 'compare' ? compareMarkers : focus ? [{ location: [focus.lat, focus.lng], size: 0.09 }] : [];
  const followBusy = thread.some((m) => m.status === 'running');
  const finished = run.status === 'done' && run.text;

  return (
    <div className="result print-area">
      <div className="result-bar">
        <div className="result-title">
          <h2>{run.title}</h2>
          <ul className="meta-chips">
            {run.chips?.filter(Boolean).map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
        <div className="result-actions no-print">
          <button className="btn btn-ghost btn-sm" onClick={onEdit}>
            Edit trip
          </button>
          {finished && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={onSave}>
                <Bookmark />
                Save
              </button>
              <button className="btn btn-primary btn-sm" onClick={onPrint}>
                <Download />
                Download PDF
              </button>
            </>
          )}
        </div>
        {savedNote && <p className="saved-note no-print" role="status">{savedNote}</p>}
      </div>

      <div className="result-grid">
        <div className="result-main">
          <div className="no-print slot-steps">
            <StepsPanel steps={run.steps} status={run.status} elapsed={run.elapsed} />
          </div>
          {run.status === 'error' && <ErrorBox error={run.error} onRetry={onRetry} />}

          {run.mode === 'compare' && run.data?.compare && <CompareScores data={run.data} />}

          <article className="plan-card">
            {run.text ? (
              <PlanText text={run.text} streaming={busy} />
            ) : busy ? (
              <div className="skeleton" aria-label="Preparing your plan">
                <span />
                <span />
                <span />
                <span />
              </div>
            ) : null}
          </article>

          {thread.map((m) => (
            <div key={m.id} className="turn">
              <p className="turn-q">{m.question}</p>
              <div className="turn-a">
                {m.status === 'running' && !m.text && <p className="turn-wait">Updating your plan…</p>}
                {m.text && <PlanText text={m.text} streaming={m.status === 'running'} />}
                {m.data && <p className="turn-note">Map and budget updated.</p>}
                {m.status === 'error' && <ErrorBox error={m.error} compact />}
              </div>
            </div>
          ))}

          {finished && run.mode === 'plan' && <FollowUp onSend={onFollowUp} busy={followBusy} />}
        </div>

        <aside className="result-side">
          <div className="side-globe panel">
            <GlobeView className="globe-mini" focus={focus} markers={markers} label={focus ? `Globe turned to ${focus.name}` : 'Globe'} />
            <div>
              <p className="side-place">{focus ? `${focus.name}${focus.country ? `, ${focus.country}` : ''}` : 'Locating…'}</p>
              {focus && <p className="side-coords">{formatCoords(focus.lat, focus.lng)}</p>}
            </div>
          </div>

          {run.mode === 'plan' && (
            <>
              <WeatherStrip weather={run.weather} />
              {(run.place || run.data?.days) && <TripMap place={run.place} trip={run.data} />}
              <BudgetDonut data={run.data} budget={run.budget} fx={run.fx} />
            </>
          )}
          {run.mode === 'compare' &&
            (run.compareWeather || []).map((w, i) =>
              w ? <WeatherStrip key={i} weather={w} title={`Weather in ${run.places?.[i]?.name || run.request.compare[i ? 'b' : 'a']}`} /> : null,
            )}
        </aside>
      </div>
    </div>
  );
}

function CompareScores({ data }) {
  return (
    <div className="scores">
      {data.compare.map((c, i) => (
        <div key={c.name} className={`score ${i === 0 && c.score >= data.compare[1]?.score ? 'is-best' : ''} ${i === 1 && c.score > data.compare[0]?.score ? 'is-best' : ''}`}>
          <p className="score-name">{c.name}</p>
          <p className="score-num">
            {c.score}
            <small>/10 fit</small>
          </p>
          <div className="score-bar" aria-hidden="true">
            <i style={{ width: `${c.score * 10}%` }} />
          </div>
          {c.estimate > 0 && (
            <p className="score-est">
              About {data.currency} {Math.round(c.estimate).toLocaleString('en-US')}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function ErrorBox({ error, onRetry, compact }) {
  const [left, setLeft] = useState(error?.retryAfter || 0);
  const fired = useRef(false);

  useEffect(() => {
    if (!error?.retryAfter || !onRetry) return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [error, onRetry]);

  useEffect(() => {
    if (left === 0 && error?.retryAfter && onRetry && !fired.current) {
      fired.current = true;
      onRetry();
    }
  }, [left, error, onRetry]);

  const rate = error?.code === 'RATE_LIMIT';
  return (
    <div className={`error-box ${compact ? 'compact' : ''}`} role="alert">
      <p className="error-title">{rate ? 'The free AI quota is busy' : error?.code === 'NO_KEY' ? 'The planner is not connected yet' : 'That didn’t work'}</p>
      <p>{error?.message}</p>
      {onRetry && (
        <div className="error-actions">
          {rate && left > 0 && <span className="countdown">Retrying in {left}s</span>}
          {error?.code !== 'NO_KEY' && (
            <button className="btn btn-ghost btn-sm" onClick={onRetry}>
              Try again now
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FollowUp({ onSend, busy }) {
  const [msg, setMsg] = useState('');
  const send = (text) => {
    if (busy || !text.trim()) return;
    onSend(text.trim());
    setMsg('');
  };
  return (
    <div className="follow no-print">
      <p className="follow-title">Want changes? Ask TripMind.</p>
      <div className="follow-chips">
        {FOLLOW_UPS.map((f) => (
          <button key={f} className="example" onClick={() => send(f)} disabled={busy}>
            {f}
          </button>
        ))}
      </div>
      <form
        className="follow-box"
        onSubmit={(e) => {
          e.preventDefault();
          send(msg);
        }}
      >
        <label htmlFor="follow-input" className="sr-only">
          Ask for a change
        </label>
        <input
          id="follow-input"
          maxLength={600}
          placeholder="e.g. Swap day 3 for a lake day"
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
        />
        <button className="send" aria-label="Send" disabled={busy || !msg.trim()}>
          <Send width="20" />
        </button>
      </form>
    </div>
  );
}
