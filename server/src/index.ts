import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

app.post('/api/chat', async (req, res) => {
  const { messages, systemPrompt } = req.body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages is required and must be a non-empty array' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: '服务端未配置 API Key' })}\n\n`)
      res.end()
      return
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt || '你是一个有帮助的助手',
        messages: messages.filter((m: any) => m.role === 'user' || m.role === 'assistant'),
        stream: true
      })
    })

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({ error: { message: `API 返回 ${response.status}` } }))
      res.write(`data: ${JSON.stringify({ type: 'error', message: errBody.error?.message || 'API 请求失败' })}\n\n`)
      res.end()
      return
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue

        const jsonStr = trimmed.slice(5).trim()
        if (!jsonStr) continue

        try {
          const event = JSON.parse(jsonStr)

          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            res.write(`data: ${JSON.stringify({ type: 'content', text: event.delta.text })}\n\n`)
          } else if (event.type === 'message_stop') {
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
          }
        } catch {
          // skip unparseable lines
        }
      }
    }

    res.end()
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误'
    res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
    res.end()
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`AI Chat proxy server running on http://localhost:${PORT}`)
})
