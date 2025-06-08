import express from 'express';
import { supabase } from '../util/verifySupabaseToken.js';
import { getUserOrgContext, addUserOrgToBody } from '../middleware/organizationalContext.js';
import { requireVolunteer, canManageCommunications } from '../middleware/roleBasedAccess.js';

const router = express.Router();

// GET /api/messages – Get messages for user's organization
router.get('/', getUserOrgContext, requireVolunteer, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('org_id', req.orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`❌ Error fetching messages for org ${req.orgId}:`, error.message);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }

    console.log(`✅ Retrieved ${data.length} messages for org ${req.orgId}`);
    res.json(data);
  } catch (err) {
    console.error('[message.js] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/messages – Send message (committee lead+ required)
router.post('/', getUserOrgContext, addUserOrgToBody, canManageCommunications, async (req, res) => {
  try {
    const { subject, body, send_as, recipient_type, scheduled_for } = req.body;

    const { data, error } = await supabase
      .from('messages')
      .insert([{
        subject,
        body,
        send_as,
        recipient_type,
        scheduled_for,
        created_by: req.user.id,
        org_id: req.body.org_id // Added by addUserOrgToBody middleware
      }])
      .select()
      .single();

    if (error) {
      console.error(`❌ Error sending message for org ${req.orgId}:`, error.message);
      return res.status(500).json({ error: 'Failed to send message' });
    }

    console.log(`✅ Message sent for org ${req.orgId} by user ${req.user.id}`);
    res.status(201).json({
      success: true,
      message: data
    });
  } catch (err) {
    console.error('[message.js] POST error:', err.message);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// PUT /api/messages/:id – Update message (committee lead+ required)
router.put('/:id', getUserOrgContext, canManageCommunications, async (req, res) => {
  try {
    const messageId = req.params.id;
    const { subject, body, send_as, recipient_type, scheduled_for } = req.body;

    // Verify message belongs to user's organization
    const { data: message, error: fetchError } = await supabase
      .from('messages')
      .select('org_id')
      .eq('id', messageId)
      .single();

    if (fetchError) {
      console.error(`❌ Error fetching message ${messageId}:`, fetchError.message);
      return res.status(500).json({ error: 'Error fetching message' });
    }

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.org_id !== req.orgId) {
      console.warn(`🚫 Cross-org access denied: Message ${messageId} not in org ${req.orgId}`);
      return res.status(403).json({ error: 'Message not found in your organization' });
    }

    const { data, error } = await supabase
      .from('messages')
      .update({
        subject,
        body,
        send_as,
        recipient_type,
        scheduled_for,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId)
      .eq('org_id', req.orgId)
      .select()
      .single();

    if (error) {
      console.error(`❌ Error updating message ${messageId}:`, error.message);
      return res.status(500).json({ error: 'Failed to update message' });
    }

    console.log(`✅ Message ${messageId} updated in org ${req.orgId} by user ${req.user.id}`);
    res.json(data);
  } catch (err) {
    console.error('[message.js] PUT error:', err.message);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

// DELETE /api/messages/:id – Delete message (committee lead+ required)
router.delete('/:id', getUserOrgContext, canManageCommunications, async (req, res) => {
  try {
    const messageId = req.params.id;

    // Verify message belongs to user's organization
    const { data: message, error: fetchError } = await supabase
      .from('messages')
      .select('org_id')
      .eq('id', messageId)
      .single();

    if (fetchError) {
      console.error(`❌ Error fetching message ${messageId}:`, fetchError.message);
      return res.status(500).json({ error: 'Error fetching message' });
    }

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.org_id !== req.orgId) {
      console.warn(`🚫 Cross-org access denied: Message ${messageId} not in org ${req.orgId}`);
      return res.status(403).json({ error: 'Message not found in your organization' });
    }

    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)
      .eq('org_id', req.orgId);

    if (error) {
      console.error(`❌ Error deleting message ${messageId}:`, error.message);
      return res.status(500).json({ error: 'Failed to delete message' });
    }

    console.log(`✅ Message ${messageId} deleted from org ${req.orgId} by user ${req.user.id}`);
    res.status(204).send();
  } catch (err) {
    console.error('[message.js] DELETE error:', err.message);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

console.log('[message.js] Routes loaded successfully');
export default router;
