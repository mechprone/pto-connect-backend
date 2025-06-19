import express from 'express';
import { supabase } from '../util/verifySupabaseToken.js';
import { getUserOrgContext, addUserOrgToBody } from '../middleware/organizationalContext.js';
import { requireVolunteer, canManageCommunications } from '../middleware/roleBasedAccess.js';

const router = express.Router();

// GET /api/communications/templates - Get email templates for organization
router.get('/', getUserOrgContext, requireVolunteer, async (req, res) => {
  try {
    const { category, template_type, sharing_level, is_shared } = req.query;
    
    let query = supabase
      .from('communications_templates')
      .select('*')
      .eq('org_id', req.orgId)
      .eq('is_active', true)
      .order('usage_count', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    if (template_type) {
      query = query.eq('template_type', template_type);
    }

    if (sharing_level) {
      query = query.eq('sharing_level', sharing_level);
    }

    if (is_shared !== undefined) {
      query = query.eq('is_shared', is_shared === 'true');
    }

    const { data, error } = await query;

    if (error) {
      console.error(`❌ Error fetching email templates for org ${req.orgId}:`, error.message);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to fetch email templates',
        details: error.message 
      });
    }

    console.log(`✅ Retrieved ${data.length} email templates for org ${req.orgId}`);
    res.json({
      success: true,
      data: data,
      count: data.length
    });
  } catch (err) {
    console.error('[templates.js] GET error:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch email templates' 
    });
  }
});

// GET /api/communications/templates/categories - Get template categories
router.get('/categories', getUserOrgContext, requireVolunteer, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('communications_templates')
      .select('category')
      .eq('org_id', req.orgId)
      .eq('is_active', true);

    if (error) {
      console.error(`❌ Error fetching template categories for org ${req.orgId}:`, error.message);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to fetch template categories' 
      });
    }

    // Get unique categories
    const categories = [...new Set(data.map(item => item.category))];

    res.json({
      success: true,
      data: categories
    });
  } catch (err) {
    console.error('[templates.js] GET categories error:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch template categories' 
    });
  }
});

// GET /api/communications/templates/:id - Get specific template
router.get('/:id', getUserOrgContext, requireVolunteer, async (req, res) => {
  try {
    const templateId = req.params.id;

    const { data, error } = await supabase
      .from('communications_templates')
      .select('*')
      .eq('id', templateId)
      .eq('org_id', req.orgId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ 
          success: false,
          error: 'Template not found' 
        });
      }
      console.error(`❌ Error fetching template ${templateId}:`, error.message);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to fetch template' 
      });
    }

    res.json({
      success: true,
      data: data
    });
  } catch (err) {
    console.error('[templates.js] GET by ID error:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch template' 
    });
  }
});

// POST /api/communications/templates - Create new email template
router.post('/', getUserOrgContext, addUserOrgToBody, canManageCommunications, async (req, res) => {
  try {
    const { 
      name, 
      category, 
      description, 
      design_json, 
      html_content, 
      thumbnail_url,
      is_shared,
      template_type,
      sharing_level,
      shared_with_orgs
    } = req.body;

    // Validate required fields
    if (!name || !category || !design_json) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: name, category, design_json' 
      });
    }

    const { data, error } = await supabase
      .from('communications_templates')
      .insert([{
        name,
        category,
        description,
        design_json,
        html_content,
        thumbnail_url,
        is_shared: is_shared || false,
        template_type: template_type || 'email',
        sharing_level: sharing_level || 'private',
        shared_with_orgs: shared_with_orgs || null,
        created_by: req.user.id,
        org_id: req.body.org_id
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ 
          success: false,
          error: 'Template with this name already exists' 
        });
      }
      console.error(`❌ Error creating email template for org ${req.orgId}:`, error.message);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to create email template' 
      });
    }

    console.log(`✅ Email template created for org ${req.orgId} by user ${req.user.id}`);
    res.status(201).json({
      success: true,
      data: data,
      message: 'Email template created successfully'
    });
  } catch (err) {
    console.error('[templates.js] POST error:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create email template' 
    });
  }
});

