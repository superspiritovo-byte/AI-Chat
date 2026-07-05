# AI Chat MVP — 设计文档

**日期:** 2026-07-06  
**技术栈:** Vue3 + TypeScript + Pinia + Element Plus + Express + Claude API

---

## 1. 目标

构建一个 AI 聊天应用的 MVP 版本，用于简历展示。核心目标是让面试官看到：
- 与 AI API 的流式通信能力（SSE）
- Vue3 + TypeScript 的组合式 API 熟练度
- Pinia 状态管理设计思路
- 前后端分离架构理解

非 MVP 目标：用户系统、后端数据库、多模型切换、对话分支、插件系统等均不在本次范围。

---

## 2. 整体架构

```
┌─────────────────────────────────────────┐
│  浏览器 (Vue3 SPA)                       │
│                                          │
│  聊天视图 (主页)  │  侧边栏 (历史列表)     │
│                                          │
│  Pinia: chatStore  │  historyStore       │
│  (当前会话)         │  (localStorage)     │
│         │                                │
└─────────┼────────────────────────────────┘
          │ HTTP POST + SSE
┌─────────┼────────────────────────────────┐
│  Express 代理层                           │
│  POST /api/chat → Anthropic API (stream) │
│  职责: 隐藏 API Key、SSE 流透传           │
└──────────────────────────────────────────┘
```

**隔离原则：**
- 前端不知道 API Key 的存在
- Express 不做业务逻辑，只做转发和错误包装
- Pinia store 之间通过组合式 API 通信（historyStore 不直接修改 chatStore 状态）

---

## 3. 组件树 & 路由

```
App.vue
├── /chat → ChatView.vue
│   ├── ChatMessage.vue     单条消息（Markdown 渲染）
│   ├── ChatInput.vue       输入框 + 发送 + 停止生成
│   └── ChatWelcome.vue     空状态欢迎页
│
└── /history → HistoryView.vue
    └── HistoryItem.vue      单条历史摘要卡片
```

**布局：** 全局使用 Element Plus 的 `el-container` / `el-menu` 做侧边栏 + 主内容区布局，不单独抽布局组件。

---

## 4. 状态管理

### chatStore

| 字段 | 类型 | 说明 |
|------|------|------|
| `messages` | `Message[]` | 当前会话消息列表 |
| `isStreaming` | `boolean` | 是否正在接收流式响应 |

| 方法 | 说明 |
|------|------|
| `sendMessage(text)` | 发送消息 → 调 API → 处理 SSE 流 |
| `stopStreaming()` | 中断当前流（AbortController） |
| `clearMessages()` | 清空当前会话 |
| `saveToHistory()` | 保存当前消息到 localStorage |

### historyStore

| 字段 | 类型 | 说明 |
|------|------|------|
| `conversations` | `Conversation[]` | 历史会话列表 |

| 方法 | 说明 |
|------|------|
| `loadFromLocal()` | 从 localStorage 加载所有历史 |
| `saveConversation(conv)` | 新增或更新一条历史 |
| `deleteConversation(id)` | 删除一条历史 |
| `getConversation(id)` | 按 ID 读取并恢复到 chatStore |

### localStorage 数据格式

```json
{
  "conversations": [
    {
      "id": "uuid",
      "title": "首条用户消息前 20 字",
      "createdAt": 1700000000000,
      "messages": [
        { "role": "user", "content": "...", "timestamp": 1700000000000 },
        { "role": "assistant", "content": "...", "timestamp": 1700000001000 }
      ]
    }
  ]
}
```

---

## 5. API 设计

### POST /api/chat

**请求：**
```json
{
  "messages": [{ "role": "user", "content": "你好" }],
  "systemPrompt": "你是一个有帮助的助手"
}
```

**响应：** SSE 流（`text/event-stream`）

每个事件为 JSON：
```json
{"type":"content","text":"你"}
{"type":"done"}
{"type":"error","message":"API Key invalid"}
```

**事件类型：**

| type | 说明 |
|------|------|
| `content` | 一个文本增量，追加到当前 assistant 消息 |
| `done` | 流正常结束 |
| `error` | 异常（Key 错误、网络超时等） |

### Express 代理职责

1. 读取 `.env` 中 `ANTHROPIC_API_KEY`
2. 拼接 system prompt + messages，转发到 Anthropic Messages API（`stream: true`）
3. 逐 chunk 包装为统一事件格式透传给前端
4. 错误统一包装为 `{ type: "error", message: "..." }` 格式

---

## 6. 错误处理

| 场景 | 处理方式 |
|------|----------|
| API Key 无效 / 过期 | SSE 流返回 error 事件，前端 toast 提示 |
| 网络断开 | fetch 抛出异常，前段显示"连接失败，请重试" |
| 流中途中断 | 用户点"停止"用 AbortController 取消；已接收的部分保留 |
| localStorage 满 | 保存时 catch 并提示用户清理历史 |
| 空消息发送 | 前端校验，空内容不可发送 |

---

## 7. 目录结构

```
vue/
├── client/                  # Vue3 前端
│   ├── src/
│   │   ├── views/           # ChatView, HistoryView
│   │   ├── components/      # ChatMessage, ChatInput, ChatWelcome, HistoryItem
│   │   ├── stores/          # chatStore.ts, historyStore.ts
│   │   ├── api/             # chatApi.ts (fetch + SSE 解析)
│   │   ├── types/           # Message, Conversation 等类型定义
│   │   ├── router/          # Vue Router 配置
│   │   ├── App.vue          # 根组件（含全局布局）
│   │   └── main.ts
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── server/                  # Express 代理层
│   ├── src/
│   │   └── index.ts         # 唯一入口，/api/chat 路由
│   ├── .env                 # ANTHROPIC_API_KEY
│   ├── tsconfig.json
│   └── package.json
│
└── README.md
```

---

## 8. 不在本次范围

- 用户登录/注册
- 后端数据库持久化
- 多模型切换
- 对话分支树
- 消息搜索
- Markdown 导出
- Prompt 模板
- Token 用量统计
- 单元测试（工程规范选择从简）
