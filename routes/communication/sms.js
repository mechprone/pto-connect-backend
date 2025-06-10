import express from 'express';
import { supabase } from '../util/verifySupabaseToken.js';
import { getUserOrgContext, addUserOrgToBody } from '../middleware/organizationalContext.js';
import { requireVolunteer, canManageCommunications } from '../middleware/roleBasedAccess.js';
import twilio from 'twilio';

const router = express.Router();

// Initialize Twilio client with error handling
let twilioClient = null;
try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('[sms.js] Twilio client initialized successfully');
  } else {
    console.warn('[sms.js] Twilio credentials not configured - SMS functionality will be limited');
  }
} catch (error) {
  console.error('[sms.js] Failed to initialize Twilio client:', error.message);
}

// GET /api/communications/sms-campaigns - Get SMS campaigns for organization
router.get('/campaigns', getUserOrgContext, requireVolunteer, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    
    let query = supabase
      .from('sms_campaigns')
      .select('*')
      .eq('org_id', req.orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`❌ Error fetching SMS campaigns for org ${req.orgId}:`, error.message);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to fetch SMS campaigns',
        details: error.message 
      });
    }

    console.log(`✅ Retrieved ${data.length} SMS campaigns for org ${req.orgId}`);
    res.json({
      success: true,
      data: data,
      count: data.length
    });
  } catch (err) {
    console.error('[sms.js] GET campaigns error:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch SMS campaigns' 
    });
  }
});

// GET /api/communications/sms-campaigns/:id - Get specific SMS campaign
router.get('/campaigns/:id', getUserOrgContext, requireVolunteer, async (req, res) => {
  try {
    const campaignId = req.params.id;

    const { data, error } = await supabase
      .from('sms_campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('org_id', req.orgId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ 
          success: false,
          error: 'SMS campaign not found' 
        });
      }
      console.error(`❌ Error fetching SMS campaign ${campaignId}:`, error.message);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to fetch SMS campaign' 
      });
    }

    res.json({
      success: true,
      data: data
    });
  } catch (err) {
    console.error('[sms.js] GET campaign by ID error:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch SMS campaign' 
    });
  }
});

// POST /api/communications/sms-campaigns - Create new SMS campaign
router.post('/campaigns', getUserOrgContext, addUserOrgToBody, canManageCommunications, async (req, res) => {
  try {
    const { 
      name, 
      message_content, 
      recipient_type = 'all',
      scheduled_for 
    } = req.body;

    // Validate required fields
    if (!name || !message_content) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: name, message_content' 
      });
    }

    // Validate message length (SMS limit is 160 characters for single SMS)
    if (message_content.length > 1600) { // Allow for longer messages that will be split
      return res.status(400).json({ 
        success: false,
        error: 'Message content too long (maximum 1600 characters)' 
      });
    }

    const { data, error } = await supabase
      .from('sms_campaigns')
      .insert([{
        name,
        message_content,
        recipient_type,
        scheduled_for: scheduled_for ? new Date(scheduled_for).toISOString() : null,
        created_by: req.user.id,
        org_id: req.body.org_id
      }])
      .select()
      .single();

    if (error) {
      console.error(`❌ Error creating SMS campaign for org ${req.orgId}:`, error.message);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to create SMS campaign' 
      });
    }

    console.log(`✅ SMS campaign created for org ${req.orgId} by user ${req.user.id}`);
    res.status(201).json({
      success: true,
      data: data,
      message: 'SMS campaign created successfully'
    });
  } catch (err) {
    console.error('[sms.js] POST campaign error:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create SMS campaign' 
    });
  }
});

