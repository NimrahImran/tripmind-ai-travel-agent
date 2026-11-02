import { site } from '../config/site.js';

const SKILLS = ['AI agents', 'RAG systems', 'Chatbots', 'AI automation', 'Machine learning', 'Python', 'LLM APIs', 'MLOps'];

export default function About() {
  return (
    <section id="about" className="section about">
      <div className="wrap about-grid">
        <figure className="about-card">
          <picture className="avatar">
            <source srcSet="/images/nimra.webp" type="image/webp" />
            <img src="/images/nimra.jpg" alt={`${site.owner}, ${site.role}`} width="640" height="640" loading="lazy" decoding="async" />
          </picture>
          <figcaption>
            <span className="about-name">{site.owner}</span>
            <span className="about-role">{site.role}</span>
          </figcaption>
        </figure>
        <div className="about-copy">
          <h2>About me</h2>
          <p className="lead">
            I’m {site.owner}, an AI Engineer who builds agents and automation that do real work, not just chat.
          </p>
          <p>
            I completed the 10-month AI &amp; Data Science programme at SMIT (Saylani Mass IT Training), covering Python,
            statistics, machine learning, deep learning, MLOps, cloud and generative AI. Since then I’ve focused on
            agentic AI: systems that call tools, use live data and explain what they’re doing.
          </p>
          <p>
            TripMind shows that approach end to end: a clean interface, a secure backend, real-time streaming and an
            agent that checks facts before it answers.
          </p>
          <ul className="skills" aria-label="Skills">
            {SKILLS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
