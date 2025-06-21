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
  
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  try {
    const user = await verifySupabaseToken(token);
    console.log('✅ [STELLA] User authenticated:', user.id);

    const { eventData, stellaContext, moduleIntegrations } = req.body;

    if (!eventData || !stellaContext || !moduleIntegrations) {
      return res.status(400).json({ 
        error: 'Missing required data: eventData, stellaContext, and moduleIntegrations required' 
      });
    }

    console.log('📊 [STELLA] Processing event:', eventData.title);
    console.log('🧠 [STELLA] Context provided:', stellaContext.eventType);
    console.log('🔧 [STELLA] Modules selected:', Object.keys(moduleIntegrations).filter(k => moduleIntegrations[k]));

    // Get user's organization ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (!profile?.org_id) {
      return res.status(400).json({ error: 'User organization not found' });
    }

    // STEP 1: CREATE BASE EVENT
    console.log('📝 [STELLA] Step 1: Creating base event...');
    const { data: newEvent, error: eventError } = await supabase
      .from('events')
      .insert({
        ...eventData,
        org_id: profile.org_id,
        created_by: user.id,
        stella_generated: true
      })
      .select()
      .single();

    if (eventError) {
      console.error('❌ [STELLA] Event creation failed:', eventError);
      return res.status(500).json({ error: 'Failed to create event' });
    }

    console.log('✅ [STELLA] Base event created:', newEvent.id);

    // STEP 2: CREATE MASTER WORKFLOW RECORD
    console.log('🔄 [STELLA] Step 2: Creating workflow master record...');
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
      return res.status(500).json({ error: 'Failed to create workflow record' });
    }

    console.log('✅ [STELLA] Workflow master record created:', workflow.id);

    // STEP 3: GENERATE AI RECOMMENDATIONS
    console.log('🤖 [STELLA] Step 3: Generating AI recommendations...');
    let stellaRecommendations = null;
    
    if (openai) {
      try {
        const prompt = `
You are Stella, an expert PTO event coordinator with years of experience. Based on the following event details, generate comprehensive workflow recommendations.

EVENT DETAILS:
- Title: ${eventData.title}
- Type: ${stellaContext.eventType}
- Primary Goal: ${stellaContext.primaryGoal}
- Target Audience: ${stellaContext.targetAudience}
- Expected Attendance: ${eventData.expected_attendance}
- Estimated Budget: $${eventData.estimated_budget}
- Date: ${eventData.event_date}
- Additional Goals: ${stellaContext.additionalGoals.join(', ')}
- Resources Available: ${stellaContext.availableResources.join(', ')}
- Constraints: ${stellaContext.constraints.join(', ')}
- Past Experience: ${stellaContext.pastEventExperiences}

SELECTED MODULES:
${Object.entries(moduleIntegrations).filter(([_, selected]) => selected).map(([key, _]) => `- ${key}`).join('\n')}

Generate detailed recommendations in JSON format:

{
  "timeline": {
    "recommendedStartWeeks": 8,
    "phases": [
      {
        "name": "Planning & Setup",
        "weeksBefore": 8,
        "duration": 2,
        "keyTasks": ["task1", "task2", "task3"],
        "criticalPath": true
      }
    ]
  },
  "budget": {
    "categories": [
      {
        "name": "Materials & Supplies",
        "estimatedAmount": 400,
        "lineItems": [
          {"item": "Tables", "quantity": 10, "unitCost": 15, "total": 150},
          {"item": "Decorations", "quantity": 1, "unitCost": 250, "total": 250}
        ]
      }
    ],
    "revenueProjections": {
      "ticketSales": 800,
      "donations": 200,
      "sponsorships": 500
    },
    "contingencyRecommendation": 20
  },
  "communications": {
    "campaigns": [
      {
        "name": "Save the Date",
        "timing": "6 weeks before",
        "channels": ["email", "social"],
        "audience": "all_families",
        "keyMessages": ["Early announcement", "Mark calendars"]
      }
    ]
  },
  "volunteers": {
    "roles": [
      {
        "title": "Event Coordinator",
        "count": 1,
        "responsibilities": ["Overall planning", "Vendor coordination"],
        "timeCommitment": "20 hours",
        "skills": ["Organization", "Leadership"]
      }
    ],
    "recruitmentStrategy": "Start early, use personal networks"
  },
  "materials": {
    "categories": [
      {
        "name": "Setup Equipment",
        "items": [
          {"item": "Tables", "quantity": 10, "source": "rent"},
          {"item": "Chairs", "quantity": 40, "source": "borrow"}
        ]
      }
    ]
  },
  "reminders": [
    {
      "name": "Initial Planning Meeting",
      "timing": "8 weeks before",
      "audience": "committee",
      "message": "Time to start planning our amazing event!"
    }
  ],
  "successMetrics": {
    "attendance": "Target 80% of expected",
    "budget": "Stay within 10% of budget",
    "satisfaction": "90% positive feedback"
  },
  "riskMitigation": [
    {
      "risk": "Weather concerns",
      "likelihood": "medium",
      "impact": "high",
      "mitigation": "Have indoor backup plan"
    }
  ]
}
`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are Stella, an expert PTO event coordinator. Generate comprehensive, practical workflow recommendations in JSON format.'
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 3000
        });

        stellaRecommendations = JSON.parse(completion.choices[0].message.content);
        console.log('✅ [STELLA] AI recommendations generated');

      } catch (aiError) {
        console.error('⚠️ [STELLA] AI generation failed, using fallback:', aiError.message);
        stellaRecommendations = generateFallbackRecommendations(eventData, stellaContext);
      }
    } else {
      console.log('⚠️ [STELLA] OpenAI not configured, using fallback recommendations');
      stellaRecommendations = generateFallbackRecommendations(eventData, stellaContext);
    }

    // STEP 4: CREATE WORKFLOW COMPONENTS BASED ON SELECTED MODULES
    const workflowResults = {
      workflow_id: workflow.id,
      event_id: newEvent.id,
      components_created: []
    };

    // BUDGET INTEGRATION
    if (moduleIntegrations.createBudget && stellaRecommendations?.budget) {
      console.log('💰 [STELLA] Creating budget components...');
      try {
        const { data: budgetPlan } = await supabase
          .from('event_budget_plans')
          .insert({
            workflow_id: workflow.id,
            event_id: newEvent.id,
            org_id: profile.org_id,
            total_estimated_budget: eventData.estimated_budget,
            expected_revenue: stellaRecommendations.budget.revenueProjections?.ticketSales || 0,
            stella_budget_confidence: 0.85,
            status: 'draft'
          })
          .select()
          .single();

        // Create budget categories
        for (const category of stellaRecommendations.budget.categories) {
          const { data: budgetCategory } = await supabase
            .from('event_budget_categories')
            .insert({
              budget_plan_id: budgetPlan.id,
              org_id: profile.org_id,
              category_name: category.name,
              estimated_amount: category.estimatedAmount,
              stella_generated: true,
              stella_reasoning: `AI-generated based on ${stellaContext.eventType} requirements`
            })
            .select()
            .single();

          // Create line items
          for (const lineItem of category.lineItems) {
            await supabase
              .from('event_budget_line_items')
              .insert({
                category_id: budgetCategory.id,
                org_id: profile.org_id,
                item_name: lineItem.item,
                quantity: lineItem.quantity,
                unit_cost: lineItem.unitCost,
                estimated_total: lineItem.total,
                stella_generated: true
              });
          }
        }

        workflowResults.components_created.push('budget');
        console.log('✅ [STELLA] Budget components created');
      } catch (budgetError) {
        console.error('❌ [STELLA] Budget creation failed:', budgetError);
      }
    }

    // TIMELINE INTEGRATION
    if (moduleIntegrations.generateTimeline && stellaRecommendations?.timeline) {
      console.log('📅 [STELLA] Creating timeline components...');
      try {
        // Create timeline phases
        for (const phase of stellaRecommendations.timeline.phases) {
          const startDate = new Date(eventData.event_date);
          startDate.setDate(startDate.getDate() - (phase.weeksBefore * 7));
          
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + (phase.duration * 7));

          const { data: timelinePhase } = await supabase
            .from('event_timeline_phases')
            .insert({
              workflow_id: workflow.id,
              org_id: profile.org_id,
              phase_name: phase.name,
              phase_order: phase.weeksBefore,
              start_date: startDate.toISOString().split('T')[0],
              end_date: endDate.toISOString().split('T')[0],
              stella_generated: true,
              stella_recommendations: `Critical path: ${phase.criticalPath}`
            })
            .select()
            .single();

          // Create tasks for this phase
          for (const task of phase.keyTasks) {
            const taskDueDate = new Date(endDate);
            taskDueDate.setDate(taskDueDate.getDate() - 3); // Due 3 days before phase end

            await supabase
              .from('event_tasks')
              .insert({
                workflow_id: workflow.id,
                phase_id: timelinePhase.id,
                org_id: profile.org_id,
                task_title: task,
                task_description: `Task for ${phase.name} phase`,
                priority: phase.criticalPath ? 'high' : 'medium',
                due_date: taskDueDate.toISOString().split('T')[0],
                stella_generated: true,
                created_by: user.id
              });
          }
        }

        workflowResults.components_created.push('timeline');
        console.log('✅ [STELLA] Timeline components created');
      } catch (timelineError) {
        console.error('❌ [STELLA] Timeline creation failed:', timelineError);
      }
    }

    // COMMUNICATION INTEGRATION
    if (moduleIntegrations.setupCommunications && stellaRecommendations?.communications) {
      console.log('📢 [STELLA] Creating communication components...');
      try {
        const { data: commWorkflow } = await supabase
          .from('event_communication_workflows')
          .insert({
            workflow_id: workflow.id,
            event_id: newEvent.id,
            org_id: profile.org_id,
            campaign_name: `${eventData.title} Communication Campaign`,
            campaign_strategy: `Multi-channel campaign for ${stellaContext.eventType}`,
            target_audiences: [stellaContext.targetAudience],
            uses_email: true,
            uses_sms: true,
            uses_social: true,
            stella_generated: true,
            stella_tone_guidelines: 'Friendly, informative, and encouraging',
            stella_content_themes: stellaContext.additionalGoals
          })
          .select()
          .single();

        // Create communication sequences
        for (const campaign of stellaRecommendations.communications.campaigns) {
          const sendDate = new Date(eventData.event_date);
          const weeksBefore = parseInt(campaign.timing.match(/\d+/)?.[0] || 4);
          sendDate.setDate(sendDate.getDate() - (weeksBefore * 7));

          await supabase
            .from('event_communication_sequences')
            .insert({
              communication_workflow_id: commWorkflow.id,
              org_id: profile.org_id,
              sequence_name: campaign.name,
              sequence_type: 'pre_event',
              send_order: weeksBefore,
              send_date: sendDate.toISOString().split('T')[0],
              channel: campaign.channels[0],
              subject_line: `${campaign.name}: ${eventData.title}`,
              message_content: `Exciting news about our upcoming ${eventData.title}! ${campaign.keyMessages.join(' ')}`,
              target_audience: campaign.audience,
              stella_generated: true,
              stella_personalization_level: 'moderate'
            });
        }

        workflowResults.components_created.push('communications');
        console.log('✅ [STELLA] Communication components created');
      } catch (commError) {
        console.error('❌ [STELLA] Communication creation failed:', commError);
      }
    }

    // VOLUNTEER INTEGRATION
    if (moduleIntegrations.createVolunteerRoles && stellaRecommendations?.volunteers) {
      console.log('👥 [STELLA] Creating volunteer components...');
      try {
        for (const role of stellaRecommendations.volunteers.roles) {
          await supabase
            .from('event_volunteer_roles')
            .insert({
              workflow_id: workflow.id,
              event_id: newEvent.id,
              org_id: profile.org_id,
              role_title: role.title,
              role_description: role.responsibilities.join(', '),
              responsibilities: role.responsibilities,
              positions_needed: role.count,
              time_commitment_hours: parseFloat(role.timeCommitment.match(/\d+/)?.[0] || 4),
              stella_generated: true,
              stella_recruitment_tips: stellaRecommendations.volunteers.recruitmentStrategy
            });
        }

        workflowResults.components_created.push('volunteers');
        console.log('✅ [STELLA] Volunteer components created');
      } catch (volunteerError) {
        console.error('❌ [STELLA] Volunteer creation failed:', volunteerError);
      }
    }

    // MATERIALS INTEGRATION
    if (moduleIntegrations.planMaterials && stellaRecommendations?.materials) {
      console.log('📦 [STELLA] Creating materials components...');
      try {
        for (const category of stellaRecommendations.materials.categories) {
          const { data: materialCategory } = await supabase
            .from('event_material_categories')
            .insert({
              workflow_id: workflow.id,
              org_id: profile.org_id,
              category_name: category.name,
              category_description: `Materials needed for ${stellaContext.eventType}`,
              priority: 'medium',
              source_type: 'purchase'
            })
            .select()
            .single();

          for (const item of category.items) {
            await supabase
              .from('event_material_items')
              .insert({
                category_id: materialCategory.id,
                org_id: profile.org_id,
                item_name: item.item,
                quantity_needed: item.quantity,
                specifications: `Source: ${item.source}`,
                stella_generated: true
              });
          }
        }

        workflowResults.components_created.push('materials');
        console.log('✅ [STELLA] Materials components created');
      } catch (materialsError) {
        console.error('❌ [STELLA] Materials creation failed:', materialsError);
      }
    }

    // REMINDERS INTEGRATION
    if (moduleIntegrations.scheduleReminders && stellaRecommendations?.reminders) {
      console.log('⏰ [STELLA] Creating reminder components...');
      try {
        for (const reminder of stellaRecommendations.reminders) {
          const reminderDate = new Date(eventData.event_date);
          const weeksBefore = parseInt(reminder.timing.match(/\d+/)?.[0] || 2);
          reminderDate.setDate(reminderDate.getDate() - (weeksBefore * 7));

          await supabase
            .from('event_reminder_sequences')
            .insert({
              workflow_id: workflow.id,
              org_id: profile.org_id,
              reminder_name: reminder.name,
              reminder_type: 'milestone',
              target_audience: reminder.audience,
              trigger_type: 'date_based',
              trigger_date: reminderDate.toISOString().split('T')[0],
              message_template: reminder.message,
              stella_generated: true
            });
        }

        workflowResults.components_created.push('reminders');
        console.log('✅ [STELLA] Reminder components created');
      } catch (reminderError) {
        console.error('❌ [STELLA] Reminder creation failed:', reminderError);
      }
    }

    // UPDATE WORKFLOW STATUS
    await supabase
      .from('event_workflows')
      .update({ 
        status: 'active',
        completion_percentage: 15 // Initial setup complete
      })
      .eq('id', workflow.id);

    console.log('🎉 [STELLA] Comprehensive workflow generation completed successfully!');

    // STEP 5: RETURN COMPREHENSIVE RESPONSE
    res.json({
      success: true,
      workflow: {
        id: workflow.id,
        event_id: newEvent.id,
        event_title: newEvent.title,
        status: 'active',
        components_created: workflowResults.components_created,
        stella_recommendations: stellaRecommendations
      },
      message: `🌟 Stella has successfully created your comprehensive ${eventData.title} workflow with ${workflowResults.components_created.length} integrated modules!`,
      next_steps: [
        'Review your timeline and assign tasks to team members',
        'Approve the budget plan and line items',
        'Customize communication messages for your audience',
        'Recruit volunteers for the defined roles'
      ]
    });

  } catch (error) {
    console.error('❌ [STELLA] Comprehensive workflow generation failed:', error);
    res.status(500).json({ 
      error: 'Failed to generate comprehensive workflow',
      details: error.message 
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

export default router; 