<!--
  Style Mapping Table — Naive UI → PrimeVue v4 (Aura Theme / Styled Mode)
  Generated: 2026-07-23
  Project: bili2insight
  Context: Vue 3 + Composition API + TypeScript + Vite 6 + Tauri v2
  Brand color: #00AEEC → Aura primary palette custom preset
-->

# Naive UI → PrimeVue v4 完整映射表

## 1. 核心组件映射 (Component Tag Mapping)

> **约定**
> - 左列 = Naive UI 组件实际标签
> - 中列 = PrimeVue v4 Styled Mode (Aura 主题)
> - 右列 = Volt (Tailwind CSS v4 UI kit, 可选)
> - 项目中不使用 Volt copy-paste 模式; 统一使用 Styled Mode 配合全局 Aura 主题预设。

| Naive UI 组件 | PrimeVue v4 等价 (Styled Mode) | Volt 等价 (Tailwind) | Props 迁移要点 |
|---|---|---|---|
| `<n-config-provider>` | `<PrimeVue>` 全局插件注册 (main.ts) + `definePreset(Aura, {...})` | 同左 | 品牌色 #00AEEC → Aura primary 50-900 色阶预设; 移除旧的 `<n-config-provider :theme-overrides>` |
| `<n-message-provider>` | `<Toast />` 全局组件 + `useToast()` | 同左 | 不再有 provider/wrapper, 直接在 App.vue 模板上加 `<Toast />`, 任意位置通过 `useToast().add(...)` 调用 |
| `<n-dialog-provider>` | `<Dialog>` (声明式) + `v-model:visible` 响应式变量 | 同左 | 不再有动态 `create()` API; 改为在模板中声明 `<Dialog>`, 由响应式变量控制显隐 |
| `<n-notification-provider>` | `<Toast />` (同 message-provider) | 同左 | Toast 统一承载 message + notification |
| `<n-button>` | `<Button>` | `<Button>` | `type="primary"` → `severity="primary"`; `size="large"` → `size="large"`; `text` → `text`; `quaternary` → `text`; `round` → `rounded`; `block` → `fluid`; `circle` → `rounded`; `secondary` → `outlined` |
| `<n-input>` | `<InputText>` / `<Textarea>` | `<InputText>` / `<Textarea>` | `v-model:value` → `v-model`; `clearable` → `:showClear="true"` (v4.3+); `type="password"` → `<Password>` 组件; `type="textarea"` → `<Textarea>`; `round` → Tailwind `rounded-full`; `placeholder` → 同名属性; `disabled` → `:disabled` |
| `<n-card>` | `<Card>` | `<Card>` | `title` → Card 需通过 `#title` slot 或 header 文本注入; `bordered` → `pt` 控制; `size` → 无直接映射, 用 Tailwind class |
| `<n-checkbox>` | `<Checkbox>` | `<Checkbox>` | `v-model:checked` → `v-model` (binding boolean); `size="small"` → `:size="'small'"` |
| `<n-checkbox-group>` | 手动 `<div>` + v-for `<Checkbox>` | 同左 | Naive UI `n-checkbox-group` 的 v-model 接收 Set; PrimeVue 需手动管理 `v-model` 为数组 |
| `<n-select>` | `<Select>` | `<Select>` | `v-model:value` → `v-model`; `:options="{label,value}[]"` → 直接用 `:options` + `optionLabel`/`optionValue` 或默认 `label`/`value` 字段; `size="tiny"` → `size="small"` 或 Tailwind class; `:consistent-menu-width="false"` → `:autoOptionFocus="false"` 配合宽度 |
| `<n-tag>` | `<Tag>` | `<Tag>` | `type="info"` → `severity="info"`; `type="success"` → `severity="success"`; `type="warning"` → `severity="warn"`; `type="error"` → `severity="danger"` |
| `<n-spin>` | 自定义 `<div>` + `v-if="loading"` + `<ProgressSpinner />` 叠加层 | 同左 | Naive `n-spin :show` 包裹任意内容; PrimeVue 需手动用 v-if 条件渲染 spinner 覆盖, 或用 CSS absolute 定位 |
| `<n-modal>` | `<Dialog>` + `v-model:visible` | `<Dialog>` | `v-model:show` → `v-model:visible`; title → `header` prop 或 `#header` slot; `closable` → `:closable="true"` |
| `<n-progress>` | `<ProgressBar>` | `<ProgressBar>` | `:percentage` → `:value` (0-100); `type="line"` → 默认行为; `status="success"` → `:showValue="false"` + CSS |
| `<n-tabs>` / `<n-tab-pane>` | `<Tabs>` + `<TabPanels>` + `<TabPanel>` (v4) | 同左 | `v-model:value` → `v-model:value` (string tab name); `type="line"` → 默认样式; `size="medium"` → 默认; `animated` → Aura 内置动画 |
| `<n-image>` | `<Image>` | `<Image>` | `src` → `src`; `preview` → `preview` prop; `width`/`height` → 原生或 CSS |
| `<n-upload>` | `<FileUpload>` (v4) | `<FileUpload>` | 项目中仅 SourceLocalView 使用 Tauri `dialog.open()`, 不依赖 `n-upload` 组件 (实际未使用) |
| `<n-drawer>` / `<n-drawer-content>` | `<Drawer>` | `<Drawer>` (v4.3+) | `v-model:show` → `v-model:visible`; `width="420"` → `style="width:420px"` 或 `pt`; `placement="right"` → `position="right"`; title → `header` prop 或 `#header` slot; `closable` → `:dismissable="true"` (默认) |
| `<n-pagination>` | `<Paginator>` | `<Paginator>` | `:page` → `v-model:first` (offset-based, `first = (page-1)*rows`); `:page-count` → `:totalRecords` + `:rows`; `size="small"` → 默认 |
| `<n-empty>` | 自定义 `EmptyState` 组件 (无内置等价) | 自定义 | PrimeVue 无内置 Empty; 用 `<div>` + `<i class="pi">` + 文案重建; 统一提取到 `src/components/EmptyState.vue` |
| `<n-popconfirm>` | `<Popover>` 手动组合 | 同左 | 详见下方 #8 特殊处理 |
| `<n-grid>` / `<n-gi>` | Tailwind `grid grid-cols-{n} gap-{x}` | 同左 | `cols="4"` → `class="grid grid-cols-4 gap-4"`; `x-gap` → `gap-x-{n}`; `y-gap` → `gap-y-{n}` |
| `<n-icon>` | `<i class="pi pi-{name}">` (primeicons) | 同左 | 详见下方 #4 图标映射表 |
| `<n-text>` | 纯 `<span>` 或 `<p>` + Tailwind class | 同左 | `depth="3"` → `class="text-secondary"` (Aura token: `text-muted-color`); `strong` → `font-bold`; `type="error"` → `text-red-500` |
| `<n-space>` | `<div>` + Tailwind `flex gap-{n}` | 同左 | `:size="8"` → `class="flex gap-2"`; `:size="12"` → `gap-3`; `vertical` → `flex-col` |
| `<n-divider>` | `<Divider>` | `<Divider>` | `v4` PrimeVue `Divider` component; `layout="horizontal"` → 默认 |
| `<n-gradient-text>` | `<span>` + `bg-gradient-to-r from-[#00AEEC] to-[#0088c9] bg-clip-text text-transparent` | 同左 | 项目中当前未使用, 备用映射 |

