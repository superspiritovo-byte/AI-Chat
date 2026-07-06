<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { useChatStore } from './stores/chatStore'

const router = useRouter()
const route = useRoute()
const chatStore = useChatStore()

function handleNewChat() {
  chatStore.clearMessages()
  router.push('/chat')
}
</script>

<template>
  <el-container class="app-container">
    <el-aside width="240px" class="app-aside">
      <div class="sidebar-header">
        <el-button type="primary" @click="handleNewChat">
          + 新对话
        </el-button>
      </div>
      <el-menu
        :default-active="route.path"
        @select="(path: string) => router.push(path)"
      >
        <el-menu-item index="/chat">
          <span>对话</span>
        </el-menu-item>
        <el-menu-item index="/history">
          <span>历史记录</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-main class="app-main">
      <router-view />
    </el-main>
  </el-container>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
</style>

<style scoped>
.app-container {
  height: 100vh;
}

.app-aside {
  background-color: #fafafa;
  border-right: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 16px;
}

.app-main {
  padding: 0;
  height: 100vh;
  overflow: hidden;
}
</style>
