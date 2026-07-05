import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Conversation } from '../types/chat'

const STORAGE_KEY = 'ai-chat-conversations'

export const useHistoryStore = defineStore('history', () => {
  const conversations = ref<Conversation[]>([])

  function loadFromLocal() {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return

    try {
      conversations.value = JSON.parse(raw)
    } catch {
      conversations.value = []
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.value))
    } catch {
      alert('本地存储空间不足，请清理历史记录')
    }
  }

  function saveConversation(conv: Conversation) {
    const idx = conversations.value.findIndex(c => c.id === conv.id)
    if (idx >= 0) {
      conversations.value[idx] = {
        ...conv,
        messages: conv.messages.map(m => ({ ...m }))
      }
    } else {
      conversations.value.unshift({
        ...conv,
        messages: conv.messages.map(m => ({ ...m }))
      })
    }
    persist()
  }

  function deleteConversation(id: string) {
    conversations.value = conversations.value.filter(c => c.id !== id)
    persist()
  }

  function getConversation(id: string): Conversation | undefined {
    const c = conversations.value.find(c => c.id === id)
    return c ? { ...c, messages: c.messages.map(m => ({ ...m })) } : undefined
  }

  return {
    conversations,
    loadFromLocal,
    saveConversation,
    deleteConversation,
    getConversation
  }
})
