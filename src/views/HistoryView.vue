<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from "vue";
import { NButton, NText, NIcon, NInput, NPagination, NDrawer, NDrawerContent, NSpace, NDivider, NModal, createDiscreteApi } from "naive-ui";
import { TrashOutline, EyeOutline, SearchOutline, RefreshOutline, CopyOutline, DownloadOutline, TimeOutline, DocumentTextOutline, Star, StarOutline, BeakerOutline, FlashOutline, CheckmarkDoneOutline, FolderOpen } from "@vicons/ionicons5";
import { useTemplateStore } from "../stores/templates";
import { useAppStore } from "../stores/app";
import { useNotesStore } from "../stores/notes";
import { fetchHistoryList, getHistoryResult, deleteHistoryItem, clearHistory, toggleHistoryStar, historyGetAnalyses, historyGetAnalysisResult, historyRerunAi } from "../utils/invoke";
import DmailConfirm from "../components/DmailConfirm.vue";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { HistoryEntry, HistoryListResult, PipelineResult, AnalysisMeta } from "../utils/types";

const { message } = createDiscreteApi(["message"], { messageProviderProps: { placement: "bottom-right" } });

const loading = ref(false);
const refreshing = ref(false);
const refreshDone = ref(false);
const clearing = ref(false);
const clearShow = ref(false);
const deleteEntry = ref<HistoryEntry | null>(null);
const search = ref("");
const page = ref(1);
const pageSize = 30;
const data = ref<HistoryListResult | null>(null);

const detailDrawer = ref(false);
const detailEntry = ref<HistoryEntry | null>(null);
const detailResult = ref<PipelineResult | null>(null);
const detailLoading = ref(false);
const analyses = ref<AnalysisMeta[]>([]);
const selectedAnalysisId = ref("0");
const analysisLoading = ref(false);
const rerunShow = ref(false);
const rerunLoading = ref(false);
const rerunTemplateIndex = ref(0);
const sendToNoteShow = ref(false);
const sendToNoteFolderId = ref<string>("");
const sendToNoteNewFolder = ref("");
const sendToNoteFolders = ref<{id:string,title:string}[]>([]);
const sendToNoteLoading = ref(false);

async function openSendToNote() {
  sendToNoteShow.value = true;
  sendToNoteFolderId.value = "";
  sendToNoteNewFolder.value = "";
  sendToNoteLoading.value = true;
  try { sendToNoteFolders.value = await useNotesStore().loadFoldersAndReturn(); }
  catch(e:any) { message.error("加载文件夹失败: " + String(e)); }
  finally { sendToNoteLoading.value = false; }
}
async function doSendToNote() {
  if (!detailResult.value || !detailEntry.value) return;
  let folderId = sendToNoteFolderId.value;
  if (!folderId && sendToNoteNewFolder.value.trim()) {
    try { const folder = await useNotesStore().createFolder(sendToNoteNewFolder.value.trim()); folderId = folder.id; }
    catch(e:any) { message.error("创建文件夹失败: " + String(e)); return; }
  }
  if (!folderId) { message.warning("请选择或创建文件夹"); return; }
  try {
    const title = detailEntry.value.title || "未命名笔记";
    const content = aiContent.value || "";
    await useNotesStore().createNote(folderId, title, content);
    message.success("已发送到笔记");
    sendToNoteShow.value = false;
  } catch(e:any) { message.error("发送失败: " + String(e)); }
}

let loadToken = 0;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

async function load(opts: { fromRefresh?: boolean } = {}) {
  const token = ++loadToken;
  loading.value = true;
  if (opts.fromRefresh) refreshing.value = true;
  try {
    const q = search.value.trim() || undefined;
    const result = await fetchHistoryList(page.value, pageSize, q);
    if (token !== loadToken) return;
    data.value = result;
    if (opts.fromRefresh) {
      refreshDone.value = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { refreshDone.value = false; }, 900);
    }
  }
  catch (e: any) {
    if (token === loadToken) message.error("加载失败: " + String(e));
  }
  finally {
    if (token === loadToken) {
      loading.value = false;
      refreshing.value = false;
    }
  }
}