// PUT /api/communications/sms-campaigns/:id - Update SMS campaign
router.put('/campaigns/:id', getUserOrgContext, canManageCommunications, async (req, res) => {
  try {
    const campaignId = req.params.id;
    const { 
      name, 
      message_content, 
      recipient_type,
      scheduled_for,
      status 
    } = req.body;

    // Verify campaign belongs to user's organization
    const { data: campaign, error: fetchError } = await supabase
      .from('sms_campaigns')
      .select('org_id, status')
      .eq('id', campaignId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ 
          success: false,
          error: 'SMS campaign not found' 
        });
      }
      console.error(`❌ Error fetching SMS campaign ${campaignId}:`, fetchError.message);
      return res.status(500).json({ 
        success: false,
        error: 'Error fetching SMS campaign' 
      });
    }

    if (campaign.org_id !== req.orgId) {
      console.warn(`🚫 Cross-org access denied: SMS campaign ${campaignId} not in org ${req.orgId}`);
      return res.status(403).json({ 
        success: false,
        error: 'SMS campaign not found in your organization' 
      });
    }

    // Don't allow editing sent campaigns
    if (campaign.status === 'sent') {
      return res.status(400).json({ 
        success: false,
        error: 'Cannot edit sent SMS campaigns' 
      });
    }

    const { data, error } = await supabase
      .from('sms_campaigns')
      .update({
        name,
        message_content,
        recipient_type,
        scheduled_for: scheduled_for ? new Date(scheduled_for).toISOString() : null,
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)
      .eq('org_id', req.orgId)
      .select()
      .single();

    if (error) {
      console.error(`❌ Error updating SMS campaign ${campaignId}:`, error.message);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to update SMS campaign' 
      });
    }

    console.log(`✅ SMS campaign ${campaignId} updated in org ${req.orgId} by user ${req.user.id}`);
    res.json({
      success: true,
      data: data,
      message: 'SMS campaign updated successfully'
    });
  } catch (err) {
    console.error('[sms.js] PUT campaign error:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update SMS campaign' 
    });
  }
});

// POST /api/communications/sms-campaigns/:id/send - Send SMS campaign
router.post('/campaigns/:id/send', getUserOrgContext, canManageCommunications, async (req, res) => {
  try {
    const campaignId = req.params.id;

    // Get campaign details
    const { data: campaign, error: fetchError } = await supabase
      .from('sms_campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('org_id', req.orgId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ 
          success: false,
          error: 'SMS campaign not found' 
        });
      }
      console.error(`❌ Error fetching SMS campaign ${campaignId}:`, fetchError.message);
      return res.status(500).json({ 
        success: false,
        error: 'Error fetching SMS campaign' 
      });
    }

    // Check if campaign is already sent
    if (campaign.status === 'sent' || campaign.status === 'sending') {
      return res.status(400).json({ 
        success: false,
        error: 'Campaign has already been sent or is currently sending' 
      });
    }

    // Get recipients based on recipient_type
    let recipientQuery = supabase
      .from('user_communication_preferences')
      .select(`
        user_id,
        phone_number,
        phone_verified,
        sms_enabled,
        user_profiles!inner(first_name, last_name, email)
      `)
      .eq('org_id', req.orgId)
      .eq('sms_enabled', true)
      .eq('phone_verified', true)
      .not('phone_number', 'is', null);

    // Filter by recipient type if needed
    if (campaign.recipient_type !== 'all') {
      // Add role-based filtering here based on recipient_type
      // This would require joining with user_roles table
    }

    const { data: recipients, error: recipientsError } = await recipientQuery;

    if (recipientsError) {
      console.error(`❌ Error fetching recipients for campaign ${campaignId}:`, recipientsError.message);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to fetch recipients' 
      });
    }

    if (recipients.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No eligible recipients found for this campaign' 
      });
    }

    // Update campaign status to sending
    await supabase
      .from('sms_campaigns')
      .update({ 
        status: 'sending',
        recipient_count: recipients.length,
        sent_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    // Check if Twilio is configured
    if (!twilioClient) {
      return res.status(500).json({ 
        success: false,
        error: 'SMS service not configured. Please contact administrator.' 
      });
    }

    // Send SMS messages
    let sentCount = 0;
    let failedCount = 0;
    const deliveries = [];

    for (const recipient of recipients) {
      try {
        const message = await twilioClient.messages.create({
          body: campaign.message_content,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: recipient.phone_number
        });

        deliveries.push({
          campaign_id: campaignId,
          user_id: recipient.user_id,
          phone_number: recipient.phone_number,
          message_sid: message.sid,
          status: message.status,
          sent_at: new Date().toISOString()
        });

        sentCount++;
      } catch (twilioError) {
        console.error(`❌ Failed to send SMS to ${recipient.phone_number}:`, twilioError.message);
        
        deliveries.push({
          campaign_id: campaignId,
          user_id: recipient.user_id,
          phone_number: recipient.phone_number,
          status: 'failed',
          error_message: twilioError.message,
          sent_at: new Date().toISOString()
        });

        failedCount++;
      }
    }

    // Save delivery records
    if (deliveries.length > 0) {
      await supabase
        .from('sms_deliveries')
        .insert(deliveries);
    }

    // Update campaign with final counts
    const deliveryRate = recipients.length > 0 ? (sentCount / recipients.length) * 100 : 0;
    
    await supabase
      .from('sms_campaigns')
      .update({ 
        status: 'sent',
        sent_count: sentCount,
        failed_count: failedCount,
        delivery_rate: deliveryRate
      })
      .eq('id', campaignId);

    console.log(`✅ SMS campaign ${campaignId} sent: ${sentCount} successful, ${failedCount} failed`);
    res.json({
      success: true,
      message: 'SMS campaign sent successfully',
      data: {
        campaign_id: campaignId,
        recipients_count: recipients.length,
        sent_count: sentCount,
        failed_count: failedCount,
        delivery_rate: deliveryRate
      }
    });
  } catch (err) {
    console.error('[sms.js] POST send error:', err.message);
    
    // Update campaign status to failed
    await supabase
      .from('sms_campaigns')
      .update({ status: 'failed' })
      .eq('id', campaignId);

    res.status(500).json({ 
      success: false,
      error: 'Failed to send SMS campaign' 
    });
  }
});

