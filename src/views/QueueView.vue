<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { NButton, NText, NIcon, NSpace, NSelect } from "naive-ui";
import { message } from "../utils/feedback";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
  Trash2,
  Play,
  Eye,
  CircleCheckBig,
  CircleX,
  RefreshCw,
  Copy,
  CircleStop,
  Check,
  List,
  RotateCw,
} from "lucide-vue-next";
import { useRouter } from "vue-router";
import { useAppStore } from "../stores/app";
import { useTemplateStore } from "../stores/templates";

const store = useAppStore();
const templateStore = useTemplateStore();
const router = useRouter();

const fmtDur = (sec: number) => {
  const h = Math.floor(sec / 3600),
    m = Math.floor((sec % 3600) / 60),
    s = sec % 60;
  return h > 0
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const fmtElapsed = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m${s}s`;
};

const templateOptions = computed(() => {
  const opts = templateStore.allTemplates.map((t, i) => ({ label: t.name, value: i }));
  return [
    {
      label: `默认（${templateStore.allTemplates[templateStore.selectedTemplateIndex]?.name ?? ""}）`,
      value: -1,
    },
    ...opts,
  ];
});

function startProcessing() {
  store.processQueue();
}
function stopProcessing() {
  const stopped = store.cancelQueue();
  message[stopped ? "success" : "info"](stopped ? "已停止 " + stopped + " 项处理" : "已停止处理");
}
function clearDone() {
  store.queue = store.queue.filter((q) => q.status !== "done" && q.status !== "error" && q.status !== "cancelled");
}
function viewResult(id: string) {
  router.push(`/result/${id}`);
}
const copyCopied = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | undefined;
async function copyAllTitles() {
  const text = store.queue.map((q) => q.pageInfo.part).join("\n");
  if (!text) return;
  try {
    await writeText(text);
    message.success(`已复制 ${store.queue.length} 个标题`);
    copyCopied.value = true;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (copyCopied.value = false), 2000);
  } catch (e: any) {
    message.error("复制失败: " + String(e));
  }
}
onUnmounted(() => {
  if (copyTimer) clearTimeout(copyTimer);
});
function updateItemTemplate(itemId: string, val: number) {
  const q = [...store.queue];
  const idx = q.findIndex((qi) => qi.id === itemId);
  if (idx < 0) return;
  q[idx] = { ...q[idx], templateIndex: val >= 0 ? val : undefined };
  store.queue = q;
}
</script>

<template>
  <div class="queue-root">
    <div class="queue-header">
      <div class="header-left">
        <span class="bar-ic queue"><n-icon :size="15"><List /></n-icon></span>
        <n-text strong class="page-title">处理队列</n-text>
        <span class="count-pill tnum">{{ store.queue.length }}</span>
      </div>
      <n-space :size="8">
        <n-button
          size="small"
          type="primary"
          @click="startProcessing"
          :disabled="store.isProcessing || store.queue.filter((q) => q.status === 'pending').length === 0"
        >
          <template #icon><n-icon><Play /></n-icon></template>开始处理
        </n-button>
        <n-button v-if="store.isProcessing" size="small" type="warning" @click="stopProcessing">
          <template #icon><n-icon><CircleStop /></n-icon></template>停止
        </n-button>
        <n-button
          size="small"
          @click="clearDone"
          :disabled="store.queue.filter((q) => q.status === 'done' || q.status === 'error' || q.status === 'cancelled').length === 0"
        >
          <template #icon><n-icon><Trash2 /></n-icon></template>清除已完成
        </n-button>
        <n-button size="small" @click="copyAllTitles" :disabled="store.queue.length === 0" :class="{ copied: copyCopied }">
          <template #icon><n-icon :color="copyCopied ? 'var(--color-success)' : undefined"><component :is="copyCopied ? Check : Copy" /></n-icon></template>{{ copyCopied ? "已复制" : "复制标题" }}
        </n-button>
      </n-space>
    </div>

    <div v-if="store.queue.length === 0" class="queue-empty">
      <div class="empty-icon"><n-icon :size="30"><List /></n-icon></div>
      <div class="empty-title">队列为空</div>
      <div class="empty-desc">返回首页添加视频后再来处理</div>
      <n-button type="primary" round @click="router.push('/')">去添加</n-button>
    </div>

    <div v-else class="queue-list">
      <div
        v-for="item in store.queue"
        :key="item.id"
        class="queue-item"
        :class="{ running: item.status === 'running', done: item.status === 'done', error: item.status === 'error', cancelled: item.status === 'cancelled' }"
      >
        <div class="q-row1">
          <span class="q-status">
            <n-icon v-if="item.status === 'done'" color="var(--color-success)" :size="17"><CircleCheckBig /></n-icon>
            <n-icon v-else-if="item.status === 'error'" color="var(--color-error)" :size="17"><CircleX /></n-icon>
            <n-icon v-else-if="item.status === 'running'" color="var(--color-brand)" :size="17" class="spinning"><RefreshCw /></n-icon>
            <n-icon v-else-if="item.status === 'cancelled'" color="var(--color-warning)" :size="17"><CircleStop /></n-icon>
            <span v-else class="q-pending-dot">&#9679;</span>
          </span>
          <span class="q-title" :title="item.pageInfo.part">{{ item.pageInfo.part }}</span>
          <div class="q-meta">
            <span class="q-dur tnum">{{ fmtDur(item.pageInfo.duration) }}</span>
            <span v-if="item.status !== 'done'" class="q-tag" :class="item.status">
              {{ item.status === "error" ? "失败" : item.status === "running" ? item.stageLabel : item.status === "cancelled" ? "已停止" : "等待" }}
            </span>
            <span class="q-elapsed tnum">{{ item.elapsedMs ? fmtElapsed(item.elapsedMs) : "" }}</span>
          </div>
          <div class="q-action">
            <n-select
              v-if="item.status === 'pending'"
              :value="item.templateIndex ?? -1"
              :options="templateOptions"
              size="tiny"
              :consistent-menu-width="false"
              class="q-tpl-select"
              @update:value="(v: number) => updateItemTemplate(item.id, v)"
            />
            <n-button v-if="item.status === 'running'" size="tiny" type="warning" secondary @click="store.cancelQueueItem(item.id)">
              <template #icon><n-icon :size="15"><CircleStop /></n-icon></template>
              取消
            </n-button>
            <n-button v-if="item.status === 'cancelled' || item.status === 'error'" size="tiny" type="primary" secondary @click="store.restartQueueItem(item.id)">
              <template #icon><n-icon :size="15"><RotateCw /></n-icon></template>
              重新开始
            </n-button>
            <n-button v-if="item.status === 'done'" size="tiny" type="primary" secondary @click="viewResult(item.id)">
              <template #icon><n-icon :size="15"><Eye /></n-icon></template>
              查看
            </n-button>
          </div>
        </div>
        <div v-if="item.status === 'running'" class="q-row2">
          <div class="q-progress">
            <div class="q-bar-fill" :style="{ width: Math.round(item.progress * 100) + '%' }"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.queue-root { height: 100%; overflow-y: auto; scrollbar-gutter: stable; padding: 28px 28px 40px; max-width: var(--content-max-wide); margin: 0 auto; width: 100%; }
.queue-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--color-border); }
/* ref: GitHub Actions sidebar -- compact toolbar buttons */
.queue-header .n-button { font-size: 11px !important; padding: 0 8px !important; min-width: unset !important; }
.queue-header .n-space { gap: 5px !important; flex-wrap: nowrap !important; }

.header-left { display: flex; align-items: center; gap: 10px; }
.bar-ic { width: 26px; height: 26px; border-radius: 7px; display: grid; place-items: center; }
.bar-ic.queue { background: var(--color-brand-soft); color: var(--color-brand); }
.page-title { font-size: var(--font-size-page); font-weight: 700; letter-spacing: -0.01em; }
.count-pill { min-width: 22px; height: 20px; padding: 0 7px; border-radius: var(--radius-full); background: var(--color-brand-soft); color: var(--color-brand); font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
.queue-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 88px 16px; text-align: center; animation: empty-enter 0.4s ease-out both; }
.empty-icon { width: 60px; height: 60px; border-radius: 16px; display: grid; place-items: center; background: var(--color-brand-soft); color: var(--color-brand); margin-bottom: 4px; }
.empty-title { font-size: 16px; font-weight: 650; }
.empty-desc { font-size: 13px; color: var(--color-text-secondary); margin-bottom: 6px; }
.queue-list { display: flex; flex-direction: column; gap: 8px; }
.queue-item { position: relative; display: flex; flex-direction: column; gap: 8px; padding: 13px 16px 12px 19px; background: var(--color-surface); border-radius: var(--radius-lg); border: 1px solid var(--color-border); box-shadow: var(--shadow-xs); transition: border-color var(--dur-2), box-shadow var(--dur-2); overflow: hidden; min-width: 0; }
.queue-item::before { content: ""; position: absolute; left: 0; top: 12px; bottom: 12px; width: 3px; border-radius: 0 2px 2px 0; background: transparent; transition: background var(--dur-2), box-shadow var(--dur-2); }
.queue-item:hover { border-color: var(--color-border-strong); box-shadow: var(--shadow-sm); }
.queue-item.running { border-color: var(--color-brand-border); }
.queue-item.running::before { background: var(--color-brand); box-shadow: var(--brand-glow-soft); }
.queue-item.done { border-color: var(--color-success-border); }
.queue-item.done::before { background: var(--color-success); }
.queue-item.error { border-color: var(--color-error-border); }
.queue-item.error::before { background: var(--color-error); }
.queue-item.cancelled { border-color: var(--color-warning-border); }
.queue-item.cancelled::before { background: var(--color-warning); }
.q-row1 { display: flex; align-items: center; gap: 12px; min-height: 26px; min-width: 0; width: 100%; }
.q-row2 { padding-left: 29px; }
.q-status { flex-shrink: 0; width: 20px; display: flex; align-items: center; justify-content: center; }
.q-pending-dot { color: var(--color-text-tertiary); }
.q-title { flex: 1; min-width: 0; font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.q-meta { flex-shrink: 0; display: flex; align-items: center; gap: 8px; }
.q-dur { font-size: 12px; color: var(--color-text-secondary); font-family: var(--font-mono); }
.q-tag { font-size: 11px; color: var(--color-text-secondary); padding: 2px 8px; border-radius: var(--radius-full); background: var(--color-ink-soft); font-family: var(--font-mono); font-weight: 600; }
.q-tag.running { color: var(--color-brand); background: var(--color-brand-soft); }
.q-tag.error { color: var(--color-error); background: var(--color-error-soft); }
.q-tag.cancelled { color: var(--color-warning); background: var(--color-warning-soft); }
.q-elapsed { font-size: 11px; color: var(--color-text-tertiary); font-family: var(--font-mono); }
.q-action { flex-shrink: 0; }
.q-tpl-select { width: 134px; flex-shrink: 0; }
/* ref: shadcn/ui copy button -- icon → check + green success tint, 2s auto-reset */
.n-button .n-icon { transition: transform var(--dur-2) var(--ease-out); }
.n-button.copied { --n-color: var(--color-success-soft) !important; --n-color-hover: var(--color-success-soft) !important; --n-color-pressed: var(--color-success-soft) !important; --n-color-focus: var(--color-success-soft) !important; --n-text-color: var(--color-success) !important; --n-text-color-hover: var(--color-success) !important; --n-text-color-focus: var(--color-success) !important; --n-border-color: var(--color-success-border) !important; --n-border-color-hover: var(--color-success-border) !important; --n-border-color-focus: var(--color-success-border) !important; }
.n-button.copied .n-icon { transform: scale(1.15); }
.q-progress { width: 100%; height: 4px; background: var(--color-brand-soft); border-radius: var(--radius-full); overflow: hidden; }
.q-bar-fill { height: 100%; background: linear-gradient(90deg, var(--color-brand-pressed), var(--color-brand), var(--color-brand-hover)); border-radius: var(--radius-full); transition: width 0.3s ease; box-shadow: var(--brand-glow-soft); position: relative; }
.q-bar-fill::after { content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 20px; background: linear-gradient(90deg, transparent, var(--color-brand-soft)); }
</style>
