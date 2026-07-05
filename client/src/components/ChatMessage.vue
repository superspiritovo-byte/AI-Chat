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
