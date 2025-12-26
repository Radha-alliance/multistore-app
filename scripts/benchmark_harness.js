#!/usr/bin/env node
const fs = require('fs');
const { performance } = require('perf_hooks');

function usage() {
  console.log('Usage: node scripts/benchmark_harness.js --postgres <url> --mongo <url> --redis <url> [-n totalRequests] [-c concurrency] [-o out.json]');
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const out = { postgres: null, mongo: null, redis: null, n: 100, c: 10, out: 'scripts/collected_metrics.json' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--postgres') out.postgres = argv[++i];
    else if (a === '--mongo') out.mongo = argv[++i];
    else if (a === '--redis') out.redis = argv[++i];
    else if (a === '-n') out.n = parseInt(argv[++i], 10);
    else if (a === '-c') out.c = parseInt(argv[++i], 10);
    else if (a === '-o') out.out = argv[++i];
    else if (a === '--help') { usage(); process.exit(0); }
  }
  return out;
}

async function fetchJson(url, opts) {
  try {
    const res = await fetch(url, opts || { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function testRequests(name, url, totalRequests, concurrency, serverStatsBase) {
  if (!url) return null;
  const latencies = [];
  let inFlight = 0;
  let completed = 0;
  let idx = 0;
  // get server-side baseline via start endpoint if available
  let serverStart = null;
  let snapshotId = null;
  if (serverStatsBase) {
    const startUrl = `${serverStatsBase.replace(/\/$/, '')}/start`;
    const r = await fetchJson(startUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    if (r && r.success && r.id) {
      snapshotId = r.id;
      serverStart = r;
    } else {
      // fallback to GET server-stats
      serverStart = await fetchJson(serverStatsBase);
    }
  }

  const cpuStart = process.cpuUsage();
  const tStart = performance.now();

  return new Promise((resolve) => {
    function launch() {
      while (inFlight < concurrency && idx < totalRequests) {
        inFlight++;
        const cur = idx++;
        (async () => {
          const s = performance.now();
          try {
            await fetch(url, { method: 'GET' });
          } catch (e) {
            // treat failed request as high latency
          }
          const eTime = performance.now();
          latencies.push(eTime - s);
          inFlight--;
          completed++;
          if (completed >= totalRequests) (async () => {
            const cpuEnd = process.cpuUsage(cpuStart);
            const tEnd = performance.now();
            const cpuMs = (cpuEnd.user + cpuEnd.system) / 1000.0;
            const execMs = tEnd - tStart;
            latencies.sort((a,b)=>a-b);
            const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
            const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;

            // server-side end stats
            let serverEnd = null;
            if (serverStatsBase) {
              if (snapshotId) {
                const endUrl = `${serverStatsBase.replace(/\/$/, '')}/end`;
                serverEnd = await fetchJson(endUrl, { method: 'POST', body: JSON.stringify({ id: snapshotId }), headers: { 'Content-Type': 'application/json' } });
                if (serverEnd && serverEnd.success && typeof serverEnd.cpuDeltaMs === 'number') {
                  // serverEnd.cpuDeltaMs is the server-side CPU used during the measurement window
                } else {
                  // fallback to GET
                  serverEnd = await fetchJson(serverStatsBase);
                }
              } else {
                serverEnd = await fetchJson(serverStatsBase);
              }
            }

            // compute server CPU delta in milliseconds if available
            let serverCpuMs = null;
            if (serverEnd && serverEnd.cpuDeltaMs != null) {
              serverCpuMs = +serverEnd.cpuDeltaMs;
            } else if (serverStart && serverEnd) {
              if (typeof serverStart.cpuMs === 'number' && typeof serverEnd.cpuMs === 'number') {
                serverCpuMs = +(serverEnd.cpuMs - serverStart.cpuMs).toFixed(2);
              } else if (serverStart.cpu && serverEnd.cpu) {
                const userDelta = (serverEnd.cpu.user - serverStart.cpu.user) / 1000.0;
                const sysDelta = (serverEnd.cpu.system - serverStart.cpu.system) / 1000.0;
                serverCpuMs = +(userDelta + sysDelta).toFixed(2);
              }
            }

            resolve({ name, cpu: cpuMs, exec: execMs, latency: p95, p50, samples: latencies.length, serverCpuMs });
          })();
          else {
            launch();
          }
        })();
      }
    }
    launch();
  });
}

async function main() {
  const cfg = parseArgs();
  if (!cfg.postgres && !cfg.mongo && !cfg.redis) { usage(); process.exit(1); }

  console.log('Running benchmarks:', { totalRequests: cfg.n, concurrency: cfg.c });

  const results = {};
  // server stats endpoint used for server-side sampling
  const serverStatsBase = cfg.serverStats || null;

  if (cfg.postgres) {
    console.log('Benchmarking postgres at', cfg.postgres);
    const statsUrl = serverStatsBase ? `${serverStatsBase}?store=postgres` : null;
    const r = await testRequests('postgres', cfg.postgres, cfg.n, cfg.c, statsUrl);
    results.postgres = r ? { cpu: +r.cpu.toFixed(2), exec: +r.exec.toFixed(2), latency: +r.latency.toFixed(2), serverCpuMs: r.serverCpuMs } : null;
  }
  if (cfg.mongo) {
    console.log('Benchmarking mongo at', cfg.mongo);
    const statsUrl = serverStatsBase ? `${serverStatsBase}?store=mongo` : null;
    const r = await testRequests('mongo', cfg.mongo, cfg.n, cfg.c, statsUrl);
    results.mongo = r ? { cpu: +r.cpu.toFixed(2), exec: +r.exec.toFixed(2), latency: +r.latency.toFixed(2), serverCpuMs: r.serverCpuMs } : null;
  }
  if (cfg.redis) {
    console.log('Benchmarking redis at', cfg.redis);
    const statsUrl = serverStatsBase ? `${serverStatsBase}?store=redis` : null;
    const r = await testRequests('redis', cfg.redis, cfg.n, cfg.c, statsUrl);
    results.redis = r ? { cpu: +r.cpu.toFixed(2), exec: +r.exec.toFixed(2), latency: +r.latency.toFixed(2), serverCpuMs: r.serverCpuMs } : null;
  }

  fs.writeFileSync(cfg.out, JSON.stringify(results, null, 2));
  console.log('Wrote metrics to', cfg.out);
  console.log(results);
}

if (require.main === module) main().catch(e=>{ console.error(e); process.exit(2); });
