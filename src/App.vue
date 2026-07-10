<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { NLayout, NLayoutHeader, NLayoutContent, NInput, NButton, NSpace, NProgress, NText, NIcon, NScrollbar, createDiscreteApi, NDrawer, NDrawerContent, NTabs, NTabPane, NTag, NSelect } from "naive-ui";
import { PlayOutline, DownloadOutline, CopyOutline, SettingsSharp, VideocamOutline, DocumentTextOutline, BulbOutline, InformationCircleOutline } from "@vicons/ionicons5";
import { useAppStore } from "./stores/app";

const { message } = createDiscreteApi(["message"]);
const store = useAppStore();
const showSettings = ref(false);
const resultTab = ref("markdown");

onMounted(() => store.init());
onUnmounted(() => store.cleanup());
function handleStart() { store.startPipeline(); }

watch(() => store.error, (val) => { if (val) message.error(val); });

async function copyText(text: string, label: string) {
  try { const { writeText } = await import("@tauri-apps/plugin-clipboard-manager"); await writeText(text); message.success(`${label} copied`); }
  catch (e: any) { message.error("Copy failed: " + String(e)); }
}
function stageLabel(s: string) { return { download:"Downloading",ffmpeg:"Converting",asr:"Transcribing",ai:"AI Analyzing",done:"Done" }[s]||s; }
function renderMarkdown(text: string) { let h=text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`(.+?)`/g,'<code>$1</code>').replace(/^- (.+)$/gm,'<li>$1</li>').replace(/^(\d+)\. (.+)$/gm,'<li>$2</li>').replace(/^---$/gm,'<hr>').replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>'); return'<p>'+h+'</p>'; }
function fmtDur(sec:number){const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h>0?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}
</script>

