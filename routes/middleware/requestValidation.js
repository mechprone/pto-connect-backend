import Joi from 'joi';

/**
 * Middleware factory to validate request data using Joi schemas
 * @param {Object} schemas - Object containing validation schemas for different parts of the request
 * @param {Joi.Schema} schemas.body - Schema for request body validation
 * @param {Joi.Schema} schemas.query - Schema for query parameters validation
 * @param {Joi.Schema} schemas.params - Schema for URL parameters validation
 */
export const validateRequest = (schemas = {}) => {
  return (req, res, next) => {
    const errors = [];

    // Validate request body
    if (schemas.body && req.body) {
      const { error } = schemas.body.validate(req.body, { abortEarly: false });
      if (error) {
        error.details.forEach(detail => {
          errors.push({
            code: 'VALIDATION_ERROR',
            message: detail.message,
            field: detail.path.join('.'),
            details: `Invalid value: ${JSON.stringify(detail.context.value)}`
          });
        });
      }
    }

    // Validate query parameters
    if (schemas.query && req.query) {
      const { error } = schemas.query.validate(req.query, { abortEarly: false });
      if (error) {
        error.details.forEach(detail => {
          errors.push({
            code: 'VALIDATION_ERROR',
            message: detail.message,
            field: `query.${detail.path.join('.')}`,
            details: `Invalid query parameter: ${JSON.stringify(detail.context.value)}`
          });
        });
      }
    }

    // Validate URL parameters
    if (schemas.params && req.params) {
      const { error } = schemas.params.validate(req.params, { abortEarly: false });
      if (error) {
        error.details.forEach(detail => {
          errors.push({
            code: 'VALIDATION_ERROR',
            message: detail.message,
            field: `params.${detail.path.join('.')}`,
            details: `Invalid URL parameter: ${JSON.stringify(detail.context.value)}`
          });
        });
      }
    }

    // If validation errors exist, return them
    if (errors.length > 0) {
      return res.status(400).json(errors);
    }

    next();
  };
};

/**
 * Common validation schemas for reuse across endpoints
 */
export const commonSchemas = {
  // UUID validation
  uuid: Joi.string().uuid().required(),
  
  // Pagination parameters
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().valid('asc', 'desc').default('asc'),
    sort_by: Joi.string().default('created_at')
  }),

  // Organization ID (required in most endpoints)
  orgId: Joi.string().uuid().required(),

  // User profile fields
  userProfile: {
    first_name: Joi.string().min(1).max(50).required(),
    last_name: Joi.string().min(1).max(50).required(),
    phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).allow('', null),
    children: Joi.array().items(Joi.object({
      name: Joi.string().min(1).max(100).required(),
      grade: Joi.string().min(1).max(20).required(),
      teacher: Joi.string().min(1).max(100).allow('', null)
    })).default([])
  },

  // Event validation
  event: {
    title: Joi.string().min(1).max(200).required(),
    description: Joi.string().max(2000).allow('', null),
    event_date: Joi.date().iso().required(),
    category: Joi.string().valid(
      'fundraiser', 'meeting', 'volunteer', 'social', 'educational', 'other'
    ).required(),
    school_level: Joi.string().valid(
      'elementary', 'middle', 'high', 'all'
    ).default('all'),
    location: Joi.string().max(200).allow('', null),
    estimated_budget: Joi.number().min(0).allow(null),
    start_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).allow('', null),
    end_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).allow('', null),
    share_public: Joi.boolean().default(false),
    tasks: Joi.array().items(Joi.string().max(500)).default([]),
    volunteer_roles: Joi.array().items(Joi.object({
      role: Joi.string().max(100).required(),
      count: Joi.number().integer().min(1).required(),
      description: Joi.string().max(500).allow('', null)
    })).default([]),
    materials_needed: Joi.array().items(Joi.string().max(200)).default([])
  },

  // Budget validation
  budget: {
    category: Joi.string().min(1).max(100).required(),
    description: Joi.string().max(500).allow('', null),
    amount: Joi.number().required(),
    type: Joi.string().valid('income', 'expense').required(),
    date: Joi.date().iso().required(),
    approved: Joi.boolean().default(false),
    receipt_url: Joi.string().uri().allow('', null)
  },

  // Message validation
  message: {
    title: Joi.string().min(1).max(200).required(),
    content: Joi.string().min(1).max(5000).required(),
    priority: Joi.string().valid('low', 'normal', 'high', 'urgent').default('normal'),
    target_audience: Joi.string().valid(
      'all', 'volunteers', 'committee_leads', 'board_members', 'admins'
    ).default('all'),
    send_email: Joi.boolean().default(false),
    send_sms: Joi.boolean().default(false),
    scheduled_for: Joi.date().iso().allow(null)
  },

  // Permission validation
  permission: {
    permission_key: Joi.string().min(1).max(100).required(),
    min_role_required: Joi.string().valid(
      'volunteer', 'committee_lead', 'board_member', 'admin'
    ).required(),
    specific_users: Joi.array().items(Joi.string().uuid()).default([]),
    is_enabled: Joi.boolean().default(true)
  }
};

/**
 * Validation schema for bulk operations
 */
export const bulkValidation = {
  permissions: Joi.array().items(Joi.object(commonSchemas.permission)).min(1).required()
};

/**
 * Helper function to create custom validation middleware for specific endpoints
 */
export const createValidation = (bodySchema, querySchema = null, paramsSchema = null) => {
  return validateRequest({
    body: bodySchema ? Joi.object(bodySchema) : null,
    query: querySchema ? Joi.object(querySchema) : null,
    params: paramsSchema ? Joi.object(paramsSchema) : null
  });
};

console.log('[requestValidation.js] Request validation middleware loaded');
