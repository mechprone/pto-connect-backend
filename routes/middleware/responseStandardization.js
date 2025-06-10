import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique request ID for tracking
 */
const generateRequestId = () => {
  return `req_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
};

/**
 * Middleware to standardize all API responses
 * Wraps responses in a consistent format with metadata
 */
export const standardizeResponse = (req, res, next) => {
  // Generate request ID for tracking
  req.requestId = req.requestId || generateRequestId();
  
  // Store original json method
  const originalJson = res.json;
  
  // Override res.json to apply standardization
  res.json = function(data) {
    const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
    
    // Handle different data types
    let responseData = null;
    let errors = null;
    
    if (isSuccess) {
      responseData = data;
    } else {
      // Handle error responses
      if (data && typeof data === 'object') {
        if (data.error || data.message) {
          // Single error object
          errors = [{
            code: data.code || 'UNKNOWN_ERROR',
            message: data.error || data.message || 'An error occurred',
            field: data.field || null,
            details: data.details || null
          }];
        } else if (Array.isArray(data)) {
          // Array of errors
          errors = data.map(err => ({
            code: err.code || 'UNKNOWN_ERROR',
            message: err.message || err.error || 'An error occurred',
            field: err.field || null,
            details: err.details || null
          }));
        } else {
          // Raw object as error
          errors = [{
            code: 'UNKNOWN_ERROR',
            message: JSON.stringify(data),
            field: null,
            details: null
          }];
        }
      } else if (typeof data === 'string') {
        // String error message
        errors = [{
          code: 'UNKNOWN_ERROR',
          message: data,
          field: null,
          details: null
        }];
      } else {
        // Fallback error
        errors = [{
          code: 'UNKNOWN_ERROR',
          message: 'An unexpected error occurred',
          field: null,
          details: null
        }];
      }
    }
    
    // Build standardized response
    const standardResponse = {
      success: isSuccess,
      data: responseData,
      meta: {
        timestamp: new Date().toISOString(),
        request_id: req.requestId,
        version: 'v1',
        endpoint: req.originalUrl,
        method: req.method
      },
      errors: errors
    };
    
    // Add pagination metadata if present
    if (responseData && typeof responseData === 'object' && responseData.pagination) {
      standardResponse.meta.pagination = responseData.pagination;
      // Remove pagination from data if it was added there
      if (responseData.data) {
        standardResponse.data = responseData.data;
      }
    }
    
    return originalJson.call(this, standardResponse);
  };
  
  next();
};

/**
 * Helper function to create paginated responses
 */
export const createPaginatedResponse = (data, pagination) => {
  return {
    data,
    pagination: {
      page: pagination.page || 1,
      limit: pagination.limit || 20,
      total: pagination.total || data.length,
      has_more: pagination.has_more || false,
      total_pages: pagination.total_pages || Math.ceil((pagination.total || data.length) / (pagination.limit || 20))
    }
  };
};

/**
 * Helper function to create error responses
 */
export const createErrorResponse = (code, message, field = null, details = null) => {
  return {
    code,
    message,
    field,
    details
  };
};

console.log('[responseStandardization.js] Response standardization middleware loaded');
