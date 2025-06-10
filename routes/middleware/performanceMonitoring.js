/**
 * Performance Monitoring Middleware
 * Phase 2 Week 2 Day 9-10: Performance Optimization
 * 
 * Provides comprehensive API performance monitoring, metrics collection,
 * and real-time analytics for optimization and alerting.
 */

import { performance } from 'perf_hooks';
import Redis from 'ioredis';

// Redis client for metrics storage (fallback to memory if unavailable)
let redis;
let useRedis = false;

try {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true
  });
  
  redis.on('connect', () => {
    console.log('✅ Redis connected for performance monitoring');
    useRedis = true;
  });
  
  redis.on('error', (err) => {
    console.warn('⚠️ Redis connection failed, using memory store for performance monitoring:', err.message);
    useRedis = false;
  });
} catch (err) {
  console.warn('⚠️ Redis initialization failed, using memory store for performance monitoring:', err.message);
  useRedis = false;
}

// In-memory metrics storage (fallback)
const memoryMetrics = {
  requests: new Map(),
  endpoints: new Map(),
  errors: new Map(),
  slowRequests: [],
  hourlyStats: new Map()
};

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  slow: 1000,      // 1 second
  warning: 500,    // 500ms
  fast: 100,       // 100ms
  critical: 5000   // 5 seconds
};

// Metrics retention settings
const METRICS_RETENTION = {
  detailed: 24 * 60 * 60, // 24 hours in seconds
  hourly: 30 * 24 * 60 * 60, // 30 days in seconds
  daily: 365 * 24 * 60 * 60  // 1 year in seconds
};

/**
 * Main performance monitoring middleware
 */
export const performanceMonitoring = (req, res, next) => {
  const startTime = performance.now();
  const timestamp = new Date();
  const requestId = req.requestId || generateRequestId();

  // Track request start
  req.startTime = startTime;
  req.timestamp = timestamp;
  req.requestId = requestId;

  // Get request size
  const requestSize = getRequestSize(req);

  // Override res.json to capture response metrics
  const originalJson = res.json;
  const originalSend = res.send;
  const originalEnd = res.end;

  let responseData = null;
  let responseSent = false;

  res.json = function(data) {
    if (!responseSent) {
      responseData = data;
      captureMetrics(req, res, responseData, requestSize);
      responseSent = true;
    }
    return originalJson.call(this, data);
  };

  res.send = function(data) {
    if (!responseSent) {
      responseData = data;
      captureMetrics(req, res, responseData, requestSize);
      responseSent = true;
    }
    return originalSend.call(this, data);
  };

  res.end = function(data) {
    if (!responseSent) {
      responseData = data;
      captureMetrics(req, res, responseData, requestSize);
      responseSent = true;
    }
    return originalEnd.call(this, data);
  };

  next();
};

/**
 * Capture and record performance metrics
 */
async function captureMetrics(req, res, responseData, requestSize) {
  try {
    const endTime = performance.now();
    const responseTime = Math.round(endTime - req.startTime);
    const endpoint = req.route?.path || req.path;
    const method = req.method;
    const statusCode = res.statusCode;
    const success = responseData?.success !== false && statusCode < 400;
    const responseSize = getResponseSize(responseData);

    const metrics = {
      requestId: req.requestId,
      timestamp: req.timestamp.toISOString(),
      endpoint,
      method,
      statusCode,
      success,
      responseTime,
      requestSize,
      responseSize,
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
      authMethod: req.authMethod || (req.user ? 'jwt' : req.apiKey ? 'api_key' : 'anonymous'),
      userId: req.user?.id,
      apiKeyId: req.apiKey?.keyId,
      orgId: req.orgId,
      cacheHit: responseData?.meta?.cache_hit || false
    };

    // Record metrics
    await recordMetrics(metrics);

    // Log based on performance
    logPerformance(metrics);

  } catch (err) {
    console.error('❌ Failed to capture performance metrics:', err.message);
  }
}

/**
 * Record metrics to storage (Redis or memory)
 */
