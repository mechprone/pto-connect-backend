/**
 * API Response Caching Middleware
 * Phase 2 Week 2 Day 9-10: Performance Optimization
 * 
 * Provides intelligent API response caching with permission-aware cache keys,
 * Redis integration, and comprehensive cache management.
 */

import Redis from 'ioredis';
import crypto from 'crypto';

// Redis client for caching (fallback to memory if unavailable)
let redis;
let useRedis = false;

try {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true
  });
  
  redis.on('connect', () => {
    console.log('✅ Redis connected for API caching');
    useRedis = true;
  });
  
  redis.on('error', (err) => {
    console.warn('⚠️ Redis connection failed, caching disabled:', err.message);
    useRedis = false;
  });
} catch (err) {
  console.warn('⚠️ Redis initialization failed, caching disabled:', err.message);
  useRedis = false;
}

// In-memory cache fallback (limited capacity)
const memoryCache = new Map();
const MEMORY_CACHE_LIMIT = 1000;

// Cache configuration with endpoint-specific settings
const CACHE_CONFIG = {
  defaultTTL: 300, // 5 minutes
  maxTTL: 3600,    // 1 hour
  endpoints: {
    // Public endpoints - longer cache times
    '/api/health': { ttl: 60, permissions: [] },
    '/api/docs': { ttl: 3600, permissions: [] },
    
    // User data - medium cache times
    '/api/profile': { ttl: 900, permissions: ['profile.read'] },
    '/api/profile/:id': { ttl: 600, permissions: ['profile.read'] },
    
    // Organization data - medium cache times
    '/api/organization': { ttl: 1800, permissions: ['organization.read'] },
    '/api/organization/:id': { ttl: 1200, permissions: ['organization.read'] },
    
    // Events - shorter cache times (frequently updated)
    '/api/event': { ttl: 300, permissions: ['events.read'] },
    '/api/event/:id': { ttl: 600, permissions: ['events.read'] },
    
    // Budget data - medium cache times
    '/api/budget': { ttl: 900, permissions: ['budget.read'] },
    '/api/budget/:id': { ttl: 1200, permissions: ['budget.read'] },
    
    // Admin data - shorter cache times (sensitive)
    '/api/admin/permissions': { ttl: 300, permissions: ['admin.read'] },
    '/api/admin/users': { ttl: 180, permissions: ['admin.read'] },
    '/api/admin/analytics': { ttl: 120, permissions: ['admin.read'] },
    
    // Documents - longer cache times (less frequently updated)
    '/api/document': { ttl: 1800, permissions: ['documents.read'] },
    '/api/document/:id': { ttl: 3600, permissions: ['documents.read'] }
  }
};

// Cache statistics
const cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  invalidations: 0,
  errors: 0
};

/**
 * Main API caching middleware
 */
export const apiCache = (options = {}) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching if Redis is unavailable and memory cache is disabled
    if (!useRedis && !options.useMemoryFallback) {
      return next();
    }

    const endpoint = req.route?.path || req.path;
    const config = getCacheConfig(endpoint, options);

    // Skip caching for non-cacheable endpoints
    if (config.ttl === 0) {
      return next();
    }

    // Generate permission-aware cache key
    const cacheKey = await generateCacheKey(req, endpoint);
    
    if (!cacheKey) {
      return next();
    }

    try {
      // Check cache for existing response
      const cachedResponse = await getFromCache(cacheKey);
      
      if (cachedResponse) {
        // Cache hit - return cached response
        const data = JSON.parse(cachedResponse);
        
        // Add cache metadata
        data.meta = {
          ...data.meta,
          cache_hit: true,
          cache_key: cacheKey.substring(0, 16) + '...',
          cache_ttl: config.ttl,
          cached_at: data.meta.cached_at || new Date().toISOString()
        };

        cacheStats.hits++;
        console.log(`✅ Cache HIT: ${endpoint} - Key: ${cacheKey.substring(0, 16)}... - TTL: ${config.ttl}s`);
        
        return res.json(data);
      }

      // Cache miss - continue to route handler and cache response
      cacheStats.misses++;
      console.log(`❌ Cache MISS: ${endpoint} - Key: ${cacheKey.substring(0, 16)}... - TTL: ${config.ttl}s`);

      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = function(data) {
        // Only cache successful responses
        if (data && data.success !== false && res.statusCode < 400) {
          // Add cache metadata
          const cacheableData = {
            ...data,
            meta: {
              ...data.meta,
              cache_hit: false,
              cache_ttl: config.ttl,
              cached_at: new Date().toISOString()
            }
          };

          // Cache the response (async, don't wait)
          setInCache(cacheKey, JSON.stringify(cacheableData), config.ttl)
            .then(() => {
              cacheStats.sets++;
              console.log(`✅ Cache SET: ${endpoint} - TTL: ${config.ttl}s - Key: ${cacheKey.substring(0, 16)}...`);
            })
            .catch(err => {
              cacheStats.errors++;
              console.error('❌ Cache SET error:', err.message);
            });

          return originalJson.call(this, cacheableData);
        }

        return originalJson.call(this, data);
      };

      next();

    } catch (err) {
      cacheStats.errors++;
      console.error('❌ Cache middleware error:', err.message);
      next(); // Continue without caching on error
    }
  };
};

