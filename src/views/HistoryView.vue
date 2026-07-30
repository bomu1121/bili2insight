<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import { NButton, NText, NIcon, NInput, NPagination, NDrawer, NDrawerContent, NSpace, NDivider, NPopconfirm, NModal, createDiscreteApi } from "naive-ui";
import { ArrowBackOutline, TrashOutline, EyeOutline, SearchOutline, RefreshOutline, CopyOutline, DownloadOutline, TimeOutline, DocumentTextOutline, Star, StarOutline, BeakerOutline, FlashOutline, CheckmarkDoneOutline } from "@vicons/ionicons5";
import { useRouter } from "vue-router";
import { useTemplateStore } from "../stores/templates";
import { useAppStore } from "../stores/app";
import { fetchHistoryList, getHistoryResult, deleteHistoryItem, clearHistory, toggleHistoryStar, historyGetAnalyses, historyGetAnalysisResult, historyRerunAi } from "../utils/invoke";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { HistoryEntry, HistoryListResult, PipelineResult, AnalysisMeta } from "../utils/types";

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
const analyses = ref<AnalysisMeta[]>([]);
const selectedAnalysisId = ref("0");
const analysisLoading = ref(false);
const rerunShow = ref(false);
const rerunLoading = ref(false);
const rerunTemplateIndex = ref(0);

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
async function doClearAll() { try { const count = await clearHistory(); load(); message.success(count > 0 ? "已清除" + count + "条记录，星标置顶已保留" : "无可清除记录"); } catch(e:any){ message.error("清除失败: "+String(e)); } }

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
    <div class="history-header">
      <div class="header-left">
        <n-button text class="bar-back" @click="router.push('/')"><template #icon><n-icon><ArrowLeft /></n-icon></template>返回</n-button>
        <div class="title-wrap">
          <span class="bar-ic history"><n-icon :size="15"><Clock /></n-icon></span>
          <n-text strong>历史记录</n-text>
        </div>
      </div>
      <n-space :size="8">
        <n-button size="small" @click="load()" :loading="loading"><template #icon><n-icon><RotateCw /></n-icon></template></n-button>
        <n-popconfirm @positive-click="doClearAll">
          <template #trigger><n-button size="small" type="error" secondary :disabled="!data||data.total===0">清空全部</n-button></template>
          确认清除全部？星标置顶的记录会保留。
        </n-popconfirm>
      </n-space>
    </div>

    <div class="history-bar">
      <n-input v-model:value="search" placeholder="搜索标题、UP主、BV号..." size="small" clearable round style="width:320px;">
        <template #prefix><n-icon><Search /></n-icon></template>
      </n-input>
      <n-text depth="3" class="total-text tnum" v-if="data&&!loading">共 {{ data.total }} 条</n-text>
    </div>

    <div class="history-list" v-if="data&&data.entries.length>0">
      <div v-for="entry in data.entries" :key="entry.id"
        class="h-entry" :class="{'h-done':entry.status==='done','h-err':entry.status==='error'}"
        @click="openDetail(entry)">
        <div class="h-thumb">
          <img v-if="entry.cover" :src="entry.cover+'@160w_100h_1c'" class="h-cover" referrerpolicy="no-referrer" />
          <div v-else class="h-cover-fb"><n-icon size="20" color="var(--color-text-tertiary)"><Eye /></n-icon></div>
        </div>
        <div class="h-body">
          <div class="h-line1">
            <span class="h-title">{{ entry.title }}</span>
          </div>
          <div class="h-line2">
            <span class="h-badge" :style="badgeStyle(entry.source)">{{ sourceLabel[entry.source]||entry.source }}</span>
            <span class="h-dot">&middot;</span>
            <span v-if="entry.uploader" class="h-meta">{{ entry.uploader }}</span>
            <span v-if="entry.uploader" class="h-dot">&middot;</span>
            <span v-if="entry.duration>0" class="h-meta tnum">{{ fmtDur(entry.duration) }}</span>
            <span v-if="entry.duration>0" class="h-dot">&middot;</span>
            <span class="h-meta">{{ fmtDate(entry.created_at) }}</span>
            <span class="h-dot">&middot;</span>
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
          <n-button size="tiny" text @click="openDetail(entry)"><template #icon><n-icon size="14"><Eye /></n-icon></template></n-button>
          <n-popconfirm @positive-click="doDelete(entry)">
            <template #trigger><n-button size="tiny" text type="error"><template #icon><n-icon size="14"><Trash2 /></n-icon></template></n-button></template>
            确认删除此记录？
          </n-popconfirm>
        </div>
      </div>
    </div>

    <div class="history-empty" v-else-if="!loading">
      <div class="empty-icon"><n-icon :size="30"><FileText /></n-icon></div>
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
            <span class="meta-badge" :style="badgeStyle(detailEntry.source)">{{ sourceLabel[detailEntry.source]||detailEntry.source }}</span>
            <span v-if="detailResult.video_info?.uploader">{{ detailResult.video_info.uploader }}</span>
            <span v-if="detailResult.video_info?.duration" class="tnum">{{ fmtDur(detailResult.video_info.duration) }}</span>
            <span>{{ fmtDate(detailEntry.created_at) }}</span>
            <span class="tnum">耗时 {{ fmtElapsed(detailEntry.elapsed_ms) }}</span>
            <a v-if="detailEntry.url&&detailEntry.source!=='local'" :href="detailEntry.url" target="_blank" class="detail-link">{{ detailEntry.bvid||detailEntry.url }}</a>
          </div>
          <n-space style="margin:10px 0 0;">
            <n-button size="small" @click="copyDetail"><template #icon><n-icon><Copy /></n-icon></template>复制</n-button>
            <n-button size="small" @click="exportDetail"><template #icon><n-icon><Download /></n-icon></template>导出</n-button>
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
          <n-divider style="margin:12px 0;" />
          <div v-if="analysisLoading" style="text-align:center;padding:30px;"><n-text depth="3">加载中...</n-text></div>
          <div v-else class="md-preview" v-html="renderMarkdown(aiContent)" />
        </div>
        <n-text depth="3" v-else style="display:block;text-align:center;padding:60px;">该记录无结果数据</n-text>
      </n-drawer-content>
    </n-drawer>

    <n-modal v-model:show="rerunShow" preset="card" title="选择提示词模板重新分析" style="width:480px;">
      <n-space vertical :size="12">
        <n-text depth="2">将使用原始转写文本重新运行 AI 分析，原分析结果会保留。</n-text>
        <div v-for="(tpl, idx) in useTemplateStore().allTemplates" :key="idx" class="rerun-tpl-item" :class="{selected:rerunTemplateIndex===idx}" @click="rerunTemplateIndex=idx">
          <n-icon size="14" :color="rerunTemplateIndex===idx?'var(--color-brand)':'var(--color-text-tertiary)'">
            <BeakerOutline v-if="rerunTemplateIndex!==idx" /><CheckmarkDoneOutline v-else />
          </n-icon>
          <span>{{ tpl.name }}</span>
        </div>
      </n-space>
      <template #footer>
        <n-space justify="end">
          <n-button @click="rerunShow=false">取消</n-button>
          <n-button type="primary" @click="doRerun()" :loading="rerunLoading">
            <template #icon><n-icon><FlashOutline /></n-icon></template>
            开始分析
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.history-root{display:flex;flex-direction:column;height:100%;background:var(--color-bg);overflow-y:auto;scrollbar-gutter:stable}
.history-header{display:flex;align-items:center;justify-content:space-between;height:var(--header-height);padding:0 20px;background:var(--color-surface);border-bottom:1px solid var(--color-border);flex-shrink:0;position:sticky;top:0;z-index:5}
.bar-back{color:var(--color-text-secondary)}
.header-left{display:flex;align-items:center;gap:10px}
.title-wrap{display:inline-flex;align-items:center;gap:9px;font-size:15px}
.bar-ic{width:26px;height:26px;border-radius:7px;display:grid;place-items:center}
.bar-ic.history{background:var(--color-accent-indigo-soft);color:var(--color-accent-indigo)}
.history-bar{display:flex;align-items:center;justify-content:space-between;padding:18px 24px 12px;flex-shrink:0;position:sticky;top:52px;z-index:4;background:var(--color-bg);max-width:var(--content-max-wide);width:100%;margin:0 auto}
.total-text{font-size:12px;font-family:var(--font-mono)}
.history-list{flex:1;overflow-y:auto;padding:2px 24px 20px;display:flex;flex-direction:column;gap:8px;max-width:var(--content-max-wide);width:100%;margin:0 auto}
.history-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding-bottom:80px;animation:empty-enter 0.4s ease-out both}
.empty-icon{width:60px;height:60px;border-radius:16px;display:grid;place-items:center;background:var(--color-accent-indigo-soft);color:var(--color-accent-indigo);margin-bottom:4px}
.empty-title{font-size:16px;font-weight:650}
.empty-desc{font-size:13px;color:var(--color-text-secondary)}
.history-pagination{display:flex;justify-content:center;padding:12px 0 20px;flex-shrink:0}
.h-entry{position:relative;display:flex;align-items:center;gap:4px;background:var(--color-surface);border-radius:var(--radius-lg);border:1px solid var(--color-border);cursor:pointer;padding:12px 14px 12px 18px;box-shadow:var(--shadow-xs);transition:border-color var(--dur-1),box-shadow var(--dur-2),transform var(--dur-2) var(--ease-out)}
.h-entry::before{content:"";position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:0 2px 2px 0;background:transparent;transition:background var(--dur-2),box-shadow var(--dur-2)}
.h-entry:hover{transform:translateY(-1px);border-color:var(--color-border-strong);box-shadow:var(--shadow-card)}
.h-entry.h-done{border-color:var(--color-success-border)}
.h-entry.h-done::before{background:var(--color-success)}
.h-entry.h-err{border-color:var(--color-error-border)}
.h-entry.h-err::before{background:var(--color-error)}
.h-thumb{width:112px;flex-shrink:0;display:flex;align-items:center}
.h-cover{width:104px;aspect-ratio:16/9;object-fit:cover;border-radius:var(--radius-md);background:var(--color-surface-muted)}
.h-cover-fb{width:104px;aspect-ratio:16/9;border-radius:var(--radius-md);background:var(--color-surface-muted);border:1px solid var(--color-border);display:flex;align-items:center;justify-content:center}
.h-body{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:6px;padding:0 10px}
.h-line1{display:flex;align-items:baseline;gap:8px;min-width:0}
.h-title{font-size:14px;font-weight:650;color:var(--color-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;line-height:1.35}
.h-badge{font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:var(--radius-full);flex-shrink:0;white-space:nowrap;line-height:1.5}
.h-line2{display:flex;align-items:center;gap:6px;font-size:12px}
.h-meta{color:var(--color-text-secondary)}
.h-dot{color:var(--color-border-strong);font-weight:600}
.h-elapsed{font-size:11px;color:var(--color-success);font-weight:600;font-family:var(--font-mono)}
.h-actions{flex-shrink:0;display:flex;align-items:center;gap:2px;padding-left:8px;opacity:.6}
.h-entry:hover .h-actions{opacity:1}
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
.rerun-tpl-item{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:var(--radius-md);border:1px solid var(--color-border);cursor:pointer;transition:all var(--dur-1);font-size:13px}
.rerun-tpl-item:hover{border-color:var(--color-brand);background:var(--color-brand-soft)}
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
</style>