async function recordMetrics(metrics) {
  try {
    if (useRedis && redis) {
      await recordMetricsToRedis(metrics);
    } else {
      recordMetricsToMemory(metrics);
    }
  } catch (err) {
    console.error('❌ Failed to record metrics:', err.message);
    // Fallback to memory if Redis fails
    recordMetricsToMemory(metrics);
  }
}

/**
 * Record metrics to Redis
 */
async function recordMetricsToRedis(metrics) {
  const pipeline = redis.pipeline();
  const timestamp = Date.now();
  const hour = Math.floor(timestamp / (60 * 60 * 1000));
  const day = Math.floor(timestamp / (24 * 60 * 60 * 1000));

  // Store detailed request metrics
  const requestKey = `metrics:requests:${metrics.requestId}`;
  pipeline.hmset(requestKey, metrics);
  pipeline.expire(requestKey, METRICS_RETENTION.detailed);

  // Update endpoint statistics
  const endpointKey = `metrics:endpoints:${metrics.method}:${metrics.endpoint}`;
  pipeline.hincrby(endpointKey, 'count', 1);
  pipeline.hincrby(endpointKey, 'totalTime', metrics.responseTime);
  pipeline.hincrby(endpointKey, 'errors', metrics.success ? 0 : 1);
  
  // Update min/max response times
  const currentMin = await redis.hget(endpointKey, 'minTime');
  const currentMax = await redis.hget(endpointKey, 'maxTime');
  
  if (!currentMin || metrics.responseTime < parseInt(currentMin)) {
    pipeline.hset(endpointKey, 'minTime', metrics.responseTime);
  }
  if (!currentMax || metrics.responseTime > parseInt(currentMax)) {
    pipeline.hset(endpointKey, 'maxTime', metrics.responseTime);
  }
  
  pipeline.hset(endpointKey, 'lastRequest', metrics.timestamp);
  pipeline.expire(endpointKey, METRICS_RETENTION.hourly);

  // Store hourly aggregates
  const hourlyKey = `metrics:hourly:${hour}`;
  pipeline.hincrby(hourlyKey, 'requests', 1);
  pipeline.hincrby(hourlyKey, 'totalTime', metrics.responseTime);
  pipeline.hincrby(hourlyKey, 'errors', metrics.success ? 0 : 1);
  pipeline.hincrby(hourlyKey, 'cacheHits', metrics.cacheHit ? 1 : 0);
  pipeline.expire(hourlyKey, METRICS_RETENTION.hourly);

  // Store daily aggregates
  const dailyKey = `metrics:daily:${day}`;
  pipeline.hincrby(dailyKey, 'requests', 1);
  pipeline.hincrby(dailyKey, 'totalTime', metrics.responseTime);
  pipeline.hincrby(dailyKey, 'errors', metrics.success ? 0 : 1);
  pipeline.hincrby(dailyKey, 'cacheHits', metrics.cacheHit ? 1 : 0);
  pipeline.expire(dailyKey, METRICS_RETENTION.daily);

  // Store slow requests for analysis
  if (metrics.responseTime > PERFORMANCE_THRESHOLDS.slow) {
    const slowRequestKey = `metrics:slow:${timestamp}:${metrics.requestId}`;
    pipeline.hmset(slowRequestKey, metrics);
    pipeline.expire(slowRequestKey, METRICS_RETENTION.detailed);
    pipeline.zadd('metrics:slow_requests', timestamp, slowRequestKey);
    pipeline.zremrangebyrank('metrics:slow_requests', 0, -1001); // Keep last 1000
  }

  await pipeline.exec();
}

/**
 * Record metrics to memory (fallback)
 */
