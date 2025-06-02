const express = require('express')
const router = express.Router()
const { OpenAI } = require('openai')
const { verifySupabaseToken } = require('../../services/supabase')

// Initialize OpenAI if API key exists
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

router.post('/', async (req, res) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed auth token' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const user = await verifySupabaseToken(token)

    if (!openai) {
      return res.status(500).json({ error: 'OpenAI API key not configured' })
    }

    const { keywords } = req.body
    if (!keywords || keywords.trim().length === 0) {
      return res.status(400).json({ error: 'Missing keywords or prompt input' })
    }

    const prompt = `
You are an expert in school fundraising and community engagement.

Generate 5 unique and creative PTO event ideas based on the following keywords or theme: "${keywords}".

Return only valid JSON in this structure:
{
  "ideas": [
    { "title": "string", "description": "string" },
    ...
  ]
}
`.trim()

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that creates PTO event ideas in JSON format only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8
    })

    const response = completion.choices[0].message.content
    res.json({ result: response })
  } catch (err) {
    console.error('generateEventIdeas error:', err.message)
    res.status(500).json({ error: 'Failed to generate event ideas.' })
  }
})

module.exports = router
