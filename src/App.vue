<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed } from "vue";
import { NInput, NButton, NSpace, NProgress, NText, NIcon, createDiscreteApi, NDrawer, NDrawerContent, NSelect, NDivider, NCheckbox } from "naive-ui";
import { PlayOutline, DownloadOutline, CopyOutline, SettingsSharp, VideocamOutline, DocumentTextOutline, CheckmarkCircle, CloseCircle, SyncOutline } from "@vicons/ionicons5";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useAppStore } from "./stores/app";
const { message } = createDiscreteApi(["message"]);
const store = useAppStore();
const showSettings = ref(false), showLog = ref(false);
onMounted(() => store.init()); onUnmounted(() => store.cleanup());
function handleStart() { if (!store.processing) store.startPipeline(); }
watch(() => store.error, (val) => { if (val) message.error(val); });
async function copyText(text: string, label: string) { try { await writeText(text); message.success(label+" 已复制"); } catch (e: any) { message.error("复制失败: "+String(e)); } }
const stageLabel = (s:string) => ({download:"下载中",ffmpeg:"转换格式",asr:"语音识别",ai:"AI 分析",done:"完成",refine:"AI 校对"})[s]||s;
function renderMarkdown(text: string) { let h=text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`(.+?)`/g,'<code>$1</code>').replace(/^- (.+)$/gm,'<li>$1</li>').replace(/^(\d+)\. (.+)$/gm,'<li>$2</li>').replace(/^---$/gm,'<hr>').replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>'); return'<p>'+h+'</p>'; }
const fmtDur = (sec:number) => { const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60; return h>0?`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; };

const currentMarkdown = computed(() => {
  if (store.completedTasks.length === 0) return store.result?.markdown ?? "";
  if (store.activeResultTab < store.completedTasks.length) {
    return store.completedTasks[store.activeResultTab]?.result?.markdown ?? "";
  }
  return store.mergedMarkdown;
});

const currentAIContent = computed(() => {
  const md = currentMarkdown.value;
  if (!md) return "";
  const aiIdx = md.indexOf("## AI Insights") !== -1 ? md.indexOf("## AI Insights") : md.indexOf("## AI");
  if (aiIdx === -1) return md;
  let section = md.substring(aiIdx + (md.indexOf("## AI Insights") !== -1 ? 15 : 5));
  section = section.replace(/^### (Summary|Key Points|Tags)\s*\n?/gm, "");
  const transcriptIdx = section.indexOf("## Full Transcript");
  if (transcriptIdx !== -1) section = section.substring(0, transcriptIdx);
  const sepIdx = section.indexOf("---");
  if (sepIdx !== -1) section = section.substring(0, sepIdx);
  return section.trim();
});

function copyCurrentResult() {
  const title = store.completedTasks.length <= 1
    ? store.preview?.title ?? ""
    : store.activeResultTab < store.completedTasks.length
      ? store.completedTasks[store.activeResultTab].pageInfo.part
      : store.preview?.title + " (合并)";
  copyText(`【${title}】\n${store.url}\n\n${currentAIContent.value}`, "报告");
}

const tplPrompt = computed({
  get: () => {
    const idx = store.selectedTemplateIndex;
    if (idx < store.BUILTIN_TEMPLATES.length) return store.BUILTIN_TEMPLATES[idx].prompt;
    const ci = idx - store.BUILTIN_TEMPLATES.length;
    return store.customTemplates[ci]?.prompt ?? "";
  },
  set: (val: string) => {
    const idx = store.selectedTemplateIndex;
    if (idx < store.BUILTIN_TEMPLATES.length) return;
    store.updateTemplatePrompt(idx, val);
  }
});
</script>

<template>
  <div class="app-root">
    <header class="app-header">
      <div class="header-left"><n-icon size="24" color="#00aeec"><VideocamOutline /></n-icon><n-text strong style="font-size:18px;">Bili2Insight</n-text></div>
      <n-button text @click="showSettings=true"><template #icon><n-icon><SettingsSharp /></n-icon></template>设置</n-button>
    </header>

    <main class="app-main">
      <div class="input-row">
        <n-input v-model:value="store.url" placeholder="粘贴 Bilibili 视频链接..." :disabled="store.processing" clearable @keyup.enter="handleStart" />
        <n-button type="primary" @click="handleStart" :loading="store.processing" :disabled="!store.url.trim() || store.previewLoading || !store.preview">
          <template #icon><n-icon><PlayOutline /></n-icon></template>
          {{ store.videoPages.length > 1 ? `开始分析 (${store.selectedPages.size}/${store.videoPages.length})` : "开始" }}
        </n-button>
      </div>

      <!-- Preview card -->
      <div v-if="store.preview" class="preview-card">
        <div class="preview-main">
          <img v-if="store.preview.cover" :src="store.preview.cover" referrerpolicy="no-referrer" class="preview-img" />
          <div class="preview-info">
            <n-text strong style="font-size:14px;">{{ store.preview.title }}</n-text>
            <n-text depth="3" style="font-size:12px;">{{ store.preview.uploader }} &middot; {{ fmtDur(store.preview.duration) }} <template v-if="store.hasMultiPages">&middot; {{ store.videoPages.length }} 个分P</template></n-text>
          </div>
        </div>
        <!-- Multi-page selector -->
        <div v-if="store.hasMultiPages" class="pages-section">
          <div class="pages-header">
            <n-checkbox :checked="store.selectedPages.size === store.videoPages.length" @update:checked="store.selectAllPages()">全选</n-checkbox>
            <n-text depth="3" style="font-size:12px;margin-left:8px;">已选 {{ store.selectedPages.size }}/{{ store.videoPages.length }} 个分P</n-text>
          </div>
          <div class="pages-list">
            <div v-for="(p, i) in store.videoPages" :key="i" class="page-item" :class="{ selected: store.selectedPages.has(i) }" @click="store.togglePage(i)">
              <n-checkbox :checked="store.selectedPages.has(i)" />
              <span class="page-index">P{{ p.page }}</span>
              <span class="page-title">{{ p.part }}</span>
              <span class="page-dur">{{ fmtDur(p.duration) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Preview loading -->
      <div v-if="store.previewLoading" class="progress-row"><n-text depth="3" style="font-size:13px;">检测视频中...</n-text></div>

      <!-- Task queue during processing -->
      <div v-if="store.tasks.length > 0 && store.processing" class="task-queue">
        <div v-for="(task, i) in store.tasks" :key="i" class="task-item" :class="{ active: i <= store.activeTaskIndex && task.status !== 'error', done: task.status === 'done', error: task.status === 'error' }">
          <span class="task-status-icon">
            <n-icon v-if="task.status === 'done'" color="#18a058" size="16"><CheckmarkCircle /></n-icon>
            <n-icon v-else-if="task.status === 'error'" color="#d03050" size="16"><CloseCircle /></n-icon>
            <n-icon v-else-if="i === store.activeTaskIndex" color="#2080f0" size="16" class="spinning"><SyncOutline /></n-icon>
            <span v-else style="color:#ccc;font-size:16px;">&#9679;</span>
          </span>
          <span class="task-label">P{{ task.pageInfo.page }}: {{ task.pageInfo.part }}</span>
          <span class="task-dur">{{ fmtDur(task.pageInfo.duration) }}</span>
          <div v-if="task.status !== 'pending'" class="task-bar">
            <div class="task-bar-fill" :style="{ width: Math.round(task.progress*100)+'%', background: task.status === 'error' ? '#d03050' : task.status === 'done' ? '#18a058' : '#2080f0' }"></div>
          </div>
          <span class="task-msg" :style="{ color: task.status === 'error' ? '#d03050' : task.status === 'done' ? '#18a058' : '#666' }">{{ task.status === 'error' ? '失败' : task.message || task.stageLabel }}</span>
        </div>
      </div>

      <!-- Single progress bar (legacy, no tasks) -->
      <div v-if="store.processing && store.tasks.length === 0" class="progress-row">
        <n-space justify="space-between"><n-text>{{ store.progress ? stageLabel(store.progress.stage) : "处理中..." }}</n-text><n-text depth="3">{{ store.progress ? Math.round(store.progress.progress*100) : 0 }}%</n-text></n-space>
        <n-progress type="line" :percentage="store.progress?Math.round(store.progress.progress*100):0" :indicator-placement="'inside'" :height="24" :border-radius="4" />
        <n-text depth="3" v-if="store.progress?.message" style="font-size:13px;">{{ store.progress.message }}</n-text>
      </div>

      <!-- Results with tabs -->
      <div v-if="(store.result || store.completedTasks.length > 0) && !store.processing" class="result-area">
        <div class="result-topbar">
          <div class="result-tabs">
            <template v-if="store.completedTasks.length > 1">
              <button v-for="(task, i) in store.completedTasks" :key="i" class="tab-btn" :class="{ active: store.activeResultTab === i }" @click="store.activeResultTab = i">{{ task.pageInfo.part }}</button>
              <button class="tab-btn" :class="{ active: store.activeResultTab === store.completedTasks.length }" @click="store.activeResultTab = store.completedTasks.length">合并</button>
            </template>
            <span v-else class="tab-title">{{ store.preview?.title ?? "结果" }}</span>
          </div>
          <n-space :size="8" style="flex-shrink:0;">
            <n-button size="small" @click="copyCurrentResult()"><template #icon><n-icon><CopyOutline /></n-icon></template>复制</n-button>
            <n-button size="small" @click="showLog=true"><template #icon><n-icon><DocumentTextOutline /></n-icon></template>日志</n-button>
            <n-button size="small" @click="store.exportToFile()"><template #icon><n-icon><DownloadOutline /></n-icon></template>导出</n-button>
          </n-space>
        </div>
        <div class="result-scroll">
          <div class="ref-line" v-if="store.completedTasks.length <= 1 || store.activeResultTab < store.completedTasks.length">
            <span class="ref-bracket">【</span>{{ store.result?.video_info.title ?? store.completedTasks[0]?.result?.video_info.title ?? "" }}<span class="ref-bracket">】</span>
            <a class="ref-url" :href="store.url" target="_blank">{{ store.url }}</a>
          </div>
          <n-divider />
          <div class="ai-content md-preview" v-html="renderMarkdown(currentAIContent)" />
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="!store.url.trim() && !store.result && !store.processing && store.tasks.length===0" class="empty-state">
        <div class="empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg></div>
        <n-text depth="2" style="font-size:16px;font-weight:500;margin-top:12px;">粘贴 Bilibili 视频链接</n-text>
        <n-text depth="3" style="font-size:13px;margin-top:4px;">自动下载音频 &middot; 语音转文字 &middot; AI 提炼 &middot; Markdown 输出</n-text>
      </div>
    </main>

    <!-- Settings drawer -->
    <n-drawer v-model:show="showSettings" width="440"><n-drawer-content title="设置" closable><n-space vertical style="gap:16px;">
      <div><n-text depth="3" style="font-size:12px;">HTTP 代理</n-text><n-input v-model:value="store.proxy" placeholder="http://127.0.0.1:7897" size="small" /></div>
      <div><n-text depth="3" style="font-size:12px;">AI 提供商</n-text><n-select v-model:value="store.selectedProvider" :options="store.PROVIDERS.map((p:any,i:number)=>({label:p.name,value:i}))" size="small" @update:value="(i:number)=>store.switchProvider(i)" /></div>
      <div><n-text depth="3" style="font-size:12px;">API 地址</n-text><n-input v-model:value="store.aiApiUrl" size="small" /></div>
      <div>
        <n-text depth="3" style="font-size:12px;">API 密钥</n-text>
        <n-space :size="6" style="margin-top:4px;flex-wrap:nowrap;">
          <n-input v-model:value="store.aiApiKey" type="password" placeholder="sk-..." size="small" show-password-on="click" style="flex:1;min-width:0;" />
          <n-button size="small" @click="store.fetchModelList()" style="flex-shrink:0;white-space:nowrap;">测试连接 &amp; 拉取模型</n-button>
        </n-space>
      </div>
      <div v-if="store.customModels.length>0||store.PROVIDERS[store.selectedProvider].models.length>0">
        <n-text depth="3" style="font-size:12px;">模型</n-text><n-select v-model:value="store.aiModel" :options="(store.customModels.length>0?store.customModels:store.PROVIDERS[store.selectedProvider].models).map((m:string)=>({label:m,value:m}))" size="small" />
      </div>
      <div v-else><n-text depth="3" style="font-size:12px;">模型</n-text><n-input v-model:value="store.aiModel" size="small" /></div>
      <div>
        <n-space justify="space-between" align="center"><n-text depth="3" style="font-size:12px;">提示词模版</n-text><n-button size="tiny" @click="store.addCustomTemplate()">+ 新增</n-button></n-space>
        <n-space style="margin-top:4px;flex-wrap:wrap;" :size="4">
          <n-button v-for="(t, i) in store.allTemplates" :key="i" :type="store.selectedTemplateIndex===i ? 'primary' : 'default'" size="tiny" @click="store.selectTemplate(i)" :title="t.name">{{ t.name }}
            <template v-if="i >= store.BUILTIN_TEMPLATES.length" #icon><n-icon size="14" style="cursor:pointer;margin-left:4px;" @click.stop="store.deleteCustomTemplate(i)"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></n-icon></template>
          </n-button>
        </n-space>
      </div>
      <div v-if="store.selectedTemplateIndex >= store.BUILTIN_TEMPLATES.length">
        <n-text depth="3" style="font-size:12px;">模版名称</n-text>
        <n-input :value="store.allTemplates[store.selectedTemplateIndex]?.name??''" @update:value="(v:string)=>store.updateTemplateName(store.selectedTemplateIndex, v)" size="small" style="margin-top:4px;" />
      </div>
      <div>
        <n-text depth="3" style="font-size:12px;">提示词内容{{ store.selectedTemplateIndex < store.BUILTIN_TEMPLATES.length ? ' (内置模版不可编辑)' : '' }}</n-text>
        <n-input v-model:value="tplPrompt" type="textarea" :rows="6" size="small" style="margin-top:4px;" :disabled="store.selectedTemplateIndex < store.BUILTIN_TEMPLATES.length" />
      </div>
    </n-space></n-drawer-content></n-drawer>

    <!-- Log drawer -->
    <n-drawer v-model:show="showLog" width="620"><n-drawer-content title="流水线日志" closable>
      <div class="log-console" v-if="store.result || store.completedTasks.length > 0">
        <div class="log-block" v-if="store.result"><div class="log-tag info">视频信息</div><pre class="log-text">{{ JSON.stringify(store.result.video_info, null, 2) }}</pre></div>
        <template v-for="task in store.completedTasks" :key="task.pageKey">
          <div class="log-block"><div class="log-tag info">P{{ task.pageInfo.page }}: {{ task.pageInfo.part }}</div><pre class="log-text">{{ JSON.stringify(task.result?.video_info, null, 2) }}</pre></div>
          <div class="log-block" v-if="task.result"><div class="log-tag success">AI 提炼 - P{{ task.pageInfo.page }}</div><pre class="log-text">{{ JSON.stringify(task.result.insights, null, 2) }}</pre></div>
        </template>
      </div>
      <n-text depth="3" v-else>暂无流水线数据。</n-text>
    </n-drawer-content></n-drawer>
  </div>
</template>

<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;background:#f5f5f5}
.app-root{height:100vh;display:grid;grid-template-rows:56px 1fr}
.app-header{display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:#fff;border-bottom:1px solid #e8e8e8;z-index:1}
.header-left{display:flex;align-items:center;gap:8px}
.app-main{overflow-y:auto;display:flex;flex-direction:column;align-items:center;padding:24px;gap:16px}
.input-row{width:100%;max-width:780px;display:flex;gap:8px;flex-shrink:0}.input-row .n-input{flex:1;min-width:0}
.preview-card{width:100%;max-width:780px;flex-shrink:0;background:#fff;border-radius:8px;border:1px solid #e0ecff;overflow:hidden}
.preview-main{display:flex;gap:12px;align-items:center;padding:12px 16px}
.preview-img{width:120px;height:68px;object-fit:cover;border-radius:4px;flex-shrink:0}
.preview-info{display:flex;flex-direction:column;gap:4px;min-width:0}
.pages-section{border-top:1px solid #f0f0f0;padding:8px 16px 12px}
.pages-header{display:flex;align-items:center;margin-bottom:6px}
.pages-list{max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:2px}
.page-item{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:4px;cursor:pointer;transition:background .15s}
.page-item:hover{background:#f5f7fa}
.page-item.selected{background:#e8f4fd}
.page-index{font-size:12px;color:#999;min-width:28px}
.page-title{font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.page-dur{font-size:11px;color:#999;flex-shrink:0}
.progress-row{width:100%;max-width:780px;flex-shrink:0;display:flex;flex-direction:column;gap:8px;background:#fff;border-radius:8px;padding:14px 20px;border:1px solid #e8e8e8}
.task-queue{width:100%;max-width:780px;flex-shrink:0;background:#fff;border-radius:8px;border:1px solid #e8e8e8;overflow:hidden}
.task-item{display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid #f5f5f5;transition:background .2s;height:44px;overflow:hidden}
.task-item:last-child{border-bottom:none}
.task-item.active{background:#f0f7ff}
.task-item.done{background:#f6ffed}
.task-item.error{background:#fff2f0}
.task-status-icon{flex-shrink:0;width:18px;display:flex;align-items:center;justify-content:center}
.task-label{font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.task-dur{font-size:11px;color:#999;flex-shrink:0;min-width:42px;text-align:right}
.task-bar{width:80px;height:5px;background:#eee;border-radius:3px;overflow:hidden;flex-shrink:0}
.task-bar-fill{height:100%;border-radius:3px;transition:width .3s ease}
.task-msg{font-size:11px;width:56px;text-align:right;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
.spinning{animation:spin 1s linear infinite}
.result-area{width:100%;max-width:780px;flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:#fff;border-radius:8px;border:1px solid #e8e8e8}
.result-topbar{display:flex;align-items:center;justify-content:space-between;padding:8px 16px;border-bottom:1px solid #f0f0f0;flex-shrink:0;gap:8px}
.result-tabs{display:flex;gap:2px;overflow-x:auto;flex:1;min-width:0}
.tab-btn{font-size:12px;padding:4px 12px;border:1px solid #e8e8e8;border-radius:4px;background:#fff;cursor:pointer;white-space:nowrap;transition:all .15s}
.tab-btn:hover{border-color:#2080f0;color:#2080f0}
.tab-btn.active{background:#2080f0;color:#fff;border-color:#2080f0}
.tab-title{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.result-scroll{flex:1;overflow-y:auto;overflow-x:hidden;padding:0 20px 20px}
.ref-line{font-size:13px;color:#666;line-height:1.7;padding:10px 0;word-break:break-all}
.ref-bracket{color:#999}
.ref-url{color:#00aeec;text-decoration:none;margin-left:6px;font-size:12px}
.ref-url:hover{text-decoration:underline}
.ai-content{line-height:1.8;color:#333}
.log-console{background:#1e1e1e;color:#ccc;border-radius:6px;padding:16px;font-family:"Cascadia Code","Fira Code","Consolas",monospace;font-size:12px;line-height:1.6;max-height:calc(100vh - 140px);overflow-y:auto}
.log-block{margin-bottom:16px;border-bottom:1px solid #333;padding-bottom:12px}
.log-tag{display:inline-block;padding:2px 8px;border-radius:3px;font-size:11px;font-weight:600;margin-bottom:8px;color:#fff}
.log-tag.info{background:#007acc}.log-tag.warn{background:#d4a72c}.log-tag.success{background:#4c9a2a}
.log-text{margin:0;white-space:pre-wrap;word-break:break-all;color:#a0a0a0}
.empty-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:0}
.md-preview h1{font-size:20px;margin:14px 0 10px;color:#111}.md-preview h2{font-size:16px;margin:12px 0 8px;color:#222}.md-preview h3{font-size:14px;margin:10px 0 6px;color:#333}.md-preview p{margin:5px 0}.md-preview strong{color:#00aeec}.md-preview code{background:#f0f0f0;padding:2px 6px;border-radius:3px;font-size:13px}.md-preview li{margin-left:22px}.md-preview hr{border:none;border-top:1px solid #eee;margin:14px 0}
</style>