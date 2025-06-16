import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { getUserOrgContext } from '../middleware/organizationalContext.js';
import { supabase } from '../util/verifySupabaseToken.js';

const router = express.Router();

// Monetary Donations Report
router.get('/monetary-donations', authenticate, getUserOrgContext, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('donations')
      .select('id, donor_name, donor_email, amount, created_at')
      .eq('org_id', req.orgId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Volunteer Hours Report
router.get('/volunteer-hours', authenticate, getUserOrgContext, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('volunteer_hours')
      .select('id, volunteer_name, hours, date')
      .eq('org_id', req.orgId)
      .order('date', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Supply Donations Report
router.get('/supply-donations', authenticate, getUserOrgContext, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('supply_donations')
      .select('id, donor_id, item_name, quantity, estimated_value, donation_date, status')
      .eq('org_id', req.orgId)
      .order('donation_date', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Top Donors Report
router.get('/top-donors', authenticate, getUserOrgContext, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_top_donors', { org_id: req.orgId });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Recurring Donors Report
router.get('/recurring-donors', authenticate, getUserOrgContext, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_recurring_donors', { org_id: req.orgId });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Donor Retention Report
router.get('/donor-retention', authenticate, getUserOrgContext, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_donor_retention', { org_id: req.orgId });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Campaign Performance Report
router.get('/campaign-performance', authenticate, getUserOrgContext, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_campaign_performance', { org_id: req.orgId });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Year-over-Year Comparison Report
router.get('/year-over-year', authenticate, getUserOrgContext, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_year_over_year', { org_id: req.orgId });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router; 