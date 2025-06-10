/**
 * Performance Monitoring Routes
 * Phase 2 Week 2 Day 9-10: Performance Optimization
 * 
 * Provides endpoints for monitoring API performance, cache statistics,
 * and system health with comprehensive analytics and reporting.
 */

import express from 'express';
import { getUserOrgContext } from './middleware/organizationalContext.js';
import { requireOrgPermission } from './middleware/organizationPermissions.js';
import { adminRateLimit } from './middleware/rateLimiting.js';
import { 
  getPerformanceMetrics, 
  getSlowRequests, 
  getHourlyStats, 
  resetMetrics 
} from './middleware/performanceMonitoring.js';
import { 
  getCacheStats, 
  resetCacheStats, 
  clearAllCache, 
  invalidateCache,
  cacheHealthCheck 
} from './middleware/apiCaching.js';
import { 
  getRateLimitStatus, 
  getRateLimitViolations, 
  clearRateLimit 
} from './middleware/rateLimiting.js';

const router = express.Router();

/**
 * GET /api/admin/monitoring/performance
 * Get comprehensive performance metrics
 */
router.get('/admin/monitoring/performance',
  adminRateLimit,
  getUserOrgContext,
  requireOrgPermission('can_edit_user_roles'),
  async (req, res) => {
    try {
      const metrics = await getPerformanceMetrics();
      const slowRequests = await getSlowRequests(20);
      const hourlyStats = await getHourlyStats(24);

      res.json({
        success: true,
        data: {
          overview: metrics,
          slow_requests: slowRequests,
          hourly_statistics: hourlyStats,
          thresholds: {
            fast: '< 100ms',
            warning: '100-500ms',
            slow: '500ms-1s',
            critical: '> 5s'
          }
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: 'v1',
          endpoint: req.originalUrl,
          method: req.method
        },
        errors: null
      });

    } catch (err) {
      console.error('❌ Performance metrics fetch error:', err.message);
      res.status(500).json({
        success: false,
        data: null,
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: 'v1',
          endpoint: req.originalUrl,
          method: req.method
        },
        errors: [{
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch performance metrics',
          field: null,
          details: null
        }]
      });
    }
  }
);

/**
 * GET /api/admin/monitoring/cache
 * Get cache statistics and health
 */
router.get('/admin/monitoring/cache',
  adminRateLimit,
  getUserOrgContext,
  requireOrgPermission('can_edit_user_roles'),
  async (req, res) => {
    try {
      const cacheStats = await getCacheStats();
      const healthCheck = await cacheHealthCheck();

      res.json({
        success: true,
        data: {
          statistics: cacheStats,
          health: healthCheck,
          recommendations: generateCacheRecommendations(cacheStats)
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: 'v1',
          endpoint: req.originalUrl,
          method: req.method
        },
        errors: null
      });

    } catch (err) {
      console.error('❌ Cache stats fetch error:', err.message);
      res.status(500).json({
        success: false,
        data: null,
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: 'v1',
          endpoint: req.originalUrl,
          method: req.method
        },
        errors: [{
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch cache statistics',
          field: null,
          details: null
        }]
      });
    }
  }
);

/**
 * GET /api/admin/monitoring/rate-limits
 * Get rate limiting statistics and violations
 */
router.get('/admin/monitoring/rate-limits',
  adminRateLimit,
  getUserOrgContext,
  requireOrgPermission('can_edit_user_roles'),
  async (req, res) => {
    try {
      const violations = await getRateLimitViolations(100);
      const currentStatus = await getRateLimitStatus(req);

      // Analyze violations by type and frequency
      const violationAnalysis = analyzeRateLimitViolations(violations);

      res.json({
        success: true,
        data: {
          current_status: currentStatus,
          recent_violations: violations.slice(0, 20),
          violation_analysis: violationAnalysis,
          total_violations: violations.length
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: 'v1',
          endpoint: req.originalUrl,
          method: req.method
        },
        errors: null
      });

    } catch (err) {
      console.error('❌ Rate limit stats fetch error:', err.message);
      res.status(500).json({
        success: false,
        data: null,
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: 'v1',
          endpoint: req.originalUrl,
          method: req.method
        },
        errors: [{
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch rate limit statistics',
          field: null,
          details: null
        }]
      });
    }
  }
);

/**
 * GET /api/admin/monitoring/health
 * Comprehensive system health check
 */
