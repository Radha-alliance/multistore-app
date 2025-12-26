# 🚀 Quick Start Guide

## ⚡ Fastest Way to Get Started

### 1. One-Command Setup
```bash
chmod +x setup.sh && ./setup.sh
```

### 2. Start Development Mode
```bash
npm run dev
```

This will start:
- **Backend**: http://localhost:5000
- **Frontend**: http://localhost:5173

## 📝 First Steps

1. **Open the GUI**: Navigate to `http://localhost:5173`
2. **Execute a Query**: Try these examples:

   **MongoDB** (for sample_mflix database):
   ```javascript
   db.movies.find({}).limit(5)
   ```

   **PostgreSQL**:
   ```sql
   SELECT * FROM information_schema.tables LIMIT 5;
   ```

   **Redis**:
   ```
   KEYS *
   ```

3. **Click "Test All DBs"**: Compare performance across all three databases
4. **View Analytics**: Check the "Analytics" tab to see performance insights
5. **Let AI Recommend**: Use "Get Recommendation" button for optimal database selection

## 🎯 Key Features

### Query Execution Tab
- ✅ Execute queries on specific or auto-selected databases
- ✅ Real-time performance metrics display
- ✅ Get AI recommendations based on query history
- ✅ Compare performance across all databases

### History & Stats Tab
- 📊 View all executed queries with metrics
- 📈 Database performance statistics
- 🔍 Search and filter query history
- 📉 Success rates by database

### Analytics Tab
- 🎯 Side-by-side database comparison
- ⏱️ Execution time analysis
- 💡 AI-powered insights and recommendations

## 🤖 How the AI Works

1. **First Execution**: New query types run on all databases
2. **Learning**: System records execution time, latency, CPU, and memory
3. **Optimization**: AI learns which database performs best for each query pattern
4. **Prediction**: Next time, it automatically selects the optimal database

## 📊 Performance Metrics Tracked

- ⏱️ **Execution Time**: Total query duration (ms)
- 📡 **Latency**: Network round-trip time (ms)
- 🔧 **CPU Time**: Processor time used (ms)
- 💾 **Memory Used**: RAM consumption (bytes)

## 🔧 Environment Setup

Database credentials are in `.env.local`:
- ✅ MongoDB Atlas
- ✅ PostgreSQL (Neon)
- ✅ Redis (Upstash)

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Change frontend port in frontend/vite.config.js
# Change backend port in backend/server.js
```

### Database Connection Issues
- Verify `.env.local` has correct credentials
- Check network/firewall allows connection to databases
- Review backend console for specific error messages

### Frontend Not Loading
```bash
# Clear cache and reinstall
rm -rf frontend/node_modules
npm install
```

## 📚 API Endpoints

### Get Recommendations
```bash
curl -X POST http://localhost:5000/api/recommend \
  -H "Content-Type: application/json" \
  -d '{"queryText":"SELECT * FROM users LIMIT 10"}'
```

### Execute Query
```bash
curl -X POST http://localhost:5000/api/execute \
  -H "Content-Type: application/json" \
  -d '{"queryText":"SELECT * FROM users LIMIT 10"}'
```

### Get Statistics
```bash
curl http://localhost:5000/api/stats
```

### Get History
```bash
curl http://localhost:5000/api/history
```

## 🎉 Next Steps

1. Execute different query types
2. Watch the AI learn and improve
3. Check analytics to understand performance patterns
4. Experiment with "Test All DBs" to see real-time comparisons
5. Review history to optimize your queries

Enjoy! 🚀
