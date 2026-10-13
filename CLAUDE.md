# CLAUDE.md

本文件为 Claude Code 在本仓库中处理代码时提供指导。

## 项目概述

灵犀 AI Chat —— 基于 Vue 3 + TypeScript 前端与 Express 代理后端的多模态 AI 聊天应用，对接 DeepSeek Chat API。界面文案与代码注释均使用中文。

根目录 **没有 `package.json`**。`client/` 和 `server/` 是两个互相独立的 npm 工程，各自持有 `node_modules`；所有命令都必须在对应目录内执行。

## 常用命令

```bash
# 首次配置
cp server/.env.example server/.env   # 然后填入 DEEPSEEK_API_KEY

# 后端（终端 1）—— tsx watch，http://localhost:3001
cd server && npm install && npm run dev

# 前端（终端 2）—— Vite dev server，http://localhost:5173
cd client && npm install && npm run dev

# 类型检查 / 构建
cd client && npm run build     # 执行 `vue-tsc && vite build`，这是唯一的类型检查入口
cd server && npm run build     # tsc -> server/dist，随后 `npm start` 运行
```

两端必须同时运行应用才可用：Vite 会把 `/api` 代理到 `http://localhost:3001`（[vite.config.ts](client/vite.config.ts)）。

两个工程都 **没有配置测试框架**。验证前端改动最快的方式是 `cd client && npx vue-tsc --noEmit`。

## 架构

### SSE 协议是前后端之间的唯一契约

服务端并不会原样转发 DeepSeek 的 SSE 流，而是解析后重新发出一个更简单的协议，每个 `data:` 行一个 JSON 对象：

```
{ type: 'content', text: string }   // 追加到 assistant 消息
{ type: 'done' }                    // 流结束
{ type: 'error', message: string }  // 任意失败，包括缺少 API Key
```

[server/src/index.ts](server/src/index.ts) 读取 DeepSeek 的 OpenAI 兼容 `chat/completions` 流，把 `choices[0].delta.content` / `finish_reason` 映射为上述事件；[client/src/api/chatApi.ts](client/src/api/chatApi.ts) 负责消费。**改动事件结构必须同时改两端** —— 客户端会静默忽略未知事件类型和无法解析的行，因此协议不匹配时不会报错，只会悄悄失效。

API Key 只存在于服务端进程（`DEEPSEEK_API_KEY`，通过 `dotenv` 加载），永远不会下发到浏览器。模型名与 base URL 是硬编码在 [server/src/index.ts](server/src/index.ts) 顶部的常量。

### 多模态消息：只有当前这一轮是结构化的

`Message` 同时携带 `content`（纯文本字符串，始终存在 —— 用于展示和历史标题）与可选的 `userContent` 数组，元素为 `MessageContentPart`（`text` | `image_url` | `file`）。

发送时，只有**当前**用户消息会以结构化 content parts 序列化；此前所有轮次都会先被压平成纯文本再放入 API 的 `messages` 数组（[chatStore.ts:51-55](client/src/stores/chatStore.ts#L51-L55)、[chatApi.ts:26-41](client/src/api/chatApi.ts#L26-L41)）。仅含单个文本 part 时还会进一步收敛为裸字符串，因为 API 对非多模态轮次要求这种形式。因此附件不会以结构化形式留存到对话历史中。

### 文件处理全部发生在客户端

后端不接收任何上传。[ChatView.vue:32-144](client/src/views/ChatView.vue#L32-L144) 的 `handleUpload` 按 MIME 类型（带扩展名兜底）选择解析器，把提取出的**文本**写入 `pendingFile.data`，随后该文本作为 `file` part 内联进请求体。各解析器均采用动态 import，以免进入主包：

- 图片（以及走扩展名兜底的命中的文件）→ `tesseract.js` OCR，语言 `chi_sim+eng`
- `.pdf` → `pdfjs-dist`，最多前 20 页
- `.doc` / `.docx` → `mammoth` 提取原始文本
- 其余 → `FileReader.readAsText`

提取文本会截断到 10,000 字符；上传上限为 5 个文件、每个 10 MB。由于图片是被 OCR 成文本而不是以 base64 传递，`image_url` part 类型以及 `handleSend` 中的 `data:image/` 分支目前实际上是死代码。

注意：`pdfjsLib.GlobalWorkerOptions.workerSrc` 指向 CDN 上 pdf.js `6.1.200` 的固定地址，必须与 `client/package.json` 中的 `pdfjs-dist` 版本保持一致 —— 版本不一致会导致 PDF 解析失败（见提交 `06846ec`）。

### 状态与持久化

- [client/src/stores/chatStore.ts](client/src/stores/chatStore.ts) 持有实时 `messages` 数组、`isStreaming`，以及"停止生成"所用的 `AbortController`。流式内容直接写入 `messages.value[msgIndex].content`。
- [client/src/stores/historyStore.ts](client/src/stores/historyStore.ts) 把对话持久化到 `localStorage`，键为 `ai-chat-conversations`。只有流正常结束时才会保存（`saveToHistory` 在 `onDone` 回调中调用），因此中途停止或报错的那一轮不会进入历史记录。
- assistant 消息在 [ChatMessage.vue](client/src/components/ChatMessage.vue) 中通过 `marked` + `DOMPurify.sanitize` 渲染为 Markdown。请保留 sanitize 步骤 —— 内容是模型生成的。

### 已知的粗糙点

- assistant 的角色标签在 [ChatMessage.vue:18](client/src/components/ChatMessage.vue#L18) 硬编码为 `"Claude"`，但后端实际是 DeepSeek。
- `tsconfig.json` 声明了 `@/*` 路径别名，但 [vite.config.ts](client/vite.config.ts) 没有配置对应的 `resolve.alias`，因此 `@/` 形式的导入在运行时无法解析。现有代码统一使用相对路径导入。
- 服务端的消息映射只处理 `user` 与 `assistant` 两种角色，其余角色会被静默丢弃。

## 规划文档

`docs/superpowers/plans/` 与 `docs/superpowers/specs/` 存放本项目的 MVP 与多模态上传设计文档；`.superpowers/sdd/` 是 SDD 的中间工作状态（任务简报、报告、评审 diff），不属于源码。
