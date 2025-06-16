import express from 'express';
import { supabase } from '../utils/supabaseClient.js';

const router = express.Router();

// GET /api/fundraisers/:id - fetch a single fundraiser by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'Fundraiser ID is required' });
  const { data, error } = await supabase
    .from('fundraisers')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') { // Not found
      return res.status(404).json({ error: 'Fundraiser not found' });
    }
    return res.status(500).json({ error: error.message });
  }
  if (!data) return res.status(404).json({ error: 'Fundraiser not found' });
  res.json(data);
});

// GET /api/fundraisers - fetch all fundraisers (optionally filter by org_id)
router.get('/', async (req, res) => {
  const { org_id } = req.query;
  let query = supabase.from('fundraisers').select('*');
  if (org_id) query = query.eq('org_id', org_id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router; 