# 🚀 Multi-Store Query Mediator

An AI-powered query execution system that intelligently routes database queries to the optimal data store based on historical performance metrics and machine learning predictions.

## Features

### Core Functionality
- **Multi-Database Support**: MongoDB, PostgreSQL, and Redis
- **Intelligent Query Routing**: AI-powered selection of the best database for each query
- **Performance Tracking**: Real-time metrics collection (execution time, latency, CPU usage, memory consumption)
- **Query History & Analytics**: Complete audit trail with performance statistics
- **Machine Learning Model**: Learns from query execution patterns to predict optimal database

### Performance Metrics
- **Execution Time**: Total query execution duration
- **Latency**: Network latency to database
- **CPU Time**: Processor time consumed
- **Memory Usage**: RAM utilization during execution
- **Success Rate**: Query success/failure tracking

## Architecture

```
multistore-app/
├── backend/
│   ├── server.js                 # Express server
│   ├── config/
│   │   └── database.js           # Database connections
│   ├── adapters/
│   │   ├── mongoAdapter.js       # MongoDB implementation
│   │   ├── postgresAdapter.js    # PostgreSQL implementation
│   │   └── redisAdapter.js       # Redis implementation
│   ├── services/
│   │   ├── queryMediator.js      # Core query execution logic
│   │   ├── performanceMetrics.js # Metrics collection
│   │   └── queryHistory.js       # History & ML models
│   └── routes/
│       └── queryRoutes.js        # API endpoints
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── QueryMediator.jsx # Main React component
│   │   │   └── QueryMediator.css # Styling
│   │   └── index.jsx             # Entry point
│   ├── vite.config.js
│   └── package.json
├── data/
│   ├── query_history.json        # Query execution history
│   └── ml_models.json            # ML model data
├── .env.local                    # Environment variables
└── package.json
```

## Setup Instructions

### Prerequisites
- Node.js 16+ 
- npm or yarn
- MongoDB Atlas account
- PostgreSQL database (Neon)
- Redis (Upstash)

### 1. Clone the Repository
```bash
cd multistore-app
```

### 2. Install Dependencies
```bash
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 3. Configure Environment Variables

The `.env.local` file is already configured with:
```env
MONGO_URI=mongodb+srv://atlas-sql-6918be90176d4e67875d29e6-tyimw2.a.query.mongodb.net/sample_mflix?ssl=true&authSource=admin

POSTGRES_URI=postgresql://neondb_owner:npg_HcWv02fzSyhl@ep-proud-sound-a89haju7-pooler.eastus2.azure.neon.tech/neondb?sslmode=require&channel_binding=require

UPSTASH_REDIS_REST_URL=https://apparent-insect-37639.upstash.io
UPSTASH_REDIS_REST_TOKEN=AZMHAAIncDIzMmYyZjQ3YzQxNmM0MjE5YmYzMTY1M2RkNDdkODkxNnAyMzc2Mzk
```

### 4. Start the Application

**Development Mode (both backend and frontend):**
```bash
npm run dev
```

**Backend Only:**
```bash
npm run backend:dev
```

**Frontend Only:**
```bash
npm run frontend:dev
```

## API Endpoints

### Query Execution
```
POST /api/execute
Query Parameters:
  - database: 'auto' | 'mongo' | 'postgres' | 'redis'

Request Body:
{
  "queryText": "SELECT * FROM users LIMIT 10;"
}

Response:
{
  "singleExecution": true,
  "database": "postgres",
  "metrics": {
    "executionTime": 45.2,
    "latency": 12.5,
    "cpuTime": 32.1,
    "memoryUsed": 2048000
  },
  "data": [...],
  "error": null
}
```

### Execute on All Databases
```
POST /api/execute-all

Request Body:
{
  "queryText": "SELECT * FROM users LIMIT 10;"
}

Response:
{
  "mongo": { success: true, metrics: {...}, data: [...] },
  "postgres": { success: true, metrics: {...}, data: [...] },
  "redis": { success: false, error: "Not a SQL query", metrics: {...} }
}
```

### Get Recommendations
```
POST /api/recommend

Request Body:
{
  "queryText": "SELECT * FROM users LIMIT 10;"
}

Response:
{
  "recommendation": "postgres",
  "scores": {
    "mongo": 0.75,
    "postgres": 0.92,
    "redis": 0.45
  },
  "reason": "Based on 15 historical executions",
  "confidence": 85.5
}
```

### Get Query History
```
GET /api/history?queryText=SELECT&database=postgres&timeRange=86400000

