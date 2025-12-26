# System Architecture

## Overall System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Frontend (Port 5173)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  QueryMediator Component                                 │   │
│  │  ├─ Query Executor Tab                                   │   │
│  │  │  ├─ Query Input Textarea                              │   │
│  │  │  ├─ Database Selector (Auto/Mongo/PG/Redis)          │   │
│  │  │  ├─ Execute Button                                    │   │
│  │  │  ├─ Test All DBs Button                               │   │
│  │  │  └─ Get Recommendation Button                         │   │
│  │  ├─ History & Stats Tab                                  │   │
│  │  │  ├─ Performance Statistics Cards    SELECT * FROM accounts;                  │   │
│  │  │  └─ Query History List with Filters                  │   │
│  │  └─ Analytics Tab                                        │   │
│  │     ├─ Database Comparison Charts                        │   │
│  │     └─ Performance Insights                              │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/JSON (axios)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Express Backend (Port 5000)                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Route Layer (queryRoutes.js)                            │   │
│  │  ├─ POST /api/recommend                                  │   │
│  │  ├─ POST /api/execute                                    │   │
│  │  ├─ POST /api/execute-all                                │   │
│  │  ├─ GET  /api/history                                    │   │
│  │  ├─ GET  /api/stats                                      │   │
│  │  └─ GET  /api/analysis/:queryHash                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                     │
│  ┌──────────────────────────▼──────────────────────────────┐    │
│  │  Service Layer                                           │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │ Query Mediator (queryMediator.js)              │    │    │
│  │  │ ├─ Query routing logic                          │    │    │
│  │  │ ├─ Multi-database execution                     │    │    │
│  │  │ └─ Error handling & fallback                    │    │    │
│  │  └──────────┬──────────────────────────────────────┘    │    │
│  │             │                                            │    │
│  │  ┌──────────▼──────────────────────────────────────┐    │    │
│  │  │ Query History (queryHistory.js)                │    │    │
│  │  │ ├─ Store execution records                      │    │    │
│  │  │ ├─ ML Model Management                          │    │    │
│  │  │ ├─ Performance Analysis                         │    │    │
│  │  │ ├─ Query Pattern Hashing                        │    │    │
│  │  │ └─ Recommendation Engine                        │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                           │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │ Performance Metrics (performanceMetrics.js)    │    │    │
│  │  │ ├─ Execution time measurement                   │    │    │
│  │  │ ├─ CPU time tracking                            │    │    │
│  │  │ ├─ Latency monitoring                           │    │    │
│  │  │ └─ Memory usage tracking                        │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └──────────────────────────────────────────────────────────┘    │
│                             │                                     │
│  ┌──────────────────────────▼──────────────────────────────┐    │
│  │  Adapter Layer                                          │    │
│  │  ├─ MongoDB Adapter (mongoAdapter.js)                  │    │
│  │  ├─ PostgreSQL Adapter (postgresAdapter.js)            │    │
│  │  └─ Redis Adapter (redisAdapter.js)                    │    │
│  └──────────┬──────────────┬──────────────┬──────────────┘    │
│             │              │              │                     │
└─────────────┼──────────────┼──────────────┼─────────────────────┘
              │              │              │
              ▼              ▼              ▼
     ┌────────────────┐  ┌─────────────┐  ┌──────────────┐
     │   MongoDB      │  │ PostgreSQL  │  │    Redis     │
     │    Atlas       │  │   (Neon)    │  │  (Upstash)   │
     └────────────────┘  └─────────────┘  └──────────────┘
```

## Data Flow Diagram

```
User Input (Query)
       │
       ▼
┌─────────────────────┐
│ GUI Query Input     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ Select Execution Mode               │
├─────────────────────────────────────┤
│ 1. Auto (AI) │ 2. Specific │ 3. All │
└──────┬────────────┬─────────┬───────┘
       │            │         │
       ▼            ▼         ▼
   ┌───────────────────────────────────┐
   │ Query Mediator Service            │
   └───────────────────────────────────┘
       │        │        │
       ▼        ▼        ▼
   ┌──────┐┌──────┐┌──────┐
   │Mongo ││ PG   ││Redis │
   └──┬───┘└──┬───┘└──┬───┘
      │       │       │
      ▼       ▼       ▼
   [Execute Queries with Performance Tracking]
      │       │       │
      ▼       ▼       ▼
   ┌──────┐┌──────┐┌──────┐
   │Result││Result││Result│
   │+Perf ││+Perf ││+Perf │
   └──┬───┘└──┬───┘└──┬───┘
      │       │       │
      └───────┬───────┘
              ▼
    ┌──────────────────────┐
    │ Store in History     │
    │ Update ML Models     │
    │ Calculate Scores     │
    └──────────┬───────────┘
               ▼
    ┌──────────────────────┐
    │ Return Results +     │
    │ Metrics to Frontend  │
    └──────────┬───────────┘
               ▼
    ┌──────────────────────┐
    │ Display in GUI       │
    │ Show Metrics         │
    │ Render Charts        │
    └──────────────────────┘
