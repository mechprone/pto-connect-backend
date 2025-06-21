import express from 'express';
import { OpenAI } from 'openai';
import { supabase, verifySupabaseToken } from '../util/verifySupabaseToken.js';

const router = express.Router();

// Initialize OpenAI
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ================================================================
// STELLA COMPREHENSIVE WORKFLOW GENERATION ENDPOINT
// ================================================================

router.post('/generate-comprehensive-workflow', async (req, res) => {
  console.log('🌟 [STELLA] Comprehensive workflow generation started');
  console.log('🌟 [STELLA] Request body keys:', Object.keys(req.body));
  console.log('🌟 [STELLA] Full request body:', JSON.stringify(req.body, null, 2));
  
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    console.log('❌ [STELLA] No auth token provided');
    return res.status(401).json({ error: 'Missing auth token' });
  }
  
  console.log('🔑 [STELLA] Token received, length:', token.length);

  try {
    console.log('🔍 [STELLA] Attempting to verify token...');
    const user = await verifySupabaseToken(token);
    console.log('✅ [STELLA] User authenticated:', user.id);

    const { eventData, stellaContext, moduleIntegrations } = req.body;
    console.log('📊 [STELLA] Event data received:', JSON.stringify(eventData, null, 2));
    console.log('🎯 [STELLA] Stella context received:', JSON.stringify(stellaContext, null, 2));
    console.log('🔧 [STELLA] Module integrations:', JSON.stringify(moduleIntegrations, null, 2));
    console.log('📊 [STELLA] Received data:', {
      hasEventData: !!eventData,
      hasStellaContext: !!stellaContext,
      hasModuleIntegrations: !!moduleIntegrations
    });

    if (!eventData || !stellaContext || !moduleIntegrations) {
      console.log('❌ [STELLA] Missing required data');
      return res.status(400).json({ 
        error: 'Missing required data: eventData, stellaContext, and moduleIntegrations required' 
      });
    }

    console.log('📊 [STELLA] Processing event:', eventData.title);
    console.log('🧠 [STELLA] Context provided:', stellaContext.eventType);
    console.log('🔧 [STELLA] Modules selected:', Object.keys(moduleIntegrations).filter(k => moduleIntegrations[k]));

    // Get user's organization ID
    console.log('🏢 [STELLA] Fetching user organization...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('❌ [STELLA] Profile fetch error:', profileError);
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }

    if (!profile?.org_id) {
      console.log('❌ [STELLA] No organization found for user');
      return res.status(400).json({ error: 'User organization not found' });
    }

    console.log('✅ [STELLA] Organization found:', profile.org_id);

    // STEP 1: CREATE BASE EVENT
    console.log('📝 [STELLA] Step 1: Creating base event...');
    console.log('📝 [STELLA] Event data to insert:', {
      title: eventData.title,
      org_id: profile.org_id,
      created_by: user.id
    });
    
    const { data: newEvent, error: eventError } = await supabase
      .from('events')
      .insert({
        title: eventData.title,
        description: eventData.description,
        event_date: eventData.event_date,
        start_time: eventData.start_time,
        end_time: eventData.end_time,
        location: eventData.location,
        expected_attendance: eventData.expected_attendance,
        estimated_budget: eventData.estimated_budget,
        org_id: profile.org_id,
        created_by: user.id,
        stella_generated: true,
        status: 'planning'
      })
      .select()
      .single();

    if (eventError) {
      console.error('❌ [STELLA] Event creation failed:', eventError);
      return res.status(500).json({ error: 'Failed to create event', details: eventError.message });
    }

    console.log('✅ [STELLA] Base event created:', newEvent.id);

    // STEP 2: CREATE MASTER WORKFLOW RECORD
    console.log('🔄 [STELLA] Step 2: Creating workflow master record...');
    console.log('🔄 [STELLA] Checking if event_workflows table exists...');
    
    // Test if the table exists first
    const { data: testWorkflow, error: testError } = await supabase
      .from('event_workflows')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.error('❌ [STELLA] event_workflows table issue:', testError);
      return res.status(500).json({ 
        error: 'Database schema issue: event_workflows table not accessible',
        details: testError.message 
      });
    }
    
    console.log('✅ [STELLA] event_workflows table is accessible');
    
    const { data: workflow, error: workflowError } = await supabase
      .from('event_workflows')
      .insert({
        event_id: newEvent.id,
        org_id: profile.org_id,
        workflow_name: `${eventData.title} - Comprehensive Workflow`,
        workflow_type: 'comprehensive',
        stella_generated: true,
        event_type: stellaContext.eventType,
        primary_goal: stellaContext.primaryGoal,
        target_audience: stellaContext.targetAudience,
        additional_goals: stellaContext.additionalGoals,
        special_considerations: stellaContext.specialConsiderations,
        past_experiences: stellaContext.pastEventExperiences,
        available_resources: stellaContext.availableResources,
        constraints: stellaContext.constraints,
        budget_integration: moduleIntegrations.createBudget,
        timeline_integration: moduleIntegrations.generateTimeline,
        communication_integration: moduleIntegrations.setupCommunications,
        volunteer_integration: moduleIntegrations.createVolunteerRoles,
        materials_integration: moduleIntegrations.planMaterials,
        reminders_integration: moduleIntegrations.scheduleReminders,
        tracking_integration: moduleIntegrations.trackProgress,
        reports_integration: moduleIntegrations.generateReports,
        status: 'creating',
        created_by: user.id
      })
      .select()
      .single();

    if (workflowError) {
      console.error('❌ [STELLA] Workflow creation failed:', workflowError);
      return res.status(500).json({ 
        error: 'Failed to create workflow record',
        details: workflowError.message 
      });
    }

    console.log('✅ [STELLA] Workflow master record created:', workflow.id);

    // For now, return a simple success response to test the basic flow
    console.log('🎉 [STELLA] Basic workflow creation successful!');
    
    res.json({
      success: true,
      workflow: {
        id: workflow.id,
        event_id: newEvent.id,
        event_title: newEvent.title,
        status: 'active',
        components_created: ['basic_workflow'],
        message: `Basic workflow created successfully for ${eventData.title}`
      },
      message: `🌟 Stella has successfully created your basic ${eventData.title} workflow!`,
      next_steps: [
        'Review your workflow settings',
        'Add more components as needed'
      ]
    });

  } catch (error) {
    console.error('❌ [STELLA] Comprehensive workflow generation failed:', error);
    console.error('❌ [STELLA] Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to generate comprehensive workflow',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ================================================================
// HELPER FUNCTIONS
// ================================================================

function generateFallbackRecommendations(eventData, stellaContext) {
  return {
    timeline: {
      recommendedStartWeeks: 8,
      phases: [
        {
          name: "Planning & Setup",
          weeksBefore: 8,
          duration: 2,
          keyTasks: ["Form planning committee", "Set event goals", "Create initial budget"],
          criticalPath: true
        },
        {
          name: "Promotion & Marketing",
          weeksBefore: 6,
          duration: 3,
          keyTasks: ["Design promotional materials", "Launch communication campaign", "Start volunteer recruitment"],
          criticalPath: true
        },
        {
          name: "Final Preparations",
          weeksBefore: 2,
          duration: 2,
          keyTasks: ["Confirm all logistics", "Final volunteer briefing", "Setup preparation"],
          criticalPath: true
        }
      ]
    },
    budget: {
      categories: [
        {
          name: "Materials & Supplies",
          estimatedAmount: Math.floor(eventData.estimated_budget * 0.4),
          lineItems: [
            { item: "Basic supplies", quantity: 1, unitCost: Math.floor(eventData.estimated_budget * 0.4), total: Math.floor(eventData.estimated_budget * 0.4) }
          ]
        },
        {
          name: "Marketing & Promotion",
          estimatedAmount: Math.floor(eventData.estimated_budget * 0.2),
          lineItems: [
            { item: "Promotional materials", quantity: 1, unitCost: Math.floor(eventData.estimated_budget * 0.2), total: Math.floor(eventData.estimated_budget * 0.2) }
          ]
        }
      ],
      revenueProjections: {
        ticketSales: Math.floor(eventData.estimated_budget * 1.5),
        donations: Math.floor(eventData.estimated_budget * 0.3)
      },
      contingencyRecommendation: 20
    },
    communications: {
      campaigns: [
        {
          name: "Save the Date",
          timing: "6 weeks before",
          channels: ["email"],
          audience: "all_families",
          keyMessages: ["Mark your calendars", "More details coming soon"]
        },
        {
          name: "Event Details",
          timing: "3 weeks before",
          channels: ["email", "social"],
          audience: "all_families",
          keyMessages: ["Full event details", "How to participate"]
        }
      ]
    },
    volunteers: {
      roles: [
        {
          title: "Event Coordinator",
          count: 1,
          responsibilities: ["Overall event management", "Vendor coordination"],
          timeCommitment: "15 hours",
          skills: ["Organization", "Communication"]
        },
        {
          title: "Setup Team",
          count: 5,
          responsibilities: ["Event setup", "Equipment handling"],
          timeCommitment: "4 hours",
          skills: ["Physical work", "Teamwork"]
        }
      ],
      recruitmentStrategy: "Start recruiting 6 weeks before the event"
    },
    materials: {
      categories: [
        {
          name: "Event Equipment",
          items: [
            { item: "Tables", quantity: 10, source: "rent" },
            { item: "Chairs", quantity: 50, source: "borrow" }
          ]
        }
      ]
    },
    reminders: [
      {
        name: "Planning Meeting Reminder",
        timing: "6 weeks before",
        audience: "committee",
        message: "Time to start planning our event!"
      }
    ],
    successMetrics: {
      attendance: "80% of expected attendance",
      budget: "Stay within 10% of budget",
      satisfaction: "90% positive feedback"
    }
  };
}

// ================================================================
// GET WORKFLOW STATUS AND DETAILS
// ================================================================

router.get('/workflow/:workflowId', async (req, res) => {
  console.log('📊 [STELLA] Getting workflow details for:', req.params.workflowId);
  
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  try {
    const user = await verifySupabaseToken(token);
    const { workflowId } = req.params;

    // Get user's organization ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (!profile?.org_id) {
      return res.status(400).json({ error: 'User organization not found' });
    }

    // Get workflow with all related data
    const { data: workflow, error: workflowError } = await supabase
      .from('event_workflows')
      .select(`
        *,
        events!inner(title, description, event_date, expected_attendance, estimated_budget)
      `)
      .eq('id', workflowId)
      .eq('org_id', profile.org_id)
      .single();

    if (workflowError || !workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json({
      success: true,
      workflow: workflow
    });

  } catch (error) {
    console.error('❌ [STELLA] Failed to get workflow:', error);
    res.status(500).json({ 
      error: 'Failed to get workflow details',
      details: error.message 
    });
  }
});

// ================================================================
// LIST ALL WORKFLOWS FOR ORGANIZATION
// ================================================================

router.get('/workflows', async (req, res) => {
  console.log('📋 [STELLA] Getting organization workflows');
  
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  try {
    const user = await verifySupabaseToken(token);

    // Get user's organization ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (!profile?.org_id) {
      return res.status(400).json({ error: 'User organization not found' });
    }

    // Get all workflows for organization
    const { data: workflows, error: workflowsError } = await supabase
      .from('event_workflows')
      .select(`
        *,
        events!inner(title, event_date, expected_attendance)
      `)
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: false });

    if (workflowsError) {
      return res.status(500).json({ error: 'Failed to fetch workflows' });
    }

    res.json({
      success: true,
      workflows: workflows || [],
      total: workflows?.length || 0
    });

  } catch (error) {
    console.error('❌ [STELLA] Failed to get workflows:', error);
    res.status(500).json({ 
      error: 'Failed to get workflows',
      details: error.message 
    });
  }
});

