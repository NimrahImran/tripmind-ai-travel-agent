const STEPS = [
  {
    title: 'Tell it about your trip',
    body: 'Where, when, how many people and your budget. Pick a style like Family or Backpacker, and English or Roman Urdu.',
  },
  {
    title: 'Watch the agent work',
    body: 'It finds the place, checks the weather for your exact dates and converts your budget, showing every step as it goes.',
  },
  {
    title: 'Get a plan you can use',
    body: 'A day-by-day plan with a route map, a budget chart and a travel kit. Ask for changes, save it, or download a PDF.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="section how">
      <div className="wrap">
        <div className="section-head">
          <h2>From a rough idea to a full plan in under a minute</h2>
          <p>TripMind is an AI agent, not a chatbot. It looks things up before it answers, so the plan fits the real weather and your real budget.</p>
        </div>
        <ol className="how-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="how-step">
              <span className="how-num" aria-hidden="true">
                {i + 1}
              </span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