router.get('/admin/monitoring/health',
  adminRateLimit,
  getUserOrgContext,
  requireOrgPermission('can_edit_user_roles'),
  async (req, res) => {
    try {
      const healthChecks = await performHealthChecks();

      const overallHealth = healthChecks.every(check => check.status === 'healthy') 
        ? 'healthy' 
        : healthChecks.some(check => check.status === 'critical')
        ? 'critical'
        : 'warning';

      res.json({
        success: true,
        data: {
          overall_status: overallHealth,
          checks: healthChecks,
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory_usage: process.memoryUsage(),
          system_info: {
            node_version: process.version,
            platform: process.platform,
            arch: process.arch
          }
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: 'v1',
          endpoint: req.originalUrl,
          method: req.method
        },
        errors: null
      });

    } catch (err) {
      console.error('❌ Health check error:', err.message);
      res.status(500).json({
        success: false,
        data: null,
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: 'v1',
          endpoint: req.originalUrl,
          method: req.method
        },
        errors: [{
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Health check failed',
          field: null,
          details: null
        }]
      });
    }
  }
);

/**
 * POST /api/admin/monitoring/cache/clear
 * Clear all cache or specific patterns
 */
router.post('/admin/monitoring/cache/clear',
  adminRateLimit,
  getUserOrgContext,
  requireOrgPermission('can_edit_user_roles'),
  async (req, res) => {
    try {
      const { pattern } = req.body;

      let clearedCount = 0;
      if (pattern) {
        clearedCount = await invalidateCache(pattern);
      } else {
        clearedCount = await clearAllCache();
      }

      console.log(`✅ Cache cleared by ${req.user.email}: ${clearedCount} keys${pattern ? ` matching "${pattern}"` : ''}`);

      res.json({
        success: true,
        data: {
          message: pattern 
            ? `Cache cleared for pattern: ${pattern}`
            : 'All cache cleared',
          cleared_keys: clearedCount,
          pattern: pattern || null,
          cleared_by: req.user.email,
          cleared_at: new Date().toISOString()
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: 'v1',
          endpoint: req.originalUrl,
          method: req.method
        },
        errors: null
      });

    } catch (err) {
      console.error('❌ Cache clear error:', err.message);
      res.status(500).json({
        success: false,
        data: null,
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: 'v1',
          endpoint: req.originalUrl,
          method: req.method
        },
        errors: [{
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to clear cache',
          field: null,
          details: null
        }]
      });
    }
  }
);

/**
 * POST /api/admin/monitoring/metrics/reset
 * Reset performance metrics
 */
router.post('/admin/monitoring/metrics/reset',
  adminRateLimit,
  getUserOrgContext,
  requireOrgPermission('can_edit_user_roles'),
  async (req, res) => {
    try {
      await resetMetrics();
      resetCacheStats();

      console.log(`✅ Performance metrics reset by ${req.user.email}`);

      res.json({
        success: true,
        data: {
          message: 'Performance metrics reset successfully',
          reset_by: req.user.email,
          reset_at: new Date().toISOString()
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: 'v1',
          endpoint: req.originalUrl,
          method: req.method
        },
        errors: null
      });

    } catch (err) {
      console.error('❌ Metrics reset error:', err.message);
      res.status(500).json({
        success: false,
        data: null,
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: 'v1',
          endpoint: req.originalUrl,
          method: req.method
        },
        errors: [{
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reset metrics',
          field: null,
          details: null
        }]
      });
    }
  }
);

/**
 * POST /api/admin/monitoring/rate-limits/clear
 * Clear rate limit for specific identifier
 */
router.post('/admin/monitoring/rate-limits/clear',
  adminRateLimit,
  getUserOrgContext,
  requireOrgPermission('can_edit_user_roles'),
  async (req, res) => {
    try {
      const { identifier, tier = 'standard' } = req.body;

      if (!identifier) {
        return res.status(400).json({
          success: false,
          data: null,
          meta: {
            timestamp: new Date().toISOString(),
            request_id: req.requestId,
            version: 'v1',
            endpoint: req.originalUrl,
            method: req.method
          },
          errors: [{
            code: 'VALIDATION_ERROR',
            message: 'Identifier is required',
            field: 'identifier',
            details: 'Provide user ID, API key ID, or IP address'
          }]
        });
      }

      const cleared = await clearRateLimit(identifier, tier);

      if (cleared) {
        console.log(`✅ Rate limit cleared by ${req.user.email} for ${identifier} (${tier})`);
      }

      res.json({
        success: true,
        data: {
          message: cleared 
            ? `Rate limit cleared for ${identifier}`
            : `No rate limit found for ${identifier}`,
          identifier,
          tier,
          cleared,
          cleared_by: req.user.email,
          cleared_at: new Date().toISOString()
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: 'v1',
          endpoint: req.originalUrl,
          method: req.method
        },
        errors: null
      });

    } catch (err) {
      console.error('❌ Rate limit clear error:', err.message);
      res.status(500).json({
        success: false,
        data: null,
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: 'v1',
          endpoint: req.originalUrl,
          method: req.method
        },
        errors: [{
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to clear rate limit',
          field: null,
          details: null
        }]
      });
    }
  }
);

