// Initialize environment FIRST (before any imports that need env vars)
import dotenv from 'dotenv'
dotenv.config()

// Debug: Check if environment variables are loading
console.log('🔍 Environment Debug:')
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Found ✅' : 'Missing ❌')
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Found ✅' : 'Missing ❌')
console.log('PORT:', process.env.PORT ? 'Found ✅' : 'Missing ❌')

import express from 'express'
import cors from 'cors'
import stripeWebhookHandler from './routes/stripe/webhook.js'

const app = express()

// CORS configuration for production deployment
const corsOptions = {
  origin: [
    'http://localhost:3001',                    // Local development
    'https://app.ptoconnect.com',              // Production Railway domain (main app)
    'https://www.ptoconnect.com',              // Production Railway domain (public site)
    'https://pto-connect-production.up.railway.app',  // Railway production domain
    'https://pto-connect-public-production.up.railway.app',  // Railway public site domain
    /^https:\/\/.*\.up\.railway\.app$/,        // All Railway deployments
    /^https:\/\/.*\.railway\.app$/             // Railway custom domains
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-supabase-auth']
}

// Import new middleware
import { standardizeResponse } from './routes/middleware/responseStandardization.js';
import { globalErrorHandler, notFoundHandler } from './routes/middleware/errorHandler.js';
import { setupDocumentation } from './routes/documentation.js';
import { authenticateApiKey } from './routes/middleware/apiKeyAuth.js';
import { smartRateLimit } from './routes/middleware/rateLimiting.js';
import { performanceMonitoring } from './routes/middleware/performanceMonitoring.js';
import { apiCache } from './routes/middleware/apiCaching.js';

// Global middleware
app.use(cors(corsOptions))
app.use(express.json())

// Apply security and performance middleware to all routes
app.use(performanceMonitoring) // Track all request performance
app.use(authenticateApiKey) // Support API key authentication
app.use(smartRateLimit) // Intelligent rate limiting
app.use(apiCache({ useMemoryFallback: true })) // API response caching
app.use(standardizeResponse) // Standardize all responses

// Routes
import signupRoutes from './routes/user/signup.js'
import authRoutes from './routes/auth/auth.js'
import profileRoutes from './routes/user/profile.js'
import adminUserRoutes from './routes/user/adminUser.js'
import adminPermissionRoutes from './routes/admin/organizationPermissions.js'

import stripeRoutes from './routes/stripe/stripe.js'
import getPricesRoute from './routes/stripe/getPrices.js' // ✅ NEW ROUTE

import eventRoutes from './routes/event/event.js'
import generateEventIdeaRoutes from './routes/event/generateEventIdea.js'

import fundraiserRoutes from './routes/fundraiser/fundraiser.js'
import budgetRoutes from './routes/budget/budget.js'
import budgetCategoryRoutes from './routes/budget/categories.js'
import expenseRoutes from './routes/expenses/expenses.js'
import reconciliationRoutes from './routes/budget/reconciliation.js'

import messageRoutes from './routes/communication/message.js'
import emailDraftRoutes from './routes/communication/emailDraft.js'
import communicationRoutes from './routes/communication/index.js'

import teacherRequestRoutes from './routes/teacher/teacherRequest.js'
import documentRoutes from './routes/document/document.js'
import sharedTemplateRoutes from './routes/shared/template.js'

import notificationRoutes from './routes/notification.js'
import testRoutes from './routes/ai/test.js'
import aiRoutes from './routes/ai/ai.js'
import apiKeyRoutes from './routes/apiKeys.js'
import monitoringRoutes from './routes/monitoring.js'
import enhancedFundraiserRoutes from './routes/fundraiser/enhanced-fundraiser.js'
import reportsRoutes from './src/routes/reports.js'

// API route registration
app.use('/api/signup', signupRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/profiles', profileRoutes)
app.use('/api/admin-users', adminUserRoutes)
app.use('/api/admin/organization-permissions', adminPermissionRoutes)
app.use('/api', apiKeyRoutes) // API key management routes
app.use('/api', monitoringRoutes) // Performance monitoring routes

app.use('/api/stripe', stripeRoutes)
app.use('/api/stripe', getPricesRoute) // ✅ Mount getPrices under /api/stripe

// Stripe webhook (must use raw body middleware)
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler)

app.use('/api/event', eventRoutes)
app.use('/api/event-ideas', generateEventIdeaRoutes)

app.use('/api/fundraiser', fundraiserRoutes)
app.use('/api/fundraiser', enhancedFundraiserRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/budget', budgetRoutes)
app.use('/api/budget/categories', budgetCategoryRoutes)
app.use('/api/budget/reconciliation', reconciliationRoutes)
app.use('/api/expenses', expenseRoutes)

app.use('/api/messages', messageRoutes)
app.use('/api/communications/email-drafts', emailDraftRoutes)
app.use('/api/communications', communicationRoutes)

app.use('/api/teacher-requests', teacherRequestRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/shared-library', sharedTemplateRoutes)
app.use('/api/notifications', notificationRoutes)

app.use('/api/test', testRoutes)
app.use('/api/ai', aiRoutes)

// Health check endpoints
app.get('/', (req, res) => {
  res.send('PTO Connect API is running')
})

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.3.0'
  })
})

// Setup API documentation
setupDocumentation(app)

// Error handling middleware (must be last)
app.use(notFoundHandler)
app.use(globalErrorHandler)

// Start server
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`)
  console.log(`📚 API Documentation available at: http://localhost:${PORT}/api/docs`)
  console.log(`🔍 Health check available at: http://localhost:${PORT}/api/health`)
})
