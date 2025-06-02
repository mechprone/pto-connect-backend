const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// --- Auth & User Routes ---
const signupRoutes = require('./routes/users/signup');
const authRoutes = require('./routes/users/auth');
const profileRoutes = require('./routes/users/profiles');
const adminUsersRoutes = require('./routes/users/adminUsers');

app.use('/api/signup', signupRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/admin-users', adminUsersRoutes);

// --- Billing & Stripe ---
const stripeRoutes = require('./routes/billing/stripe');
const stripeWebhook = require('./routes/billing/stripeWebhook');

app.use('/api/stripe', stripeRoutes);
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

// --- Events ---
const eventRoutes = require('./routes/events/events');
const generateIdeasRoutes = require('./routes/events/generateEventIdeas');

app.use('/api/events', eventRoutes);
app.use('/api/event-ideas', generateIdeasRoutes);

// --- Fundraisers ---
const fundraiserRoutes = require('./routes/fundraisers/fundraisers');
app.use('/api/fundraisers', fundraiserRoutes);

// --- Budgets ---
const budgetRoutes = require('./routes/budgets/budgets');
app.use('/api/budgets', budgetRoutes);

// --- Communications ---
const messageRoutes = require('./routes/communications/messages');
const emailDraftsRoutes = require('./routes/communications/emailDrafts');

app.use('/api/messages', messageRoutes);
app.use('/api/communications/email-drafts', emailDraftsRoutes);

// --- Teacher Requests ---
const teacherRoutes = require('./routes/teacher/teacherRequests');
app.use('/api/teacher-requests', teacherRoutes);

// --- Documents ---
const documentsRoutes = require('./routes/documents/documents');
app.use('/api/documents', documentsRoutes);

// --- Shared Library ---
const sharedLibraryRoutes = require('./routes/sharedLibrary/sharedLibrary');
app.use('/api/shared-library', sharedLibraryRoutes);

// --- Notifications ---
const notificationsRoutes = require('./routes/notifications/notifications');
app.use('/api/notifications', notificationsRoutes);

// --- Dev / Test ---
const testRoutes = require('./routes/test/test');
app.use('/api/test', testRoutes);

// --- Root status ---
app.get('/', (req, res) => {
  res.send('PTO Connect API is running');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
