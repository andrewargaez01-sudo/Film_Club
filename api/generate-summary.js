import Anthropic from '@anthropic-ai/sdk'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { title, director, overview } = req.body

    if (!title || !overview) {
      return res.status(400).json({ error: 'Missing title or overview' })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Write a punchy, engaging 3-4 sentence film club summary for "${title}"${director ? ` directed by ${director}` : ''}.

Use this as the plot basis: ${overview}

Write it like a fun, slightly dramatic movie blurb — hook the reader, tease the plot, highlight what makes it interesting. Don't start with the film title. Don't use generic phrases like "a masterpiece" or "a must-see". Keep it around 60-80 words.`
        }
      ]
    })

    const summary = message.content[0].text
    res.status(200).json({ summary })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
