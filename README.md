# Bili2Insight

B站视频 · AI 观点提炼 · 结构化笔记

输入 Bilibili 视频链接或本地音视频文件，自动下载音频、语音识别、AI 提炼观点，生成结构化 Markdown 笔记。

## 快速开始

### 环境要求

- **Python** 3.9+（需安装 sherpa-onnx、httpx、numpy）
- **FFmpeg**（需在 PATH 中或放入 src-tauri/binaries/）
- **Rust**（Tauri 编译需要）
- **Node.js** 18+

### 首次初始化

```bash
python scripts/setup_dev.py
```

脚本自动完成：检查前置条件 → 安装 Python 依赖 → 下载 FFmpeg → 构建 sidecar → 提示下载 ASR 模型 → npm install。

### 构建 Python Sidecar

源码修改后需重新编译两个 sidecar 可执行文件：

```bash
cd worker
python -m PyInstaller --clean --noconfirm asr_worker.spec
copy dist\asr_worker.exe ..\src-tauri\binaries\asr_worker-x86_64-pc-windows-msvc.exe
python -m PyInstaller --clean --noconfirm bili_worker.spec
copy dist\bili_worker.exe ..\src-tauri\binaries\bili_worker-x86_64-pc-windows-msvc.exe
cd ..
```
### 启动开发

```bash
npx tauri dev
```

### 构建发布

```bash
npx tauri build
```

## 架构

### 处理流水线

```
URL -> 预览缓存(5min TTL)
  -> bili_worker 下载音频(m4a)     <- WBI签名, 并行双端点请求
  -> FFmpeg 转码(16kHz mono WAV)
  -> ASR Daemon 语音识别(HTTP)     <- 模型只加载一次, 常驻进程
  -> LLM 校对文稿                  <- 复用 HTTP Client 连接池
  -> LLM 提炼观点                  <- 同连接池
  -> Markdown 导出
```

### ASR 双引擎

| 引擎 | 方式 | 说明 |
|------|------|------|
| Paraformer(本地) | sherpa-onnx | 离线识别, 模型文件放在 src-tauri/resources/models/paraformer-large/ |
| MiMo-V2.5(API) | HTTP API | 云端识别, 需配置 MiMo API Key |

## 性能优化

针对批量处理场景做了以下优化: 

| 优化项 | 效果 |
|--------|------|
| ASR Daemon 常驻进程 | 模型只加载一次, 后续请求直接 HTTP 调用, 省 2-5s/次 |
| 队列 2 路并行处理 | 同时处理 2 个视频, 吞吐量接近翻倍 |
| HTTP Client 连接池共享 | LLM API 调用复用 TCP/TLS 连接, 省握手开销 |
| B站 API 并行请求 | WBI 和非 WBI 端点同时请求, 耗时减半 |
| 预览缓存 + 手动刷新 | 同一 URL 5 分钟内命中缓存, 无需重启 sidecar |
| 队列耗时显示 | 每个视频处理后显示实际耗时, 方便量化对比 |

## 功能

### 视频来源

- **B站链接**: 粘贴视频 URL, 自动解析分 P, 选择后加入队列
- **B站收藏夹**: 登录 B 站账号(扫码登录), 批量导入收藏视频
- **本地文件**: 选择本地音频/视频文件直接处理

### AI 提炼

- 支持 OpenAI / DeepSeek / 自定义 API
- 内置 3 套提示词模版: 观点提炼、技术文案提炼、信息溯源
- 支持自定义提示词模版

### 导出

- 单视频 / 多 P 合并 Markdown 导出
- 包含视频信息、AI 观点、完整文稿

## 项目结构

```
bili2insight/
├── src/                        # Vue 3 前端
│   ├── App.vue                 # 主布局(设置/队列/登录抽屉)
│   ├── stores/
│   │   ├── app.ts              # 主 Store(队列、流水线、登录、收藏夹)
│   │   └── settings.ts         # 设置常量、类型和持久化工具
│   ├── views/
│   │   ├── HomeView.vue        # 首页入口
│   │   ├── SourceUrlView.vue   # URL 输入和分 P 选择
│   │   ├── SourceFavView.vue   # 收藏夹浏览
│   │   ├── SourceLocalView.vue # 本地文件选择
│   │   ├── QueueView.vue       # 处理队列
│   │   └── ResultView.vue      # 结果展示
│   └── utils/
│       ├── types.ts            # TypeScript 类型定义
│       └── invoke.ts           # Tauri IPC 调用封装
├── src-tauri/                  # Tauri(Rust) 后端
│   ├── src/
│   │   ├── lib.rs              # 入口、数据结构、AppState
│   │   ├── commands.rs         # Tauri commands
│   │   ├── pipeline.rs         # 流水线逻辑(下载/转码/ASR/LLM)
│   │   └── export.rs           # Markdown 生成
│   ├── binaries/               # Python sidecar 可执行文件
│   └── resources/models/       # 本地 ASR 模型
├── worker/                     # Python 源码
│   ├── bili_worker.py          # B 站 API 和音频下载
│   ├── asr_worker.py           # ASR 识别(sherpa-onnx / MiMo API)
│   ├── bili_worker.spec        # PyInstaller 配置
│   └── asr_worker.spec         # PyInstaller 配置
└── package.json
```

## License

MIT
