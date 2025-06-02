// routes/adminUsers.js
const express = require('express')
const router = express.Router()
const { supabase, verifySupabaseToken } = require('../../services/supabase')

// 🔐 GET /api/admin-users
router.get('/', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ error: 'Missing auth token' })

  try {
    const user = await verifySupabaseToken(token)
    const orgId = user.user_metadata?.org_id || user.app_metadata?.org_id

    if (!orgId) return res.status(400).json({ error: 'Missing org ID' })

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('pto_id', orgId)

    if (error) throw error

    res.json(data)
  } catch (err) {
    console.error('GET /admin-users error:', err.message)
    res.status(500).json({ error: 'Failed to fetch user list' })
  }
})

module.exports = router
console.log('[adminUsers.js] Routes loaded successfully');
