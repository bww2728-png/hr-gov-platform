/**
 * Lightweight load test — no external dependencies (Node 20+ built-in fetch).
 * Usage:
 *   node scripts/load-test.js <baseUrl> <path> [requests] [concurrency] [cookieFile]
 * Example (read-only endpoint with an exported session cookie):
 *   node scripts/load-test.js https://host /api/health 100 5
 *   node scripts/load-test.js https://host /api/hr/employees?limit=50 200 5 session.txt
 * The cookie file must contain a "cookie" header value (name=value; ...).
 * Reports p50/p95/p99 latency and error rate. Keep volumes low against production.
 */
const fs = require('fs');

const [, , rawUrl, rawPath, rawCount, rawConc, cookieFile] = process.argv;
if (!rawUrl || !rawPath) {
  console.error('usage: node scripts/load-test.js <baseUrl> <path> [requests] [concurrency] [cookieFile]');
  process.exit(1);
}
const base = rawUrl.replace(/\/+$/, '');
const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
const total = Math.max(1, parseInt(rawCount || '100', 10));
const concurrency = Math.max(1, parseInt(rawConc || '5', 10));
const cookie = cookieFile && fs.existsSync(cookieFile) ? fs.readFileSync(cookieFile, 'utf8').trim() : null;

const latencies = [];
let errors = 0;
let statuses = {};

async function worker(id) {
  for (let i = id; i < total; i += concurrency) {
    const started = Date.now();
    try {
      const res = await fetch(`${base}${path}`, {
        headers: cookie ? { cookie } : {},
        redirect: 'manual',
      });
      statuses[res.status] = (statuses[res.status] || 0) + 1;
      await res.arrayBuffer();
      if (res.status >= 400) errors += 1;
    } catch {
      errors += 1;
      statuses.network_error = (statuses.network_error || 0) + 1;
    }
    latencies.push(Date.now() - started);
  }
}

function pct(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

(async () => {
  const started = Date.now();
  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));
  const wallMs = Date.now() - started;
  const report = {
    target: `${base}${path}`,
    requests: total,
    concurrency,
    durationMs: wallMs,
    rps: Number((total / (wallMs / 1000)).toFixed(2)),
    p50_ms: pct(latencies, 50),
    p95_ms: pct(latencies, 95),
    p99_ms: pct(latencies, 99),
    errors,
    statuses,
  };
  console.log(JSON.stringify(report, null, 2));
})();
