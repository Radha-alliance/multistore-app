#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { scoreDatastores } = require('./datastore_model');

const AGG = path.join(__dirname, 'aggregated_results.json');
if (!fs.existsSync(AGG)) {
  console.error('aggregated_results.json not found in scripts/. Run workloads first.');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(AGG));
const aggregated = data.aggregated || {};

// extract workload metric objects (keys without trailing _score)
const workloads = Object.keys(aggregated).filter(k => !k.endsWith('_score'));

const scenarios = [
  { name: 'latency-first', weights: { cpu: 0.1, exec: 0.3, latency: 0.6 } },
  { name: 'exec-first', weights: { cpu: 0.1, exec: 0.6, latency: 0.3 } },
  { name: 'cpu-first', weights: { cpu: 0.6, exec: 0.2, latency: 0.2 } }
];

const results = {};

for (const s of scenarios) {
  const totals = {};
  // init stores set from first workload
  for (const wk of workloads) {
    const metrics = aggregated[wk];
    if (!metrics) continue;
    const scored = scoreDatastores(metrics, s.weights);
    // scored is array sorted ascending (best first)
    // accumulate raw score values per store
    scored.forEach(item => {
      totals[item.store] = (totals[item.store] || 0) + item.score;
    });
  }
  // sort totals (lower better)
  const ranking = Object.entries(totals).sort((a,b)=>a[1]-b[1]).map(([store, val])=>({store, total: +val.toFixed(6)}));
  results[s.name] = { weights: s.weights, totals, ranking };
}

const OUT = path.join(__dirname, 'rescore_results.json');
fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
console.log('Wrote', OUT);
console.log(JSON.stringify(results, null, 2));

process.exit(0);
