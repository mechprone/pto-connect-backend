import express from 'express';
import { supabase } from '../util/verifySupabaseToken.js';
import { getUserOrgContext } from '../middleware/organizationalContext.js';
import { requireAdmin } from '../middleware/roleBasedAccess.js';

const router = express.Router();

// GET /api/admin/organization-permissions/templates - Get all permission templates
router.get('/templates', getUserOrgContext, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('organization_permission_templates')
      .select('*')
      .order('module_name', { ascending: true })
      .order('permission_name', { ascending: true });

    if (error) {
      console.error(`❌ Error fetching permission templates:`, error.message);
      return res.status(500).json({ error: 'Failed to fetch permission templates' });
    }

    // Group by module for easier frontend handling
    const groupedTemplates = data.reduce((acc, template) => {
      if (!acc[template.module_name]) {
        acc[template.module_name] = [];
      }
      acc[template.module_name].push(template);
      return acc;
    }, {});

    console.log(`✅ Retrieved ${data.length} permission templates`);
    res.json({
      templates: data,
      grouped: groupedTemplates
    });
  } catch (err) {
    console.error('[organizationPermissions.js] GET /templates error:', err.message);
    res.status(500).json({ error: 'Failed to fetch permission templates' });
  }
});

// GET /api/admin/organization-permissions - Get current organization's permission settings
router.get('/', getUserOrgContext, requireAdmin, async (req, res) => {
  try {
    // Get organization's custom permissions
    const { data: orgPermissions, error: orgError } = await supabase
      .from('organization_permissions')
      .select('*')
      .eq('org_id', req.orgId);

    if (orgError) {
      console.error(`❌ Error fetching org permissions for ${req.orgId}:`, orgError.message);
      return res.status(500).json({ error: 'Failed to fetch organization permissions' });
    }

    // Get all permission templates for reference
    const { data: templates, error: templatesError } = await supabase
      .from('organization_permission_templates')
      .select('*');

    if (templatesError) {
      console.error(`❌ Error fetching permission templates:`, templatesError.message);
      return res.status(500).json({ error: 'Failed to fetch permission templates' });
    }

    // Merge templates with organization-specific settings
    const permissionSettings = templates.map(template => {
      const orgSetting = orgPermissions.find(op => op.permission_key === template.permission_key);
      
      return {
        ...template,
        current_min_role: orgSetting ? orgSetting.min_role_required : template.default_min_role,
        specific_users: orgSetting ? orgSetting.specific_users : [],
        is_enabled: orgSetting ? orgSetting.is_enabled : true,
        has_custom_setting: !!orgSetting,
        org_permission_id: orgSetting ? orgSetting.id : null
      };
    });

    // Group by module
    const groupedSettings = permissionSettings.reduce((acc, setting) => {
      if (!acc[setting.module_name]) {
        acc[setting.module_name] = [];
      }
      acc[setting.module_name].push(setting);
      return acc;
    }, {});

    console.log(`✅ Retrieved permission settings for org ${req.orgId}`);
    res.json({
      permissions: permissionSettings,
      grouped: groupedSettings,
      organization_id: req.orgId
    });
  } catch (err) {
    console.error('[organizationPermissions.js] GET / error:', err.message);
    res.status(500).json({ error: 'Failed to fetch organization permissions' });
  }
});

// PUT /api/admin/organization-permissions/:permissionKey - Update a specific permission setting
router.put('/:permissionKey', getUserOrgContext, requireAdmin, async (req, res) => {
  try {
    const { permissionKey } = req.params;
    const { min_role_required, specific_users, is_enabled } = req.body;

    // Validate the permission key exists in templates
    const { data: template, error: templateError } = await supabase
      .from('organization_permission_templates')
      .select('permission_key')
      .eq('permission_key', permissionKey)
      .single();

    if (templateError || !template) {
      return res.status(404).json({ error: 'Permission template not found' });
    }

    // Validate role
    const validRoles = ['volunteer', 'committee_lead', 'board_member', 'admin'];
    if (!validRoles.includes(min_role_required)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }

    // Upsert the organization permission
    const { data, error } = await supabase
      .from('organization_permissions')
      .upsert({
        org_id: req.orgId,
        permission_key: permissionKey,
        min_role_required,
        specific_users: specific_users || [],
        is_enabled: is_enabled !== undefined ? is_enabled : true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'org_id,permission_key'
      })
      .select()
      .single();

    if (error) {
      console.error(`❌ Error updating permission ${permissionKey} for org ${req.orgId}:`, error.message);
      return res.status(500).json({ error: 'Failed to update permission' });
    }

    console.log(`✅ Updated permission ${permissionKey} for org ${req.orgId} by admin ${req.user.id}`);
    res.json({
      success: true,
      permission: data
    });
  } catch (err) {
    console.error('[organizationPermissions.js] PUT /:permissionKey error:', err.message);
    res.status(500).json({ error: 'Failed to update permission' });
  }
});

