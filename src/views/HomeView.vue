<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { NInput, NButton, NText, NIcon, NCheckbox } from "naive-ui";
import { AddCircleOutline, VideocamOutline, FolderOpenOutline, CloudUploadOutline, ListOutline } from "@vicons/ionicons5";
import { useRouter } from "vue-router";
import { useAppStore } from "../stores/app";
import type { PageInfo } from "../utils/types";

const store = useAppStore();
const router = useRouter();

const url = ref("");
const activeSource = ref<"url" | "fav" | "local">("url");

// Preview logic (moved from App.vue)
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
      if (info.pages && info.pages.length > 1) {
        const matchIdx = info.pages.findIndex(p => p.cid === info.cid);
        store.selectedPages = new Set([matchIdx >= 0 ? matchIdx : 0]);
      }
    } catch (e: any) { store.error = String(e); }
    finally { store.previewLoading = false; }
  }, 600);
});

const videoPages = computed<PageInfo[]>(() => store.preview?.pages ?? []);
const hasMultiPages = computed(() => videoPages.value.length > 1);

function togglePage(idx: number) {
  const s = new Set(store.selectedPages);
  if (s.has(idx)) s.delete(idx); else s.add(idx);
  store.selectedPages = s;
}
function selectAllPages() {
  store.selectedPages = new Set(videoPages.value.map((_, i) => i));
}

function addToQueue() {
  if (!store.preview) return;
  const pages = videoPages.value;
  const selected: number[] = [];
  store.selectedPages.forEach(i => { if (i < pages.length) selected.push(i); });
  if (selected.length === 0) { store.error = "请至少选择一个分P"; return; }
  
  selected.forEach(i => {
    store.addQueueItem({ url: url.value, pageInfo: pages[i] });
  });
  
  // Navigate to queue page
  router.push("/queue");
}

const fmtDur = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};
</script>

<template>
  <div class="home-root">
    <div class="hero">
      <n-icon size="40" color="#00aeec"><VideocamOutline /></n-icon>
      <h1 class="hero-title">Bili2Insight</h1>
      <p class="hero-sub">B站视频 → AI 观点提炼，一步到位</p>
    </div>

    <div class="source-cards">
      <!-- URL card -->
      <div class="source-card" :class="{ active: activeSource === 'url' }" @click="activeSource = 'url'">
        <div class="card-icon url"><n-icon size="24"><VideocamOutline /></n-icon></div>
        <div class="card-label">B站链接</div>
        <div class="card-desc">粘贴视频地址自动解析</div>
        <template v-if="activeSource === 'url'">
          <div class="card-body" @click.stop>
            <n-input v-model:value="url" placeholder="https://www.bilibili.com/video/BV..." :disabled="store.isProcessing" clearable size="small" style="margin-top:12px;" />
            
            <div v-if="store.previewLoading" class="preview-loading"><n-text depth="3" style="font-size:13px;">检测视频中...</n-text></div>
            
            <div v-if="store.preview" class="preview-mini">
              <img v-if="store.preview.cover" :src="store.preview.cover" referrerpolicy="no-referrer" class="preview-cover" />
              <div class="preview-meta">
                <n-text strong style="font-size:13px;">{{ store.preview.title }}</n-text>
                <n-text depth="3" style="font-size:11px;">{{ store.preview.uploader }} &middot; {{ fmtDur(store.preview.duration) }}</n-text>
              </div>
            </div>

            <div v-if="hasMultiPages" class="page-select">
              <div class="page-header">
                <n-checkbox :checked="store.selectedPages.size === videoPages.length" @update:checked="selectAllPages()">全选</n-checkbox>
                <n-text depth="3" style="font-size:11px;margin-left:8px;">{{ store.selectedPages.size }}/{{ videoPages.length }} 个分P</n-text>
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

            <n-button type="primary" block size="small" style="margin-top:10px;" @click="addToQueue" :disabled="!store.preview || store.isProcessing">
              <template #icon><n-icon><AddCircleOutline /></n-icon></template>加入队列
            </n-button>
          </div>
        </template>
      </div>

      <!-- Favorites card (placeholder) -->
      <div class="source-card disabled" @click="activeSource = 'fav'">
        <div class="card-icon fav"><n-icon size="24"><FolderOpenOutline /></n-icon></div>
        <div class="card-label">B站收藏夹</div>
        <div class="card-desc">登录后批量导入</div>
        <div class="coming-soon">即将支持</div>
      </div>

      <!-- Local card (placeholder) -->
      <div class="source-card disabled" @click="activeSource = 'local'">
        <div class="card-icon local"><n-icon size="24"><CloudUploadOutline /></n-icon></div>
        <div class="card-label">本地文件</div>
        <div class="card-desc">上传视频或音频</div>
        <div class="coming-soon">即将支持</div>
      </div>
    </div>

    <!-- Floating queue button -->
    <div class="queue-float" @click="router.push('/queue')">
      <n-icon size="20"><ListOutline /></n-icon>
      <span v-if="store.queueCount > 0" class="queue-badge">{{ store.queueCount }}</span>
    </div>
  </div>
