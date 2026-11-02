import { useState } from 'react';
import { Check, Chevron } from '../Icons.jsx';

/**
 * Shows what the agent is doing, like an activity log. Collapsed it shows
 * the current step; expanded it lists every step with timing.
 */
export default function StepsPanel({ steps, status, elapsed }) {
  const [open, setOpen] = useState(false);
  if (!steps.length) return null;

  const running = steps.find((s) => s.status === 'running');
  const doneCount = steps.filter((s) => s.status === 'done').length;
  const busy = status === 'running';

  const summary = busy
    ? running?.label || 'Working'
    : status === 'error'
      ? `Stopped after ${doneCount} step${doneCount === 1 ? '' : 's'}`
      : `${doneCount} steps completed${elapsed ? ` in ${(elapsed / 1000).toFixed(1)}s` : ''}`;

  return (
    <div className={`steps ${busy ? 'is-busy' : ''} ${open ? 'is-open' : ''}`}>
      <button className="steps-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={`steps-badge ${busy ? 'spin' : status === 'error' ? 'err' : 'ok'}`} aria-hidden="true">
          {busy ? null : status === 'error' ? '!' : <Check width="14" />}
        </span>
        <span className="steps-summary" aria-live="polite">
          {summary}
          {busy && <span className="dots" aria-hidden="true" />}
        </span>
        <span className="steps-toggle">
          {open ? 'Hide steps' : 'Show steps'}
          <Chevron width="16" />
        </span>
      </button>
      {open && (
        <ol className="steps-list">
          {steps.map((s) => (
            <li key={s.id} className={`step is-${s.status}`}>
              <span className="step-icon" aria-hidden="true">
                {s.status === 'done' ? <Check width="13" /> : s.status === 'running' ? '' : s.status === 'skipped' ? '–' : '!'}
              </span>
              <span className="step-text">
                <span className="step-label">{s.label}</span>
                {s.detail && <span className="step-detail">{s.detail}</span>}
              </span>
              {s.ms != null && s.status !== 'running' && (
                <span className="step-ms">{s.ms < 1000 ? `${s.ms} ms` : `${(s.ms / 1000).toFixed(1)} s`}</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
