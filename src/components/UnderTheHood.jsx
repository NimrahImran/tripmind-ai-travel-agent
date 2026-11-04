const FLOW = [
  { title: 'Your browser', body: 'Sends the trip details once and reads the live event stream.' },
  { title: 'Agent API', body: 'A Vercel serverless function that validates input and runs the steps.' },
  { title: 'Tools in parallel', body: 'Open-Meteo geocoding and weather, plus exchange rates, fetched at the same time.' },
  { title: 'Gemini', body: 'One model call with all the facts, streamed back word by word.' },
  { title: 'Clean result', body: 'Markdown for the plan, hidden JSON for the map pins and budget chart.' },
];

const SAMPLE = `{"type":"step","label":"Checking the weather for your dates","status":"running"}
{"type":"step","label":"Checking the weather for your dates","status":"done","ms":412}
{"type":"data","key":"weather","value":{"source":"forecast","days":[…]}}
{"type":"text","delta":"## Trip snapshot\\nFive slow, scenic days…"}
{"type":"done"}`;

const STACK = [
  ['Frontend', 'React, Vite, Leaflet maps, a WebGL globe'],
  ['Backend', 'Node.js serverless functions on Vercel'],
  ['AI model', 'Google Gemini Flash, streaming with automatic model fallback'],
  ['Live data', 'Open-Meteo weather and geocoding, exchange rates'],
  ['Safety', 'Key stays on the server, only this site may call the agent, input validation, rate limiting'],
  ['Quality', '80 automated tests, type-checked backend, checks run on every update'],
];

export default function UnderTheHood() {
  return (
    <section id="hood" className="section hood">
      <div className="wrap">
        <div className="section-head">
          <h2>Under the hood</h2>
          <p>
            For anyone curious about how the agent is built. Each request follows the same path, and the slow parts run
            side by side so answers start in about two seconds.
          </p>
        </div>

        <ol className="flow" aria-label="Request flow">
          {FLOW.map((f, i) => (
            <li key={f.title} className="flow-node">
              <span className="flow-num" aria-hidden="true">
                {i + 1}
              </span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </li>
          ))}
        </ol>

        <div className="hood-grid">
          <div className="hood-main">
            <figure className="code-card">
              <figcaption>What the browser receives, one line per event</figcaption>
              <pre>
                <code>{SAMPLE}</code>
              </pre>
            </figure>
            <div className="hood-links">
              <a className="btn btn-primary" href="/docs">
                Read the API docs
              </a>
              <a className="btn btn-quiet" href="/openapi.json" download>
                OpenAPI spec
              </a>
              <a
                className="btn btn-quiet"
                href="https://github.com/NimrahImran/tripmind-ai-travel-agent"
                target="_blank"
                rel="noopener noreferrer"
              >
                Source on GitHub
              </a>
            </div>
          </div>
          <dl className="stack">
            {STACK.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
