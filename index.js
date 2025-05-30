require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const generateEventIdeasRoutes = require('./routes/generateEventIdeas');

const app = express();
app.use(cors());
app.use(express.json());

// Health check route
app.get('/', (req, res) => {
  res.send('PTO Central Backend is running');
});

// Register routes
app.use('/auth', authRoutes);
app.use('/api/generate-event-ideas', generateEventIdeasRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
