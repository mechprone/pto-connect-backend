import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { pool } from '../../db.js';
import { getUserOrgContext } from '../../middleware/organizationalContext.js';
import { requireVolunteer } from '../../middleware/roleBasedAccess.js';
import console from 'console';

const router = express.Router();

// Get overview analytics
router.get('/overview', authenticate, async (req, res) => {
  try {
    const { dateRange = '6months' } = req.query;
    const orgId = req.user.org_id;

    let dateFilter = '';
    switch (dateRange) {
      case '6months':
        dateFilter = 'AND donation_date >= NOW() - INTERVAL \'6 months\'';
        break;
      case '1year':
        dateFilter = 'AND donation_date >= NOW() - INTERVAL \'1 year\'';
        break;
      case 'all':
        dateFilter = '';
        break;
      default:
        dateFilter = 'AND donation_date >= NOW() - INTERVAL \'6 months\'';
    }

    const overviewQuery = `
      SELECT 
        (SELECT COALESCE(SUM(amount), 0) FROM donations 
         WHERE org_id = $1 AND donation_type = 'monetary' ${dateFilter}) as total_donations,
        (SELECT COALESCE(SUM(hours), 0) FROM volunteer_hours 
         WHERE org_id = $1 ${dateFilter}) as total_volunteer_hours,
        (SELECT COALESCE(SUM(estimated_value), 0) FROM supply_donations 
         WHERE org_id = $1 ${dateFilter}) as total_supply_value,
        (SELECT COUNT(DISTINCT donor_email) FROM donations 
         WHERE org_id = $1 AND donation_type = 'monetary' ${dateFilter}) as total_donors,
        (SELECT COUNT(*) FROM fundraising_campaigns 
         WHERE org_id = $1 AND status = 'active') as active_campaigns
    `;

    const { rows } = await pool.query(overviewQuery, [orgId]);
    const overviewData = rows[0];
    res.json({ success: true, data: overviewData });
  } catch (error) {
    console.error('Error fetching overview analytics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch overview analytics' });
  }
});

// Get donation trends
router.get('/trends', authenticate, async (req, res) => {
  try {
    const { dateRange = '6months' } = req.query;
    const orgId = req.user.org_id;

    let dateFilter = '';
    switch (dateRange) {
      case '6months':
        dateFilter = 'WHERE month >= NOW() - INTERVAL \'6 months\'';
        break;
      case '1year':
        dateFilter = 'WHERE month >= NOW() - INTERVAL \'1 year\'';
        break;
      case 'all':
        dateFilter = '';
        break;
      default:
        dateFilter = 'WHERE month >= NOW() - INTERVAL \'6 months\'';
    }

    const trendsQuery = `
      SELECT * FROM monthly_donation_trends 
      WHERE org_id = $1 ${dateFilter}
      ORDER BY month ASC
    `;

    const { rows } = await pool.query(trendsQuery, [orgId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching donation trends:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch donation trends' });
  }
});

// Get donor retention
router.get('/donor-retention', authenticate, async (req, res) => {
  try {
    const orgId = req.user.org_id;
    const { rows } = await pool.query(
      'SELECT * FROM donor_retention WHERE org_id = $1 ORDER BY total_donated DESC',
      [orgId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching donor retention:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch donor retention data' });
  }
});

// Get campaign performance
router.get('/campaigns', authenticate, async (req, res) => {
  try {
    const orgId = req.user.org_id;
    const { rows } = await pool.query(
      'SELECT * FROM campaign_performance WHERE org_id = $1 ORDER BY raised_amount DESC',
      [orgId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching campaign performance:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch campaign performance' });
  }
});

// Record new donation
router.post('/donations', authenticate, async (req, res) => {
  try {
    const {
      fundraiser_id,
      donor_name,
      donor_email,
      donor_phone,
      donation_type,
      amount,
      description,
      donation_date,
      is_recurring,
      frequency,
      category,
      payment_method
    } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO donations (
        org_id, fundraiser_id, donor_name, donor_email, donor_phone,
        donation_type, amount, description, donation_date, is_recurring,
        frequency, category, payment_method
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        req.user.org_id, fundraiser_id, donor_name, donor_email, donor_phone,
        donation_type, amount, description, donation_date, is_recurring,
        frequency, category, payment_method
      ]
    );

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error recording donation:', error);
    res.status(500).json({ success: false, error: 'Failed to record donation' });
  }
});

// Record volunteer hours
router.post('/volunteer-hours', authenticate, async (req, res) => {
  try {
    const {
      fundraiser_id,
      volunteer_id,
      hours,
      activity_description,
      date
    } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO volunteer_hours (
        org_id, fundraiser_id, volunteer_id, hours,
        activity_description, date
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [req.user.org_id, fundraiser_id, volunteer_id, hours, activity_description, date]
    );

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error recording volunteer hours:', error);
    res.status(500).json({ success: false, error: 'Failed to record volunteer hours' });
  }
});

// Record supply donation
router.post('/supplies', authenticate, async (req, res) => {
  try {
    const {
      fundraiser_id,
      donor_id,
      item_name,
      quantity,
      estimated_value,
      category,
      condition,
      notes,
      donation_date
    } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO supply_donations (
        org_id, fundraiser_id, donor_id, item_name,
        quantity, estimated_value, category, condition,
        notes, donation_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        req.user.org_id, fundraiser_id, donor_id, item_name,
        quantity, estimated_value, category, condition,
        notes, donation_date
      ]
    );

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error recording supply donation:', error);
    res.status(500).json({ success: false, error: 'Failed to record supply donation' });
  }
});

// Create new fundraising campaign
router.post('/campaigns', authenticate, async (req, res) => {
  try {
    const {
      name,
      description,
      goal_amount,
      start_date,
      end_date,
      campaign_type,
      associated_events,
      donation_methods
    } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO fundraising_campaigns (
        org_id, name, description, goal_amount,
        start_date, end_date, campaign_type,
        associated_events, donation_methods
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        req.user.org_id, name, description, goal_amount,
        start_date, end_date, campaign_type,
        associated_events, donation_methods
      ]
    );

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error creating fundraising campaign:', error);
    res.status(500).json({ success: false, error: 'Failed to create fundraising campaign' });
  }
});

export default router; 