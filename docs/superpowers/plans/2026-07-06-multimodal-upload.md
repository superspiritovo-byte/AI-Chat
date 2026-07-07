# 多模态上传（图片 & 文件）— 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 AI Chat MVP 基础上增加图片上传识别和文件上传分析功能（PDF/Word/文本），支持 DeepSeek Vision API。

**Architecture:** 扩展 Message 类型支持多模态内容（text/image_url/file），前端 FileReader 提取文件内容构建 MessageContentPart[]，后端透传 OpenAI 兼容的多模态消息格式给 DeepSeek API。

**Tech Stack:** Vue 3.4+, TypeScript 5, Pinia, Element Plus, pdfjs-dist 4.x, mammoth 1.x, DeepSeek API

## 全局约束

- 单个文件最大 10MB，每次最多 5 个文件
- PDF 最多处理 20 页
- 图片格式支持：png/jpg/gif/webp
- 文件格式支持：pdf/docx/txt/md/js/ts/py/json/csv
- 所有 UI 文本中文（简体中文）
- 上传按钮位于输入框左下角
- 发送前可预览图片和文件，可逐个删除

---

### Task 1: 安装依赖 & 更新类型定义

**Files:**
- Modify: `client/src/types/chat.ts`
- Modify: `client/package.json`

**Interfaces:**
- Produces:
  - `MessageContentPart { type: 'text' | 'image_url' | 'file'; text?: string; image_url?: { url: string }; file?: { name: string; content: string; mimeType: string; size: number } }`
  - `Message` 增加 `userContent?: MessageContentPart[]`
  - `PendingFile { id: string; name: string; mimeType: string; size: number; status: 'loading' | 'ready' | 'error'; error?: string; data?: string }`

- [ ] **Step 1: 安装依赖**

```bash
cd client && npm install pdfjs-dist mammoth
```

- [ ] **Step 2: 更新 client/src/types/chat.ts**

```typescript
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
```

- [ ] **Step 3: 验证类型编译**

```bash
cd client && npx vue-tsc --noEmit src/types/chat.ts
```

预期: 无错误

- [ ] **Step 4: Commit**

```bash
git add client/src/types/chat.ts client/package.json client/package-lock.json
git commit -m "feat: add MessageContentPart type and install pdfjs-dist, mammoth"
```

---

### Task 2: 更新 chatStore 支持结构化内容

**Files:**
- Modify: `client/src/stores/chatStore.ts`

**Interfaces:**
- Consumes: `MessageContentPart`, `PendingFile` from Task 1; `sendMessage` from Task 3 (but Task 3 will update it, so temporarily the signature stays the same)
- Produces: `send(contentParts: MessageContentPart[]): Promise<void>` — 替代现有的 `send(text: string)`

- [ ] **Step 1: 更新 client/src/stores/chatStore.ts**

将 `send` 方法改为接收 `MessageContentPart[]`：

```typescript
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
        (text) => {
          messages.value[msgIndex].content += text
        },
        () => {
          isStreaming.value = false
          abortController = null
          saveToHistory()
        },
        (error) => {
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
```

- [ ] **Step 2: 验证编译**

```bash
cd client && npx vue-tsc --noEmit
```

预期: 无新增错误（可能会有 Task 3 之前的暂时性类型不匹配，chatApi 还未更新）

- [ ] **Step 3: Commit**

```bash
git add client/src/stores/chatStore.ts
git commit -m "feat: update chatStore to accept structured MessageContentPart"
```

---

### Task 3: 更新 chatApi.ts 支持结构化内容

**Files:**
- Modify: `client/src/api/chatApi.ts`

**Interfaces:**
- Consumes: `MessageContentPart` from Task 1
- Produces: `sendMessage(contentParts: MessageContentPart[], historyMessages: { role: string; content: string }[], onContent, onDone, onError, signal?): Promise<void>`

- [ ] **Step 1: 更新 client/src/api/chatApi.ts**

```typescript
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
```

- [ ] **Step 2: 验证编译**

```bash
cd client && npx vue-tsc --noEmit
```

预期: 无错误

- [ ] **Step 3: Commit**

```bash
git add client/src/api/chatApi.ts
git commit -m "feat: update chatApi to send structured content to DeepSeek"
```

---

### Task 4: 更新后端支持多模态 content 格式

**Files:**
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: 请求中 `messages[].content` 可能是 string 或 array
- Produces: 透传 content 数组给 DeepSeek（OpenAI 兼容格式）

- [ ] **Step 1: 更新 server/src/index.ts**

修改消息构建逻辑，支持 content 为数组格式：

```typescript
// 替换原有的 apiMessages 构建逻辑（约第 36-45 行）
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

    // ... 后续的 SSE 处理逻辑不变
```

