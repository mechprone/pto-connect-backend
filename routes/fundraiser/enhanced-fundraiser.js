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
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// List all school years with fundraisers for the org
router.get('/analytics/years', getUserOrgContext, requireVolunteer, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('fundraisers')
      .select('start_date')
      .eq('org_id', req.orgId);
    if (error) throw error;
    // Extract years from start_date
    const years = Array.from(new Set((data || []).map(row => new Date(row.start_date).getFullYear()))).sort((a, b) => b - a);
    res.json(years);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch years' });
  }
});

// Aggregate analytics for all fundraisers in a year
router.get('/analytics', getUserOrgContext, requireVolunteer, async (req, res) => {
  try {
    const { year, fundraiserId } = req.query;
    let query = supabase
      .from('fundraiser_analytics')
      .select('*')
      .eq('org_id', req.orgId);
    if (year) query = query.gte('date', `${year}-08-01`).lte('date', `${parseInt(year) + 1}-06-30`);
    if (fundraiserId) query = query.eq('fundraiser_id', fundraiserId);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// List all school years with donors for the org
router.get('/donors/years', getUserOrgContext, requireVolunteer, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('donations')
      .select('created_at')
      .eq('org_id', req.orgId);
    if (error) throw error;
    const years = Array.from(new Set((data || []).map(row => new Date(row.created_at).getFullYear()))).sort((a, b) => b - a);
    res.json(years);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch donor years' });
  }
});

// Aggregate donor info for all fundraisers in a year or by fundraiser/type
router.get('/donors', getUserOrgContext, requireVolunteer, async (req, res) => {
  try {
    const { year, fundraiserId, type } = req.query;
    let query = supabase
      .from('donations')
      .select('*')
      .eq('org_id', req.orgId);
    if (year) query = query.gte('created_at', `${year}-08-01`).lte('created_at', `${parseInt(year) + 1}-06-30`);
    if (fundraiserId) query = query.eq('fundraiser_id', fundraiserId);
    if (type) query = query.eq('donor_type', type);
    const { data, error } = await query;
    if (error) throw error;
    // Aggregate donor info for charts
    const donorSummary = {
      totalDonations: data.reduce((sum, d) => sum + Number(d.amount || 0), 0),
      donorTypes: {},
      donors: {},
    };
    data.forEach(d => {
      donorSummary.donorTypes[d.donor_type] = (donorSummary.donorTypes[d.donor_type] || 0) + Number(d.amount || 0);
      donorSummary.donors[d.donor_id] = (donorSummary.donors[d.donor_id] || 0) + Number(d.amount || 0);
    });
    res.json(donorSummary);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch donor info' });
  }
});

// List all donor types
router.get('/donor-types', getUserOrgContext, requireVolunteer, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('donations')
      .select('donor_type')
      .eq('org_id', req.orgId);
    if (error) throw error;
    const types = Array.from(new Set((data || []).map(row => row.donor_type))).filter(Boolean);
    res.json(types);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch donor types' });
  }
});

export default router; 