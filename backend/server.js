const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const queryRoutes = require('./routes/queryRoutes');
const adapterTestRoutes = require('./routes/adapterTestRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Multi-Store Query Mediator is running' });
});

// API Routes
app.use('/api', queryRoutes);
// Adapter test routes for benchmarking harness
app.use('/test', adapterTestRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);
  console.log(`💻 Health check: http://localhost:${PORT}/health\n`);
});
