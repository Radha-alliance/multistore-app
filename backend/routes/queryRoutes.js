const express = require('express');
const router = express.Router();
const queryMediator = require('../services/queryMediator');
const queryHistory = require('../services/queryHistory');
const queryConverter = require('../services/queryConverter');

// Get recommendations for a query
router.post('/recommend', (req, res) => {
  const { queryText } = req.body;

  if (!queryText || !queryText.trim()) {
    return res.status(400).json({ error: 'Query text is required' });
  }

  try {
    const recommendations = queryHistory.getRecommendations(queryText);
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Execute query (auto selection)
router.post('/execute', async (req, res) => {
  const { queryText } = req.body;
  const targetDatabase = req.query.database;

  if (!queryText || !queryText.trim()) {
    return res.status(400).json({ error: 'Query text is required' });
  }

  try {
    // Let queryMediator handle auto-selection (detectQueryType + data location + best choice)
    // Only pass explicit database selection if specified
    const result = await queryMediator.executeQuery(queryText, targetDatabase);

    // Record the execution
    queryHistory.addRecord(
      queryText,
      result.database,
      result.metrics,
      { success: !result.error, error: result.error, rowCount: result.data?.length || 0 }
    );

    res.json({
      singleExecution: true,
      database: result.database,
      metrics: result.metrics,
      data: result.data,
      error: result.error
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Execute on all databases for comparison
router.post('/execute-all', async (req, res) => {
  const { queryText } = req.body;

  if (!queryText || !queryText.trim()) {
    return res.status(400).json({ error: 'Query text is required' });
  }

  try {
    const results = {};
    const databases = ['mongo', 'postgres', 'redis'];
    const queryType = queryMediator.detectQueryType(queryText);

    for (const database of databases) {
      try {
        let finalQuery = queryText;
        
        // Auto-convert SQL to MongoDB if executing SQL on MongoDB
        if (queryType === 'postgres' && database === 'mongo') {
          finalQuery = queryConverter.sqlToMongoDB(queryText);
          console.log(`Auto-converted SQL to MongoDB: ${finalQuery}`);
        }

        const result = await queryMediator.executeQuery(finalQuery, database);

        results[database] = {
          success: !result.error,
          error: result.error,
          metrics: result.metrics,
          data: result.data,
          convertedQuery: finalQuery !== queryText ? finalQuery : undefined
        };

        // Record the execution
        queryHistory.addRecord(
          queryText,
          database,
          result.metrics,
          { success: !result.error, error: result.error, rowCount: result.data?.length || 0 }
        );
      } catch (dbError) {
        results[database] = {
          success: false,
          error: dbError.message,
          metrics: {
            executionTime: 0,
            cpuTime: 0,
            latency: 0,
            memoryUsed: 0
          }
        };
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get query history
router.get('/history', (req, res) => {
  try {
    const { queryText, database, timeRange } = req.query;
    const filters = {};

    if (queryText) filters.queryText = queryText;
    if (database) filters.database = database;
    if (timeRange) filters.timeRange = parseInt(timeRange);

    const history = queryHistory.getHistory(filters);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get best database recommendation based on real-time comparison
router.post('/recommend-best-db', async (req, res) => {
  const { queryText } = req.body;

  if (!queryText || !queryText.trim()) {
    return res.status(400).json({ error: 'Query text is required' });
  }

  try {
    const databases = ['mongo', 'postgres', 'redis'];
    const results = {};
    const scores = {};
    const reasons = [];

    // Execute on all databases to get real performance metrics
    for (const database of databases) {
      try {
        let finalQuery = queryText;
        const queryType = queryMediator.detectQueryType(queryText);
        
        // Auto-convert SQL to MongoDB if needed
        if (queryType === 'postgres' && database === 'mongo') {
          finalQuery = queryConverter.sqlToMongoDB(queryText);
        }

        const result = await queryMediator.executeQuery(finalQuery, database);

        results[database] = {
          success: !result.error,
          error: result.error,
          metrics: result.metrics,
          rowCount: result.data?.length || 0
        };

        // Calculate performance score
        if (!result.error) {
          const metrics = result.metrics;
          // Weighted scoring: execution (40%), latency (30%), CPU (20%), consistency (10%)
          const executionScore = 1 / (metrics.executionTime + 1);
          const latencyScore = 1 / (metrics.latency + 1);
          const cpuScore = 1 / (metrics.cpuTime + 1);
          
          scores[database] = 
            executionScore * 0.4 +
            latencyScore * 0.3 +
            cpuScore * 0.2 +
            0.1; // Base consistency score

          reasons.push({
            database,
            score: parseFloat((scores[database] * 100).toFixed(2)),
            executionTime: metrics.executionTime,
            latency: metrics.latency,
            cpuTime: metrics.cpuTime
          });
        } else {
          scores[database] = -1; // Failed database gets lowest score
          reasons.push({
            database,
            score: -1,
            error: result.error
          });
        }

        // Record the execution
        queryHistory.addRecord(
          queryText,
          database,
          result.metrics,
          { success: !result.error, error: result.error, rowCount: result.data?.length || 0 }
        );
      } catch (dbError) {
        results[database] = {
          success: false,
          error: dbError.message,
          metrics: { executionTime: 0, cpuTime: 0, latency: 0, memoryUsed: 0 }
        };
        scores[database] = -1;
        reasons.push({
          database,
          score: -1,
          error: dbError.message
        });
      }
    }

    // Find best database
    const bestDb = Object.keys(scores).reduce((best, current) =>
      scores[current] > scores[best] ? current : best
    );

    // Get metrics comparison
    const sortedReasons = reasons.sort((a, b) => b.score - a.score);
    const bestMetrics = results[bestDb].metrics;
    
    res.json({
      bestDatabase: bestDb,
      confidence: parseFloat(((scores[bestDb] / Math.max(...Object.values(scores).filter(s => s > 0))) * 100).toFixed(2)),
      recommendation: `${bestDb.toUpperCase()} is recommended - Execution time: ${bestMetrics.executionTime.toFixed(2)}ms, Latency: ${bestMetrics.latency.toFixed(2)}ms, CPU: ${bestMetrics.cpuTime.toFixed(2)}ms`,
      scores: scores,
      comparison: sortedReasons,
      results: results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get statistics
router.get('/stats', (req, res) => {
  try {
    const { database } = req.query;
    const stats = queryHistory.getStats(database);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get detailed performance analysis for a query pattern
router.get('/analysis/:queryHash', (req, res) => {
  try {
    const { queryHash } = req.params;
    const pattern = queryHistory.models.queryPatterns[queryHash];

    if (!pattern) {
      return res.status(404).json({ error: 'Query pattern not found' });
    }

    res.json(pattern);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear history (optional admin endpoint)
router.delete('/history', (req, res) => {
  try {
    queryHistory.history = [];
    queryHistory.saveHistory();
    res.json({ message: 'History cleared' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
