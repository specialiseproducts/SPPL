/**
 * Main Server File
 * 
 * Entry point for the Express backend application.
 * Sets up Express server, middleware, routes, and error handling.
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import log from './src/utils/logger.js';
import { errorHandler, notFoundHandler } from './src/middleware/errorHandler.js';

// Import routes
import authRoutes from './src/routes/auth.routes.js';
import employeeRoutes from './src/routes/employee.routes.js';
import expenseRoutes from './src/routes/expense.routes.js';
import purchaseRoutes from './src/routes/purchase.routes.js';
import salesForecastRoutes from './src/routes/salesForecast.routes.js';
import userRoutes from './src/routes/user.routes.js';
import accessControlRoutes from './src/routes/accessControl.routes.js';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

const defaultCorsOrigins = [
  'http://localhost:5173',
  'https://design-company-management-erp.vercel.app',
  'https://design-company-management-596vfvlx0.vercel.app',
];
const extraCorsOrigins = String(process.env.CORS_EXTRA_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const corsOrigins = [...defaultCorsOrigins, ...extraCorsOrigins];

// Middleware
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Request logging middleware
app.use((req, res, next) => {
  log.info(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/sales-forecasts', salesForecastRoutes);
app.use('/api/access-control', accessControlRoutes);

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  log.info(`Server is running on port ${PORT}`);
  log.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  log.info(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});