## 2. Naive UI 组件在项目中的实际使用统计

| Naive UI 组件 | App.vue | HomeView | SourceUrl | SourceFav | SourceLocal | QueueView | HistoryView | ResultView |
|---|---|---|---|---|---|---|---|---|
| `n-config-provider` | ✅ | | | | | | | |
| `n-message-provider` | 隐式(createDiscreteApi) | ✅ | ✅ | ✅ | ✅ | | ✅ | ✅ |
| `n-dialog-provider` | N/A | | | | | | | |
| `n-notification-provider` | N/A | | | | | | | |
| `n-button` | ✅ | | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `n-icon` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `n-input` | ✅ | | ✅ | ✅ | | | ✅ | |
| `n-select` | ✅ | | | | | ✅ | | |
| `n-tabs` / `n-tab-pane` | ✅ | | | ✅ | | | | |
| `n-text` | ✅ | | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `n-space` | | | | | | ✅ | ✅ | |
| `n-drawer` / `n-drawer-content` | ✅ | | | | | | ✅ | ✅ |
| `n-checkbox` | | | ✅ | ✅ | | | | |
| `n-spin` | | | ✅ | ✅ | | | | |
| `n-pagination` | | | | ✅ | | | ✅ | |
| `n-tag` | | | ✅ | | | ✅ | ✅ | |
| `n-progress` | | | | | | ✅ | | |
| `n-modal` | | | | | | | | |
| `n-popconfirm` | | | | | | | ✅ | |
| `n-image` | | | | | | | | |
| `n-upload` | | | | | ✅ (实际用 Tauri dialog) | | | |
| `n-grid` / `n-gi` | 未直接使用 | | | | | | | |
| `n-divider` | | | | | | | ✅ | ✅ |
| `n-checkbox-group` | 未直接使用 | | | | | | | |

