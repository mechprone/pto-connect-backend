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
    // Return permissions and grouped at the top level for frontend compatibility
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

    console.log(`✅ Updated ${data.length} permissions for org ${req.orgId} by admin ${req.user.id}`);
    res.json({
      success: true,
      updated_permissions: data
    });
  } catch (err) {
    console.error('[organizationPermissions.js] POST /bulk-update error:', err.message);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

console.log('[organizationPermissions.js] Admin permission management routes loaded');
export default router;