function refresh() {
  if (loading.value || refreshing.value) return;
  refreshDone.value = false;
  if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
  load({ fromRefresh: true });
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (page.value !== 1) {
      page.value = 1;
    } else {
      load();
    }
  }, 300);
});
watch(page, () => load());
onMounted(() => load());
onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
  if (refreshTimer) clearTimeout(refreshTimer);
});

async function openDetail(entry: HistoryEntry) {
  detailEntry.value = entry; detailResult.value = null; detailDrawer.value = true; detailLoading.value = true;
  selectedAnalysisId.value = "0";
  try {
    detailResult.value = JSON.parse(await getHistoryResult(entry.id)) as PipelineResult;
    analyses.value = await historyGetAnalyses(entry.id);
  }
  catch (e: any) { message.error("加载详情失败: " + String(e)); }
  finally { detailLoading.value = false; }
}

async function switchAnalysis(analysisId: string) {
  if (!detailEntry.value || analysisLoading.value) return;
  selectedAnalysisId.value = analysisId;
  analysisLoading.value = true;
  try {
    detailResult.value = JSON.parse(await historyGetAnalysisResult(detailEntry.value.id, analysisId)) as PipelineResult;
  } catch (e: any) {
    message.error("加载分析结果失败: " + String(e));
  } finally { analysisLoading.value = false; }
}

async function doRerun() {
  if (!detailEntry.value || rerunLoading.value) return;
  rerunLoading.value = true;
  try {
    const templateStore = useTemplateStore();
    const appStore = useAppStore();
    const tpl = templateStore.resolvePrompt(rerunTemplateIndex.value);
    const tplName = templateStore.allTemplates[rerunTemplateIndex.value]?.name ?? "未知";
    const newId = await historyRerunAi(
      detailEntry.value.id,
      tpl,
      tplName,
      appStore.aiApiUrl,
      appStore.aiApiKey,
      appStore.aiModel
    );
    message.success("重新分析完成");
    analyses.value = await historyGetAnalyses(detailEntry.value.id);
    rerunShow.value = false;
    await switchAnalysis(newId);
  } catch (e: any) {
    message.error("重新分析失败: " + String(e));
  } finally { rerunLoading.value = false; }
}

function fmtAnalysisLabel(meta: AnalysisMeta, index: number): string {
  const name = meta.template_name || ("分析 #" + (index + 1));
  return name.length > 12 ? name.slice(0, 12) + "..." : name;
}

function fmtAnalysisDate(ts: number): string {
  const d = new Date(ts);
  return d.getMonth() + 1 + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
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
    .replace(/^---$/gm,'<hr>').replace(/\\n\\n/g,'</p><p>').replace(/\\n/g,'<br>');
  return '<p>'+h+'</p>';
}

async function copyDetail() {
  if (!detailResult.value || !detailEntry.value) return;
  try { await writeText("《" + detailEntry.value.title + "》" + detailEntry.value.url + "\n\n" + aiContent.value); message.success("已复制"); }
  catch (e: any) { message.error("复制失败: " + String(e)); }
}

async function exportDetail() {
  if (!detailResult.value || !detailEntry.value) return;
  try {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path_to_save = await save({ filters:[{name:"Markdown",extensions:["md"]}], defaultPath:detailEntry.value.title + ".md" });
    if (path_to_save) { const { invoke } = await import("@tauri-apps/api/core"); await invoke("save_result_to_file",{result:detailResult.value,outputPath:path_to_save}); message.success("导出成功"); }
  } catch(e:any){ message.error("导出失败: "+String(e)); }
}

async function doDelete(entry: HistoryEntry) { try { await deleteHistoryItem(entry.id); load(); } catch(e:any){ message.error("删除失败: "+String(e)); } }
async function toggleStar(entry: HistoryEntry) { try { const newVal = await toggleHistoryStar(entry.id); entry.starred = newVal; } catch(e:any){ message.error("操作失败: "+String(e)); } }
async function doClearAll() {
  clearing.value = true;
  try {
    const count = await clearHistory();
    if (count > 0) {
      load();
      message.success("已清除" + count + "条记录，星标置顶已保留");
    } else {
      message.info("所有记录已星标置顶，无需清除");
    }
  } catch(e: any) {
    message.error("清除失败: " + String(e));
  } finally {
    clearing.value = false;
    clearShow.value = false;
  }
}

