import express from 'express';
import { verifySupabaseToken, supabase } from '../util/verifySupabaseToken.js';
import { getUserOrgContext } from '../middleware/organizationalContext.js';

const router = express.Router();

// 🔐 GET /api/auth/check – Token verification endpoint
router.get('/check', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed auth token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const user = await verifySupabaseToken(token);
    res.status(200).json({
      message: 'Token verified',
      user
    });
  } catch (err) {
    res.status(401).json({
      error: 'Unauthorized',
      details: err.message
    });
  }
});

// 🔐 GET /api/auth/profile – Get user profile with organizational context
router.get('/profile', getUserOrgContext, async (req, res) => {
  try {
    // Get full profile with organization details
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select(`
        *,
        organizations (
          id,
          name,
          type,
          subscription_status,
          trial_ends_at
        )
      `)
      .eq('id', req.user.id)
      .single();

    if (profileError) {
      console.error(`❌ Error fetching full profile for user ${req.user.id}:`, profileError.message);
      return res.status(500).json({ error: 'Error fetching user profile' });
    }

    res.status(200).json({
      message: 'Profile retrieved successfully',
      profile: profileData,
      organization: profileData.organizations
    });
  } catch (err) {
    console.error('❌ Profile endpoint error:', err.message);
    res.status(500).json({
      error: 'Internal server error',
      details: err.message
    });
  }
});

// 🔐 PATCH /api/auth/profile – Update user profile
router.patch('/profile', getUserOrgContext, async (req, res) => {
  try {
    const allowedFields = ['first_name', 'last_name', 'phone', 'children'];
    const updates = {};
    
    // Only allow updating specific fields
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      console.error(`❌ Error updating profile for user ${req.user.id}:`, error.message);
      return res.status(500).json({ error: 'Error updating profile' });
    }

    console.log(`✅ Profile updated for user ${req.user.id}`);
    res.status(200).json({
      message: 'Profile updated successfully',
      profile: data
    });
  } catch (err) {
    console.error('❌ Profile update error:', err.message);
    res.status(500).json({
      error: 'Internal server error',
      details: err.message
    });
  }
});

console.log('[auth.js] Routes loaded successfully');
export default router;
