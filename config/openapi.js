/**
 * OpenAPI 3.0 specification for PTO Connect API
 * Comprehensive documentation for all API endpoints
 */
export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'PTO Connect API',
    version: '1.3.0',
    description: `
# PTO Connect API Documentation

Welcome to the PTO Connect API! This comprehensive API enables Parent-Teacher Organizations (PTOs) to manage their operations efficiently through a modern, secure, and scalable platform.

## Features

- **Multi-tenant Architecture**: Secure organizational data isolation
- **Role-based Access Control**: Granular permission system with admin-configurable roles
- **Enterprise Performance**: Sub-10ms permission queries with advanced database optimization
- **Standardized Responses**: Consistent JSON response format across all endpoints
- **Comprehensive Validation**: Request/response validation with detailed error reporting
- **Real-time Monitoring**: Request tracking and performance metrics

## Authentication

All API endpoints require authentication using JWT tokens obtained through the Supabase authentication system. Include the token in the Authorization header:

\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Response Format

All API responses follow a standardized format:

\`\`\`json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2025-06-09T21:37:28.552Z",
    "request_id": "req_7b106dd23db8",
    "version": "v1",
    "endpoint": "/api/endpoint",
    "method": "GET"
  },
  "errors": null
}
\`\`\`

## Error Handling

Error responses include detailed information for debugging:

\`\`\`json
{
  "success": false,
  "data": null,
  "meta": {
    "timestamp": "2025-06-09T21:37:34.575Z",
    "request_id": "req_d55cc9ed768d",
    "version": "v1",
    "endpoint": "/api/endpoint",
    "method": "POST"
  },
  "errors": [
    {
      "code": "VALIDATION_ERROR",
      "message": "Invalid input data",
      "field": "email",
      "details": "Email format is invalid"
    }
  ]
}
\`\`\`
    `,
    contact: {
      name: 'PTO Connect Support',
      url: 'https://www.ptoconnect.com/support',
      email: 'support@ptoconnect.com'
    },
    license: {
      name: 'Proprietary',
      url: 'https://www.ptoconnect.com/terms'
    }
  },
  servers: [
    {
      url: 'https://api.ptoconnect.com',
      description: 'Production server'
    },
    {
      url: 'http://localhost:3000',
      description: 'Development server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from Supabase authentication'
      }
    },
    schemas: {
      // Standard response wrapper
      StandardResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Indicates if the request was successful'
          },
          data: {
            description: 'Response data (null for errors)'
          },
          meta: {
            type: 'object',
            properties: {
              timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'Response timestamp'
              },
              request_id: {
                type: 'string',
                description: 'Unique request identifier for tracking'
              },
              version: {
                type: 'string',
                description: 'API version'
              },
              endpoint: {
                type: 'string',
                description: 'Request endpoint'
              },
              method: {
                type: 'string',
                description: 'HTTP method used'
              },
              pagination: {
                $ref: '#/components/schemas/Pagination'
              }
            }
          },
          errors: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Error'
            },
            description: 'Array of errors (null for successful responses)'
          }
        }
      },
      
      // Error object
      Error: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Error code for programmatic handling'
          },
          message: {
            type: 'string',
            description: 'Human-readable error message'
          },
          field: {
            type: 'string',
            nullable: true,
            description: 'Field that caused the error (for validation errors)'
          },
          details: {
            type: 'string',
            nullable: true,
            description: 'Additional error details'
          }
        }
      },
      
      // Pagination object
      Pagination: {
        type: 'object',
        properties: {
          page: {
            type: 'integer',
            description: 'Current page number'
          },
          limit: {
            type: 'integer',
            description: 'Number of items per page'
          },
          total: {
            type: 'integer',
            description: 'Total number of items'
          },
          has_more: {
            type: 'boolean',
            description: 'Whether there are more pages available'
          },
          total_pages: {
            type: 'integer',
            description: 'Total number of pages'
          }
        }
      },
      
      // User profile
      UserProfile: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'User ID'
          },
          user_id: {
            type: 'string',
            format: 'uuid',
            description: 'Supabase user ID'
          },
          org_id: {
            type: 'string',
            format: 'uuid',
            description: 'Organization ID'
          },
          first_name: {
            type: 'string',
            description: 'User first name'
          },
          last_name: {
            type: 'string',
            description: 'User last name'
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          phone: {
            type: 'string',
            nullable: true,
            description: 'User phone number'
          },
          role: {
            type: 'string',
            enum: ['volunteer', 'committee_lead', 'board_member', 'admin'],
            description: 'User role in the organization'
          },
          children: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Child'
            },
            description: 'User children information'
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            description: 'Account creation timestamp'
          },
          updated_at: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp'
          }
        }
      },
      
      // Child information
      Child: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Child name'
          },
          grade: {
            type: 'string',
            description: 'Child grade level'
          },
          teacher: {
            type: 'string',
            nullable: true,
            description: 'Child teacher name'
          }
        }
      },
      
      // Organization
      Organization: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Organization ID'
          },
          name: {
            type: 'string',
            description: 'Organization name'
          },
          type: {
            type: 'string',
            description: 'Organization type (PTO, PTA, etc.)'
          },
          subscription_status: {
            type: 'string',
            enum: ['trial', 'active', 'cancelled', 'expired'],
            description: 'Subscription status'
          },
          trial_ends_at: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Trial end date'
          }
        }
      },
      
      // Event
      Event: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Event ID'
          },
          title: {
            type: 'string',
            description: 'Event title'
          },
          description: {
            type: 'string',
            nullable: true,
            description: 'Event description'
          },
          event_date: {
            type: 'string',
            format: 'date',
            description: 'Event date'
          },
          start_time: {
            type: 'string',
            pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$',
            nullable: true,
            description: 'Event start time (HH:MM format)'
          },
          end_time: {
            type: 'string',
            pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$',
            nullable: true,
            description: 'Event end time (HH:MM format)'
          },
          location: {
            type: 'string',
            nullable: true,
            description: 'Event location'
          },
          category: {
            type: 'string',
            enum: ['fundraiser', 'meeting', 'volunteer', 'social', 'educational', 'other'],
            description: 'Event category'
          },
          school_level: {
            type: 'string',
            enum: ['elementary', 'middle', 'high', 'all'],
            description: 'Target school level'
          },
          estimated_budget: {
            type: 'number',
            nullable: true,
            description: 'Estimated budget for the event'
          },
          share_public: {
            type: 'boolean',
            description: 'Whether the event is publicly visible'
          },
          tasks: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'List of tasks for the event'
          },
          volunteer_roles: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/VolunteerRole'
            },
            description: 'Volunteer roles needed for the event'
          },
          materials_needed: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Materials needed for the event'
          },
          created_by: {
            type: 'string',
            format: 'uuid',
            description: 'ID of user who created the event'
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            description: 'Event creation timestamp'
          }
        }
      },
      
      // Volunteer role
      VolunteerRole: {
        type: 'object',
        properties: {
          role: {
            type: 'string',
            description: 'Role name'
          },
          count: {
            type: 'integer',
            minimum: 1,
            description: 'Number of volunteers needed'
          },
          description: {
            type: 'string',
            nullable: true,
            description: 'Role description'
          }
        }
      },
      
      // Permission template
      PermissionTemplate: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Template ID'
          },
          permission_key: {
            type: 'string',
            description: 'Unique permission identifier'
          },
          module_name: {
            type: 'string',
            description: 'Module this permission belongs to'
          },
          permission_name: {
            type: 'string',
            description: 'Human-readable permission name'
          },
          description: {
            type: 'string',
            description: 'Permission description'
          },
          default_min_role: {
            type: 'string',
            enum: ['volunteer', 'committee_lead', 'board_member', 'admin'],
            description: 'Default minimum role required'
          }
        }
      }
    },
    responses: {
      // Standard success response
      Success: {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/StandardResponse'
            }
          }
        }
      },
      
      // Standard error responses
      BadRequest: {
        description: 'Bad request - validation error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/StandardResponse'
            },
            example: {
              success: false,
              data: null,
              meta: {
                timestamp: '2025-06-09T21:37:34.575Z',
                request_id: 'req_abc123',
                version: 'v1',
                endpoint: '/api/endpoint',
                method: 'POST'
              },
              errors: [
                {
                  code: 'VALIDATION_ERROR',
                  message: 'Invalid input data',
                  field: 'email',
                  details: 'Email format is invalid'
                }
              ]
            }
          }
        }
      },
      
      Unauthorized: {
        description: 'Unauthorized - invalid or missing authentication',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/StandardResponse'
            },
            example: {
              success: false,
              data: null,
              meta: {
                timestamp: '2025-06-09T21:37:34.575Z',
                request_id: 'req_abc123',
                version: 'v1',
                endpoint: '/api/endpoint',
                method: 'GET'
              },
              errors: [
                {
                  code: 'UNAUTHORIZED',
                  message: 'Invalid or expired authentication token',
                  field: null,
                  details: null
                }
              ]
            }
          }
        }
      },
      
      Forbidden: {
        description: 'Forbidden - insufficient permissions',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/StandardResponse'
            },
            example: {
              success: false,
              data: null,
              meta: {
                timestamp: '2025-06-09T21:37:34.575Z',
                request_id: 'req_abc123',
                version: 'v1',
                endpoint: '/api/endpoint',
                method: 'POST'
              },
              errors: [
                {
                  code: 'FORBIDDEN',
                  message: 'Insufficient permissions to access this resource',
                  field: null,
                  details: null
                }
              ]
            }
          }
        }
      },
      
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/StandardResponse'
            },
            example: {
              success: false,
              data: null,
              meta: {
                timestamp: '2025-06-09T21:37:34.575Z',
                request_id: 'req_abc123',
                version: 'v1',
                endpoint: '/api/endpoint/123',
                method: 'GET'
              },
              errors: [
                {
                  code: 'NOT_FOUND',
                  message: 'Resource not found',
                  field: null,
                  details: null
                }
              ]
            }
          }
        }
      },
      
      InternalServerError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/StandardResponse'
            },
            example: {
              success: false,
              data: null,
              meta: {
                timestamp: '2025-06-09T21:37:34.575Z',
                request_id: 'req_abc123',
                version: 'v1',
                endpoint: '/api/endpoint',
                method: 'POST'
              },
              errors: [
                {
                  code: 'INTERNAL_SERVER_ERROR',
                  message: 'An unexpected error occurred',
                  field: null,
                  details: null
                }
              ]
            }
          }
        }
      }
    },
    parameters: {
      // Common parameters
      PageParam: {
        name: 'page',
        in: 'query',
        description: 'Page number for pagination',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          default: 1
        }
      },
      
      LimitParam: {
        name: 'limit',
        in: 'query',
        description: 'Number of items per page',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20
        }
      },
      
      SortParam: {
        name: 'sort',
        in: 'query',
        description: 'Sort order',
        required: false,
        schema: {
          type: 'string',
          enum: ['asc', 'desc'],
          default: 'asc'
        }
      },
      
      SortByParam: {
        name: 'sort_by',
        in: 'query',
        description: 'Field to sort by',
        required: false,
        schema: {
          type: 'string',
          default: 'created_at'
        }
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and profile management'
    },
    {
      name: 'Admin',
      description: 'Administrative functions and permission management'
    },
    {
      name: 'Events',
      description: 'Event management and coordination'
    },
    {
      name: 'Communication',
      description: 'Messaging and notification systems'
    },
    {
      name: 'Budget',
      description: 'Financial management and budget tracking'
    },
    {
      name: 'Documents',
      description: 'Document storage and sharing'
    },
    {
      name: 'Utility',
      description: 'System utilities and health checks'
    }
  ],
  paths: {
    '/api/health': {
      get: {
        tags: ['Utility'],
        summary: 'Health Check',
        description: 'Check the health status of the API server',
        responses: {
          '200': {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/StandardResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            status: { type: 'string', example: 'healthy' },
                            timestamp: { type: 'string', format: 'date-time' },
                            uptime: { type: 'number', example: 84.2027995 },
                            environment: { type: 'string', example: 'development' },
                            version: { type: 'string', example: '1.3.0' }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    '/api/auth/check': {
      get: {
        tags: ['Authentication'],
        summary: 'Verify JWT Token',
        description: 'Verify the validity of a JWT authentication token',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Token is valid',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/StandardResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            message: { type: 'string', example: 'Token verified' },
                            user: { $ref: '#/components/schemas/UserProfile' }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/api/auth/profile': {
      get: {
        tags: ['Authentication'],
        summary: 'Get User Profile',
        description: 'Get the current user profile with organizational context',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Profile retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/StandardResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            message: { type: 'string', example: 'Profile retrieved successfully' },
                            profile: { $ref: '#/components/schemas/UserProfile' },
                            organization: { $ref: '#/components/schemas/Organization' }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      },
      patch: {
        tags: ['Authentication'],
        summary: 'Update User Profile',
        description: 'Update the current user profile information',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  first_name: { type: 'string', example: 'John' },
                  last_name: { type: 'string', example: 'Doe' },
                  phone: { type: 'string', example: '+1-555-123-4567' },
                  children: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Child' }
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Profile updated successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/StandardResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            message: { type: 'string', example: 'Profile updated successfully' },
                            profile: { $ref: '#/components/schemas/UserProfile' }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/api/event': {
      get: {
        tags: ['Events'],
        summary: 'Get All Events',
        description: 'Get all events for the user\'s organization',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Events retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/StandardResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Event' }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      },
      post: {
        tags: ['Events'],
        summary: 'Create New Event',
        description: 'Create a new event (requires committee lead or higher permissions)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'event_date', 'category', 'school_level'],
                properties: {
                  title: { type: 'string', example: 'Spring Fundraiser' },
                  description: { type: 'string', example: 'Annual spring fundraising event' },
                  event_date: { type: 'string', format: 'date', example: '2025-04-15' },
                  start_time: { type: 'string', pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$', example: '18:00' },
                  end_time: { type: 'string', pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$', example: '20:00' },
                  location: { type: 'string', example: 'School Gymnasium' },
                  category: { 
                    type: 'string', 
                    enum: ['fundraiser', 'meeting', 'volunteer', 'social', 'educational', 'other'],
                    example: 'fundraiser'
                  },
                  school_level: { 
                    type: 'string', 
                    enum: ['elementary', 'middle', 'high', 'all'],
                    example: 'elementary'
                  },
                  estimated_budget: { type: 'number', example: 500.00 },
                  share_public: { type: 'boolean', example: true },
                  tasks: { type: 'array', items: { type: 'string' } },
                  volunteer_roles: { 
                    type: 'array', 
                    items: { $ref: '#/components/schemas/VolunteerRole' }
                  },
                  materials_needed: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Event created successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/StandardResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/Event' }
                      }
                    }
                  ]
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/api/event/{id}': {
      delete: {
        tags: ['Events'],
        summary: 'Delete Event',
        description: 'Delete an event by ID (requires committee lead or higher permissions)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'Event ID'
          }
        ],
        responses: {
          '204': {
            description: 'Event deleted successfully'
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    }
  }
};

console.log('[openapi.js] OpenAPI specification loaded');