const deleteMessage = computed(() => deleteEntry.value ? `确认删除《${deleteEntry.value.title}》？删除后无法恢复。` : "");

async function confirmDelete() {
  const entry = deleteEntry.value;
  if (!entry) return;
  deleteEntry.value = null;
  await doDelete(entry);
}

function fmtDate(ts: number) {
  const d = new Date(ts), now = new Date(), diffH = (now.getTime()-ts)/3600000;
  if (diffH<1) return Math.max(1,Math.floor((now.getTime()-ts)/60000))+"分钟前";
  if (diffH<24) return Math.floor(diffH)+"小时前";
  if (diffH<48) return "昨天"; if (diffH<168) return Math.floor(diffH/24)+"天前";
  const p=(n:number)=>String(n).padStart(2,"0"); return d.getFullYear()+"-" + p(d.getMonth()+1)+"-"+p(d.getDate());
}

function fmtDur(sec: number) {
  if(sec<=0) return ""; const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
  return h>0?String(h).padStart(2,"0")+":"+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0"):String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
}

function fmtElapsed(ms: number) {
  if(ms<1000) return ms+"ms"; if(ms<60000) return (ms/1000).toFixed(1)+"s";
  const m=Math.floor(ms/60000),s=Math.round((ms%60000)/1000); return m+"m"+s+"s";
}

const sourceLabel: Record<string,string>={url:"B站",fav:"收藏",local:"本地"};
const sourceTheme: Record<string,{bg:string;color:string}>={
  url: { bg: "var(--color-brand-soft)", color: "var(--color-brand-pressed)" },
  fav: { bg: "var(--color-accent-pink-soft)", color: "var(--color-accent-pink)" },
  local: { bg: "var(--color-success-soft)", color: "var(--color-success)" },
};
const fallbackTheme = { bg: "var(--color-ink-soft)", color: "var(--color-text-secondary)" };
function badgeStyle(source: string) {
  const t = sourceTheme[source] ?? fallbackTheme;
  return { background: t.bg, color: t.color };
}
</script>

