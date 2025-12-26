const express = require('express');
const router = express.Router();

const pg = require('../adapters/postgresAdapter');
const mongo = require('../adapters/mongoAdapter');
const redis = require('../adapters/redisAdapter');

router.get('/postgres/test', async (req, res) => {
  try {
    const result = await pg.executeQuery('SELECT 1');
    res.json({ success: true, source: 'postgres', result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// passthrough query endpoint: /test/postgres/query?q=<query>
router.get('/postgres/query', async (req, res) => {
  try {
    const q = req.query.q || 'SELECT 1';
    const result = await pg.executeQuery(q);
    res.json({ success: true, source: 'postgres', query: q, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/mongo/test', async (req, res) => {
  try {
    const result = await mongo.executeQuery('db.accounts.find({})');
    res.json({ success: true, source: 'mongo', result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/mongo/query', async (req, res) => {
  try {
    const q = req.query.q || 'db.accounts.find({})';
    const result = await mongo.executeQuery(q);
    res.json({ success: true, source: 'mongo', query: q, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/redis/test', async (req, res) => {
  try {
    const result = await redis.executeQuery('GET account:ACC001');
    res.json({ success: true, source: 'redis', result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/redis/query', async (req, res) => {
  try {
    const q = req.query.q || 'GET account:ACC001';
    const result = await redis.executeQuery(q);
    res.json({ success: true, source: 'redis', query: q, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Server-side stats for CPU/memory sampling
router.get('/server-stats', (req, res) => {
  try {
    const cpu = process.cpuUsage();
    const memory = process.memoryUsage();
    const cpuMs = (cpu.user + cpu.system) / 1000.0;
    res.json({ success: true, pid: process.pid, cpu, cpuMs, memory, uptime: process.uptime() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Improved server-side sampling: start/end snapshot flow
const serverSnapshots = new Map();
let snapshotCounter = 1;

router.post('/server-stats/start', (req, res) => {
  try {
    const cpu = process.cpuUsage();
    const memory = process.memoryUsage();
    const cpuMs = (cpu.user + cpu.system) / 1000.0;
    const id = `snap-${Date.now()}-${snapshotCounter++}`;
    serverSnapshots.set(id, { cpuMs, memory, ts: Date.now() });
    res.json({ success: true, id, cpuMs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/server-stats/end', (req, res) => {
  try {
    const id = req.body && req.body.id;
    if (!id || !serverSnapshots.has(id)) {
      return res.status(400).json({ success: false, error: 'missing/invalid id' });
    }
    const start = serverSnapshots.get(id);
    serverSnapshots.delete(id);
    const cpu = process.cpuUsage();
    const memory = process.memoryUsage();
    const cpuMs = (cpu.user + cpu.system) / 1000.0;
    const deltaMs = +(cpuMs - start.cpuMs).toFixed(2);
    res.json({ success: true, id, cpuMsEnd: cpuMs, cpuMsStart: start.cpuMs, cpuDeltaMs: deltaMs, memoryEnd: memory, memoryStart: start.memory, durationMs: Date.now() - start.ts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
