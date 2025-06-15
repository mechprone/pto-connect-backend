/* eslint-disable no-console */
import express from 'express';
import { supabase } from '../util/verifySupabaseToken.js';
import { requireActiveSubscription } from '../requireSubscription.js';
import { getUserOrgContext } from '../middleware/organizationalContext.js';
import { requireAdmin, canManageUsers } from '../middleware/roleBasedAccess.js';

const router = express.Router();

// ✅ GET /api/profiles – Get all users in organization (admin only)
router.get('/', requireActiveSubscription, getUserOrgContext, canManageUsers, async (req, res) => {
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, role, approved, created_at')
      .eq('org_id', req.orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`❌ Error fetching profiles for org ${req.orgId}:`, error.message);
      return res.status(500).json({ error: 'Error fetching user profiles' });
    }

    console.log(`✅ Retrieved ${profiles.length} profiles for org ${req.orgId}`);
    res.status(200).json({
      message: 'Profiles retrieved successfully',
      profiles
    });
  } catch (err) {
    console.error('❌ Get profiles error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ PATCH /api/profiles/:id/approve – Approve a user
router.patch('/:id/approve', requireActiveSubscription, getUserOrgContext, canManageUsers, async (req, res) => {
  try {
    const userId = req.params.id;

    // Verify user belongs to same organization
    const { data: targetProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error(`❌ Error fetching target profile ${userId}:`, fetchError.message);
      return res.status(500).json({ error: 'Error fetching user profile' });
    }

    if (targetProfile.org_id !== req.orgId) {
      console.warn(`🚫 Cross-org access denied: User ${userId} not in org ${req.orgId}`);
      return res.status(403).json({ error: 'User not in your organization' });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ approved: true })
      .eq('id', userId);

    if (error) {
      console.error(`❌ Failed to approve user [${userId}]:`, error.message);
      return res.status(500).json({ error: 'Failed to approve user' });
    }

    console.info(`✅ User [${userId}] approved by [${req.user?.id}] in org [${req.orgId}]`);
    res.status(200).json({ message: 'User approved successfully' });
  } catch (err) {
    console.error('❌ Approve user error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ PATCH /api/profiles/:id/role – Update user role
router.patch('/:id/role', requireActiveSubscription, getUserOrgContext, canManageUsers, async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;

    const validRoles = ['admin', 'board_member', 'committee_lead', 'volunteer', 'parent_member', 'teacher'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }

    // Verify user belongs to same organization
    const { data: targetProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error(`❌ Error fetching target profile ${userId}:`, fetchError.message);
      return res.status(500).json({ error: 'Error fetching user profile' });
    }

    if (targetProfile.org_id !== req.orgId) {
      console.warn(`🚫 Cross-org access denied: User ${userId} not in org ${req.orgId}`);
      return res.status(403).json({ error: 'User not in your organization' });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId);

    if (error) {
      console.error(`❌ Failed to update role for user [${userId}]:`, error.message);
      return res.status(500).json({ error: 'Failed to update user role' });
    }

    console.info(`✅ User [${userId}] role updated to [${role}] by [${req.user?.id}] in org [${req.orgId}]`);
    res.status(200).json({ message: 'User role updated successfully' });
  } catch (err) {
    console.error('❌ Update role error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ DELETE /api/profiles/:id – Delete a user
router.delete('/:id', requireActiveSubscription, getUserOrgContext, canManageUsers, async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent self-deletion
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Verify user belongs to same organization
    const { data: targetProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error(`❌ Error fetching target profile ${userId}:`, fetchError.message);
      return res.status(500).json({ error: 'Error fetching user profile' });
    }

    if (targetProfile.org_id !== req.orgId) {
      console.warn(`🚫 Cross-org access denied: User ${userId} not in org ${req.orgId}`);
      return res.status(403).json({ error: 'User not in your organization' });
    }

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) {
      console.error(`❌ Failed to delete user [${userId}]:`, error.message);
      return res.status(500).json({ error: 'Failed to delete user' });
    }

    console.info(`🗑️ User [${userId}] deleted by [${req.user?.id}] in org [${req.orgId}]`);
    res.status(204).send();
  } catch (err) {
    console.error('❌ Delete user error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

console.log('[profile.js] Routes loaded successfully');
export default router;