<template>
  <div class="history-root">
    <div class="history-inner">
      <div class="history-header">
        <div class="header-left">
          <span class="bar-ic history"><n-icon :size="15"><TimeOutline /></n-icon></span>
          <n-text strong class="page-title">历史记录</n-text>
        </div>
        <n-space :size="8">
          <n-button
            class="refresh-btn"
            :class="{ refreshing, done: refreshDone }"
            size="small"
            :disabled="loading || refreshing"
            :title="refreshing ? '刷新中...' : '刷新'"
            @click="refresh"
          >
            <template #icon>
              <n-icon :size="14" class="refresh-icon">
                <RefreshOutline v-if="!refreshDone" />
                <CheckmarkDoneOutline v-else />
              </n-icon>
            </template>
            刷新
          </n-button>
          <n-button size="small" type="error" secondary :disabled="!data||data.total===0" :loading="clearing" @click="clearShow = true">清空全部</n-button>
        </n-space>
      </div>

      <div class="history-bar">
        <n-input v-model:value="search" placeholder="搜索标题、UP主、BV号..." size="small" clearable class="history-search">
          <template #prefix><n-icon><SearchOutline /></n-icon></template>
        </n-input>
        <span class="total-text tnum" v-if="data&&!loading">共 {{ data.total }} 条</span>
      </div>

      <div class="history-list" v-if="data&&data.entries.length>0">
        <div v-for="entry in data.entries" :key="entry.id"
          class="h-card"
          :class="'src-'+entry.source"
          @click="openDetail(entry)">
          <div class="h-thumb">
            <img v-if="entry.cover" :src="entry.cover+'@320w_180h_1c'" class="h-cover" referrerpolicy="no-referrer" />
            <div v-else class="h-cover-fb"><n-icon size="18" color="var(--color-text-tertiary)"><EyeOutline /></n-icon></div>
          </div>
          <div class="h-body">
            <div class="h-title">{{ entry.title }}</div>
            <div class="h-meta-row">
              <span class="h-badge" :style="badgeStyle(entry.source)">{{ sourceLabel[entry.source]||entry.source }}</span>
              <span class="h-meta-dot">&middot;</span>
              <span class="h-meta-text">{{ fmtDate(entry.created_at) }}</span>
              <span class="h-elapsed tnum">{{ fmtElapsed(entry.elapsed_ms) }}</span>
            </div>
          </div>
          <div class="h-actions" @click.stop>
            <n-button size="tiny" text @click="toggleStar(entry)" :title="entry.starred ? '取消置顶' : '置顶星标'">
              <template #icon>
                <n-icon size="14" :color="entry.starred ? 'var(--color-warning)' : 'var(--color-text-tertiary)'">
                  <Star v-if="entry.starred" />
                  <StarOutline v-else />
                </n-icon>
              </template>
            </n-button>
            <n-button size="tiny" text @click="openDetail(entry)"><template #icon><n-icon size="14"><EyeOutline /></n-icon></template></n-button>
            <n-button size="tiny" text type="error" @click="deleteEntry = entry"><template #icon><n-icon size="14"><TrashOutline /></n-icon></template></n-button>
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
    </div>

    <n-drawer v-model:show="detailDrawer" width="720">
      <n-drawer-content closable>
        <template #header><span style="font-size:15px;font-weight:600;">{{ detailEntry?.title??'详情' }}</span></template>
        <div v-if="detailLoading" style="text-align:center;padding:60px;"><n-text depth="3">加载中...</n-text></div>
        <div v-else-if="detailResult&&detailEntry" class="detail-scroll">
          <div class="detail-meta">
            <span class="meta-badge" :style="badgeStyle(detailEntry.source)">{{ sourceLabel[detailEntry.source]||detailEntry.source }}</span>
            <span v-if="detailResult.video_info?.uploader">{{ detailResult.video_info.uploader }}</span>
            <span v-if="detailResult.video_info?.duration" class="tnum">{{ fmtDur(detailResult.video_info.duration) }}</span>
            <span>{{ fmtDate(detailEntry.created_at) }}</span>
            <span class="tnum">耗时 {{ fmtElapsed(detailEntry.elapsed_ms) }}</span>
            <a v-if="detailEntry.url&&detailEntry.source!=='local'" :href="detailEntry.url" target="_blank" class="detail-link">{{ detailEntry.bvid||detailEntry.url }}</a>
          </div>
          <n-space style="margin:10px 0 0;">
            <n-button size="small" @click="copyDetail"><template #icon><n-icon><CopyOutline /></n-icon></template>复制</n-button>
            <n-button size="small" @click="exportDetail"><template #icon><n-icon><DownloadOutline /></n-icon></template>导出</n-button>
            <n-button size="small" type="primary" @click="openSendToNote" ghost><template #icon><n-icon><DocumentTextOutline /></n-icon></template>发送到笔记</n-button>
          </n-space>
          <div class="analysis-tabs" v-if="analyses.length>0">
            <div class="analysis-tabs-inner">
              <button
                v-for="(meta, idx) in analyses" :key="meta.id"
                class="analysis-tab"
                :class="{ active: selectedAnalysisId===meta.id }"
                @click="switchAnalysis(meta.id)"
                :title="meta.template_name + ' · ' + fmtAnalysisDate(meta.created_at)"
              >
                <n-icon size="13" :color="selectedAnalysisId===meta.id ? 'var(--color-brand)' : 'var(--color-text-tertiary)'">
                  <BeakerOutline />
                </n-icon>
                <span class="analysis-tab-label">{{ fmtAnalysisLabel(meta, idx) }}</span>
              </button>
              <n-button size="tiny" text style="margin-left:4px;flex-shrink:0;" @click="rerunShow=true" title="换提示词重新分析">
                <template #icon><n-icon size="13" color="var(--color-brand)"><FlashOutline /></n-icon></template>
              </n-button>
            </div>
          </div>
          <div v-if="analysisLoading" style="text-align:center;padding:30px;"><n-text depth="3">加载中...</n-text></div>
          <div v-else class="md-preview" v-html="renderMarkdown(aiContent)" />
        </div>
        <n-text depth="3" v-else style="display:block;text-align:center;padding:60px;">该记录无结果数据</n-text>
      </n-drawer-content>
    </n-drawer>

    
    <n-modal v-model:show="sendToNoteShow" preset="card" title="发送到笔记" style="width:420px;">
      <n-space vertical :size="12">
        <n-text depth="2">将 AI 分析结果保存到笔记文件夹</n-text>
        <div v-if="sendToNoteLoading" style="text-align:center;padding:20px;"><n-text depth="3">加载中...</n-text></div>
        <template v-else>
          <div v-if="sendToNoteFolders.length > 0" style="max-height:180px;overflow-y:auto;">
            <div v-for="f in sendToNoteFolders" :key="f.id" class="stn-folder-item" :class="{selected:sendToNoteFolderId===f.id}" @click="sendToNoteFolderId=f.id;sendToNoteNewFolder=''">
              <n-icon size="14" :color="sendToNoteFolderId===f.id?'var(--color-brand)':'var(--color-text-tertiary)'"><FolderOpen /></n-icon>
              <span>{{ f.title }}</span>
            </div>
          </div>
          <n-divider style="margin:8px 0;">或创建新文件夹</n-divider>
          <n-input v-model:value="sendToNoteNewFolder" placeholder="新文件夹名称" size="small" @focus="sendToNoteFolderId=''" />
        </template>
      </n-space>
      <template #footer>
        <n-space justify="end">
          <n-button @click="sendToNoteShow=false">取消</n-button>
          <n-button type="primary" @click="doSendToNote" :disabled="!sendToNoteFolderId && !sendToNoteNewFolder.trim()">发送</n-button>
        </n-space>
      </template>
    </n-modal>

    <DmailConfirm
      :show="clearShow"
      severity="danger"
      message="确认清除全部历史记录？星标置顶的记录会保留。"
      confirm-text="清除"
      cancel-text="取消"
      :loading="clearing"
      loading-text="清除中..."
      @confirm="doClearAll"
      @cancel="clearShow = false"
    />
    <DmailConfirm
      :show="!!deleteEntry"
      severity="danger"
      :message="deleteMessage"
      confirm-text="删除"
      cancel-text="取消"
      @confirm="confirmDelete"
      @cancel="deleteEntry = null"
    />
    <DmailConfirm
      :show="rerunShow"
      severity="warning"
      message="将使用原始转写文本重新运行 AI 分析，原分析结果会保留。"
      confirm-text="开始分析"
      cancel-text="取消"
      :loading="rerunLoading"
      loading-text="分析中..."
      @confirm="doRerun"
      @cancel="rerunShow = false"
    >
      <template #extra>
        <div class="rerun-tpl-label">选择提示词模板</div>
        <div
          v-for="(tpl, idx) in useTemplateStore().allTemplates"
          :key="idx"
          class="rerun-tpl-item"
          :class="{selected:rerunTemplateIndex===idx}"
          tabindex="0"
          @click="rerunTemplateIndex=idx"
          @keydown.enter="rerunTemplateIndex=idx"
        >
          <n-icon size="14" :color="rerunTemplateIndex===idx?'var(--color-brand)':'var(--color-text-tertiary)'">
            <BeakerOutline v-if="rerunTemplateIndex!==idx" /><CheckmarkDoneOutline v-else />
          </n-icon>
          <span>{{ tpl.name }}</span>
        </div>
      </template>
    </DmailConfirm>
  </div>
