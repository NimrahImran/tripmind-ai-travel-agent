import { useEffect, useState } from 'react';
import { Sparkle } from './Icons.jsx';

/** Bottom-right button that jumps to the planner; hides on the hero and while the planner is on screen. */
export default function FloatingCTA() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const vh = window.innerHeight;
      const pastHero = window.scrollY > vh * 0.35;
      // Looked up each time: the planner section loads in after the page.
      const r = document.getElementById('agent')?.getBoundingClientRect();
      const inAgent = r ? r.top < vh * 0.6 && r.bottom > vh * 0.4 : false;
      // Also step aside for the contact form so it never covers the Send button.
      const f = document.querySelector('.contact-card')?.getBoundingClientRect();
      const inForm = f ? f.top < vh && f.bottom > 0 : false;
      setHidden(!pastHero || inAgent || inForm);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <a href="#agent" className={`fab ${hidden ? 'is-hidden' : ''}`} aria-label="Open the AI trip planner" tabIndex={hidden ? -1 : 0}>
      <span className="fab-orb" aria-hidden="true">
        <Sparkle width="20" />
      </span>
      <span className="fab-label">Plan with AI</span>
    </a>
  );
}
