# AI Chat MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI chat MVP where users chat with Claude via a streaming interface, with local conversation history.

**Architecture:** Vue3 SPA frontend communicates via SSE to an Express proxy layer. The proxy forwards requests to Anthropic's Messages API and transparently relays streaming responses. Conversation history is stored in localStorage.

**Tech Stack:** Vue 3.4+, TypeScript 5, Pinia, Element Plus, Vue Router 4, Vite 5, Express 4, marked (Markdown rendering), uuid (message IDs)

## Global Constraints

- Vue 3.4+ with `<script setup lang="ts">` syntax for all components
- Element Plus as the sole UI component library — no custom CSS framework
- Express proxy runs on port 3001; Vite dev server on port 5173 with proxy to 3001
- API Key stored in `server/.env` as `ANTHROPIC_API_KEY`, never in client code
- l18n: all UI text in Chinese (简体中文)

---

### Task 1: Scaffold Client Project

**Files:**
- Create: `client/package.json`
- Create: `client/index.html`
- Create: `client/vite.config.ts`
- Create: `client/tsconfig.json`
- Create: `client/tsconfig.node.json`

**Interfaces:**
- Produces: Vite + Vue3 project ready to run on port 5173, configured to proxy `/api` → `http://localhost:3001`

- [ ] **Step 1: Create client/package.json**

```json
{
  "name": "ai-chat-client",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.4.0",
    "vue-router": "^4.3.0",
    "pinia": "^2.1.0",
    "element-plus": "^2.7.0",
    "marked": "^13.0.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "typescript": "^5.4.0",
    "vite": "^5.4.0",
    "vue-tsc": "^2.0.0"
  }
}
```

- [ ] **Step 2: Install client dependencies**

Run: `cd client && npm install`
Expected: Dependencies installed without errors

- [ ] **Step 3: Create client/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Chat</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 4: Create client/vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
```

- [ ] **Step 5: Create client/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"]
}
```

- [ ] **Step 6: Create client/tsconfig.node.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 7: Create empty src directory structure**

Run:
```bash
mkdir -p client/src/{views,components,stores,api,types,router}
```

- [ ] **Step 8: Verify scaffolding**

