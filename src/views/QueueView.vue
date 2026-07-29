<script setup lang="ts">
import { ref, computed } from "vue";
import { NButton, NText, NIcon, NSpace, NSelect } from "naive-ui";
import {
  Trash2,
  Play,
  Eye,
  CircleCheckBig,
  CircleX,
  RefreshCw,
  Copy,
  CircleStop,
  List,
} from "lucide-vue-next";
import { useRouter } from "vue-router";
import { useAppStore } from "../stores/app";
import { useTemplateStore } from "../stores/templates";

const store = useAppStore();
const templateStore = useTemplateStore();
const router = useRouter();

// Split panel: selected item state
const selectedItemId = ref<string | null>(null);
const selectedItem = computed(() => {
  if (!selectedItemId.value) return null;
  return store.queue.find((q) => q.id === selectedItemId.value) || null;
});
function selectItem(id: string) {
  selectedItemId.value = selectedItemId.value === id ? null : id;
}

const fmtDur = (sec: number) => {
  const h = Math.floor(sec / 3600),
    m = Math.floor((sec % 3600) / 60),
    s = sec % 60;
  return h > 0
    ? String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0")
    : String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
};

const fmtElapsed = (ms: number) => {
  if (ms < 1000) return ms + "ms";
  if (ms < 60000) return (ms / 1000).toFixed(1) + "s";
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return m + "m" + s + "s";
};

const templateOptions = computed(() => {
  const opts = templateStore.allTemplates.map((t, i) => ({ label: t.name, value: i }));
  return [
    {
      label: "默认（" + (templateStore.allTemplates[templateStore.selectedTemplateIndex]?.name ?? "") + "）",
      value: -1,
    },
    ...opts,
  ];
});

