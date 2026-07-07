export interface MessageContentPart {
  type: 'text' | 'image_url' | 'file'
  text?: string
  image_url?: { url: string }
  file?: {
    name: string
    content: string
    mimeType: string
    size: number
  }
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  userContent?: MessageContentPart[]
  timestamp: number
}

export interface PendingFile {
  id: string
  name: string
  mimeType: string
  size: number
  status: 'loading' | 'ready' | 'error'
  error?: string
  data?: string
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