<template>
  <n-layout style="height:100vh;background:#f5f5f5;">
    <n-layout-header bordered style="height:56px;padding:0 20px;display:flex;align-items:center;justify-content:space-between;background:#fff;">
      <div style="display:flex;align-items:center;gap:8px;"><n-icon size="24" color="#00aeec"><VideocamOutline /></n-icon><n-text strong style="font-size:18px;">Bili2Insight</n-text></div>
      <n-button text @click="showSettings=true"><template #icon><n-icon><SettingsSharp /></n-icon></template>Settings</n-button>
    </n-layout-header>

    <n-layout-content class="main-content">
      <div class="input-row">
        <n-input v-model:value="store.url" style="flex:1;width:0;" placeholder="https://www.bilibili.com/video/BV..." :disabled="store.processing" clearable @keyup.enter="handleStart" />
        <n-button type="primary" @click="handleStart" :loading="store.processing" :disabled="!store.url.trim()"><template #icon><n-icon><PlayOutline /></n-icon></template>Start</n-button>
      </div>

      <div v-if="store.preview" class="preview-card">
        <img v-if="store.preview.cover" :src="store.preview.cover" style="width:120px;height:68px;object-fit:cover;border-radius:4px;" />
        <div class="preview-info"><n-text strong style="font-size:14px;">{{ store.preview.title }}</n-text><n-text depth="3" style="font-size:12px;">{{ store.preview.uploader }} &middot; {{ fmtDur(store.preview.duration) }}</n-text></div>
      </div>
      <div v-if="store.previewLoading" class="progress-row"><n-text depth="3" style="font-size:13px;">Detecting video...</n-text></div>

      <div v-if="store.processing || store.progress" class="progress-row">
        <n-space justify="space-between"><n-text>{{ store.progress ? stageLabel(store.progress.stage) : "Processing..." }}</n-text><n-text depth="3">{{ store.progress ? Math.round(store.progress.progress * 100) : 0 }}%</n-text></n-space>
        <n-progress type="line" :percentage="store.progress ? Math.round(store.progress.progress * 100) : 0" :indicator-placement="'inside'" :height="24" :border-radius="4" />
        <n-text depth="3" v-if="store.progress?.message" style="font-size:13px;">{{ store.progress.message }}</n-text>
      </div>

      <div v-if="store.result" class="result-area">
        <div class="result-header"><n-text strong style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ store.result.video_info.title }}</n-text><n-button size="small" @click="store.exportToFile()"><template #icon><n-icon><DownloadOutline /></n-icon></template>Export MD</n-button></div>
        <n-tabs v-model:value="resultTab" type="line" class="result-tabs">
          <n-tab-pane name="markdown" tab="Markdown">
            <template #tab><n-space :size="4" align="center"><n-icon size="15"><DocumentTextOutline /></n-icon><span>Markdown</span></n-space></template>
            <div class="tab-toolbar"><n-button size="tiny" quaternary @click="copyText(store.result.markdown,'Markdown')"><template #icon><n-icon><CopyOutline /></n-icon></template>Copy</n-button></div>
            <n-scrollbar class="tab-scroll"><div class="md-preview" v-html="renderMarkdown(store.result.markdown)" /></n-scrollbar>
          </n-tab-pane>
          <n-tab-pane name="transcript" tab="Transcript">
            <template #tab><n-space :size="4" align="center"><n-icon size="15"><DocumentTextOutline /></n-icon><span>Transcript</span></n-space></template>
            <div class="tab-toolbar"><n-button size="tiny" quaternary @click="copyText(store.result.transcript,'Transcript')"><template #icon><n-icon><CopyOutline /></n-icon></template>Copy</n-button></div>
            <n-scrollbar class="tab-scroll"><pre class="transcript-text">{{ store.result.transcript }}</pre></n-scrollbar>
          </n-tab-pane>
          <n-tab-pane name="insights" tab="Insights">
            <template #tab><n-space :size="4" align="center"><n-icon size="15"><BulbOutline /></n-icon><span>Insights</span></n-space></template>
            <div class="tab-toolbar"><n-button size="tiny" quaternary @click="copyText(JSON.stringify(store.result.insights,null,2),'Insights')"><template #icon><n-icon><CopyOutline /></n-icon></template>Copy JSON</n-button></div>
            <n-scrollbar class="tab-scroll"><div class="insights-block"><div class="insight-section"><span class="insight-label">Summary</span><p>{{ store.result.insights.summary }}</p></div><div class="insight-section"><span class="insight-label">Key Points</span><ol><li v-for="(pt,i) in store.result.insights.key_points" :key="i">{{ pt }}</li></ol></div><div class="insight-section"><span class="insight-label">Tags</span><div class="tag-row"><n-tag v-for="(t,i) in store.result.insights.tags" :key="i" size="small">{{ t }}</n-tag></div></div></div></n-scrollbar>
          </n-tab-pane>
          <n-tab-pane name="info" tab="Info">
            <template #tab><n-space :size="4" align="center"><n-icon size="15"><InformationCircleOutline /></n-icon><span>Info</span></n-space></template>
            <n-scrollbar class="tab-scroll"><table class="info-table"><tr><td>BV</td><td><code>{{ store.result.video_info.bvid }}</code></td></tr><tr><td>Title</td><td>{{ store.result.video_info.title }}</td></tr><tr><td>Uploader</td><td>{{ store.result.video_info.uploader }} (UID: {{ store.result.video_info.uploader_uid }})</td></tr><tr><td>Duration</td><td>{{ fmtDur(store.result.video_info.duration) }}</td></tr><tr><td>Published</td><td>{{ new Date(store.result.video_info.pubdate * 1000).toLocaleString() }}</td></tr><tr v-if="store.result.video_info.description"><td>Description</td><td class="desc-cell">{{ store.result.video_info.description }}</td></tr></table></n-scrollbar>
          </n-tab-pane>
        </n-tabs>
      </div>

      <div v-if="!store.result && !store.processing" class="empty-state" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;"><div class="empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg></div><n-text depth="2" style="font-size:16px;font-weight:500;margin-top:12px;">Paste a Bilibili video URL</n-text><n-text depth="3" style="font-size:13px;margin-top:4px;">The app will download audio, transcribe with ASR, extract insights with AI, and generate a Markdown report.</n-text></div>
    </n-layout-content>

    <n-drawer v-model:show="showSettings" width="400">
      <n-drawer-content title="Settings" closable>
        <n-space vertical style="gap:16px;">
          <div><n-text depth="3" style="font-size:12px;">HTTP Proxy</n-text><n-input v-model:value="store.proxy" placeholder="http://127.0.0.1:7897" size="small" /></div>
          <div><n-text depth="3" style="font-size:12px;">AI Provider</n-text><n-select v-model:value="store.selectedProvider" :options="store.PROVIDERS.map((p:any,i:number)=>({label:p.name,value:i}))" size="small" @update:value="(i:number)=>store.switchProvider(i)" /></div>
          <div><n-text depth="3" style="font-size:12px;">API URL</n-text><n-input v-model:value="store.aiApiUrl" size="small" /></div>
          <div><n-text depth="3" style="font-size:12px;">API Key</n-text><n-input v-model:value="store.aiApiKey" type="password" placeholder="sk-..." size="small" show-password-on="click" /></div>
          <div v-if="store.customModels.length > 0 || store.PROVIDERS[store.selectedProvider].models.length > 0"><n-text depth="3" style="font-size:12px;">Model</n-text><n-select v-model:value="store.aiModel" :options="(store.customModels.length > 0 ? store.customModels : store.PROVIDERS[store.selectedProvider].models).map((m:string)=>({label:m,value:m}))" size="small" /></div>
          <div v-else><n-text depth="3" style="font-size:12px;">Model</n-text><n-input v-model:value="store.aiModel" size="small" /></div>
          <n-button size="tiny" @click="store.fetchModelList()">Test Connection &amp; Fetch Models</n-button>
          <div><n-text depth="3" style="font-size:12px;">AI Prompt</n-text><n-input v-model:value="store.aiPrompt" type="textarea" :rows="4" size="small" /></div>
        </n-space>
      </n-drawer-content>
    </n-drawer>
  </n-layout>
