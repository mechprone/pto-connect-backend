/**
 * Advanced Rate Limiting Middleware
 * Phase 2 Week 2 Day 7-8: Security Framework
 * 
 * Provides intelligent rate limiting with tier-based controls,
 * endpoint-specific limits, and comprehensive monitoring.
 */

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

// Redis client for rate limiting (fallback to memory if Redis unavailable)
let redis;
let useRedis = false;

try {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true
  });
  
  redis.on('connect', () => {
    console.log('✅ Redis connected for rate limiting');
    useRedis = true;
  });
  
  redis.on('error', (err) => {
    console.warn('⚠️ Redis connection failed, using memory store for rate limiting:', err.message);
    useRedis = false;
  });
} catch (err) {
  console.warn('⚠️ Redis initialization failed, using memory store for rate limiting:', err.message);
  useRedis = false;
}

// Rate limit tiers with different allowances
const RATE_LIMIT_TIERS = {
  free: { 
    requests: 100, 
    window: 15 * 60 * 1000, // 15 minutes
    burst: 10 // Allow 10 requests in quick succession
  },
  standard: { 
    requests: 1000, 
    window: 15 * 60 * 1000, // 15 minutes
    burst: 50
  },
  premium: { 
    requests: 5000, 
    window: 15 * 60 * 1000, // 15 minutes
    burst: 100
  },
  enterprise: { 
    requests: 10000, 
    window: 15 * 60 * 1000, // 15 minutes
    burst: 200
  }
};

// Endpoint-specific rate limits (more restrictive for sensitive operations)
const ENDPOINT_LIMITS = {
  '/api/auth/login': { requests: 5, window: 15 * 60 * 1000 }, // 5 login attempts per 15 minutes
  '/api/auth/register': { requests: 3, window: 60 * 60 * 1000 }, // 3 registrations per hour
  '/api/auth/reset-password': { requests: 3, window: 60 * 60 * 1000 }, // 3 password resets per hour
  '/api/admin/permissions': { requests: 100, window: 15 * 60 * 1000 }, // Admin operations
  '/api/admin/users': { requests: 200, window: 15 * 60 * 1000 },
  '/api/event': { requests: 500, window: 15 * 60 * 1000 }, // Event operations
  '/api/budget': { requests: 300, window: 15 * 60 * 1000 }, // Budget operations
  '/api/profile': { requests: 200, window: 15 * 60 * 1000 } // Profile operations
};

// Pre-create endpoint-specific limiters
const endpointLimiters = {};
for (const [endpoint, limit] of Object.entries(ENDPOINT_LIMITS)) {
  endpointLimiters[endpoint] = createRateLimiter('free', limit);
}

// Pre-create tier-based limiters
const freeLimiter = createRateLimiter('free');
const standardLimiter = createRateLimiter('standard');
const premiumLimiter = createRateLimiter('premium');
const enterpriseLimiter = createRateLimiter('enterprise');

/**
 * Create rate limiter based on tier and configuration
 */
