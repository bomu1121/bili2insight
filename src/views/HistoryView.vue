<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import { NButton, NText, NIcon, NInput, NPagination, NDrawer, NDrawerContent, NSpace, NDivider, NPopconfirm, createDiscreteApi } from "naive-ui";
import { ArrowBackOutline, TrashOutline, EyeOutline, SearchOutline, RefreshOutline, CopyOutline, DownloadOutline, TimeOutline, DocumentTextOutline } from "@vicons/ionicons5";
import { useRouter } from "vue-router";
import { fetchHistoryList, getHistoryResult, deleteHistoryItem, clearHistory } from "../utils/invoke";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { renderMarkdown } from "../utils/markdown";
import type { HistoryEntry, HistoryListResult, PipelineResult } from "../utils/types";

const router = useRouter();
const { message } = createDiscreteApi(["message"]);

const loading = ref(false);
const search = ref("");
const page = ref(1);
const pageSize = 30;
const data = ref<HistoryListResult | null>(null);

const detailDrawer = ref(false);
const detailEntry = ref<HistoryEntry | null>(null);
const detailResult = ref<PipelineResult | null>(null);
const detailLoading = ref(false);

async function load() {
  loading.value = true;
  try { const q = search.value.trim() || undefined; data.value = await fetchHistoryList(page.value, pageSize, q); }
  catch (e: any) { message.error("加载失败: " + String(e)); }
  finally { loading.value = false; }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(search, () => { if (searchTimer) clearTimeout(searchTimer); searchTimer = setTimeout(() => { page.value = 1; load(); }, 300); });
watch(page, () => load());
onMounted(() => load());

async function openDetail(entry: HistoryEntry) {
  detailEntry.value = entry; detailResult.value = null; detailDrawer.value = true; detailLoading.value = true;
  try { detailResult.value = JSON.parse(await getHistoryResult(entry.id)) as PipelineResult; }
  catch (e: any) { message.error("加载详情失败: " + String(e)); }
  finally { detailLoading.value = false; }
}

const aiContent = computed(() => {
  const md = detailResult.value?.markdown; if (!md) return "";
  const aiIdx = md.indexOf("## AI Insights") !== -1 ? md.indexOf("## AI Insights") : md.indexOf("## AI");
  if (aiIdx === -1) return md;
  let section = md.substring(aiIdx + (md.indexOf("## AI Insights") !== -1 ? 15 : 5));
  section = section.replace(/^### (Summary|Key Points|Tags)\s*\n?/gm, "");
  const tIdx = section.indexOf("## Full Transcript"); if (tIdx !== -1) section = section.substring(0, tIdx);
  return section.trim();
});


async function copyDetail() {
  if (!detailResult.value || !detailEntry.value) return;
  try { await writeText(`【${detailEntry.value.title}】 ${detailEntry.value.url}\n\n${aiContent.value}`); message.success("已复制"); }
  catch (e: any) { message.error("复制失败: " + String(e)); }
}

async function exportDetail() {
  if (!detailResult.value || !detailEntry.value) return;
  try {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({ filters:[{name:"Markdown",extensions:["md"]}], defaultPath:`${detailEntry.value.title}.md` });
    if (path) { const { invoke } = await import("@tauri-apps/api/core"); await invoke("save_result_to_file",{result:detailResult.value,outputPath:path}); message.success("导出成功"); }
  } catch(e:any){ message.error("导出失败: "+String(e)); }
}

async function doDelete(entry: HistoryEntry) { try { await deleteHistoryItem(entry.id); load(); } catch(e:any){ message.error("删除失败: "+String(e)); } }
async function doClearAll() { try { await clearHistory(); data.value = null; message.success("已清空"); } catch(e:any){ message.error("清除失败: "+String(e)); } }

function fmtDate(ts: number) {
  const d = new Date(ts), now = new Date(), diffH = (now.getTime()-ts)/3600000;
  if (diffH<1) return Math.max(1,Math.floor((now.getTime()-ts)/60000))+"分钟前";
  if (diffH<24) return Math.floor(diffH)+"小时前";
  if (diffH<48) return "昨天"; if (diffH<168) return Math.floor(diffH/24)+"天前";
  const p=(n:number)=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}

function fmtDur(sec: number) {
  if(sec<=0) return ""; const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
  return h>0?`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function fmtElapsed(ms: number) {
  if(ms<1000) return `${ms}ms`; if(ms<60000) return `${(ms/1000).toFixed(1)}s`;
  const m=Math.floor(ms/60000),s=Math.round((ms%60000)/1000); return `${m}m${s}s`;
}

const sourceLabel: Record<string,string>={url:"B站",fav:"收藏",local:"本地"};
const sourceColor: Record<string,string>={
  url: "var(--color-brand)",
  fav: "var(--color-warning)",
  local: "var(--color-success)",
};
</script>

<template>
  <div class="history-root">
    <div class="history-header">
      <div class="header-left">
        <n-button text @click="router.push('/')"><template #icon><n-icon><ArrowBackOutline /></n-icon></template>返回</n-button>
        <div class="title-wrap">
          <n-icon :size="18" color="var(--color-accent-purple)"><TimeOutline /></n-icon>
          <n-text strong>历史记录</n-text>
        </div>
      </div>
      <n-space :size="8">
        <n-button size="small" @click="load()" :loading="loading"><template #icon><n-icon><RefreshOutline /></n-icon></template></n-button>
        <n-button size="small" type="error" secondary @click="doClearAll" :disabled="!data||data.total===0">清空全部</n-button>
      </n-space>
    </div>

    <div class="history-bar">
      <n-input v-model:value="search" placeholder="搜索标题、UP主、BV号..." size="small" clearable round style="width:320px;">
        <template #prefix><n-icon><SearchOutline /></n-icon></template>
      </n-input>
      <n-text depth="3" class="total-text" v-if="data&&!loading">共 {{ data.total }} 条</n-text>
    </div>

    <div class="history-list" v-if="data&&data.entries.length>0">
      <div v-for="entry in data.entries" :key="entry.id"
        class="h-entry" :class="{'h-done':entry.status==='done','h-err':entry.status==='error'}"
        @click="openDetail(entry)">
        <div class="h-thumb">
          <img v-if="entry.cover" :src="entry.cover+'@160w_100h_1c'" class="h-cover" referrerpolicy="no-referrer" />
          <div v-else class="h-cover-fb"><n-icon size="22" color="var(--color-text-tertiary)"><EyeOutline /></n-icon></div>
        </div>
        <div class="h-body">
          <div class="h-line1">
            <span class="h-title">{{ entry.title }}</span>
          </div>
          <div class="h-line2">
            <span class="h-badge" :style="{background:sourceColor[entry.source]||'var(--color-text-secondary)'}">{{ sourceLabel[entry.source]||entry.source }}</span>
            <span class="h-dot">&middot;</span>
            <span v-if="entry.uploader" class="h-meta">{{ entry.uploader }}</span>
            <span v-if="entry.uploader" class="h-dot">&middot;</span>
            <span v-if="entry.duration>0" class="h-meta">{{ fmtDur(entry.duration) }}</span>
            <span v-if="entry.duration>0" class="h-dot">&middot;</span>
            <span class="h-meta">{{ fmtDate(entry.created_at) }}</span>
            <span class="h-dot">&middot;</span>
            <span class="h-elapsed">{{ fmtElapsed(entry.elapsed_ms) }}</span>
          </div>
        </div>
        <div class="h-actions" @click.stop>
          <n-button size="tiny" text @click="openDetail(entry)"><template #icon><n-icon size="14"><EyeOutline /></n-icon></template></n-button>
          <n-popconfirm @positive-click="doDelete(entry)">
            <template #trigger><n-button size="tiny" text type="error"><template #icon><n-icon size="14"><TrashOutline /></n-icon></template></n-button></template>
            确认删除此记录？
          </n-popconfirm>
        </div>
      </div>
    </div>

    <div class="history-empty" v-else-if="!loading">
      <div class="empty-icon"><n-icon :size="32"><DocumentTextOutline /></n-icon></div>
      <div class="empty-title">{{ search ? "未找到匹配记录" : "暂无历史记录" }}</div>
      <div class="empty-desc">{{ search ? "试试换个关键词" : "处理视频后会自动保存在这里" }}</div>
    </div>

    <div class="history-pagination" v-if="data&&data.total_pages>1">
      <n-pagination :page="page" :page-count="data.total_pages" @update:page="(p:number)=>page=p" size="small" />
    </div>

    <n-drawer v-model:show="detailDrawer" width="720">
      <n-drawer-content closable>
        <template #header><span style="font-size:15px;font-weight:600;">{{ detailEntry?.title??'详情' }}</span></template>
        <div v-if="detailLoading" style="text-align:center;padding:60px;"><n-text depth="3">加载中...</n-text></div>
        <div v-else-if="detailResult&&detailEntry" class="detail-scroll">
          <div class="detail-meta">
            <span class="meta-badge" :style="{background:sourceColor[detailEntry.source]||'var(--color-text-secondary)'}">{{ sourceLabel[detailEntry.source]||detailEntry.source }}</span>
            <span v-if="detailResult.video_info?.uploader">{{ detailResult.video_info.uploader }}</span>
            <span v-if="detailResult.video_info?.duration">{{ fmtDur(detailResult.video_info.duration) }}</span>
            <span>{{ fmtDate(detailEntry.created_at) }}</span>
            <span>耗时 {{ fmtElapsed(detailEntry.elapsed_ms) }}</span>
            <a v-if="detailEntry.url&&detailEntry.source!=='local'" :href="detailEntry.url" target="_blank" class="detail-link">{{ detailEntry.bvid||detailEntry.url }}</a>
          </div>
          <n-space style="margin:10px 0 0;">
            <n-button size="small" @click="copyDetail"><template #icon><n-icon><CopyOutline /></n-icon></template>复制</n-button>
            <n-button size="small" @click="exportDetail"><template #icon><n-icon><DownloadOutline /></n-icon></template>导出</n-button>
          </n-space>
          <n-divider />
          <div class="md-preview" v-html="renderMarkdown(aiContent)" />
        </div>
        <n-text depth="3" v-else style="display:block;text-align:center;padding:60px;">该记录无结果数据</n-text>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<style scoped>
.history-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg);
}
.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.title-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
}
.history-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  flex-shrink: 0;
  max-width: 960px;
  width: 100%;
  margin: 0 auto;
}
.total-text {
  font-size: 12px;
}
.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 960px;
  width: 100%;
  margin: 0 auto;
}
.history-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding-bottom: 80px;
}
.empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  background: var(--color-accent-purple-soft);
  color: var(--color-accent-purple);
  margin-bottom: 4px;
}
.empty-title {
  font-size: 16px;
  font-weight: 650;
}
.empty-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
}
.history-pagination {
  display: flex;
  justify-content: center;
  padding: 12px 0 20px;
  flex-shrink: 0;
}

.h-entry {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--color-surface);
  border-radius: 14px;
  border: 1px solid var(--color-border);
  border-left: 4px solid transparent;
  cursor: pointer;
  padding: 12px 14px;
  box-shadow: var(--shadow-sm);
  transition: transform 0.18s var(--ease-out), border-color 0.15s, box-shadow 0.18s;
}
.h-entry:hover {
  transform: translateY(-1px);
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-hover);
}
.h-entry.h-done {
  border-left-color: var(--color-success);
}
.h-entry.h-err {
  border-left-color: var(--color-error);
}

.h-thumb {
  width: 120px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
.h-cover {
  width: 108px;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: 10px;
  background: var(--color-bg);
}
.h-cover-fb {
  width: 108px;
  aspect-ratio: 16 / 9;
  border-radius: 10px;
  background: var(--color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
}

.h-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  padding: 0 8px;
}
.h-line1 {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.h-title {
  font-size: 14px;
  font-weight: 650;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
  line-height: 1.35;
}
.h-badge {
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  padding: 2px 8px;
  border-radius: 999px;
  flex-shrink: 0;
  white-space: nowrap;
  line-height: 1.4;
}
.h-line2 {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.h-meta {
  color: var(--color-text-secondary);
}
.h-dot {
  color: var(--color-border-strong);
  font-weight: 600;
}
.h-elapsed {
  font-size: 11px;
  color: var(--color-success);
  font-weight: 600;
}

.h-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 2px;
  padding-left: 8px;
  opacity: 0.7;
}
.h-entry:hover .h-actions {
  opacity: 1;
}

.detail-scroll {
  overflow-y: auto;
}
.detail-meta {
  display: flex;
  gap: 14px;
  font-size: 12px;
  color: var(--color-text-secondary);
  flex-wrap: wrap;
  align-items: center;
}
.meta-badge {
  font-size: 11px;
  color: #fff;
  padding: 2px 10px;
  border-radius: 999px;
}
.detail-link {
  color: var(--color-text-secondary);
  text-decoration: none;
  word-break: break-all;
  font-size: 12px;
}
.detail-link:hover {
  color: var(--color-brand);
}

.md-preview {
  line-height: 1.85;
  color: var(--color-text);
  font-size: 14.5px;
  padding: 4px 0 12px;
}
.md-preview :deep(h1) {
  font-size: 22px;
  margin: 18px 0 10px;
  color: var(--color-text);
  letter-spacing: -0.02em;
}
.md-preview :deep(h2) {
  font-size: 17px;
  margin: 16px 0 8px;
  color: var(--color-text);
}
.md-preview :deep(h3) {
  font-size: 15px;
  margin: 12px 0 6px;
  color: var(--color-text);
}
.md-preview :deep(p) {
  margin: 8px 0;
}
.md-preview :deep(strong) {
  color: var(--color-brand);
}
.md-preview :deep(code) {
  background: var(--color-bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}
.md-preview :deep(li) {
  margin-left: 22px;
  margin-bottom: 4px;
}
.md-preview :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 16px 0;
}
</style>


