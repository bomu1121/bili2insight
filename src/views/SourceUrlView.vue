<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from "vue";
import { NInput, NButton, NText, NIcon, NCheckbox, createDiscreteApi } from "naive-ui";
import { AddCircleOutline, ArrowBackOutline } from "@vicons/ionicons5";
import { RefreshOutline } from "@vicons/ionicons5";
import { useRouter } from "vue-router";
import { useAppStore } from "../stores/app";
import type { PageInfo } from "../utils/types";

const store = useAppStore();
const router = useRouter();
const { message } = createDiscreteApi(['message']);

const url = ref("");
let previewTimer: ReturnType<typeof setTimeout> | null = null;

watch(url, (val) => {
  if (previewTimer) clearTimeout(previewTimer);
  store.preview = null; store.previewLoading = false;
  store.selectedPages = new Set();
  if (!val.trim() || !val.includes("bilibili.com")) return;
  store.previewLoading = true;
  previewTimer = setTimeout(async () => {
    try {
      const info = await store.previewVideoFn(val);
      store.preview = info;
      if (info.pages && info.pages.length > 0) {
        const matchIdx = info.pages.findIndex(p => p.cid === info.cid);
        store.selectedPages = new Set([matchIdx >= 0 ? matchIdx : 0]);
      }
    } catch (e: any) { store.error = String(e); }
    finally { store.previewLoading = false; }
  }, 600);
});

onUnmounted(() => { if (previewTimer) clearTimeout(previewTimer); });

const videoPages = computed<PageInfo[]>(() => store.preview?.pages ?? []);
const hasMultiPages = computed(() => videoPages.value.length > 1);

function togglePage(idx: number) {
  const s = new Set(store.selectedPages);
  if (s.has(idx)) s.delete(idx); else s.add(idx);
  store.selectedPages = s;
}
function selectAll() { store.selectedPages = new Set(videoPages.value.map((_, i) => i)); }

function addToQueue() {
  if (!store.preview) return;
  const pages = videoPages.value;
  const sel: number[] = [];
  store.selectedPages.forEach(i => { if (i < pages.length) sel.push(i); });
  if (sel.length === 0) { message.warning("请至少选择一个分P"); return; }
  sel.forEach(i => {
  const page = { ...pages[i] };
  if (pages.length === 1 && store.preview) page.part = store.preview.title;
  store.addQueueItem({ url: url.value, pageInfo: page });
});
  message.success(`已加入 ${sel.length} 个视频到队列`);
  url.value = ""; store.preview = null;
}

const fmtDur = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};
</script>

<template>
  <div class="source-root">
    <div class="source-bar">
      <n-button text @click="router.push('/')"><template #icon><n-icon><ArrowBackOutline /></n-icon></template>返回</n-button>
      <n-text strong style="font-size:15px;">B站链接</n-text>
    </div>

    <div class="source-body">
      <n-input v-model:value="url" placeholder="粘贴 Bilibili 视频链接..." :disabled="store.isProcessing" clearable size="large" />

      <div v-if="store.previewLoading" class="preview-loading">检测视频中...</div>

      <div v-if="store.preview" class="preview-section">
        <div class="preview-card">
          <div class="preview-card-top">
          <img v-if="store.preview.cover" :src="store.preview.cover" referrerpolicy="no-referrer" class="preview-img" />
          <div class="preview-info">
            <n-text strong style="font-size:15px;">{{ store.preview.title }}</n-text>
            <n-text depth="3" style="font-size:12px;">{{ store.preview.uploader }} &middot; {{ fmtDur(store.preview.duration) }} &middot; {{ videoPages.length }} 个分P</n-text>
          </div>
            <n-button text size="tiny" @click="async () => { store.previewLoading = true; try { const info = await store.refreshPreview(url); store.preview = info; } catch(e:any){store.error=String(e)} finally { store.previewLoading = false } }" title="刷新预览（绕过缓存）">
              <template #icon><n-icon size="16"><RefreshOutline /></n-icon></template>
            </n-button>
          </div>
        </div>

        <div v-if="hasMultiPages" class="page-section">
          <div class="page-header">
            <n-checkbox :checked="store.selectedPages.size === videoPages.length" @update:checked="selectAll()">全选 ({{ store.selectedPages.size }}/{{ videoPages.length }})</n-checkbox>
          </div>
          <div class="page-list">
            <div v-for="(p, i) in videoPages" :key="i" class="page-row" :class="{ sel: store.selectedPages.has(i) }" @click="togglePage(i)">
              <n-checkbox :checked="store.selectedPages.has(i)" size="small" />
              <span class="page-idx">P{{ p.page }}</span>
              <span class="page-name">{{ p.part }}</span>
              <span class="page-time">{{ fmtDur(p.duration) }}</span>
            </div>
          </div>
        </div>

        <n-button type="primary" block @click="addToQueue" :disabled="!store.preview || store.isProcessing" style="margin-top:14px;">
          <template #icon><n-icon><AddCircleOutline /></n-icon></template>加入队列
        </n-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.source-root { display: flex; flex-direction: column; height: 100%; }
.source-bar { display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: #fff; border-bottom: 1px solid #eee; flex-shrink: 0; }
.source-body { flex: 1; padding: 24px; max-width: 680px; margin: 0 auto; width: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
.preview-loading { font-size: 13px; color: #999; padding: 8px 0; }
.preview-section { display: flex; flex-direction: column; gap: 10px; }
.preview-card { display: flex; gap: 12px; align-items: center; background: #fafafa; border-radius: 10px; padding: 12px; }
.preview-card-top { display: flex; gap: 12px; align-items: center; width: 100%; }
.preview-img { width: 120px; height: 68px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
.preview-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.page-section { background: #fafafa; border-radius: 10px; padding: 10px 14px; }
.page-header { margin-bottom: 4px; }
.page-list { max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 1px; }
.page-row { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 4px; cursor: pointer; transition: background .15s; font-size: 13px; }
.page-row:hover { background: #f0f0f0; }
.page-row.sel { background: #e8f4fd; }
.page-idx { color: #999; min-width: 28px; }
.page-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.page-time { color: #bbb; flex-shrink: 0; font-size: 11px; }
</style>
