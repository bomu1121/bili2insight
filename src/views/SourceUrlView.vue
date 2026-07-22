<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from "vue";
import { NInput, NButton, NText, NIcon, NCheckbox, NSpin, createDiscreteApi } from "naive-ui";
import { AddCircleOutline, ArrowBackOutline, RefreshOutline, LinkOutline, PersonOutline, TimeOutline } from "@vicons/ionicons5";
import { useRouter } from "vue-router";
import { useAppStore } from "../stores/app";
import type { PageInfo } from "../utils/types";

const store = useAppStore();
const router = useRouter();
const { message } = createDiscreteApi(["message"]);

const url = ref("");
let previewTimer: ReturnType<typeof setTimeout> | null = null;

watch(url, (val) => {
  if (previewTimer) clearTimeout(previewTimer);
  store.preview = null;
  store.previewLoading = false;
  store.selectedPages = new Set();
  if (!val.trim() || !val.includes("bilibili.com")) return;
  store.previewLoading = true;
  previewTimer = setTimeout(async () => {
    try {
      const info = await store.previewVideoFn(val);
      store.preview = info;
      if (info.pages && info.pages.length > 0) {
        const matchIdx = info.pages.findIndex((p) => p.cid === info.cid);
        store.selectedPages = new Set([matchIdx >= 0 ? matchIdx : 0]);
      }
    } catch (e: any) {
      store.error = String(e);
    } finally {
      store.previewLoading = false;
    }
  }, 600);
});

onUnmounted(() => {
  if (previewTimer) clearTimeout(previewTimer);
});

const videoPages = computed<PageInfo[]>(() => store.preview?.pages ?? []);
const hasMultiPages = computed(() => videoPages.value.length > 1);

function togglePage(idx: number) {
  const s = new Set(store.selectedPages);
  if (s.has(idx)) s.delete(idx);
  else s.add(idx);
  store.selectedPages = s;
}
function selectAll() {
  store.selectedPages = new Set(videoPages.value.map((_, i) => i));
}

function addToQueue() {
  if (!store.preview) return;
  const pages = videoPages.value;
  const sel: number[] = [];
  store.selectedPages.forEach((i) => {
    if (i < pages.length) sel.push(i);
  });
  if (sel.length === 0) {
    message.warning("请至少选择一个分P");
    return;
  }
  sel.forEach((i) => {
    const page = { ...pages[i] };
    if (pages.length === 1 && store.preview) page.part = store.preview.title;
    store.addQueueItem({ url: url.value, pageInfo: page });
  });
  message.success(`已加入 ${sel.length} 个视频到队列`);
  url.value = "";
  store.preview = null;
}

