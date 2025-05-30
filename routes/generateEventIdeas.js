const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

router.post('/', async (req, res) => {
  const { schoolLevel } = req.body;

  if (!schoolLevel) {
    return res.status(400).json({ error: 'Missing schoolLevel' });
  }

  const prompt = `Generate 10 creative and engaging event ideas for a ${schoolLevel} school PTO. Include a variety of categories such as student achievement, teacher appreciation, community building, and fundraising. Provide brief descriptions for each.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are an expert PTO event planner.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    });

    const ideas = response.choices?.[0]?.message?.content;
    if (!ideas) throw new Error('No response content from OpenAI');

    res.json({ ideas });
  } catch (err) {
    console.error('OpenAI error:', err.response?.data || err.message || err);
    res.status(500).json({ error: 'Error contacting OpenAI' });
  }
});

module.exports = router;
