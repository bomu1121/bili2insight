<script setup lang="ts">
import { computed, ref } from "vue";
import { NButton, NText, NIcon, NDivider, NDrawer, NDrawerContent } from "naive-ui";
import { ArrowBackOutline, CopyOutline, DownloadOutline, DocumentTextOutline } from "@vicons/ionicons5";
import { useRoute, useRouter } from "vue-router";
import { useAppStore } from "../stores/app";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { createDiscreteApi } from "naive-ui";
import { renderMarkdown } from "../utils/markdown";

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const { message } = createDiscreteApi(["message"]);
const showLog = ref(false);

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
  return section.trim();
});


async function copyContent() {
  if (!item.value) return;
  try {
    await writeText(`【${item.value.pageInfo.part}】 ${item.value.url}\n\n${aiContent.value}`);
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
      <n-button text @click="router.push('/')">
        <template #icon><n-icon><ArrowBackOutline /></n-icon></template>返回首页
      </n-button>
      <n-text strong class="result-title">
        {{ item?.pageInfo.part ?? "结果" }}
      </n-text>
      <div class="result-actions">
        <n-button size="small" secondary @click="copyContent">
          <template #icon><n-icon><CopyOutline /></n-icon></template>复制
        </n-button>
        <n-button size="small" type="primary" @click="exportFile">
          <template #icon><n-icon><DownloadOutline /></n-icon></template>导出
        </n-button>
        <n-button size="small" quaternary @click="showLog = true">
          <template #icon><n-icon><DocumentTextOutline /></n-icon></template>日志
        </n-button>
      </div>
    </div>

    <div v-if="!item" class="result-empty">
      <div class="empty-icon"><n-icon :size="32"><DocumentTextOutline /></n-icon></div>
      <div class="empty-title">未找到结果</div>
      <div class="empty-desc">该任务可能已从队列中清除</div>
    </div>

    <div v-else class="result-scroll">
      <article class="result-body">
        <header class="doc-header">
          <div class="doc-kicker">AI 观点笔记</div>
          <h1 class="doc-title">{{ item.pageInfo.part }}</h1>
          <div class="doc-meta">
            <span class="source-pill">{{ item.source === 'url' ? 'B站链接' : item.source === 'fav' ? '收藏夹' : '本地文件' }}</span>
            <a v-if="item.source !== 'local'" :href="item.url" target="_blank" class="ref-link">{{ item.url }}</a>
            <span v-else class="ref-path">{{ item.url }}</span>
          </div>
        </header>
        <n-divider />
        <div class="md-preview" v-html="renderMarkdown(aiContent)" />
      </article>
    </div>
    <n-drawer v-model:show="showLog" width="640">
      <n-drawer-content title="流水线日志" closable>
        <div class="log-console" v-if="item">
          <div class="log-block"><div class="log-tag info">视频信息</div><pre class="log-text">{{ JSON.stringify(item.result?.video_info, null, 2) }}</pre></div>
          <div class="log-block"><div class="log-tag success">AI 观点提炼</div><pre class="log-text">{{ JSON.stringify(item.result?.insights, null, 2) }}</pre></div>
          <div class="log-block"><div class="log-tag warn">ASR 原始识别（未校对）</div><pre class="log-text">{{ item.result?.raw_transcript }}</pre></div>
          <div class="log-block"><div class="log-tag warn">AI 请求</div><pre class="log-text">{{ item.result?.ai_request }}</pre></div>
          <div class="log-block"><div class="log-tag">AI 原始响应</div><pre class="log-text">{{ item.result?.ai_raw_response }}</pre></div>
        </div>
        <n-text depth="3" v-else>暂无流水线数据。</n-text>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<style scoped>
.result-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background:
    radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0, 174, 236, 0.06), transparent 55%),
    var(--color-bg);
}
.result-header {
  display: flex;
  align-items: center;
  padding: 10px 18px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  gap: 12px;
}
.result-title {
  flex: 1;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  margin: 0;
}
.result-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.result-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  background: var(--color-brand-soft);
  color: var(--color-brand);
}
.empty-title {
  font-size: 16px;
  font-weight: 650;
}
.empty-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
}
.result-scroll {
  flex: 1;
  overflow-y: auto;
}
.result-body {
  margin: 24px auto 40px;
  padding: 28px 32px 36px;
  max-width: var(--content-max-result);
  width: calc(100% - 40px);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 18px;
  box-shadow: var(--shadow-sm);
}
.doc-header {
  margin-bottom: 4px;
}
.doc-kicker {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-brand);
  letter-spacing: 0.04em;
  margin-bottom: 8px;
}
.doc-title {
  margin: 0 0 12px;
  font-size: 24px;
  font-weight: 750;
  line-height: 1.35;
  letter-spacing: -0.02em;
  color: var(--color-text);
}
.doc-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.source-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--color-brand-soft);
  color: var(--color-brand);
  font-weight: 600;
}
.ref-link {
  color: var(--color-text-secondary);
  text-decoration: none;
  word-break: break-all;
}
.ref-link:hover {
  color: var(--color-brand);
}
.ref-path {
  word-break: break-all;
}
.md-preview {
  line-height: 1.85;
  color: var(--color-text);
  font-size: 15px;
}
.md-preview :deep(h1) {
  font-size: 22px;
  margin: 20px 0 10px;
  letter-spacing: -0.02em;
}
.md-preview :deep(h2) {
  font-size: 17px;
  margin: 18px 0 8px;
}
.md-preview :deep(h3) {
  font-size: 15px;
  margin: 14px 0 6px;
}
.md-preview :deep(p) {
  margin: 8px 0;
}
.md-preview :deep(strong) {
  color: var(--color-brand);
}
.md-preview :deep(code) {
  background: var(--color-bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}
.md-preview :deep(li) {
  margin-left: 22px;
  margin-bottom: 4px;
}
.md-preview :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 18px 0;
}
.log-console {
  background: var(--color-log-bg);
  color: var(--color-log-text);
  border-radius: 12px;
  padding: 16px;
  font-family: "Cascadia Code", "Fira Code", Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  max-height: calc(100vh - 140px);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-log-thumb) var(--color-log-track);
}
.log-console::-webkit-scrollbar {
  width: 5px;
}
.log-console::-webkit-scrollbar-track {
  background: var(--color-log-track);
}
.log-console::-webkit-scrollbar-thumb {
  background: var(--color-log-thumb);
  border-radius: 2px;
}
.log-console::-webkit-scrollbar-thumb:hover {
  background: var(--color-log-thumb-hover);
}
.log-block {
  margin-bottom: 16px;
  border-bottom: 1px solid var(--color-log-border);
  padding-bottom: 12px;
}
.log-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #fff;
  background: var(--color-text-secondary);
}
.log-tag.info {
  background: var(--color-info);
}
.log-tag.warn {
  background: var(--color-warning);
}
.log-tag.success {
  background: var(--color-success);
}
.log-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--color-log-text);
  max-height: 320px;
  overflow-y: auto;
}
</style>


