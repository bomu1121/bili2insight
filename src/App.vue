<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import {
  NLayout, NLayoutHeader, NLayoutContent,
  NCard, NInput, NButton, NSpace, NProgress,
  NText, NIcon, NScrollbar, useMessage,
  NDrawer, NDrawerContent, NInputGroup,
} from "naive-ui";
import {
  PlayOutline, DownloadOutline, CopyOutline,
  SettingsSharp, VideocamOutline,
} from "@vicons/ionicons5";
import { useAppStore } from "./stores/app";

const store = useAppStore();
const message = useMessage();
const showSettings = ref(false);

onMounted(() => store.init());
onUnmounted(() => store.cleanup());

function handleStart() {
  store.startPipeline();
}

watch(() => store.error, (val) => {
  if (val) message.error(val);
});

async function copyMarkdown() {
  if (!store.result) return;
  const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
  await writeText(store.result.markdown);
  message.success("Copied to clipboard");
}

function stageLabel(stage: string) {
  const map: Record<string, string> = {
    download: "Downloading",
    ffmpeg: "Converting",
    asr: "Transcribing",
    ai: "AI Analyzing",
    done: "Done",
  };
  return map[stage] || stage;
}

function renderMarkdown(text: string) {
  let html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  html = '<p>' + html + '</p>';
  return html;
}
</script>

<template>
  <n-layout style="height: 100vh; background: #f5f5f5;">
    <n-layout-header bordered style="height: 56px; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; background: #fff;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <n-icon size="24" color="#00aeec">
          <VideocamOutline />
        </n-icon>
        <n-text strong style="font-size: 18px;">Bili2Insight</n-text>
      </div>
      <n-button text @click="showSettings = true">
        <template #icon><n-icon><SettingsSharp /></n-icon></template>
        Settings
      </n-button>
    </n-layout-header>

    <n-layout-content style="padding: 24px; display: flex; flex-direction: column; gap: 16px; align-items: center;">
      <!-- URL Input -->
      <n-card style="width: 100%; max-width: 800px;" size="small">
        <n-space vertical style="width: 100%;">
          <n-text>Bilibili Video URL</n-text>
          <n-input-group>
            <n-input
              v-model:value="store.url"
              placeholder="https://www.bilibili.com/video/BV..."
              :disabled="store.processing"
              clearable
              @keyup.enter="handleStart"
            />
            <n-button
              type="primary"
              @click="handleStart"
              :loading="store.processing"
              :disabled="!store.url.trim()"
            >
              <template #icon><n-icon><PlayOutline /></n-icon></template>
              Start
            </n-button>
          </n-input-group>
        </n-space>
      </n-card>

      <!-- Progress -->
      <n-card v-if="store.processing || store.progress" style="width: 100%; max-width: 800px;" size="small">
        <n-space vertical style="width: 100%;">
          <n-space justify="space-between">
            <n-text>{{ store.progress ? stageLabel(store.progress.stage) : "Processing..." }}</n-text>
            <n-text depth="3">{{ store.progress ? Math.round(store.progress.progress * 100) : 0 }}%</n-text>
          </n-space>
          <n-progress
            type="line"
            :percentage="store.progress ? Math.round(store.progress.progress * 100) : 0"
            :indicator-placement="'inside'"
            :height="24"
            :border-radius="4"
          />
          <n-text depth="3" v-if="store.progress?.message">{{ store.progress.message }}</n-text>
        </n-space>
      </n-card>

      <!-- Result -->
      <n-card v-if="store.result" size="small" style="width: 100%; max-width: 800px; flex: 1; overflow: hidden;">
        <template #header>
          <n-space justify="space-between" align="center">
            <n-text strong>{{ store.result.video_info.title }}</n-text>
            <n-space>
              <n-button size="small" @click="copyMarkdown">
                <template #icon><n-icon><CopyOutline /></n-icon></template>
                Copy
              </n-button>
              <n-button size="small" @click="store.exportToFile()">
                <template #icon><n-icon><DownloadOutline /></n-icon></template>
                Export MD
              </n-button>
            </n-space>
          </n-space>
        </template>
        <n-scrollbar style="max-height: calc(100vh - 380px);">
          <div class="md-preview" v-html="renderMarkdown(store.result.markdown)" />
        </n-scrollbar>
      </n-card>

      <!-- Empty state -->
      <n-card v-if="!store.result && !store.processing" style="width: 100%; max-width: 800px; text-align: center; padding: 60px 0;">
        <n-text depth="3" style="font-size: 14px;">
          Enter a Bilibili video URL, auto download audio - ASR transcription - AI insight extraction - Markdown output
        </n-text>
      </n-card>
    </n-layout-content>
  </n-layout>

  <!-- Settings Drawer -->
  <n-drawer v-model:show="showSettings" width="400">
    <n-drawer-content title="Settings" closable>
      <n-space vertical style="gap: 16px;">
        <div>
          <n-text depth="3" style="font-size: 12px; margin-bottom: 4px;">HTTP Proxy</n-text>
          <n-input v-model:value="store.proxy" placeholder="http://127.0.0.1:7897" size="small" />
        </div>
        <div>
          <n-text depth="3" style="font-size: 12px; margin-bottom: 4px;">AI API URL</n-text>
          <n-input v-model:value="store.aiApiUrl" placeholder="https://api.openai.com/v1/chat/completions" size="small" />
        </div>
        <div>
          <n-text depth="3" style="font-size: 12px; margin-bottom: 4px;">AI API Key</n-text>
          <n-input v-model:value="store.aiApiKey" type="password" placeholder="sk-..." size="small" show-password-on="click" />
        </div>
        <div>
          <n-text depth="3" style="font-size: 12px; margin-bottom: 4px;">AI Model</n-text>
          <n-input v-model:value="store.aiModel" placeholder="gpt-4o-mini" size="small" />
        </div>
        <div>
          <n-text depth="3" style="font-size: 12px; margin-bottom: 4px;">AI Prompt</n-text>
          <n-input v-model:value="store.aiPrompt" type="textarea" :rows="4" size="small" />
        </div>
      </n-space>
    </n-drawer-content>
  </n-drawer>
</template>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; }
.md-preview { line-height: 1.8; color: #333; }
.md-preview h1 { font-size: 22px; margin: 16px 0 12px; color: #111; }
.md-preview h2 { font-size: 18px; margin: 14px 0 10px; color: #222; }
.md-preview h3 { font-size: 15px; margin: 12px 0 8px; color: #333; }
.md-preview p { margin: 6px 0; }
.md-preview strong { color: #00aeec; }
.md-preview code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
.md-preview li { margin-left: 24px; }
.md-preview hr { border: none; border-top: 1px solid #eee; margin: 16px 0; }
</style>
