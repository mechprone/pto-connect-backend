import express from 'express';
import { verifySupabaseToken, supabase } from '../util/verifySupabaseToken.js';
import { requireActiveSubscription } from '../requireSubscription.js';

const router = express.Router();

// 🔐 Middleware to allow only admins
const requireAdminRole = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    console.warn('❌ Admin role check failed: Missing auth token');
    return res.status(401).json({ error: 'Missing auth token' });
  }

  try {
    const user = await verifySupabaseToken(token);
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error(`❌ Supabase error fetching role for user ${user.id}:`, error.message);
      return res.status(500).json({ error: 'Error checking user role' });
    }

    if (!profile || profile.role !== 'admin') {
      console.warn(`🚫 Access denied: User ${user.id} has role '${profile?.role}'`);
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('❌ Token verification failed:', err.message);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// ✅ PATCH /api/profiles/:id/approve – Approve a user
router.patch('/:id/approve', requireActiveSubscription, requireAdminRole, async (req, res) => {
  const userId = req.params.id;

  const { error } = await supabase
    .from('profiles')
    .update({ approved: true })
    .eq('id', userId);

  if (error) {
    console.error(`❌ Failed to approve user [${userId}]:`, error.message);
    return res.status(500).json({ error: 'Failed to approve user' });
  }

  console.info(`✅ User [${userId}] approved by [${req.user?.id}]`);
  res.status(200).json({ message: 'User approved successfully' });
});

// ✅ DELETE /api/profiles/:id – Delete a user
router.delete('/:id', requireActiveSubscription, requireAdminRole, async (req, res) => {
  const userId = req.params.id;

  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId);

  if (error) {
    console.error(`❌ Failed to delete user [${userId}]:`, error.message);
    return res.status(500).json({ error: 'Failed to delete user' });
  }

  console.info(`🗑️ User [${userId}] deleted by [${req.user?.id}]`);
  res.status(204).send();
});

console.log('[profile.js] Routes loaded successfully');
export default router;