/**
 * Generate permission-aware cache key
 */
async function generateCacheKey(req, endpoint) {
  try {
    const components = [
      'api_cache',
      'v1', // API version
      endpoint.replace(/:/g, '_'), // Replace route parameters
      req.orgId || 'no_org',
      req.user?.id || req.apiKey?.keyId || 'anonymous'
    ];

    // Add user role/permissions context
    if (req.user?.role) {
      components.push(req.user.role);
    } else if (req.apiKey?.rateLimitTier) {
      components.push(req.apiKey.rateLimitTier);
    } else {
      components.push('guest');
    }

    // Add query parameters to cache key (sorted for consistency)
    if (Object.keys(req.query).length > 0) {
      const sortedQuery = Object.keys(req.query)
        .sort()
        .map(key => `${key}=${req.query[key]}`)
        .join('&');
      components.push(crypto.createHash('md5').update(sortedQuery).digest('hex'));
    }

    // Add route parameters (for parameterized routes like /api/event/:id)
    if (req.params && Object.keys(req.params).length > 0) {
      const sortedParams = Object.keys(req.params)
        .sort()
        .map(key => `${key}=${req.params[key]}`)
        .join('&');
      components.push(crypto.createHash('md5').update(sortedParams).digest('hex'));
    }

    return components.join(':');
  } catch (err) {
    console.error('❌ Failed to generate cache key:', err.message);
    return null;
  }
}

/**
 * Get cache configuration for endpoint
 */
function getCacheConfig(endpoint, options = {}) {
  // Check for exact endpoint match
  let config = CACHE_CONFIG.endpoints[endpoint];
  
  // Check for parameterized route matches
  if (!config) {
    for (const [pattern, patternConfig] of Object.entries(CACHE_CONFIG.endpoints)) {
      if (pattern.includes(':') && matchesPattern(endpoint, pattern)) {
        config = patternConfig;
        break;
      }
    }
  }
  
  // Use default config if no match found
  if (!config) {
    config = { ttl: CACHE_CONFIG.defaultTTL, permissions: [] };
  }

  // Apply options overrides
  return {
    ttl: Math.min(options.ttl || config.ttl, CACHE_CONFIG.maxTTL),
    permissions: config.permissions || []
  };
}

/**
 * Check if endpoint matches a parameterized pattern
 */
