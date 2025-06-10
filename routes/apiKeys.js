/**
 * API Key Management Routes
 * Phase 2 Week 2 Day 7-8: Security Framework
 * 
 * Provides endpoints for creating, managing, and monitoring API keys
 * for third-party integrations with comprehensive security controls.
 */

import express from 'express';
import { supabase, verifySupabaseToken } from './util/verifySupabaseToken.js';
import { getUserOrgContext } from './middleware/organizationalContext.js';
import { requireOrgPermission } from './middleware/organizationPermissions.js';
import { adminRateLimit } from './middleware/rateLimiting.js';
import { apiCache } from './middleware/apiCaching.js';
import crypto from 'crypto';

const router = express.Router();

/**
 * GET /api/admin/api-keys
 * Get all API keys for the organization
 */
router.get('/admin/api-keys', 
  adminRateLimit,
  getUserOrgContext, 
  requireOrgPermission('can_edit_user_roles'),
  apiCache({ ttl: 300 }), // 5 minute cache
  async (req, res) => {
    try {
      const { data: apiKeys, error } = await supabase
        .from('api_keys')
        .select(`
          id,
          key_id,
          name,
          description,
          permissions,
          rate_limit_tier,
          is_active,
          last_used_at,
          expires_at,
          created_at,
          profiles!created_by (
            first_name,
            last_name,
            email
          )
        `)
        .eq('org_id', req.orgId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Failed to fetch API keys:', error.message);
        return res.status(500).json({
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
            code: 'DATABASE_ERROR',
            message: 'Failed to fetch API keys',
            field: null,
            details: null
          }]
        });
      }

      // Add usage statistics for each API key
      const keysWithStats = await Promise.all(apiKeys.map(async (key) => {
        const { data: usage, error: usageError } = await supabase
          .from('api_key_usage')
          .select('status_code, response_time_ms, created_at')
          .eq('api_key_id', key.id)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
          .order('created_at', { ascending: false });

        const stats = {
          requests_24h: usage?.length || 0,
          avg_response_time: usage?.length > 0 
            ? Math.round(usage.reduce((sum, u) => sum + u.response_time_ms, 0) / usage.length)
            : 0,
          error_rate: usage?.length > 0 
            ? ((usage.filter(u => u.status_code >= 400).length / usage.length) * 100).toFixed(2) + '%'
            : '0%',
          last_request: usage?.[0]?.created_at || null
        };

        return {
          ...key,
          usage_stats: stats
        };
      }));

      res.json({
        success: true,
        data: {
          api_keys: keysWithStats,
          total: keysWithStats.length,
          active: keysWithStats.filter(k => k.is_active).length,
          expired: keysWithStats.filter(k => k.expires_at && new Date(k.expires_at) < new Date()).length
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
      console.error('❌ API keys fetch error:', err.message);
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
          message: 'Internal server error',
          field: null,
          details: null
        }]
      });
    }
  }
);

/**
 * POST /api/admin/api-keys
 * Create a new API key
 */
router.post('/admin/api-keys',
  adminRateLimit,
  getUserOrgContext,
  requireOrgPermission('can_edit_user_roles'),
  async (req, res) => {
    try {
      const { name, description, permissions = {}, rate_limit_tier = 'standard', expires_in_days } = req.body;

      // Validation
      if (!name || name.trim().length === 0) {
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
            message: 'API key name is required',
            field: 'name',
            details: 'Name must be a non-empty string'
          }]
        });
      }

      if (name.length > 100) {
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
            message: 'API key name too long',
            field: 'name',
            details: 'Name must be 100 characters or less'
          }]
        });
      }

      // Validate rate limit tier
      const validTiers = ['free', 'standard', 'premium', 'enterprise'];
      if (!validTiers.includes(rate_limit_tier)) {
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
            message: 'Invalid rate limit tier',
            field: 'rate_limit_tier',
            details: `Must be one of: ${validTiers.join(', ')}`
          }]
        });
      }

      // Calculate expiration date
      let expires_at = null;
      if (expires_in_days && expires_in_days > 0) {
        expires_at = new Date(Date.now() + (expires_in_days * 24 * 60 * 60 * 1000)).toISOString();
      }

      // Create API key using database function
      const { data: keyResult, error } = await supabase
        .rpc('create_api_key', {
          p_name: name.trim(),
          p_description: description?.trim() || null,
          p_org_id: req.orgId,
          p_created_by: req.user.id,
          p_permissions: permissions,
          p_rate_limit_tier: rate_limit_tier,
          p_expires_at: expires_at
        });

      if (error || !keyResult || keyResult.length === 0) {
        console.error('❌ Failed to create API key:', error?.message);
        return res.status(500).json({
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
            code: 'DATABASE_ERROR',
            message: 'Failed to create API key',
            field: null,
            details: null
          }]
        });
      }

      const newKey = keyResult[0];

      console.log(`✅ API key created: ${name} (${newKey.key_id}) for org ${req.organization?.name}`);

      res.status(201).json({
        success: true,
        data: {
          id: newKey.api_key_id,
          key_id: newKey.key_id,
          api_key: newKey.full_api_key, // Only returned once during creation
          name,
          description,
          permissions,
          rate_limit_tier,
          expires_at,
          created_at: new Date().toISOString(),
          warning: 'Store this API key securely. It will not be shown again.'
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
      console.error('❌ API key creation error:', err.message);
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
          message: 'Internal server error',
          field: null,
          details: null
        }]
      });
    }
  }
);

