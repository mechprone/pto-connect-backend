const express = require('express')
const router = express.Router()
const { Configuration, OpenAIApi } = require('openai')

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
})
const openai = new OpenAIApi(configuration)

router.post('/generate-event-ideas', async (req, res) => {
  const { schoolLevel } = req.body

  if (!schoolLevel) {
    return res.status(400).json({ error: 'Missing school level' })
  }

  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert school PTO event planner. Generate creative, helpful, relevant PTO event ideas based on school level.'
        },
        {
          role: 'user',
          content: `Generate 15 event ideas for a ${schoolLevel} school PTO. Each should include a title, 1-2 sentence description, and 2-3 tags.`
        }
      ],
      temperature: 0.7
    })

    const rawIdeas = response.data.choices?.[0]?.message?.content || ''
    const ideas = rawIdeas
      .split(/\n(?=\d+\.\s)/) // Split by numbered lines
      .map((item) => {
        const match = item.match(/^\d+\.\s(.+?)\n?-?\s*(.*?)(Tags?:\s*(.*))?$/s)
        if (!match) return null
        return {
          title: match[1].trim(),
          description: match[2]?.trim(),
          tags: match[4]?.split(',').map(t => t.trim()) || []
        }
      })
      .filter(Boolean)

    res.json({ ideas })
  } catch (err) {
    console.error('Error generating ideas:', err.message)
    res.status(500).json({ error: 'Failed to generate ideas' })
  }
})

module.exports = router
