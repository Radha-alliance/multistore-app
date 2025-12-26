// Performance Metrics Service
class PerformanceMetrics {
  measureQuery(fn) {
    return async (...args) => {
      const startTime = process.hrtime.bigint();
      const startCpuUsage = process.cpuUsage();
      const startMemory = process.memoryUsage();

      try {
        const result = await fn(...args);

        // Calculate metrics
        const endTime = process.hrtime.bigint();
        const endCpuUsage = process.cpuUsage(startCpuUsage);
        const endMemory = process.memoryUsage();

        const executionTime = Number(endTime - startTime) / 1000000; // Convert to ms
        const cpuTime = (endCpuUsage.user + endCpuUsage.system) / 1000; // Convert to ms
        const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;

        return {
          ...result,
          metrics: {
            executionTime: parseFloat(executionTime.toFixed(2)),
            cpuTime: parseFloat(cpuTime.toFixed(2)),
            latency: parseFloat((executionTime * 0.3).toFixed(2)), // Estimate latency
            memoryUsed: Math.max(0, memoryUsed)
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          data: [],
          metrics: {
            executionTime: 0,
            cpuTime: 0,
            latency: 0,
            memoryUsed: 0
          }
        };
      }
    };
  }

  calculateStats(metrics) {
    if (!metrics || metrics.length === 0) return null;

    const times = metrics.map(m => m.executionTime);
    const latencies = metrics.map(m => m.latency);
    const cpuTimes = metrics.map(m => m.cpuTime);

    const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = (arr) => {
      const m = mean(arr);
      return Math.sqrt(arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / arr.length);
    };

    return {
      executionTime: {
        avg: parseFloat(mean(times).toFixed(2)),
        min: Math.min(...times),
        max: Math.max(...times),
        variance: parseFloat(variance(times).toFixed(2))
      },
      latency: {
        avg: parseFloat(mean(latencies).toFixed(2)),
        min: Math.min(...latencies),
        max: Math.max(...latencies),
        variance: parseFloat(variance(latencies).toFixed(2))
      },
      cpuTime: {
        avg: parseFloat(mean(cpuTimes).toFixed(2)),
        min: Math.min(...cpuTimes),
        max: Math.max(...cpuTimes),
        variance: parseFloat(variance(cpuTimes).toFixed(2))
      }
    };
  }
}

module.exports = new PerformanceMetrics();
