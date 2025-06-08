import express from 'express';
import { supabase } from '../util/verifySupabaseToken.js';
import { getUserOrgContext, addUserOrgToBody } from '../middleware/organizationalContext.js';
import { requireVolunteer } from '../middleware/roleBasedAccess.js';

const router = express.Router();

// GET /api/teacher-requests – Get all teacher requests for user's organization
router.get('/', getUserOrgContext, requireVolunteer, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('teacher_requests')
      .select('*')
      .eq('org_id', req.orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`❌ Error fetching teacher requests for org ${req.orgId}:`, error.message);
      return res.status(500).json({ error: 'Failed to fetch teacher requests' });
    }

    console.log(`✅ Retrieved ${data.length} teacher requests for org ${req.orgId}`);
    res.json(data);
  } catch (err) {
    console.error('[teacherRequest.js] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch teacher requests' });
  }
});

// POST /api/teacher-requests – Create new teacher request (volunteer+ required)
router.post('/', getUserOrgContext, addUserOrgToBody, requireVolunteer, async (req, res) => {
  try {
    const { 
      title, 
      description, 
      category, 
      priority, 
      deadline,
      grade_level,
      subject,
      items_needed,
      estimated_cost
    } = req.body;

    const { data, error } = await supabase
      .from('teacher_requests')
      .insert([{
        title,
        description,
        category,
        priority,
        deadline,
        grade_level,
        subject,
        items_needed,
        estimated_cost,
        created_by: req.user.id,
        org_id: req.body.org_id // Added by addUserOrgToBody middleware
      }])
      .select()
      .single();

    if (error) {
      console.error(`❌ Error creating teacher request for org ${req.orgId}:`, error.message);
      return res.status(500).json({ error: 'Failed to create teacher request' });
    }

    console.log(`✅ Teacher request created for org ${req.orgId} by user ${req.user.id}`);
    res.status(201).json({
      success: true,
      request: data
    });
  } catch (err) {
    console.error('[teacherRequest.js] POST error:', err.message);
    res.status(500).json({ error: 'Failed to create teacher request' });
  }
});

console.log('[teacherRequest.js] Routes loaded successfully');
export default router;
