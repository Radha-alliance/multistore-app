import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { QueryMediator } from './mediator/QueryMediator';
import queryRoutes from './routes/queryRoutes';

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize QueryMediator
const mediator = new QueryMediator();

// Make mediator available to routes
app.locals.mediator = mediator;

// Routes
app.use('/api', queryRoutes);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API endpoints:`);
  console.log(`  POST /api/query - Execute on all databases (learning)`);
  console.log(`  POST /api/query-optimized - Execute on best database (optimized)`);
  console.log(`  GET /api/metrics/:queryHash - Get metrics for a query`);
  console.log(`  GET /api/analytics - Get all analytics`);
});

export default app;
