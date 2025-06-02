// routes/teacherRequests.js
const express = require('express')
const router = express.Router()
const { supabase, verifySupabaseToken } = require('../../services/supabase')

// 🔐 GET /api/teacher-requests
router.get('/', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ error: 'Missing auth token' })

  try {
    const user = await verifySupabaseToken(token)
    const orgId = user.user_metadata?.org_id || user.app_metadata?.org_id
    if (!orgId) return res.status(400).json({ error: 'Missing org ID' })

    const { data, error } = await supabase
      .from('teacher_requests')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data)
  } catch (err) {
    console.error('GET /teacher-requests error:', err.message)
    res.status(500).json({ error: 'Failed to fetch requests' })
  }
})

// 🔐 POST /api/teacher-requests
router.post('/', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ error: 'Missing auth token' })

  try {
    const user = await verifySupabaseToken(token)
    const orgId = user.user_metadata?.org_id || user.app_metadata?.org_id
    if (!orgId) return res.status(400).json({ error: 'Missing org ID' })

    const payload = req.body
    const insert = {
      ...payload,
      created_by: user.id,
      org_id: orgId
    }

    const { error } = await supabase.from('teacher_requests').insert([insert])
    if (error) throw error

    res.status(200).json({ success: true })
  } catch (err) {
    console.error('POST /teacher-requests error:', err.message)
    res.status(500).json({ error: 'Failed to submit request' })
  }
})

module.exports = router
