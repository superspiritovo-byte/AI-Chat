<script setup lang="ts">
import { computed, ref } from 'vue'
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
