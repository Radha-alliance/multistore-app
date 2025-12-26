import crypto from 'crypto';
import { MongoDBAdapter } from '../databases/DatabaseAdapter';
import { PostgresAdapter } from '../databases/PostgresAdapter';
import { RedisAdapter } from '../databases/RedisAdapter';
import { MetricsCollector, QueryMetrics, AggregatedMetrics } from '../metrics/MetricsCollector';

interface DatabaseAdapter {
  name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  executeQuery(query: any, params?: any): Promise<any>;
}

interface QueryPrediction {
  recommendedDatabase: string;
  confidence: number;
  expectedExecutionTime: number;
  allPredictions: Map<string, number>;
}

export class QueryMediator {
  private adapters: Map<string, DatabaseAdapter>;
  private metricsCollector: MetricsCollector;
  private queryHashMap: Map<string, any> = new Map();
  private predictions: Map<string, QueryPrediction> = new Map();

  constructor() {
    this.adapters = new Map([
      ['MongoDB', new MongoDBAdapter()],
      ['PostgreSQL', new PostgresAdapter()],
      ['Redis', new RedisAdapter()],
    ]);
    this.metricsCollector = new MetricsCollector();
  }

  /**
   * Hash a query for identification
   */
  private hashQuery(query: any): string {
    return crypto.createHash('sha256')
      .update(JSON.stringify(query))
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Execute query on a single database and collect metrics
   */
  private async executeOnDatabase(
    adapter: DatabaseAdapter,
    query: any,
    queryHash: string
  ): Promise<{ result: any; metrics: QueryMetrics }> {
    const startTime = process.hrtime.bigint();
    const startCpuUsage = process.cpuUsage();
    let result: any;
    let success = false;

    try {
      await adapter.connect();
      result = await adapter.executeQuery(query);
      success = true;
    } catch (error) {
      result = { error: (error as Error).message };
    }

    const endTime = process.hrtime.bigint();
    const endCpuUsage = process.cpuUsage(startCpuUsage);

    const executionTime = Number(endTime - startTime) / 1_000_000; // Convert to ms
    const cpuTime = (endCpuUsage.user + endCpuUsage.system) / 1000; // Convert to ms
    const resultSize = JSON.stringify(result).length;

    const metric: QueryMetrics = {
      database: adapter.name,
      queryHash,
      executionTime,
      latency: executionTime, // Simplified: treating execution time as latency
      cpuTime,
      memoryUsed: 0, // Can be enhanced with process.memoryUsage()
      timestamp: new Date(),
      success,
      resultSize,
    };

    this.metricsCollector.recordMetric(metric);
    return { result, metrics: metric };
  }

  /**
   * Execute query on all databases and learn from results
   */
  async executeQueryParallel(query: any): Promise<{
    results: Map<string, any>;
    metrics: Map<string, QueryMetrics>;
    bestDatabase: string;
  }> {
    const queryHash = this.hashQuery(query);
    this.queryHashMap.set(queryHash, query);

    const results = new Map<string, any>();
    const metrics = new Map<string, QueryMetrics>();

    // Execute on all databases in parallel
    const executionPromises = Array.from(this.adapters.values()).map(adapter =>
      this.executeOnDatabase(adapter, query, queryHash)
    );

    const executionResults = await Promise.allSettled(executionPromises);

    executionResults.forEach((result, index) => {
      const adapter = Array.from(this.adapters.values())[index];
      if (result.status === 'fulfilled') {
        results.set(adapter.name, result.value.result);
        metrics.set(adapter.name, result.value.metrics);
      } else {
        results.set(adapter.name, { error: (result.reason as Error).message });
      }
    });

    // Update predictions based on metrics
    this.updatePredictions(queryHash, metrics);

    // Determine best database
    const bestDatabase = this.getBestDatabase(queryHash);

    return { results, metrics, bestDatabase };
  }

  /**
   * Execute query using AI-predicted best database
   */
  async executeQueryOptimized(query: any): Promise<{
    result: any;
    metrics: QueryMetrics;
    database: string;
  }> {
    const queryHash = this.hashQuery(query);
    this.queryHashMap.set(queryHash, query);

    // If we have predictions for this query, use the recommended database
    const prediction = this.predictions.get(queryHash);
    let selectedDatabase = 'PostgreSQL'; // Default

    if (prediction && prediction.confidence > 0.6) {
      selectedDatabase = prediction.recommendedDatabase;
    } else {
      // For new queries, use parallel execution to learn
      const { bestDatabase } = await this.executeQueryParallel(query);
      selectedDatabase = bestDatabase;
    }

    const adapter = this.adapters.get(selectedDatabase);
    if (!adapter) throw new Error(`Database adapter not found: ${selectedDatabase}`);

    const { result, metrics } = await this.executeOnDatabase(adapter, query, queryHash);

    return { result, metrics, database: selectedDatabase };
  }

  /**
   * Update predictions using AI/ML approach
   */
  private updatePredictions(queryHash: string, metrics: Map<string, QueryMetrics>): void {
    const aggregated = this.metricsCollector.getAggregatedMetrics(queryHash);
    
    if (aggregated.size === 0) return;

    // AI Approach: Multi-factor scoring
    const scores = new Map<string, number>();
    let bestScore = Infinity;
    let bestDatabase = 'PostgreSQL';

    aggregated.forEach((agg, database) => {
      // Weighted scoring: 40% execution time, 30% latency, 20% success rate, 10% resource efficiency
      const executionScore = agg.avgExecutionTime * 0.4;
      const latencyScore = agg.avgLatency * 0.3;
      const successScore = (1 - agg.successRate) * 100 * 0.2; // Penalize failures
      const resourceScore = agg.avgCpuTime * 0.1;

      const totalScore = executionScore + latencyScore + successScore + resourceScore;
      scores.set(database, totalScore);

      if (totalScore < bestScore) {
        bestScore = totalScore;
        bestDatabase = database;
      }
    });

    // Calculate confidence based on score variance
    const scoreValues = Array.from(scores.values());
    const avgScore = scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length;
    const variance = scoreValues.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scoreValues.length;
    const stdDev = Math.sqrt(variance);
    const confidence = stdDev > 0 ? Math.max(0.5, Math.min(1, 1 - (stdDev / avgScore))) : 1;

    const bestMetrics = aggregated.get(bestDatabase);
    const expectedExecutionTime = bestMetrics?.avgExecutionTime || 0;

    this.predictions.set(queryHash, {
      recommendedDatabase: bestDatabase,
      confidence,
      expectedExecutionTime,
      allPredictions: scores,
    });
  }

  /**
   * Get the best database for a query based on learned metrics
   */
  private getBestDatabase(queryHash: string): string {
    const aggregated = this.metricsCollector.getAggregatedMetrics(queryHash);
    
    if (aggregated.size === 0) return 'PostgreSQL'; // Default

    let bestDb = 'PostgreSQL';
    let bestScore = Infinity;

    aggregated.forEach((agg, database) => {
      const score = agg.avgExecutionTime * 0.4 + agg.avgLatency * 0.3 + (1 - agg.successRate) * 100 * 0.2;
      if (score < bestScore) {
        bestScore = score;
        bestDb = database;
      }
    });

    return bestDb;
  }

  /**
   * Get metrics and predictions for a query
   */
  getQueryAnalytics(queryHash: string): {
    metrics: QueryMetrics[];
    aggregated: Map<string, AggregatedMetrics>;
    prediction: QueryPrediction | undefined;
  } {
    return {
      metrics: this.metricsCollector.getMetricsForQuery(queryHash),
      aggregated: this.metricsCollector.getAggregatedMetrics(queryHash),
      prediction: this.predictions.get(queryHash),
    };
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): QueryMetrics[] {
    return this.metricsCollector.getAllMetrics();
  }

  /**
   * Get prediction for a query
   */
  getPrediction(queryHash: string): QueryPrediction | undefined {
    return this.predictions.get(queryHash);
  }
}
