import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Message, Conversation } from '../types/chat'
import { sendMessage } from '../api/chatApi'
import { useHistoryStore } from './historyStore'

export const useChatStore = defineStore('chat', () => {
  const messages = ref<Message[]>([])
  const isStreaming = ref(false)
  let abortController: AbortController | null = null

  async function send(text: string) {
    if (!text.trim() || isStreaming.value) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
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

    isStreaming.value = true
    abortController = new AbortController()

    const apiMessages = messages.value
      .filter(m => m.content !== '')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    try {
      await sendMessage(
        apiMessages,
        (text) => {
          assistantMsg.content += text
        },
        () => {
          isStreaming.value = false
          abortController = null
          saveToHistory()
        },
        (error) => {
          assistantMsg.content = `[错误] ${error}`
          isStreaming.value = false
          abortController = null
        },
        abortController.signal
      )
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User stopped; keep whatever content we got
      } else {
        assistantMsg.content = assistantMsg.content || '[连接失败，请重试]'
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
  }

  function saveToHistory() {
    if (messages.value.length < 2) return
    const historyStore = useHistoryStore()
    const title = messages.value
      .find(m => m.role === 'user')
      ?.content
      .slice(0, 20) || '新对话'

    historyStore.saveConversation({
      id: crypto.randomUUID(),
      title,
      createdAt: Date.now(),
      messages: messages.value.map(m => ({ ...m }))
    })
  }

  function loadFromConversation(conv: Conversation) {
    messages.value = conv.messages.map(m => ({ ...m }))
  }

  return {
    messages,
    isStreaming,
    send,
    stopStreaming,
    clearMessages,
    saveToHistory,
    loadFromConversation
  }
})
