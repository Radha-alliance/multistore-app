#!/usr/bin/env node
const fs = require('fs');

function usage() {
  console.log('Usage: node scripts/datastore_model.js <metrics.json> [cpuWeight] [execWeight] [latencyWeight]');
  console.log('Example: node scripts/datastore_model.js scripts/example_metrics.json 0.4 0.3 0.3');
}

function loadMetrics(path) {
  try {
    const raw = fs.readFileSync(path, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read/parse metrics file:', e.message);
    process.exit(2);
  }
}

function normalize(values) {
  const max = Math.max(...values.map(v => (v == null ? 0 : v)));
  if (max === 0) return values.map(_ => 0);
  return values.map(v => (v == null ? 0 : v / max));
}

function scoreDatastores(metrics, weights) {
  const stores = Object.keys(metrics);
  const cpuArr = stores.map(s => metrics[s].cpu || 0);
  const execArr = stores.map(s => metrics[s].exec || 0);
  const latArr = stores.map(s => metrics[s].latency || 0);

  const nCpu = normalize(cpuArr);
  const nExec = normalize(execArr);
  const nLat = normalize(latArr);

  const scored = stores.map((s, i) => {
    const score = weights.cpu * nCpu[i] + weights.exec * nExec[i] + weights.latency * nLat[i];
    return { store: s, score, raw: metrics[s], normalized: { cpu: nCpu[i], exec: nExec[i], latency: nLat[i] } };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    usage();
    process.exit(1);
  }

  const path = args[0];
  const cpuW = parseFloat(args[1] || '0.34');
  const execW = parseFloat(args[2] || '0.33');
  const latW = parseFloat(args[3] || '0.33');

  const totalW = cpuW + execW + latW;
  if (Math.abs(totalW - 1) > 1e-6) {
    console.warn('Weights do not sum to 1. They will be normalized.');
  }

  const weights = { cpu: cpuW / totalW, exec: execW / totalW, latency: latW / totalW };

  const metrics = loadMetrics(path);
  const result = scoreDatastores(metrics, weights);

  console.log('\nDatastore scoring (lower is better):');
  result.forEach(r => {
    console.log(`- ${r.store}: score=${r.score.toFixed(4)}, raw=${JSON.stringify(r.raw)}`);
  });

  console.log(`\nRecommended datastore: ${result[0].store}`);
  process.exit(0);
}

module.exports = { scoreDatastores };
