<script setup lang="ts">
import { ref, computed } from "vue";
import { NButton, NIcon, createDiscreteApi } from "naive-ui";
import { ArrowLeft, File, X, Send } from "lucide-vue-next";
import { useRouter } from "vue-router";
import { useAppStore } from "../stores/app";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

const store = useAppStore();
const router = useRouter();
const { message } = createDiscreteApi(["message"]);

const filePath = ref("");
const fileName = ref("");
const fileSize = ref("");

const fmtsize = (bytes: number): string => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

async function pickFile() {
  try {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Audio/Video",
          extensions: ["mp3", "wav", "m4a", "aac", "flac", "ogg", "mp4", "mkv", "avi", "mov", "flv", "webm", "wmv"],
        },
      ],
    });
    if (selected) {
      const path = selected as string;
      filePath.value = path;
      fileName.value = path.split(/[\\/]/).pop() || path;
      try {
        const info = await invoke("plugin:fs|stat", { path });
        fileSize.value = fmtsize(info.size);
      } catch (_) {
        fileSize.value = "未知大小";
      }
    }
  } catch (e: any) {
    message.error("选择文件失败: " + String(e));
  }
}

const hasFile = computed(() => filePath.value !== "");

function clearFile() {
  filePath.value = "";
  fileName.value = "";
  fileSize.value = "";
}

function addToQueue() {
  if (!hasFile.value) {
    message.warning("请先选择一个本地音频或视频文件");
    return;
  }
  store.addQueueItem({
    url: filePath.value,
    pageInfo: { page: 1, part: fileName.value, cid: 0, duration: 0 },
    source: "local",
  });
  message.success("已将 " + fileName.value + " 添加到处理队列");
  clearFile();
}
</script>