Run: `cd client && npx vite --host 2>&1 | head -5`
Expected: Vite dev server starts (will error on missing main.ts — that's fine, we just want to confirm Vite starts)

- [ ] **Step 9: Commit**

```bash
git add client/package.json client/index.html client/vite.config.ts client/tsconfig.json client/tsconfig.node.json
git commit -m "feat: scaffold Vue3 + Vite client project"
```

---

### Task 2: Scaffold Server Project

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/.env.example`

**Interfaces:**
- Produces: Express project directory ready for source code

- [ ] **Step 1: Create server/package.json**

```json
{
  "name": "ai-chat-server",
  "private": true,
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "express": "^4.19.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.12.0",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Install server dependencies**

Run: `cd server && npm install`
Expected: Dependencies installed without errors

- [ ] **Step 3: Create server/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create server directory structure**

Run:
```bash
mkdir -p server/src
```

- [ ] **Step 5: Create server/.env.example**

```
ANTHROPIC_API_KEY=your-api-key-here
```

- [ ] **Step 6: Create server/.gitignore within server/**

```
node_modules/
dist/
.env
```

- [ ] **Step 7: Commit**

```bash
git add server/package.json server/tsconfig.json server/.env.example server/.gitignore
git commit -m "feat: scaffold Express server project"
```

---

### Task 3: Define TypeScript Types

**Files:**
- Create: `client/src/types/chat.ts`

**Interfaces:**
- Produces:
  - `Message { id: string; role: 'user' | 'assistant'; content: string; timestamp: number }`
  - `Conversation { id: string; title: string; createdAt: number; messages: Message[] }`
  - `ChatRequest { messages: { role: string; content: string }[]; systemPrompt?: string }`
  - `SSEEvent { type: 'content' | 'done' | 'error'; text?: string; message?: string }`

- [ ] **Step 1: Create client/src/types/chat.ts**

```typescript
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
```

- [ ] **Step 2: Verify types compile**

Run: `cd client && npx vue-tsc --noEmit src/types/chat.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add client/src/types/chat.ts
git commit -m "feat: define TypeScript types for chat domain"
```

---

### Task 4: Build Express /api/chat Endpoint

**Files:**
- Create: `server/src/index.ts`

**Interfaces:**
- Consumes: SSEEvent type shape from Task 3 (conceptual — server doesn't import client types)
- Produces: `POST /api/chat` — accepts `{ messages: { role: string, content: string }[], systemPrompt?: string }`, responds with SSE stream of `data: {"type":"content"|"done"|"error", ...}\n\n`

- [ ] **Step 1: Create server/src/index.ts**

```typescript
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
```

- [ ] **Step 2: Verify server starts**

Run: `cd server && npx tsx src/index.ts &`
Wait 2 seconds, then:
Run: `curl http://localhost:3001/api/chat -X POST -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"hi"}]}' 2>&1 | head -5`
Expected: SSE error event about API Key (since .env not set), or if .env set with real key, streaming response

- [ ] **Step 3: Stop test server**

Run: `kill %1 2>/dev/null || true`

- [ ] **Step 4: Commit**

```bash
git add server/src/index.ts
git commit -m "feat: implement Express /api/chat SSE proxy endpoint"
```

---

### Task 5: Build Client API Layer

**Files:**
- Create: `client/src/api/chatApi.ts`

**Interfaces:**
- Consumes: `ChatRequest` shape (inline), `SSEEvent` concepts from Task 3
- Produces: `sendMessage(messages, onContent, onDone, onError, signal?): Promise<void>` — opens SSE connection, calls callbacks for each event type

- [ ] **Step 1: Create client/src/api/chatApi.ts**

```typescript
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
```

- [ ] **Step 2: Verify compilation**

Run: `cd client && npx vue-tsc --noEmit src/api/chatApi.ts`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add client/src/api/chatApi.ts
git commit -m "feat: add client SSE chat API layer"
```

---

### Task 6: Build Pinia Stores

**Files:**
- Create: `client/src/stores/chatStore.ts`
- Create: `client/src/stores/historyStore.ts`

**Interfaces:**
- Consumes: `Message`, `Conversation` from Task 3; `sendMessage` from Task 5
- Produces for chatStore: `messages`, `isStreaming`, `send(text)`, `stopStreaming()`, `clearMessages()`, `saveToHistory()`, `loadFromConversation(conv)`
- Produces for historyStore: `conversations`, `loadFromLocal()`, `saveConversation(conv)`, `deleteConversation(id)`, `getConversation(id)`

- [ ] **Step 1: Create client/src/stores/chatStore.ts**

```typescript
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
```

- [ ] **Step 2: Create client/src/stores/historyStore.ts**

```typescript
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
```

- [ ] **Step 3: Verify stores compile**

Run: `cd client && npx vue-tsc --noEmit src/stores/chatStore.ts src/stores/historyStore.ts`
Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add client/src/stores/chatStore.ts client/src/stores/historyStore.ts
git commit -m "feat: add chatStore and historyStore Pinia stores"
```

---

### Task 7: Set Up Vue Router

**Files:**
- Create: `client/src/router/index.ts`

**Interfaces:**
- Produces: Vue Router instance with routes `/chat` (ChatView) and `/history` (HistoryView), default redirect `/` → `/chat`

- [ ] **Step 1: Create client/src/router/index.ts**

```typescript
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/chat'
    },
    {
      path: '/chat',
      name: 'chat',
      component: () => import('../views/ChatView.vue')
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('../views/HistoryView.vue')
    }
  ]
})

export default router
```

- [ ] **Step 2: Verify router compiles**

Run: `cd client && npx vue-tsc --noEmit src/router/index.ts`
Expected: Error about missing view files — that's expected at this stage (they don't exist yet). The import syntax is correct.

- [ ] **Step 3: Commit**

```bash
git add client/src/router/index.ts
git commit -m "feat: configure Vue Router with /chat and /history routes"
```

---

### Task 8: Build ChatMessage Component

**Files:**
- Create: `client/src/components/ChatMessage.vue`

**Interfaces:**
- Consumes: `Message` type from Task 3
- Produces: `<ChatMessage :message="Message" />` — renders a single chat message with role label and Markdown content

- [ ] **Step 1: Create client/src/components/ChatMessage.vue**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import type { Message } from '../types/chat'

const props = defineProps<{
  message: Message
}>()

const roleLabel = computed(() => props.message.role === 'user' ? '你' : 'Claude')
const roleClass = computed(() => props.message.role === 'user' ? 'user' : 'assistant')

const renderedContent = computed(() => {
  if (!props.message.content) return ''
  return marked.parse(props.message.content) as string
})
</script>

<template>
  <div :class="['chat-message', roleClass]">
    <div class="message-role">{{ roleLabel }}</div>
    <div class="message-content" v-html="renderedContent"></div>
  </div>
</template>

<style scoped>
.chat-message {
  padding: 12px 16px;
  margin-bottom: 8px;
  border-radius: 8px;
  max-width: 85%;
}

.chat-message.user {
  background-color: #ecf5ff;
  margin-left: auto;
}

.chat-message.assistant {
  background-color: #f5f5f5;
  margin-right: auto;
}

.message-role {
  font-size: 12px;
  font-weight: 600;
  color: #909399;
  margin-bottom: 4px;
}

.message-content :deep(p) {
  margin: 4px 0;
  line-height: 1.6;
}

.message-content :deep(pre) {
  background: #282c34;
  color: #abb2bf;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
}

.message-content :deep(code) {
  font-family: 'Courier New', monospace;
  font-size: 13px;
}

.message-content :deep(p code) {
  background: #e8e8e8;
  padding: 2px 6px;
  border-radius: 3px;
}
</style>
```

- [ ] **Step 2: Verify component compiles**

Run: `cd client && npx vue-tsc --noEmit src/components/ChatMessage.vue`
Expected: No errors (may warn about unused import if vue-tsc strict — ignore)

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ChatMessage.vue
git commit -m "feat: add ChatMessage component with Markdown rendering"
```

---

### Task 9: Build ChatInput Component

**Files:**
- Create: `client/src/components/ChatInput.vue`

**Interfaces:**
- Consumes: Nothing from other tasks directly (receives props)
- Produces: `<ChatInput :disabled="boolean" :isStreaming="boolean" @send="(text: string) => void" @stop="() => void" />`

- [ ] **Step 1: Create client/src/components/ChatInput.vue**

```vue
<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  disabled: boolean
  isStreaming: boolean
}>()

const emit = defineEmits<{
  send: [text: string]
  stop: []
}>()

const inputText = ref('')

function handleSend() {
  const text = inputText.value.trim()
  if (!text || props.disabled) return
  emit('send', text)
  inputText.value = ''
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}
</script>

<template>
  <div class="chat-input-container">
    <el-input
      v-model="inputText"
      type="textarea"
      :rows="3"
      :disabled="disabled"
      placeholder="输入消息，Enter 发送，Shift+Enter 换行"
      @keydown="handleKeydown"
    />
    <div class="input-actions">
      <el-button
        v-if="!isStreaming"
        type="primary"
        :disabled="!inputText.trim() || disabled"
        @click="handleSend"
      >
        发送
      </el-button>
      <el-button
        v-else
        type="danger"
        @click="emit('stop')"
      >
        停止生成
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.chat-input-container {
  padding: 16px;
  border-top: 1px solid #ebeef5;
  background: #fff;
}

.input-actions {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
}
</style>
```

- [ ] **Step 2: Verify component compiles**

Run: `cd client && npx vue-tsc --noEmit src/components/ChatInput.vue`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ChatInput.vue
git commit -m "feat: add ChatInput component with send and stop actions"
```

---

### Task 10: Build ChatWelcome Component

**Files:**
- Create: `client/src/components/ChatWelcome.vue`

**Interfaces:**
- Produces: `<ChatWelcome @send="(text: string) => void" />` — displayed when messages array is empty; shows welcome text and example prompts

- [ ] **Step 1: Create client/src/components/ChatWelcome.vue**

```vue
<script setup lang="ts">
const emit = defineEmits<{
  send: [text: string]
}>()

const examplePrompts = [
  '介绍一下你自己',
  '用 TypeScript 写一个快速排序',
  '解释一下什么是 SSE'
]
</script>

<template>
  <div class="welcome">
    <h2>AI Chat</h2>
    <p class="subtitle">基于 Claude API 的智能对话助手</p>
    <div class="examples">
      <p class="examples-label">试试这些：</p>
      <el-button
        v-for="prompt in examplePrompts"
        :key="prompt"
        class="example-btn"
        @click="emit('send', prompt)"
      >
        {{ prompt }}
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px;
  text-align: center;
}

.welcome h2 {
  font-size: 28px;
  color: #303133;
  margin-bottom: 8px;
}

.subtitle {
  color: #909399;
  margin-bottom: 32px;
}

.examples {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.examples-label {
  color: #909399;
  font-size: 14px;
  margin-bottom: 4px;
}

.example-btn {
  width: 280px;
}
</style>
```

- [ ] **Step 2: Verify component compiles**

Run: `cd client && npx vue-tsc --noEmit src/components/ChatWelcome.vue`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ChatWelcome.vue
git commit -m "feat: add ChatWelcome component with example prompts"
```

---

### Task 11: Build HistoryItem Component

**Files:**
- Create: `client/src/components/HistoryItem.vue`

**Interfaces:**
- Consumes: `Conversation` type from Task 3
- Produces: `<HistoryItem :conversation="Conversation" @click="() => void" @delete="() => void" />`

- [ ] **Step 1: Create client/src/components/HistoryItem.vue**

```vue
<script setup lang="ts">
import type { Conversation } from '../types/chat'

defineProps<{
  conversation: Conversation
}>()

const emit = defineEmits<{
  click: []
  delete: []
}>()

function formatDate(timestamp: number): string {
  const d = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))

  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours} 小时前`
  if (hours < 48) return '昨天'
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="history-item" @click="emit('click')">
    <div class="history-info">
      <div class="history-title">{{ conversation.title }}</div>
      <div class="history-meta">
        {{ formatDate(conversation.createdAt) }} · {{ conversation.messages.length }} 条消息
      </div>
    </div>
    <el-button
      type="danger"
      size="small"
      text
      @click.stop="emit('delete')"
    >
      删除
    </el-button>
  </div>
</template>

<style scoped>
.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f2f2f2;
  cursor: pointer;
  transition: background-color 0.2s;
}

.history-item:hover {
  background-color: #f5f7fa;
}

.history-info {
  flex: 1;
  min-width: 0;
}

.history-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-meta {
  font-size: 12px;
  color: #c0c4cc;
  margin-top: 4px;
}
</style>
```

- [ ] **Step 2: Verify component compiles**

Run: `cd client && npx vue-tsc --noEmit src/components/HistoryItem.vue`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add client/src/components/HistoryItem.vue
git commit -m "feat: add HistoryItem component"
```

---

### Task 12: Build ChatView

**Files:**
- Create: `client/src/views/ChatView.vue`

**Interfaces:**
- Consumes: `useChatStore` from Task 6, `ChatMessage` from Task 8, `ChatInput` from Task 9, `ChatWelcome` from Task 10
- Produces: Full chat page — message list (auto-scrolling) + input area or welcome screen

- [ ] **Step 1: Create client/src/views/ChatView.vue**

```vue
<script setup lang="ts">
import { watch, nextTick, ref } from 'vue'
import { useChatStore } from '../stores/chatStore'
import ChatMessage from '../components/ChatMessage.vue'
import ChatInput from '../components/ChatInput.vue'
import ChatWelcome from '../components/ChatWelcome.vue'

const store = useChatStore()
const messageListRef = ref<HTMLElement | null>(null)

function scrollToBottom() {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  })
}

watch(() => store.messages.length, scrollToBottom)
watch(() => {
  const msgs = store.messages
  if (msgs.length > 0) {
    return msgs[msgs.length - 1].content
  }
  return ''
}, scrollToBottom)
</script>

<template>
  <div class="chat-view">
    <div class="message-list" ref="messageListRef">
      <ChatWelcome
        v-if="store.messages.length === 0"
        @send="store.send"
      />
      <ChatMessage
        v-for="msg in store.messages"
        :key="msg.id"
        :message="msg"
      />
    </div>
    <ChatInput
      :disabled="false"
      :is-streaming="store.isStreaming"
      @send="store.send"
      @stop="store.stopStreaming"
    />
  </div>
</template>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
</style>
```

- [ ] **Step 2: Verify compilation**

Run: `cd client && npx vue-tsc --noEmit src/views/ChatView.vue`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add client/src/views/ChatView.vue
git commit -m "feat: add ChatView with message list and auto-scroll"
```

---

### Task 13: Build HistoryView

**Files:**
- Create: `client/src/views/HistoryView.vue`

**Interfaces:**
- Consumes: `useHistoryStore` from Task 6, `useChatStore` from Task 6, `HistoryItem` from Task 11, Vue Router's `useRouter`
- Produces: Full history page listing all saved conversations

- [ ] **Step 1: Create client/src/views/HistoryView.vue**

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useHistoryStore } from '../stores/historyStore'
import { useChatStore } from '../stores/chatStore'
import HistoryItem from '../components/HistoryItem.vue'

const router = useRouter()
const historyStore = useHistoryStore()
const chatStore = useChatStore()

onMounted(() => {
  historyStore.loadFromLocal()
})

function openConversation(id: string) {
  const conv = historyStore.getConversation(id)
  if (!conv) return
  chatStore.loadFromConversation(conv)
  router.push('/chat')
}

function removeConversation(id: string) {
  historyStore.deleteConversation(id)
}
</script>

<template>
  <div class="history-view">
    <div class="history-header">
      <h3>对话历史</h3>
    </div>
    <div v-if="historyStore.conversations.length === 0" class="empty">
      <p>暂无历史对话</p>
      <el-button type="primary" @click="router.push('/chat')">开始对话</el-button>
    </div>
    <div v-else class="history-list">
      <HistoryItem
        v-for="conv in historyStore.conversations"
        :key="conv.id"
        :conversation="conv"
        @click="openConversation(conv.id)"
        @delete="removeConversation(conv.id)"
      />
    </div>
  </div>
</template>

<style scoped>
.history-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.history-header {
  padding: 16px;
  border-bottom: 1px solid #ebeef5;
}

.history-header h3 {
  margin: 0;
  font-size: 18px;
  color: #303133;
}

.empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
  gap: 16px;
}

.history-list {
  flex: 1;
  overflow-y: auto;
}
</style>
```

- [ ] **Step 2: Verify compilation**

Run: `cd client && npx vue-tsc --noEmit src/views/HistoryView.vue`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add client/src/views/HistoryView.vue
git commit -m "feat: add HistoryView with conversation list"
```

---

### Task 14: Build App.vue Layout

**Files:**
- Create: `client/src/App.vue`

**Interfaces:**
- Consumes: Vue Router (`router-view`, `router-link` or `useRouter`)
- Produces: Global layout with sidebar navigation + main content area

- [ ] **Step 1: Create client/src/App.vue**

```vue
<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { useChatStore } from './stores/chatStore'

const router = useRouter()
const route = useRoute()
const chatStore = useChatStore()

function handleNewChat() {
  chatStore.clearMessages()
  router.push('/chat')
}
</script>

<template>
  <el-container class="app-container">
    <el-aside width="240px" class="app-aside">
      <div class="sidebar-header">
        <el-button type="primary" @click="handleNewChat">
          + 新对话
        </el-button>
      </div>
      <el-menu
        :default-active="route.path"
        @select="(path: string) => router.push(path)"
      >
        <el-menu-item index="/chat">
          <span>对话</span>
        </el-menu-item>
        <el-menu-item index="/history">
          <span>历史记录</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-main class="app-main">
      <router-view />
    </el-main>
  </el-container>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
</style>

<style scoped>
.app-container {
  height: 100vh;
}

.app-aside {
  background-color: #fafafa;
  border-right: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 16px;
}

.app-main {
  padding: 0;
  height: 100vh;
  overflow: hidden;
}
</style>
```

- [ ] **Step 2: Verify compilation**

Run: `cd client && npx vue-tsc --noEmit src/App.vue`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add client/src/App.vue
git commit -m "feat: add App.vue with sidebar layout"
```

---

### Task 15: Build main.ts Entry Point

**Files:**
- Create: `client/src/main.ts`

**Interfaces:**
- Consumes: `App.vue` (Task 14), router (Task 7), Pinia, Element Plus
- Produces: Bootstrapped Vue application

- [ ] **Step 1: Create client/src/main.ts**

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.mount('#app')
```

- [ ] **Step 2: Create client/src/vite-env.d.ts**

```typescript
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
```

- [ ] **Step 3: Verify full client build**

Run: `cd client && npx vite build`
Expected: Build succeeds with no errors (may have warnings about chunk size — ignore)

- [ ] **Step 4: Commit**

```bash
git add client/src/main.ts client/src/vite-env.d.ts
git commit -m "feat: add main.ts entry point and vite env types"
```

---

### Task 16: Write README.md

**Files:**
- Create: `README.md`

**Interfaces:**
- Produces: Project documentation covering setup and usage

- [ ] **Step 1: Create README.md**

```markdown
# AI Chat

基于 Vue3 + TypeScript + Pinia + Claude API 的 AI 聊天应用。

## 技术栈

- **前端:** Vue 3.4 + TypeScript + Pinia + Element Plus + Vue Router 4 + Vite 5
- **后端代理:** Express 4 + TypeScript
- **AI 接口:** Anthropic Claude Messages API（SSE 流式响应）

## 快速开始

### 1. 配置 API Key

```bash
cp server/.env.example server/.env
```

编辑 `server/.env`，填入你的 Anthropic API Key：

```
ANTHROPIC_API_KEY=sk-ant-xxx
```

### 2. 启动后端代理

```bash
cd server
npm install
npm run dev
```

代理运行在 http://localhost:3001

### 3. 启动前端

```bash
cd client
npm install
npm run dev
```

前端运行在 http://localhost:5173，API 请求自动代理到 3001 端口。

## 项目结构

```
├── client/                  # Vue3 前端
│   ├── src/
│   │   ├── api/             # SSE 通信层
│   │   ├── components/      # UI 组件
│   │   ├── router/          # 路由配置
│   │   ├── stores/          # Pinia 状态管理
│   │   ├── types/           # TypeScript 类型
│   │   ├── views/           # 页面视图
│   │   ├── App.vue          # 根布局
│   │   └── main.ts          # 入口
│   └── vite.config.ts
├── server/                  # Express 代理层
│   └── src/index.ts         # /api/chat 端点
└── docs/superpowers/        # 设计文档和实现计划
```

## 功能

- 流式 AI 对话（SSE）
- Markdown 渲染（代码高亮）
- 对话历史本地存储
- 多会话管理
- 停止生成 / 错误重试

## License

MIT
```

- [ ] **Step 2: Create root .gitignore**

```
node_modules/
dist/
.env
*.log
```

- [ ] **Step 3: Commit**

```bash
git add README.md .gitignore
git commit -m "docs: add README and .gitignore"
```

---

### Task 17: Integration Test

**Files:**
- No new files

**Interfaces:**
- Consumes: Entire application from Tasks 1-16

- [ ] **Step 1: Start server**

Run: `cd server && npx tsx src/index.ts &`
Note: Ensure `server/.env` has a valid `ANTHROPIC_API_KEY` before testing.

- [ ] **Step 2: Start client**

Run: `cd client && npx vite --host &`

- [ ] **Step 3: Smoke test — open browser**

Open `http://localhost:5173` in browser. Verify:
- Sidebar shows "对话" and "历史记录" menu items
- "新对话" button is visible
- Chat page shows welcome screen with example prompts
- Clicking an example prompt sends a message
- Claude responds with streaming text (Markdown renders)
- "停止生成" button appears during streaming
- After conversation, navigate to /history — conversation appears
- Clicking a history conversation loads it into chat view
- Deleting a history conversation removes it

- [ ] **Step 4: Stop servers**

Run:
```bash
kill %1 %2 2>/dev/null || true
```

- [ ] **Step 5: Commit final state**

```bash
git add -A
git commit -m "chore: integration test passed, MVP complete"
```