## 3. 命令式 API 映射

| Naive UI API | PrimeVue v4 等价 | 代码示例 |
|---|---|---|
| `createDiscreteApi(["message"])` | `import { useToast } from 'primevue/usetoast'` | 在 `setup()` 中: `const toast = useToast()` |
| `message.success(msg)` | `toast.add({ severity: 'success', summary: '成功', detail: msg, life: 3000 })` | — |
| `message.error(msg)` | `toast.add({ severity: 'error', summary: '错误', detail: msg, life: 5000 })` | — |
| `message.warning(msg)` | `toast.add({ severity: 'warn', summary: '注意', detail: msg, life: 4000 })` | — |
| `message.info(msg)` | `toast.add({ severity: 'info', summary: '提示', detail: msg, life: 3000 })` | — |
| `useDialog().create({...})` (未使用) | 声明式 `<Dialog v-model:visible="showDialog">` + 响应式 ref | — |
| `useNotification()` (未使用) | `useToast()` (同上) | — |

> **注意**: 项目中 `createDiscreteApi(["message"])` 出现在以下位置:
> - `App.vue`: `const { message } = createDiscreteApi(["message"])`
> - `HomeView.vue`: `const { message } = createDiscreteApi(["message"])`
> - `SourceUrlView.vue`: `const { message } = createDiscreteApi(["message"])`
> - `SourceFavView.vue`: `const { message } = createDiscreteApi(["message"])`
> - `SourceLocalView.vue`: `const { message } = createDiscreteApi(["message"])`
> - `HistoryView.vue`: `const { message } = createDiscreteApi(["message"])`
> - `ResultView.vue`: `const { message } = createDiscreteApi(["message"])`
> - **QueueView.vue 未使用 createDiscreteApi** (无 message 调用)
>
> 所有 7 处全部替换为 `const toast = useToast()`。

## 4. 图标映射表 (ionicons5 → primeicons)

> **规则**
> - 优先使用 primeicons 等价图标
> - 无等价的保留 ionicons5, 单独从 `@vicons/ionicons5` 按需引入 (不删除该包, 仅在无等价时保留)
> - primeicons 类名格式: `pi pi-{name}` (v7 风格)

