import fs from 'fs';
import path from 'path';
import { QueryMetrics, AggregatedMetrics } from '../metrics/MetricsCollector';

export interface StoredQuery {
  queryHash: string;
  queryData: any;
  createdAt: Date;
  executionCount: number;
}

export interface StoredPrediction {
  queryHash: string;
  recommendedDatabase: string;
  confidence: number;
  expectedExecutionTime: number;
  timestamp: Date;
}

export class QueryHistoryStore {
  private storePath: string;
  private queriesFile: string;
  private metricsFile: string;
  private predictionsFile: string;

  constructor(storePath: string = './data') {
    this.storePath = storePath;
    this.queriesFile = path.join(storePath, 'queries.json');
    this.metricsFile = path.join(storePath, 'metrics.json');
    this.predictionsFile = path.join(storePath, 'predictions.json');

    this.initializeStore();
  }

  private initializeStore(): void {
    if (!fs.existsSync(this.storePath)) {
      fs.mkdirSync(this.storePath, { recursive: true });
    }

    // Initialize files if they don't exist
    [this.queriesFile, this.metricsFile, this.predictionsFile].forEach(file => {
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify([], null, 2));
      }
    });
  }

  saveQuery(queryHash: string, queryData: any): void {
    const queries = this.loadQueries();
    const existing = queries.find(q => q.queryHash === queryHash);

    if (existing) {
      existing.executionCount++;
    } else {
      queries.push({
        queryHash,
        queryData,
        createdAt: new Date(),
        executionCount: 1,
      });
    }

    fs.writeFileSync(this.queriesFile, JSON.stringify(queries, null, 2));
  }

  loadQueries(): StoredQuery[] {
    try {
      const data = fs.readFileSync(this.queriesFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  saveMetrics(metrics: QueryMetrics[]): void {
    fs.writeFileSync(this.metricsFile, JSON.stringify(metrics, null, 2));
  }

  loadMetrics(): QueryMetrics[] {
    try {
      const data = fs.readFileSync(this.metricsFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  savePrediction(prediction: StoredPrediction): void {
    const predictions = this.loadPredictions();
    const existing = predictions.find(p => p.queryHash === prediction.queryHash);

    if (existing) {
      Object.assign(existing, prediction);
    } else {
      predictions.push(prediction);
    }

    fs.writeFileSync(this.predictionsFile, JSON.stringify(predictions, null, 2));
  }

  loadPredictions(): StoredPrediction[] {
    try {
      const data = fs.readFileSync(this.predictionsFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  getQueryStats(): { totalQueries: number; totalExecutions: number } {
    const queries = this.loadQueries();
    return {
      totalQueries: queries.length,
      totalExecutions: queries.reduce((sum, q) => sum + q.executionCount, 0),
    };
  }
}
