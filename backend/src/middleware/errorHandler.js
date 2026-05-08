/**
 * Error Handler Middleware
 * 
 * Centralized error handling middleware for Express.
 * Catches all errors and returns consistent error responses.
 */

import log from '../utils/logger.js';

/**
 * Error handler middleware
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const errorHandler = (err, req, res, next) => {
  console.log('\n🔥🔥🔥 GLOBAL ERROR HANDLER 🔥🔥🔥');

  console.error('👉 ERROR OBJECT:', err);
  console.error('👉 ERROR MESSAGE:', err.message);
  console.error('👉 ERROR STACK:', err.stack);
  console.error('👉 REQUEST PATH:', req.path);
  console.error('👉 METHOD:', req.method);
  console.error('👉 BODY:', req.body);

  const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;

  res.status(status).json({
    success: false,
    message: err.message,
  });
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route ${req.originalUrl} not found`);
  error.statusCode = 404;
  next(error);
};