| ionicons5 图标名 | primeicons 等价 | 类名 | 备注 |
|---|---|---|---|
| `HomeOutline` | home | `pi pi-home` | |
| `SettingsSharp` → `SettingsOutline` | cog | `pi pi-cog` | ionicons5 无直接 SettingsOutline; SettingsSharp 与 cog 语义最接近 |
| `ListOutline` | list | `pi pi-list` | |
| `PlayOutline` | play | `pi pi-play` | |
| `TrashOutline` | trash | `pi pi-trash` | |
| `EyeOutline` | eye | `pi pi-eye` | |
| `CheckmarkCircle` | check-circle | `pi pi-check-circle` | |
| `CloseCircle` | times-circle | `pi pi-times-circle` | |
| `SyncOutline` | sync | `pi pi-sync` | 需保留 `.spinning` 动画 class |
| `PersonCircleOutline` | user | `pi pi-user` | |
| `LogOutOutline` | sign-out | `pi pi-sign-out` | |
| `RefreshOutline` | refresh | `pi pi-refresh` | |
| `PhonePortraitOutline` | mobile | `pi pi-mobile` | |
| `QrCodeOutline` | qrcode | `pi pi-qrcode` | |
| `ArrowForward` | arrow-right | `pi pi-arrow-right` | |
| `CopyOutline` | copy | `pi pi-copy` | |
| `LinkOutline` | link | `pi pi-link` | |
| `FolderOpenOutline` | folder-open | `pi pi-folder-open` | |
| `CloudUploadOutline` | cloud-upload | `pi pi-cloud-upload` | |
| `TimeOutline` | clock | `pi pi-clock` | |
| `ChevronForwardOutline` | chevron-right | `pi pi-chevron-right` | |
| `AddCircleOutline` | plus-circle | `pi pi-plus-circle` | |
| `ArrowBackOutline` | arrow-left | `pi pi-arrow-left` | |
| `PersonOutline` | user | `pi pi-user` | (注意与 PersonCircleOutline 合并) |
| `BookmarkOutline` | bookmark | `pi pi-bookmark` | |
| `LogInOutline` | sign-in | `pi pi-sign-in` | |
| `DocumentOutline` | file | `pi pi-file` | |
| `CloseOutline` | times | `pi pi-times` | |
| `StopCircleOutline` | stop-circle | `pi pi-stop-circle` | |
| `SearchOutline` | search | `pi pi-search` | |
| `DownloadOutline` | download | `pi pi-download` | |
| `DocumentTextOutline` | file-edit | `pi pi-file-edit` | 或 `pi pi-file` |
| `CloudUploadOutline` | cloud-upload | `pi pi-cloud-upload` | (SourceLocalView 复用) |

> **无等价图标的 ionicons5 图标**: 全部有 primeicons 等价, 无需保留个别 ionicons5 图标。

## 5. Props 详细迁移对照

### 5.1 `<n-button>` → `<Button>`

| Naive UI prop | PrimeVue v4 prop | 值转换 |
|---|---|---|
| `type="primary"` | `severity="primary"` | primary / success / info / warn / danger / help → 对应 severity |
| `type="error"` | `severity="danger"` | |
| `type="warning"` | `severity="warn"` | |
| `type="success"` | `severity="success"` | |
| `type="info"` | `severity="info"` | |
| `type="default"` | (不设 severity) | |
| `text` | `text` | 相同布尔属性 |
| `quaternary` | `text` | 最弱视觉 = PrimeVue text |
| `secondary` | `outlined` | |
| `round` | `rounded` | PrimeVue v4 有内置 `rounded` prop |
| `circle` | `rounded` | |
| `block` | `fluid` | |
| `size="large"` | `size="large"` | |
| `size="small"` | `size="small"` | |
| `size="tiny"` | `size="small"` | PrimeVue 无 tiny, 最小为 small |
| `loading` | `loading` | 相同 |
| `disabled` | `:disabled` | 相同 |
| `ghost` | `text` | |

### 5.2 `<n-input>` → `<InputText>` / `<Textarea>` / `<Password>`

| Naive UI prop | PrimeVue v4 prop | 值转换 |
|---|---|---|
| `v-model:value` | `v-model` | 单向绑定 |
| `placeholder` | `placeholder` | 相同 |
| `clearable` | `showClear` (v4.3+) 或 `v-model` + 手动 clear icon | |
| `round` | 无内置, 用 Tailwind `rounded-full` | 或 `pt` pass-through |
| `size="large"` | `size="large"` (v4) | |
| `size="small"` | `size="small"` (v4) | |
| `type="password"` | `<Password>` 组件 (v4) | `v-model` 替代 `v-model:value` |
| `type="textarea"` | `<Textarea>` 组件 (v4) | `:rows="6"` → `rows="6"` |
| `show-password-on="click"` | `<Password :toggleMask="true">` | |
| `disabled` | `:disabled` | 相同 |

### 5.3 `<n-select>` → `<Select>`

| Naive UI prop | PrimeVue v4 prop | 值转换 |
|---|---|---|
| `v-model:value` | `v-model` | |
| `:options` | `:options` | Naive 格式 `{label,value}` → PrimeVue 格式相同 |
| `size="tiny"` | 默认 + Tailwind class | `:pt="{root:'text-xs'}"` |
| `size="small"` | `size="small"` (v4) | |
| `:consistent-menu-width="false"` | 无直接等价, 用 `:autoOptionFocus="false"` + CSS 控制 overlay 宽度 | |
| `placeholder` | `placeholder` | 相同 |