export const createRateLimiter = (tier = 'standard', options = {}) => {
  const config = RATE_LIMIT_TIERS[tier] || RATE_LIMIT_TIERS.standard;
  const finalConfig = { ...config, ...options };
  
  const limiterOptions = {
    windowMs: finalConfig.window,
    max: finalConfig.requests,
    message: {
      success: false,
      data: null,
      meta: {
        timestamp: new Date().toISOString(),
        version: 'v1',
        rate_limit: {
          tier: tier,
          limit: finalConfig.requests,
          window_ms: finalConfig.window,
          reset_time: new Date(Date.now() + finalConfig.window).toISOString()
        }
      },
      errors: [{
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded. Maximum ${finalConfig.requests} requests per ${finalConfig.window / 60000} minutes for ${tier} tier.`,
        field: null,
        details: {
          tier: tier,
          limit: finalConfig.requests,
          window_minutes: finalConfig.window / 60000,
          retry_after: finalConfig.window / 1000
        }
      }]
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Priority order for rate limiting keys
      if (req.apiKey) {
        return `api_key:${req.apiKey.keyId}:${tier}`;
      }
      if (req.user) {
        return `user:${req.user.id}:${tier}`;
      }
      return `ip:${req.ip}:${tier}`;
    },
    skip: (req) => {
      // Skip rate limiting for health checks and documentation
      const skipPaths = ['/api/health', '/api/docs', '/api/docs/openapi.json', '/api/docs/openapi.yaml'];
      return skipPaths.includes(req.path);
    },
    onLimitReached: (req, res, options) => {
      const identifier = req.apiKey?.name || req.user?.email || req.ip;
      console.warn(`🚫 Rate limit exceeded for ${identifier} on ${tier} tier (${finalConfig.requests}/${finalConfig.window / 60000}min)`);
      
      // Record rate limit violation for monitoring
      recordRateLimitViolation(req, tier, finalConfig);
    }
  };

  // Use Redis store if available, otherwise fall back to memory
  if (useRedis && redis) {
    limiterOptions.store = new RedisStore({
      sendCommand: (...args) => redis.call(...args),
    });
  }

  return rateLimit(limiterOptions);
};

/**
 * Smart rate limiter that adapts based on authentication method and tier
 */
export const smartRateLimit = (req, res, next) => {
  // Determine appropriate tier
  let tier = 'free';
  if (req.apiKey) {
    tier = req.apiKey.rateLimitTier || 'standard';
  } else if (req.user) {
    tier = getUserTier(req.user);
  }

  // Check for endpoint-specific limits
  const endpoint = req.route?.path || req.path;
  if (endpointLimiters[endpoint]) {
    return endpointLimiters[endpoint](req, res, next);
  }

  // Use pre-created tier-based limiter
  switch (tier) {
    case 'enterprise':
      return enterpriseLimiter(req, res, next);
    case 'premium':
      return premiumLimiter(req, res, next);
    case 'standard':
      return standardLimiter(req, res, next);
    default:
      return freeLimiter(req, res, next);
  }
};

/**
 * Endpoint-specific rate limiters
 */
export const authRateLimit = createRateLimiter('free', ENDPOINT_LIMITS['/api/auth/login']);
export const registerRateLimit = createRateLimiter('free', ENDPOINT_LIMITS['/api/auth/register']);
export const passwordResetRateLimit = createRateLimiter('free', ENDPOINT_LIMITS['/api/auth/reset-password']);

export const apiRateLimit = createRateLimiter('standard');
export const premiumRateLimit = createRateLimiter('premium');
export const enterpriseRateLimit = createRateLimiter('enterprise');

/**
 * Admin operations rate limiter (more permissive for admin users)
 */
export const adminRateLimit = (req, res, next) => {
  // Use a more permissive limiter for admin operations
  return premiumLimiter(req, res, next);
};

/**
 * Burst rate limiter for handling traffic spikes
 */
export const burstRateLimit = (tier = 'standard') => {
  const config = RATE_LIMIT_TIERS[tier] || RATE_LIMIT_TIERS.standard;
  
  return createRateLimiter(tier, {
    requests: config.burst,
    window: 60 * 1000 // 1 minute window for burst
  });
};

/**
 * Get user tier based on organization subscription or role
 */
function getUserTier(user) {
  if (!user) return 'free';
  
  // Check organization subscription status
  if (user.organization?.subscription_status === 'enterprise') {
    return 'enterprise';
  }
  if (user.organization?.subscription_status === 'premium') {
    return 'premium';
  }
  if (user.organization?.subscription_status === 'standard') {
    return 'standard';
  }
  
  // Check user role for elevated access
  if (user.role === 'admin' || user.role === 'super_admin') {
    return 'premium';
  }
  
  return 'standard';
}

/**
 * Record rate limit violations for monitoring and analysis
 */
async function recordRateLimitViolation(req, tier, config) {
  try {
    const violation = {
      timestamp: new Date().toISOString(),
      identifier: req.apiKey?.keyId || req.user?.id || req.ip,
      identifier_type: req.apiKey ? 'api_key' : req.user ? 'user' : 'ip',
      tier: tier,
      endpoint: req.originalUrl,
      method: req.method,
      limit: config.requests,
      window_ms: config.window,
      user_agent: req.get('user-agent'),
      ip_address: req.ip
    };

    // Store in Redis for monitoring dashboard
    if (useRedis && redis) {
      await redis.lpush('rate_limit_violations', JSON.stringify(violation));
      await redis.ltrim('rate_limit_violations', 0, 999); // Keep last 1000 violations
    }

    console.warn('🚫 Rate limit violation recorded:', violation);
  } catch (err) {
    console.error('❌ Failed to record rate limit violation:', err.message);
  }
}

/**
 * Get rate limit status for current request
 */
export const getRateLimitStatus = async (req) => {
  try {
    const tier = req.apiKey?.rateLimitTier || getUserTier(req.user) || 'free';
    const config = RATE_LIMIT_TIERS[tier];
    const key = req.apiKey ? `api_key:${req.apiKey.keyId}:${tier}` : 
                req.user ? `user:${req.user.id}:${tier}` : 
                `ip:${req.ip}:${tier}`;

    let remaining = config.requests;
    let resetTime = new Date(Date.now() + config.window);

    if (useRedis && redis) {
      const current = await redis.get(`rl:${key}`);
      if (current) {
        remaining = Math.max(0, config.requests - parseInt(current));
        const ttl = await redis.ttl(`rl:${key}`);
        resetTime = new Date(Date.now() + (ttl * 1000));
      }
    }

    return {
      tier,
      limit: config.requests,
      remaining,
      resetTime: resetTime.toISOString(),
      windowMs: config.window
    };
  } catch (err) {
    console.error('❌ Failed to get rate limit status:', err.message);
    return null;
  }
};

/**
 * Get rate limit violations for monitoring
 */
export const getRateLimitViolations = async (limit = 100) => {
  try {
    if (!useRedis || !redis) {
      return [];
    }

    const violations = await redis.lrange('rate_limit_violations', 0, limit - 1);
    return violations.map(v => JSON.parse(v));
  } catch (err) {
    console.error('❌ Failed to get rate limit violations:', err.message);
    return [];
  }
};

/**
 * Clear rate limit for specific key (admin function)
 */
export const clearRateLimit = async (identifier, tier = 'standard') => {
  try {
    if (!useRedis || !redis) {
      console.warn('⚠️ Cannot clear rate limit: Redis not available');
      return false;
    }

    const key = `rl:${identifier}:${tier}`;
    await redis.del(key);
    console.log(`✅ Rate limit cleared for ${identifier} (${tier})`);
    return true;
  } catch (err) {
    console.error('❌ Failed to clear rate limit:', err.message);
    return false;
  }
};

console.log('[rateLimiting.js] Advanced rate limiting middleware loaded');
