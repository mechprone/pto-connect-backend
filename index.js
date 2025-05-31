const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ✅ Middleware FIRST
app.use(cors());
app.use(express.json());

// ✅ Routes after middleware
const signupRoutes = require('./routes/signup');
app.use('/api/signup', signupRoutes);

const aiRoutes = require('./routes/ai');
app.use('/api/ai', aiRoutes);

const stripeRoutes = require('./routes/stripe');
app.use('/api/stripe', stripeRoutes);

// Optional: Basic status route
app.get('/', (req, res) => {
  res.send('PTO Connect API is running');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