const fmtDur = (sec: number) => {
  const h = Math.floor(sec / 3600),
    m = Math.floor((sec % 3600) / 60),
    s = sec % 60;
  return h > 0
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

async function refreshPreview() {
  store.previewLoading = true;
  try {
    const info = await store.refreshPreview(url.value);
    store.preview = info;
  } catch (e: any) {
    store.error = String(e);
  } finally {
    store.previewLoading = false;
  }
}
</script>

<template>
  <div class="source-root">
    <div class="page-bar">
      <n-button text class="bar-back" @click="router.push('/')">
        <template #icon><n-icon><ArrowBackOutline /></n-icon></template>返回
      </n-button>
      <div class="bar-title">
        <span class="bar-ic url"><n-icon :size="15"><LinkOutline /></n-icon></span>
        <n-text strong>B站链接</n-text>
      </div>
    </div>

    <div class="source-body">
      <div class="intro-card">
        <div class="intro-title">粘贴视频链接</div>
        <div class="intro-desc">支持 av / BV / 分P 链接，粘贴后自动解析封面与分集</div>
      </div>

      <n-input
        v-model:value="url"
        placeholder="例如 https://www.bilibili.com/video/BVxxxx"
        :disabled="store.isProcessing"
        clearable
        size="large"
        round
      >
        <template #prefix>
          <n-icon color="var(--color-text-tertiary)"><LinkOutline /></n-icon>
        </template>
      </n-input>

      <div v-if="store.previewLoading" class="preview-loading">
        <n-spin size="small" />
        <span>正在解析视频信息…</span>
      </div>

      <div v-if="store.preview" class="preview-section">
        <div class="preview-card">
          <div class="cover-wrap">
            <img v-if="store.preview.cover" :src="store.preview.cover" referrerpolicy="no-referrer" class="preview-img" />
            <div class="cover-badge tnum">{{ videoPages.length }}P</div>
          </div>
          <div class="preview-info">
            <div class="preview-title">{{ store.preview.title }}</div>
            <div class="preview-meta">
              <span class="meta-item"><n-icon :size="14"><PersonOutline /></n-icon>{{ store.preview.uploader }}</span>
              <span class="meta-item tnum"><n-icon :size="14"><TimeOutline /></n-icon>{{ fmtDur(store.preview.duration) }}</span>
            </div>
          </div>
          <n-button quaternary circle size="small" @click="refreshPreview" title="刷新预览（绕过缓存）">
            <template #icon><n-icon :size="16"><RefreshOutline /></n-icon></template>
          </n-button>
        </div>

        <div v-if="hasMultiPages" class="page-section">
          <div class="page-header">
            <n-checkbox :checked="store.selectedPages.size === videoPages.length" @update:checked="selectAll()">
              全选 ({{ store.selectedPages.size }}/{{ videoPages.length }})
            </n-checkbox>
          </div>
          <div class="page-list">
            <div
              v-for="(p, i) in videoPages"
              :key="i"
              class="page-row"
              :class="{ sel: store.selectedPages.has(i) }"
              @click="togglePage(i)"
            >
              <n-checkbox :checked="store.selectedPages.has(i)" size="small" />
              <span class="page-idx tnum">P{{ p.page }}</span>
              <span class="page-name">{{ p.part }}</span>
              <span class="page-time tnum">{{ fmtDur(p.duration) }}</span>
            </div>
          </div>
        </div>

        <n-button type="primary" block size="large" round @click="addToQueue" :disabled="!store.preview || store.isProcessing">
          <template #icon><n-icon><AddCircleOutline /></n-icon></template>
          加入队列
        </n-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.source-root {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* ===== 页头条 ===== */
.page-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: var(--header-height);
  padding: 0 20px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.bar-back {
  color: var(--color-text-secondary);
}
.bar-title {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 15px;
}
.bar-ic {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  display: grid;
  place-items: center;
}
.bar-ic.url {
  background: var(--color-brand-soft);
  color: var(--color-brand);
}

.source-body {
  flex: 1;
  padding: 32px 28px 40px;
  max-width: var(--content-max-source);
  margin: 0 auto;
  width: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.intro-card {
  padding: 0 2px 6px;
}
.intro-title {
  font-size: var(--font-size-page);
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--color-text);
  margin-bottom: 7px;
}
.intro-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}
.preview-loading {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--color-text-secondary);
  padding: 8px 0;
}
.preview-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: fadeUp var(--dur-3) var(--ease-out);
}

/* ===== 预览卡 ===== */
.preview-card {
  display: flex;
  gap: 14px;
  align-items: center;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 14px;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-xs);
}
.cover-wrap {
  position: relative;
  flex-shrink: 0;
}
.preview-img {
  width: 152px;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  display: block;
}
.cover-badge {
  position: absolute;
  right: 6px;
  bottom: 6px;
  background: rgba(22, 24, 29, 0.72);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: var(--radius-full);
  backdrop-filter: blur(2px);
}
.preview-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.preview-title {
  font-size: 15px;
  font-weight: 650;
  color: var(--color-text);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.preview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* ===== 分P 选择 ===== */
.page-section {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-xs);
}
.page-header {
  margin-bottom: 8px;
  padding: 0 4px;
}
.page-list {
  max-height: 260px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.page-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--dur-1), border-color var(--dur-1);
  font-size: 13px;
  border: 1px solid transparent;
}
.page-row:hover {
  background: var(--color-surface-muted);
}
.page-row.sel {
  background: var(--color-brand-soft);
  border-color: var(--color-brand-border);
}
.page-idx {
  color: var(--color-brand-pressed);
  font-weight: 700;
  min-width: 30px;
  font-size: 12px;
}
.page-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.page-time {
  color: var(--color-text-tertiary);
  flex-shrink: 0;
  font-size: 11px;
}
</style>
