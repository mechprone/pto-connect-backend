import express from 'express';
import { supabase, verifySupabaseToken } from '../util/verifySupabaseToken.js';

const router = express.Router();

// 🔐 GET /api/messages – fetch messages for user's PTO
router.get('/', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const user = await verifySupabaseToken(token);
    const orgId = user.user_metadata?.org_id || user.app_metadata?.org_id;

    if (!orgId) return res.status(400).json({ error: 'Missing org ID' });

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('[message.js] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// 🔐 POST /api/messages – send message
router.post('/', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const user = await verifySupabaseToken(token);
    const orgId = user.user_metadata?.org_id || user.app_metadata?.org_id;

    if (!orgId) return res.status(400).json({ error: 'Missing org ID' });

    const { subject, body, send_as } = req.body;

    const { error } = await supabase.from('messages').insert([{
      subject,
      body,
      send_as,
      created_by: user.id,
      org_id: orgId
    }]);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('[message.js] POST error:', err.message);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
