# 轻聊 Chatbox（Chatbox Lite）

> 纯静态、本地优先的中文 AI 对话网页 —— Chatbox 核心功能的轻量网页移植版。

**在线体验：<https://chatbox-lite.rth1.xyz>**

基于 [chatboxai/chatbox](https://github.com/chatboxai/chatbox) 的核心交互理念精简移植：去掉桌面端依赖与内置模型服务，保留最纯粹的对话体验。零依赖、零构建、零外部 CDN，整个应用只有 5 个文件约 60KB，任何静态托管都能直接部署。

## 特性

- **多会话管理**：新建 / 重命名 / 删除 / 清空，首条消息自动命名
- **自带接口（BYOK）**：OpenAI 兼容格式（Base URL + API Key + 模型名）。内置 10 家服务商一键预设：DeepSeek / OpenAI / Kimi / 通义千问 / 智谱 GLM / 硅基流动 / 火山方舟 / 腾讯混元 / OpenRouter / Ollama 本地（预设只填接口地址与推荐模型，**不内置任何密钥或代理服务**）
- **聊天对象自定义**：AI 与自己的名称随意设置；头像可用代码绘制的矢量图形（8 种图形 × 8 种颜色）搭配，也可**上传本地图片**（自动居中裁剪为方形并压缩到约 2KB，仅保存在本设备浏览器中）。**全应用不使用任何 emoji、图片文件或第三方图标库**，所有图标均为手写 SVG 路径
- **流式输出**：逐字显示、随时停止，中断时保留已生成内容；支持 DeepSeek-R1 等推理模型的「思考过程」折叠展示
- **Markdown 渲染**：自研渲染器，支持代码高亮 + 一键复制、表格、列表、引用、链接；渲染前全量转义，防 XSS
- **本地优先，天然防撤回**：所有数据仅存于浏览器 localStorage，没有后端、没有上报，任何人都无法远程撤回或删除你的聊天记录
- **存档导入导出**：单会话导出 Markdown；全量数据 JSON 备份与恢复（按会话 id 去重合并，可选择是否一并恢复接口配置；旧版备份中的字符串头像会自动迁移为绘制头像）
- **深色模式**　**移动端适配**：抽屉侧边栏、安全区适配、触控友好

## 快速开始

### 在线使用

1. 打开 <https://chatbox-lite.rth1.xyz>
2. 点击「去设置接口」，选择服务商预设（或手动填写 Base URL）
3. 填入你自己的 API 密钥与模型名，保存
4. 开始对话

### 本地运行

无需安装任何依赖：

```bash
git clone https://github.com/LXgssy/chatbox-lite.git
cd chatbox-lite
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

> 直接双击 `index.html` 也可以打开；但部分浏览器对 `file://` 协议下的 localStorage 有限制，推荐起一个本地静态服务。

### 部署到任意静态托管

把整个目录上传到热铁盒网页托管 / GitHub Pages / Netlify / Vercel / Cloudflare Pages 等任何静态托管即可，**无需构建步骤**。

## 隐私与安全

- 所有配置与聊天记录**只保存在你自己的浏览器**里；应用没有后端、没有统计、没有遥测
- API 密钥仅用于在你的浏览器与模型服务商之间直接通信，不经过任何第三方
- 清除浏览器数据等于删除全部记录，请先在「设置 → 数据」中导出备份
- 注意：从浏览器直接调用部分海外接口可能受 CORS 限制，请选择允许浏览器跨域调用的服务，或自建带 CORS 头的反代后填写反代地址

## 项目结构

```
chatbox-lite/
├── index.html        # 页面骨架（图标全部为内联 SVG）
├── css/style.css     # 样式（主题变量 / 深色模式 / 移动端适配）
└── js/
    ├── icons.js      # 纯手绘 SVG 图标库（线性图标 + 头像图形）
    ├── markdown.js   # 自研轻量 Markdown 渲染器（含代码高亮）
    └── app.js        # 主逻辑（会话管理 / 流式请求 / 本地存储 / 设置）
```

## 致谢

- [chatboxai/chatbox](https://github.com/chatboxai/chatbox) —— 本项目的交互设计移植自其社区版

## 许可证

本项目遵循上游 [Chatbox Community Edition](https://github.com/chatboxai/chatbox) 的协议，以 [GPL-3.0](LICENSE) 协议开源。
