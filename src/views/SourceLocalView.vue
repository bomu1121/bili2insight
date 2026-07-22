<script setup lang="ts">
import { ref, computed } from "vue";
import { NButton, NText, NIcon, createDiscreteApi } from "naive-ui";
import { AddCircleOutline, ArrowBackOutline, CloudUploadOutline, DocumentOutline, CloseOutline } from "@vicons/ionicons5";
import { useRouter } from "vue-router";
import { useAppStore } from "../stores/app";
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
        const stat = await import("@tauri-apps/plugin-fs").then((m) => m.stat(path));
        fileSize.value = fmtsize(stat.size);
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
  message.success(`已将 ${fileName.value} 添加到处理队列`);
  clearFile();
}
</script>

<template>
  <div class="source-root">
    <div class="page-bar">
      <n-button text class="bar-back" @click="router.push('/')">
        <template #icon><n-icon><ArrowBackOutline /></n-icon></template>返回
      </n-button>
      <div class="bar-title">
        <span class="bar-ic local"><n-icon :size="15"><CloudUploadOutline /></n-icon></span>
        <n-text strong>本地文件</n-text>
      </div>
    </div>

    <div class="source-body">
      <div class="intro-card">
        <div class="intro-title">导入本地音视频</div>
        <div class="intro-desc">适合已下载的课程、录屏或音频稿，无需登录 B 站</div>
      </div>

      <div class="upload-area" role="button" tabindex="0" @click="pickFile" @keydown.enter="pickFile">
        <div class="upload-icon">
          <n-icon :size="30"><CloudUploadOutline /></n-icon>
        </div>
        <div class="upload-title">点击选择文件</div>
        <div class="upload-hint">支持 mp3 / wav / m4a / flac / mp4 / mkv 等</div>
        <n-button size="small" secondary type="success" @click.stop="pickFile">浏览文件</n-button>
      </div>

      <div v-if="hasFile" class="file-card">
        <div class="file-icon"><n-icon :size="20"><DocumentOutline /></n-icon></div>
        <div class="file-info">
          <div class="file-name">{{ fileName }}</div>
          <div class="file-size tnum">{{ fileSize }}</div>
        </div>
        <n-button quaternary circle size="small" @click="clearFile" title="移除">
          <template #icon><n-icon><CloseOutline /></n-icon></template>
        </n-button>
      </div>

      <n-button type="primary" block size="large" round @click="addToQueue" :disabled="!hasFile || store.isProcessing">
        <template #icon><n-icon><AddCircleOutline /></n-icon></template>
        加入队列
      </n-button>
    </div>
  </div>
</template>

<style scoped>
.source-root {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.page-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: var(--header-height);
  padding: 0 20px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.bar-back {
  color: var(--color-text-secondary);
}
.bar-title {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 15px;
}
.bar-ic {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  display: grid;
  place-items: center;
}
.bar-ic.local {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.source-body {
  flex: 1;
  padding: 32px 28px 40px;
  max-width: var(--content-max-source);
  margin: 0 auto;
  width: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.intro-card {
  padding: 0 2px 6px;
}
.intro-title {
  font-size: var(--font-size-page);
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--color-text);
  margin-bottom: 7px;
}
.intro-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

/* ===== 投放区 ===== */
.upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 230px;
  padding: 40px 24px;
  border: 1.5px dashed var(--color-border-strong);
  border-radius: var(--radius-xl);
  cursor: pointer;
  background: var(--color-surface);
  transition:
    border-color var(--dur-2),
    background var(--dur-2),
    transform var(--dur-2) var(--ease-out),
    box-shadow var(--dur-2);
}
.upload-area:hover {
  border-color: var(--color-success);
  background: var(--color-success-soft);
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(24, 160, 88, 0.1);
}
.upload-icon {
  width: 60px;
  height: 60px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: var(--color-success-soft);
  color: var(--color-success);
  margin-bottom: 4px;
  transition: background var(--dur-2);
}
.upload-area:hover .upload-icon {
  background: #fff;
}
.upload-title {
  font-size: 15px;
  font-weight: 650;
  color: var(--color-text);
}
.upload-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}

/* ===== 已选文件 ===== */
.file-card {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 13px 14px;
  background: var(--color-surface);
  border: 1px solid var(--color-success-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xs);
  animation: fadeUp var(--dur-3) var(--ease-out);
}
.file-icon {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  background: var(--color-success-soft);
  color: var(--color-success);
  border-radius: 10px;
  flex-shrink: 0;
}
.file-info {
  flex: 1;
  min-width: 0;
}
.file-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-size {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}
</style>
