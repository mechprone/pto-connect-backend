const express = require('express')
const cors = require('cors')
require('dotenv').config()

const app = express()

// ✅ Middleware FIRST
app.use(cors())
app.use(express.json())

// ✅ Routes after middleware
const signupRoutes = require('./routes/signup')
app.use('/api/signup', signupRoutes)

// ⛔ Temporarily disable AI routes (missing OPENAI_API_KEY)
// const aiRoutes = require('./routes/ai')
// app.use('/api/ai', aiRoutes)

// ⛔ Temporarily disable Stripe routes (missing STRIPE_SECRET_KEY)
// const stripeRoutes = require('./routes/stripe')
// app.use('/api/stripe', stripeRoutes)

// ✅ Events route (long-term secure implementation)
const eventRoutes = require('./routes/events')
app.use('/api/events', eventRoutes)

// ✅ Supabase test route
const testRoutes = require('./routes/test')
app.use('/api', testRoutes)

// Fundraisers route
const fundraiserRoutes = require('./routes/fundraisers')
app.use('/api/fundraisers', fundraiserRoutes)

// Budget routes
const budgetRoutes = require('./routes/budgets')
app.use('/api/budgets', budgetRoutes)

// Messages routes
const messageRoutes = require('./routes/messages')
app.use('/api/messages', messageRoutes)

// Teacher request routes
const teacherRoutes = require('./routes/teacherRequests')
app.use('/api/teacher-requests', teacherRoutes)

// Documents routes
const documentsRoutes = require('./routes/documents')
app.use('/api/documents', documentsRoutes)

// Shared library routes
const sharedLibraryRoutes = require('./routes/sharedLibrary')
app.use('/api/shared-library', sharedLibraryRoutes)

// Admin users routes
const adminUsersRoutes = require('./routes/adminUsers')
app.use('/api/admin-users', adminUsersRoutes)

// Optional: Basic status route
app.get('/', (req, res) => {
  res.send('PTO Connect API is running')
})

// Start server
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`)
})
