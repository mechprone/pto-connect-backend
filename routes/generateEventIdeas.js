const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

router.post('/', async (req, res) => {
  const { schoolLevel } = req.body;

  if (!schoolLevel) {
    return res.status(400).json({ error: 'Missing required field: schoolLevel' });
  }

  const prompt = `
You are an AI assistant helping a school PTO plan events. Generate 10 event ideas tailored for a ${schoolLevel} school. Include a title and 1–2 sentence description for each.
Make sure they are age-appropriate and reflect common PTO goals like community building, fundraising, student celebration, and teacher appreciation.

Format your response as a JSON array like:
[
  {
    "title": "Event Title",
    "description": "Short description of the event."
  },
  ...
]
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    });

    const text = response.choices?.[0]?.message?.content;

    if (!text) {
      return res.status(500).json({ error: 'No content received from OpenAI' });
    }

    // Try parsing the response text as JSON
    try {
      const ideas = JSON.parse(text);
      return res.status(200).json({ ideas });
    } catch (parseError) {
      return res.status(500).json({
        error: 'Failed to parse AI response as JSON',
        raw: text
      });
    }
  } catch (err) {
    console.error('Error generating event ideas:', err);
    return res.status(500).json({ error: 'Error contacting OpenAI' });
  }
});

module.exports = router;
