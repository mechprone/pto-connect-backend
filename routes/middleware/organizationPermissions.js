import { supabase } from '../util/verifySupabaseToken.js';

/**
 * Enhanced middleware for organization-specific permission checking
 * Allows each PTO admin to customize which roles can perform which actions
 */

/**
 * Check if user has a specific organization permission
 * @param {string} permissionKey - The permission key to check (e.g., 'can_create_messages')
 * @returns {Function} Express middleware function
 */
export const requireOrgPermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.orgId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Use the database function to check organization-specific permissions
      const { data, error } = await supabase
        .rpc('user_has_org_permission', {
          user_id_param: req.user.id,
          permission_key_param: permissionKey
        });

      if (error) {
        console.error(`❌ Error checking permission ${permissionKey} for user ${req.user.id}:`, error.message);
        return res.status(500).json({ error: 'Permission check failed' });
      }

      if (!data) {
        console.warn(`🚫 Permission denied: User ${req.user.id} lacks permission ${permissionKey} in org ${req.orgId}`);
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          permission: permissionKey,
          message: 'Your role does not have permission to perform this action. Contact your organization administrator.'
        });
      }

      console.log(`✅ Permission granted: User ${req.user.id} has permission ${permissionKey} in org ${req.orgId}`);
      next();
    } catch (err) {
      console.error(`[organizationPermissions.js] Error checking permission ${permissionKey}:`, err.message);
      res.status(500).json({ error: 'Permission validation failed' });
    }
  };
};

/**
 * Middleware functions for specific module permissions
 * These provide convenient shortcuts for common permission checks
 */

// Communications Module Permissions
export const canViewMessages = requireOrgPermission('can_view_messages');
export const canCreateMessages = requireOrgPermission('can_create_messages');
export const canEditMessages = requireOrgPermission('can_edit_messages');
export const canDeleteMessages = requireOrgPermission('can_delete_messages');
export const canCreateEmailDrafts = requireOrgPermission('can_create_email_drafts');
export const canSendEmails = requireOrgPermission('can_send_emails');

// Budget Module Permissions
export const canViewBudget = requireOrgPermission('can_view_budget');
export const canCreateBudgetItems = requireOrgPermission('can_create_budget_items');
export const canEditBudgetItems = requireOrgPermission('can_edit_budget_items');
export const canDeleteBudgetItems = requireOrgPermission('can_delete_budget_items');
export const canApproveExpenses = requireOrgPermission('can_approve_expenses');

// Events Module Permissions
export const canViewEvents = requireOrgPermission('can_view_events');
export const canCreateEvents = requireOrgPermission('can_create_events');
export const canEditEvents = requireOrgPermission('can_edit_events');
export const canDeleteEvents = requireOrgPermission('can_delete_events');
export const canManageVolunteers = requireOrgPermission('can_manage_volunteers');

// Fundraising Module Permissions
export const canViewFundraisers = requireOrgPermission('can_view_fundraisers');
export const canCreateFundraisers = requireOrgPermission('can_create_fundraisers');
export const canEditFundraisers = requireOrgPermission('can_edit_fundraisers');
export const canDeleteFundraisers = requireOrgPermission('can_delete_fundraisers');

// Documents Module Permissions
export const canViewDocuments = requireOrgPermission('can_view_documents');
export const canUploadDocuments = requireOrgPermission('can_upload_documents');
export const canDeleteDocuments = requireOrgPermission('can_delete_documents');

// Teacher Requests Module Permissions
export const canViewRequests = requireOrgPermission('can_view_requests');
export const canCreateRequests = requireOrgPermission('can_create_requests');
export const canFulfillRequests = requireOrgPermission('can_fulfill_requests');

// User Management Module Permissions
export const canViewUsers = requireOrgPermission('can_view_users');
export const canEditUserRoles = requireOrgPermission('can_edit_user_roles');
export const canInviteUsers = requireOrgPermission('can_invite_users');
export const canRemoveUsers = requireOrgPermission('can_remove_users');

/**
 * Helper function to get all permissions for a user
 * Useful for frontend to determine what UI elements to show
 */
export const getUserPermissions = async (req, res, next) => {
  try {
    if (!req.user || !req.orgId) {
      return res.status(401).json({ error: 'Authentication required' });
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
          user_id_param: req.user.id,
          permission_key_param: template.permission_key
        });

      if (!error) {
        if (!userPermissions[template.module_name]) {
          userPermissions[template.module_name] = {};
        }
        userPermissions[template.module_name][template.permission_key] = hasPermission;
      }
    }

    req.userPermissions = userPermissions;
    next();
  } catch (err) {
    console.error('[organizationPermissions.js] Error getting user permissions:', err.message);
    res.status(500).json({ error: 'Failed to get user permissions' });
  }
};

/**
 * Utility function to check multiple permissions at once
 * @param {string[]} permissionKeys - Array of permission keys to check
 * @param {string} operator - 'AND' (all required) or 'OR' (any required)
 */
export const requireMultiplePermissions = (permissionKeys, operator = 'AND') => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.orgId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const permissionChecks = await Promise.all(
        permissionKeys.map(async (permissionKey) => {
          const { data, error } = await supabase
            .rpc('user_has_org_permission', {
              user_id_param: req.user.id,
              permission_key_param: permissionKey
            });
          
          if (error) {
            console.error(`Error checking permission ${permissionKey}:`, error.message);
            return false;
          }
          
          return data;
        })
      );

      let hasAccess = false;
      if (operator === 'AND') {
        hasAccess = permissionChecks.every(check => check === true);
      } else if (operator === 'OR') {
        hasAccess = permissionChecks.some(check => check === true);
      }

      if (!hasAccess) {
        console.warn(`🚫 Multiple permission check failed for user ${req.user.id} in org ${req.orgId}`);
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          permissions: permissionKeys,
          operator,
          message: 'Your role does not have the required permissions to perform this action.'
        });
      }

      next();
    } catch (err) {
      console.error('[organizationPermissions.js] Error checking multiple permissions:', err.message);
      res.status(500).json({ error: 'Permission validation failed' });
    }
  };
};

console.log('[organizationPermissions.js] Organization-specific permission middleware loaded');
