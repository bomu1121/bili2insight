<script setup lang="ts">
import { ref, computed } from "vue";
import { NButton, NText, NIcon, NCard, createDiscreteApi } from "naive-ui";
import { AddCircleOutline, ArrowBackOutline, CloudUploadOutline, DocumentOutline } from "@vicons/ionicons5";
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
        { name: "Audio/Video", extensions: ["mp3", "wav", "m4a", "aac", "flac", "ogg", "mp4", "mkv", "avi", "mov", "flv", "webm", "wmv"] },
      ],
    });
    if (selected) {
      const path = selected as string;
      filePath.value = path;
      fileName.value = path.split(/[\\/]/).pop() || path;
      try {
        const stat = await import("@tauri-apps/plugin-fs").then(m => m.stat(path));
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
  filePath.value = "";
  fileName.value = "";
  fileSize.value = "";
}
</script>

<template>
  <div class="source-root">
    <div class="source-bar">
      <n-button text @click="router.push('/')"><template #icon><n-icon><ArrowBackOutline /></n-icon></template>返回</n-button>
      <n-text strong style="font-size:15px;">本地文件</n-text>
    </div>

    <div class="source-body">
      <div class="upload-area" @click="pickFile">
        <n-icon size="48" color="#ccc"><CloudUploadOutline /></n-icon>
        <n-text depth="3" style="margin-top:12px;">点击选择本地音频或视频文件</n-text>
        <n-text depth="3" style="font-size:11px;margin-top:4px;">支持 mp3, wav, m4a, flac, mp4, mkv 等格式</n-text>
      </div>

      <div v-if="hasFile" class="file-card">
        <div class="file-icon"><n-icon size="22" color="#18a058"><DocumentOutline /></n-icon></div>
        <div class="file-info">
          <n-text style="font-size:14px;font-weight:500;">{{ fileName }}</n-text>
          <n-text depth="3" style="font-size:12px;">{{ fileSize }}</n-text>
        </div>
      </div>

      <n-button type="primary" block @click="addToQueue" :disabled="!hasFile || store.isProcessing" style="margin-top:12px;">
        <template #icon><n-icon><AddCircleOutline /></n-icon></template>加入队列
      </n-button>
    </div>
  </div>
</template>

<style scoped>
.source-root { display: flex; flex-direction: column; height: 100%; }
.source-bar { display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: #fff; border-bottom: 1px solid #eee; flex-shrink: 0; }
.source-body { flex: 1; padding: 24px; max-width: 680px; margin: 0 auto; width: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
.upload-area {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 48px 24px; border: 2px dashed #ddd; border-radius: 12px;
  cursor: pointer; transition: all .2s; background: #fafafa;
}
.upload-area:hover { border-color: #18a058; background: #f6ffed; }
.file-card {
  display: flex; align-items: center; gap: 14px; padding: 14px 16px;
  background: #f6ffed; border: 1px solid #c8e8b8; border-radius: 10px;
}
.file-icon { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: #e8f8e8; border-radius: 8px; flex-shrink: 0; }
.file-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
</style>
