import express from 'express';
import { supabase } from '../util/verifySupabaseToken.js';
import { getUserOrgContext, addUserOrgToBody } from '../middleware/organizationalContext.js';
import { requireVolunteer, canManageCommunications } from '../middleware/roleBasedAccess.js';

const router = express.Router();

// GET /api/communications/email-drafts – Get all email drafts for user's organization
router.get('/', getUserOrgContext, requireVolunteer, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('email_drafts')
      .select('*')
      .eq('org_id', req.orgId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error(`❌ Error fetching email drafts for org ${req.orgId}:`, error.message);
      return res.status(500).json({ error: 'Failed to fetch email drafts' });
    }

    console.log(`✅ Retrieved ${data.length} email drafts for org ${req.orgId}`);
    res.json(data);
  } catch (err) {
    console.error('[emailDraft.js] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch email drafts' });
  }
});

// POST /api/communications/email-drafts – Create new email draft (committee lead+ required)
router.post('/', getUserOrgContext, addUserOrgToBody, canManageCommunications, async (req, res) => {
  try {
    const { subject, html_content, design_json, status } = req.body;

    const { data, error } = await supabase
      .from('email_drafts')
      .insert([{
        subject,
        html_content,
        design_json,
        status,
        user_id: req.user.id,
        org_id: req.body.org_id // Added by addUserOrgToBody middleware
      }])
      .select()
      .single();

    if (error) {
      console.error(`❌ Error creating email draft for org ${req.orgId}:`, error.message);
      return res.status(500).json({ error: 'Failed to create email draft' });
    }

    console.log(`✅ Email draft created for org ${req.orgId} by user ${req.user.id}`);
    res.status(201).json(data);
  } catch (err) {
    console.error('[emailDraft.js] POST error:', err.message);
    res.status(500).json({ error: 'Failed to create email draft' });
  }
});

// PUT /api/communications/email-drafts/:id – Update email draft (owner only)
router.put('/:id', getUserOrgContext, async (req, res) => {
  try {
    const draftId = req.params.id;
    const { subject, html_content, design_json, status } = req.body;

    // Verify draft belongs to user's organization and user owns it
    const { data: draft, error: fetchError } = await supabase
      .from('email_drafts')
      .select('org_id, user_id')
      .eq('id', draftId)
      .single();

    if (fetchError) {
      console.error(`❌ Error fetching email draft ${draftId}:`, fetchError.message);
      return res.status(500).json({ error: 'Error fetching email draft' });
    }

    if (!draft) {
      return res.status(404).json({ error: 'Email draft not found' });
    }

    if (draft.org_id !== req.orgId) {
      console.warn(`🚫 Cross-org access denied: Draft ${draftId} not in org ${req.orgId}`);
      return res.status(403).json({ error: 'Email draft not found in your organization' });
    }

    if (draft.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to edit this draft' });
    }

    const { data, error } = await supabase
      .from('email_drafts')
      .update({
        subject,
        html_content,
        design_json,
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', draftId)
      .eq('user_id', req.user.id)
      .eq('org_id', req.orgId)
      .select()
      .single();

    if (error) {
      console.error(`❌ Error updating email draft ${draftId}:`, error.message);
      return res.status(500).json({ error: 'Failed to update email draft' });
    }

    console.log(`✅ Email draft ${draftId} updated in org ${req.orgId} by user ${req.user.id}`);
    res.json(data);
  } catch (err) {
    console.error('[emailDraft.js] PUT error:', err.message);
    res.status(500).json({ error: 'Failed to update email draft' });
  }
});

// DELETE /api/communications/email-drafts/:id – Delete email draft (owner only)
router.delete('/:id', getUserOrgContext, async (req, res) => {
  try {
    const draftId = req.params.id;

    // Verify draft belongs to user's organization and user owns it
    const { data: draft, error: fetchError } = await supabase
      .from('email_drafts')
      .select('org_id, user_id')
      .eq('id', draftId)
      .single();

    if (fetchError) {
      console.error(`❌ Error fetching email draft ${draftId}:`, fetchError.message);
      return res.status(500).json({ error: 'Error fetching email draft' });
    }

    if (!draft) {
      return res.status(404).json({ error: 'Email draft not found' });
    }

    if (draft.org_id !== req.orgId) {
      console.warn(`🚫 Cross-org access denied: Draft ${draftId} not in org ${req.orgId}`);
      return res.status(403).json({ error: 'Email draft not found in your organization' });
    }

    if (draft.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this draft' });
    }

    const { error } = await supabase
      .from('email_drafts')
      .delete()
      .eq('id', draftId)
      .eq('user_id', req.user.id)
      .eq('org_id', req.orgId);

    if (error) {
      console.error(`❌ Error deleting email draft ${draftId}:`, error.message);
      return res.status(500).json({ error: 'Failed to delete email draft' });
    }

    console.log(`✅ Email draft ${draftId} deleted from org ${req.orgId} by user ${req.user.id}`);
    res.status(204).send();
  } catch (err) {
    console.error('[emailDraft.js] DELETE error:', err.message);
    res.status(500).json({ error: 'Failed to delete email draft' });
  }
});

console.log('[emailDraft.js] Routes loaded successfully');
export default router;
