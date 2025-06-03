import express from 'express';
import { supabase, verifySupabaseToken } from '../util/verifySupabaseToken.js';

const router = express.Router();

// 🔐 GET /api/shared-library – Return shared events and fundraisers
router.get('/', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    await verifySupabaseToken(token);

    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title, description')
      .eq('share_public', true);

    const { data: fundraisers, error: fundraisersError } = await supabase
      .from('fundraisers')
      .select('id, title, description')
      .eq('share_public', true);

    if (eventsError || fundraisersError) throw new Error('Query error');

    const combined = [
      ...(events || []).map(e => ({ ...e, type: 'event' })),
      ...(fundraisers || []).map(f => ({ ...f, type: 'fundraiser' }))
    ];

    res.json(combined);
  } catch (err) {
    console.error('[template.js] GET /shared-library error:', err.message);
    res.status(500).json({ error: 'Failed to load shared library' });
  }
});

console.log('[template.js] Routes loaded successfully');
export default router;
