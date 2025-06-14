import express from 'express';
import { supabase } from '../util/verifySupabaseToken.js';
import { getUserOrgContext, addUserOrgToBody } from '../middleware/organizationalContext.js';
import { requireVolunteer, canManageEvents } from '../middleware/roleBasedAccess.js';

const router = express.Router();

// GET /api/fundraiser/categories - Get all fundraiser categories for org
router.get('/categories', getUserOrgContext, requireVolunteer, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('fundraiser_categories')
      .select('*')
      .eq('org_id', req.orgId)
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[enhanced-fundraiser.js] GET /categories error:', err.message);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/fundraiser/categories - Create new category (admin only)
router.post('/categories', getUserOrgContext, addUserOrgToBody, canManageEvents, async (req, res) => {
  try {
    const { name, description } = req.body;

    const { data, error } = await supabase
      .from('fundraiser_categories')
      .insert([{
        name,
        description,
        org_id: req.orgId
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('[enhanced-fundraiser.js] POST /categories error:', err.message);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// GET /api/fundraiser/:id/tiers - Get donation tiers for a fundraiser
router.get('/:id/tiers', getUserOrgContext, requireVolunteer, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('donation_tiers')
      .select('*')
      .eq('fundraiser_id', req.params.id)
      .order('amount');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[enhanced-fundraiser.js] GET /:id/tiers error:', err.message);
    res.status(500).json({ error: 'Failed to fetch donation tiers' });
  }
});

// POST /api/fundraiser/:id/tiers - Create donation tier
router.post('/:id/tiers', getUserOrgContext, canManageEvents, async (req, res) => {
  try {
    const { name, amount, description, benefits } = req.body;
    const fundraiserId = req.params.id;

    // Verify fundraiser belongs to user's organization
    const { data: fundraiser, error: fetchError } = await supabase
      .from('fundraisers')
      .select('org_id')
      .eq('id', fundraiserId)
      .single();

    if (fetchError) throw fetchError;
    if (!fundraiser) {
      return res.status(404).json({ error: 'Fundraiser not found' });
    }
    if (fundraiser.org_id !== req.orgId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('donation_tiers')
      .insert([{
        fundraiser_id: fundraiserId,
        name,
        amount,
        description,
        benefits
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('[enhanced-fundraiser.js] POST /:id/tiers error:', err.message);
    res.status(500).json({ error: 'Failed to create donation tier' });
  }
});

// GET /api/fundraiser/:id/analytics - Get fundraiser analytics
router.get('/:id/analytics', getUserOrgContext, canManageEvents, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('fundraiser_analytics')
      .select('*')
      .eq('fundraiser_id', req.params.id)
      .order('date', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[enhanced-fundraiser.js] GET /:id/analytics error:', err.message);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// POST /api/fundraiser/:id/share - Record a social share
router.post('/:id/share', getUserOrgContext, async (req, res) => {
  try {
    const { platform } = req.body;
    const fundraiserId = req.params.id;

    // Verify fundraiser is public
    const { data: fundraiser, error: fetchError } = await supabase
      .from('fundraisers')
      .select('visibility')
      .eq('id', fundraiserId)
      .single();

    if (fetchError) throw fetchError;
    if (!fundraiser) {
      return res.status(404).json({ error: 'Fundraiser not found' });
    }
    if (fundraiser.visibility !== 'public') {
      return res.status(403).json({ error: 'Fundraiser is not public' });
    }

    const { data, error } = await supabase
      .from('fundraiser_shares')
      .insert([{
        fundraiser_id: fundraiserId,
        platform,
        shared_by: req.user.id
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('[enhanced-fundraiser.js] POST /:id/share error:', err.message);
    res.status(500).json({ error: 'Failed to record share' });
  }
});

// PUT /api/fundraiser/:id/status - Update fundraiser status
router.put('/:id/status', getUserOrgContext, canManageEvents, async (req, res) => {
  try {
    const { status } = req.body;
    const fundraiserId = req.params.id;

    // Verify fundraiser belongs to user's organization
    const { data: fundraiser, error: fetchError } = await supabase
      .from('fundraisers')
      .select('org_id')
      .eq('id', fundraiserId)
      .single();

    if (fetchError) throw fetchError;
    if (!fundraiser) {
      return res.status(404).json({ error: 'Fundraiser not found' });
    }
    if (fundraiser.org_id !== req.orgId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('fundraisers')
      .update({ status })
      .eq('id', fundraiserId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[enhanced-fundraiser.js] PUT /:id/status error:', err.message);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

export default router; 