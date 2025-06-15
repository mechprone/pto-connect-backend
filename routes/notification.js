/* eslint-disable no-console */
import express from 'express';
import { supabase, verifySupabaseToken } from './util/verifySupabaseToken.js';
import { requireActiveSubscription } from './requireSubscription.js';
import { getUserOrgContext } from './middleware/organizationalContext.js';

const router = express.Router();

// 🔐 Auth middleware
const withAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const user = await verifySupabaseToken(token);
    req.user = user;
    next();
  } catch (err) {
    console.error('[notifications.js] Auth error:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// 🔔 GET /api/notifications – Get unread notifications
router.get('/', requireActiveSubscription, getUserOrgContext, async (req, res) => {
  try {
    const { user, orgId } = req;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .or(`recipient_id.eq.${user.id},recipient_id.is.null`)
      .eq('org_id', orgId)
      .eq('is_read', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[notifications.js] GET / error:', err.message);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

// 🔔 PATCH /api/notifications/:id/read – Mark as read
router.patch('/:id/read', requireActiveSubscription, getUserOrgContext, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) throw error;
    res.status(200).json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('[notifications.js] PATCH /:id/read error:', err.message);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// 🔔 DELETE /api/notifications/clear – Clear all for org/user
router.delete('/clear', requireActiveSubscription, getUserOrgContext, async (req, res) => {
  try {
    const { user, orgId } = req;
    const { error } = await supabase
      .from('notifications')
      .delete()
      .or(`recipient_id.eq.${user.id},recipient_id.is.null`)
      .eq('org_id', orgId);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    console.error('[notifications.js] DELETE /clear error:', err.message);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

console.log('[notifications.js] Routes loaded successfully');
export default router;
