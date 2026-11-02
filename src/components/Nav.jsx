import { useEffect, useState } from 'react';
import { Close, Logo, Menu } from './Icons.jsx';

const LINKS = [
  ['How it works', '#how'],
  ['Planner', '#agent'],
  ['Under the hood', '#hood'],
  ['About', '#about'],
  ['Hire me', '#hire'],
];

export default function Nav() {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className={`nav ${solid ? 'is-solid' : ''} ${open ? 'is-open' : ''}`}>
      <div className="nav-inner wrap">
        <a href="#top" className="brand" aria-label="TripMind home">
          <Logo width="30" height="30" />
          <span>TripMind</span>
        </a>
        <nav className="nav-links" aria-label="Main">
          {LINKS.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
        </nav>
        <a href="#agent" className="btn btn-primary btn-sm nav-cta">
          Plan my trip
        </a>
        <button
          className="nav-toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <Close width="24" /> : <Menu width="24" />}
        </button>
      </div>
      <div className="nav-sheet" hidden={!open}>
        {LINKS.map(([label, href]) => (
          <a key={href} href={href} onClick={() => setOpen(false)}>
            {label}
          </a>
        ))}
        <a href="#agent" className="btn btn-primary" onClick={() => setOpen(false)}>
          Plan my trip
        </a>
      </div>
    </header>
  );
}