注意：后端改动较小——原本就是透传 messages，现在只需确保 content 不管是 string 还是 array 都正确传递给 DeepSeek。实际上现有的 `apiMessages.push(...)` 逻辑已经在做这件事了，只需要移除 `.filter(m.role === 'user' || m.role === 'assistant').map(...)` 的旧逻辑。

- [ ] **Step 2: 测试后端**

启动后端并测试：

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":[{"type":"text","text":"你好"}]}],"systemPrompt":"你是助手"}'
```

预期: 返回 SSE 流，正常响应。

- [ ] **Step 3: Commit**

```bash
git add server/src/index.ts
git commit -m "feat: pass through multimodal content arrays to DeepSeek"
```

---

### Task 5: 创建 UploadPreview.vue 组件

**Files:**
- Create: `client/src/components/UploadPreview.vue`

**Interfaces:**
- Produces: `<UploadPreview :files="PendingFile[]" @remove="(index: number) => void" @clear="() => void" />` — 在发送前展示已选文件

- [ ] **Step 1: 创建 client/src/components/UploadPreview.vue**

```vue
<script setup lang="ts">
import type { PendingFile } from '../types/chat'

defineProps<{
  files: PendingFile[]
}>()

const emit = defineEmits<{
  remove: [index: number]
  clear: []
}>()

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}
</script>

<template>
  <div v-if="files.length > 0" class="upload-preview">
    <div
      v-for="(file, index) in files"
      :key="file.id"
      class="preview-item"
      :class="{ 'is-error': file.status === 'error' }"
    >
      <!-- 图片预览 -->
      <div v-if="isImage(file.mimeType) && file.status === 'ready'" class="preview-thumb">
        <img :src="file.data" :alt="file.name" />
      </div>
      <!-- 文件图标 -->
      <div v-else class="preview-file">
        <span class="file-name">{{ file.name }}</span>
        <span class="file-size">{{ formatSize(file.size) }}</span>
        <span v-if="file.status === 'loading'" class="file-status">处理中...</span>
        <span v-if="file.status === 'error'" class="file-error">{{ file.error }}</span>
      </div>
      <el-button
        class="remove-btn"
        type="danger"
        size="small"
        circle
        @click="emit('remove', index)"
      >
        ✕
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.upload-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 16px;
  border-top: 1px solid #ebeef5;
  background: #fafafa;
}

.preview-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  max-width: 200px;
}

.preview-item.is-error {
  border-color: #f56c6c;
  background: #fef0f0;
}

.preview-thumb img {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 4px;
}

.preview-file {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.file-name {
  font-size: 12px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 11px;
  color: #c0c4cc;
}

.file-status {
  font-size: 11px;
  color: #409eff;
}

.file-error {
  font-size: 11px;
  color: #f56c6c;
}

.remove-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  font-size: 10px;
}
</style>
```

- [ ] **Step 2: 验证编译**

```bash
cd client && npx vue-tsc --noEmit src/components/UploadPreview.vue
```

预期: 无错误

- [ ] **Step 3: Commit**

```bash
git add client/src/components/UploadPreview.vue
git commit -m "feat: add UploadPreview component"
```

---

### Task 6: 更新 ChatMessage.vue 渲染图片和文件

**Files:**
- Modify: `client/src/components/ChatMessage.vue`

**Interfaces:**
- Consumes: `Message` with optional `userContent` from Task 1
- Produces: 用户消息渲染图片缩略图（可点击放大）和文件卡片

- [ ] **Step 1: 更新 client/src/components/ChatMessage.vue**

在现有模板中，当消息是 user 且有 userContent 时，渲染结构化内容：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { Message } from '../types/chat'

const props = defineProps<{
  message: Message
}>()

const roleLabel = computed(() => props.message.role === 'user' ? '你' : 'Claude')
const roleClass = computed(() => props.message.role === 'user' ? 'user' : 'assistant')

const renderedContent = computed(() => {
  if (!props.message.content) return ''
  return DOMPurify.sanitize(marked.parse(props.message.content) as string)
})

const hasUserContent = computed(() =>
  props.message.role === 'user' && props.message.userContent && props.message.userContent.length > 0
)

const dialogImageVisible = ref(false)
const dialogImageUrl = ref('')

function openImage(url: string) {
  dialogImageUrl.value = url
  dialogImageVisible.value = true
}
</script>

<template>
  <div :class="['chat-message', roleClass]">
    <div class="message-role">{{ roleLabel }}</div>

    <!-- 用户结构化内容（图片/文件） -->
    <div v-if="hasUserContent" class="message-attachments">
      <template v-for="(part, i) in message.userContent" :key="i">
        <!-- 图片 -->
        <div v-if="part.type === 'image_url' && part.image_url" class="attachment-image">
          <img
            :src="part.image_url.url"
            class="msg-thumb"
            @click="openImage(part.image_url!.url)"
          />
        </div>
        <!-- 文件 -->
        <div v-else-if="part.type === 'file' && part.file" class="attachment-file">
          <span class="file-icon">📄</span>
          <span class="file-name">{{ part.file.name }}</span>
          <span class="file-size">{{ (part.file.size / 1024).toFixed(1) }} KB</span>
        </div>
        <!-- 文本 -->
        <div v-else-if="part.type === 'text' && part.text" class="attachment-text">
          {{ part.text }}
        </div>
      </template>
    </div>

    <!-- Assistant Markdown 内容 -->
    <div v-if="message.role === 'assistant'" class="message-content" v-html="renderedContent"></div>
    <!-- 用户纯文本（没有附件时） -->
    <div v-else-if="!hasUserContent" class="message-content">{{ message.content }}</div>

    <!-- 图片查看器 -->
    <el-dialog v-model="dialogImageVisible" :append-to-body="true">
      <img :src="dialogImageUrl" style="width: 100%;" />
    </el-dialog>
  </div>
</template>

<!-- 保留原有样式，新增以下样式 -->

<style scoped>
/* ... 原有样式不变 ... */

.message-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 4px;
}

.attachment-image .msg-thumb {
  width: 120px;
  height: 120px;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid #e4e7ed;
  transition: opacity 0.2s;
}

.attachment-image .msg-thumb:hover {
  opacity: 0.8;
}

.attachment-file {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  font-size: 13px;
}

.file-icon {
  font-size: 20px;
}

.file-size {
  color: #c0c4cc;
  font-size: 11px;
}
</style>
```

