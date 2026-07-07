import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// DeepSeek API 配置
const DEEPSEEK_BASE = 'https://api.deepseek.com'
const MODEL = 'deepseek-chat'

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
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: '服务端未配置 DEEPSEEK_API_KEY' })}\n\n`)
      res.end()
      return
    }

    // 构建 OpenAI 兼容的消息格式
    const apiMessages: { role: string; content: string | any[] }[] = []
    if (systemPrompt) {
      apiMessages.push({ role: 'system', content: systemPrompt })
    }

    for (const m of messages) {
      if (m.role === 'user') {
        // content 可能是 string（纯文本）或 array（多模态）
        apiMessages.push({ role: 'user', content: m.content })
      } else if (m.role === 'assistant') {
        apiMessages.push({ role: 'assistant', content: m.content })
      }
    }

    const response = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        messages: apiMessages,
        stream: true
      })
    })

    if (!response.ok) {
      const errBody: any = await response.json().catch(() => ({ error: { message: `API 返回 ${response.status}` } }))
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
        if (jsonStr === '[DONE]') {
          res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
          continue
        }

        try {
          const event = JSON.parse(jsonStr)
          const delta = event.choices?.[0]?.delta

          if (delta?.content) {
            res.write(`data: ${JSON.stringify({ type: 'content', text: delta.content })}\n\n`)
          }

          // finish_reason 表示流结束
          if (event.choices?.[0]?.finish_reason) {
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
  console.log(`Using DeepSeek API (model: ${MODEL})`)
})
