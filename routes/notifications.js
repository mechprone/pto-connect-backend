const express = require('express')
const router = express.Router()
const { supabase, verifySupabaseToken } = require('../services/supabase')
const { requireActiveSubscription } = require('../middleware/requireActiveSubscription')

// GET /api/notifications – get unread notifications for current user
router.get('/', verifySupabaseToken, requireActiveSubscription, async (req, res) => {
  try {
    const user = req.user

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .or(`recipient_id.eq.${user.id},recipient_id.is.null`)
      .eq('org_id', user.user_metadata?.org_id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })

    if (error) throw error

    res.json(data)
  } catch (err) {
    console.error('GET /notifications error:', err.message)
    res.status(500).json({ error: 'Failed to load notifications' })
  }
})

// PATCH /api/notifications/:id/read – mark a notification as read
router.patch('/:id/read', verifySupabaseToken, requireActiveSubscription, async (req, res) => {
  const notificationId = req.params.id

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)

  if (error) {
    console.error('PATCH /notifications/:id/read error:', error.message)
    return res.status(500).json({ error: 'Failed to mark notification as read' })
  }

  res.status(200).json({ message: 'Notification marked as read' })
})

// DELETE /api/notifications/clear – clear all notifications for user/org
router.delete('/clear', verifySupabaseToken, requireActiveSubscription, async (req, res) => {
  const user = req.user

  const { error } = await supabase
    .from('notifications')
    .delete()
    .or(`recipient_id.eq.${user.id},recipient_id.is.null`)
    .eq('org_id', user.user_metadata?.org_id)

  if (error) {
    console.error('DELETE /notifications/clear error:', error.message)
    return res.status(500).json({ error: 'Failed to clear notifications' })
  }

  res.status(204).send()
})

module.exports = router
