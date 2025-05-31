const express = require('express')
const router = express.Router()
const { OpenAI } = require('openai')

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

router.post('/generate-event', async (req, res) => {
  const { type, season, audience, theme, goal } = req.body

  const prompt = `
You are an expert PTO event planner.

Based on the following inputs:
- Type: ${type}
- Season: ${season}
- Audience: ${audience}
- Theme: ${theme}
- Goal: ${goal}

Generate a JSON object with the following keys:
- title (string)
- description (string)
- event_date (YYYY-MM-DD or estimated)
- category (Fundraiser, Meeting, Celebration, Other)
- school_level (elementary, middle, high)
- location (optional)
- estimated_budget (optional)
- tasks (array of 3–5 specific planning tasks)
- volunteer_roles (array of 3–5 volunteer positions)
- materials_needed (array of 3–5 materials or supplies)
- printable_summary (1-paragraph printable summary of the event)

Only return a JSON object. Do not include any explanation or formatting.
`.trim()

  try {
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
    console.error('AI generation error:', err)
    res.status(500).json({ error: 'Failed to generate event plan.' })
  }
})

module.exports = router