</template>


<style scoped>
/* === History Page — QueueView root scroll + SourceFav toolbar === */
/* ref: QueueView — header scrolls with content, root owns the scrollbar */
/* ref: Linear — card grid with top color accent per category */

/* --- Root --- */
.history-root{height:100%;overflow-y:auto;overflow-x:hidden;scrollbar-gutter:stable;background:var(--color-bg)}
.history-inner{max-width:var(--content-max-wide);margin:0 auto;padding:28px 28px 40px;width:100%}

/* --- Header (ref: QueueView — bottom-border separator, scrolls with content) --- */
.history-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--color-border)}
.history-header .n-button{font-size:11px !important;padding:0 8px !important;min-width:unset !important}
.history-header .n-space{gap:5px !important;flex-wrap:nowrap !important}
.header-left{display:flex;align-items:center;gap:10px;min-width:0}
.bar-ic{width:26px;height:26px;border-radius:7px;display:grid;place-items:center;flex-shrink:0}
.bar-ic.history{background:var(--color-accent-indigo-soft);color:var(--color-accent-indigo)}
.page-title{font-size:var(--font-size-page);font-weight:700;letter-spacing:-0.01em}

/* --- Refresh micro-interaction --- */
.refresh-btn .refresh-icon{will-change:transform;transition:color var(--dur-2)}
.refresh-btn.refreshing .refresh-icon{animation:refresh-spin .9s linear infinite;color:var(--color-brand)}
.refresh-btn.done .refresh-icon{animation:refresh-done .45s var(--spring-bounce) both;color:var(--color-success)}
@keyframes refresh-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes refresh-done{
  0%{transform:scale(.5) rotate(-24deg);opacity:0}
  60%{transform:scale(1.22) rotate(8deg);opacity:1}
  100%{transform:scale(1) rotate(0);opacity:1}
}

