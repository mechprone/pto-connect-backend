import express from 'express';
import { supabase } from '../util/verifySupabaseToken.js';
import { getUserOrgContext } from '../middleware/organizationalContext.js';
import { requireAdmin } from '../middleware/roleBasedAccess.js';

const router = express.Router();

// 🔐 GET /api/admin-users – Get all users in organization (admin only)
router.get('/', getUserOrgContext, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, role, approved, created_at')
      .eq('org_id', req.orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`❌ Error fetching admin user list for org ${req.orgId}:`, error.message);
      return res.status(500).json({ error: 'Failed to fetch user list' });
    }

    // Add full_name field for frontend compatibility
    const usersWithFullName = data.map(user => ({
      ...user,
      full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'No name provided'
    }));

    console.log(`✅ Admin retrieved ${data.length} users for org ${req.orgId}`);
    res.status(200).json(usersWithFullName);
  } catch (err) {
    console.error('❌ Admin user list error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

console.log('[adminUser.js] Routes loaded successfully');
export default router;
