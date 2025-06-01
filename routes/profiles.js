// routes/profiles.js
const express = require('express')
const router = express.Router()
const { supabase, verifySupabaseToken } = require('../services/supabase')

// 🔐 GET /api/profiles/me
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ error: 'Missing token' })

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

// 🔐 POST /api/profiles/update-role
router.post('/update-role', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1]
  const { user_id, new_role } = req.body

  if (!token) return res.status(401).json({ error: 'Missing token' })

  try {
    const requester = await verifySupabaseToken(token)

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', requester.id)
      .single()

    if (profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient privileges' })
    }

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

// 🔐 GET /api/profiles/all
router.get('/all', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ error: 'Missing token' })

  try {
    const user = await verifySupabaseToken(token)

    const { data: self } = await supabase
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single()

    if (self?.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient privileges' })
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('org_id', self.org_id)

    if (error) throw error
    res.json(data)
  } catch (err) {
    console.error('GET /profiles/all error:', err.message)
    res.status(500).json({ error: 'Failed to fetch profiles' })
  }
})

module.exports = router
