import express from 'express';
import { supabase, verifySupabaseToken } from '../util/verifySupabaseToken.js';

const router = express.Router();

// 🔐 GET /api/admin-users
router.get('/', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const user = await verifySupabaseToken(token);
    const orgId = user.user_metadata?.org_id || user.app_metadata?.org_id;

    if (!orgId) return res.status(400).json({ error: 'Missing org ID' });

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('pto_id', orgId);

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('[adminUser.js] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch user list' });
  }
});

console.log('[adminUser.js] Routes loaded successfully');
export default router;