</template>

<style scoped>
.home-root {
  display: flex; flex-direction: column; align-items: center; padding: 40px 24px 24px;
  min-height: 100%; overflow-y: auto;
}
.hero { text-align: center; margin-bottom: 36px; }
.hero-title { font-size: 26px; font-weight: 700; margin: 12px 0 4px; color: #111; }
.hero-sub { font-size: 14px; color: #888; margin: 0; }
.source-cards {
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;
  width: 100%; max-width: 800px;
}
.source-card {
  background: #fff; border: 2px solid #eee; border-radius: 12px;
  padding: 24px 20px; text-align: center; cursor: pointer;
  transition: border-color .2s, box-shadow .2s; position: relative;
}
.source-card:hover { border-color: #d0d0d0; }
.source-card.active { border-color: #00aeec; box-shadow: 0 0 0 3px rgba(0,174,236,.1); }
.source-card.disabled { opacity: .55; cursor: default; }
.source-card.disabled:hover { border-color: #eee; }
.card-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; }
.card-icon.url { background: #e8f4fd; color: #00aeec; }
.card-icon.fav { background: #fef3e8; color: #f0a020; }
.card-icon.local { background: #e8f8e8; color: #18a058; }
.card-label { font-size: 15px; font-weight: 600; margin-bottom: 4px; color: #333; }
.card-desc { font-size: 12px; color: #999; }
.card-body { text-align: left; margin-top: 4px; }
.coming-soon {
  margin-top: 14px; font-size: 11px; color: #bbb; border: 1px dashed #ddd;
  display: inline-block; padding: 2px 10px; border-radius: 10px;
}
.preview-loading { margin-top: 10px; }
.preview-mini {
  display: flex; gap: 10px; align-items: center; margin-top: 10px;
  background: #f8f8f8; border-radius: 8px; padding: 8px;
}
.preview-cover { width: 64px; height: 36px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }
.preview-meta { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.page-select { margin-top: 10px; }
.page-header { display: flex; align-items: center; margin-bottom: 4px; }
.page-list { max-height: 140px; overflow-y: auto; display: flex; flex-direction: column; gap: 1px; }
.page-row {
  display: flex; align-items: center; gap: 6px; padding: 4px 6px;
  border-radius: 4px; cursor: pointer; transition: background .15s; font-size: 12px;
}
.page-row:hover { background: #f0f0f0; }
.page-row.sel { background: #e8f4fd; }
.page-idx { color: #999; min-width: 22px; }
.page-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.page-time { color: #bbb; flex-shrink: 0; }
.queue-float {
  position: fixed; bottom: 24px; right: 24px;
  width: 48px; height: 48px; background: #00aeec; color: #fff;
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  cursor: pointer; box-shadow: 0 4px 16px rgba(0,174,236,.35);
  transition: transform .2s;
}
.queue-float:hover { transform: scale(1.08); }
.queue-badge {
  position: absolute; top: -4px; right: -4px;
  background: #d03050; color: #fff; font-size: 10px;
  width: 18px; height: 18px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font-weight: 600;
}
</style>