<script setup lang="ts">
import { computed } from "vue";
import { NButton, NText, NIcon, NDivider, NDrawer, NDrawerContent } from "naive-ui";
import { ArrowBackOutline, CopyOutline, DownloadOutline, DocumentTextOutline } from "@vicons/ionicons5";
import { useRoute, useRouter } from "vue-router";
import { useAppStore } from "../stores/app";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const { message } = createDiscreteApi(["message"]);

const itemId = computed(() => route.params.id as string);
const item = computed(() => store.queue.find(q => q.id === itemId.value));

const markdown = computed(() => item.value?.result?.markdown ?? "");

const aiContent = computed(() => {
  const md = markdown.value;
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

function renderMarkdown(text: string) {
  let h = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>').replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/^---$/gm, '<hr>').replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
  return '<p>' + h + '</p>';
}

async function copyContent() {
  if (!item.value) return;
  try {
    await writeText(`【${item.value.pageInfo.part}】\n\n${aiContent.value}`);
    message.success("已复制");
  } catch (e: any) { message.error("复制失败: " + String(e)); }
}

async function exportFile() {
  if (!item.value?.result) return;
  try {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({ filters: [{ name: "Markdown", extensions: ["md"] }], defaultPath: `${item.value.pageInfo.part}.md` });
    if (path) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("save_result_to_file", { result: item.value.result, outputPath: path });
      message.success("导出成功");
    }
  } catch (e: any) { message.error("导出失败: " + String(e)); }
}
</script>

<template>
  <div class="result-root">
    <div class="result-header">
      <n-button text @click="router.push('/queue')"><template #icon><n-icon><ArrowBackOutline /></n-icon></template>返回队列</n-button>
      <n-text strong style="font-size:14px;flex:1;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0 12px;">
        {{ item?.pageInfo.part ?? "结果" }}
      </n-text>
      <div class="result-actions">
        <n-button size="small" @click="copyContent"><template #icon><n-icon><CopyOutline /></n-icon></template>复制</n-button>
        <n-button size="small" @click="exportFile"><template #icon><n-icon><DownloadOutline /></n-icon></template>导出</n-button>
      </div>
    </div>

    <div v-if="!item" class="result-empty">
      <n-text depth="3">未找到结果</n-text>
    </div>

    <div v-else class="result-body">
      <div class="ref-line">
        <span class="ref-bracket">【</span>{{ item.pageInfo.part }}<span class="ref-bracket">】</span>
        <span class="ref-source">{{ item.source === 'url' ? 'B站链接' : item.source === 'fav' ? '收藏夹' : '本地文件' }}</span>
      </div>
      <n-divider />
      <div class="md-preview" v-html="renderMarkdown(aiContent)" />
    </div>
  </div>
</template>

<style scoped>
.result-root { display: flex; flex-direction: column; height: 100%; }
.result-header {
  display: flex; align-items: center; padding: 12px 20px;
  background: #fff; border-bottom: 1px solid #eee; flex-shrink: 0;
}
.result-actions { display: flex; gap: 6px; flex-shrink: 0; }
.result-empty { flex: 1; display: flex; align-items: center; justify-content: center; }
.result-body { flex: 1; overflow-y: auto; padding: 20px 28px; max-width: 780px; margin: 0 auto; width: 100%; scrollbar-width: thin; scrollbar-color: #c0c0c0 transparent; }
.result-body::-webkit-scrollbar { width: 6px; }
.result-body::-webkit-scrollbar-track { background: transparent; }
.result-body::-webkit-scrollbar-thumb { background: #c0c0c0; border-radius: 3px; }
.result-body::-webkit-scrollbar-thumb:hover { background: #a0a0a0; }
.ref-line { font-size: 13px; color: #666; line-height: 1.7; padding: 8px 0; word-break: break-all; }
.ref-bracket { color: #999; }
.ref-source { color: #bbb; font-size: 11px; margin-left: 8px; }
.md-preview { line-height: 1.8; color: #333; }
.md-preview :deep(h1) { font-size: 20px; margin: 14px 0 10px; color: #111; }
.md-preview :deep(h2) { font-size: 16px; margin: 12px 0 8px; color: #222; }
.md-preview :deep(h3) { font-size: 14px; margin: 10px 0 6px; color: #333; }
.md-preview :deep(p) { margin: 5px 0; }
.md-preview :deep(strong) { color: #00aeec; }
.md-preview :deep(code) { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
.md-preview :deep(li) { margin-left: 22px; }
.md-preview :deep(hr) { border: none; border-top: 1px solid #eee; margin: 14px 0; }
</style>