/**
 * PUT /api/admin/api-keys/:id
 * Update an API key (name, description, permissions, status)
 */
router.put('/admin/api-keys/:id',
  adminRateLimit,
  getUserOrgContext,
  requireOrgPermission('can_edit_user_roles'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, permissions, rate_limit_tier, is_active } = req.body;

      // Validate UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
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
            message: 'Invalid API key ID format',
            field: 'id',
            details: 'ID must be a valid UUID'
          }]
        });
      }

      // Build update object
      const updates = { updated_at: new Date().toISOString() };
      
      if (name !== undefined) {
        if (!name || name.trim().length === 0) {
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
              message: 'API key name cannot be empty',
              field: 'name',
              details: null
            }]
          });
        }
        updates.name = name.trim();
      }

      if (description !== undefined) {
        updates.description = description?.trim() || null;
      }

      if (permissions !== undefined) {
        updates.permissions = permissions;
      }

      if (rate_limit_tier !== undefined) {
        const validTiers = ['free', 'standard', 'premium', 'enterprise'];
        if (!validTiers.includes(rate_limit_tier)) {
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
              message: 'Invalid rate limit tier',
              field: 'rate_limit_tier',
              details: `Must be one of: ${validTiers.join(', ')}`
            }]
          });
        }
        updates.rate_limit_tier = rate_limit_tier;
      }

      if (is_active !== undefined) {
        updates.is_active = Boolean(is_active);
      }

      // Update the API key
      const { data: updatedKey, error } = await supabase
        .from('api_keys')
        .update(updates)
        .eq('id', id)
        .eq('org_id', req.orgId)
        .select(`
          id,
          key_id,
          name,
          description,
          permissions,
          rate_limit_tier,
          is_active,
          last_used_at,
          expires_at,
          created_at,
          updated_at
        `)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
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
              code: 'NOT_FOUND',
              message: 'API key not found',
              field: 'id',
              details: null
            }]
          });
        }

        console.error('❌ Failed to update API key:', error.message);
        return res.status(500).json({
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
            code: 'DATABASE_ERROR',
            message: 'Failed to update API key',
            field: null,
            details: null
          }]
        });
      }

      console.log(`✅ API key updated: ${updatedKey.name} (${updatedKey.key_id})`);

      res.json({
        success: true,
        data: updatedKey,
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
      console.error('❌ API key update error:', err.message);
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
          message: 'Internal server error',
          field: null,
          details: null
        }]
      });
    }
  }
);

/**
 * DELETE /api/admin/api-keys/:id
 * Delete an API key
 */