### 5.4 `<n-tabs>` / `<n-tab-pane>` → `<Tabs>` / `<TabPanels>` / `<TabPanel>`

| Naive UI prop | PrimeVue v4 prop | 值转换 |
|---|---|---|
| `v-model:value` | `v-model:value` | 绑定 tab name (string) |
| `type="line"` | 默认样式 | Aura 主题默认即为 line 风格 |
| `size="medium"` | 默认 | |
| `size="small"` | 默认 + Tailwind `text-sm` | |
| `animated` | 内置过渡动画 | Aura 默认有动画 |
| `n-tab-pane name="xxx" tab="标签名"` | `<TabPanel value="xxx">` + `<TabList>` 中 `<Tab value="xxx">标签名</Tab>` | PrimeVue v4 使用 `Tabs` + `TabList` + `Tab` + `TabPanels` + `TabPanel` 结构 |

### 5.5 `<n-checkbox>` → `<Checkbox>`

| Naive UI prop | PrimeVue v4 prop | 值转换 |
|---|---|---|
| `v-model:checked` | `v-model` | 绑定 boolean |
| `:checked` | `v-model` 或 `:modelValue` | 单向控制 |
| `size="small"` | 默认 | 用 Tailwind 或 pt 调整大小 |

### 5.6 `<n-spin>` → 自定义加载层

| Naive UI 用法 | PrimeVue v4 等价 |
|---|---|
| `<n-spin :show="loading"><div>内容</div></n-spin>` | `<div class="relative"><div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-white/80 z-10"><ProgressSpinner /></div><div>内容</div></div>` |

### 5.7 `<n-drawer>` / `<n-drawer-content>` → `<Drawer>`

| Naive UI prop | PrimeVue v4 prop | 值转换 |
|---|---|---|
| `v-model:show` | `v-model:visible` | |
| `width="420"` | `style="width:420px"` 或 `:pt` | 按数字设置宽度 |
| `placement="right"` | `position="right"` | left / right / top / bottom |
| `closable` | `:dismissable="true"` (默认 true) | |
| `title="标题"` (n-drawer-content) | `<Drawer header="标题">` | prop 或 `#header` slot |
| `<template #header>` (n-drawer-content) | `<template #header>` (Drawer) | |

### 5.8 `<n-pagination>` → `<Paginator>`

| Naive UI prop | PrimeVue v4 prop | 值转换 |
|---|---|---|
| `:page` | `v-model:first` | `first = (page-1) * pageSize`; pageSize 默认 30 (HistoryView) |
| `:page-count` | `:totalRecords` + `:rows` | `:totalRecords="total"` `:rows="pageSize"` |
| `size="small"` | 默认无 size prop; 用 `:pt` 调整 | |
| `@update:page` | `@update:first` | 接收 `first` 值, 需自行转换为 `page`: `page = Math.floor(first/rows) + 1` |

## 6. Slot 映射

### 6.1 `<n-button>` → `<Button>`

| Naive UI slot | PrimeVue v4 |
|---|---|
| `#icon` | `#icon` (相同 slot 名) |
| default (按钮文字) | default (相同) |
| `<template #icon><n-icon><XxxOutline /></n-icon></template>` | `<template #icon><i class="pi pi-xxx"></i></template>` |

### 6.2 `<n-input>` → `<InputText>`

| Naive UI slot | PrimeVue v4 |
|---|---|
| `#prefix` | `#icon` 或 Tailwind `absolute left-3` 定位 |
| `#suffix` | Tailwind `absolute right-3` 定位 |

### 6.3 `<n-tabs>` → `<Tabs>`

| Naive UI slot | PrimeVue v4 |
|---|---|
| `<n-tab-pane #tab>` 自定义 tab 标题 | `<Tab value="xxx"><template #header>自定义</template></Tab>` |

## 7. Global Theme 配置

### 7.1 Naive UI 现有配置 (移除)

```typescript
// src/App.vue — 移除整个 n-config-provider 及其 themeOverrides
const themeOverrides: GlobalThemeOverrides = { ... }
<n-config-provider :theme-overrides="themeOverrides">
```

### 7.2 PrimeVue v4 新配置 (main.ts)

