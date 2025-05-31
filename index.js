const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();

//Signup Routes
const signupRoutes = require('./routes/signup');
app.use('/api/signup', signupRoutes);

// Middleware
app.use(cors());
app.use(express.json());

// Stripe routes
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
