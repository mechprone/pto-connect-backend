/**
 * API Key Authentication Middleware
 * Phase 2 Week 2 Day 7-8: Security Framework
 * 
 * Provides secure API key authentication for third-party integrations
 * with role-based permissions and usage tracking.
 */

import crypto from 'crypto';
import { supabase } from '../util/verifySupabaseToken.js';

/**
 * Authenticate API key from request headers
 * Supports both JWT and API key authentication
 */
export const authenticateApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  // If no API key provided, continue to JWT authentication
  if (!apiKey) {
    return next();
  }

  const startTime = Date.now();

  try {
    // Validate API key format
    if (!apiKey.includes('.') || apiKey.split('.').length !== 2) {
      return sendApiKeyError(res, req, 'API_KEY_INVALID_FORMAT', 'Invalid API key format', 'x-api-key', 'API key must be in format: keyid.secret');
    }

    // Extract key ID and secret from API key
    const [keyId, keySecret] = apiKey.split('.');
    
    if (!keyId || !keySecret || keyId.length !== 8 || keySecret.length !== 32) {
      return sendApiKeyError(res, req, 'API_KEY_INVALID_FORMAT', 'Invalid API key format', 'x-api-key', 'Key ID must be 8 characters and secret must be 32 characters');
    }

    // Hash the secret for comparison
    const keyHash = crypto.createHash('sha256').update(keySecret).digest('hex');

    // Verify API key in database
    const { data: apiKeyData, error } = await supabase
      .from('api_keys')
      .select(`
        *,
        organizations (
          id,
          name,
          type,
          subscription_status
        ),
        profiles!created_by (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('key_id', keyId)
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (error || !apiKeyData) {
      console.warn(`🔑 Invalid API key attempt: ${keyId} from IP ${req.ip}`);
      return sendApiKeyError(res, req, 'API_KEY_INVALID', 'Invalid or inactive API key', 'x-api-key');
    }

    // Check expiration
    if (apiKeyData.expires_at && new Date(apiKeyData.expires_at) < new Date()) {
      console.warn(`🔑 Expired API key used: ${keyId} (expired: ${apiKeyData.expires_at})`);
      return sendApiKeyError(res, req, 'API_KEY_EXPIRED', 'API key has expired', 'x-api-key', `Key expired on ${apiKeyData.expires_at}`);
    }

    // Add API key context to request
    req.apiKey = {
      id: apiKeyData.id,
      keyId: apiKeyData.key_id,
      name: apiKeyData.name,
      permissions: apiKeyData.permissions || {},
      rateLimitTier: apiKeyData.rate_limit_tier,
      createdBy: apiKeyData.profiles,
      lastUsedAt: apiKeyData.last_used_at
    };

    req.orgId = apiKeyData.org_id;
    req.organization = apiKeyData.organizations;
    req.authMethod = 'api_key';

    // Update last used timestamp (async, don't wait)
    updateLastUsed(apiKeyData.id);

    // Record API key usage for analytics (async, don't wait)
    recordUsage(req, apiKeyData.id, startTime);

    console.log(`✅ API Key authenticated: ${apiKeyData.name} (${keyId}) for org ${apiKeyData.organizations?.name}`);
    next();

  } catch (err) {
    console.error('❌ API Key authentication error:', err.message);
    return sendApiKeyError(res, req, 'INTERNAL_SERVER_ERROR', 'Authentication service error');
  }
};

/**
 * Require API key authentication (no fallback to JWT)
 */
export const requireApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return sendApiKeyError(res, req, 'API_KEY_REQUIRED', 'API key is required for this endpoint', 'x-api-key', 'Include API key in x-api-key header');
  }

  // Use the main authentication middleware
  return authenticateApiKey(req, res, next);
};

/**
 * Check if API key has specific permission
 */
export const requireApiKeyPermission = (permission) => {
  return (req, res, next) => {
    if (!req.apiKey) {
      return sendApiKeyError(res, req, 'API_KEY_REQUIRED', 'API key authentication required');
    }

    const permissions = req.apiKey.permissions || {};
    
    // Check if permission exists and is true
    if (!permissions[permission]) {
      console.warn(`🚫 API Key permission denied: ${req.apiKey.name} lacks ${permission}`);
      return sendApiKeyError(res, req, 'INSUFFICIENT_PERMISSIONS', `API key lacks required permission: ${permission}`, null, `Required permission: ${permission}`);
    }

    console.log(`✅ API Key permission granted: ${req.apiKey.name} has ${permission}`);
    next();
  };
};

/**
 * Check API key rate limit tier
 */
export const requireApiKeyTier = (minTier) => {
  const tierHierarchy = {
    'free': 0,
    'standard': 1,
    'premium': 2,
    'enterprise': 3
  };

  return (req, res, next) => {
    if (!req.apiKey) {
      return sendApiKeyError(res, req, 'API_KEY_REQUIRED', 'API key authentication required');
    }

    const currentTier = req.apiKey.rateLimitTier || 'free';
    const currentLevel = tierHierarchy[currentTier] || 0;
    const requiredLevel = tierHierarchy[minTier] || 0;

    if (currentLevel < requiredLevel) {
      console.warn(`🚫 API Key tier insufficient: ${req.apiKey.name} has ${currentTier}, requires ${minTier}`);
      return sendApiKeyError(res, req, 'INSUFFICIENT_TIER', `API key tier insufficient. Required: ${minTier}, Current: ${currentTier}`, null, `Upgrade to ${minTier} tier or higher`);
    }

    console.log(`✅ API Key tier sufficient: ${req.apiKey.name} has ${currentTier} (>= ${minTier})`);
    next();
  };
};

/**
 * Send standardized API key error response
 */
function sendApiKeyError(res, req, code, message, field = null, details = null) {
  const statusCode = getStatusCodeForError(code);
  
  return res.status(statusCode).json({
    success: false,
    data: null,
    meta: {
      timestamp: new Date().toISOString(),
      request_id: req.requestId || generateRequestId(),
      version: 'v1',
      endpoint: req.originalUrl,
      method: req.method
    },
    errors: [{
      code,
      message,
      field,
      details
    }]
  });
}

/**
 * Get appropriate HTTP status code for error type
 */
function getStatusCodeForError(code) {
  const statusCodes = {
    'API_KEY_REQUIRED': 401,
    'API_KEY_INVALID_FORMAT': 400,
    'API_KEY_INVALID': 401,
    'API_KEY_EXPIRED': 401,
    'INSUFFICIENT_PERMISSIONS': 403,
    'INSUFFICIENT_TIER': 403,
    'INTERNAL_SERVER_ERROR': 500
  };
  
  return statusCodes[code] || 400;
}

/**
 * Update API key last used timestamp (async)
 */
async function updateLastUsed(apiKeyId) {
  try {
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKeyId);
  } catch (err) {
    console.error('❌ Failed to update API key last used timestamp:', err.message);
  }
}

/**
 * Record API key usage for analytics (async)
 */
async function recordUsage(req, apiKeyId, startTime) {
  try {
    const responseTime = Date.now() - startTime;
    const requestSize = req.get('content-length') ? parseInt(req.get('content-length')) : null;
    
    await supabase
      .from('api_key_usage')
      .insert({
        api_key_id: apiKeyId,
        endpoint: req.originalUrl,
        method: req.method,
        status_code: 200, // Will be updated by response middleware if different
        response_time_ms: responseTime,
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        request_size_bytes: requestSize
      });
  } catch (err) {
    console.error('❌ Failed to record API key usage:', err.message);
  }
}

/**
 * Generate request ID if not present
 */
function generateRequestId() {
  return 'req_' + crypto.randomBytes(6).toString('hex');
}

/**
 * Get API key info for current request
 */
export const getApiKeyInfo = (req) => {
  if (!req.apiKey) {
    return null;
  }

  return {
    id: req.apiKey.id,
    keyId: req.apiKey.keyId,
    name: req.apiKey.name,
    permissions: req.apiKey.permissions,
    rateLimitTier: req.apiKey.rateLimitTier,
    organization: req.organization?.name,
    lastUsedAt: req.apiKey.lastUsedAt
  };
};

console.log('[apiKeyAuth.js] API Key authentication middleware loaded');
