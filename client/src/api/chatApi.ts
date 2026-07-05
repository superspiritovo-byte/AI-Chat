export async function sendMessage(
  messages: { role: string; content: string }[],
  onContent: (text: string) => void,
  onDone: () => void,
  onError: (message: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
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
        // skip unparseable lines
      }
    }
  }
}