</template>

<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;background:#f5f5f5}
.main-content{`n.main-content :deep(.n-layout-scroll-container){display:flex!important;flex-direction:column!important;flex:1!important;min-height:0!important;gap:16px!important;align-items:center!important}`npadding:24px!important;display:flex!important;flex-direction:column!important;gap:16px!important;align-items:center!important;flex:1!important;min-height:0!important}
.input-row{width:100%;max-width:780px;display:flex;gap:8px;flex-shrink:0}
.preview-card{width:100%;max-width:780px;flex-shrink:0;display:flex;gap:12px;align-items:center;background:#fff;border-radius:6px;padding:12px 16px;border:1px solid #e0ecff}
.preview-info{display:flex;flex-direction:column;gap:4px;min-width:0}
.progress-row{width:100%;max-width:780px;flex-shrink:0;display:flex;flex-direction:column;gap:8px;background:#fff;border-radius:6px;padding:14px 20px;border:1px solid #e8e8e8}
.result-area{width:100%;max-width:780px;flex:1;min-height:0;display:flex;flex-direction:column;background:#fff;border-radius:6px;border:1px solid #e8e8e8}
.result-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px 0;flex-shrink:0}
.result-tabs{flex:1;min-height:0;display:flex;flex-direction:column;padding:0 20px}
.result-tabs :deep(.n-tabs-pane-wrapper){flex:1;min-height:0;overflow:hidden}
.result-tabs :deep(.n-tab-pane){height:100%;display:flex;flex-direction:column}
.tab-toolbar{display:flex;justify-content:flex-end;padding:6px 0 0;flex-shrink:0}
.tab-scroll{flex:1;min-height:0}.tab-scroll :deep(.n-scrollbar-container){padding-right:8px}
.transcript-text{margin:0;white-space:pre-wrap;line-height:1.8;font-size:14px;color:#333;font-family:inherit}
.insights-block{padding:4px 0}.insight-section{margin-bottom:18px}.insight-label{font-size:12px;font-weight:600;color:#999;display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px}.insight-section p{line-height:1.7;color:#333}.insight-section ol{margin:0;padding-left:20px}.insight-section ol li{line-height:1.7;margin:3px 0}.tag-row{display:flex;flex-wrap:wrap;gap:6px}
.info-table{width:100%;border-collapse:collapse;font-size:13px}.info-table td{padding:7px 0;vertical-align:top}.info-table td:first-child{color:#999;width:90px;white-space:nowrap}.info-table code{font-size:12px;background:#f5f5f5;padding:1px 6px;border-radius:3px}.desc-cell{line-height:1.6;color:#555}
.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
.md-preview{line-height:1.8;color:#333}.md-preview h1{font-size:21px;margin:14px 0 10px;color:#111}.md-preview h2{font-size:17px;margin:12px 0 8px;color:#222}.md-preview h3{font-size:14px;margin:10px 0 6px;color:#333}.md-preview p{margin:5px 0}.md-preview strong{color:#00aeec}.md-preview code{background:#f0f0f0;padding:2px 6px;border-radius:3px;font-size:13px}.md-preview li{margin-left:22px}.md-preview hr{border:none;border-top:1px solid #eee;margin:14px 0}
</style>
