import { site } from '../config/site.js';
import { Logo } from './Icons.jsx';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <a href="#top" className="brand">
          <Logo width="26" height="26" />
          <span>TripMind</span>
        </a>
        <p>
          Built by <strong>{site.owner}</strong>, {site.role}
        </p>
        <p className="footer-small">
          Destination photos from <a href="https://unsplash.com" target="_blank" rel="noreferrer">Unsplash</a>. Weather by{' '}
          <a href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a>. AI plans are suggestions; check
          visas, prices and opening times before you book.
        </p>
      </div>
    </footer>
  );
}