<template>
  <div class="source-root">
    <div class="source-body">
      <n-button text size="tiny" class="back-link" @click="router.push('/')">
        <template #icon><n-icon :size="12"><ArrowLeft /></n-icon></template>返回
      </n-button>

      <div class="terminal">
        <div class="term-hdr">
          <span class="term-hdr-title">@channel</span>
          <span class="term-hdr-addr">// 本地文件</span>
          <span class="term-hdr-div"></span>
          <span class="term-hdr-stat">{{ hasFile ? '● READY' : '○ IDLE' }}</span>
        </div>

        <div class="term-screen">
          <div class="term-msg">
            <span class="term-msg-tag">[INFO]</span>
            导入本地音视频文件 · 适合已下载的课程、录屏或音频稿
          </div>

          <div class="term-drop" role="button" tabindex="0" @click="pickFile" @keydown.enter="pickFile">
            <div class="term-drop-row">
              <span class="term-cursor" :class="{ blink: !hasFile }">▮</span>
              <span class="term-drop-text">{{ hasFile ? '点击更换文件' : '点击选择文件...' }}</span>
            </div>
            <div class="term-drop-meta">mp3 / wav / m4a / flac / mp4 / mkv / avi / mov</div>
            <n-button size="small" quaternary type="warning" @click.stop="pickFile">浏览文件</n-button>
          </div>

          <div v-if="hasFile" class="term-file">
            <span class="term-file-time">{{ new Date().toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit',second:'2-digit'}) }}</span>
            <span class="term-file-ok">OK</span>
            <span class="term-file-name">{{ fileName }}</span>
            <span class="term-file-size">{{ fileSize }}</span>
            <n-button quaternary circle size="tiny" @click="clearFile" class="term-file-rm" title="移除">
              <template #icon><n-icon :size="14"><X /></n-icon></template>
            </n-button>
          </div>

          <div class="term-send">
            <n-button type="primary" size="large" round @click="addToQueue" :disabled="!hasFile || store.isProcessing">
              <template #icon><n-icon><Send /></n-icon></template>
              SEND
            </n-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.source-root { display: flex; flex-direction: column; height: 100%; overflow-y: auto; scrollbar-gutter: stable; }

/* --- Body --- */
.source-body { flex: 1; padding: 24px 28px 40px; max-width: var(--content-max-source); margin: 0 auto; width: 100%; display: flex; flex-direction: column; gap: 10px; }

/* --- Back link --- */
.back-link { align-self: flex-start; color: var(--color-text-tertiary); font-size: 12px; padding: 0; }

/* --- Terminal window --- */
/* ref: Steins;Gate Divergence Meter / @channel --- nixie tube amber terminal */
.terminal { border: 1px solid var(--color-log-border); border-radius: var(--radius-lg); background: var(--color-log-bg); overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }

/* Terminal header bar */
.term-hdr { display: flex; align-items: center; gap: 8px; padding: 7px 16px; background: rgba(255,255,255,0.025); border-bottom: 1px solid var(--color-log-border); font-family: var(--font-mono); font-size: 11px; }
/* ref: Steins;Gate Nixie Tube --- warm amber phosphor glow for terminal text */
.term-hdr-title { color: #FF8C42; font-weight: 700; letter-spacing: 0.03em; }
.term-hdr-addr { color: var(--color-text-tertiary); letter-spacing: 0.03em; }
.term-hdr-div { flex: 1; }
.term-hdr-stat { color: var(--color-text-secondary); font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; }

/* Terminal screen body */
.term-screen { flex: 1; padding: 20px 20px 24px; display: flex; flex-direction: column; gap: 16px; font-family: var(--font-mono); }

/* System message */
.term-msg { font-size: 13px; color: #FF8C42; opacity: 0.65; line-height: 1.6; }
.term-msg-tag { color: #FF8C42; font-weight: 600; margin-right: 6px; opacity: 1; }

/* Drop zone --- terminal prompt area */
/* ref: Steins;Gate Divergence Meter --- amber nixie tube prompt */
.term-drop { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 32px 20px; border: 1px dashed rgba(255, 140, 66, 0.22); border-radius: var(--radius-md); cursor: pointer; transition: border-color var(--dur-2), background var(--dur-2); }
.term-drop:hover { border-color: rgba(255, 140, 66, 0.5); background: rgba(255, 140, 66, 0.03); }
.term-drop-row { display: flex; align-items: center; gap: 8px; }
.term-cursor { color: #FF8C42; font-size: 14px; font-weight: 700; }
.term-cursor.blink { animation: cursor-blink 0.9s step-end infinite; }
.term-drop-text { color: #FF8C42; font-size: 14px; opacity: 0.7; }
.term-drop-meta { font-size: 11px; color: var(--color-text-tertiary); }

/* File loaded log line */
.term-file { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 10px 14px; border: 1px solid rgba(255, 140, 66, 0.15); border-radius: var(--radius-sm); background: rgba(255, 140, 66, 0.04); animation: fadeUp var(--dur-3) var(--ease-out); }
.term-file-time { color: var(--color-text-tertiary); font-size: 11px; }
.term-file-ok { color: #FF8C42; font-size: 11px; font-weight: 700; }
.term-file-name { color: #FF8C42; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.term-file-size { color: var(--color-text-secondary); font-size: 12px; }
.term-file-rm { opacity: 0.5; transition: opacity var(--dur-2); }
.term-file-rm:hover { opacity: 1; }

/* Send button area */
.term-send { padding-top: 6px; display: flex; justify-content: center; }

/* --- Animations --- */
@keyframes cursor-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

/* --- Light mode overrides --- */
/* ref: Steins;Gate lab notes --- warm amber ink on paper terminal */
[data-theme="light"] .terminal { border-color: var(--color-border-strong); background: var(--color-surface); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 1px 4px rgba(0, 0, 0, 0.06); }
[data-theme="light"] .term-hdr { background: var(--color-surface-muted); border-bottom-color: var(--color-border); }
[data-theme="light"] .term-hdr-title { color: #B5601E; }
[data-theme="light"] .term-msg,
[data-theme="light"] .term-msg-tag { color: #A05830; }
[data-theme="light"] .term-drop { border-color: var(--color-border); }
[data-theme="light"] .term-drop:hover { border-color: #B5601E; background: rgba(181, 96, 30, 0.06); }
[data-theme="light"] .term-cursor,
[data-theme="light"] .term-drop-text { color: #B5601E; }
[data-theme="light"] .term-file { border-color: rgba(181, 96, 30, 0.18); background: rgba(181, 96, 30, 0.04); }
[data-theme="light"] .term-file-ok,
[data-theme="light"] .term-file-name { color: #B5601E; }
</style>
