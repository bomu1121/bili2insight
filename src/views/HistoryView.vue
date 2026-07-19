<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import { NButton, NText, NIcon, NInput, NPagination, NDrawer, NDrawerContent, NSpace, NDivider, NPopconfirm, createDiscreteApi } from "naive-ui";
import { ArrowBackOutline, TrashOutline, EyeOutline, SearchOutline, RefreshOutline, CopyOutline, DownloadOutline, CheckmarkCircle, CloseCircle } from "@vicons/ionicons5";
import { useRouter } from "vue-router";
import { fetchHistoryList, getHistoryResult, deleteHistoryItem, clearHistory } from "../utils/invoke";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
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

function renderMarkdown(text: string) {
  let h = text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/^- (.+)$/gm,'<li>$1</li>').replace(/^(\d+)\. (.+)$/gm,'<li>$2</li>')
    .replace(/^---$/gm,'<hr>').replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>');
  return '<p>'+h+'</p>';
}

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
const sourceColor: Record<string,string>={url:"#00aeec",fav:"#f0a020",local:"#18a058"};
</script>

<template>
  <div class="history-root">
    <div class="history-header">
      <n-button text @click="router.push('/')"><template #icon><n-icon><ArrowBackOutline /></n-icon></template>返回</n-button>
      <n-text strong style="font-size:16px;">历史记录</n-text>
      <n-space :size="8">
        <n-button size="small" @click="load()" :loading="loading"><template #icon><n-icon><RefreshOutline /></n-icon></template></n-button>
        <n-button size="small" type="error" secondary @click="doClearAll" :disabled="!data||data.total===0">清空全部</n-button>
      </n-space>
    </div>

    <div class="history-bar">
      <n-input v-model:value="search" placeholder="搜索标题、UP主、BV号..." size="small" clearable style="width:300px;">
        <template #prefix><n-icon><SearchOutline /></n-icon></template>
      </n-input>
      <n-text depth="3" style="font-size:12px;" v-if="data&&!loading">共 {{ data.total }} 条</n-text>
    </div>

    <div class="history-list" v-if="data&&data.entries.length>0">
      <div v-for="entry in data.entries" :key="entry.id"
        class="h-entry" :class="{'h-done':entry.status==='done','h-err':entry.status==='error'}"
        @click="openDetail(entry)">
        <div class="h-thumb">
          <img v-if="entry.cover" :src="entry.cover+'@160w_100h_1c'" class="h-cover" referrerpolicy="no-referrer" />
          <div v-else class="h-cover-fb"><n-icon size="22" color="#bbb"><EyeOutline /></n-icon></div>
        </div>
        <div class="h-body">
          <div class="h-line1">
            <span class="h-title">{{ entry.title }}</span>
            <span class="h-badge" :style="{background:sourceColor[entry.source]||'#999'}">{{ sourceLabel[entry.source]||entry.source }}</span>
          </div>
          <div class="h-line2">
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
      <n-text depth="3">{{ search?"未找到匹配的记录":"暂无历史记录，处理视频后自动保存" }}</n-text>
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
            <span class="meta-badge" :style="{background:sourceColor[detailEntry.source]||'#999'}">{{ sourceLabel[detailEntry.source]||detailEntry.source }}</span>
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
.history-root{display:flex;flex-direction:column;height:100%;background:#f5f5f5;}
.history-header{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;background:#fff;border-bottom:1px solid #eee;flex-shrink:0;}
.history-bar{display:flex;align-items:center;justify-content:space-between;padding:14px 20px 10px;flex-shrink:0;}
.history-list{flex:1;overflow-y:auto;padding:4px 20px 12px;display:flex;flex-direction:column;gap:8px;}
.history-empty{flex:1;display:flex;align-items:center;justify-content:center;padding-bottom:80px;}
.history-pagination{display:flex;justify-content:center;padding:12px 0 20px;flex-shrink:0;}

.h-entry{
  display:flex;align-items:center;gap:0;background:#fff;border-radius:10px;
  border:1px solid #eee;border-left:4px solid transparent;cursor:pointer;
  padding:10px 14px;
  transition:border-color .15s,box-shadow .15s;
}
.h-entry:hover{border-color:#ccc;box-shadow:0 2px 12px rgba(0,0,0,.05);}
.h-entry.h-done{border-left-color:#18a058;}
.h-entry.h-err{border-left-color:#d03050;}

.h-thumb{width:112px;flex-shrink:0;display:flex;align-items:center;}
.h-cover{width:100px;aspect-ratio:16/9;object-fit:cover;border-radius:6px;background:#f0f0f0;}
.h-cover-fb{width:100px;aspect-ratio:16/9;border-radius:6px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;}

.h-body{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:4px;}
.h-line1{display:flex;align-items:baseline;gap:8px;min-width:0;}
.h-title{font-size:14px;font-weight:600;color:#1a1a1a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;line-height:1.35;}
.h-badge{font-size:10px;font-weight:500;color:#fff;padding:2px 8px;border-radius:4px;flex-shrink:0;white-space:nowrap;line-height:1.4;}
.h-line2{display:flex;align-items:center;gap:6px;font-size:12px;}
.h-meta{color:#999;}
.h-dot{color:#ddd;font-weight:600;}
.h-elapsed{font-size:11px;color:#18a058;font-weight:500;}

.h-actions{flex-shrink:0;display:flex;align-items:center;gap:2px;padding-left:8px;}

.detail-scroll{overflow-y:auto;}
.detail-meta{display:flex;gap:14px;font-size:12px;color:#999;flex-wrap:wrap;align-items:center;}
.meta-badge{font-size:11px;color:#fff;padding:2px 10px;border-radius:10px;}
.detail-link{color:#888;text-decoration:none;word-break:break-all;font-size:12px;}
.detail-link:hover{color:#00aeec;}

.md-preview{line-height:1.8;color:#333;font-size:14px;padding:4px 0;}
.md-preview :deep(h1){font-size:20px;margin:14px 0 10px;color:#111;}
.md-preview :deep(h2){font-size:16px;margin:12px 0 8px;color:#222;}
.md-preview :deep(h3){font-size:14px;margin:10px 0 6px;color:#333;}
.md-preview :deep(p){margin:5px 0;}
.md-preview :deep(strong){color:#00aeec;}
.md-preview :deep(code){background:#f0f0f0;padding:2px 6px;border-radius:3px;font-size:13px;}
.md-preview :deep(li){margin-left:22px;}
.md-preview :deep(hr){border:none;border-top:1px solid #eee;margin:14px 0;}
</style>
