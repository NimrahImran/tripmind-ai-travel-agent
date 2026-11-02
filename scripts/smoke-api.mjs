// Offline check of the agent: runs /api/plan with mocked tools + model and
// prints the event stream.  Usage:  npm run check:api
process.env.MOCK_TOOLS = '1';
process.env.MOCK_GEMINI = '1';

const { POST } = await import('../api/plan.js');

async function run(body) {
  const res = await POST(new Request('http://x/api/plan', { method: 'POST', body: JSON.stringify(body) }));
  console.log(`\n=== ${body.mode} → HTTP ${res.status}`);
  if (!res.body) return;
  const text = await new Response(res.body).text();
  const events = text.trim().split('\n').map((l) => JSON.parse(l));
  const textOut = events.filter((e) => e.type === 'text').map((e) => e.delta).join('');
  for (const e of events) if (e.type !== 'text') console.log(JSON.stringify(e).slice(0, 160));
  console.log(`text chars: ${textOut.length}; leaked marker: ${textOut.includes('<<<')}`);
}

await run({ mode: 'plan', trip: { destination: 'Hunza', days: 3, budget: 80000, currency: 'PKR', travelers: 2, style: 'balanced' } });
await run({ mode: 'compare', compare: { a: 'Hunza', b: 'Bali', days: 5, budget: 200000, currency: 'PKR', travelers: 2 } });
await run({ mode: 'chat', chat: { message: 'Make day 2 cheaper', plan: '## Trip snapshot\nA plan with enough text here.' } });
await run({ mode: 'plan', trip: { destination: '' } });
