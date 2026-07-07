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