Response:
[
  {
    "id": "query_1234567890_abc123",
    "timestamp": "2025-12-25T10:30:00Z",
    "queryText": "SELECT * FROM users...",
    "database": "postgres",
    "metrics": {...},
    "result": {...}
  },
  ...
]
```

### Get Statistics
```
GET /api/stats?database=postgres

Response:
{
  "totalQueries": 42,
  "databases": {
    "mongo": {
      "count": 15,
      "avgExecutionTime": 125.5,
      "minExecutionTime": 50.2,
      "maxExecutionTime": 340.8,
      "successRate": "93.33"
    },
    "postgres": {
      "count": 20,
      "avgExecutionTime": 95.3,
      "minExecutionTime": 20.5,
      "maxExecutionTime": 250.1,
      "successRate": "100.00"
    },
    "redis": {
      "count": 7,
      "avgExecutionTime": 5.2,
      "minExecutionTime": 1.0,
      "maxExecutionTime": 15.8,
      "successRate": "71.43"
    }
  }
}
```

## GUI Features

### Query Executor Tab
- **Query Input**: Write and paste SQL/MongoDB queries
- **Database Selection**: Choose specific database or auto-select
- **Execute Button**: Run query on selected/optimal database
- **Test All DBs**: Compare performance across all three databases
- **Get Recommendation**: Get AI suggestion based on history

### History & Stats Tab
- **Performance Statistics**: Overall metrics by database
- **Query History**: Complete audit trail of all executions
- **Filters**: Search by query text, database, or time range

### Analytics Tab
- **Database Comparison**: Side-by-side performance metrics
- **Execution Time Analysis**: Average, min, max, and variance
- **Success Rates**: Query success percentage by database
- **Key Insights**: Automated recommendations based on data

## AI & Machine Learning

### How the Recommendation Engine Works

1. **Query Normalization**: Queries are normalized and hashed to identify patterns
2. **Historical Analysis**: System maintains a history of all executions with metrics
3. **Performance Scoring**: Each database is scored on:
   - Average execution time (40% weight)
   - Latency (30% weight)
   - CPU time (20% weight)
   - Metric stability/variance (10% weight)
4. **Confidence Calculation**: Based on number of historical executions
5. **Optimal Selection**: Returns the highest-scoring database with confidence level

### Learning Mechanism

- Executes new query types on all three databases initially
- Records comprehensive metrics for each execution
- Updates ML models with new data
- Improves recommendations with more execution history
- Uses weighted scoring to handle metric variance

## Query Examples

### MongoDB
```javascript
db.collection.find({status: "active"})
db.users.aggregate([{$match: {age: {$gt: 25}}}])
```

### PostgreSQL
```sql
SELECT * FROM users WHERE age > 25 ORDER BY created_at DESC LIMIT 10;
SELECT COUNT(*) FROM orders GROUP BY user_id;
```

### Redis
```
GET user:123:profile
HGETALL session:abc123
```

## Performance Optimization Tips

1. **Trust the AI**: Let the system choose for new query patterns
2. **Monitor Trends**: Check analytics for performance patterns
3. **Query Optimization**: Complex queries may benefit from specific databases
4. **Cache Keys**: Use Redis for frequently accessed, small datasets
5. **Aggregations**: PostgreSQL excels at complex JOIN operations
6. **Document Queries**: MongoDB is optimal for flexible JSON queries

## Data Storage

### Query History (`data/query_history.json`)
Stores up to 1000 most recent query executions with complete metrics.

### ML Models (`data/ml_models.json`)
Maintains:
- Query patterns with normalized text
- Last 100 executions per database per pattern
- Average metrics (mean, min, max, variance)
- Performance scoring cache

## Error Handling

- Database connection failures are gracefully handled
- Each database error is isolated; others continue executing
- Metrics are recorded even for failed queries
- Detailed error messages guide users to solutions

## Development

### Backend Structure
- **server.js**: Express app initialization and middleware setup
- **adapters/**: Database-specific query execution logic
- **services/**: Business logic (mediator, metrics, history)
- **routes/**: REST API endpoint definitions

### Frontend Structure
- **React Components**: Modular, reusable UI components
- **CSS Modules**: Scoped styling for isolation
- **Axios**: HTTP client for API communication
- **State Management**: React hooks for local state

## Future Enhancements

- [ ] Advanced query caching layer
- [ ] Real-time metrics dashboard
- [ ] Query optimization suggestions
- [ ] Multi-user support and authentication
- [ ] Custom ML model training
- [ ] Query cost estimation
- [ ] Distributed query execution
- [ ] GraphQL support

## License

MIT

## Support

For issues, questions, or suggestions, please open an issue in the repository.
