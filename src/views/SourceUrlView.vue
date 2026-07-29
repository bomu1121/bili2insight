<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from "vue";
import { NInput, NButton, NText, NIcon, NCheckbox, NSpin, createDiscreteApi } from "naive-ui";
import { CirclePlus, X, RotateCw, LinkIcon, User, Clock } from "lucide-vue-next";
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

const activeIndex = ref<number | null>(null);
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
  message.success("已加入 " + sel.length + " 个视频到队列");
  url.value = "";
  store.preview = null;
}

const fmtDur = (sec: number) => {
  const h = Math.floor(sec / 3600),
    m = Math.floor((sec % 3600) / 60),
    s = sec % 60;
  return h > 0
    ? String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0")
    : String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
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

    <!-- Floating dialog panel (ref: Linear Cmd+K, Raycast command palette) -->
    <div class="source-panel">
      <!-- Minimal close button (ref: macOS panel close, Linear dialog dismiss) -->
      <n-button quaternary circle size="tiny" class="panel-close" @click="router.push('/')">
        <template #icon><n-icon size="18"><X /></n-icon></template>
      </n-button>

      <div class="intro-card">
        <div class="intro-title">粘贴视频链接</div>
        <div class="intro-desc">支持 av / BV / 分P 链接，粘贴后自动解析封面与分集</div>
      </div>

      <n-input
        v-model:value="url"
        placeholder="https://www.bilibili.com/video/BVxxxx"
        :disabled="store.isProcessing"
        clearable
        size="large"
        round
        autofocus
      >
        <template #prefix>
          <n-icon color="var(--color-text-tertiary)"><LinkIcon /></n-icon>
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
              <span class="meta-item"><n-icon :size="14"><User /></n-icon>{{ store.preview.uploader }}</span>
              <span class="meta-item tnum"><n-icon :size="14"><Clock /></n-icon>{{ fmtDur(store.preview.duration) }}</span>
            </div>
          </div>
          <n-button quaternary circle size="small" @click="refreshPreview" title="刷新预览">
            <template #icon><n-icon :size="16"><RotateCw /></n-icon></template>
          </n-button>
        </div>

        <div v-if="hasMultiPages" class="page-section">
          <div class="page-strip-header">
            <n-checkbox :checked="store.selectedPages.size === videoPages.length" @update:checked="selectAll()">
              全选 ({{ store.selectedPages.size }}/{{ videoPages.length }})
            </n-checkbox>
          </div>
          <div class="index-panel">
            <div class="index-list">
              <div
                v-for="(p, i) in videoPages"
                :key="i"
                class="index-row"
                :class="{ sel: store.selectedPages.has(i), active: activeIndex === i }"
                @click="togglePage(i)"
                @mouseenter="activeIndex = i"
              >
                <span class="index-num tnum">P{{ p.page }}</span>
                <span v-if="store.selectedPages.has(i)" class="index-dot"></span>
              </div>
            </div>
            <div class="index-detail">
              <div v-if="activeIndex !== null && activeIndex < videoPages.length" class="id-card">
                <div class="id-num tnum">P{{ videoPages[activeIndex].page }}</div>
                <div class="id-name">{{ videoPages[activeIndex].part }}</div>
                <div class="id-time tnum">{{ fmtDur(videoPages[activeIndex].duration) }}</div>
                <div class="id-status" :class="{ selected: store.selectedPages.has(activeIndex) }">
                  {{ store.selectedPages.has(activeIndex) ? '已选择' : '点击选择' }}
                </div>
              </div>
              <div v-else class="id-empty">悬停编号查看详情</div>
            </div>
          </div>
        </div>

        <n-button type="primary" block size="large" round @click="addToQueue" :disabled="!store.preview || store.isProcessing">
          <template #icon><n-icon><CirclePlus /></n-icon></template>
          加入队列
        </n-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Full-screen backdrop: centered dialog effect (ref: Linear Cmd+K, Raycast) */
.source-root {
  display: flex; align-items: center; justify-content: center;
  height: 100%;
  padding: 32px;
  position: relative;
}
.source-root::before {
  content: "";
  position: fixed; inset: 0;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.35) 100%);
  pointer-events: none;
  z-index: 0;
}