router.delete('/admin/api-keys/:id',
  adminRateLimit,
  getUserOrgContext,
  requireOrgPermission('can_edit_user_roles'),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Validate UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
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
            message: 'Invalid API key ID format',
            field: 'id',
            details: 'ID must be a valid UUID'
          }]
        });
      }

      // Get key info before deletion for logging
      const { data: keyInfo } = await supabase
        .from('api_keys')
        .select('name, key_id')
        .eq('id', id)
        .eq('org_id', req.orgId)
        .single();

      // Delete the API key
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', id)
        .eq('org_id', req.orgId);

      if (error) {
        console.error('❌ Failed to delete API key:', error.message);
        return res.status(500).json({
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
            code: 'DATABASE_ERROR',
            message: 'Failed to delete API key',
            field: null,
            details: null
          }]
        });
      }

      if (keyInfo) {
        console.log(`✅ API key deleted: ${keyInfo.name} (${keyInfo.key_id})`);
      }

      res.json({
        success: true,
        data: {
          message: 'API key deleted successfully',
          deleted_at: new Date().toISOString()
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
      console.error('❌ API key deletion error:', err.message);
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
          message: 'Internal server error',
          field: null,
          details: null
        }]
      });
    }
  }
);

/**
 * GET /api/admin/api-keys/:id/usage
 * Get usage statistics for a specific API key
 */
router.get('/admin/api-keys/:id/usage',
  adminRateLimit,
  getUserOrgContext,
  requireOrgPermission('can_edit_user_roles'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { days = 7 } = req.query;

      // Validate UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
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
            message: 'Invalid API key ID format',
            field: 'id',
            details: 'ID must be a valid UUID'
          }]
        });
      }

      // Verify API key belongs to organization
      const { data: apiKey, error: keyError } = await supabase
        .from('api_keys')
        .select('id, name, key_id')
        .eq('id', id)
        .eq('org_id', req.orgId)
        .single();

      if (keyError || !apiKey) {
        return res.status(404).json({
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
            code: 'NOT_FOUND',
            message: 'API key not found',
            field: 'id',
            details: null
          }]
        });
      }

      // Get usage data
      const startDate = new Date(Date.now() - (parseInt(days) * 24 * 60 * 60 * 1000));
      const { data: usage, error: usageError } = await supabase
        .from('api_key_usage')
        .select('*')
        .eq('api_key_id', id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (usageError) {
        console.error('❌ Failed to fetch API key usage:', usageError.message);
        return res.status(500).json({
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
            code: 'DATABASE_ERROR',
            message: 'Failed to fetch usage data',
            field: null,
            details: null
          }]
        });
      }

      // Calculate statistics
      const stats = {
        total_requests: usage.length,
        successful_requests: usage.filter(u => u.status_code < 400).length,
        error_requests: usage.filter(u => u.status_code >= 400).length,
        avg_response_time: usage.length > 0 
          ? Math.round(usage.reduce((sum, u) => sum + u.response_time_ms, 0) / usage.length)
          : 0,
        min_response_time: usage.length > 0 ? Math.min(...usage.map(u => u.response_time_ms)) : 0,
        max_response_time: usage.length > 0 ? Math.max(...usage.map(u => u.response_time_ms)) : 0,
        error_rate: usage.length > 0 
          ? ((usage.filter(u => u.status_code >= 400).length / usage.length) * 100).toFixed(2) + '%'
          : '0%'
      };

      // Group by endpoint
      const endpointStats = usage.reduce((acc, u) => {
        const key = `${u.method} ${u.endpoint}`;
        if (!acc[key]) {
          acc[key] = { requests: 0, errors: 0, total_time: 0 };
        }
        acc[key].requests++;
        acc[key].total_time += u.response_time_ms;
        if (u.status_code >= 400) acc[key].errors++;
        return acc;
      }, {});

      const endpoints = Object.entries(endpointStats).map(([endpoint, stats]) => ({
        endpoint,
        requests: stats.requests,
        errors: stats.errors,
        error_rate: ((stats.errors / stats.requests) * 100).toFixed(2) + '%',
        avg_response_time: Math.round(stats.total_time / stats.requests)
      })).sort((a, b) => b.requests - a.requests);

      res.json({
        success: true,
        data: {
          api_key: {
            id: apiKey.id,
            name: apiKey.name,
            key_id: apiKey.key_id
          },
          period: {
            days: parseInt(days),
            start_date: startDate.toISOString(),
            end_date: new Date().toISOString()
          },
          statistics: stats,
          endpoints,
          recent_requests: usage.slice(0, 50) // Last 50 requests
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
      console.error('❌ API key usage fetch error:', err.message);
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
          message: 'Internal server error',
          field: null,
          details: null
        }]
      });
    }
  }
);

export default router;
