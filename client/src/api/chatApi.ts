import type { MessageContentPart } from '../types/chat'

export async function sendMessage(
  contentParts: MessageContentPart[],
  historyMessages: { role: string; content: string }[],
  onContent: (text: string) => void,
  onDone: () => void,
  onError: (message: string) => void,
  signal?: AbortSignal
): Promise<void> {
  // 构建当前消息的 content 数组（多模态）
  const currentContent: any[] = contentParts.map(part => {
    if (part.type === 'text') {
      return { type: 'text', text: part.text || '' }
    } else if (part.type === 'image_url' && part.image_url) {
      return { type: 'image_url', image_url: { url: part.image_url.url } }
    } else if (part.type === 'file' && part.file) {
      return {
        type: 'text',
        text: `[文件: ${part.file.name}]\n${part.file.content}`
      }
    }
    return { type: 'text', text: '' }
  }).filter(c => c.text !== '' || c.type === 'image_url')

  // 构建完整消息列表：历史（纯文本）+ 当前（多模态）
  const apiMessages: any[] = []
  for (const m of historyMessages) {
    if (m.role === 'assistant') {
      apiMessages.push({ role: 'assistant', content: m.content })
    } else {
      apiMessages.push({ role: 'user', content: m.content })
    }
  }
  // 当前 user 消息 —— 多模态格式
  apiMessages.push({
    role: 'user',
    content: currentContent.length === 1 && currentContent[0].type === 'text'
      ? currentContent[0].text
      : currentContent
  })

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: apiMessages,
      systemPrompt: '你是一个有帮助的助手，请用中文回答。'
    }),
    signal
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: '请求失败' }))
    onError(err.error || `HTTP ${response.status}`)
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
      if (!trimmed.startsWith('data:')) continue

      const jsonStr = trimmed.slice(5).trim()
      if (!jsonStr) continue

      try {
        const event = JSON.parse(jsonStr)
        if (event.type === 'content') {
          onContent(event.text || '')
        } else if (event.type === 'done') {
          onDone()
        } else if (event.type === 'error') {
          onError(event.message || '未知错误')
        }
      } catch {
        // skip
      }
    }
  }
}
