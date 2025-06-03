import express from 'express';
import { supabase, verifySupabaseToken } from '../util/verifySupabaseToken.js';

const router = express.Router();

// 🔐 GET /api/budget – fetch all transactions for a PTO
router.get('/', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const user = await verifySupabaseToken(token);
    const orgId = user.user_metadata?.org_id || user.app_metadata?.org_id;
    if (!orgId) return res.status(400).json({ error: 'Missing org ID' });

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('[budget.js] GET /budget error:', err.message);
    res.status(500).json({ error: 'Failed to load transactions' });
  }
});

export default router;
