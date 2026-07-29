
<!--
  PROJECT.md — 静态项目参考
  每次任务结束后，这里的核心信息（架构、文件、基线）应保持稳定。
  进度/状态追踪由 agent 内部或 TRACKING.md 独立维护。
  最后更新: 2026-07-29
-->

# bili2insight 项目参考

Tauri + Vue 3 + Naive UI 桌面应用，B站视频分析/下载工具。
暗色主题（Steins;Gate 风格），设计令牌覆盖 dark + light 双主题。

## 项目骨架

- 前端: `src/` (Vue 3 + Naive UI + Pinia + vue-router)
- 后端: `src-tauri/` (Rust, Tauri)
- Python worker: `bili_worker/` (bili_worker.py, 由 Tauri sidecar 调用)
- 设计令牌: `src/styles/tokens.css`
- 分支命名: `codex/xxx`，主分支: `main`

## 代码规范

- UI 文本一律简体中文。代码注释、变量名、commit message 可用中英文。
- 所有源文件 UTF-8 编码。禁止散落 hex 色值，必须用 CSS 变量。
- 新增/修改样式先扩展 `tokens.css`，再同步 `themeOverrides`（App.vue NConfigProvider）。
- 数字类信息加 `.tnum`（tabular-nums）。
- 修改已有文件时保持原中文文案不变。

## 设计令牌速查

| Token | 用途 |
|-------|------|
| `--color-brand` / `--color-brand-soft` / `--color-brand-border` | 交互信号 / 软底 / 软边 |
| `--color-ink` / `--color-ink-soft` | 导航激活、强标题 / hover 底 |
| `--color-bg` / `--color-surface` / `--color-surface-muted` | 画布 / 卡片与页条 / 浅底 |
| `--color-border` / `--color-border-strong` | 发丝边界 / 加强边界 |
| `--color-text` / `--color-text-secondary` / `--color-text-tertiary` | 三级文字 |
| `--color-accent-pink` / `--color-accent-indigo`（+ soft/border） | 收藏 / 历史 身份色 |
| `--color-success` / `--color-warning` / `--color-error` / `--color-info`（+ soft/border） | 语义状态 |
| `--radius-sm`(6) / `--radius-md`(8) / `--radius-lg`(12) / `--radius-xl`(14) | 圆角阶梯 |
| `--shadow-xs` / `--shadow-card` / `--shadow-hover` | 阴影阶梯 |
| `--dur-1` / `--dur-2` / `--dur-3` | 动画时长 |

### 来源色彩映射

| 来源 | 令牌 | 色值 |
|------|------|------|
| 链接 (url) | `--color-brand` | #00AEEC |
| 收藏 (fav) | `--color-accent-pink` | #FB7299 |
| 本地 (local) | `--color-success` | — |
| 历史 (history) | `--color-accent-indigo` | #6366F1 |

## 视图文件地图

| 文件 | 路由 | 角色 | 当前设计状态 |
|------|------|------|------------|
| `src/views/HomeView.vue` | `/` | 入口首页 | Direction A: 全屏 Hero (100vh) + 世界线网格 + 玻璃拟态 + flow footer |
| `src/views/SourceUrlView.vue` | `/source/url` | B站链接输入 | Direction 3: 命令面板式浮窗 + 分P选择器原始行布局 |
| `src/views/SourceFavView.vue` | `/source/fav` | 收藏夹选择 | 原始 |
| `src/views/SourceLocalView.vue` | `/source/local` | 本地文件 | 原始 |
| `src/views/QueueView.vue` | `/queue` | 处理队列 | 原始 |
| `src/views/HistoryView.vue` | `/history` | 历史记录 | 原始（含 jsonl 存储、star/pin 功能） |
| `src/views/ResultView.vue` | `/result/:id` | 分析结果 | 原始 |

## Git 回滚基线

| 基线 | Commit | 说明 |
|------|--------|------|
| HomeView Phase 1+2 完成 | `39edad2` | HomeView 的 Direction A 生效前状态 |
| SourceUrlView Direction 3 | `0f10481` | SourceUrlView 的 Direction 3 生效前状态 |

## 参考截图

位置: `docs/style-iter/home/`（11 张）

| 文件 | 来源 |
|------|------|
| `ref-linear.png`, `ref-linear-app.png` | Linear |
| `ref-refine.png`, `ref-refine-repo.png` | Refine |
| `ref-plane-repo.png` | Plane |
| `ref-nocodb-site.png`, `ref-nocodb-repo.png` | NocoDB |
| `ref-raycast.png` | Raycast |
| `ref-gh-actions.png`, `ref-gh-dashboard.png`, `ref-github-search.png` | GitHub |
| `before-dark.png`, `after-dark.png` | 迭代前后对比 |

## 关键经验

### 通用

- Windows PowerShell 下 apply_patch 可能因编码/换行差异失败 — 大改动优先用 Python 全量写文件
- PowerShell `Set-Content -Encoding UTF8` 会加 BOM — 注意规避
- CSS :hover > JS mouseEnter/mouseLeave（Next.js <Link> unmount 问题，本项目是 Vue 但同样优先 CSS）

### 视觉修复

- 不要为了删一行有问题的 CSS 删掉整个 CSS 块 — 修复根因
- 不要用 `transform: scale()` 做 SVG 图标 hover — 会像素化；用 `filter: drop-shadow()` 或 opacity/color
- 暗色背景上避免纯白文字 hover 高亮 — 用 `text-shadow`、`border-color`、glow
- 所有交互卡片必须有可见 hover 反馈（每种卡片类型用不同颜色区分）
- 追踪视觉 artifact 到全局 CSS root 规则，不只是局部模块样式
- 全局 CSS 变更（body/html）必须验证所有全视口元素

### 设计迭代 (style-iterator)

- 参考调研是核心 — 不能凭想象设计，必须找真实优秀项目/产品
- Step 0.5 结构审计: 质疑通用模式（嵌套滚动、固定高度），但不让审计限制方案方向
- 激进方案不能是同一结构的三种视觉变体 — 必须改变容器/交互范式
- 激进方案需要用户审批 — 安全闸
- 参考来源优先级: P0 高星 GitHub repos (>5k) / 已发布产品 UI > P1 设计系统 > P2 设计文章 > P3 视觉灵感

### 相关技能位置

| 技能 | 路径 |
|------|------|
| style-iterator | `C:\Users\Admin（无密码）\.codex\skills\style-iterator\SKILL.md` |

