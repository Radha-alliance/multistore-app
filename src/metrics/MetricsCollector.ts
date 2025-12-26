export interface QueryMetrics {
  database: string;
  queryHash: string;
  executionTime: number; // milliseconds
  latency: number; // milliseconds
  cpuTime: number; // milliseconds
  memoryUsed: number; // bytes
  timestamp: Date;
  success: boolean;
  resultSize: number; // bytes
}

export interface AggregatedMetrics {
  database: string;
  queryHash: string;
  avgExecutionTime: number;
  avgLatency: number;
  avgCpuTime: number;
  totalExecutions: number;
  successRate: number;
}

export class MetricsCollector {
  private metrics: QueryMetrics[] = [];

  recordMetric(metric: QueryMetrics): void {
    this.metrics.push(metric);
    // Keep only last 10000 metrics in memory
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-10000);
    }
  }

  getMetricsForQuery(queryHash: string): QueryMetrics[] {
    return this.metrics.filter(m => m.queryHash === queryHash);
  }

  getAggregatedMetrics(queryHash: string): Map<string, AggregatedMetrics> {
    const queryMetrics = this.getMetricsForQuery(queryHash);
    const grouped = new Map<string, QueryMetrics[]>();

    queryMetrics.forEach(m => {
      if (!grouped.has(m.database)) {
        grouped.set(m.database, []);
      }
      grouped.get(m.database)!.push(m);
    });

    const aggregated = new Map<string, AggregatedMetrics>();

    grouped.forEach((metrics, database) => {
      const successMetrics = metrics.filter(m => m.success);
      const totalExecutions = metrics.length;
      const successCount = successMetrics.length;

      if (successMetrics.length > 0) {
        aggregated.set(database, {
          database,
          queryHash,
          avgExecutionTime: successMetrics.reduce((sum, m) => sum + m.executionTime, 0) / successCount,
          avgLatency: successMetrics.reduce((sum, m) => sum + m.latency, 0) / successCount,
          avgCpuTime: successMetrics.reduce((sum, m) => sum + m.cpuTime, 0) / successCount,
          totalExecutions,
          successRate: successCount / totalExecutions,
        });
      }
    });

    return aggregated;
  }

  getAllMetrics(): QueryMetrics[] {
    return [...this.metrics];
  }

  clearMetrics(): void {
    this.metrics = [];
  }
}