function recordMetricsToMemory(metrics) {
  const requestKey = `${metrics.method}:${metrics.endpoint}`;
  
  if (!memoryMetrics.requests.has(requestKey)) {
    memoryMetrics.requests.set(requestKey, {
      count: 0,
      totalTime: 0,
      minTime: Infinity,
      maxTime: 0,
      errors: 0,
      lastRequest: null
    });
  }

  const requestMetrics = memoryMetrics.requests.get(requestKey);
  requestMetrics.count++;
  requestMetrics.totalTime += metrics.responseTime;
  requestMetrics.minTime = Math.min(requestMetrics.minTime, metrics.responseTime);
  requestMetrics.maxTime = Math.max(requestMetrics.maxTime, metrics.responseTime);
  requestMetrics.lastRequest = metrics.timestamp;

  if (!metrics.success) {
    requestMetrics.errors++;
  }

  // Store slow requests
  if (metrics.responseTime > PERFORMANCE_THRESHOLDS.slow) {
    memoryMetrics.slowRequests.push(metrics);
    if (memoryMetrics.slowRequests.length > 100) {
      memoryMetrics.slowRequests.shift(); // Keep last 100
    }
  }
}

/**
 * Log performance based on response time
 */
function logPerformance(metrics) {
  const { endpoint, method, responseTime, success, cacheHit } = metrics;
  const cacheStatus = cacheHit ? '💾' : '';
  
  if (responseTime > PERFORMANCE_THRESHOLDS.critical) {
    console.error(`🚨 CRITICAL: ${method} ${endpoint} - ${responseTime}ms ${cacheStatus}`);
  } else if (responseTime > PERFORMANCE_THRESHOLDS.slow) {
    console.warn(`🐌 SLOW: ${method} ${endpoint} - ${responseTime}ms ${cacheStatus}`);
  } else if (responseTime > PERFORMANCE_THRESHOLDS.warning) {
    console.warn(`⚠️ WARNING: ${method} ${endpoint} - ${responseTime}ms ${cacheStatus}`);
  } else if (responseTime < PERFORMANCE_THRESHOLDS.fast) {
    console.log(`⚡ FAST: ${method} ${endpoint} - ${responseTime}ms ${cacheStatus}`);
  }

  if (!success) {
    console.error(`❌ ERROR: ${method} ${endpoint} - Status: ${metrics.statusCode} - Time: ${responseTime}ms`);
  }
}

/**
 * Get comprehensive performance metrics
 */
export const getPerformanceMetrics = async () => {
  try {
    if (useRedis && redis) {
      return await getMetricsFromRedis();
    } else {
      return getMetricsFromMemory();
    }
  } catch (err) {
    console.error('❌ Failed to get performance metrics:', err.message);
    return getMetricsFromMemory();
  }
};

/**
 * Get metrics from Redis
 */
async function getMetricsFromRedis() {
  const endpointKeys = await redis.keys('metrics:endpoints:*');
  const endpoints = [];
  let totalRequests = 0;
  let totalErrors = 0;
  let totalTime = 0;

  for (const key of endpointKeys) {
    const data = await redis.hgetall(key);
    const endpoint = key.replace('metrics:endpoints:', '');
    const count = parseInt(data.count) || 0;
    const errors = parseInt(data.errors) || 0;
    const endpointTotalTime = parseInt(data.totalTime) || 0;

    totalRequests += count;
    totalErrors += errors;
    totalTime += endpointTotalTime;

    endpoints.push({
      endpoint,
      requests: count,
      errors,
      errorRate: count > 0 ? ((errors / count) * 100).toFixed(2) + '%' : '0%',
      avgResponseTime: count > 0 ? Math.round(endpointTotalTime / count) : 0,
      minResponseTime: parseInt(data.minTime) || 0,
      maxResponseTime: parseInt(data.maxTime) || 0,
      lastRequest: data.lastRequest
    });
  }

  return {
    totalRequests,
    totalErrors,
    errorRate: totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(2) + '%' : '0%',
    averageResponseTime: totalRequests > 0 ? Math.round(totalTime / totalRequests) : 0,
    endpoints: endpoints.sort((a, b) => b.requests - a.requests)
  };
}

/**
 * Get metrics from memory
 */
