<script setup lang="ts">
import { watch, nextTick, ref } from 'vue'
import { useChatStore } from '../stores/chatStore'
import ChatMessage from '../components/ChatMessage.vue'
import ChatInput from '../components/ChatInput.vue'
import ChatWelcome from '../components/ChatWelcome.vue'

const store = useChatStore()
const messageListRef = ref<HTMLElement | null>(null)

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
</script>

<template>
  <div class="chat-view">
    <div class="message-list" ref="messageListRef">
      <ChatWelcome
        v-if="store.messages.length === 0"
        @send="store.send"
      />
      <ChatMessage
        v-for="msg in store.messages"
        :key="msg.id"
        :message="msg"
      />
    </div>
    <ChatInput
      :disabled="false"
      :is-streaming="store.isStreaming"
      @send="store.send"
      @stop="store.stopStreaming"
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
