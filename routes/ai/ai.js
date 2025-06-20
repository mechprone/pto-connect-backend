import express from 'express';
import { OpenAI } from 'openai';
import { supabase, verifySupabaseToken } from '../util/verifySupabaseToken.js';

const router = express.Router();

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

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

// Stella AI Content Generation Endpoint
router.post('/generate', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const user = await verifySupabaseToken(token);

    if (!openai) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const { type, prompt, context } = req.body;

    if (!type || !prompt) {
      return res.status(400).json({ error: 'Missing type or prompt' });
    }

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
        systemPrompt = 'You are Stella, a helpful PTO assistant. Write professional, friendly communication content for PTO members. Use a warm, community-focused tone.';
        userPrompt = `Write ${context?.mode || 'email'} content for: ${prompt}`;
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
    
    res.json({ 
      content,
      type,
      generatedBy: 'Stella AI Assistant'
    });

  } catch (err) {
    console.error('[ai.js] content generation error:', err.message);
    res.status(500).json({ error: 'Failed to generate content.' });
  }
});

export default router;
