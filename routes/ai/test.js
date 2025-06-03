import express from 'express';
import { supabase, verifySupabaseToken } from '../util/verifySupabaseToken.js';

const router = express.Router();

// 🔐 GET /api/ai/test-supabase – Check token + list user count (admin only)
router.get('/test-supabase', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const user = await verifySupabaseToken(token);

    // Optional: enforce admin-only
    const role = user.user_metadata?.role || user.app_metadata?.role;
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: admin only' });
    }

    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;

    res.json({ userCount: data.users.length });
  } catch (err) {
    console.error('[test.js] Supabase test error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
