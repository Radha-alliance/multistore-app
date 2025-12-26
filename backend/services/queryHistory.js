const fs = require('fs');
const path = require('path');

class QueryHistoryService {
  constructor() {
    this.historyFile = path.join(__dirname, '../../data/query_history.json');
    this.modelsFile = path.join(__dirname, '../../data/ml_models.json');
    this.ensureDataDirectory();
    this.loadData();
  }

  ensureDataDirectory() {
    const dataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  loadData() {
    try {
      this.history = fs.existsSync(this.historyFile)
        ? JSON.parse(fs.readFileSync(this.historyFile, 'utf-8'))
        : [];
      this.models = fs.existsSync(this.modelsFile)
        ? JSON.parse(fs.readFileSync(this.modelsFile, 'utf-8'))
        : { queryPatterns: {}, performanceCache: {} };
    } catch (error) {
      console.error('Error loading data files:', error);
      this.history = [];
      this.models = { queryPatterns: {}, performanceCache: {} };
    }
  }

  saveHistory() {
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(this.history, null, 2));
    } catch (error) {
      console.error('Error saving history:', error);
    }
  }

  saveModels() {
    try {
      fs.writeFileSync(this.modelsFile, JSON.stringify(this.models, null, 2));
    } catch (error) {
      console.error('Error saving models:', error);
    }
  }

  // Add a query execution record
  addRecord(queryText, database, metrics, result) {
    const record = {
      id: `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      queryText,
      database,
      metrics: {
        executionTime: metrics.executionTime || 0,
        cpuTime: metrics.cpuTime || 0,
        latency: metrics.latency || 0,
        memoryUsed: metrics.memoryUsed || 0,
        rowsAffected: metrics.rowsAffected || 0
      },
      result: {
        rowCount: result?.rowCount || 0,
        success: result?.success || false,
        error: result?.error || null
      }
    };

    this.history.push(record);
    this.updateMLModels(queryText, database, record.metrics);
    this.saveHistory();
    return record;
  }

  // Get query history
  getHistory(filters = {}) {
    let results = this.history;

    if (filters.queryText) {
      const searchTerm = filters.queryText.toLowerCase();
      results = results.filter(r => r.queryText.toLowerCase().includes(searchTerm));
    }

    if (filters.database) {
      results = results.filter(r => r.database === filters.database);
    }

    if (filters.timeRange) {
      const now = new Date();
      const duration = filters.timeRange;
      const pastTime = new Date(now - duration);
      results = results.filter(r => new Date(r.timestamp) > pastTime);
    }

    return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  // Update ML models with query performance data
  updateMLModels(queryText, database, metrics) {
    const queryHash = this.hashQuery(queryText);

    if (!this.models.queryPatterns[queryHash]) {
      this.models.queryPatterns[queryHash] = {
        queryText,
        executions: {},
        averageMetrics: {}
      };
    }

    const pattern = this.models.queryPatterns[queryHash];

    if (!pattern.executions[database]) {
      pattern.executions[database] = [];
    }

    pattern.executions[database].push({
      timestamp: new Date().toISOString(),
      metrics
    });

    // Keep only last 100 executions per database
    if (pattern.executions[database].length > 100) {
      pattern.executions[database].shift();
    }

    this.calculateAverageMetrics(queryHash);
    this.saveModels();
  }

  // Calculate average metrics for a query
  calculateAverageMetrics(queryHash) {
    const pattern = this.models.queryPatterns[queryHash];
    pattern.averageMetrics = {};

    Object.keys(pattern.executions).forEach(database => {
      const executions = pattern.executions[database];
      if (executions.length === 0) return;

      const metrics = {};
      ['executionTime', 'cpuTime', 'latency', 'memoryUsed'].forEach(key => {
        const values = executions.map(e => e.metrics[key] || 0);
        metrics[key] = {
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          variance: this.calculateVariance(values)
        };
      });

      pattern.averageMetrics[database] = metrics;
    });
  }

  // Helper function to calculate variance
  calculateVariance(values) {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance); // Standard deviation
  }

  // Get recommendations for a query based on historical data
  getRecommendations(queryText) {
    const queryHash = this.hashQuery(queryText);
    const pattern = this.models.queryPatterns[queryHash];

    if (!pattern || !Object.keys(pattern.executions).length) {
      return {
        recommendation: null,
        reason: 'Not enough historical data. Running first execution...',
        confidence: 0
      };
    }

    const recommendations = {};
    Object.keys(pattern.averageMetrics).forEach(database => {
      const metrics = pattern.averageMetrics[database];
      const score = this.calculateDatabaseScore(metrics);
      recommendations[database] = score;
    });

    const bestDb = Object.keys(recommendations).reduce((best, current) =>
      recommendations[current] > recommendations[best] ? current : best
    );

    return {
      recommendation: bestDb,
      scores: recommendations,
      reason: `Based on ${pattern.executions[bestDb]?.length || 0} historical executions`,
      confidence: Math.min(
        (pattern.executions[bestDb]?.length || 0) / 50 * 100,
        100
      )
    };
  }

  // Calculate database score based on metrics
  calculateDatabaseScore(metrics) {
    if (!metrics.executionTime) return 0;

    // Weighted scoring: lower execution time is better (negative, so we negate it)
    const executionScore = 1 / (metrics.executionTime.avg + 1);
    const latencyScore = 1 / (metrics.latency.avg + 1);
    const cpuScore = 1 / (metrics.cpuTime.avg + 1);

    // Stability score: lower variance is better
    const stabilityScore = 1 / ((metrics.executionTime.variance || 1) + 1);

    return (
      executionScore * 0.4 +
      latencyScore * 0.3 +
      cpuScore * 0.2 +
      stabilityScore * 0.1
    );
  }

  // Hash query for pattern matching
  hashQuery(queryText) {
    const normalized = queryText
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);

    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `q_${Math.abs(hash)}`;
  }

  // Get performance statistics
  getStats(database = null) {
    const records = database
      ? this.history.filter(r => r.database === database)
      : this.history;

    if (records.length === 0) {
      return { totalQueries: 0, databases: {} };
    }

    const stats = {
      totalQueries: records.length,
      databases: {}
    };

    ['mongo', 'postgres', 'redis'].forEach(db => {
      const dbRecords = records.filter(r => r.database === db);
      if (dbRecords.length > 0) {
        const times = dbRecords.map(r => r.metrics.executionTime);
        stats.databases[db] = {
          count: dbRecords.length,
          avgExecutionTime: times.reduce((a, b) => a + b, 0) / times.length,
          minExecutionTime: Math.min(...times),
          maxExecutionTime: Math.max(...times),
          successRate: (dbRecords.filter(r => r.result.success).length / dbRecords.length * 100).toFixed(2)
        };
      }
    });

    return stats;
  }

  // Clear old history (keep last N records)
  cleanupHistory(maxRecords = 1000) {
    if (this.history.length > maxRecords) {
      this.history = this.history.slice(-maxRecords);
      this.saveHistory();
    }
  }
}

module.exports = new QueryHistoryService();
