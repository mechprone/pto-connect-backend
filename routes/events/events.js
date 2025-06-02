const express = require('express');
const router = express.Router();
const { supabase, verifySupabaseToken } = require('../../services/supabase');
const { requireActiveSubscription } = require('../requireActiveSubscription'); // ✅ fixed path

// 🔐 Middleware to extract and verify user/org ID
const withAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const user = await verifySupabaseToken(token);
    const orgId = user.user_metadata?.org_id || user.app_metadata?.org_id;

    if (!orgId) return res.status(400).json({ error: 'Missing org ID in user metadata' });

    req.user = user;
    req.orgId = orgId;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// 🔐 GET /api/events – return events for the user's PTO
router.get('/', withAuth, requireActiveSubscription, async (req, res) => {
  try {
    const { orgId } = req;

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('org_id', orgId)
      .order('event_date', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /events error:', err.message);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// 🔐 POST /api/events – create a new event
router.post('/', withAuth, requireActiveSubscription, async (req, res) => {
  try {
    const { orgId } = req;
    const {
      title,
      description,
      event_date,
      category,
      school_level,
      location,
      estimated_budget,
      tasks,
      volunteer_roles,
      materials_needed,
      start_time,
      end_time,
      share_public
    } = req.body;

    const { data, error } = await supabase
      .from('events')
      .insert([{
        title,
        description,
        event_date,
        category,
        school_level,
        location,
        estimated_budget,
        tasks,
        volunteer_roles,
        materials_needed,
        start_time,
        end_time,
        share_public,
        org_id: orgId
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('POST /events error:', err.message);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// 🔐 DELETE /api/events/:id – delete event if user is authorized
router.delete('/:id', withAuth, requireActiveSubscription, async (req, res) => {
  try {
    const { orgId } = req;
    const eventId = req.params.id;

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId)
      .eq('org_id', orgId);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /events/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// ✅ Logging for module load confirmation
console.log('[events.js] Routes loaded successfully');

module.exports = router;
