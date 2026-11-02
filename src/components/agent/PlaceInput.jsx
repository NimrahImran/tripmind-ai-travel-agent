import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { popularMatches } from '../../data/popular.js';
import { Pin } from '../Icons.jsx';

const label = (p) => (p.country && p.country !== p.name ? `${p.name}, ${p.country}` : p.name);

/**
 * Text input with worldwide place suggestions: popular places appear on the
 * first letter, then the full world search (/api/places) fills in.
 * Keyboard: ↑ ↓ to move, Enter to pick, Esc to close.
 */
const PlaceInput = forwardRef(function PlaceInput({ id, value, onChange, placeholder, required, maxLength = 80 }, ref) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const listId = useId();
  const wrap = useRef(null);
  const typed = useRef(false); // only suggest after the person types, not on prefill

  useEffect(() => {
    if (!typed.current) return;
    const q = value.trim();
    const local = popularMatches(q);
    setItems(local);
    setActive(-1);
    if (q.length < 2) {
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json();
        const remote = (data.places || []).map((p) => ({ name: p.name, country: p.country, region: p.region }));
        const seen = new Set(local.map((p) => label(p).toLowerCase()));
        const merged = [...local];
        for (const p of remote) {
          const key = label(p).toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(p);
          }
        }
        setItems(merged.slice(0, 8));
      } catch {
        /* keep the instant list */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrap.current && !wrap.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, []);

  const pick = (p) => {
    typed.current = false;
    onChange(label(p));
    setOpen(false);
    setItems([]);
  };

  const onKeyDown = (e) => {
    if (!open || !items.length) {
      if (e.key === 'ArrowDown' && items.length) setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const show = open && items.length > 0;

  return (
    <div className="place" ref={wrap}>
      <input
        id={id}
        ref={ref}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={show}
        aria-controls={listId}
        aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        spellCheck="false"
        required={required}
        minLength={required ? 2 : undefined}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          typed.current = true;
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => items.length && setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {loading && <span className="place-spin" aria-hidden="true" />}
      {show && (
        <ul className="place-list" role="listbox" id={listId}>
          {items.map((p, i) => (
            <li
              key={`${label(p)}-${p.region || ''}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'is-active' : ''}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => pick(p)}
              onMouseEnter={() => setActive(i)}
            >
              <Pin width="16" />
              <span>
                <strong>{p.name}</strong>
                <small>{[p.region, p.country].filter((x) => x && x !== p.name).join(', ')}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

export default PlaceInput;
