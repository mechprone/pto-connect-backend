import express from 'express';
import { verifySupabaseToken, supabase } from '../util/verifySupabaseToken.js';

const router = express.Router();

// 🔐 GET /api/admin-users – Get all users in organization (admin only)
router.get('/', async (req, res) => {
  try {
    // Get auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed auth token' });
    }

    const token = authHeader.split(' ')[1];
    const user = await verifySupabaseToken(token);

    // Get user profile with organizational context
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    if (profile.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get all users in the organization
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, role, approved, created_at')
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`❌ Error fetching admin user list for org ${profile.org_id}:`, error.message);
      return res.status(500).json({ error: 'Failed to fetch user list' });
    }

    // Add full_name field for frontend compatibility
    const usersWithFullName = data.map(user => ({
      ...user,
      full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'No name provided'
    }));

    console.log(`✅ Admin retrieved ${data.length} users for org ${profile.org_id}`);
    res.status(200).json(usersWithFullName);
  } catch (err) {
    console.error('❌ Admin user list error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

console.log('[adminUser.js] Routes loaded successfully');
export default router;
