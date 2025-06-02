const express = require('express')
const router = express.Router()
const { supabase, verifySupabaseToken } = require('../../services/supabase')
const requireActiveSubscription = require('../requireActiveSubscription');

// 🔒 Middleware to allow only admins
const requireAdminRole = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ error: 'Missing auth token' })

  try {
    const user = await verifySupabaseToken(token)

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (error || !profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    req.user = user
    next()
  } catch (err) {
    console.error('Admin check failed:', err.message)
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// ✅ PATCH /api/profiles/:id/approve – approve a user
router.patch('/:id/approve', verifySupabaseToken, requireActiveSubscription, requireAdminRole, async (req, res) => {
  const userId = req.params.id

  const { error } = await supabase
    .from('profiles')
    .update({ approved: true })
    .eq('id', userId)

  if (error) {
    console.error('Failed to approve user:', error.message)
    return res.status(500).json({ error: 'Failed to approve user' })
  }

  res.status(200).json({ message: 'User approved successfully' })
})

// ✅ DELETE /api/profiles/:id – delete a user
router.delete('/:id', verifySupabaseToken, requireActiveSubscription, requireAdminRole, async (req, res) => {
  const userId = req.params.id

  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId)

  if (error) {
    console.error('Failed to delete user:', error.message)
    return res.status(500).json({ error: 'Failed to delete user' })
  }

  res.status(204).send()
})

module.exports = router
