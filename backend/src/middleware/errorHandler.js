/**
 * Error Handler Middleware — structured logging for production observability.
 */

import { logErrorStructured } from '../utils/structuredLog.js';

export const errorHandler = (err, req, res, next) => {
  const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;

  logErrorStructured('api_error', err, {
    method: req.method,
    path: req.originalUrl?.split('?')[0] || req.path,
    statusCode: status,
    employeeCode: req.user?.employeeCode,
  });

  const message = err.message || 'Internal server error';

  res.status(status).json({
    success: false,
    message,
    error: message,
    code: err.code || undefined,
  });
};

export const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route ${req.originalUrl} not found`);
  error.statusCode = 404;
  next(error);
};