function getMetricsFromMemory() {
  const summary = {
    totalRequests: 0,
    totalErrors: 0,
    averageResponseTime: 0,
    endpoints: []
  };

  let totalTime = 0;

  for (const [endpoint, metrics] of memoryMetrics.requests.entries()) {
    summary.totalRequests += metrics.count;
    summary.totalErrors += metrics.errors;
    totalTime += metrics.totalTime;

    summary.endpoints.push({
      endpoint,
      requests: metrics.count,
      errors: metrics.errors,
      errorRate: ((metrics.errors / metrics.count) * 100).toFixed(2) + '%',
      avgResponseTime: Math.round(metrics.totalTime / metrics.count),
      minResponseTime: metrics.minTime === Infinity ? 0 : metrics.minTime,
      maxResponseTime: metrics.maxTime,
      lastRequest: metrics.lastRequest
    });
  }

  summary.averageResponseTime = summary.totalRequests > 0 
    ? Math.round(totalTime / summary.totalRequests) 
    : 0;

  summary.errorRate = summary.totalRequests > 0 
    ? ((summary.totalErrors / summary.totalRequests) * 100).toFixed(2) + '%' 
    : '0%';

  return summary;
}

/**
 * Get slow requests for analysis
 */
export const getSlowRequests = async (limit = 50) => {
  try {
    if (useRedis && redis) {
      const slowKeys = await redis.zrevrange('metrics:slow_requests', 0, limit - 1);
      const slowRequests = [];
      
      for (const key of slowKeys) {
        const data = await redis.hgetall(key);
        if (data.requestId) {
          slowRequests.push(data);
        }
      }
      
      return slowRequests;
    } else {
      return memoryMetrics.slowRequests.slice(-limit);
    }
  } catch (err) {
    console.error('❌ Failed to get slow requests:', err.message);
    return memoryMetrics.slowRequests.slice(-limit);
  }
};

/**
 * Get hourly performance statistics
 */
export const getHourlyStats = async (hours = 24) => {
  try {
    if (!useRedis || !redis) {
      return [];
    }

    const stats = [];
    const currentHour = Math.floor(Date.now() / (60 * 60 * 1000));
    
    for (let i = hours - 1; i >= 0; i--) {
      const hour = currentHour - i;
      const key = `metrics:hourly:${hour}`;
      const data = await redis.hgetall(key);
      
      const requests = parseInt(data.requests) || 0;
      const totalTime = parseInt(data.totalTime) || 0;
      const errors = parseInt(data.errors) || 0;
      const cacheHits = parseInt(data.cacheHits) || 0;
      
      stats.push({
        hour: new Date(hour * 60 * 60 * 1000).toISOString(),
        requests,
        errors,
        errorRate: requests > 0 ? ((errors / requests) * 100).toFixed(2) : '0',
        avgResponseTime: requests > 0 ? Math.round(totalTime / requests) : 0,
        cacheHitRate: requests > 0 ? ((cacheHits / requests) * 100).toFixed(2) : '0'
      });
    }
    
    return stats;
  } catch (err) {
    console.error('❌ Failed to get hourly stats:', err.message);
    return [];
  }
};

/**
 * Reset performance metrics
 */
export const resetMetrics = async () => {
  try {
    if (useRedis && redis) {
      const keys = await redis.keys('metrics:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      console.log('📊 Redis performance metrics reset');
    }
    
    memoryMetrics.requests.clear();
    memoryMetrics.endpoints.clear();
    memoryMetrics.errors.clear();
    memoryMetrics.slowRequests.length = 0;
    memoryMetrics.hourlyStats.clear();
    
    console.log('📊 Memory performance metrics reset');
  } catch (err) {
    console.error('❌ Failed to reset metrics:', err.message);
  }
};

/**
 * Utility functions
 */
function getRequestSize(req) {
  const contentLength = req.get('content-length');
  return contentLength ? parseInt(contentLength) : 0;
}

function getResponseSize(data) {
  if (!data) return 0;
  try {
    return Buffer.byteLength(typeof data === 'string' ? data : JSON.stringify(data), 'utf8');
  } catch {
    return 0;
  }
}

function generateRequestId() {
  return 'req_' + Math.random().toString(36).substr(2, 9);
}

console.log('[performanceMonitoring.js] Performance monitoring middleware loaded');
