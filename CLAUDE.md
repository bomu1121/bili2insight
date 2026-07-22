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

气质：「纸面工作台」—— 浅色、编辑感、精密的桌面生产力工具。纸面灰画布 + 纯白表面 + 发丝边界；墨色（近黑微蓝）承载导航与强标题，B 站蓝只出现在真正的交互信号上（主按钮、链接、进度、选中态）。不做营销落地页、不做深色优先、不做炫光主题。

## 外壳与导航

- 左侧固定侧边栏（`--sidebar-width` 216px）：品牌区（墨色 B2 标 + 名称）、「来源」组（B站链接/收藏夹/本地文件）、「工作台」组（处理队列带徽标与处理中脉冲点、历史记录）、底部用户卡片 + 设置按钮。
- 导航项激活态 = 墨色填充胶囊（`--color-ink` 底 + 白字），这是全应用最强的视觉签名；hover 用 `--color-ink-soft` 底色反馈。
- 队列从侧边栏点开抽屉（全局快速查看），抽屉底部链接进 `/queue` 完整页；`/queue` 与 `/result/*` 路由下队列项保持激活。

## 色彩体系

- 品牌蓝 `--color-brand` #00AEEC：交互信号专用（主操作、链接、进度、选中、运行态），不做大面积铺色。
- 墨色 `--color-ink` #16181D：导航激活、Logo 标、hover 实心箭头；`--color-ink-soft` 是其浅底（hover 反馈、徽章底）。
- 来源色彩映射（图标徽章/身份标识用软底+彩色，不用实心白字）：链接=品牌蓝、收藏=B站粉 `--color-accent-pink` #FB7299、本地=绿 `--color-success`、历史=靛蓝 `--color-accent-indigo` #6366F1。
- 状态表达：列表条目（队列/历史）用「左侧 3px 状态条 + 软色徽章」，禁止整卡染色。

## 设计令牌

- 全局令牌定义在 `src/styles/tokens.css`，由 `src/main.ts` 引入。
- Naive UI 主题在 `App.vue` 的 `NConfigProvider` + `themeOverrides` 中与令牌对齐。
- **新增或修改样式时必须使用 CSS 变量**（如 `var(--color-brand)`），禁止在页面里新写散落 hex。若需新色，先扩展 `tokens.css`，再在 `themeOverrides`（如适用）同步。
- 数字类信息（时长、计数、耗时、页码）加 `.tnum` 类（tabular-nums）保证纵向对齐。

## 色板速查

| Token | 用途 |
|-------|------|
| `--color-brand` / `--color-brand-soft` / `--color-brand-border` | 交互信号 / 软底 / 软边 |
| `--color-ink` / `--color-ink-soft` | 导航激活、强标题 / hover 底 |
| `--color-bg` / `--color-surface` / `--color-surface-muted` | 画布 / 卡片与页条 / 浅底 |
| `--color-border` / `--color-border-strong` | 发丝边界 / 加强边界 |
| `--color-text` / `--color-text-secondary` / `--color-text-tertiary` | 三级文字 |
| `--color-accent-pink` / `--color-accent-indigo`（+ 各自 soft/border） | 收藏 / 历史 身份色 |
| `--color-success` / `--color-warning` / `--color-error` / `--color-info`（+ 各自 soft/border） | 语义状态 |

## 质感约定

- 圆角：控件 `--radius-sm` 6 / 徽章与缩略图 `--radius-md` 8 / 卡片 `--radius-lg` 12 / 纸张与大投放区 `--radius-xl` 14。
- 阴影以发丝边界为主：卡片默认 `--shadow-xs`，hover `--shadow-card`，浮层 `--shadow-hover`，禁止重投影。
- 反馈：hover 优先用底色/边界变化，位移最多 -2px 并配 `--ease-out`；时长用 `--dur-1/2/3`。
- 图标徽章 `.bar-ic`（26px 圆角 7px 软底彩标）用于页头条标题与区块标题，是跨页统一的识别件。

## 布局约定

- 页头条（返回 + 图标徽章 + 标题 + 右侧操作）：白底 + 底部发丝线，高 `--header-height`（52px），来源页/历史/结果一致。
- 内容最大宽度：首页 `--content-max-home`；来源页 `--content-max-source`；收藏/队列/历史 `--content-max-wide`；结果页 `--content-max-result`。
- 结果页 = 灰画布上的「一张笔记纸」：白底 1px 边 + `--radius-xl` + `--shadow-card`；kicker 胶囊（品牌软底）+ 25px/750 标题；正文 15px、`--line-height-loose`；`strong` 用 `--color-brand-pressed` 加粗；`h2` 左侧 3px 蓝色竖条；链接/路径用 `--font-mono`。
- 首页 = 左对齐品牌区（kicker 胶囊 + 32px 标题 + 副文案）+ 2×2 入口卡（软底彩标 + hover 墨色箭头）+ 底部流水线图示。
- 抽屉宽度习惯：队列 ~420、登录 ~400、设置 ~460、详情/日志可更宽。

## 组件与 Naive

- 优先使用 Naive UI 组件；自定义块用 scoped CSS + token，少写一次性魔法数
- 列表行、入口卡、页头条、主按钮的视觉参数应跨页一致
- UI 文案仍遵循上文「一律简体中文」规则
