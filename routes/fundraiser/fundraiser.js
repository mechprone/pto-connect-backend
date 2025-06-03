import express from 'express';
import { supabase, verifySupabaseToken } from '../util/verifySupabaseToken.js';

const router = express.Router();

// 🔐 GET /api/fundraisers – Fetch fundraisers for org
router.get('/', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const user = await verifySupabaseToken(token);
    const orgId = user.user_metadata?.org_id || user.app_metadata?.org_id;
    if (!orgId) return res.status(400).json({ error: 'Missing org ID' });

    const { data, error } = await supabase
      .from('fundraisers')
      .select('*')
      .eq('org_id', orgId)
      .order('deadline', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[fundraiser.js] GET /fundraisers error:', err.message);
    res.status(500).json({ error: 'Failed to fetch fundraisers' });
  }
});

// 🔐 POST /api/fundraisers – Create new fundraiser
router.post('/', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const user = await verifySupabaseToken(token);
    const orgId = user.user_metadata?.org_id || user.app_metadata?.org_id;
    if (!orgId) return res.status(400).json({ error: 'Missing org ID in user metadata' });

    const { title, description, goal_amount, deadline, share_public } = req.body;

    const { data, error } = await supabase
      .from('fundraisers')
      .insert([{
        title,
        description,
        goal_amount,
        deadline,
        share_public,
        org_id: orgId,
        created_by: user.id
      }])
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, fundraiser: data });
  } catch (err) {
    console.error('[fundraiser.js] POST /fundraisers error:', err.message);
    res.status(500).json({ error: 'Failed to create fundraiser' });
  }
});

console.log('[fundraiser.js] Routes loaded successfully');
export default router;