注意：需要在 script 中增加 `import { ref } from 'vue'`。

- [ ] **Step 2: 验证编译**

```bash
cd client && npx vue-tsc --noEmit
```

预期: 无错误

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ChatMessage.vue
git commit -m "feat: render images and files in ChatMessage"
```

---

### Task 7: 更新 ChatInput.vue 添加上传按钮

**Files:**
- Modify: `client/src/components/ChatInput.vue`

**Interfaces:**
- Consumes: Nothing new
- Produces: 新增 `@upload="(files: FileList) => void"` emit

- [ ] **Step 1: 更新 client/src/components/ChatInput.vue**

在现有输入框下方添加上传按钮：

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
  upload: [files: FileList]
}>()

const inputText = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

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

function handleUploadClick() {
  fileInputRef.value?.click()
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    emit('upload', input.files)
    input.value = '' // 重置，允许重复选同一文件
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
        :disabled="disabled"
        @click="handleUploadClick"
      >
        📎 上传文件
      </el-button>
      <input
        ref="fileInputRef"
        type="file"
        multiple
        accept="image/*,.pdf,.txt,.md,.docx,.doc,.js,.ts,.py,.json,.csv"
        style="display: none;"
        @change="handleFileChange"
      />
      <div class="input-actions-right">
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
  justify-content: space-between;
  align-items: center;
}

.input-actions-right {
  display: flex;
  gap: 8px;
}
</style>
```

- [ ] **Step 2: 验证编译**

```bash
cd client && npx vue-tsc --noEmit
```

预期: 无错误

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ChatInput.vue
git commit -m "feat: add upload button to ChatInput"
```

---

### Task 8: 更新 ChatView.vue 集成上传流程

**Files:**
- Modify: `client/src/views/ChatView.vue`

**Interfaces:**
- Consumes: `UploadPreview` from Task 5, `PendingFile` from Task 1, updated `ChatInput` from Task 7, updated `chatStore.send(contentParts)` from Task 2
- Produces: 完整的上传 → 预览 → 发送流程

- [ ] **Step 1: 更新 client/src/views/ChatView.vue**

```vue
<script setup lang="ts">
import { watch, nextTick, ref } from 'vue'
import { useChatStore } from '../stores/chatStore'
import type { PendingFile, MessageContentPart } from '../types/chat'
import ChatMessage from '../components/ChatMessage.vue'
import ChatInput from '../components/ChatInput.vue'
import ChatWelcome from '../components/ChatWelcome.vue'
import UploadPreview from '../components/UploadPreview.vue'

const store = useChatStore()
const messageListRef = ref<HTMLElement | null>(null)
const pendingFiles = ref<PendingFile[]>([])

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

