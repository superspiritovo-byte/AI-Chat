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