```typescript
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import { definePreset } from '@primevue/themes'

const BiliPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#e0f7fe',
      100: '#b3eefd',
      200: '#80e5fc',
      300: '#4ddbfb',
      400: '#26d4fa',
      500: '#00AEEC',  // 品牌色
      600: '#009fd4',
      700: '#008bb7',
      800: '#00789a',
      900: '#005666'
    }
  }
})

app.use(PrimeVue, {
  theme: {
    preset: BiliPreset,
    options: { darkModeSelector: '.dark' }
  }
})
```

## 8. 特殊处理

### 8.1 `n-empty` → 自定义空状态

PrimeVue 无内置 Empty 组件。项目中有多个视图使用空状态展示:
- QueueView: 队列为空
- HistoryView: 暂无历史 / 未找到匹配记录
- ResultView: 未找到结果
- SourceFavView: 需要登录 / 暂无收藏夹
- App.vue 队列抽屉: 队列为空

统一方案: 复用项目中已有的 `.empty-icon` + `.empty-title` + `.empty-desc` 布局 (纯 Tailwind), 不提取独立组件。

### 8.2 `n-popconfirm` → 手动 Popover 组合

| Naive UI 用法 | PrimeVue v4 等价 |
|---|---|
| `<n-popconfirm @positive-click="fn">确认删除？<template #trigger><n-button /></template></n-popconfirm>` | `<Popover>` + 手动放置确认按钮。或简化为: 点击删除按钮 → `toast.add()` 带撤销逻辑 |

> HistoryView 中只有 1 处 popconfirm 用于删除确认。简化为直接调用 `message.warning` → 改为 `toast.add()` 提示结果。

### 8.3 `n-grid` / `n-gi` → Tailwind Grid

| Naive UI 用法 | Tailwind 等价 |
|---|---|
| `<n-grid cols="2" x-gap="14" y-gap="14">` | `<div class="grid grid-cols-2 gap-3.5">` |
| `<n-gi>` | 直接子元素 |

> HomeView 的 `.entry-grid` 已经是纯 CSS grid (非 n-grid), 不受影响。

### 8.4 `n-gradient-text` → Tailwind gradient text

项目中当前未使用。映射关系保留:

```html
<!-- Naive UI -->
<n-gradient-text type="info">渐变文字</n-gradient-text>

<!-- Tailwind equivalent -->
<span class="bg-gradient-to-r from-[#00AEEC] to-[#0088c9] bg-clip-text text-transparent">渐变文字</span>
```

### 8.5 `n-image` → `<Image>`

| Naive UI prop | PrimeVue v4 prop | 值转换 |
|---|---|---|
| `src` | `src` | 相同 |
| `preview-disabled` | `preview` (布尔) | `preview-disabled` → `:preview="false"` |
| `width` | `width` (optional) | |

> **注意**: 项目中当前没有在所有视图中明确使用 `n-image` 组件。封面图片使用原生 `<img>` 标签。此映射为备用。

## 9. Tailwind CSS 集成

### 9.1 现状

- 项目无 Tailwind config 文件
- `tokens.css` 包含自研 Design Token (CSS 变量)
- Tailwind 未通过 PostCSS 集成; 仅使用 `@tailwindcss/typography` (可能用于 Markdown 渲染)

### 9.2 迁移后

- 不引入 Tailwind CSS 完整构建 (Tauri 桌面应用, 不需要 utility-first)
- 保留 `tokens.css` 中的布局/品牌 CSS 变量 (适配暗黑模式)
- PrimeVue Aura 主题自带完整设计系统, 无需 Tailwind 辅助
- Markdown 渲染样式保留在 scoped styles 的 `.md-preview` 中
- **不引入 Volt** (copy-paste Tailwind kit), 使用 PrimeVue Styled Mode 即可

### 9.3 tokens.css 迁移

- 删除 Naive UI 相关变量 (已通过 Aura 预设覆盖)
- 保留: `--color-brand`, `--color-bg`, `--color-surface`, `--color-border`, `--color-text`, `--color-text-secondary`, 语义色, 字体, 布局, 滚动条, log 控制台 等变量
- 移除: 无直接 Naive UI CSS 变量引用, tokens.css 中的变量均为自定义, 继续保留使用

---

*此映射表基于 PrimeVue v4 (Aura 主题) 和 Naive UI v2.41。所有映射已精确到 Props 级别, 可直接用于阶段 3-6 的逐文件替换。*