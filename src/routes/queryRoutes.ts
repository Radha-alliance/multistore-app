import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { QueryMediator } from '../mediator/QueryMediator';

const router = Router();

/**
 * POST /api/query
 * Execute query on all databases and learn from results
 * First time queries will be executed here to learn performance characteristics
 */
router.post('/query', async (req: Request, res: Response) => {
  try {
    const { query, queryType = 'parallel' } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const mediator: QueryMediator = req.app.locals.mediator;
    const queryHash = crypto.createHash('sha256')
      .update(JSON.stringify(query))
      .digest('hex')
      .substring(0, 16);

    const { results, metrics, bestDatabase } = await mediator.executeQueryParallel(query);

    // Convert metrics map to object
    const metricsObj: any = {};
    metrics.forEach((metric, db) => {
      metricsObj[db] = metric;
    });

    // Convert results map to object
    const resultsObj: any = {};
    results.forEach((result, db) => {
      resultsObj[db] = result;
    });

    res.json({
      queryHash,
      mode: 'learning',
      results: resultsObj,
      metrics: metricsObj,
      bestDatabase,
      message: 'Query executed on all databases for learning',
    });
  } catch (error) {
    console.error('Error in /api/query:', error);
    res.status(500).json({
      error: (error as Error).message,
      ...(process.env.NODE_ENV !== 'production' ? { stack: (error as Error).stack } : {}),
    });
  }
});

/**
 * POST /api/query-optimized
 * Execute query on the AI-predicted best database
 * Uses learned metrics from previous executions
 */
router.post('/query-optimized', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const mediator: QueryMediator = req.app.locals.mediator;
    const queryHash = crypto.createHash('sha256')
      .update(JSON.stringify(query))
      .digest('hex')
      .substring(0, 16);

    const { result, metrics, database } = await mediator.executeQueryOptimized(query);
    const prediction = mediator.getPrediction(queryHash);

    res.json({
      queryHash,
      mode: 'optimized',
      database,
      result,
      metrics,
      prediction: prediction ? {
        recommendedDatabase: prediction.recommendedDatabase,
        confidence: prediction.confidence,
        expectedExecutionTime: prediction.expectedExecutionTime,
      } : null,
    });
  } catch (error) {
    console.error('Error in /api/query-optimized:', error);
    res.status(500).json({
      error: (error as Error).message,
      ...(process.env.NODE_ENV !== 'production' ? { stack: (error as Error).stack } : {}),
    });
  }
});

/**
 * GET /api/metrics/:queryHash
 * Get detailed metrics and analytics for a specific query
 */
router.get('/metrics/:queryHash', (req: Request, res: Response) => {
  try {
    const { queryHash } = req.params;
    const mediator: QueryMediator = req.app.locals.mediator;

    const analytics = mediator.getQueryAnalytics(queryHash);

    // Convert aggregated map to object
    const aggregatedObj: any = {};
    analytics.aggregated.forEach((agg, db) => {
      aggregatedObj[db] = agg;
    });

    const allPredictions: any = {};
    if (analytics.prediction) {
      analytics.prediction.allPredictions.forEach((score, db) => {
        allPredictions[db] = score;
      });
    }

    res.json({
      queryHash,
      metricsCount: analytics.metrics.length,
      aggregated: aggregatedObj,
      prediction: analytics.prediction ? {
        recommendedDatabase: analytics.prediction.recommendedDatabase,
        confidence: analytics.prediction.confidence,
        expectedExecutionTime: analytics.prediction.expectedExecutionTime,
        allScores: allPredictions,
      } : null,
      recentMetrics: analytics.metrics.slice(-5),
    });
  } catch (error) {
    console.error('Error in /api/metrics/:queryHash:', error);
    res.status(500).json({
      error: (error as Error).message,
      ...(process.env.NODE_ENV !== 'production' ? { stack: (error as Error).stack } : {}),
    });
  }
});

/**
 * GET /api/analytics
 * Get overall analytics across all queries
 */
router.get('/analytics', (req: Request, res: Response) => {
  try {
    const mediator: QueryMediator = req.app.locals.mediator;
    const allMetrics = mediator.getAllMetrics();

    // Group by database
    const dbMetrics: any = {};
    allMetrics.forEach(metric => {
      if (!dbMetrics[metric.database]) {
        dbMetrics[metric.database] = [];
      }
      dbMetrics[metric.database].push(metric);
    });

    // Calculate statistics
    const stats: any = {};
    Object.keys(dbMetrics).forEach(db => {
      const metrics = dbMetrics[db];
      const successMetrics = metrics.filter((m: any) => m.success);
      
      stats[db] = {
        totalExecutions: metrics.length,
        successCount: successMetrics.length,
        successRate: (successMetrics.length / metrics.length * 100).toFixed(2) + '%',
        avgExecutionTime: (successMetrics.reduce((sum: number, m: any) => sum + m.executionTime, 0) / successMetrics.length).toFixed(2) + 'ms',
        avgCpuTime: (successMetrics.reduce((sum: number, m: any) => sum + m.cpuTime, 0) / successMetrics.length).toFixed(2) + 'ms',
        avgLatency: (successMetrics.reduce((sum: number, m: any) => sum + m.latency, 0) / successMetrics.length).toFixed(2) + 'ms',
      };
    });

    res.json({
      totalQueries: allMetrics.length,
      databaseStats: stats,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error in /api/analytics:', error);
    res.status(500).json({
      error: (error as Error).message,
      ...(process.env.NODE_ENV !== 'production' ? { stack: (error as Error).stack } : {}),
    });
  }
});

export default router;
