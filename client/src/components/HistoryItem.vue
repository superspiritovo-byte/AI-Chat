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
