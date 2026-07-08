# 灵犀 AI Chat

基于 Vue3 + TypeScript + Pinia + DeepSeek API 的多模态 AI 聊天应用。支持图片识别和文档分析。

## 技术栈

- **前端:** Vue 3.4 + TypeScript + Pinia + Element Plus + Vue Router 4 + Vite 5
- **后端代理:** Express 4 + TypeScript
- **AI 接口:** DeepSeek Chat API（SSE 流式响应 + Vision 多模态识别）
- **文档处理:** pdfjs-dist + mammoth.js

## 快速开始

### 1. 配置 API Key

```bash
cp server/.env.example server/.env
```

编辑 `server/.env`，填入你的 DeepSeek API Key：

```
DEEPSEEK_API_KEY=your-deepseek-api-key-here
```

### 2. 启动后端代理

```bash
cd server
npm install
npm run dev
```

代理运行在 http://localhost:3001

### 3. 启动前端

```bash
cd client
npm install
npm run dev
```

前端运行在 http://localhost:5173，API 请求自动代理到 3001 端口。

## 项目结构

```
├── client/                  # Vue3 前端
│   ├── src/
│   │   ├── api/             # SSE 通信层
│   │   ├── components/      # UI 组件
│   │   ├── router/          # 路由配置
│   │   ├── stores/          # Pinia 状态管理
│   │   ├── types/           # TypeScript 类型
│   │   ├── views/           # 页面视图
│   │   ├── App.vue          # 根布局
│   │   └── main.ts          # 入口
│   └── vite.config.ts
├── server/                  # Express 代理层
│   └── src/index.ts         # /api/chat 端点
└── docs/superpowers/        # 设计文档和实现计划
```

## 功能

- 流式 AI 对话（SSE）
- Markdown 渲染（代码高亮）
- 图片上传识别（Vision API）
- 文档上传分析（PDF / Word / 文本）
- 对话历史本地存储
- 多会话管理
- 停止生成 / 错误重试

## License

MIT