// Add a simple test endpoint before the main workflow endpoint
router.get('/test-database-schema', async (req, res) => {
  console.log('🔍 [STELLA] Testing database schema...');
  
  try {
    // Test 1: Check if events table works
    const { data: eventsTest, error: eventsError } = await supabase
      .from('events')
      .select('id, title')
      .limit(1);
    
    console.log('✅ [STELLA] Events table test:', eventsError ? 'FAILED' : 'PASSED');
    
    // Test 2: Check if event_workflows table exists
    const { data: workflowsTest, error: workflowsError } = await supabase
      .from('event_workflows')
      .select('id')
      .limit(1);
    
    console.log('✅ [STELLA] Event workflows table test:', workflowsError ? 'FAILED' : 'PASSED');
    
    // Test 3: Check profiles table
    const { data: profilesTest, error: profilesError } = await supabase
      .from('profiles')
      .select('id, org_id')
      .limit(1);
    
    console.log('✅ [STELLA] Profiles table test:', profilesError ? 'FAILED' : 'PASSED');
    
    res.json({
      success: true,
      tests: {
        events: {
          status: eventsError ? 'FAILED' : 'PASSED',
          error: eventsError?.message,
          count: eventsTest?.length || 0
        },
        event_workflows: {
          status: workflowsError ? 'FAILED' : 'PASSED',
          error: workflowsError?.message,
          count: workflowsTest?.length || 0
        },
        profiles: {
          status: profilesError ? 'FAILED' : 'PASSED',
          error: profilesError?.message,
          count: profilesTest?.length || 0
        }
      }
    });
    
  } catch (error) {
    console.error('❌ [STELLA] Database schema test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Add a simplified workflow test endpoint
router.post('/test-workflow-creation', async (req, res) => {
  console.log('🧪 [STELLA] Testing workflow creation process...');
  
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  try {
    // Step 1: Verify token
    console.log('🔍 [STELLA TEST] Step 1: Verifying token...');
    const user = await verifySupabaseToken(token);
    console.log('✅ [STELLA TEST] Token verified for user:', user.id);

    // Step 2: Get user profile
    console.log('🔍 [STELLA TEST] Step 2: Getting user profile...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id, full_name')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('❌ [STELLA TEST] Profile error:', profileError);
      return res.status(500).json({ error: 'Profile fetch failed', details: profileError.message });
    }

    console.log('✅ [STELLA TEST] Profile found:', { org_id: profile.org_id, name: profile.full_name });

    // Step 3: Create simple event
    console.log('🔍 [STELLA TEST] Step 3: Creating test event...');
    const testEventData = {
      title: 'Test Event - ' + Date.now(),
      description: 'Test event for workflow debugging',
      event_date: new Date().toISOString().split('T')[0],
      location: 'Test Location',
      org_id: profile.org_id,
      created_by: user.id,
      status: 'planning'  // Use valid status value
    };

    const { data: newEvent, error: eventError } = await supabase
      .from('events')
      .insert(testEventData)
      .select()
      .single();

    if (eventError) {
      console.error('❌ [STELLA TEST] Event creation error:', eventError);
      return res.status(500).json({ error: 'Event creation failed', details: eventError.message });
    }

    console.log('✅ [STELLA TEST] Event created:', newEvent.id);

    // Step 4: Create simple workflow record
    console.log('🔍 [STELLA TEST] Step 4: Creating test workflow...');
    const testWorkflowData = {
      event_id: newEvent.id,
      org_id: profile.org_id,
      workflow_name: 'Test Workflow - ' + Date.now(),
      workflow_type: 'test',
      stella_generated: true,
      event_type: 'test',
      primary_goal: 'Testing workflow creation',
      target_audience: 'test',
      status: 'creating',
      created_by: user.id
    };

    const { data: workflow, error: workflowError } = await supabase
      .from('event_workflows')
      .insert(testWorkflowData)
      .select()
      .single();

    if (workflowError) {
      console.error('❌ [STELLA TEST] Workflow creation error:', workflowError);
      return res.status(500).json({ error: 'Workflow creation failed', details: workflowError.message });
    }

    console.log('✅ [STELLA TEST] Workflow created:', workflow.id);

    // Step 5: Success response
    res.json({
      success: true,
      message: 'Test workflow creation successful!',
      data: {
        event_id: newEvent.id,
        workflow_id: workflow.id,
        user_id: user.id,
        org_id: profile.org_id
      }
    });

  } catch (error) {
    console.error('❌ [STELLA TEST] Test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Add a database constraint inspection endpoint
router.get('/inspect-events-constraint', async (req, res) => {
  console.log('🔍 [STELLA] Inspecting events table constraint...');
  
  try {
    // Query the database constraint information
    const { data: constraintInfo, error: constraintError } = await supabase
      .rpc('get_table_constraints', { table_name: 'events' })
      .single();
    
    if (constraintError) {
      console.log('❌ [STELLA] Error getting constraint info:', constraintError);
      
      // Alternative: Query information_schema
      const { data: schemaInfo, error: schemaError } = await supabase
        .from('information_schema.check_constraints')
        .select('*')
        .eq('constraint_name', 'events_status_check');
      
      if (schemaError) {
        console.log('❌ [STELLA] Error getting schema info:', schemaError);
        return res.json({
          success: false,
          message: 'Could not inspect constraint',
          error: schemaError.message
        });
      }
      
      return res.json({
        success: true,
        constraint_info: schemaInfo,
        method: 'information_schema'
      });
    }
    
    res.json({
      success: true,
      constraint_info: constraintInfo,
      method: 'rpc'
    });
    
  } catch (error) {
    console.log('❌ [STELLA] Exception inspecting constraint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router; 