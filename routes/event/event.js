import express from 'express';
import { supabase } from '../util/verifySupabaseToken.js';
import { requireActiveSubscription } from '../requireSubscription.js';
import { getUserOrgContext, addUserOrgToBody } from '../middleware/organizationalContext.js';
import { requireVolunteer, canManageEvents } from '../middleware/roleBasedAccess.js';

const router = express.Router();

// GET /api/event – Get all events for user's organization
router.get('/', getUserOrgContext, requireVolunteer, requireActiveSubscription, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('org_id', req.orgId)
      .order('event_date', { ascending: true });

    if (error) {
      console.error(`❌ Error fetching events for org ${req.orgId}:`, error.message);
      return res.status(500).json({ error: 'Failed to fetch events' });
    }

    console.log(`✅ Retrieved ${data.length} events for org ${req.orgId}`);
    res.json(data);
  } catch (err) {
    console.error('[event.js] GET /event error:', err.message);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// POST /api/event – Create a new event (committee lead+ required)
router.post('/', getUserOrgContext, addUserOrgToBody, canManageEvents, requireActiveSubscription, async (req, res) => {
  try {
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
        org_id: req.body.org_id, // Added by addUserOrgToBody middleware
        created_by: req.user.id
      }])
      .select()
      .single();

    if (error) {
      console.error(`❌ Error creating event for org ${req.orgId}:`, error.message);
      return res.status(500).json({ error: 'Failed to create event' });
    }

    console.log(`✅ Event created for org ${req.orgId} by user ${req.user.id}`);
    res.status(201).json(data);
  } catch (err) {
    console.error('[event.js] POST /event error:', err.message);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// DELETE /api/event/:id – Delete an event by ID (committee lead+ required)
router.delete('/:id', getUserOrgContext, canManageEvents, requireActiveSubscription, async (req, res) => {
  try {
    const eventId = req.params.id;

    // Verify event belongs to user's organization before deletion
    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select('org_id')
      .eq('id', eventId)
      .single();

    if (fetchError) {
      console.error(`❌ Error fetching event ${eventId}:`, fetchError.message);
      return res.status(500).json({ error: 'Error fetching event' });
    }

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.org_id !== req.orgId) {
      console.warn(`🚫 Cross-org access denied: Event ${eventId} not in org ${req.orgId}`);
      return res.status(403).json({ error: 'Event not found in your organization' });
    }

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId)
      .eq('org_id', req.orgId);

    if (error) {
      console.error(`❌ Error deleting event ${eventId}:`, error.message);
      return res.status(500).json({ error: 'Failed to delete event' });
    }

    console.log(`✅ Event ${eventId} deleted from org ${req.orgId} by user ${req.user.id}`);
    res.status(204).send();
  } catch (err) {
    console.error('[event.js] DELETE /event/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

console.log('[event.js] Routes loaded successfully');
export default router;
