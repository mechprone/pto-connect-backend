const express = require('express')
const router = express.Router()
const { supabase, verifySupabaseToken } = require('../services/supabase')

// GET /api/events (protected)
router.get('/', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ error: 'Missing auth token' })

  try {
    const user = await verifySupabaseToken(token)

    const orgId = user?.user_metadata?.org_id || user?.app_metadata?.org_id
    if (!orgId) return res.status(400).json({ error: 'Missing org ID in user metadata' })

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('org_id', orgId)
      .order('event_date', { ascending: true })

    if (error) throw error

    res.json(data)
  } catch (err) {
    console.error('Events fetch error:', err.message)
    res.status(500).json({ error: 'Failed to fetch events' })
  }
})

module.exports = router
