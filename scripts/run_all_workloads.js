#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { scoreDatastores } = require('./datastore_model');

const ROOT = process.cwd();
const harness = 'node scripts/benchmark_harness.js';

const workloads = {
  read: {
    postgres: 'SELECT 1',
    mongo: 'db.accounts.find({})',
    redis: 'GET account:ACC001'
  },
  analytic: {
    postgres: 'SELECT SUM(n) FROM generate_series(1,10000) AS n',
    mongo: 'db.accounts.find({"balance":{"$gt":5000}})',
    redis: 'KEYS account:*'
  },
  scan: {
    postgres: "SELECT pg_catalog.count(*) FROM pg_catalog.pg_class WHERE relkind='r'",
    mongo: 'db.accounts.find({})',
    redis: 'KEYS *'
  }
};

const OUT_DIR = 'scripts';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function runHarnessFor(workloadName, store, query, outFile) {
  const encoded = encodeURIComponent(query);
  const url = `http://localhost:5000/test/${store}/query?q=${encoded}`;
  const cmd = `${harness} --postgres '${store==='postgres'?url:'http://localhost:5000/test/postgres/test'}' --mongo '${store==='mongo'?url:'http://localhost:5000/test/mongo/test'}' --redis '${store==='redis'?url:'http://localhost:5000/test/redis/test'}' -n 200 -c 20 -o '${outFile}'`;
  console.log('Running:', cmd);
  execSync(cmd, { stdio: 'inherit' });
}

async function main() {
  const aggregated = {};
  for (const [wkName, qset] of Object.entries(workloads)) {
    const outFile = path.join(OUT_DIR, `workload_${wkName}_metrics.json`);
    // We'll call harness once but point URLs to the specific query endpoints for each store.
    // Build command directly to pass the three query URLs.
    const pgUrl = `http://localhost:5000/test/postgres/query?q=${encodeURIComponent(qset.postgres)}`;
    const mgUrl = `http://localhost:5000/test/mongo/query?q=${encodeURIComponent(qset.mongo)}`;
    const rdUrl = `http://localhost:5000/test/redis/query?q=${encodeURIComponent(qset.redis)}`;
    const cmd = `${harness} --postgres '${pgUrl}' --mongo '${mgUrl}' --redis '${rdUrl}' -n 200 -c 20 -o '${outFile}'`;
    console.log('\n=== Running workload:', wkName, '===');
    execSync(cmd, { stdio: 'inherit' });

    const metrics = JSON.parse(fs.readFileSync(outFile));
    aggregated[wkName] = metrics;
    // score
    const scored = scoreDatastores(metrics, { cpu: 0.34, exec: 0.33, latency: 0.33 });
    aggregated[`${wkName}_score`] = scored.map(s => ({ store: s.store, score: s.score }));
  }

  // Aggregate scores across workloads: sum scores per store
  const stores = new Set();
  for (const k of Object.keys(aggregated)) if (!k.endsWith('_score')) Object.keys(aggregated[k] || {}).forEach(s=>stores.add(s));
  const totals = {};
  for (const s of stores) totals[s] = 0;
  for (const wkName of Object.keys(workloads)) {
    const scores = aggregated[`${wkName}_score`];
    scores.forEach(s => { totals[s.store] = (totals[s.store] || 0) + s.score; });
  }

  const summary = { aggregated, totals };
  fs.writeFileSync(path.join(OUT_DIR, 'aggregated_results.json'), JSON.stringify(summary, null, 2));
  console.log('\nWrote aggregated_results.json');

  // pick best
  const best = Object.entries(totals).sort((a,b)=>a[1]-b[1])[0];
  console.log('\nRecommended datastore across workloads:', best ? best[0] : 'unknown');
}

if (require.main === module) main();
