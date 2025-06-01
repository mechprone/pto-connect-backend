// routes/profiles.js
const express = require('express')
const router = express.Router()
const { supabase, verifySupabaseToken } = require('../services/supabase')

// 🔐 GET /api/profiles/me - Fetch current user's profile
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ error: 'Missing auth token' })

  try {
    const user = await verifySupabaseToken(token)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role, org_id')
      .eq('id', user.id)
      .single()

    if (error) throw error

    res.json(data)
  } catch (err) {
    console.error('GET /profiles/me error:', err.message)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

// 🔐 PATCH /api/profiles/role/:id - Admin updates a user's role
router.patch('/role/:id', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ error: 'Missing auth token' })

  const userId = req.params.id
  const { newRole } = req.body

  try {
    const requester = await verifySupabaseToken(token)
    if (requester.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can update roles' })
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)
      .select()

    if (error) throw error

    res.json({ message: 'Role updated', profile: data[0] })
  } catch (err) {
    console.error('PATCH /profiles/role error:', err.message)
    res.status(500).json({ error: 'Failed to update role' })
  }
})

// 🔐 GET /api/profiles/all - Admin fetches all profiles in same PTO
router.get('/all', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ error: 'Missing auth token' })

  try {
    const user = await verifySupabaseToken(token)
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can view members' })
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role, org_id, created_at')
      .eq('org_id', user.user_metadata?.org_id || user.app_metadata?.org_id)
      .order('created_at', { ascending: false })

    if (error) throw error

    res.json(data)
  } catch (err) {
    console.error('GET /profiles/all error:', err.message)
    res.status(500).json({ error: 'Failed to load profiles' })
  }
})

module.exports = router
