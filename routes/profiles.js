// routes/profiles.js
const express = require('express')
const router = express.Router()
const { supabase, verifySupabaseToken } = require('../services/supabase')

// 🔐 GET /api/profiles/me — get the current user's profile
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ error: 'Missing auth token' })

  try {
    const user = await verifySupabaseToken(token)

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) throw error

    res.json(data)
  } catch (err) {
    console.error('GET /profiles/me error:', err.message)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

// 🔐 PATCH /api/profiles/me — update current user's profile (e.g., name)
router.patch('/me', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ error: 'Missing auth token' })

  try {
    const user = await verifySupabaseToken(token)
    const updates = req.body

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (error) throw error

    res.json(data)
  } catch (err) {
    console.error('PATCH /profiles/me error:', err.message)
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

// 🔐 Admin-only: GET /api/profiles/org — list all profiles in same org
router.get('/org', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ error: 'Missing auth token' })

  try {
    const user = await verifySupabaseToken(token)

    if (user.user_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' })
    }

    const orgId = user.user_metadata?.org_id || user.app_metadata?.org_id
    if (!orgId) return res.status(400).json({ error: 'Missing org ID' })

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, org_id, created_at')
      .eq('org_id', orgId)

    if (error) throw error

    res.json(data)
  } catch (err) {
    console.error('GET /profiles/org error:', err.message)
    res.status(500).json({ error: 'Failed to list profiles' })
  }
})

module.exports = router