/* --- Search Bar (ref: SourceFavView toolbar-row — compact, right-side meta) --- */
.history-bar{display:flex;align-items:center;gap:10px;padding:10px 0 14px;min-height:44px;border-bottom:1px solid var(--color-border);margin-bottom:4px}
.history-search{max-width:280px}
.total-text{font-size:12px;color:var(--color-text-secondary);margin-left:auto;flex-shrink:0}

/* --- Card Grid --- */
/* ref: Raycast history grid — responsive auto-fill columns */
.history-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(272px,1fr));gap:12px;align-content:start}

/* --- Card --- */
/* ref: Linear issue cards — surface bg, tight border, source-colored top accent */
.h-card{position:relative;overflow:hidden;display:flex;flex-direction:column;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-lg);cursor:pointer;transition:border-color var(--dur-2),box-shadow var(--dur-2);box-shadow:var(--shadow-xs)}
/* ref: QueueView — hover pattern: border-color + shadow, no translateY */
.h-card:hover{border-color:var(--color-border-strong);box-shadow:var(--shadow-sm)}
/* ref: Linear — category-color top accent bar (3px) */
.h-card::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;z-index:1;transition:opacity var(--dur-2)}
.h-card.src-url::before{background:var(--color-brand)}
.h-card.src-fav::before{background:var(--color-accent-pink)}
.h-card.src-local::before{background:var(--color-success)}
.h-card.src-history::before,.h-card.src-default::before{background:var(--color-accent-indigo)}
.h-card:hover::before{opacity:.85}

/* --- Thumbnail --- */
.h-thumb{position:relative;overflow:hidden}
.h-cover{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:var(--color-surface-muted)}
.h-cover-fb{width:100%;aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;background:var(--color-surface-muted)}

/* --- Body --- */
.h-body{flex:1;display:flex;flex-direction:column;gap:8px;padding:12px 14px 14px;min-width:0}
/* ref: Linear — two-line title clamp for readability */
.h-title{font-size:13.5px;font-weight:650;color:var(--color-text);line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.h-meta-row{display:flex;align-items:center;gap:6px;font-size:12px;flex-wrap:wrap;margin-top:auto}
.h-badge{font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:var(--radius-full);flex-shrink:0;white-space:nowrap;line-height:1.5}
.h-meta-dot{color:var(--color-border-strong);font-weight:600;font-size:10px}
.h-meta-text{color:var(--color-text-secondary)}
.h-elapsed{font-size:11px;color:var(--color-text-tertiary);font-weight:600;font-family:var(--font-mono);flex-shrink:0;margin-left:auto}

/* --- Actions (hover reveal, slides in without card movement) --- */
/* ref: Linear — action buttons appear on card hover */
.h-actions{position:absolute;top:6px;right:6px;z-index:2;display:flex;align-items:center;gap:2px;padding:2px 4px;background:var(--color-surface);border-radius:var(--radius-sm);border:1px solid var(--color-border);opacity:0;transform:translateY(-4px);transition:opacity var(--dur-2),transform var(--dur-2) var(--ease-out)}
.h-card:hover .h-actions{opacity:1;transform:translateY(0)}

/* --- Empty State --- */
.history-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:80px 0;animation:empty-enter .4s ease-out both}
.empty-icon{width:64px;height:64px;border-radius:16px;display:grid;place-items:center;background:var(--color-accent-indigo-soft);color:var(--color-accent-indigo);margin-bottom:4px}
.empty-title{font-size:16px;font-weight:650}
.empty-desc{font-size:13px;color:var(--color-text-secondary)}