/**
 * Helper function to generate cache recommendations
 */
function generateCacheRecommendations(stats) {
  const recommendations = [];
  
  if (stats.hitRate && parseFloat(stats.hitRate) < 50) {
    recommendations.push({
      type: 'warning',
      message: 'Low cache hit rate detected',
      suggestion: 'Consider increasing cache TTL for frequently accessed endpoints'
    });
  }
  
  if (stats.errors > stats.hits * 0.1) {
    recommendations.push({
      type: 'error',
      message: 'High cache error rate',
      suggestion: 'Check Redis connection and error logs'
    });
  }
  
  if (!stats.redisConnected) {
    recommendations.push({
      type: 'warning',
      message: 'Redis not connected',
      suggestion: 'Using memory cache fallback. Consider fixing Redis connection for better performance'
    });
  }
  
  if (recommendations.length === 0) {
    recommendations.push({
      type: 'success',
      message: 'Cache performance is optimal',
      suggestion: 'No action required'
    });
  }
  
  return recommendations;
}

/**
 * Helper function to analyze rate limit violations
 */
function analyzeRateLimitViolations(violations) {
  if (!violations || violations.length === 0) {
    return {
      summary: 'No recent violations',
      by_tier: {},
      by_endpoint: {},
      by_identifier_type: {}
    };
  }

  const analysis = {
    by_tier: {},
    by_endpoint: {},
    by_identifier_type: {}
  };

  violations.forEach(violation => {
    // By tier
    if (!analysis.by_tier[violation.tier]) {
      analysis.by_tier[violation.tier] = 0;
    }
    analysis.by_tier[violation.tier]++;

    // By endpoint
    if (!analysis.by_endpoint[violation.endpoint]) {
      analysis.by_endpoint[violation.endpoint] = 0;
    }
    analysis.by_endpoint[violation.endpoint]++;

    // By identifier type
    if (!analysis.by_identifier_type[violation.identifier_type]) {
      analysis.by_identifier_type[violation.identifier_type] = 0;
    }
    analysis.by_identifier_type[violation.identifier_type]++;
  });

  return {
    summary: `${violations.length} violations in recent period`,
    ...analysis
  };
}

/**
 * Helper function to perform comprehensive health checks
 */
async function performHealthChecks() {
  const checks = [];

  // Cache health check
  try {
    const cacheHealth = await cacheHealthCheck();
    checks.push({
      name: 'Cache System',
      status: cacheHealth.status,
      details: cacheHealth
    });
  } catch (err) {
    checks.push({
      name: 'Cache System',
      status: 'critical',
      details: { error: err.message }
    });
  }

  // Memory usage check
  const memUsage = process.memoryUsage();
  const memoryStatus = memUsage.heapUsed / memUsage.heapTotal > 0.9 ? 'critical' : 
                      memUsage.heapUsed / memUsage.heapTotal > 0.7 ? 'warning' : 'healthy';
  
  checks.push({
    name: 'Memory Usage',
    status: memoryStatus,
    details: {
      heap_used: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
      heap_total: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
      usage_percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100) + '%'
    }
  });

  // Uptime check
  const uptime = process.uptime();
  const uptimeStatus = uptime > 86400 ? 'healthy' : uptime > 3600 ? 'warning' : 'critical';
  
  checks.push({
    name: 'System Uptime',
    status: uptimeStatus,
    details: {
      uptime_seconds: uptime,
      uptime_hours: Math.round(uptime / 3600 * 100) / 100,
      started_at: new Date(Date.now() - uptime * 1000).toISOString()
    }
  });

  return checks;
}

export default router;
