# Bili2Insight

从 B 站视频到 AI 观点提炼的一站式桌面工具。  
输入一个 Bilibili 视频链接，自动完成音频下载、语音识别、AI 校对提炼，最终生成一份结构化的 Markdown 笔记——包含视频元信息、AI 总结、核心观点、标签和完整文稿。

![Bili2Insight](./screenshot.png)

## 功能特性

- **多 P / 合集支持** — 自动识别视频的多 P 页面和 ugc_season 合集，可选任意分 P 批量处理
- **视频信息预览** — 粘贴链接即显示封面、标题、UP 主、时长和全部页面列表
- **音频自动下载** — 通过 B 站 WBI 签名接口获取最高质量音频流，支持合集剧集的逐集 bvid 解析
- **队列批量处理** — 支持同时添加多个来源（URL、收藏夹、本地），按顺序排队处理，进度实时展示
- **本地语音识别** — 基于 sherpa-onnx + Paraformer-large，离线运行，无需联网
- **AI 文稿校对** — 使用 LLM 修正 ASR 识别错误、补充标点，保留原意
- **AI 观点提炼** — 将口语化视频文稿提炼为「总体概要 + 核心观点与支撑 + 情绪基调」的结构化笔记
- **Markdown 导出** — 支持一键复制和导出 `.md` 文件，多 P 结果支持分页查看和合并导出
- **Pipeline 日志** — 完整记录每一步的输入输出（视频信息、AI 原始请求/响应），方便调试和审计
- **多 AI 提供商** — 内置 DeepSeek、OpenAI 预设，支持自定义 OpenAI 兼容 API
- **HTTP 代理支持** — 适配网络受限环境

## 处理流程

```
Bilibili URL
  → Python Worker (WBI 签名, 获取元数据 + 下载 m4a 音频)
  → FFmpeg (转码为 16kHz 单声道 WAV)
  → Python Worker (sherpa-onnx Paraformer VAD + ASR)
  → LLM API (文稿校对, 修正识别错误)
  → LLM API (结构化观点提炼)
  → Markdown 报告
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | [Tauri v2](https://v2.tauri.app/) (Rust) |
| 前端 | Vue 3 + TypeScript + Naive UI + Pinia + Vite |
| 音频下载 | Python + httpx (B 站 WBI 签名, 文件级 Key 缓存, 指数退避重试) |
| 音频转码 | FFmpeg |
| 语音识别 | Python + [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) Paraformer-large (离线) |
| AI 接口 | OpenAI 兼容 API (DeepSeek / OpenAI / 自定义), 120s 请求超时 |
| HTTP 客户端 | reqwest (Rust), httpx (Python) |

## 环境要求

- **Python** 3.9+ 并安装 `sherpa-onnx` 和 `httpx`：
  ```bash
  pip install sherpa-onnx httpx
  ```
- **FFmpeg**（需在 PATH 中可用）
- **ASR 模型文件**：下载 [Paraformer-large](https://github.com/k2-fsa/sherpa-onnx/releases) 的 `model.int8.onnx` 和 `tokens.txt`，放入 `src-tauri/resources/models/paraformer-large/` 目录
- **Rust** (开发构建时)：
  ```bash
  winget install Rustlang.Rustup
  ```
- **Node.js** 18+ (开发构建时)

## 快速开始

### 开发模式
```bash
# 安装前端依赖
npm install

# 放置 ASR 模型
mkdir -p src-tauri/resources/models/paraformer-large
# 将 model.int8.onnx 和 tokens.txt 放入 src-tauri/resources/models/paraformer-large/

# 构建 Python sidecar
cd worker
python -m PyInstaller --clean --noconfirm bili_worker.spec
copy dist\bili_worker.exe ..\src-tauri\binaries\bili_worker-x86_64-pc-windows-msvc.exe
cd ..

# 启动
npx tauri dev
```

### 构建
```bash
npx tauri build
```
构建产物位于 `src-tauri/target/release/`。

## 使用说明

1. 打开应用，进入首页，可选择三种输入源：
   - **URL** — 粘贴 Bilibili 视频链接（支持 `BV...`、`av...` 等格式）
   - **收藏夹** — 从 B 站收藏夹批量添加
   - **本地** — 直接输入文本
2. 粘贴链接后会自动显示视频预览，多 P 视频可勾选要处理的页面
3. 点击「添加到队列」将选中页面加入处理队列
4. 切换到队列页，点击「开始处理」依次执行：下载 → 转码 → 识别 → AI 分析
5. 处理完成后点击「查看」进入结果页，可 **复制** 或 **导出** Markdown
6. 多 P 结果支持分页查看和合并导出，点击 **日志** 可查看每步原始数据

### 设置

- **HTTP Proxy** — 配置代理地址（如 `http://127.0.0.1:7897`），用于访问 B 站和 AI API
- **AI Provider** — 选择 DeepSeek / OpenAI / Custom
- **API URL / Key / Model** — 配置 LLM 接口参数
- **AI Prompt** — 自定义观点提炼的系统提示词，内置三种模板（观点提炼、技术文稿提炼、信息溯源）
- **Test Connection & Fetch Models** — 验证连接并自动拉取可用模型列表

## 项目结构

```
bili2insight/
├── src/                      # Vue 3 前端
│   ├── App.vue               # 主界面
│   ├── stores/app.ts         # Pinia 状态管理 & 流水线逻辑
│   ├── views/
│   │   ├── HomeView.vue      # 首页（多源入口）
│   │   ├── QueueView.vue     # 处理队列
│   │   ├── SourceUrlView.vue # URL 输入 & 多 P 选择
│   │   └── ResultView.vue    # 结果展示 & 日志抽屉
│   └── utils/
│       ├── invoke.ts         # Tauri IPC 调用封装
│       └── types.ts          # 类型定义
├── src-tauri/                # Tauri (Rust) 后端
│   ├── src/
│   │   ├── lib.rs            # 入口 & 数据结构
│   │   ├── commands.rs       # Tauri commands
│   │   ├── pipeline.rs       # 流水线（下载/ASR/AI）
│   │   └── export.rs         # Markdown 生成
│   ├── binaries/             # Python sidecar 二进制
│   └── resources/models/     # ASR 模型文件
├── worker/                   # Python 工作进程
│   ├── bili_worker.py        # B 站 API & 音频下载 (WBI 签名, 合集解析)
│   ├── bili_worker.spec      # PyInstaller 配置
│   └── asr_worker.py         # VAD 分段 + Paraformer 识别
├── package.json
├── vite.config.ts
└── README.md
```

## License

MIT