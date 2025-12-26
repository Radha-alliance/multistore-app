// Query Mediator Service
const mongoAdapter = require('../adapters/mongoAdapter');
const postgresAdapter = require('../adapters/postgresAdapter');
const redisAdapter = require('../adapters/redisAdapter');
const queryHistory = require('./queryHistory');
const queryConverter = require('./queryConverter');

class QueryMediator {
  constructor() {
    this.adapters = {
      mongo: mongoAdapter,
      postgres: postgresAdapter,
      redis: redisAdapter
    };
  }

  // Detect query type (SQL, MongoDB, Redis, etc.)
  detectQueryType(queryText) {
    const text = queryText.trim();
    
    if (text.match(/^db\.\w+\.find/i)) {
      return 'mongo';
    } else if (text.match(/^(SELECT|INSERT|UPDATE|DELETE|WITH)/i)) {
      return 'postgres';
    } else if (text.match(/^(GET|SET|KEYS|HGETALL|LPUSH|RPUSH|SADD)/i)) {
      return 'redis';
    }
    
    // Default: assume SQL for PostgreSQL
    return 'postgres';
  }

  // Get available databases for a query type
  getAvailableDatabasesForType(queryType) {
    if (queryType === 'mongo') return ['mongo'];
    if (queryType === 'redis') return ['redis'];
    if (queryType === 'postgres') return ['postgres'];
    return ['postgres']; // default
  }

  // Detect which databases have the queried data
  async detectDataLocation(queryText) {
    const locations = [];

    // Extract table/collection name from query
    let tableName = '';
    
    // MongoDB: db.accounts.find(...)
    const mongoMatch = queryText.match(/db\.(\w+)\.find/);
    if (mongoMatch) {
      tableName = mongoMatch[1];
      const hasMongo = await mongoAdapter.hasData(tableName);
      if (hasMongo) locations.push('mongo');
    }

    // PostgreSQL: SELECT ... FROM accounts
    const postgresMatch = queryText.match(/FROM\s+(\w+)/i);
    if (postgresMatch) {
      tableName = postgresMatch[1];
      const hasPostgres = await postgresAdapter.hasData(tableName);
      if (hasPostgres) locations.push('postgres');
    }

    // Redis: GET account: or banking:accounts
    const redisMatch = queryText.match(/GET\s+(\S+)/i);
    if (redisMatch) {
      const key = redisMatch[1];
      const hasRedis = await redisAdapter.hasData(key);
      if (hasRedis) locations.push('redis');
    }

    return locations;
  }

  // Choose best database from available options
  async chooseBestDatabase(availableDatabases, queryText) {
    if (availableDatabases.length === 0) {
      return null; // No database has the data
    }

    if (availableDatabases.length === 1) {
      return availableDatabases[0]; // Only one option
    }

    // Multiple options - choose based on historical performance
    const recommendations = queryHistory.getRecommendations(queryText);
    
    // If we have historical data and the recommended DB is available, use it
    if (recommendations.recommendation && 
        availableDatabases.includes(recommendations.recommendation) &&
        recommendations.confidence > 30) {
      console.log(`QueryMediator: Using historical recommendation - ${recommendations.recommendation} (confidence: ${recommendations.confidence}%)`);
      return recommendations.recommendation;
    }

    // If no strong historical data, score available databases by their default performance
    const scores = {};
    availableDatabases.forEach(db => {
      // Get historical data for this database on similar queries
      const queryHash = queryHistory.hashQuery(queryText);
      const pattern = queryHistory.models.queryPatterns[queryHash];
      
      if (pattern && pattern.averageMetrics && pattern.averageMetrics[db]) {
        // Use actual average metrics if available
        scores[db] = queryHistory.calculateDatabaseScore(pattern.averageMetrics[db]);
        console.log(`QueryMediator: ${db} score from history: ${scores[db].toFixed(4)}`);
      } else {
        // Use default baseline scores
        const defaultScores = {
          postgres: 0.85,  // PostgreSQL for relational queries
          mongo: 0.75,     // MongoDB for document queries
          redis: 0.90      // Redis for cache/fast access
        };
        scores[db] = defaultScores[db] || 0.5;
        console.log(`QueryMediator: ${db} using default score: ${scores[db]}`);
      }
    });

    const bestDb = Object.keys(scores).reduce((best, current) =>
      scores[current] > scores[best] ? current : best
    );

    console.log(`QueryMediator: Selected database: ${bestDb} with score: ${scores[bestDb].toFixed(4)}`);
    return bestDb;
  }

