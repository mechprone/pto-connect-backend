import express from 'express';
import { supabase } from '../util/verifySupabaseToken.js';
import { getUserOrgContext, addUserOrgToBody } from '../middleware/organizationalContext.js';
import { requireVolunteer, canManageEvents } from '../middleware/roleBasedAccess.js';

const router = express.Router();

// GET /api/fundraiser – Get all fundraisers for user's organization
router.get('/', getUserOrgContext, requireVolunteer, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('fundraisers')
      .select('*')
      .eq('org_id', req.orgId)
      .order('end_date', { ascending: true });

    if (error) {
      console.error(`❌ Error fetching fundraisers for org ${req.orgId}:`, error.message);
      return res.status(500).json({ error: 'Failed to fetch fundraisers' });
    }

    console.log(`✅ Retrieved ${data.length} fundraisers for org ${req.orgId}`);
    res.json(data);
  } catch (err) {
    console.error('[fundraiser.js] GET /fundraiser error:', err.message);
    res.status(500).json({ error: 'Failed to fetch fundraisers' });
  }
});

// GET /api/fundraiser/:id – Get a specific fundraiser by ID
router.get('/:id', getUserOrgContext, requireVolunteer, async (req, res) => {
  try {
    const fundraiserId = req.params.id;

    const { data, error } = await supabase
      .from('fundraisers')
      .select('*')
      .eq('id', fundraiserId)
      .eq('org_id', req.orgId)
      .single();

    if (error) {
      console.error(`❌ Error fetching fundraiser ${fundraiserId}:`, error.message);
      return res.status(500).json({ error: 'Failed to fetch fundraiser' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Fundraiser not found' });
    }

    console.log(`✅ Retrieved fundraiser ${fundraiserId} for org ${req.orgId}`);
    res.json(data);
  } catch (err) {
    console.error('[fundraiser.js] GET /fundraiser/:id error:', err.message);
    res.status(500).json({ error: 'Failed to fetch fundraiser' });
  }
});

// POST /api/fundraiser – Create new fundraiser (committee lead+ required)
router.post('/', getUserOrgContext, addUserOrgToBody, canManageEvents, async (req, res) => {
  try {
    const { 
      title, 
      description, 
      goal_amount, 
      deadline, 
      share_public,
      category,
      fundraising_type,
      contact_info
    } = req.body;

    const { data, error } = await supabase
      .from('fundraisers')
      .insert([{
        title,
        description,
        goal_amount,
        deadline,
        share_public,
        category,
        fundraising_type,
        contact_info,
        org_id: req.body.org_id, // Added by addUserOrgToBody middleware
        created_by: req.user.id
      }])
      .select()
      .single();

    if (error) {
      console.error(`❌ Error creating fundraiser for org ${req.orgId}:`, error.message);
      return res.status(500).json({ error: 'Failed to create fundraiser' });
    }

    console.log(`✅ Fundraiser created for org ${req.orgId} by user ${req.user.id}`);
    res.status(201).json({ 
      success: true, 
      fundraiser: data 
    });
  } catch (err) {
    console.error('[fundraiser.js] POST /fundraiser error:', err.message);
    res.status(500).json({ error: 'Failed to create fundraiser' });
  }
});

// PUT /api/fundraiser/:id – Update fundraiser (committee lead+ required)
router.put('/:id', getUserOrgContext, canManageEvents, async (req, res) => {
  try {
    const fundraiserId = req.params.id;
    const { 
      title, 
      description, 
      goal_amount, 
      deadline, 
      share_public,
      category,
      fundraising_type,
      contact_info,
      current_amount
    } = req.body;

    // Verify fundraiser belongs to user's organization
    const { data: fundraiser, error: fetchError } = await supabase
      .from('fundraisers')
      .select('org_id')
      .eq('id', fundraiserId)
      .single();

    if (fetchError) {
      console.error(`❌ Error fetching fundraiser ${fundraiserId}:`, fetchError.message);
      return res.status(500).json({ error: 'Error fetching fundraiser' });
    }

    if (!fundraiser) {
      return res.status(404).json({ error: 'Fundraiser not found' });
    }

    if (fundraiser.org_id !== req.orgId) {
      console.warn(`🚫 Cross-org access denied: Fundraiser ${fundraiserId} not in org ${req.orgId}`);
      return res.status(403).json({ error: 'Fundraiser not found in your organization' });
    }

    const { data, error } = await supabase
      .from('fundraisers')
      .update({
        title,
        description,
        goal_amount,
        deadline,
        share_public,
        category,
        fundraising_type,
        contact_info,
        current_amount,
        updated_at: new Date().toISOString()
      })
      .eq('id', fundraiserId)
      .eq('org_id', req.orgId)
      .select()
      .single();

    if (error) {
      console.error(`❌ Error updating fundraiser ${fundraiserId}:`, error.message);
      return res.status(500).json({ error: 'Failed to update fundraiser' });
    }

    console.log(`✅ Fundraiser ${fundraiserId} updated in org ${req.orgId} by user ${req.user.id}`);
    res.json(data);
  } catch (err) {
    console.error('[fundraiser.js] PUT /fundraiser/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update fundraiser' });
  }
});

// DELETE /api/fundraiser/:id – Delete fundraiser (committee lead+ required)
router.delete('/:id', getUserOrgContext, canManageEvents, async (req, res) => {
  try {
    const fundraiserId = req.params.id;

    // Verify fundraiser belongs to user's organization
    const { data: fundraiser, error: fetchError } = await supabase
      .from('fundraisers')
      .select('org_id')
      .eq('id', fundraiserId)
      .single();

    if (fetchError) {
      console.error(`❌ Error fetching fundraiser ${fundraiserId}:`, fetchError.message);
      return res.status(500).json({ error: 'Error fetching fundraiser' });
    }

    if (!fundraiser) {
      return res.status(404).json({ error: 'Fundraiser not found' });
    }

    if (fundraiser.org_id !== req.orgId) {
      console.warn(`🚫 Cross-org access denied: Fundraiser ${fundraiserId} not in org ${req.orgId}`);
      return res.status(403).json({ error: 'Fundraiser not found in your organization' });
    }

    const { error } = await supabase
      .from('fundraisers')
      .delete()
      .eq('id', fundraiserId)
      .eq('org_id', req.orgId);

    if (error) {
      console.error(`❌ Error deleting fundraiser ${fundraiserId}:`, error.message);
      return res.status(500).json({ error: 'Failed to delete fundraiser' });
    }

    console.log(`✅ Fundraiser ${fundraiserId} deleted from org ${req.orgId} by user ${req.user.id}`);
    res.status(204).send();
  } catch (err) {
    console.error('[fundraiser.js] DELETE /fundraiser/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete fundraiser' });
  }
});

console.log('[fundraiser.js] Routes loaded successfully');
export default router;