/* --- Pagination --- */
.history-pagination{display:flex;justify-content:center;padding-top:20px}

/* --- Detail Drawer --- */
.detail-scroll{overflow-y:auto}
.detail-meta{display:flex;gap:14px;font-size:12px;color:var(--color-text-secondary);flex-wrap:wrap;align-items:center}
.meta-badge{font-size:11px;font-weight:600;padding:2px 10px;border-radius:var(--radius-full);font-family:var(--font-mono)}
.detail-link{color:var(--color-text-secondary);text-decoration:none;word-break:break-all;font-size:11.5px;font-family:var(--font-mono)}
.detail-link:hover{color:var(--color-brand)}
.analysis-tabs{margin-top:12px;padding:6px 0}
.analysis-tabs-inner{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.analysis-tab{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:var(--radius-full);border:1px solid var(--color-border);background:var(--color-surface);font-size:12px;color:var(--color-text-secondary);cursor:pointer;transition:all var(--dur-1);white-space:nowrap}
.analysis-tab:hover{border-color:var(--color-brand);color:var(--color-brand)}
.analysis-tab.active{background:var(--color-brand-soft);border-color:var(--color-brand);color:var(--color-brand);font-weight:600}
.analysis-tab-label{max-width:100px;overflow:hidden;text-overflow:ellipsis}
.rerun-tpl-label{font-family:var(--font-mono);font-size:11px;font-weight:700;color:var(--color-text-tertiary);letter-spacing:0.05em;margin-bottom:8px}
.rerun-tpl-item{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:var(--radius-md);border:1px solid var(--color-border);cursor:pointer;transition:all var(--dur-1);font-size:13px}
.rerun-tpl-item:hover{border-color:var(--color-brand);background:var(--color-brand-soft)}
.rerun-tpl-item:focus-visible{outline:2px solid var(--color-brand-border);outline-offset:1px}
.rerun-tpl-item.selected{border-color:var(--color-brand);background:var(--color-brand-soft);font-weight:600;color:var(--color-text)}
.md-preview{line-height:var(--line-height-loose);color:var(--color-text);font-size:14.5px;padding:4px 0 12px}
.md-preview :deep(h1){font-size:21px;margin:18px 0 10px;color:var(--color-text);letter-spacing:-.01em}
.md-preview :deep(h2){font-size:16.5px;margin:20px 0 8px;padding-left:10px;border-left:3px solid var(--color-brand);color:var(--color-text);line-height:1.4}
.md-preview :deep(h3){font-size:15px;margin:14px 0 6px;color:var(--color-text)}
.md-preview :deep(p){margin:8px 0}
.md-preview :deep(strong){color:var(--color-brand-pressed);font-weight:700}
.md-preview :deep(code){background:var(--color-surface-muted);border:1px solid var(--color-border);padding:1px 6px;border-radius:var(--radius-xs);font-size:12.5px;font-family:var(--font-mono)}
.md-preview :deep(li){margin-left:22px;margin-bottom:4px}
.md-preview :deep(hr){border:none;border-top:1px solid var(--color-border);margin:18px 0}

.stn-folder-item{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:var(--radius-md);border:1px solid var(--color-border);cursor:pointer;transition:all var(--dur-1);font-size:13px}
.stn-folder-item:hover{border-color:var(--color-brand);background:var(--color-brand-soft)}
.stn-folder-item.selected{border-color:var(--color-brand);background:var(--color-brand-soft);font-weight:600;color:var(--color-text)}

</style>
