/**
 * Global error handling middleware for the PTO Connect API
 * Catches all unhandled errors and formats them consistently
 */
export const globalErrorHandler = (err, req, res, next) => {
  // Log the error for debugging
  console.error(`❌ [${req.method}] ${req.originalUrl} - Error:`, {
    message: err.message,
    stack: err.stack,
    requestId: req.requestId,
    userId: req.user?.id,
    orgId: req.orgId,
    timestamp: new Date().toISOString()
  });

  // Determine error type and status code
  let statusCode = err.statusCode || err.status || 500;
  let errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  } else if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    message = 'Invalid or expired authentication token';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    errorCode = 'FORBIDDEN';
    message = 'Insufficient permissions to access this resource';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
  } else if (err.name === 'ConflictError') {
    statusCode = 409;
    errorCode = 'CONFLICT';
  } else if (err.name === 'TooManyRequestsError') {
    statusCode = 429;
    errorCode = 'RATE_LIMIT_EXCEEDED';
    message = 'Too many requests, please try again later';
  }

  // Handle Supabase/PostgreSQL errors
  if (err.code && err.code.startsWith('23')) {
    statusCode = 400;
    if (err.code === '23505') {
      errorCode = 'DUPLICATE_ENTRY';
      message = 'A record with this information already exists';
    } else if (err.code === '23503') {
      errorCode = 'FOREIGN_KEY_VIOLATION';
      message = 'Referenced record does not exist';
    } else if (err.code === '23514') {
      errorCode = 'CHECK_VIOLATION';
      message = 'Data violates database constraints';
    }
  }

  // Handle network/connection errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    statusCode = 503;
    errorCode = 'SERVICE_UNAVAILABLE';
    message = 'External service temporarily unavailable';
  }

  // Create error response
  const errorResponse = {
    code: errorCode,
    message: message,
    field: err.field || null,
    details: process.env.NODE_ENV === 'development' ? err.stack : null
  };

  // Add additional context for development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.debug = {
      originalError: err.name,
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
      endpoint: req.originalUrl,
      method: req.method
    };
  }

  // Send error response (will be standardized by responseStandardization middleware)
  res.status(statusCode).json(errorResponse);
};

/**
 * Async error wrapper to catch errors in async route handlers
 * Usage: router.get('/endpoint', asyncErrorHandler(async (req, res) => { ... }))
 */
export const asyncErrorHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 handler for undefined routes
 */
export const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  error.code = 'ROUTE_NOT_FOUND';
  next(error);
};

/**
 * Custom error classes for specific error types
 */
export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.code = 'VALIDATION_ERROR';
    this.field = field;
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized access') {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
    this.code = 'UNAUTHORIZED';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden access') {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
    this.code = 'FORBIDDEN';
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
    this.code = 'NOT_FOUND';
  }
}

export class ConflictError extends Error {
  constructor(message = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
    this.code = 'CONFLICT';
  }
}

export class TooManyRequestsError extends Error {
  constructor(message = 'Too many requests') {
    super(message);
    this.name = 'TooManyRequestsError';
    this.statusCode = 429;
    this.code = 'RATE_LIMIT_EXCEEDED';
  }
}

/**
 * Helper function to create and throw custom errors
 */
export const throwError = (statusCode, code, message, field = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.field = field;
  throw error;
};

console.log('[errorHandler.js] Global error handling middleware loaded');
