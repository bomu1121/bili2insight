<script setup lang="ts">
import { computed } from "vue";
import { NButton, NText, NIcon, NSpace, NSelect } from "naive-ui";
import {
  TrashOutline,
  PlayOutline,
  EyeOutline,
  CheckmarkCircle,
  CloseCircle,
  SyncOutline,
  CopyOutline,
  StopCircleOutline,
  ListOutline,
} from "@vicons/ionicons5";
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
  store.cancelQueue();
}
function clearDone() {
  store.queue = store.queue.filter((q) => q.status !== "done" && q.status !== "error");
}
function viewResult(id: string) {
  router.push(`/result/${id}`);
}
async function copyAllTitles() {
  const text = store.queue.map((q) => q.pageInfo.part).join("\n");
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {}
}
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
        <span class="bar-ic queue"><n-icon :size="15"><ListOutline /></n-icon></span>
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
          <template #icon><n-icon><PlayOutline /></n-icon></template>开始处理
        </n-button>
        <n-button v-if="store.isProcessing" size="small" type="warning" @click="stopProcessing">
          <template #icon><n-icon><StopCircleOutline /></n-icon></template>停止
        </n-button>
        <n-button
          size="small"
          @click="clearDone"
          :disabled="store.queue.filter((q) => q.status === 'done' || q.status === 'error').length === 0"
        >
          <template #icon><n-icon><TrashOutline /></n-icon></template>清除已完成
        </n-button>
        <n-button size="small" @click="copyAllTitles" :disabled="store.queue.length === 0">
          <template #icon><n-icon><CopyOutline /></n-icon></template>复制标题
        </n-button>
      </n-space>
    </div>

    <div v-if="store.queue.length === 0" class="queue-empty">
      <div class="empty-icon"><n-icon :size="30"><ListOutline /></n-icon></div>
      <div class="empty-title">队列为空</div>
      <div class="empty-desc">返回首页添加视频后再来处理</div>
      <n-button type="primary" round @click="router.push('/')">去添加</n-button>
    </div>

    <div v-else class="queue-list">
      <div
        v-for="item in store.queue"
        :key="item.id"
        class="queue-item"
        :class="{ running: item.status === 'running', done: item.status === 'done', error: item.status === 'error' }"
      >
        <div class="q-row1">
          <span class="q-status">
            <n-icon v-if="item.status === 'done'" color="var(--color-success)" :size="17"><CheckmarkCircle /></n-icon>
            <n-icon v-else-if="item.status === 'error'" color="var(--color-error)" :size="17"><CloseCircle /></n-icon>
            <n-icon v-else-if="item.status === 'running'" color="var(--color-brand)" :size="17" class="spinning"><SyncOutline /></n-icon>
            <span v-else class="q-pending-dot">&#9679;</span>
          </span>
          <span class="q-title" :title="item.pageInfo.part">{{ item.pageInfo.part }}</span>
          <div class="q-meta">
            <span class="q-dur tnum">{{ fmtDur(item.pageInfo.duration) }}</span>
            <span v-if="item.status !== 'done'" class="q-tag" :class="item.status">
              {{ item.status === "error" ? "失败" : item.status === "running" ? item.stageLabel : "等待" }}
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
            <n-button v-if="item.status === 'done'" size="tiny" type="primary" secondary @click="viewResult(item.id)">
              <template #icon><n-icon :size="15"><EyeOutline /></n-icon></template>
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
.queue-root {
  height: 100%;
  overflow: auto;
  padding: 28px 28px 40px;
  max-width: var(--content-max-wide);
  margin: 0 auto;
  width: 100%;
}
.queue-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.bar-ic {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  display: grid;
  place-items: center;
}
.bar-ic.queue {
  background: var(--color-brand-soft);
  color: var(--color-brand);
}
.page-title {
  font-size: var(--font-size-page);
  font-weight: 700;
  letter-spacing: -0.01em;
}
.count-pill {
  min-width: 22px;
  height: 20px;
  padding: 0 7px;
  border-radius: var(--radius-full);
  background: var(--color-ink-soft);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* ===== 空状态 ===== */
.queue-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 88px 16px;
  text-align: center;
}
.empty-icon {
  width: 60px;
  height: 60px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: var(--color-brand-soft);
  color: var(--color-brand);
  margin-bottom: 4px;
}
.empty-title {
  font-size: 16px;
  font-weight: 650;
}
.empty-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}

/* ===== 队列项 ===== */
.queue-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.queue-item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 13px 16px 12px 19px;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-xs);
  transition: border-color var(--dur-1), box-shadow var(--dur-2);
  overflow: hidden;
  min-width: 0;
}
.queue-item::before {
  content: "";
  position: absolute;
  left: 0;
  top: 12px;
  bottom: 12px;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: transparent;
}
.queue-item:hover {
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-card);
}
.queue-item.running {
  border-color: var(--color-brand-border);
}
.queue-item.running::before {
  background: var(--color-brand);
}
.queue-item.done {
  border-color: var(--color-success-border);
}
.queue-item.done::before {
  background: var(--color-success);
}
.queue-item.error {
  border-color: var(--color-error-border);
}
.queue-item.error::before {
  background: var(--color-error);
}
.q-row1 {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 26px;
  min-width: 0;
  width: 100%;
}
.q-row2 {
  padding-left: 29px;
}
.q-status {
  flex-shrink: 0;
  width: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.q-pending-dot {
  color: var(--color-text-tertiary);
}
.q-title {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.q-meta {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.q-dur {
  font-size: 12px;
  color: var(--color-text-secondary);
}
.q-tag {
  font-size: 11px;
  color: var(--color-text-secondary);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--color-ink-soft);
}
.q-tag.running {
  color: var(--color-brand-pressed);
  background: var(--color-brand-soft);
}
.q-tag.error {
  color: var(--color-error);
  background: var(--color-error-soft);
}
.q-elapsed {
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.q-action {
  flex-shrink: 0;
}
.q-tpl-select {
  width: 88px;
}
.q-tpl-select :deep(.n-base-selection) {
  --n-height: 26px;
  font-size: 11px;
}
.q-progress {
  width: 100%;
  height: 4px;
  background: var(--color-brand-soft);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.q-bar-fill {
  height: 100%;
  background: var(--color-brand);
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}
</style>
