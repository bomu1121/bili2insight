# Language / 语言

- 项目面向中文用户，所有面向用户的 UI 文本（Vue 模板中的标签、按钮、提示、占位符、状态文本等）必须使用简体中文，不得使用英文。
- 代码注释、变量名、commit message 可以使用中英文，但 UI 文本一律中文。
- 新增功能时，参考已有页面的中文措辞风格，保持一致性。

# Encoding / 编码

- 所有前端源文件（.vue、.ts、.json、.html）必须以 UTF-8 编码保存。
- 编辑文件后，确认文件中的中文字符可正常显示，不得出现乱码（如 Ã¥、æ、ç 等 UTF-8 被误读为 Latin-1 的产物）。
- 如果发现乱码，优先从 git 历史或兄弟分支恢复原始版本，而不是手动修复。

# Editing Constraints / 编辑约束

- 修改已有文件时，保持原有中文文本不变，除非用户明确要求修改文案。
- 从其他分支 cherry-pick 或合并时，注意不要引入英文替换中文或编码损坏。
- 如果任务涉及大量文件修改，完成后扫描所有变更文件的 UI 文本是否正确显示。

# Project Structure / 项目结构

- 前端：Vue 3 + Naive UI + Pinia + vue-router，源码在 src/
- 后端：Tauri (Rust)，源码在 src-tauri/
- Python worker 源码在 bili_worker/
- 分支命名：codex/xxx，主分支：main

# UI 样式规范 / Style Guide

气质：浅色桌面生产力工具 —— 干净、克制，以 B 站蓝点缀；不做营销落地页、不做深色优先、不做炫光主题。

交互与布局要求：
- 首页入口用 2×2 卡片网格，带品牌标识与明确 hover/focus
- 顶栏使用品牌徽标 + 胶囊操作按钮；抽屉/空态需有图标与引导文案
- 列表行、文件夹卡、预览卡需有圆角、轻阴影与 hover 位移反馈
- 结果页按「文档阅读」排版（标题层级、行高、卡片承载），不要干巴巴的纯文本堆叠
- 优先用有语义的 ionicons，避免纯文字箭头/裸圆点当主状态

## 设计令牌

- 全局令牌定义在 `src/styles/tokens.css`，由 `src/main.ts` 引入。
- Naive UI 主题在 `App.vue` 的 `NConfigProvider` + `themeOverrides` 中与令牌对齐。
- **新增或修改样式时必须使用 CSS 变量**（如 `var(--color-brand)`），禁止在页面里新写散落 hex（如 `#00aeec`、`#eee`）。若需新色，先扩展 `tokens.css`，再在 `themeOverrides`（如适用）同步。
- 动态内联色（如 badge）优先写 `var(--color-*)`，不要再写硬编码 hex。

## 色板速查

| Token | 用途 |
|-------|------|
| `--color-brand` | 主色 / 强调 / Markdown strong |
| `--color-bg` | 页面背景 |
| `--color-surface` | 顶栏、卡片、抽屉内容底 |
| `--color-border` | 分割线、卡片边框 |
| `--color-text` / `--color-text-secondary` | 主文 / 次文 |
| `--color-success` / `--color-warning` / `--color-error` / `--color-info` | 语义状态 |

## 圆角与间距

- 圆角：`--radius-sm`（6，控件）/ `--radius-md`（10，卡片）/ `--radius-lg`（12，大入口）
- 间距：`--space-1`…`--space-6`（4px 基准），页面 padding 优先用 space token
- 阴影：默认卡片无重阴影；hover 用 `--shadow-hover` 或 `--shadow-brand-hover`

## 布局约定

- 顶栏高度：`--header-height`（56px）
- 内容最大宽度：首页入口 `--content-max-narrow`；来源页 `--content-max-source`；收藏/队列 `--content-max-wide`；结果 `--content-max-result`
- 页头条（返回 + 标题）：白底 + 底部分割线，与历史/结果/来源页一致
- 抽屉宽度习惯：队列 ~420、登录 ~400、设置 ~440、详情/日志可更宽

## 组件与 Naive

- 优先使用 Naive UI 组件；自定义块用 scoped CSS + token，少写一次性魔法数
- 列表行、入口卡、页头条、主按钮的视觉参数应跨页一致
- UI 文案仍遵循上文「一律简体中文」规则
