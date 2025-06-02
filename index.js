const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const app = express();

// Middleware for all standard routes
app.use(cors());
app.use(express.json());

// --- Auth Routes ---
const signupRoutes = require('./routes/auth/signup');
app.use('/api/signup', signupRoutes);

// --- Stripe & Webhook ---
const stripeRoutes = require('./routes/stripe');
app.use('/api/stripe', stripeRoutes);

const stripeWebhook = require('./routes/stripe/webhook');
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

// --- Events ---
const eventRoutes = require('./routes/events/events');
app.use('/api/events', eventRoutes);

// --- Fundraisers ---
const fundraiserRoutes = require('./routes/fundraisers/fundraisers');
app.use('/api/fundraisers', fundraiserRoutes);

// --- Budgets ---
const budgetRoutes = require('./routes/budgets/budgets');
app.use('/api/budgets', budgetRoutes);

// --- Communications ---
const messageRoutes = require('./routes/communications/messages');
app.use('/api/messages', messageRoutes);

const emailDraftsRoutes = require('./routes/communications/emailDrafts');
app.use('/api/communications/email-drafts', emailDraftsRoutes);

// --- Teacher Requests ---
const teacherRoutes = require('./routes/teacherRequests/teacherRequests');
app.use('/api/teacher-requests', teacherRoutes);

// --- Documents ---
const documentsRoutes = require('./routes/documents/documents');
app.use('/api/documents', documentsRoutes);

// --- Shared Library ---
const sharedLibraryRoutes = require('./routes/sharedLibrary/sharedLibrary');
app.use('/api/shared-library', sharedLibraryRoutes);

// --- Admin Tools ---
const adminUsersRoutes = require('./routes/admin/adminUsers');
app.use('/api/admin-users', adminUsersRoutes);

// --- Profiles ---
const profileRoutes = require('./routes/users/profiles');
app.use('/api/profiles', profileRoutes);

// --- Notifications ---
const notificationsRoutes = require('./routes/notifications/notifications');
app.use('/api/notifications', notificationsRoutes);

// --- Dev & Testing ---
const testRoutes = require('./routes/test/test');
app.use('/api', testRoutes);

// Optional: Basic status check
app.get('/', (req, res) => {
  res.send('PTO Connect API is running');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