/* Floating panel */
.source-panel {
  position: relative; z-index: 1;
  max-width: var(--content-max-source); width: 100%;
  max-height: calc(100vh - 64px); overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-hover), 0 0 0 1px rgba(111,181,132,0.04);
  padding: 32px 28px 28px;
  display: flex; flex-direction: column; gap: 16px;
  animation: panelEnter 0.4s var(--spring-snappy) both;
}
@keyframes panelEnter { from { opacity: 0; transform: scale(0.97) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }

/* Close button: top-right corner */
.panel-close { position: absolute; top: 12px; right: 12px; color: var(--color-text-tertiary); }

/* Content */
.intro-card { padding: 0 2px 6px; }
.intro-title { font-size: var(--font-size-page); font-weight: 700; letter-spacing: -0.01em; color: var(--color-text); margin-bottom: 7px; }
.intro-desc { font-size: 13px; color: var(--color-text-secondary); line-height: 1.6; }
.preview-loading { display: inline-flex; align-items: center; gap: 10px; font-size: 13px; color: var(--color-text-secondary); padding: 8px 0; font-family: var(--font-mono); }
.preview-section { display: flex; flex-direction: column; gap: 14px; animation: fadeUp var(--dur-3) var(--ease-out); }
@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

.preview-card { display: flex; gap: 14px; align-items: center; background: linear-gradient(90deg, rgba(111,181,132,0.08), rgba(111,181,132,0.02)); background-size: 0% 100%; background-repeat: no-repeat; border-radius: var(--radius-lg); padding: 14px; border: 1px solid var(--color-border); box-shadow: var(--shadow-xs); transition: background-size 0.4s cubic-bezier(0.22,0.61,0.36,1), border-color var(--dur-2), box-shadow var(--dur-2); }
.preview-card:hover { background-size: 100% 100%; border-color: rgba(111,181,132,0.35); box-shadow: 0 0 0 1px rgba(111,181,132,0.15), 0 4px 20px rgba(0,0,0,0.3), 0 0 14px rgba(111,181,132,0.06); }
.cover-wrap { position: relative; flex-shrink: 0; }
.preview-img { width: 152px; aspect-ratio: 16/9; object-fit: cover; border-radius: var(--radius-md); background: var(--color-surface-muted); display: block; }
.cover-badge { position: absolute; right: 6px; bottom: 6px; background: rgba(10,10,16,0.8); color: var(--color-brand); font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: var(--radius-full); font-family: var(--font-mono); }
.preview-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.preview-title { font-size: 15px; font-weight: 650; color: var(--color-text); line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.preview-meta { display: flex; flex-wrap: wrap; gap: 12px; }
.meta-item { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--color-text-secondary); }

.page-section { background: var(--color-surface); border-radius: var(--radius-lg); padding: 12px 14px; border: 1px solid var(--color-border); box-shadow: var(--shadow-xs); }

/* Index + Detail panel (ref: macOS installer package selector, Figma component panel) */
.page-strip-header { margin-bottom: 10px; padding: 0 4px; flex-shrink: 0; }
.index-panel { display: flex; gap: 12px; }
.index-list { flex-shrink: 0; display: flex; flex-direction: column; gap: 2px; max-height: 240px; overflow-y: auto; min-width: 80px; }
.index-row { display: flex; align-items: center; gap: 8px; padding: 5px 10px; border-radius: var(--radius-md); cursor: pointer; transition: all var(--dur-1); position: relative; }
.index-row:hover { background: var(--color-ink-soft); }
.index-row.active { background: var(--color-brand-soft); }
.index-row.sel { background: var(--color-brand-soft); }
.index-num { font-family: var(--font-mono); font-size: 12px; font-weight: 700; color: var(--color-text-tertiary); }
.index-row.active .index-num { color: var(--color-brand); }
.index-row.sel .index-num { color: var(--color-brand); }
.index-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-brand); box-shadow: var(--brand-glow-soft); flex-shrink: 0; margin-left: auto; }

.index-detail { flex: 1; min-height: 100px; display: flex; align-items: center; justify-content: center; }
.id-empty { font-size: 12px; color: var(--color-text-tertiary); }
.id-card { display: flex; flex-direction: column; gap: 8px; padding: 16px; background: var(--color-surface-muted); border: 1px solid var(--color-border); border-radius: var(--radius-lg); width: 100%; }
.id-num { font-family: var(--font-mono); font-size: 20px; font-weight: 700; color: var(--color-brand); }
.id-name { font-size: 14px; font-weight: 600; color: var(--color-text); line-height: 1.4; }
.id-time { font-family: var(--font-mono); font-size: 12px; color: var(--color-text-secondary); }
.id-status { font-size: 12px; color: var(--color-text-tertiary); }
.id-status.selected { color: var(--color-success); font-weight: 600; }
</style>
