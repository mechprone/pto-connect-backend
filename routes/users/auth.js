const express = require('express')
const router = express.Router()
const { verifySupabaseToken } = require('../../services/supabase')

// 🔐 Token validity check endpoint
router.get('/check', async (req, res) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed auth token' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const user = await verifySupabaseToken(token)
    res.status(200).json({
      message: 'Token verified',
      user
    })
  } catch (err) {
    res.status(401).json({
      error: 'Unauthorized',
      details: err.message
    })
  }
})

module.exports = router
