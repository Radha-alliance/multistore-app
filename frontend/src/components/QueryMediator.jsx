import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './QueryMediator.css';

function QueryMediator() {
  const [queryText, setQueryText] = useState('');
  const [selectedDb, setSelectedDb] = useState('auto');
  const [executionResults, setExecutionResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('execute');
  const [comparisonResults, setComparisonResults] = useState(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  // Use relative API path that works through Vite proxy in all environments
  // Vite dev server proxies /api requests to http://localhost:5000
  const API_BASE = '/api';

  // Fetch stats on component mount
  useEffect(() => {
    fetchStats();
    fetchHistory();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_BASE}/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API_BASE}/history`);
      setHistory(response.data);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const getRecommendation = async () => {
    if (!queryText.trim()) {
      alert('Please enter a query');
      return;
    }

    try {
      const response = await axios.post(`${API_BASE}/recommend`, {
        queryText
      });
      setRecommendation(response.data);
    } catch (error) {
      console.error('Error getting recommendation:', error);
    }
  };

  const executeQuery = async (dbTarget = null) => {
    if (!queryText.trim()) {
      alert('Please enter a query');
      return;
    }

    setLoading(true);
    const targetDb = dbTarget || selectedDb;

    try {
      let endpoint = `${API_BASE}/execute`;
      if (targetDb !== 'auto') {
        endpoint += `?database=${targetDb}`;
      }

      const response = await axios.post(endpoint, {
        queryText
      });

      setExecutionResults(response.data);
      setRecommendation(null);
      fetchStats();
      fetchHistory();
    } catch (error) {
      setExecutionResults({
        error: error.response?.data?.error || error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const executeOnAllDatabases = async () => {
    if (!queryText.trim()) {
      alert('Please enter a query');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE}/execute-all`, {
        queryText
      });

      setExecutionResults(response.data);
      fetchStats();
      fetchHistory();
    } catch (error) {
      setExecutionResults({
        error: error.response?.data?.error || error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const compareAllDatabases = async () => {
    if (!queryText.trim()) {
      alert('Please enter a query');
      return;
    }

    setComparisonLoading(true);

    try {
      const response = await axios.post(`${API_BASE}/execute-all`, {
        queryText
      });

      setComparisonResults(response.data);
      fetchStats();
      fetchHistory();
    } catch (error) {
      setComparisonResults({
        error: error.response?.data?.error || error.message
      });
    } finally {
      setComparisonLoading(false);
    }
  };

  const getRecommendationReason = (comparison) => {
    if (!comparison) return '';

    const dbMetrics = {};
    const dbNames = { mongo: 'MongoDB', postgres: 'PostgreSQL', redis: 'Redis' };

    // Calculate scores for each database
    Object.entries(comparison).forEach(([db, result]) => {
      if (result.success && result.metrics) {
        const metrics = result.metrics;
        // Lower is better for all metrics
        const executionScore = 1 / (metrics.executionTime + 1);
        const latencyScore = 1 / (metrics.latency + 1);
        const cpuScore = 1 / (metrics.cpuTime + 1);
        
        // Weighted scoring: execution time (40%), latency (30%), CPU (20%), consistency (10%)
        const totalScore = (executionScore * 0.4) + (latencyScore * 0.3) + (cpuScore * 0.2);
        
        dbMetrics[db] = {
          name: dbNames[db],
          score: totalScore,
          metrics: metrics,
          success: true
        };
      } else {
        dbMetrics[db] = {
          name: dbNames[db],
          success: false,
          error: result.error
        };
      }
    });

    // Find best database
    const best = Object.values(dbMetrics).reduce((prev, curr) => 
      (prev.success && curr.success && curr.score > prev.score) ? curr : (prev.success ? prev : curr)
    );

    // Generate reason
    if (!best.success) {
      return `⚠️ ${best.name} is unavailable. ${Object.values(dbMetrics).find(m => m.success)?.name || 'No databases'} is recommended as fallback.`;
    }

    const fastest = Object.values(dbMetrics).filter(m => m.success).reduce((prev, curr) => 
      curr.metrics.executionTime < prev.metrics.executionTime ? curr : prev
    );
    
    const lowestLatency = Object.values(dbMetrics).filter(m => m.success).reduce((prev, curr) => 
      curr.metrics.latency < prev.metrics.latency ? curr : prev
    );

    const lowestCpu = Object.values(dbMetrics).filter(m => m.success).reduce((prev, curr) => 
      curr.metrics.cpuTime < prev.metrics.cpuTime ? curr : prev
    );

    let reason = `✅ ${best.name} is recommended. `;
    reason += `Execution time: ${fastest.metrics.executionTime.toFixed(2)}ms (${fastest.name}), `;
    reason += `Latency: ${lowestLatency.metrics.latency.toFixed(2)}ms (${lowestLatency.name}), `;
    reason += `CPU: ${lowestCpu.metrics.cpuTime.toFixed(2)}ms (${lowestCpu.name}).`;

    return reason;
  };

  return (
    <div className="query-mediator">
      <header className="header">
        <h1>🚀 Multi-Store Query Mediator</h1>
        <p>AI-Powered Database Selection & Performance Analysis</p>
      </header>

      <nav className="tabs">
        <button
          className={`tab ${activeTab === 'execute' ? 'active' : ''}`}
          onClick={() => setActiveTab('execute')}
        >
          📝 Query Executor
        </button>
        <button
          className={`tab ${activeTab === 'comparison' ? 'active' : ''}`}
          onClick={() => setActiveTab('comparison')}
        >
          📊 DB Comparison
        </button>
        <button
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📈 History & Stats
        </button>
        <button
          className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📉 Analytics
        </button>
      </nav>

      <main className="main-content">
        {/* Query Executor Tab */}
        {activeTab === 'execute' && (
          <section className="executor-section">
            <div className="query-input-area">
              <h2>Enter Your Query</h2>
              <textarea
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Enter your SQL or MongoDB query here..."
                className="query-textarea"
                rows="8"
              />

              <div className="controls">
                <div className="db-selector">
                  <label>Select Database:</label>
                  <select
                    value={selectedDb}
                    onChange={(e) => setSelectedDb(e.target.value)}
                  >
                    <option value="auto">🤖 Auto (AI Selection)</option>
                    <option value="mongo">🍃 MongoDB</option>
                    <option value="postgres">🐘 PostgreSQL</option>
                    <option value="redis">⚡ Redis</option>
                  </select>
                </div>

                <div className="action-buttons">
                  <button
                    onClick={() => executeQuery()}
                    disabled={loading || !queryText.trim()}
                    className="btn btn-primary"
                  >
                    {loading ? '⏳ Executing...' : '▶️ Execute'}
                  </button>
                  <button
                    onClick={executeOnAllDatabases}
                    disabled={loading || !queryText.trim()}
                    className="btn btn-secondary"
                  >
                    ⚙️ Test All DBs
                  </button>
                  <button
                    onClick={getRecommendation}
                    disabled={loading || !queryText.trim()}
                    className="btn btn-info"
                  >
                    💡 Get Recommendation
                  </button>
                </div>
              </div>
            </div>

            {/* Recommendation Card */}
            {recommendation && (
              <div className="recommendation-card">
                <h3>🎯 AI Recommendation</h3>
                <div className="rec-content">
                  <div className="rec-main">
                    <div className="rec-database">
                      {recommendation.recommendation ? (
                        <>
                          <span className="db-badge">
                            {recommendation.recommendation === 'mongo'
                              ? '🍃 MongoDB'
                              : recommendation.recommendation === 'postgres'
                              ? '🐘 PostgreSQL'
                              : '⚡ Redis'}
                          </span>
                          <span className="confidence">
                            Confidence: {recommendation.confidence.toFixed(1)}%
                          </span>
                        </>
                      ) : (
                        <span className="no-rec">{recommendation.reason}</span>
                      )}
                    </div>
                    {recommendation.scores && (
                      <div className="score-breakdown">
                        <h4>Performance Scores:</h4>
                        <div className="scores-grid">
                          {Object.entries(recommendation.scores).map(([db, score]) => (
                            <div key={db} className="score-item">
                              <span className="score-db">
                                {db === 'mongo'
                                  ? '🍃 Mongo'
                                  : db === 'postgres'
                                  ? '🐘 PG'
                                  : '⚡ Redis'}
                              </span>
                              <div className="score-bar">
                                <div
                                  className="score-fill"
                                  style={{ width: `${score * 100}%` }}
                                ></div>
                              </div>
                              <span className="score-value">
                                {(score * 100).toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => executeQuery(recommendation.recommendation)}
                    disabled={loading || !recommendation.recommendation}
                    className="btn btn-success"
                  >
                    ✅ Execute on Recommended DB
                  </button>
                </div>
              </div>
            )}

            {/* Execution Results */}
            {executionResults && (
              <div className={`results-card ${executionResults.error ? 'error' : 'success'}`}>
                <h3>⚡ Execution Results</h3>

                {executionResults.error ? (
                  <div className="error-message">
                    <strong>Error:</strong> {executionResults.error}
                  </div>
                ) : (
                  <>
                    {executionResults.singleExecution ? (
                      <div className="single-result">
                        <div className="result-header">
                          <span className="db-label">
                            {executionResults.database === 'mongo'
                              ? '🍃 MongoDB'
                              : executionResults.database === 'postgres'
                              ? '🐘 PostgreSQL'
                              : '⚡ Redis'}
                          </span>
                          <span className="status-badge success">Success</span>
                        </div>

                        <div className="metrics-grid">
                          <div className="metric">
                            <span className="metric-label">Execution Time</span>
                            <span className="metric-value">
                              {executionResults.metrics.executionTime.toFixed(2)} ms
                            </span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">Latency</span>
                            <span className="metric-value">
                              {executionResults.metrics.latency.toFixed(2)} ms
                            </span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">CPU Time</span>
                            <span className="metric-value">
                              {executionResults.metrics.cpuTime.toFixed(2)} ms
                            </span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">Memory Used</span>
                            <span className="metric-value">
                              {(executionResults.metrics.memoryUsed / 1024).toFixed(2)} KB
                            </span>
                          </div>
                        </div>

                        {executionResults.data && executionResults.data.length > 0 && (
                          <div className="result-data">
                            <h4>Results ({executionResults.data.length} rows)</h4>
                            <div className="table-wrapper">
                              <table>
                                <thead>
                                  <tr>
                                    {Object.keys(executionResults.data[0]).map((key) => (
                                      <th key={key}>{key}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {executionResults.data.slice(0, 10).map((row, idx) => (
                                    <tr key={idx}>
                                      {Object.values(row).map((val, i) => (
                                        <td key={i}>{String(val).substring(0, 50)}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {executionResults.data.length > 10 && (
                                <p className="more-data">
                                  ... and {executionResults.data.length - 10} more rows
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="multi-results">
                        {Object.entries(executionResults).map(([db, result]) => (
                          <div key={db} className="result-item">
                            <div className="result-header">
                              <span className="db-label">
                                {db === 'mongo'
                                  ? '🍃 MongoDB'
                                  : db === 'postgres'
                                  ? '🐘 PostgreSQL'
                                  : '⚡ Redis'}
                              </span>
                              <span
                                className={`status-badge ${result.success ? 'success' : 'error'}`}
                              >
                                {result.success ? 'Success' : 'Failed'}
                              </span>
                            </div>

                            <div className="metrics-inline">
                              <span>
                                ⏱️ {result.metrics?.executionTime.toFixed(2) || 'N/A'} ms
                              </span>
                              <span>
                                📡 {result.metrics?.latency.toFixed(2) || 'N/A'} ms
                              </span>
                              <span>
                                🔧 {result.metrics?.cpuTime.toFixed(2) || 'N/A'} ms
                              </span>
                            </div>

                            {result.error && (
                              <div className="error-inline">{result.error}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {/* Database Comparison Tab */}
        {activeTab === 'comparison' && (
          <section className="comparison-section">
            <div className="comparison-input">
              <h2>🔄 Database Performance Comparison</h2>
              <p>Execute the same query across all databases and compare performance metrics</p>
              
              <textarea
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Enter your SQL or MongoDB query here..."
                className="query-textarea"
                rows="6"
              />

              <button
                onClick={compareAllDatabases}
                disabled={comparisonLoading || !queryText.trim()}
                className="btn btn-primary"
              >
                {comparisonLoading ? '⏳ Comparing...' : '⚡ Compare All Databases'}
              </button>
            </div>

            {comparisonResults && (
              <div className="comparison-results">
                <div className="recommendation-banner">
                  <h3>💡 Recommendation</h3>
                  <p>{getRecommendationReason(comparisonResults)}</p>
                </div>

                {/* Query Conversion Info */}
                <div className="query-conversion-info">
                  <h3>🔄 Query Conversion</h3>
                  <div className="original-query">
                    <label>Original Query:</label>
                    <code>{queryText}</code>
                  </div>
                  {comparisonResults.mongo?.convertedQuery && comparisonResults.mongo.convertedQuery !== queryText && (
                    <div className="converted-query">
                      <label>📄 Converted for MongoDB:</label>
                      <code>{comparisonResults.mongo.convertedQuery}</code>
                      <span className="conversion-note">✨ Auto-converted SQL to MongoDB syntax</span>
                    </div>
                  )}
                </div>

                {/* Charts Section */}
                <div className="comparison-charts">
                  {/* Execution Time Chart */}
                  <div className="chart-container">
                    <h3>⏱️ Execution Time (ms)</h3>
                    <div className="bar-chart">
                      {Object.entries(comparisonResults).map(([db, result]) => {
                        const dbName = db === 'mongo' ? 'MongoDB' : db === 'postgres' ? 'PostgreSQL' : 'Redis';
                        const dbIcon = db === 'mongo' ? '🍃' : db === 'postgres' ? '🐘' : '⚡';
                        const time = result.metrics?.executionTime || 0;
                        const maxTime = Math.max(...Object.values(comparisonResults).map(r => r.metrics?.executionTime || 0), 1);
                        const percentage = (time / maxTime) * 100;
                        
                        return (
                          <div key={db} className="bar-item">
                            <label>{dbIcon} {dbName}</label>
                            <div className="bar-wrapper">
                              <div 
                                className={`bar ${result.success ? 'success' : 'error'}`}
                                style={{ width: `${percentage}%` }}
                              >
                                <span className="bar-value">{time.toFixed(2)}ms</span>
                              </div>
                            </div>
                            {!result.success && <span className="error-badge">{result.error}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Latency Chart */}
                  <div className="chart-container">
                    <h3>🌐 Latency (ms)</h3>
                    <div className="bar-chart">
                      {Object.entries(comparisonResults).map(([db, result]) => {
                        const dbName = db === 'mongo' ? 'MongoDB' : db === 'postgres' ? 'PostgreSQL' : 'Redis';
                        const dbIcon = db === 'mongo' ? '🍃' : db === 'postgres' ? '🐘' : '⚡';
                        const latency = result.metrics?.latency || 0;
                        const maxLatency = Math.max(...Object.values(comparisonResults).map(r => r.metrics?.latency || 0), 1);
                        const percentage = (latency / maxLatency) * 100;
                        
                        return (
                          <div key={db} className="bar-item">
                            <label>{dbIcon} {dbName}</label>
                            <div className="bar-wrapper">
                              <div 
                                className={`bar ${result.success ? 'success' : 'error'}`}
                                style={{ width: `${percentage}%` }}
                              >
                                <span className="bar-value">{latency.toFixed(2)}ms</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* CPU Time Chart */}
                  <div className="chart-container">
                    <h3>💻 CPU Time (ms)</h3>
                    <div className="bar-chart">
                      {Object.entries(comparisonResults).map(([db, result]) => {
                        const dbName = db === 'mongo' ? 'MongoDB' : db === 'postgres' ? 'PostgreSQL' : 'Redis';
                        const dbIcon = db === 'mongo' ? '🍃' : db === 'postgres' ? '🐘' : '⚡';
                        const cpuTime = result.metrics?.cpuTime || 0;
                        const maxCpuTime = Math.max(...Object.values(comparisonResults).map(r => r.metrics?.cpuTime || 0), 1);
                        const percentage = (cpuTime / maxCpuTime) * 100;
                        
                        return (
                          <div key={db} className="bar-item">
                            <label>{dbIcon} {dbName}</label>
                            <div className="bar-wrapper">
                              <div 
                                className={`bar ${result.success ? 'success' : 'error'}`}
                                style={{ width: `${percentage}%` }}
                              >
                                <span className="bar-value">{cpuTime.toFixed(2)}ms</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Detailed Metrics Table */}
                <div className="metrics-table">
                  <h3>📋 Detailed Metrics</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Database</th>
                        <th>Status</th>
                        <th>Execution Time</th>
                        <th>Latency</th>
                        <th>CPU Time</th>
                        <th>Memory Used</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(comparisonResults).map(([db, result]) => {
                        const dbName = db === 'mongo' ? '🍃 MongoDB' : db === 'postgres' ? '🐘 PostgreSQL' : '⚡ Redis';
                        return (
                          <tr key={db} className={result.success ? 'success' : 'error'}>
                            <td><strong>{dbName}</strong></td>
                            <td>{result.success ? '✅ Success' : `❌ ${result.error}`}</td>
                            <td>{result.metrics?.executionTime?.toFixed(2)}ms</td>
                            <td>{result.metrics?.latency?.toFixed(2)}ms</td>
                            <td>{result.metrics?.cpuTime?.toFixed(2)}ms</td>
                            <td>{(result.metrics?.memoryUsed / 1024).toFixed(2)} KB</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* History & Stats Tab */}
        {activeTab === 'history' && (
          <section className="history-section">
            {stats && (
              <div className="stats-overview">
                <h2>📊 Performance Statistics</h2>
                <div className="stats-grid">
                  <div className="stat-card">
                    <h4>Total Queries</h4>
                    <span className="stat-value">{stats.totalQueries}</span>
                  </div>
                  {Object.entries(stats.databases).map(([db, data]) => (
                    <div key={db} className="stat-card">
                      <h4>
                        {db === 'mongo'
                          ? '🍃 MongoDB'
                          : db === 'postgres'
                          ? '🐘 PostgreSQL'
                          : '⚡ Redis'}
                      </h4>
                      <div className="stat-details">
                        <p>Executions: <strong>{data.count}</strong></p>
                        <p>Avg Time: <strong>{data.avgExecutionTime.toFixed(2)} ms</strong></p>
                        <p>Success: <strong>{data.successRate}%</strong></p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="history-list">
              <h2>📝 Query History</h2>
              {history.length > 0 ? (
                <div className="history-items">
                  {history.slice(0, 20).map((record) => (
                    <div key={record.id} className="history-item">
                      <div className="history-header">
                        <span className="history-db">
                          {record.database === 'mongo'
                            ? '🍃'
                            : record.database === 'postgres'
                            ? '🐘'
                            : '⚡'}
                        </span>
                        <span className="history-time">
                          {new Date(record.timestamp).toLocaleString()}
                        </span>
                        <span className={`status-badge ${record.result.success ? 'success' : 'error'}`}>
                          {record.result.success ? '✓' : '✗'}
                        </span>
                      </div>
                      <p className="history-query">{record.queryText.substring(0, 100)}...</p>
                      <div className="history-metrics">
                        <span>⏱️ {record.metrics.executionTime.toFixed(2)} ms</span>
                        <span>📡 {record.metrics.latency.toFixed(2)} ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-data">No query history yet. Execute a query to get started!</p>
              )}
            </div>
          </section>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <section className="analytics-section">
            <h2>📈 Database Comparison</h2>
            {stats && stats.totalQueries > 0 ? (
              <div className="analytics-content">
                <div className="comparison-charts">
                  {Object.entries(stats.databases).map(([db, data]) => (
                    <div key={db} className="comparison-item">
                      <h4>
                        {db === 'mongo'
                          ? '🍃 MongoDB'
                          : db === 'postgres'
                          ? '🐘 PostgreSQL'
                          : '⚡ Redis'}
                      </h4>
                      <div className="comparison-bar">
                        <div className="bar-item">
                          <label>Avg Execution Time</label>
                          <div className="bar-container">
                            <div
                              className="bar-fill exec"
                              style={{
                                width: `${Math.min(
                                  (data.avgExecutionTime / 1000) * 100,
                                  100
                                )}%`
                              }}
                            ></div>
                          </div>
                          <span>{data.avgExecutionTime.toFixed(2)} ms</span>
                        </div>
                        <div className="bar-item">
                          <label>Success Rate</label>
                          <div className="bar-container">
                            <div
                              className="bar-fill success"
                              style={{ width: `${data.successRate}%` }}
                            ></div>
                          </div>
                          <span>{data.successRate}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="recommendations-box">
                  <h3>💡 Key Insights</h3>
                  <ul>
                    <li>✓ Most consistent database: Check variance in metrics</li>
                    <li>✓ Fastest average execution: See comparison above</li>
                    <li>✓ Most reliable: Compare success rates</li>
                    <li>✓ Use AI recommendations for optimal query routing</li>
                  </ul>
                </div>
              </div>
            ) : (
              <p className="no-data">Execute queries to view analytics</p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default QueryMediator;
