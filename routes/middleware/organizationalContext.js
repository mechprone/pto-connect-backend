import { verifySupabaseToken, supabase } from '../util/verifySupabaseToken.js';

/**
 * Middleware to add organizational context to requests
 * Adds user, orgId, and userRole to req object
 */
export const getUserOrgContext = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed auth token' });
    }

    const token = authHeader.split(' ')[1];
    const user = await verifySupabaseToken(token);

    // Get user profile with organizational context
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id, role, first_name, last_name, email')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error(`❌ Error fetching profile for user ${user.id}:`, profileError.message);
      return res.status(500).json({ error: 'Error fetching user profile' });
    }

    if (!profile) {
      console.warn(`⚠️ No profile found for user ${user.id}`);
      return res.status(404).json({ error: 'User profile not found' });
    }

    if (!profile.org_id) {
      console.warn(`⚠️ User ${user.id} has no organization assigned`);
      return res.status(403).json({ error: 'User not assigned to an organization' });
    }

    // Add context to request object
    req.user = user;
    req.profile = profile;
    req.orgId = profile.org_id;
    req.userRole = profile.role;

    console.log(`✅ User context: ${user.id} (${profile.role}) in org ${profile.org_id}`);
    next();
  } catch (error) {
    console.error('❌ Organizational context middleware error:', error.message);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Middleware to verify user belongs to the same organization as the resource
 * Requires orgId to be set in req object (from getUserOrgContext)
 */
export const validateOrganizationalAccess = (resourceOrgIdField = 'org_id') => {
  return (req, res, next) => {
    const userOrgId = req.orgId;
    const resourceOrgId = req.body[resourceOrgIdField] || req.params[resourceOrgIdField] || req.query[resourceOrgIdField];

    if (!userOrgId) {
      console.warn('⚠️ validateOrganizationalAccess: No user org_id in request');
      return res.status(403).json({ error: 'User organization context missing' });
    }

    if (resourceOrgId && resourceOrgId !== userOrgId) {
      console.warn(`🚫 Organizational access denied: User org ${userOrgId} != Resource org ${resourceOrgId}`);
      return res.status(403).json({ error: 'Access denied: Resource belongs to different organization' });
    }

    next();
  };
};

/**
 * Middleware to automatically add user's org_id to request body for creation operations
 */
export const addUserOrgToBody = (req, res, next) => {
  if (req.orgId && (req.method === 'POST' || req.method === 'PUT')) {
    req.body.org_id = req.orgId;
    console.log(`📝 Added org_id ${req.orgId} to request body`);
  }
  next();
};

/**
 * Get organization details for the current user
 */
export const getOrganizationDetails = async (req, res, next) => {
  try {
    if (!req.orgId) {
      return res.status(400).json({ error: 'Organization ID not found in request context' });
    }

    const { data: organization, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', req.orgId)
      .single();

    if (error) {
      console.error(`❌ Error fetching organization ${req.orgId}:`, error.message);
      return res.status(500).json({ error: 'Error fetching organization details' });
    }

    req.organization = organization;
    next();
  } catch (error) {
    console.error('❌ Get organization details error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

console.log('[organizationalContext.js] Middleware loaded successfully');