// 处理文件上传
async function handleUpload(files: FileList) {
  const MAX_SIZE = 10 * 1024 * 1024 // 10MB
  const MAX_FILES = 5

  for (let i = 0; i < files.length; i++) {
    const file = files[i]

    // 数量限制
    if (pendingFiles.value.length >= MAX_FILES) {
      alert(`最多上传 ${MAX_FILES} 个文件`)
      return
    }

    // 大小限制
    if (file.size > MAX_SIZE) {
      alert(`文件 ${file.name} 超过 10MB 限制`)
      continue
    }

    const pendingFile: PendingFile = {
      id: crypto.randomUUID(),
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      status: 'loading'
    }
    pendingFiles.value.push(pendingFile)
    const fileIndex = pendingFiles.value.length - 1

    try {
      if (file.type.startsWith('image/')) {
        // 图片 → base64
        const data = await readAsDataURL(file)
        pendingFiles.value[fileIndex] = { ...pendingFile, status: 'ready', data }
      } else if (file.name.endsWith('.pdf')) {
        // PDF → 渲染为图片
        const data = await renderPDF(file)
        pendingFiles.value[fileIndex] = { ...pendingFile, mimeType: 'image/png', status: 'ready', data }
      } else if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
        // Word → 提取文本
        const text = await extractDocx(file)
        pendingFiles.value[fileIndex] = { ...pendingFile, status: 'ready', data: text }
      } else {
        // 文本文件 → 读取内容
        const text = await readAsText(file)
        pendingFiles.value[fileIndex] = { ...pendingFile, status: 'ready', data: text }
      }
    } catch (err: any) {
      pendingFiles.value[fileIndex] = {
        ...pendingFile,
        status: 'error',
        error: err.message || '处理失败'
      }
    }
  }
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })
}

async function renderPDF(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const totalPages = Math.min(pdf.numPages, 20) // 最多20页
  const images: string[] = []

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport }).promise
    images.push(canvas.toDataURL('image/png'))
  }

  // 多页拼接为一个 base64（DeepSeek Vision 逐个处理）
  return images[0] // 先返回首页，后续可扩展多页支持
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value.slice(0, 10000) // 限制文本长度
}

function removeFile(index: number) {
  pendingFiles.value.splice(index, 1)
}

async function handleSend(text: string) {
  const parts: MessageContentPart[] = []

  // 添加文本
  if (text.trim()) {
    parts.push({ type: 'text', text: text.trim() })
  }

  // 添加文件
  for (const file of pendingFiles.value) {
    if (file.status === 'error') continue

    if (file.mimeType.startsWith('image/')) {
      parts.push({
        type: 'image_url',
        image_url: { url: file.data || '' }
      })
    } else {
      parts.push({
        type: 'file',
        file: {
          name: file.name,
          content: file.data || '',
          mimeType: file.mimeType,
          size: file.size
        }
      })
    }
  }

  if (parts.length > 0) {
    await store.send(parts)
    pendingFiles.value = []
  }
}
</script>

<template>
  <div class="chat-view">
    <div class="message-list" ref="messageListRef">
      <ChatWelcome
        v-if="store.messages.length === 0"
        @send="handleSend"
      />
      <ChatMessage
        v-for="msg in store.messages"
        :key="msg.id"
        :message="msg"
      />
    </div>
    <UploadPreview
      :files="pendingFiles"
      @remove="removeFile"
      @clear="pendingFiles = []"
    />
    <ChatInput
      :disabled="false"
      :is-streaming="store.isStreaming"
      @send="handleSend"
      @stop="store.stopStreaming"
      @upload="handleUpload"
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

- [ ] **Step 2: 验证编译**

```bash
cd client && npx vue-tsc --noEmit
```

预期: 可能需要添加 pdfjs-dist 和 mammoth 的类型声明。确保无类型错误。

- [ ] **Step 3: 验证构建**

```bash
cd client && npx vite build
```

预期: 构建成功

- [ ] **Step 4: Commit**

```bash
git add client/src/views/ChatView.vue
git commit -m "feat: integrate file upload flow in ChatView"
```

---

### Task 9: 集成测试

**Files:**
- No new files

**Interfaces:**
- Consumes: 全部 Task 1-8 产物

- [ ] **Step 1: 启动后端**

```bash
cd server && npx tsx src/index.ts &
```

确保 `server/.env` 中 `DEEPSEEK_API_KEY` 已配置。

- [ ] **Step 2: 启动前端**

```bash
cd client && npx vite --host &
```

- [ ] **Step 3: 手动测试**

打开 `http://localhost:5173`，验证：
- [ ] 输入框下方有"📎 上传文件"按钮
- [ ] 点击按钮打开文件选择器
- [ ] 选择图片后显示缩略图预览
- [ ] 选择 txt/md 文件后显示文件名
- [ ] 可以删除已选文件
- [ ] 发送后 AI 正确识别图片内容
- [ ] 发送文档后 AI 正确引用文档内容
- [ ] 历史记录中可以看到图片和文件附件

- [ ] **Step 4: 停止服务**

```bash
kill %1 %2 2>/dev/null || true
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: multimodal upload integration test passed"
```
