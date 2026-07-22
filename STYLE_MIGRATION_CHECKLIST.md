# bili2insight 样式迁移清单 (STYLE_MIGRATION_CHECKLIST)

> 生成日期: 2026-07-23
> 迁移方案: Naive UI v2.41 → PrimeVue v4 (Aura 主题) + primeicons
> 品牌色: #00AEEC → Aura 自定义 primary palette

---

## 迁移文件总览

**总计**: 13 个文件 (8 个视图 + 4 个 store + 1 个全局样式)
**无 `src/components/` 目录** — 项目所有组件均为视图级别, 无需额外扫描。

---

| # | 文件路径 | 涉及的 Naive UI 组件 / 样式 | 迁移状态 |
|---|---|---|---|
| — | **全局基础设施** | | |
| 1 | `src/main.ts` | 无 Naive UI (仅 createApp + Pinia + Router) | ⬜ 待修改 (新增 PrimeVue + Aura 主题注册 + primeicons.css) |
| 2 | `src/styles/tokens.css` | 自研 Design Token (纯 CSS 变量, 无 Naive UI import) | ⬜ 待修改 (保留品牌 token, 无 Naive 变量可删) |
| 3 | `package.json` | `naive-ui`, `@vicons/ionicons5` 依赖 | ⬜ 待修改 (卸载旧依赖, 安装 primevue + @primevue/themes + primeicons) |
| 4 | `index.html` | 无修改 | ✅ 无需修改 |
| 5 | `vite.config.ts` | 无修改 | ✅ 无需修改 |
| — | **视图文件** | | |
| 6 | `src/App.vue` | n-config-provider, n-drawer, n-drawer-content, n-button, n-icon, n-input, n-select, n-tabs, n-tab-pane, n-space, n-text, createDiscreteApi(["message"]) | ⬜ 待迁移 |
| 7 | `src/views/HomeView.vue` | n-icon, createDiscreteApi(["message"]) | ⬜ 待迁移 |
| 8 | `src/views/SourceUrlView.vue` | n-input, n-button, n-text, n-icon, n-checkbox, n-spin, createDiscreteApi(["message"]) | ⬜ 待迁移 |
| 9 | `src/views/SourceFavView.vue` | n-button, n-text, n-icon, n-checkbox, n-spin, n-pagination, n-input, n-tabs, n-tab-pane, createDiscreteApi(["message"]) | ⬜ 待迁移 |
| 10 | `src/views/SourceLocalView.vue` | n-button, n-text, n-icon, createDiscreteApi(["message"]) | ⬜ 待迁移 |
| 11 | `src/views/QueueView.vue` | n-button, n-text, n-icon, n-space, n-select | ⬜ 待迁移 |
| 12 | `src/views/HistoryView.vue` | n-button, n-text, n-icon, n-input, n-pagination, n-drawer, n-drawer-content, n-space, n-divider, n-popconfirm, createDiscreteApi(["message"]) | ⬜ 待迁移 |
| 13 | `src/views/ResultView.vue` | n-button, n-text, n-icon, n-divider, n-drawer, n-drawer-content, createDiscreteApi(["message"]) | ⬜ 待迁移 |
| — | **Store 文件** | | |
| 14 | `src/stores/app.ts` | 无 Naive UI import (纯 Pinia + Tauri invoke) | ✅ 无需修改 (0 处 Naive UI API 调用) |
| 15 | `src/stores/auth.ts` | 无 Naive UI import (纯 Pinia + Tauri invoke) | ✅ 无需修改 (0 处 Naive UI API 调用) |
| 16 | `src/stores/settings.ts` | 无 Naive UI import (纯 localStorage 持久化) | ✅ 无需修改 (0 处 Naive UI API 调用) |
| 17 | `src/stores/templates.ts` | 无 Naive UI import (纯 Pinia + localStorage) | ✅ 无需修改 (0 处 Naive UI API 调用) |
| — | **工具文件** | | |
| 18 | `src/utils/invoke.ts` | 无 Naive UI (纯 Tauri invoke wrappers) | ✅ 无需修改 |
| 19 | `src/utils/types.ts` | 无 Naive UI (纯 TypeScript 接口) | ✅ 无需修改 |
| 20 | `src/utils/markdown.ts` | 无 Naive UI (纯 marked + DOMPurify) | ✅ 无需修改 |
| 21 | `src/utils/errors.ts` | 无 Naive UI | ✅ 无需修改 |
| 22 | `src/router.ts` | 无 Naive UI (纯 Vue Router 配置) | ✅ 无需修改 |

---

## 组件使用统计

