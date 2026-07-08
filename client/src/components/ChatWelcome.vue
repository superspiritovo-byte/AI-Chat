<script setup lang="ts">
const emit = defineEmits<{
  send: [text: string]
}>()

const examplePrompts = [
  '介绍一下你自己',
  '用 TypeScript 写一个快速排序',
  '解释一下什么是 SSE'
]
</script>

<template>
  <div class="welcome">
    <h2>灵犀</h2>
    <p class="subtitle">能看懂图片和文档的 AI 助手</p>
    <div class="examples">
      <p class="examples-label">试试这些：</p>
      <el-button
        v-for="prompt in examplePrompts"
        :key="prompt"
        class="example-btn"
        @click="emit('send', prompt)"
      >
        {{ prompt }}
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px;
  text-align: center;
}

.welcome h2 {
  font-size: 28px;
  color: #303133;
  margin-bottom: 8px;
}

.subtitle {
  color: #909399;
  margin-bottom: 32px;
}

.examples {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.examples-label {
  color: #909399;
  font-size: 14px;
  margin-bottom: 4px;
}

.example-btn {
  width: 280px;
}
</style>