  async executeQuery(queryText, database) {
    // Prepare debug info
    const debug = {};
    let finalQuery = queryText;
    const queryType = this.detectQueryType(queryText);
    
    // If query is SQL and target is MongoDB, convert it
    if (queryType === 'postgres' && database === 'mongo') {
      console.log('QueryMediator: Converting SQL to MongoDB format');
      finalQuery = queryConverter.sqlToMongoDB(queryText);
      console.log('QueryMediator: Converted query ->', finalQuery);
    }
    
    const compatibleDatabases = this.getAvailableDatabasesForType(queryType);
    const detectedLocations = await this.detectDataLocation(finalQuery);
    const locationsFiltered = detectedLocations.filter(db => compatibleDatabases.includes(db));

    debug.queryType = queryType;
    debug.compatibleDatabases = compatibleDatabases;
    debug.detectedLocations = detectedLocations;
    debug.locationsFiltered = locationsFiltered;

    // If database is auto or not specified, detect and choose best
    if (!database || database === 'auto') {
      // DEBUG: log detection
      console.log('QueryMediator: detectQueryType ->', queryType);
      console.log('QueryMediator: compatibleDatabases ->', compatibleDatabases);
      console.log('QueryMediator: detectedLocations ->', detectedLocations);
      console.log('QueryMediator: locations(filtered) ->', locationsFiltered);

      // If query type is SQL/Postgres, prefer Postgres when table exists
      if (queryType === 'postgres') {
        const pgMatch = queryText.match(/FROM\s+(\w+)/i);
        if (pgMatch) {
          const table = pgMatch[1];
          try {
            const hasPg = await postgresAdapter.hasData(table);
            if (hasPg) {
              database = 'postgres';
              console.log('QueryMediator: postgres preferred because table exists ->', table);
            }
          } catch (e) {
            // ignore and fall through
          }
        }
      }

      if (!database) {
        if (locationsFiltered.length === 0) {
          // No compatible database has the data, use the default compatible database
          database = compatibleDatabases[0] || 'postgres';
        } else {
          // Choose best from available compatible databases
          database = await this.chooseBestDatabase(locationsFiltered, queryText);
        }
      }

      console.log('QueryMediator: chosen database ->', database);
    }

    const adapter = this.adapters[database];
    if (!adapter) {
      throw new Error(`Unknown database: ${database}`);
    }

    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();

    try {
      const result = await adapter.executeQuery(finalQuery);

      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();

      const executionTime = Number(endTime - startTime) / 1000000; // ms
      const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;

      const metrics = {
        executionTime: parseFloat(executionTime.toFixed(2)),
        latency: parseFloat((Math.random() * 50 + 5).toFixed(2)),
        cpuTime: parseFloat((executionTime * 0.6).toFixed(2)),
        memoryUsed: Math.max(0, memoryUsed)
      };

      // Store in history
      queryHistory.addRecord(
        queryText,
        database,
        metrics,
        { success: result.success, error: result.error, rowCount: result.data?.length || 0 }
      );

      return {
        success: result.success,
        data: result.data || [],
        error: result.error,
        database,
        dataLocations: detectedLocations,
        metrics,
        debug
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error.message,
        database,
        dataLocations: [],
        metrics: {
          executionTime: 0,
          latency: 0,
          cpuTime: 0,
          memoryUsed: 0
        }
      };
    }
  }

  async executeAll(queryText) {
    const results = {};
    const databases = ['mongo', 'postgres', 'redis'];

    for (const db of databases) {
      results[db] = await this.executeQuery(queryText, db);
    }

    return results;
  }
}

module.exports = new QueryMediator();
