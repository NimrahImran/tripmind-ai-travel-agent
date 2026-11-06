import { useState } from 'react';
import { site } from '../config/site.js';
import { Briefcase, Check, Github, Linkedin, Send, Sparkle } from './Icons.jsx';

const SERVICES = [
  { title: 'AI agents', body: 'Assistants that use tools and live data to finish tasks, like this travel planner.' },
  { title: 'RAG chatbots', body: 'Chatbots that answer from your own documents, website or knowledge base.' },
  { title: 'AI automation', body: 'Workflows that read, sort and respond for you, connected to the apps you use.' },
];

const CHANNELS = [
  { key: 'fiverr', label: 'Fiverr', Icon: Briefcase },
  { key: 'upwork', label: 'Upwork', Icon: Briefcase },
  { key: 'linkedin', label: 'LinkedIn', Icon: Linkedin },
  { key: 'github', label: 'GitHub', Icon: Github },
].filter((c) => site.links[c.key]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function HireMe() {
  return (
    <section id="hire" className="section hire on-dark">
      <div className="wrap hire-grid">
        <div>
          <div className="section-head">
            <h2>Want an AI agent like this for your business?</h2>
            <p>Tell me what you want to automate. I’ll reply with how I’d build it, usually within a day.</p>
          </div>
          <ul className="services">
            {SERVICES.map((s) => (
              <li key={s.title} className="service">
                <Sparkle width="20" />
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              </li>
            ))}
          </ul>
          {CHANNELS.length > 0 && (
            <div className="channels">
              {CHANNELS.map(({ key, label, Icon }) => (
                <a key={key} className="channel" href={site.links[key]} target="_blank" rel="noreferrer">
                  <Icon width="18" />
                  <span>{label}</span>
                </a>
              ))}
            </div>
          )}
        </div>
        <ContactForm />
      </div>
    </section>
  );
}

function ContactForm() {
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [errors, setErrors] = useState({});
  const [failReason, setFailReason] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    if (data.get('_honey')) return; // a bot filled the hidden field
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim();
    const message = String(data.get('message') || '').trim();

    const next = {};
    if (name.length < 2) next.name = 'Enter your name.';
    if (!EMAIL_RE.test(email)) next.email = 'Enter a valid email so I can reply.';
    if (message.length < 10) next.message = 'Write a short message, at least 10 characters.';
    setErrors(next);
    if (Object.keys(next).length) {
      form.querySelector(`[name="${Object.keys(next)[0]}"]`)?.focus();
      return;
    }

    setState('sending');
    try {
      // 1) The site's own backend (Gmail or Resend), never blocked by ad blockers.
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
        signal: AbortSignal.timeout(20000),
      });
      const body = await res.json().catch(() => ({}));
      if (!body.ok && body.useBrowser) {
        // 2) Backup: FormSubmit straight from the browser.
        const fs = await fetch(`https://formsubmit.co/ajax/${site.formSubmitId}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ name, email, message, _subject: `New TripMind enquiry from ${name}`, _template: 'table', _replyto: email }),
          signal: AbortSignal.timeout(15000),
        }).catch(() => null); // blocked by an ad blocker or offline
        const fsBody = fs ? await fs.json().catch(() => ({})) : { message: 'Browser could not reach FormSubmit' };
        if (!fs || !fs.ok || String(fsBody.success) === 'false') {
          // Tell the backend what FormSubmit said, so the reason shows in the logs.
          fetch('/api/contact', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ report: String(fsBody.message || `HTTP ${fs?.status}`), name, email, message }),
            keepalive: true,
          }).catch(() => {});
          setFailReason('The message couldn’t be delivered right now. Please try again in a minute.');
          setState('error');
          return;
        }
      } else if (!res.ok || !body.ok) {
        setFailReason(body.error || '');
        setState('error');
        return;
      }
      setState('sent');
      form.reset();
    } catch {
      setFailReason('');
      setState('error');
    }
  };

  if (state === 'sent') {
    return (
      <div className="contact-card sent" role="status">
        <span className="sent-icon" aria-hidden="true">
          <Check width="26" />
        </span>
        <h3>Message sent</h3>
        <p>Thanks for reaching out. I’ll reply to your email soon.</p>
        <button className="btn btn-ghost btn-sm" onClick={() => setState('idle')}>
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form className="contact-card" onSubmit={onSubmit} noValidate aria-label="Contact form">
      <h3>Send me a message</h3>
      <div className="cf-field">
        <label htmlFor="cf-name">Your name</label>
        <input id="cf-name" name="name" autoComplete="name" maxLength={80} aria-invalid={!!errors.name || undefined} aria-describedby={errors.name ? 'cf-name-err' : undefined} />
        {errors.name && <span id="cf-name-err" className="cf-error">{errors.name}</span>}
      </div>
      <div className="cf-field">
        <label htmlFor="cf-email">Your email</label>
        <input id="cf-email" name="email" type="email" autoComplete="email" maxLength={120} aria-invalid={!!errors.email || undefined} aria-describedby={errors.email ? 'cf-email-err' : undefined} />
        {errors.email && <span id="cf-email-err" className="cf-error">{errors.email}</span>}
      </div>
      <div className="cf-field">
        <label htmlFor="cf-message">What do you need?</label>
        <textarea
          id="cf-message"
          name="message"
          rows="5"
          maxLength={3000}
          placeholder="e.g. A chatbot that answers customer questions from our product catalogue."
          aria-invalid={!!errors.message || undefined}
          aria-describedby={errors.message ? 'cf-message-err' : undefined}
        />
        {errors.message && <span id="cf-message-err" className="cf-error">{errors.message}</span>}
      </div>
      <input type="text" name="_honey" tabIndex={-1} autoComplete="off" className="sr-only" aria-hidden="true" />
      <button className="btn btn-primary cf-submit" disabled={state === 'sending'}>
        <Send />
        {state === 'sending' ? 'Sending…' : 'Send message'}
      </button>
      {state === 'error' && (
        <p className="cf-fail" role="alert">
          {failReason || 'The message couldn’t be sent. Check your internet connection and try again.'}
        </p>
      )}
    </form>
  );
}