```

## AI Recommendation Engine Flow

```
Query Received
      │
      ▼
┌──────────────────────────┐
│ Normalize & Hash Query   │
│ (Remove whitespace,      │
│  convert to lowercase)   │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Look up in Query Patterns    │
│ (ML Models)                  │
└──────────┬────────────┬──────┘
           │            │
    FOUND  │            │  NOT FOUND
           ▼            ▼
    ┌────────────┐  ┌──────────────────┐
    │ Analyze    │  │ Execute on ALL   │
    │ Historical │  │ Databases        │
    │ Metrics    │  │ (Initial Learn)  │
    └────┬───────┘  └────────┬─────────┘
         │                   │
         ▼                   ▼
    ┌────────────────────────────────┐
    │ Calculate Database Scores      │
    │ ├─ Exec Time: 40%              │
    │ ├─ Latency: 30%                │
    │ ├─ CPU Time: 20%               │
    │ └─ Stability: 10%              │
    └────────┬───────────────────────┘
             ▼
    ┌────────────────────────────────┐
    │ Calculate Confidence Level     │
    │ (Based on execution count)     │
    └────────┬───────────────────────┘
             ▼
    ┌────────────────────────────────┐
    │ Return Recommendation          │
    │ {                              │
    │   database: "postgres",        │
    │   scores: {...},               │
    │   confidence: 85.5%            │
    │ }                              │
    └────────────────────────────────┘
```

## ML Model Structure

```
ML Models JSON
│
├─ queryPatterns
│  │
│  ├─ q_12345 (Query Hash)
│  │  │
│  │  ├─ queryText: "SELECT * FROM users WHERE age > 25"
│  │  │
│  │  ├─ executions
│  │  │  │
│  │  │  ├─ mongo: [
│  │  │  │    {timestamp, metrics: {executionTime, latency, ...}},
│  │  │  │    {timestamp, metrics: {...}},
│  │  │  │    ... (last 100 executions)
│  │  │  │  ]
│  │  │  │
│  │  │  ├─ postgres: [...]
│  │  │  │
│  │  │  └─ redis: [...]
│  │  │
│  │  └─ averageMetrics
│  │     │
│  │     ├─ mongo: {
│  │     │    executionTime: {avg, min, max, variance},
│  │     │    latency: {...},
│  │     │    cpuTime: {...},
│  │     │    memoryUsed: {...}
│  │     │  }
│  │     │
│  │     ├─ postgres: {...}
│  │     │
│  │     └─ redis: {...}
│  │
│  ├─ q_67890: {...}
│  │
│  └─ ... (more query patterns)
│
└─ performanceCache (For fast lookups)
```

## Performance Metrics Pipeline

```
Query Execution Start
        │
        ▼
┌──────────────────┐
│ Start Timers     │
│ ├─ hrtime (CPU)  │
│ ├─ memory.now()  │
│ └─ timestamp     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Execute Query    │
│ on Database      │
└────────┬─────────┘
         │
         ▼
┌──────────────────────┐
│ Capture Result       │
│ ├─ Data rows        │
│ ├─ Error (if any)   │
│ └─ Status code      │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Stop Timers &        │
│ Calculate Metrics    │
│ ├─ executionTime    │
│ ├─ latency          │
│ ├─ cpuTime          │
│ └─ memoryUsed       │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Store Metrics in    │
│ Query History       │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Return Complete     │
│ Result Object       │
└──────────────────────┘
```

## File Structure

```
multistore-app/
│
├── .env.local                    # Environment credentials
├── .env.example                  # Example env file
├── README.md                     # Full documentation
├── QUICKSTART.md                 # Quick start guide
├── setup.sh                      # Setup script
│
├── backend/
│   ├── server.js                 # Express app
│   ├── package.json              # Backend dependencies
│   │
│   ├── config/
│   │   └── database.js           # DB connections
│   │
│   ├── adapters/
│   │   ├── mongoAdapter.js       # MongoDB queries
│   │   ├── postgresAdapter.js    # PostgreSQL queries
│   │   └── redisAdapter.js       # Redis commands
│   │
│   ├── services/
│   │   ├── queryMediator.js      # Main orchestrator
│   │   ├── performanceMetrics.js # Metrics tracking
│   │   └── queryHistory.js       # History & ML
│   │
│   └── routes/
│       └── queryRoutes.js        # API endpoints
│
├── frontend/
│   ├── src/
│   │   ├── index.jsx             # Entry point
│   │   │
│   │   └── components/
│   │       ├── QueryMediator.jsx # Main component
│   │       └── QueryMediator.css # Styling
│   │
│   ├── package.json              # Frontend dependencies
│   ├── vite.config.js            # Vite config
│   └── index.html                # HTML template
│
├── data/                         # Data storage (auto-created)
│   ├── query_history.json        # Query execution history
│   └── ml_models.json            # ML model data
│
└── package.json                  # Root config
```
