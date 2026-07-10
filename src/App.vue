<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed } from "vue";
import { NInput, NButton, NSpace, NProgress, NText, NIcon, createDiscreteApi, NDrawer, NDrawerContent, NSelect, NTag, NDivider } from "naive-ui";
import { PlayOutline, DownloadOutline, CopyOutline, SettingsSharp, VideocamOutline, DocumentTextOutline } from "@vicons/ionicons5";
import { useAppStore } from "./stores/app";
const { message } = createDiscreteApi(["message"]);
const store = useAppStore();
const showSettings = ref(false), showLog = ref(false);
onMounted(() => store.init()); onUnmounted(() => store.cleanup());
function handleStart() { store.startPipeline(); }
watch(() => store.error, (val) => { if (val) message.error(val); });
async function copyText(text: string, label: string) { try { const { writeText } = await import("@tauri-apps/plugin-clipboard-manager"); await writeText(text); message.success(label+" copied"); } catch (e: any) { message.error("Copy failed: "+String(e)); } }
const stageLabel = (s:string) => ({download:"Downloading",ffmpeg:"Converting",asr:"Transcribing",ai:"AI Analyzing",done:"Done"})[s]||s;
function renderMarkdown(text: string) { let h=text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`(.+?)`/g,'<code>$1</code>').replace(/^- (.+)$/gm,'<li>$1</li>').replace(/^(\d+)\. (.+)$/gm,'<li>$2</li>').replace(/^---$/gm,'<hr>').replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>'); return'<p>'+h+'</p>'; }
const fmtDur = (sec:number) => { const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60; return h>0?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; };
const aiContent = computed(() => { if (!store.result) return ''; const md = store.result.markdown; const aiIdx = md.indexOf('## AI Insights') !== -1 ? md.indexOf('## AI Insights') : md.indexOf('## AI'); if (aiIdx === -1) return md; let section = md.substring(aiIdx + (md.indexOf('## AI Insights') !== -1 ? 15 : 5)); section = section.replace(/^### (Summary|Key Points|Tags)\s*\n?/gm, ''); const transcriptIdx = section.indexOf('## Full Transcript'); if (transcriptIdx !== -1) section = section.substring(0, transcriptIdx); const sepIdx = section.indexOf('---'); if (sepIdx !== -1) section = section.substring(0, sepIdx); return section.trim(); });
</script>

<template>
  <div class="app-root">
    <header class="app-header">
      <div class="header-left"><n-icon size="24" color="#00aeec"><VideocamOutline /></n-icon><n-text strong style="font-size:18px;">Bili2Insight</n-text></div>
      <n-button text @click="showSettings=true"><template #icon><n-icon><SettingsSharp /></n-icon></template>Settings</n-button>
    </header>

    <main class="app-main">
      <div class="input-row">
        <n-input v-model:value="store.url" placeholder="https://www.bilibili.com/video/BV..." :disabled="store.processing" clearable @keyup.enter="handleStart" />
        <n-button type="primary" @click="handleStart" :loading="store.processing" :disabled="!store.url.trim() || store.previewLoading || !store.preview"><template #icon><n-icon><PlayOutline /></n-icon></template>Start</n-button>
      </div>

      <div v-if="store.preview" class="preview-card">
        <img v-if="store.preview.cover" :src="store.preview.cover" referrerpolicy="no-referrer" class="preview-img" />
        <div class="preview-info"><n-text strong style="font-size:14px;">{{ store.preview.title }}</n-text><n-text depth="3" style="font-size:12px;">{{ store.preview.uploader }} &middot; {{ fmtDur(store.preview.duration) }}</n-text></div>
      </div>
      <div v-if="store.previewLoading" class="progress-row"><n-text depth="3" style="font-size:13px;">Detecting video...</n-text></div>

      <div v-if="store.processing" class="progress-row">
        <n-space justify="space-between"><n-text>{{ store.progress ? stageLabel(store.progress.stage) : "Processing..." }}</n-text><n-text depth="3">{{ store.progress ? Math.round(store.progress.progress*100) : 0 }}%</n-text></n-space>
        <n-progress type="line" :percentage="store.progress?Math.round(store.progress.progress*100):0" :indicator-placement="'inside'" :height="24" :border-radius="4" />
        <n-text depth="3" v-if="store.progress?.message" style="font-size:13px;">{{ store.progress.message }}</n-text>
      </div>

      <div v-if="store.result" class="result-area">
        <div class="result-topbar">
          <n-text strong class="result-title">{{ store.result.video_info.title }}</n-text>
          <n-space :size="8">
            <n-button size="small" @click="copyText(store.result.markdown, 'Report')"><template #icon><n-icon><CopyOutline /></n-icon></template>Copy</n-button>
            <n-button size="small" @click="showLog=true"><template #icon><n-icon><DocumentTextOutline /></n-icon></template>Log</n-button>
            <n-button size="small" @click="store.exportToFile()"><template #icon><n-icon><DownloadOutline /></n-icon></template>Export</n-button>
          </n-space>
        </div>
        <div class="result-scroll">
          <div class="ref-line">
            <span class="ref-bracket">【</span>{{ store.result.video_info.title }}<span class="ref-bracket">】</span>
            <a class="ref-url" :href="store.url" target="_blank">{{ store.url }}</a>
          </div>
          <n-divider />
          <div class="ai-content md-preview" v-html="renderMarkdown(aiContent)" />
        </div>
      </div>

      <div v-if="!store.url.trim() && !store.result && !store.processing" class="empty-state">
        <div class="empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg></div>
        <n-text depth="2" style="font-size:16px;font-weight:500;margin-top:12px;">Paste a Bilibili video URL</n-text>
        <n-text depth="3" style="font-size:13px;margin-top:4px;">Auto download audio - ASR transcription - AI insight - Markdown output</n-text>
      </div>
    </main>

    <n-drawer v-model:show="showSettings" width="400"><n-drawer-content title="Settings" closable><n-space vertical style="gap:16px;"><div><n-text depth="3" style="font-size:12px;">HTTP Proxy</n-text><n-input v-model:value="store.proxy" placeholder="http://127.0.0.1:7897" size="small" /></div><div><n-text depth="3" style="font-size:12px;">AI Provider</n-text><n-select v-model:value="store.selectedProvider" :options="store.PROVIDERS.map((p:any,i:number)=>({label:p.name,value:i}))" size="small" @update:value="(i:number)=>store.switchProvider(i)" /></div><div><n-text depth="3" style="font-size:12px;">API URL</n-text><n-input v-model:value="store.aiApiUrl" size="small" /></div><div><n-text depth="3" style="font-size:12px;">API Key</n-text><n-input v-model:value="store.aiApiKey" type="password" placeholder="sk-..." size="small" show-password-on="click" /></div><div v-if="store.customModels.length>0||store.PROVIDERS[store.selectedProvider].models.length>0"><n-text depth="3" style="font-size:12px;">Model</n-text><n-select v-model:value="store.aiModel" :options="(store.customModels.length>0?store.customModels:store.PROVIDERS[store.selectedProvider].models).map((m:string)=>({label:m,value:m}))" size="small" /></div><div v-else><n-text depth="3" style="font-size:12px;">Model</n-text><n-input v-model:value="store.aiModel" size="small" /></div><n-button size="tiny" @click="store.fetchModelList()">Test Connection &amp; Fetch Models</n-button><div><n-text depth="3" style="font-size:12px;">AI Prompt</n-text><n-input v-model:value="store.aiPrompt" type="textarea" :rows="4" size="small" /></div></n-space></n-drawer-content></n-drawer>

    <n-drawer v-model:show="showLog" width="620"><n-drawer-content title="Pipeline Log" closable>
      <div class="log-console" v-if="store.result">
        <div class="log-block"><div class="log-tag info">VIDEO INFO</div><pre class="log-text">{{ JSON.stringify(store.result.video_info, null, 2) }}</pre></div>
        <div class="log-block"><div class="log-tag warn">TRANSCRIPT</div><pre class="log-text">{{ store.result.transcript }}</pre></div>
        <div class="log-block"><div class="log-tag success">AI INSIGHTS</div><pre class="log-text">{{ JSON.stringify(store.result.insights, null, 2) }}</pre></div>
        <div class="log-block"><div class="log-tag">FULL MARKDOWN</div><pre class="log-text">{{ store.result.markdown }}</pre></div>
      </div>
      <n-text depth="3" v-else>No pipeline data yet.</n-text>
    </n-drawer-content></n-drawer>
  </div>
</template>

<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;background:#f5f5f5}
.app-root{height:100vh;display:grid;grid-template-rows:56px 1fr}
.app-header{display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:#fff;border-bottom:1px solid #e8e8e8;z-index:1}
.header-left{display:flex;align-items:center;gap:8px}
.app-main{overflow:hidden;display:flex;flex-direction:column;align-items:center;padding:24px;gap:16px}
.input-row{width:100%;max-width:780px;display:flex;gap:8px;flex-shrink:0}.input-row .n-input{flex:1;min-width:0}
.preview-card{width:100%;max-width:780px;flex-shrink:0;display:flex;gap:12px;align-items:center;background:#fff;border-radius:6px;padding:12px 16px;border:1px solid #e0ecff}
.preview-img{width:120px;height:68px;object-fit:cover;border-radius:4px}
.preview-info{display:flex;flex-direction:column;gap:4px;min-width:0}
.progress-row{width:100%;max-width:780px;flex-shrink:0;display:flex;flex-direction:column;gap:8px;background:#fff;border-radius:6px;padding:14px 20px;border:1px solid #e8e8e8}
.result-area{width:100%;max-width:780px;flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:#fff;border-radius:6px;border:1px solid #e8e8e8}
.result-topbar{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid #f0f0f0;flex-shrink:0}
.result-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
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
