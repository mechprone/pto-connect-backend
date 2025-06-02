const express = require('express')
const { supabase, verifySupabaseToken } = require('../services/supabase')

const router = express.Router()

router.post('/', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Missing auth token' })

  let user
  try {
    user = await verifySupabaseToken(token)
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const { title, design, html, status } = req.body
  if (!title || !design || !html) {
    return res.status(400).json({ error: 'Missing required fields.' })
  }

  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return res.status(403).json({ error: 'Unable to determine organization.' })
    }

    const { org_id } = profile

    const { data, error } = await supabase
      .from('email_drafts')
      .insert([{
        title,
        design,
        html,
        status: status || 'draft',
        org_id,
        created_by: user.id
      }])
      .select()
      .single()

    if (error) throw error

    res.status(200).json({ draft: data })
  } catch (err) {
    console.error('Save draft error:', err)
    res.status(500).json({ error: 'Failed to save draft.' })
  }
})

module.exports = router
