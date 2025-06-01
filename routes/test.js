const express = require('express')
const router = express.Router()
const { supabase, verifySupabaseToken } = require('../services/supabase')

// GET /api/test-supabase
router.get('/test-supabase', async (req, res) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null

  try {
    // Optional: require token to access this endpoint
    if (!token) return res.status(401).json({ error: 'Missing token' })

    const user = await verifySupabaseToken(token)

    // Optional: allow only specific roles
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: admin only' })
    }

    const { data, error } = await supabase.auth.admin.listUsers()
    if (error) throw error

    res.json({ userCount: data.users.length })
  } catch (err) {
    console.error('Supabase test error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
