import express from 'express';
import { OpenAI } from 'openai';
import { supabase, verifySupabaseToken } from '../util/verifySupabaseToken.js';

const router = express.Router();

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Enhanced Cross-Module Context Analysis
const getOrganizationContext = async (orgId) => {
  try {
    const [
      eventsResult,
      budgetResult,
      fundraisersResult,
      communicationsResult,
      profilesResult
    ] = await Promise.all([
      supabase.from('events').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(10),
      supabase.from('budgets').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(5),
      supabase.from('fundraising_campaigns').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(5),
      supabase.from('communications').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(5),
      supabase.from('profiles').select('*').eq('org_id', orgId)
    ]);

    return {
      events: eventsResult.data || [],
      budgets: budgetResult.data || [],
      fundraisers: fundraisersResult.data || [],
      communications: communicationsResult.data || [],
      profiles: profilesResult.data || [],
      totalMembers: (profilesResult.data || []).length,
      activeEvents: (eventsResult.data || []).filter(e => new Date(e.event_date) > new Date()).length,
      totalBudget: (budgetResult.data || []).reduce((sum, b) => sum + (b.total_amount || 0), 0)
    };
  } catch (error) {
    console.error('Error fetching organization context:', error);
    return null;
  }
};

// Stella's Intelligent Recommendation Engine
const generateIntelligentRecommendations = async (context, requestType, orgContext) => {
  if (!openai) return { recommendations: [] };

  const contextPrompt = `
You are Stella, an experienced PTO assistant with deep knowledge of school community management.

Organization Context:
- Total Members: ${orgContext?.totalMembers || 0}
- Active Events: ${orgContext?.activeEvents || 0}
- Recent Events: ${orgContext?.events?.slice(0, 3).map(e => e.title).join(', ') || 'None'}
- Recent Fundraisers: ${orgContext?.fundraisers?.slice(0, 2).map(f => f.name).join(', ') || 'None'}
- Total Budget: $${orgContext?.totalBudget || 0}

Request Type: ${requestType}
User Context: ${context}

Generate 3-5 specific, actionable recommendations that consider the organization's current state, 
upcoming events, and PTO best practices. Focus on practical steps they can take immediately.

Format as JSON array:
{
  "recommendations": [
    {
      "title": "Recommendation Title",
      "description": "Detailed description with specific steps",
      "priority": "high|medium|low",
      "category": "events|budget|communications|fundraising|volunteers",
      "estimatedTime": "Time to implement",
      "potentialImpact": "Expected benefit"
    }
  ]
}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are Stella, a helpful PTO assistant that provides intelligent, data-driven recommendations in JSON format.' },
        { role: 'user', content: contextPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const response = completion.choices[0].message.content;
    return JSON.parse(response);
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return { recommendations: [] };
  }
};

// Enhanced Event Analysis for Workflow Orchestration
const analyzeEventComplexity = (eventData) => {
  const complexityFactors = {
    attendeeCount: eventData.expected_attendance || 0,
    budgetSize: eventData.estimated_budget || 0,
    timelineWeeks: eventData.preparation_weeks || 4,
    volunteerRoles: (eventData.volunteer_roles || []).length,
    hasFood: eventData.description?.toLowerCase().includes('food') || false,
    hasFundraising: eventData.category === 'Fundraiser',
    isOutdoor: eventData.location?.toLowerCase().includes('outdoor') || false
  };

  let complexity = 'simple';
  let score = 0;

  if (complexityFactors.attendeeCount > 200) score += 2;
  else if (complexityFactors.attendeeCount > 100) score += 1;

  if (complexityFactors.budgetSize > 5000) score += 2;
  else if (complexityFactors.budgetSize > 1000) score += 1;

  if (complexityFactors.volunteerRoles > 10) score += 2;
  else if (complexityFactors.volunteerRoles > 5) score += 1;

  if (complexityFactors.hasFood) score += 1;
  if (complexityFactors.hasFundraising) score += 1;
  if (complexityFactors.isOutdoor) score += 1;

  if (score >= 6) complexity = 'complex';
  else if (score >= 3) complexity = 'moderate';

  return { complexity, score, factors: complexityFactors };
};

router.post('/generate-event', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const user = await verifySupabaseToken(token);

    if (!openai) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const { type, season, audience, theme, goal } = req.body;

    const prompt = `
You are an experienced PTO event planner for schools.

Using the following details, generate a complete school event plan in **valid JSON** format only:

- Event Type: ${type}
- Season or Month: ${season}
- Audience: ${audience}
- Theme: ${theme}
- Goal: ${goal}

Your response should exactly match this structure:

{
  "title": "string",
  "description": "string",
  "event_date": "YYYY-MM-DD",
  "category": "Fundraiser | Meeting | Celebration | Other",
  "school_level": "elementary | upper_elementary | middle | junior_high | high",
  "location": "string",
  "estimated_budget": "string",
  "tasks": ["task 1", "task 2", "task 3"],
  "volunteer_roles": ["role 1", "role 2", "role 3"],
  "materials_needed": ["item 1", "item 2", "item 3"],
  "printable_summary": "string"
}

Do not include any commentary, markdown, or extra text — just the JSON object.
    `.trim();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You generate structured JSON PTO event plans for school leaders.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    });

    const response = completion.choices[0].message.content;
    res.json({ result: response });
  } catch (err) {
    console.error('[ai.js] generation error:', err.message);
    res.status(500).json({ error: 'Failed to generate event plan.' });
  }
});

// Enhanced Stella AI Content Generation Endpoint
router.post('/generate', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const user = await verifySupabaseToken(token);

    if (!openai) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const { type, prompt, context, includeRecommendations = false } = req.body;

    if (!type || !prompt) {
      return res.status(400).json({ error: 'Missing type or prompt' });
    }

    // Get organization context for enhanced intelligence
    const orgContext = context?.orgId ? await getOrganizationContext(context.orgId) : null;

    let systemPrompt = '';
    let userPrompt = '';
    let maxTokens = 500;

    switch (type) {
      case 'subject':
        systemPrompt = 'You are Stella, a helpful PTO assistant. Create engaging, clear email subject lines that get opened. Keep them under 50 characters when possible.';
        userPrompt = `Create an engaging email subject line for: ${prompt}`;
        maxTokens = 100;
        break;
      
      case 'content':
        const orgContextStr = orgContext ? `\n\nOrganization Context: ${orgContext.totalMembers} members, ${orgContext.activeEvents} active events, recent events: ${orgContext.events?.slice(0, 2).map(e => e.title).join(', ')}` : '';
        systemPrompt = 'You are Stella, a helpful PTO assistant. Write professional, friendly communication content for PTO members. Use a warm, community-focused tone and incorporate relevant organizational context when available.';
        userPrompt = `Write ${context?.mode || 'email'} content for: ${prompt}${orgContextStr}`;
        maxTokens = 800;
        break;
      
      case 'social':
        systemPrompt = 'You are Stella, a helpful PTO assistant. Create engaging social media posts with appropriate hashtags and emojis for school communities.';
        userPrompt = `Create a social media post for: ${prompt}`;
        maxTokens = 300;
        break;
      
      case 'sms':
        systemPrompt = 'You are Stella, a helpful PTO assistant. Write concise, clear SMS messages under 160 characters for PTO communications.';
        userPrompt = `Write a brief SMS message for: ${prompt}`;
        maxTokens = 100;
        break;
      
      default:
        return res.status(400).json({ error: 'Invalid content type' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: maxTokens
    });

    const content = completion.choices[0].message.content.trim();
    
    let response = { 
      content,
      type,
      generatedBy: 'Stella AI Assistant'
    };

    // Add intelligent recommendations if requested
    if (includeRecommendations && orgContext) {
      const recommendations = await generateIntelligentRecommendations(prompt, type, orgContext);
      response.recommendations = recommendations.recommendations || [];
    }

    res.json(response);

  } catch (err) {
    console.error('[ai.js] content generation error:', err.message);
    res.status(500).json({ error: 'Failed to generate content.' });
  }
});

// NEW: Stella's Cross-Module Intelligence Endpoint
router.post('/analyze-context', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const user = await verifySupabaseToken(token);
    const { orgId, analysisType = 'general' } = req.body;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const orgContext = await getOrganizationContext(orgId);
    if (!orgContext) {
      return res.status(500).json({ error: 'Failed to fetch organization context' });
    }

    let analysis = {};

    switch (analysisType) {
      case 'budget':
        analysis = {
          budgetHealth: orgContext.totalBudget > 10000 ? 'healthy' : orgContext.totalBudget > 5000 ? 'moderate' : 'needs-attention',
          totalBudget: orgContext.totalBudget,
          averageEventBudget: orgContext.events.length > 0 ? orgContext.totalBudget / orgContext.events.length : 0,
          recommendations: await generateIntelligentRecommendations('budget analysis', 'budget', orgContext)
        };
        break;

      case 'events':
        analysis = {
          upcomingEvents: orgContext.activeEvents,
          eventFrequency: orgContext.events.length > 6 ? 'high' : orgContext.events.length > 3 ? 'moderate' : 'low',
          mostPopularCategory: 'Fundraiser', // TODO: Calculate from actual data
          recommendations: await generateIntelligentRecommendations('event planning', 'events', orgContext)
        };
        break;

      case 'general':
      default:
        analysis = {
          organizationHealth: {
            memberEngagement: orgContext.totalMembers > 50 ? 'high' : orgContext.totalMembers > 20 ? 'moderate' : 'low',
            eventActivity: orgContext.activeEvents > 3 ? 'high' : orgContext.activeEvents > 1 ? 'moderate' : 'low',
            financialHealth: orgContext.totalBudget > 10000 ? 'excellent' : orgContext.totalBudget > 5000 ? 'good' : 'needs-improvement'
          },
          keyMetrics: {
            totalMembers: orgContext.totalMembers,
            activeEvents: orgContext.activeEvents,
            totalBudget: orgContext.totalBudget,
            recentActivity: orgContext.events.length + orgContext.fundraisers.length
          },
          recommendations: await generateIntelligentRecommendations('organization overview', 'general', orgContext)
        };
        break;
    }

    res.json({
      success: true,
      analysis,
      context: orgContext,
      generatedBy: 'Stella AI Assistant',
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('[ai.js] context analysis error:', err.message);
    res.status(500).json({ error: 'Failed to analyze context.' });
  }
});

// NEW: Event Workflow Analysis for Phase 2 Preparation
router.post('/analyze-event-workflow', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const user = await verifySupabaseToken(token);
    const { eventData, orgId } = req.body;

    if (!eventData || !orgId) {
      return res.status(400).json({ error: 'Event data and organization ID required' });
    }

    const orgContext = await getOrganizationContext(orgId);
    const complexity = analyzeEventComplexity(eventData);

    // Generate workflow recommendations based on event complexity
    const workflowPrompt = `
You are Stella, an expert PTO event coordinator. Analyze this event and create a comprehensive workflow plan.

Event: ${eventData.title}
Type: ${eventData.category}
Expected Attendance: ${eventData.expected_attendance || 'Not specified'}
Budget: $${eventData.estimated_budget || 'Not specified'}
Complexity: ${complexity.complexity}
Organization: ${orgContext?.totalMembers || 0} members, ${orgContext?.activeEvents || 0} active events

Generate a JSON workflow with timeline, tasks, budget recommendations, and communication plan:

{
  "workflowComplexity": "${complexity.complexity}",
  "recommendedTimeline": "6-8 weeks",
  "keyMilestones": [
    {
      "week": 1,
      "milestone": "Planning & Setup",
      "tasks": ["Task 1", "Task 2"]
    }
  ],
  "budgetRecommendations": {
    "suggestedBudget": 1000,
    "breakdown": {
      "materials": 400,
      "marketing": 200,
      "contingency": 400
    }
  },
  "communicationPlan": {
    "saveTheDates": "6-8 weeks before",
    "mainAnnouncement": "4-6 weeks before",
    "reminders": "1-2 weeks before",
    "followUp": "1 week after"
  },
  "volunteerNeeds": {
    "roles": ["Role 1", "Role 2"],
    "totalVolunteers": 10
  }
}
`;

    if (!openai) {
      return res.json({
        complexity: complexity.complexity,
        score: complexity.score,
        basicWorkflow: {
          timeline: '6-8 weeks',
          phases: ['Planning', 'Promotion', 'Execution', 'Follow-up']
        }
      });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are Stella, a PTO event planning expert. Generate detailed workflow plans in JSON format.' },
        { role: 'user', content: workflowPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    const workflowPlan = JSON.parse(completion.choices[0].message.content);

    res.json({
      success: true,
      eventComplexity: complexity,
      workflowPlan,
      orgContext: {
        totalMembers: orgContext?.totalMembers || 0,
        experience: orgContext?.events?.length || 0,
        resources: orgContext?.totalBudget || 0
      },
      generatedBy: 'Stella AI Assistant'
    });

  } catch (err) {
    console.error('[ai.js] event workflow analysis error:', err.message);
    res.status(500).json({ error: 'Failed to analyze event workflow.' });
  }
});

export default router;