| Naive UI 组件 | 使用视图数 | 被替换为 |
|---|---|---|
| `n-button` | 7 (App + 6 Views) | PrimeVue `Button` |
| `n-icon` | 8 (All views) | primeicons `<i class="pi pi-xxx">` |
| `n-text` | 7 (App + 6 Views) | 纯 `<span>` + Aura CSS tokens |
| `n-input` | 3 (App, SourceUrl, SourceFav, History) | PrimeVue `InputText` / `Textarea` / `Password` |
| `n-select` | 2 (App, QueueView) | PrimeVue `Select` |
| `n-drawer` / `n-drawer-content` | 3 (App, History, Result) | PrimeVue `Drawer` |
| `n-checkbox` | 2 (SourceUrl, SourceFav) | PrimeVue `Checkbox` |
| `n-spin` | 2 (SourceUrl, SourceFav) | PrimeVue `ProgressSpinner` (条件渲染) |
| `n-pagination` | 2 (SourceFav, HistoryView) | PrimeVue `Paginator` |
| `n-tabs` / `n-tab-pane` | 2 (App, SourceFav) | PrimeVue `Tabs` + `TabPanels` + `TabPanel` |
| `n-space` | 2 (QueueView, HistoryView) | `<div>` + Tailwind flex gap |
| `n-divider` | 2 (HistoryView, ResultView) | PrimeVue `Divider` |
| `n-tag` | 3 (SourceUrl, QueueView, HistoryView) | PrimeVue `Tag` |
| `n-progress` | 1 (QueueView — 进度条, 实际是手动 bar) | 自定义 `<div>` 进度条 (保留) |
| `n-popconfirm` | 1 (HistoryView) | 直接调用 `toast.add()` |
| `n-config-provider` | 1 (App.vue) | PrimeVue 全局插件注册 (main.ts) |
| `createDiscreteApi(["message"])` | 7 (All except QueueView) | `useToast()` |

---

## 迁移执行顺序

按以下顺序逐文件替换, 每完成一个立即打勾:

### 阶段 3 — 全局基础设施

1. ⬜ 3.1 安装/卸载依赖 (`npm uninstall naive-ui @vicons/ionicons5 && npm install primevue @primevue/themes primeicons`)
2. ⬜ 3.2 配置 `src/main.ts` (注册 PrimeVue + Aura 预设 + primeicons.css)
3. ⬜ 3.3 重写 `src/styles/tokens.css` (移除 Naive UI 变量, 保留品牌 token)
4. ⬜ 3.4 运行 `npm run build` 验证零报错

### 阶段 4 — 逐视图替换

5. ⬜ 4.1 `src/App.vue` — 最大更改 (n-config-provider, n-drawer, n-tabs, n-select, n-input 等全部替换 + Toast)
6. ⬜ 4.2 `src/views/HomeView.vue` — n-icon, createDiscreteApi
7. ⬜ 4.3 `src/views/SourceUrlView.vue` — n-input, n-button, n-checkbox, n-spin, n-text, n-icon, createDiscreteApi
8. ⬜ 4.4 `src/views/SourceFavView.vue` — 最多组件 (n-tabs, n-checkbox, n-pagination, n-spin, n-button, n-input, n-text, n-icon, createDiscreteApi)
9. ⬜ 4.5 `src/views/SourceLocalView.vue` — n-button, n-text, n-icon, createDiscreteApi (最简单)
10. ⬜ 4.6 `src/views/QueueView.vue` — n-button, n-select, n-text, n-icon, n-space (无 createDiscreteApi)
11. ⬜ 4.7 `src/views/HistoryView.vue` — n-drawer, n-pagination, n-popconfirm, n-divider, n-button, n-input, n-text, n-icon, n-space, createDiscreteApi
12. ⬜ 4.8 `src/views/ResultView.vue` — n-drawer, n-divider, n-button, n-text, n-icon, createDiscreteApi (marked + DOMPurify 不动)

### 阶段 5 — Store 清理

13. ⬜ 5.1 检查 `src/stores/app.ts` — 确认无 Naive UI API (已确认 0 处)
14. ⬜ 5.2 检查 `src/stores/auth.ts` — 确认无 Naive UI API (已确认 0 处)
15. ⬜ 5.3 检查 `src/stores/settings.ts` — 确认无 Naive UI API (已确认 0 处)
16. ⬜ 5.4 检查 `src/stores/templates.ts` — 确认无 Naive UI API (已确认 0 处)

### 阶段 6 — 收尾清理

17. ⬜ 6.1 全局搜索 `<n-[a-z]` 正则: 必须为 0
18. ⬜ 6.2 全局搜索 `naive-ui`: 必须为 0
19. ⬜ 6.3 全局搜索 `@vicons/ionicons5`: 必须为 0
20. ⬜ 6.4 全局搜索 `useMessage` / `useDialog` / `useNotification` / `createDiscreteApi`: 必须为 0
21. ⬜ 6.5 `npm run build` 通过
22. ⬜ 6.6 `npm run dev` 启动, 检查 7 个页面无白屏/报错

---

## 特殊红线 (不可修改)

| 区域 | 说明 |
|---|---|
| Tauri 插件 `invoke()` 调用 | `@tauri-apps/api/core`, `@tauri-apps/plugin-clipboard-manager`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-shell` 等所有 invoke 调用完全保留 |
| ONNX / Paraformer | ASR 语音识别逻辑 (`asrModel`, `runPipelineWithPage`, `runPipelineLocal`) 全部不动 |
| Pinia 业务逻辑 | 4 个 store 的所有 state / getter / action 完全保留 |
| `marked` + `DOMPurify` | `renderMarkdown()` 函数及所有调用完全不动 |
| `ref()` / `computed()` / `watch()` / `onMounted()` | 所有响应式/生命周期逻辑原样保留 |
| `useRouter()` | 路由跳转逻辑完全不动 |
| 1200×800 布局约束 | 确保 QueueView 队列列表和 ResultView Markdown 渲染区在目标窗口尺寸下不溢出 |

---

*清单覆盖率: 22/22 文件 (100%) — 项目无 `src/components/` 目录, 所有 .vue 文件已完全覆盖。*