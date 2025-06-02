const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const app = express();

// Middleware for all standard routes
app.use(cors());
app.use(express.json());

// Regular API routes
const signupRoutes = require('./routes/auth/signup');
app.use('/api/signup', signupRoutes);

// ⛔ Temporarily disable AI routes (missing OPENAI_API_KEY)
// const aiRoutes = require('./routes/ai')
// app.use('/api/ai', aiRoutes)

const stripeRoutes = require('./routes/stripe');
app.use('/api/stripe', stripeRoutes);

const eventRoutes = require('./routes/events');
app.use('/api/events', eventRoutes);

const testRoutes = require('./routes/test');
app.use('/api', testRoutes);

const fundraiserRoutes = require('./routes/fundraisers');
app.use('/api/fundraisers', fundraiserRoutes);

const budgetRoutes = require('./routes/budgets');
app.use('/api/budgets', budgetRoutes);

const messageRoutes = require('./routes/messages');
app.use('/api/messages', messageRoutes);

const teacherRoutes = require('./routes/teacherRequests');
app.use('/api/teacher-requests', teacherRoutes);

const documentsRoutes = require('./routes/documents');
app.use('/api/documents', documentsRoutes);

const sharedLibraryRoutes = require('./routes/sharedLibrary');
app.use('/api/shared-library', sharedLibraryRoutes);

const adminUsersRoutes = require('./routes/adminUsers');
app.use('/api/admin-users', adminUsersRoutes);

const profileRoutes = require('./routes/profiles');
app.use('/api/profiles', profileRoutes);

const notificationsRoutes = require('./routes/notifications');
app.use('/api/notifications', notificationsRoutes);

// ✅ New: Email Draft routes under communications
const emailDraftsRoutes = require('./routes/communications/emailDrafts');
app.use('/api/communications/email-drafts', emailDraftsRoutes);

// ✅ Stripe webhook must be loaded AFTER express.json is applied to all others
// 👉 Use express.raw() ONLY for this one route
const stripeWebhook = require('./routes/stripeWebhook');
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

// Optional: Basic status check
app.get('/', (req, res) => {
  res.send('PTO Connect API is running');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
