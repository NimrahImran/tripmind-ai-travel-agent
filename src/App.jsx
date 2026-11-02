import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import Nav from './components/Nav.jsx';
import Hero from './components/Hero.jsx';
import HowItWorks from './components/HowItWorks.jsx';
import UnderTheHood from './components/UnderTheHood.jsx';
import About from './components/About.jsx';
import HireMe from './components/HireMe.jsx';
import Footer from './components/Footer.jsx';
import FloatingCTA from './components/FloatingCTA.jsx';

// The planner (map, globe, Markdown) is the heaviest part, so it loads
// separately: the hero shows instantly and the planner arrives in the background.
const loadAgent = () => import('./components/agent/AgentSection.jsx');
const AgentSection = lazy(loadAgent);

function AgentPlaceholder() {
  return (
    <section id="agent" className="section agent on-dark agent-loading" aria-busy="true">
      <div className="wrap">
        <div className="section-head compact">
          <h2>Plan your trip</h2>
          <p>Loading the planner…</p>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  // A destination picked in the hero is handed to the agent form.
  const [prefill, setPrefill] = useState(null);

  useEffect(() => {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
    idle(() => loadAgent());
  }, []);

  const planDestination = useCallback((d) => {
    setPrefill({ destination: `${d.name}, ${d.country}`, nonce: Date.now() });
    document.getElementById('agent')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <>
      <a className="skip-link" href="#agent">
        Skip to the trip planner
      </a>
      <Nav />
      <main>
        <Hero onPlan={planDestination} />
        <HowItWorks />
        <Suspense fallback={<AgentPlaceholder />}>
          <AgentSection prefill={prefill} />
        </Suspense>
        <UnderTheHood />
        <About />
        <HireMe />
      </main>
      <Footer />
      <FloatingCTA />
    </>
  );
}
