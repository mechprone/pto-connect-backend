// routes/profiles.js
const express = require('express')
const router = express.Router()
const { supabase, verifySupabaseToken } = require('../services/supabase')

// 🔐 Middleware to ensure user is authenticated
const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ error: 'Missing auth token' })

  try {
    const user = await verifySupabaseToken(token)
    req.user = user
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// 🧠 Helper: check if user is admin
const isAdmin = (user) => {
  const role = user.user_metadata?.role || user.app_metadata?.role
  return role === 'admin'
}

// GET /api/profiles/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { id } = req.user
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    res.json(data)
  } catch (err) {
    console.error('GET /profiles/me error:', err.message)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

// GET /api/profiles/list (admin only)
router.get('/list', requireAuth, async (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin access only' })

  const orgId = req.user.user_metadata?.org_id || req.user.app_metadata?.org_id
  if (!orgId) return res.status(400).json({ error: 'Missing org ID' })

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at')
      .eq('org_id', orgId)

    if (error) throw error

    res.json(data)
  } catch (err) {
    console.error('GET /profiles/list error:', err.message)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

// POST /api/profiles/update-role (admin only)
router.post('/update-role', requireAuth, async (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin access only' })

  const { user_id, new_role } = req.body
  if (!user_id || !new_role) return res.status(400).json({ error: 'Missing fields' })

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ role: new_role })
      .eq('id', user_id)

    if (error) throw error

    res.json({ message: 'Role updated successfully' })
  } catch (err) {
    console.error('POST /profiles/update-role error:', err.message)
    res.status(500).json({ error: 'Failed to update role' })
  }
})

module.exports = router
