const express = require('express');
const router = express.Router();
const { verifySupabaseToken } = require('../services/supabase');

router.get('/check', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const user = await verifySupabaseToken(token);
    res.status(200).json({ message: 'Token verified', user });
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized', details: err.message });
  }
});

module.exports = router;