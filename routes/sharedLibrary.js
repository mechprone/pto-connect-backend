// routes/sharedLibrary.js
const express = require('express')
const router = express.Router()
const { supabase, verifySupabaseToken } = require('../services/supabase')

// GET /api/shared-library (returns shared events and fundraisers)
router.get('/', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ error: 'Missing auth token' })

  try {
    await verifySupabaseToken(token)

    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title, description')
      .eq('share_public', true)

    const { data: fundraisers, error: fundraisersError } = await supabase
      .from('fundraisers')
      .select('id, title, description')
      .eq('share_public', true)

    if (eventsError || fundraisersError) throw new Error('Query error')

    const combined = [
      ...(events || []).map(e => ({ ...e, type: 'event' })),
      ...(fundraisers || []).map(f => ({ ...f, type: 'fundraiser' }))
    ]

    res.json(combined)
  } catch (err) {
    console.error('GET /shared-library error:', err.message)
    res.status(500).json({ error: 'Failed to load shared library' })
  }
})

module.exports = router