// GET /api/communications/sms-campaigns/:id/deliveries - Get delivery status
router.get('/campaigns/:id/deliveries', getUserOrgContext, requireVolunteer, async (req, res) => {
  try {
    const campaignId = req.params.id;

    // Verify campaign belongs to user's organization
    const { data: campaign, error: campaignError } = await supabase
      .from('sms_campaigns')
      .select('org_id')
      .eq('id', campaignId)
      .single();

    if (campaignError || campaign.org_id !== req.orgId) {
      return res.status(404).json({ 
        success: false,
        error: 'SMS campaign not found' 
      });
    }

    const { data, error } = await supabase
      .from('sms_deliveries')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('sent_at', { ascending: false });

    if (error) {
      console.error(`❌ Error fetching deliveries for campaign ${campaignId}:`, error.message);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to fetch delivery status' 
      });
    }

    res.json({
      success: true,
      data: data,
      count: data.length
    });
  } catch (err) {
    console.error('[sms.js] GET deliveries error:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch delivery status' 
    });
  }
});

// DELETE /api/communications/sms-campaigns/:id - Delete SMS campaign
router.delete('/campaigns/:id', getUserOrgContext, canManageCommunications, async (req, res) => {
  try {
    const campaignId = req.params.id;

    // Verify campaign belongs to user's organization and is not sent
    const { data: campaign, error: fetchError } = await supabase
      .from('sms_campaigns')
      .select('org_id, status')
      .eq('id', campaignId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ 
          success: false,
          error: 'SMS campaign not found' 
        });
      }
      console.error(`❌ Error fetching SMS campaign ${campaignId}:`, fetchError.message);
      return res.status(500).json({ 
        success: false,
        error: 'Error fetching SMS campaign' 
      });
    }

    if (campaign.org_id !== req.orgId) {
      console.warn(`🚫 Cross-org access denied: SMS campaign ${campaignId} not in org ${req.orgId}`);
      return res.status(403).json({ 
        success: false,
        error: 'SMS campaign not found in your organization' 
      });
    }

    // Don't allow deleting sent campaigns
    if (campaign.status === 'sent') {
      return res.status(400).json({ 
        success: false,
        error: 'Cannot delete sent SMS campaigns' 
      });
    }

    const { error } = await supabase
      .from('sms_campaigns')
      .delete()
      .eq('id', campaignId)
      .eq('org_id', req.orgId);

    if (error) {
      console.error(`❌ Error deleting SMS campaign ${campaignId}:`, error.message);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to delete SMS campaign' 
      });
    }

    console.log(`✅ SMS campaign ${campaignId} deleted from org ${req.orgId} by user ${req.user.id}`);
    res.json({
      success: true,
      message: 'SMS campaign deleted successfully'
    });
  } catch (err) {
    console.error('[sms.js] DELETE campaign error:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete SMS campaign' 
    });
  }
});

// POST /api/communications/sms/webhook - Twilio webhook for delivery status
router.post('/webhook', async (req, res) => {
  try {
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = req.body;

    if (!MessageSid) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing MessageSid' 
      });
    }

    // Update delivery status
    const { error } = await supabase
      .from('sms_deliveries')
      .update({
        status: MessageStatus,
        error_code: ErrorCode,
        error_message: ErrorMessage,
        delivered_at: MessageStatus === 'delivered' ? new Date().toISOString() : null
      })
      .eq('message_sid', MessageSid);

    if (error) {
      console.error(`❌ Error updating SMS delivery status for ${MessageSid}:`, error.message);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to update delivery status' 
      });
    }

    console.log(`✅ SMS delivery status updated for ${MessageSid}: ${MessageStatus}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[sms.js] POST webhook error:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to process webhook' 
    });
  }
});

console.log('[sms.js] SMS communication routes loaded successfully');
export default router;
