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
      // 图片检测：MIME type 或文件扩展名回退
      const isImage = file.type.startsWith('image/') ||
        /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(file.name)

      if (isImage) {
        // 图片 → OCR 提取文字
        const text = await extractImageText(file)
        pendingFiles.value[fileIndex] = { ...pendingFile, status: 'ready', data: text }
      } else if (file.name.endsWith('.pdf')) {
        // PDF → 直接提取文本
        const text = await extractPDFText(file)
        pendingFiles.value[fileIndex] = { ...pendingFile, status: 'ready', data: text }
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

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })
}

async function extractImageText(file: File): Promise<string> {
  const Tesseract = (await import('tesseract.js')).default
  const imageUrl = URL.createObjectURL(file)
  try {
    const result = await Tesseract.recognize(imageUrl, 'chi_sim+eng')
    return result.data.text.slice(0, 10000)
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

async function extractPDFText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.1.200/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const MAX_PAGES = 20
  const pageCount = Math.min(pdf.numPages, MAX_PAGES)
  const pageTexts: string[] = []

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ')
      .trim()
    if (pageText) {
      pageTexts.push(`[第${i}页] ${pageText}`)
    }
  }

  return pageTexts.join('\n').slice(0, 10000) // 限制文本长度
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

    // 检查是否为实际图片 data URL（base64 编码的图片）
    if (file.data && file.data.startsWith('data:image/')) {
      parts.push({
        type: 'image_url',
        image_url: { url: file.data }
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
      :has-files="pendingFiles.length > 0"
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