// PUT /api/communications/templates/:id - Update email template
router.put('/:id', getUserOrgContext, canManageCommunications, async (req, res) => {
  try {
    const templateId = req.params.id;
    const { 
      name, 
      category, 
      description, 
      design_json, 
      html_content, 
      thumbnail_url,
      is_shared,
      is_active,
      template_type,
      sharing_level,
      shared_with_orgs
    } = req.body;

    // Verify template belongs to user's organization
    const { data: template, error: fetchError } = await supabase
      .from('communications_templates')
      .select('org_id, created_by')
      .eq('id', templateId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ 
          success: false,
          error: 'Template not found' 
        });
      }
      console.error(`❌ Error fetching template ${templateId}:`, fetchError.message);
      return res.status(500).json({ 
        success: false,
        error: 'Error fetching template' 
      });
    }

    if (template.org_id !== req.orgId) {
      console.warn(`🚫 Cross-org access denied: Template ${templateId} not in org ${req.orgId}`);
      return res.status(403).json({ 
        success: false,
        error: 'Template not found in your organization' 
      });
    }

    const { data, error } = await supabase
      .from('communications_templates')
      .update({
        name,
        category,
        description,
        design_json,
        html_content,
        thumbnail_url,
        is_shared,
        is_active,
        template_type,
        sharing_level,
        shared_with_orgs,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId)
      .eq('org_id', req.orgId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ 
          success: false,
          error: 'Template with this name already exists' 
        });
      }
      console.error(`❌ Error updating template ${templateId}:`, error.message);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to update template' 
      });
    }

    console.log(`✅ Template ${templateId} updated in org ${req.orgId} by user ${req.user.id}`);
    res.json({
      success: true,
      data: data,
      message: 'Template updated successfully'
    });
  } catch (err) {
    console.error('[templates.js] PUT error:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update template' 
    });
  }
});

// DELETE /api/communications/templates/:id - Delete email template
router.delete('/:id', getUserOrgContext, canManageCommunications, async (req, res) => {
  try {
    const templateId = req.params.id;

    // Verify template belongs to user's organization
    const { data: template, error: fetchError } = await supabase
      .from('communications_templates')
      .select('org_id, created_by')
      .eq('id', templateId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ 
          success: false,
          error: 'Template not found' 
        });
      }
      console.error(`❌ Error fetching template ${templateId}:`, fetchError.message);
      return res.status(500).json({ 
        success: false,
        error: 'Error fetching template' 
      });
    }

    if (template.org_id !== req.orgId) {
      console.warn(`🚫 Cross-org access denied: Template ${templateId} not in org ${req.orgId}`);
      return res.status(403).json({ 
        success: false,
        error: 'Template not found in your organization' 
      });
    }

    const { error } = await supabase
      .from('communications_templates')
      .delete()
      .eq('id', templateId)
      .eq('org_id', req.orgId);

    if (error) {
      console.error(`❌ Error deleting template ${templateId}:`, error.message);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to delete template' 
      });
    }

    console.log(`✅ Template ${templateId} deleted from org ${req.orgId} by user ${req.user.id}`);
    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (err) {
    console.error('[templates.js] DELETE error:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete template' 
    });
  }
});

// POST /api/communications/templates/:id/duplicate - Duplicate template
router.post('/:id/duplicate', getUserOrgContext, addUserOrgToBody, canManageCommunications, async (req, res) => {
  try {
    const templateId = req.params.id;
    const { name } = req.body;

    // Get original template
    const { data: originalTemplate, error: fetchError } = await supabase
      .from('communications_templates')
      .select('*')
      .eq('id', templateId)
      .eq('org_id', req.orgId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ 
          success: false,
          error: 'Template not found' 
        });
      }
      console.error(`❌ Error fetching template ${templateId}:`, fetchError.message);
      return res.status(500).json({ 
        success: false,
        error: 'Error fetching template' 
      });
    }

    // Create duplicate
    const { data, error } = await supabase
      .from('communications_templates')
      .insert([{
        name: name || `${originalTemplate.name} (Copy)`,
        category: originalTemplate.category,
        description: originalTemplate.description,
        design_json: originalTemplate.design_json,
        html_content: originalTemplate.html_content,
        thumbnail_url: originalTemplate.thumbnail_url,
        is_shared: false, // Duplicates are not shared by default
        template_type: originalTemplate.template_type,
        sharing_level: originalTemplate.sharing_level,
        shared_with_orgs: originalTemplate.shared_with_orgs,
        created_by: req.user.id,
        org_id: req.body.org_id
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ 
          success: false,
          error: 'Template with this name already exists' 
        });
      }
      console.error(`❌ Error duplicating template ${templateId}:`, error.message);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to duplicate template' 
      });
    }

    console.log(`✅ Template ${templateId} duplicated in org ${req.orgId} by user ${req.user.id}`);
    res.status(201).json({
      success: true,
      data: data,
      message: 'Template duplicated successfully'
    });
  } catch (err) {
    console.error('[templates.js] POST duplicate error:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to duplicate template' 
    });
  }
});

// POST /api/communications/templates/:id/use - Increment usage count
router.post('/:id/use', getUserOrgContext, requireVolunteer, async (req, res) => {
  try {
    const templateId = req.params.id;

    const { data, error } = await supabase
      .from('communications_templates')
      .update({ 
        usage_count: supabase.raw('usage_count + 1'),
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId)
      .eq('org_id', req.orgId)
      .select()
      .single();

    if (error) {
      console.error(`❌ Error updating template usage ${templateId}:`, error.message);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to update template usage' 
      });
    }

    res.json({
      success: true,
      data: data,
      message: 'Template usage updated'
    });
  } catch (err) {
    console.error('[templates.js] POST use error:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update template usage' 
    });
  }
});

console.log('[templates.js] Email template routes loaded successfully');
export default router;