// POST /api/admin/organization-permissions/bulk-update - Update multiple permissions at once
router.post('/bulk-update', getUserOrgContext, requireAdmin, async (req, res) => {
  try {
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Permissions must be an array' });
    }

    const validRoles = ['volunteer', 'committee_lead', 'board_member', 'admin'];
    const updates = [];

    // Validate all permissions first
    for (const perm of permissions) {
      if (!perm.permission_key || !validRoles.includes(perm.min_role_required)) {
        return res.status(400).json({ 
          error: 'Invalid permission data',
          permission: perm.permission_key 
        });
      }

      updates.push({
        org_id: req.orgId,
        permission_key: perm.permission_key,
        min_role_required: perm.min_role_required,
        specific_users: perm.specific_users || [],
        is_enabled: perm.is_enabled !== undefined ? perm.is_enabled : true,
        updated_at: new Date().toISOString()
      });
    }

    // Perform bulk upsert
    const { data, error } = await supabase
      .from('organization_permissions')
      .upsert(updates, {
        onConflict: 'org_id,permission_key'
      })
      .select();

    if (error) {
      console.error(`❌ Error bulk updating permissions for org ${req.orgId}:`, error.message);
      return res.status(500).json({ error: 'Failed to update permissions' });
    }

    console.log(`✅ Bulk updated ${data.length} permissions for org ${req.orgId} by admin ${req.user.id}`);
    res.json({
      success: true,
      updated_count: data.length,
      permissions: data
    });
  } catch (err) {
    console.error('[organizationPermissions.js] POST /bulk-update error:', err.message);
    res.status(500).json({ error: 'Failed to bulk update permissions' });
  }
});

// DELETE /api/admin/organization-permissions/:permissionKey - Reset permission to default
router.delete('/:permissionKey', getUserOrgContext, requireAdmin, async (req, res) => {
  try {
    const { permissionKey } = req.params;

    const { error } = await supabase
      .from('organization_permissions')
      .delete()
      .eq('org_id', req.orgId)
      .eq('permission_key', permissionKey);

    if (error) {
      console.error(`❌ Error resetting permission ${permissionKey} for org ${req.orgId}:`, error.message);
      return res.status(500).json({ error: 'Failed to reset permission' });
    }

    console.log(`✅ Reset permission ${permissionKey} to default for org ${req.orgId} by admin ${req.user.id}`);
    res.json({
      success: true,
      message: 'Permission reset to default'
    });
  } catch (err) {
    console.error('[organizationPermissions.js] DELETE /:permissionKey error:', err.message);
    res.status(500).json({ error: 'Failed to reset permission' });
  }
});

// GET /api/admin/organization-permissions/user/:userId - Get specific user's permissions
router.get('/user/:userId', getUserOrgContext, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user belongs to the organization
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, org_id, role, first_name, last_name')
      .eq('user_id', userId)
      .eq('org_id', req.orgId)
      .single();

    if (profileError || !userProfile) {
      return res.status(404).json({ error: 'User not found in organization' });
    }

    // Get all permission templates
    const { data: templates, error: templatesError } = await supabase
      .from('organization_permission_templates')
      .select('permission_key, module_name, permission_name');

    if (templatesError) {
      console.error('Error fetching permission templates:', templatesError.message);
      return res.status(500).json({ error: 'Failed to fetch permissions' });
    }

    // Check each permission for the user
    const userPermissions = {};
    
    for (const template of templates) {
      const { data: hasPermission, error } = await supabase
        .rpc('user_has_org_permission', {
          user_id_param: userId,
          permission_key_param: template.permission_key
        });

      if (!error) {
        if (!userPermissions[template.module_name]) {
          userPermissions[template.module_name] = {};
        }
        userPermissions[template.module_name][template.permission_key] = {
          has_permission: hasPermission,
          permission_name: template.permission_name
        };
      }
    }

    console.log(`✅ Retrieved permissions for user ${userId} in org ${req.orgId}`);
    res.json({
      user: userProfile,
      permissions: userPermissions
    });
  } catch (err) {
    console.error('[organizationPermissions.js] GET /user/:userId error:', err.message);
    res.status(500).json({ error: 'Failed to get user permissions' });
  }
});

console.log('[organizationPermissions.js] Admin permission management routes loaded');
export default router;
