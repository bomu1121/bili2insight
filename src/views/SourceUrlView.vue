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
    <div class="source-bar">
      <n-button text @click="router.push('/')">
        <template #icon><n-icon><ArrowBackOutline /></n-icon></template>返回
      </n-button>
      <div class="bar-title">
        <n-icon :size="18" color="var(--color-brand)"><LinkOutline /></n-icon>
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
            <div class="cover-badge">{{ videoPages.length }}P</div>
          </div>
          <div class="preview-info">
            <div class="preview-title">{{ store.preview.title }}</div>
            <div class="preview-meta">
              <span class="meta-item"><n-icon :size="14"><PersonOutline /></n-icon>{{ store.preview.uploader }}</span>
              <span class="meta-item"><n-icon :size="14"><TimeOutline /></n-icon>{{ fmtDur(store.preview.duration) }}</span>
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
              <span class="page-idx">P{{ p.page }}</span>
              <span class="page-name">{{ p.part }}</span>
              <span class="page-time">{{ fmtDur(p.duration) }}</span>
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
.source-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.bar-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
}
.source-body {
  flex: 1;
  padding: 28px 24px 36px;
  max-width: var(--content-max-source);
  margin: 0 auto;
  width: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.intro-card {
  padding: 4px 2px 8px;
}
.intro-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 6px;
}
.intro-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
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
  animation: fadeUp 0.28s var(--ease-out);
}
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.preview-card {
  display: flex;
  gap: 14px;
  align-items: center;
  background: var(--color-surface);
  border-radius: 16px;
  padding: 14px;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
}
.cover-wrap {
  position: relative;
  flex-shrink: 0;
}
.preview-img {
  width: 148px;
  height: 84px;
  object-fit: cover;
  border-radius: 12px;
  background: var(--color-bg);
  display: block;
}
.cover-badge {
  position: absolute;
  right: 6px;
  bottom: 6px;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 999px;
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
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.preview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.page-section {
  background: var(--color-surface);
  border-radius: 16px;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
}
.page-header {
  margin-bottom: 8px;
}
.page-list {
  max-height: 260px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.page-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
  font-size: 13px;
  border: 1px solid transparent;
}
.page-row:hover {
  background: var(--color-bg);
}
.page-row.sel {
  background: var(--color-brand-soft);
  border-color: rgba(0, 174, 236, 0.22);
}
.page-idx {
  color: var(--color-brand);
  font-weight: 700;
  min-width: 28px;
  font-size: 12px;
}
.page-name {
  flex: 1;
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
