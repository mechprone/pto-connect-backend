import { verifySupabaseToken, supabase } from '../util/verifySupabaseToken.js';

/**
 * Middleware to add organizational context to requests
 * Adds user, orgId, and userRole to req object
 */
export const getUserOrgContext = async (req, res, next) => {
  console.log('🔍 [DEBUG] getUserOrgContext middleware started');
  console.log('🔍 [DEBUG] Request URL:', req.url);
  console.log('🔍 [DEBUG] Request method:', req.method);
  
  try {
    const authHeader = req.headers.authorization;
    console.log('🔍 [DEBUG] Auth header present:', !!authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ [DEBUG] Missing or malformed auth token');
      return res.status(401).json({ error: 'Missing or malformed auth token' });
    }

    const token = authHeader.split(' ')[1];
    console.log('🔍 [DEBUG] Token extracted, length:', token.length);
    
    const user = await verifySupabaseToken(token);
    console.log('🔍 [DEBUG] User verified:', user.id);

    // Get user profile with organizational context
    console.log('🔍 [DEBUG] Fetching profile for user:', user.id);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id, role, full_name, first_name, last_name, email, approved')
      .eq('id', user.id)
      .single();

    console.log('🔍 [DEBUG] Profile query result:');
    console.log('🔍 [DEBUG] - Profile data:', profile);
    console.log('🔍 [DEBUG] - Profile error:', profileError);

    if (profileError) {
      console.error(`❌ [DEBUG] Error fetching profile for user ${user.id}:`, profileError);
      console.error(`❌ [DEBUG] Error code:`, profileError.code);
      console.error(`❌ [DEBUG] Error message:`, profileError.message);
      console.error(`❌ [DEBUG] Error details:`, profileError.details);
      return res.status(500).json({ 
        success: false,
        errors: [{ message: 'Error fetching user profile' }],
        debug: {
          userId: user.id,
          errorCode: profileError.code,
          errorMessage: profileError.message
        }
      });
    }

    if (!profile) {
      console.warn(`⚠️ [DEBUG] No profile found for user ${user.id}`);
      return res.status(404).json({ 
        success: false,
        errors: [{ message: 'User profile not found' }],
        debug: { userId: user.id }
      });
    }

    console.log('🔍 [DEBUG] Profile found:', {
      userId: user.id,
      orgId: profile.org_id,
      role: profile.role,
      email: profile.email
    });

    if (!profile.org_id) {
      console.warn(`⚠️ [DEBUG] User ${user.id} has no organization assigned`);
      return res.status(403).json({ 
        success: false,
        errors: [{ message: 'User not assigned to an organization' }],
        debug: { userId: user.id, profile }
      });
    }

    // Add context to request object
    req.user = user;
    req.profile = profile;
    req.orgId = profile.org_id;
    req.userRole = profile.role || 'member'; // Default role if not specified

    console.log(`✅ [DEBUG] User context set successfully: ${user.id} (${req.userRole}) in org ${profile.org_id}`);
    next();
  } catch (error) {
    console.error('❌ [DEBUG] Organizational context middleware error:', error);
    console.error('❌ [DEBUG] Error stack:', error.stack);
    res.status(401).json({ 
      success: false,
      errors: [{ message: 'Invalid or expired token' }],
      debug: { errorMessage: error.message }
    });
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
