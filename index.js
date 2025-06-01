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

// Optional: Basic status route
app.get('/', (req, res) => {
  res.send('PTO Connect API is running')
})

// Start server
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`)
})
