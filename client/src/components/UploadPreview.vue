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
    <button class="clear-all-btn" @click="emit('clear')">清除全部</button>
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
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 16px;
  border-top: 1px solid #ebeef5;
  background: #fafafa;
}

.clear-all-btn {
  position: absolute;
  top: 4px;
  right: 12px;
  background: none;
  border: none;
  color: #909399;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}

.clear-all-btn:hover {
  color: #f56c6c;
  background: #fef0f0;
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
