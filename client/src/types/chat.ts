export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface Conversation {
  id: string
  title: string
  createdAt: number
  messages: Message[]
}

export interface ChatRequest {
  messages: { role: string; content: string }[]
  systemPrompt?: string
}

export interface SSEEvent {
  type: 'content' | 'done' | 'error'
  text?: string
  message?: string
}
