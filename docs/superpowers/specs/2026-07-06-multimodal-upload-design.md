# 多模态上传（图片 & 文件）— 设计文档

**日期:** 2026-07-06  
**技术栈:** Vue3 + TypeScript + Pinia + Element Plus + Express + DeepSeek API  
**前置:** AI Chat MVP 基础功能已实现

---

## 1. 目标

在现有聊天应用中增加图片上传识别和文档上传分析功能。用户可以在输入框中上传文件，作为消息的一部分发送给 AI。

## 2. 支持的文件格式

| 格式 | 处理方式 | 依赖 |
|------|----------|------|
| 图片 (png/jpg/gif/webp) | 前端转 base64 → DeepSeek Vision API | 无 |
| PDF | pdf.js 每页渲染为图片 → Vision API | pdfjs-dist |
| Word (docx) | mammoth.js 提取文本 → 作为文字消息 | mammoth |
| 纯文本 (txt/md/code) | FileReader 读取文本 → 作为文字消息 | 无 |

**限制：**
- 单个文件最大 10MB
- 每次最多上传 5 个文件
- PDF 最多 20 页（超出仅处理前 20 页）

## 3. 数据模型变更

### 新增类型 `MessageContentPart`

```typescript
export interface MessageContentPart {
  type: 'text' | 'image_url' | 'file'
  text?: string
  image_url?: { url: string }       // base64 data URL
  file?: {
    name: string                     // 原始文件名
    content: string                  // 提取的文本或 base64 图片数据
    mimeType: string
    size: number                     // 字节
  }
}
```

### `Message` 类型扩展

```typescript
export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string                    // assistant 消息的 Markdown 文本
  userContent?: MessageContentPart[] // user 消息的结构化内容（新增，可选）
  timestamp: number
}
```

**设计原则：**
- `content` 字段保持不变，assistant 消息继续用它存 AI 返回的 Markdown
- `userContent` 仅在 user 消息有附件时存在，向后兼容
- `localStorage` 中历史记录同步存储 `userContent`

## 4. API 变更

### 请求格式变更

`POST /api/chat` 的 `messages` 数组中，user 消息的格式从纯文本变为可能包含结构化内容：

```json
{
  "messages": [
    {
      "role": "user",
      "content": "帮我看看这张图"
    },
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "分析这张截图" },
        { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }
      ]
    }
  ]
}
```

### 后端适配

后端在构建 DeepSeek API 请求时：
1. 如果 user 消息的 `content` 是字符串 → 直接使用（现有逻辑不变）
2. 如果 user 消息的 `content` 是数组（包含 `text` + `image_url` 混合） → 直接透传给 DeepSeek（OpenAI 多模态格式）

### 文档类文件处理

- **txt/md/code：** 文件内容以 `text` 类型拼接在 content 数组中
- **docx：** mammoth.js 提取文本后同上
- **PDF：** 每页渲染为图片（canvas → base64），以 `image_url` 类型发送给 Vision API

## 5. 组件结构

### 新增组件

```
UploadPreview.vue      上传预览区
  Props: files: PendingFile[]
  Emits: remove(index), clear
  └── 在 ChatInput 上方
  └── 图片显示缩略图，文件显示名称 + 大小
  └── 每个文件右上角有删除按钮
```

### 修改组件

```
ChatMessage.vue
  └── user 消息：遍历 userContent，图片用 el-image（可点击放大），文件用卡片展示
  └── assistant 消息：不变（Markdown 渲染）
  
ChatInput.vue
  └── 输入框下方加"上传文件"按钮（el-button + 隐藏的 input[type=file]）
  └── accept: "image/*,.pdf,.txt,.md,.docx,.doc,.js,.ts,.py,.json,.csv"
  
ChatView.vue
  └── ChatInput 上方嵌入 UploadPreview
  └── 管理 pendingFiles: PendingFile[] 状态
  └── 发送时：文本 + pendingFiles → MessageContentPart[] → chatStore.send()
  └── 发送后清空 pendingFiles 和输入框
```

### 上传按钮位置（ChatInput 布局）

```
┌─────────────────────────────────┐
│  [输入框]                         │
│                                  │
│  [📎 上传文件]        [发送/停止]  │
└─────────────────────────────────┘
```

## 6. 数据流

```
用户选择文件
  → ChatView 将文件加入 pendingFiles[]
  → UploadPreview 显示预览
  → async 处理文件:
      - 图片: FileReader → base64
      - docx: mammoth.extractRawText() → 文本
      - txt/md/code: FileReader.readAsText() → 文本
      - pdf: pdfjsLib.getDocument() → 逐页 canvas.toDataURL() → base64 数组
  → 处理完成后更新文件状态（loading → ready）
  
用户点击发送
  → ChatView 构建 MessageContentPart[]:
      - 输入框文本 → { type: 'text', text: '...' }
      - 每个图片 → { type: 'image_url', image_url: { url: 'data:...' } }
      - 每个文件 → { type: 'file', file: { name, content, mimeType, size } }
  → chatStore.send(contentParts)  // 改为接收 MessageContentPart[]
  → chatStore 构建 API messages:
      - user 消息的 content 设为 contentParts（数组格式）
  → chatApi.sendMessage() → POST /api/chat
  → 后端构建 DeepSeek 请求，透传 content 数组
  → SSE 流式返回
```

## 7. 错误处理

| 场景 | 处理方式 |
|------|----------|
| 文件过大 (>10MB) | 前端校验，el-message 提示 |
| 不支持的格式 | 前端校验 `accept` 属性 + JS 二次校验，提示 |
| 文件读取失败 | catch FileReader 异常，el-message 提示 |
| pdf.js 渲染失败 | 捕获异常，提示"PDF 处理失败" |
| DeepSeek 图片识别失败 | 后端返回 error 事件，前端显示错误消息 |
| base64 编码过大 | 前端限制 10MB，超出提示用户压缩 |

## 8. 依赖新增

```json
{
  "pdfjs-dist": "^4.x",    // PDF 渲染
  "mammoth": "^1.x"        // Word 文档文本提取
}
```

## 9. 不在本次范围

- 视频/音频上传
- 语音输入
- 拖拽上传（后续可加）
- 多文件批量对话（如"比较这两个 PDF"）
- 文件云端存储
- 上传进度条（MVP 阶段仅 loading 状态）
