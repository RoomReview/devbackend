const baseUrl = process.env.SMOKE_API_URL ?? 'http://localhost:5000';
const token = process.env.SMOKE_ACCESS_TOKEN;
const reportId = process.env.SMOKE_REPORT_ID;
const samplesPerPath = Number(process.env.SMOKE_SAMPLES ?? 10);
const budgetMs = Number(process.env.SMOKE_API_P95_MS ?? 1500);

const checks = [
  { name: 'health', path: '/health', expected: [200] },
  { name: 'search', path: '/api/v1/boroughs?limit=1', expected: [200] },
  { name: 'orders', path: '/api/v1/payments/orders', expected: token ? [200] : [401] },
  { name: 'admin-overview', path: '/api/v1/admin/overview', expected: token ? [200, 401] : [401] },
];
if (reportId) checks.push({ name: 'checkout', path: `/api/v1/payments/reports/${encodeURIComponent(reportId)}/checkout`, expected: token ? [200, 400, 409, 500] : [401] });

const results = [];
for (const check of checks) {
  const timings = [];
  for (let sample = 0; sample < samplesPerPath; sample += 1) {
    const started = performance.now();
    const response = await fetch(new URL(check.path, baseUrl), {
      method: check.name === 'checkout' ? 'POST' : 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    timings.push(performance.now() - started);
    if (!check.expected.includes(response.status)) throw new Error(`${check.name} returned unexpected HTTP ${response.status}`);
  }
  timings.sort((a, b) => a - b);
  const p95 = timings[Math.min(timings.length - 1, Math.ceil(timings.length * 0.95) - 1)];
  results.push({ endpoint: check.name, samples: timings.length, p95Ms: Math.round(p95), budgetMs });
}

console.table(results);
if (results.some((result) => result.p95Ms > budgetMs)) process.exitCode = 1;
