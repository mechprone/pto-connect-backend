/**
 * Role-based access control middleware
 * Requires getUserOrgContext to be run first to set req.userRole
 */

// Role hierarchy for permission checking
const roleHierarchy = {
  'admin': 5,
  'board_member': 4,
  'committee_lead': 3,
  'volunteer': 2,
  'parent_member': 1,
  'teacher': 1
};

/**
 * Middleware to require a minimum role level
 * @param {string} requiredRole - The minimum role required
 */
export const requireMinRole = (requiredRole) => {
  return (req, res, next) => {
    const userRole = req.userRole;
    
    if (!userRole) {
      console.warn('⚠️ requireMinRole: No user role in request context');
      return res.status(403).json({ error: 'User role not found in request context' });
    }

    const userLevel = roleHierarchy[userRole] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    if (userLevel < requiredLevel) {
      console.warn(`🚫 Role access denied: User role '${userRole}' (${userLevel}) < required '${requiredRole}' (${requiredLevel})`);
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: requiredRole,
        current: userRole
      });
    }

    console.log(`✅ Role access granted: User role '${userRole}' >= required '${requiredRole}'`);
    next();
  };
};

/**
 * Middleware to require any of the specified roles
 * @param {string[]} allowedRoles - Array of acceptable roles
 */
export const requireAnyRole = (allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.userRole;
    
    if (!userRole) {
      console.warn('⚠️ requireAnyRole: No user role in request context');
      return res.status(403).json({ error: 'User role not found in request context' });
    }

    if (!allowedRoles.includes(userRole)) {
      console.warn(`🚫 Role access denied: User role '${userRole}' not in allowed roles [${allowedRoles.join(', ')}]`);
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        allowed: allowedRoles,
        current: userRole
      });
    }

    console.log(`✅ Role access granted: User role '${userRole}' in allowed roles`);
    next();
  };
};

/**
 * Middleware to require exact role match
 * @param {string} exactRole - The exact role required
 */
export const requireExactRole = (exactRole) => {
  return (req, res, next) => {
    const userRole = req.userRole;
    
    if (!userRole) {
      console.warn('⚠️ requireExactRole: No user role in request context');
      return res.status(403).json({ error: 'User role not found in request context' });
    }

    if (userRole !== exactRole) {
      console.warn(`🚫 Role access denied: User role '${userRole}' != required '${exactRole}'`);
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: exactRole,
        current: userRole
      });
    }

    console.log(`✅ Role access granted: User role '${userRole}' matches required role`);
    next();
  };
};

/**
 * Middleware to require admin role
 */
export const requireAdmin = requireExactRole('admin');

/**
 * Middleware to require board member or higher
 */
export const requireBoardMember = requireMinRole('board_member');

/**
 * Middleware to require committee lead or higher
 */
export const requireCommitteeLead = requireMinRole('committee_lead');

/**
 * Middleware to require volunteer or higher
 */
export const requireVolunteer = requireMinRole('volunteer');

/**
 * Middleware to check if user can manage other users
 * Only admins can manage users
 */
export const canManageUsers = requireAdmin;

/**
 * Middleware to check if user can manage events
 * Committee leads and above can manage events
 */
export const canManageEvents = requireCommitteeLead;

/**
 * Middleware to check if user can manage budget
 * Committee leads and above can manage budget
 */
export const canManageBudget = requireCommitteeLead;

/**
 * Middleware to check if user can manage communications
 * Committee leads and above can manage communications
 */
export const canManageCommunications = requireCommitteeLead;

/**
 * Middleware to check if user can view reports
 * Board members and above can view reports
 */
export const canViewReports = requireBoardMember;

/**
 * Middleware to check if user owns a resource
 * Compares user ID with resource creator/owner
 */
export const requireResourceOwnership = (ownerField = 'created_by') => {
  return (req, res, next) => {
    const userId = req.user?.id;
    const resourceOwnerId = req.body[ownerField] || req.params[ownerField] || req.query[ownerField];

    if (!userId) {
      console.warn('⚠️ requireResourceOwnership: No user ID in request context');
      return res.status(403).json({ error: 'User context missing' });
    }

    // If no resource owner specified, allow (for creation operations)
    if (!resourceOwnerId) {
      next();
      return;
    }

    if (resourceOwnerId !== userId) {
      console.warn(`🚫 Ownership access denied: User ${userId} != Resource owner ${resourceOwnerId}`);
      return res.status(403).json({ error: 'Access denied: You can only access your own resources' });
    }

    console.log(`✅ Ownership access granted: User ${userId} owns resource`);
    next();
  };
};

/**
 * Middleware to allow resource ownership OR minimum role
 * Useful for operations where users can manage their own content OR admins can manage all
 */
export const requireOwnershipOrRole = (ownerField = 'created_by', minRole = 'admin') => {
  return (req, res, next) => {
    const userId = req.user?.id;
    const userRole = req.userRole;
    const resourceOwnerId = req.body[ownerField] || req.params[ownerField] || req.query[ownerField];

    if (!userId || !userRole) {
      console.warn('⚠️ requireOwnershipOrRole: Missing user context');
      return res.status(403).json({ error: 'User context missing' });
    }

    // Check if user owns the resource
    if (resourceOwnerId === userId) {
      console.log(`✅ Access granted: User ${userId} owns resource`);
      next();
      return;
    }

    // Check if user has sufficient role
    const userLevel = roleHierarchy[userRole] || 0;
    const requiredLevel = roleHierarchy[minRole] || 0;

    if (userLevel >= requiredLevel) {
      console.log(`✅ Access granted: User role '${userRole}' >= required '${minRole}'`);
      next();
      return;
    }

    console.warn(`🚫 Access denied: User ${userId} doesn't own resource and role '${userRole}' < required '${minRole}'`);
    res.status(403).json({ 
      error: 'Access denied: Insufficient permissions',
      required: `Own the resource or have role '${minRole}' or higher`,
      current: userRole
    });
  };
};

console.log('[roleBasedAccess.js] Middleware loaded successfully');