function startProcessing() { store.processQueue(); }
function stopProcessing() { store.cancelQueue(); }
function clearDone() {
  store.queue = store.queue.filter((q) => q.status !== "done" && q.status !== "error");
  selectedItemId.value = null;
}
function viewResult(id: string) { router.push("/result/" + id); }
async function copyAllTitles() {
  const text = store.queue.map((q) => q.pageInfo.part).join("\n");
  try { await navigator.clipboard.writeText(text); } catch (_) {}
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
    <!-- Header: compressed with icon-only secondary actions (ref: Linear issue list toolbar) -->
    <div class="queue-header">
      <div class="header-left">
        <span class="bar-ic queue"><n-icon :size="15"><List /></n-icon></span>
        <n-text strong class="page-title">处理队列</n-text>
        <span class="count-pill tnum">{{ store.queue.length }}</span>
      </div>
      <div class="header-actions">
        <n-button size="tiny" type="primary" @click="startProcessing"
          :disabled="store.isProcessing || store.queue.filter((q) => q.status === 'pending').length === 0">
          <template #icon><n-icon><Play /></n-icon></template>开始处理
        </n-button>
        <n-button v-if="store.isProcessing" size="tiny" type="warning" @click="stopProcessing">
          <template #icon><n-icon><CircleStop /></n-icon></template>停止
        </n-button>
        <n-button size="tiny" @click="clearDone" title="清除已完成"
          :disabled="store.queue.filter((q) => q.status === 'done' || q.status === 'error').length === 0">
          <template #icon><n-icon><Trash2 /></n-icon></template>
        </n-button>
        <n-button size="tiny" @click="copyAllTitles" title="复制所有标题" :disabled="store.queue.length === 0">
          <template #icon><n-icon><Copy /></n-icon></template>
        </n-button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="store.queue.length === 0" class="queue-empty">
      <div class="empty-icon"><n-icon :size="30"><List /></n-icon></div>
      <div class="empty-title">队列为空</div>
      <div class="empty-desc">返回首页添加视频后再来处理</div>
      <n-button type="primary" round @click="router.push('/')">去添加</n-button>
    </div>

    <!-- Split panel body (ref: Linear issue list + detail panel) -->
    <div v-else class="queue-body">
      <!-- Left: compact queue list -->
      <div class="queue-list-panel">
        <div
          v-for="item in store.queue"
          :key="item.id"
          class="ql-item"
          :class="{ selected: selectedItemId === item.id, running: item.status === 'running', done: item.status === 'done', error: item.status === 'error' }"
          @click="selectItem(item.id)"
        >
          <span class="ql-status">
            <n-icon v-if="item.status === 'done'" color="var(--color-success)" :size="15"><CircleCheckBig /></n-icon>
            <n-icon v-else-if="item.status === 'error'" color="var(--color-error)" :size="15"><CircleX /></n-icon>
            <n-icon v-else-if="item.status === 'running'" color="var(--color-brand)" :size="15" class="spinning"><RefreshCw /></n-icon>
            <span v-else class="ql-dot">&#9679;</span>
          </span>
          <span class="ql-title">{{ item.pageInfo.part }}</span>
          <span v-if="item.status === 'running'" class="ql-progress-mini tnum">{{ Math.round(item.progress * 100) }}%</span>
        </div>
      </div>

      <!-- Right: detail panel -->
      <div class="queue-detail-panel">
        <div v-if="!selectedItem" class="detail-empty">
          <div class="empty-icon-wrap"><n-icon :size="22" color="var(--color-text-tertiary)"><List /></n-icon></div>
          <span>选择左侧项目查看详情</span>
        </div>
        <div v-else class="detail-content">
          <!-- Status header -->
          <div class="detail-status" :class="selectedItem.status">
            <n-icon v-if="selectedItem.status === 'done'" color="var(--color-success)" :size="18"><CircleCheckBig /></n-icon>
            <n-icon v-else-if="selectedItem.status === 'error'" color="var(--color-error)" :size="18"><CircleX /></n-icon>
            <n-icon v-else-if="selectedItem.status === 'running'" color="var(--color-brand)" :size="18" class="spinning"><RefreshCw /></n-icon>
            <span v-else class="detail-dot">&#9679;</span>
            <span class="detail-status-label">{{ selectedItem.status === 'done' ? '已完成' : selectedItem.status === 'error' ? '失败' : selectedItem.status === 'running' ? '处理中' : '等待中' }}</span>
          </div>

          <!-- Title -->
          <div class="detail-title">{{ selectedItem.pageInfo.part }}</div>

          <!-- Meta -->
          <div class="detail-meta">
            <span class="detail-dur tnum">{{ fmtDur(selectedItem.pageInfo.duration) }}</span>
            <span v-if="selectedItem.elapsedMs" class="detail-elapsed tnum">{{ fmtElapsed(selectedItem.elapsedMs) }}</span>
          </div>

          <!-- Progress bar (running only) -->
          <div v-if="selectedItem.status === 'running'" class="detail-progress">
            <div class="dp-bar">
              <div class="dp-fill" :style="{ width: Math.round(selectedItem.progress * 100) + '%' }"></div>
            </div>
            <span class="dp-pct tnum">{{ Math.round(selectedItem.progress * 100) }}%</span>
          </div>

          <!-- Actions (inline, not floating) -->
          <div class="detail-actions">
            <n-select
              v-if="selectedItem.status === 'pending'"
              :value="selectedItem.templateIndex ?? -1"
              :options="templateOptions"
              size="small"
              :consistent-menu-width="false"
              @update:value="(v: number) => updateItemTemplate(selectedItem.id, v)"
              class="detail-tpl"
            />
            <n-button v-if="selectedItem.status === 'done'" size="small" type="primary" secondary @click="viewResult(selectedItem.id)">
              <template #icon><n-icon :size="15"><Eye /></n-icon></template>查看结果
            </n-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.queue-root { display: flex; flex-direction: column; height: 100%; }

/* Header: compressed (ref: Linear issue list toolbar) */
.queue-header { display: flex; align-items: center; justify-content: space-between; padding: 0 20px; height: 44px; background: var(--color-surface); border-bottom: 1px solid var(--color-border); flex-shrink: 0; gap: 12px; }
.header-left { display: flex; align-items: center; gap: 10px; }
.bar-ic { width: 26px; height: 26px; border-radius: 7px; display: grid; place-items: center; }
.bar-ic.queue { background: var(--color-brand-soft); color: var(--color-brand); }
.page-title { font-size: 15px; font-weight: 700; }
.count-pill { min-width: 20px; height: 18px; padding: 0 6px; border-radius: var(--radius-full); background: var(--color-brand-soft); color: var(--color-brand); font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
.header-actions { display: flex; gap: 6px; flex-shrink: 0; }

/* Empty state */
.queue-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 88px 16px; text-align: center; }
.empty-icon { width: 60px; height: 60px; border-radius: 16px; display: grid; place-items: center; background: var(--color-brand-soft); color: var(--color-brand); margin-bottom: 4px; }
.empty-title { font-size: 16px; font-weight: 650; }
.empty-desc { font-size: 13px; color: var(--color-text-secondary); margin-bottom: 6px; }

/* Split body (ref: Linear issue list + VS Code debug sidebar) */
.queue-body { flex: 1; display: grid; grid-template-columns: 1fr 2fr; overflow: hidden; }

/* Left panel: compact queue list */
.queue-list-panel { overflow-y: auto; padding: 8px 0; }
.ql-item { display: flex; align-items: center; gap: 8px; padding: 8px 16px 8px 20px; cursor: pointer; transition: background var(--dur-1); border-left: 3px solid transparent; position: relative; }
.ql-item::before { content: ""; position: absolute; left: 0; top: 6px; bottom: 6px; width: 3px; border-radius: 0 2px 2px 0; background: transparent; transition: background var(--dur-2); }
.ql-item.running::before { background: var(--color-brand); }
.ql-item.done::before { background: var(--color-success); }
.ql-item.error::before { background: var(--color-error); }
.ql-item:hover { background: var(--color-ink-soft); }
.ql-item.selected { background: var(--color-brand-soft); border-left-color: var(--color-brand); }
.ql-status { width: 18px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.ql-dot { color: var(--color-text-tertiary); }
.ql-title { flex: 1; min-width: 0; font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ql-progress-mini { font-family: var(--font-mono); font-size: 11px; color: var(--color-brand); font-weight: 600; flex-shrink: 0; }

/* Right panel: detail */
.queue-detail-panel { overflow-y: auto; padding: 20px 24px; border-left: 1px solid var(--color-border); }
.detail-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 8px; color: var(--color-text-tertiary); font-size: 13px; }
.empty-icon-wrap { width: 44px; height: 44px; border-radius: 10px; background: var(--color-ink-soft); display: grid; place-items: center; }
.detail-content { display: flex; flex-direction: column; gap: 16px; }
.detail-status { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
.detail-status-label { color: var(--color-text); }
.detail-dot { color: var(--color-text-tertiary); }
.detail-title { font-size: 18px; font-weight: 700; color: var(--color-text); line-height: 1.4; }
.detail-meta { display: flex; gap: 16px; font-size: 13px; color: var(--color-text-secondary); }
.detail-dur { font-family: var(--font-mono); }
.detail-elapsed { font-family: var(--font-mono); color: var(--color-text-tertiary); }

/* Progress bar in detail panel */
.detail-progress { display: flex; align-items: center; gap: 12px; }
.dp-bar { flex: 1; height: 6px; background: rgba(111,181,132,0.08); border-radius: var(--radius-full); overflow: hidden; }
.dp-fill { height: 100%; background: linear-gradient(90deg, #5ea272, #6fb584, #81c193); border-radius: var(--radius-full); transition: width 0.3s ease; box-shadow: var(--brand-glow-soft); position: relative; }
.dp-fill::after { content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 20px; background: linear-gradient(90deg, transparent, rgba(111,181,132,0.3)); animation: phosphorScan 2s ease-in-out infinite; }
.dp-pct { font-family: var(--font-mono); font-size: 12px; font-weight: 700; color: var(--color-brand); min-width: 36px; text-align: right; }

/* Actions */
.detail-actions { padding-top: 4px; }
.detail-tpl { max-width: 240px; }

/* Responsive */
@media (max-width: 860px) {
  .queue-body { grid-template-columns: 1fr; }
  .queue-list-panel { max-height: 40%; border-bottom: 1px solid var(--color-border); }
  .queue-detail-panel { border-left: none; }
}
</style>