function matchesPattern(endpoint, pattern) {
  const endpointParts = endpoint.split('/');
  const patternParts = pattern.split('/');
  
  if (endpointParts.length !== patternParts.length) {
    return false;
  }
  
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      continue; // Parameter match
    }
    if (patternParts[i] !== endpointParts[i]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get data from cache (Redis or memory)
 */
async function getFromCache(key) {
  try {
    if (useRedis && redis) {
      return await redis.get(key);
    } else {
      const cached = memoryCache.get(key);
      if (cached && cached.expires > Date.now()) {
        return cached.data;
      } else if (cached) {
        memoryCache.delete(key); // Remove expired entry
      }
      return null;
    }
  } catch (err) {
    console.error('❌ Cache GET error:', err.message);
    return null;
  }
}

/**
 * Set data in cache (Redis or memory)
 */
async function setInCache(key, data, ttl) {
  try {
    if (useRedis && redis) {
      await redis.setex(key, ttl, data);
    } else {
      // Memory cache with size limit
      if (memoryCache.size >= MEMORY_CACHE_LIMIT) {
        // Remove oldest entries
        const oldestKey = memoryCache.keys().next().value;
        memoryCache.delete(oldestKey);
      }
      
      memoryCache.set(key, {
        data,
        expires: Date.now() + (ttl * 1000)
      });
    }
  } catch (err) {
    console.error('❌ Cache SET error:', err.message);
    throw err;
  }
}

/**
 * Cache invalidation utilities
 */
export const invalidateCache = async (pattern) => {
  try {
    if (useRedis && redis) {
      const keys = await redis.keys(`api_cache:*${pattern}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
        cacheStats.invalidations += keys.length;
        console.log(`✅ Cache invalidated: ${keys.length} keys matching pattern "${pattern}"`);
        return keys.length;
      }
    } else {
      // Memory cache invalidation
      let count = 0;
      for (const key of memoryCache.keys()) {
        if (key.includes(pattern)) {
          memoryCache.delete(key);
          count++;
        }
      }
      if (count > 0) {
        cacheStats.invalidations += count;
        console.log(`✅ Memory cache invalidated: ${count} keys matching pattern "${pattern}"`);
      }
      return count;
    }
    return 0;
  } catch (err) {
    console.error('❌ Cache invalidation error:', err.message);
    return 0;
  }
};

/**
 * Organization-specific cache invalidation
 */
export const invalidateOrgCache = async (orgId) => {
  return await invalidateCache(`:${orgId}:`);
};

/**
 * User-specific cache invalidation
 */
export const invalidateUserCache = async (userId) => {
  return await invalidateCache(`:${userId}:`);
};

/**
 * Endpoint-specific cache invalidation
 */
export const invalidateEndpointCache = async (endpoint) => {
  const cleanEndpoint = endpoint.replace(/:/g, '_');
  return await invalidateCache(`:${cleanEndpoint}:`);
};

/**
 * Clear all cache
 */
export const clearAllCache = async () => {
  try {
    if (useRedis && redis) {
      const keys = await redis.keys('api_cache:*');
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`✅ All cache cleared: ${keys.length} keys removed`);
        return keys.length;
      }
    } else {
      const count = memoryCache.size;
      memoryCache.clear();
      console.log(`✅ Memory cache cleared: ${count} keys removed`);
      return count;
    }
    return 0;
  } catch (err) {
    console.error('❌ Failed to clear cache:', err.message);
    return 0;
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = async () => {
  try {
    let cacheSize = 0;
    let memoryUsage = 0;

    if (useRedis && redis) {
      const keys = await redis.keys('api_cache:*');
      cacheSize = keys.length;
      
      // Get Redis memory usage (approximate)
      const info = await redis.info('memory');
      const memoryMatch = info.match(/used_memory:(\d+)/);
      memoryUsage = memoryMatch ? parseInt(memoryMatch[1]) : 0;
    } else {
      cacheSize = memoryCache.size;
      memoryUsage = JSON.stringify([...memoryCache.entries()]).length;
    }

    const hitRate = cacheStats.hits + cacheStats.misses > 0 
      ? ((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100).toFixed(2)
      : '0.00';

    return {
      ...cacheStats,
      hitRate: hitRate + '%',
      cacheSize,
      memoryUsage,
      redisConnected: useRedis,
      uptime: process.uptime()
    };
  } catch (err) {
    console.error('❌ Failed to get cache stats:', err.message);
    return {
      ...cacheStats,
      hitRate: '0.00%',
      cacheSize: 0,
      memoryUsage: 0,
      redisConnected: false,
      error: err.message
    };
  }
};

/**
 * Reset cache statistics
 */
export const resetCacheStats = () => {
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.sets = 0;
  cacheStats.invalidations = 0;
  cacheStats.errors = 0;
  console.log('📊 Cache statistics reset');
};

/**
 * Warm up cache for common endpoints
 */
export const warmUpCache = async (endpoints = []) => {
  console.log('🔥 Starting cache warm-up...');
  
  for (const endpoint of endpoints) {
    try {
      // This would typically make requests to warm up the cache
      // For now, we'll just log the intention
      console.log(`🔥 Warming up cache for ${endpoint}`);
    } catch (err) {
      console.error(`❌ Failed to warm up cache for ${endpoint}:`, err.message);
    }
  }
  
  console.log('🔥 Cache warm-up completed');
};

/**
 * Cache health check
 */
export const cacheHealthCheck = async () => {
  try {
    if (useRedis && redis) {
      await redis.ping();
      return { status: 'healthy', type: 'redis', connected: true };
    } else {
      return { 
        status: 'healthy', 
        type: 'memory', 
        connected: false, 
        size: memoryCache.size,
        limit: MEMORY_CACHE_LIMIT
      };
    }
  } catch (err) {
    return { 
      status: 'unhealthy', 
      type: useRedis ? 'redis' : 'memory', 
      connected: false, 
      error: err.message 
    };
  }
};

console.log('[apiCaching.js] API caching middleware loaded');
