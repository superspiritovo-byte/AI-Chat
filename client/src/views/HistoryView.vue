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
