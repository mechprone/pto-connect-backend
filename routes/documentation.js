import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from '../config/openapi.js';

/**
 * Setup Swagger UI documentation for the API
 * Provides interactive API documentation at /api/docs
 */
export const setupDocumentation = (app) => {
  // Custom CSS for better styling
  const customCss = `
    .swagger-ui .topbar { 
      display: none; 
    }
    .swagger-ui .info .title {
      color: #2563eb;
    }
    .swagger-ui .scheme-container {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      margin: 16px 0;
    }
    .swagger-ui .btn.authorize {
      background-color: #2563eb;
      border-color: #2563eb;
    }
    .swagger-ui .btn.authorize:hover {
      background-color: #1d4ed8;
      border-color: #1d4ed8;
    }
    .swagger-ui .opblock.opblock-get .opblock-summary {
      border-color: #10b981;
    }
    .swagger-ui .opblock.opblock-post .opblock-summary {
      border-color: #3b82f6;
    }
    .swagger-ui .opblock.opblock-put .opblock-summary {
      border-color: #f59e0b;
    }
    .swagger-ui .opblock.opblock-delete .opblock-summary {
      border-color: #ef4444;
    }
  `;

  // Swagger UI options
  const swaggerOptions = {
    explorer: true,
    customCss: customCss,
    customSiteTitle: 'PTO Connect API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true
    }
  };

  // Serve raw OpenAPI spec as JSON (must be before Swagger UI)
  app.get('/api/docs/openapi.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(openApiSpec);
  });

  // Serve raw OpenAPI spec as YAML (must be before Swagger UI)
  app.get('/api/docs/openapi.yaml', (req, res) => {
    const yaml = require('js-yaml');
    res.setHeader('Content-Type', 'text/yaml');
    res.send(yaml.dump(openApiSpec));
  });

  // Serve Swagger UI (must be last to avoid conflicts)
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, swaggerOptions));

  console.log('📚 API Documentation setup complete');
  console.log('   - Interactive docs: /api/docs');
  console.log('   - OpenAPI JSON: /api/docs/openapi.json');
  console.log('   - OpenAPI YAML: /api/docs/openapi.yaml');
};

/**
 * Generate OpenAPI paths for existing routes
 * This function can be used to automatically generate documentation
 * for routes that don't have manual documentation yet
 */
export const generatePathsFromRoutes = (app) => {
  const paths = {};
  
  // Extract routes from Express app
  const routes = [];
  app._router.stack.forEach(middleware => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach(handler => {
        if (handler.route) {
          routes.push({
            path: handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });

  // Generate basic OpenAPI paths
  routes.forEach(route => {
    if (!paths[route.path]) {
      paths[route.path] = {};
    }
    
    route.methods.forEach(method => {
      if (method !== '_all') {
        paths[route.path][method.toLowerCase()] = {
          summary: `${method.toUpperCase()} ${route.path}`,
          description: `Auto-generated documentation for ${method.toUpperCase()} ${route.path}`,
          responses: {
            '200': {
              $ref: '#/components/responses/Success'
            },
            '400': {
              $ref: '#/components/responses/BadRequest'
            },
            '401': {
              $ref: '#/components/responses/Unauthorized'
            },
            '403': {
              $ref: '#/components/responses/Forbidden'
            },
            '404': {
              $ref: '#/components/responses/NotFound'
            },
            '500': {
              $ref: '#/components/responses/InternalServerError'
            }
          }
        };
      }
    });
  });

  return paths;
};

console.log('[documentation.js] API documentation routes loaded');
