import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Message, MessageContentPart, Conversation } from '../types/chat'
import { sendMessage } from '../api/chatApi'
import { useHistoryStore } from './historyStore'

export const useChatStore = defineStore('chat', () => {
  const messages = ref<Message[]>([])
  const isStreaming = ref(false)
  const currentConversationId = ref<string | null>(null)
  let abortController: AbortController | null = null

  async function send(contentParts: MessageContentPart[]) {
    if (contentParts.length === 0 || isStreaming.value) return

    if (currentConversationId.value === null) {
      currentConversationId.value = crypto.randomUUID()
    }

    // 构建纯文本（用于历史标题和显示）
    const textParts = contentParts
      .filter(p => p.type === 'text')
      .map(p => p.text || '')
      .join(' ')
    const hasFiles = contentParts.some(p => p.type !== 'text')

    const displayText = textParts || (hasFiles ? '[发送了文件]' : '')

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: displayText,
      userContent: hasFiles ? [...contentParts] : undefined,
      timestamp: Date.now()
    }
    messages.value.push(userMsg)

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    }
    messages.value.push(assistantMsg)
    const msgIndex = messages.value.length - 1

    isStreaming.value = true
    abortController = new AbortController()

    // 构建 API 消息历史（纯文本）+ 当前消息（多模态）
    const historyMessages: { role: string; content: string }[] = []
    for (const m of messages.value.slice(0, -2)) {
      // assistant 的历史消息始终是纯文本
      historyMessages.push({ role: m.role, content: m.content })
    }

    try {
      await sendMessage(
        contentParts,
        historyMessages,
        (text: string) => {
          messages.value[msgIndex].content += text
        },
        () => {
          isStreaming.value = false
          abortController = null
          saveToHistory()
        },
        (error: string) => {
          messages.value[msgIndex].content = `[错误] ${error}`
          isStreaming.value = false
          abortController = null
        },
        abortController.signal
      )
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User stopped
      } else {
        messages.value[msgIndex].content = messages.value[msgIndex].content || '[连接失败，请重试]'
      }
      isStreaming.value = false
      abortController = null
    }
  }

  function stopStreaming() {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    isStreaming.value = false
  }

  function clearMessages() {
    messages.value = []
    currentConversationId.value = null
  }

  function saveToHistory() {
    if (messages.value.length < 2) return
    const historyStore = useHistoryStore()
    const title = messages.value
      .find(m => m.role === 'user')
      ?.content
      .slice(0, 20) || '新对话'

    historyStore.saveConversation({
      id: currentConversationId.value!,
      title,
      createdAt: Date.now(),
      messages: messages.value.map(m => ({ ...m }))
    })
  }

  function loadFromConversation(conv: Conversation) {
    messages.value = conv.messages.map(m => ({ ...m }))
    currentConversationId.value = conv.id
  }

  return {
    messages,
    isStreaming,
    currentConversationId,
    send,
    stopStreaming,
    clearMessages,
    saveToHistory,
    loadFromConversation
  }
})
