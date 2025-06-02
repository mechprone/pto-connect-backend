const express = require('express')
const router = express.Router()
const { OpenAI } = require('openai')
const { verifySupabaseToken } = require('../../services/supabase')

// Safely initialize OpenAI
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

router.post('/generate-event', async (req, res) => {
  // 🔐 Auth check
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ error: 'Missing auth token' })

  try {
    const user = await verifySupabaseToken(token)
    // req.user = user // optional if you want to use in future

    if (!openai) {
      return res.status(500).json({ error: 'OpenAI API key not configured' })
    }

    const { type, season, audience, theme, goal } = req.body

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
    `.trim()

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
    })

    const response = completion.choices[0].message.content
    res.json({ result: response })
  } catch (err) {
    console.error('AI generation error:', err.message)
    res.status(500).json({ error: 'Failed to generate event plan.' })
  }
})

module.exports = router
console.log('[ai.js] Routes loaded successfully');
