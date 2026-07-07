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
    await page.render({ canvas, viewport }).promise
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
