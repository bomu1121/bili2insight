<script setup lang="ts">
import { computed } from "vue";
import { NButton, NText, NIcon, NSpace, NSelect } from "naive-ui";
import { ArrowBackOutline, TrashOutline, PlayOutline, EyeOutline, CheckmarkCircle, CloseCircle, SyncOutline, CopyOutline } from "@vicons/ionicons5";
import { useRouter } from "vue-router";
import { useAppStore } from "../stores/app";

const store = useAppStore();
const router = useRouter();

const fmtDur = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const fmtElapsed = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m${s}s`;
};

const templateOptions = computed(() => {
  const opts = store.allTemplates.map((t, i) => ({ label: t.name, value: i }));
  return [{ label: `默认（${store.allTemplates[store.selectedTemplateIndex]?.name ?? ""}）`, value: -1 }, ...opts];
});

function startProcessing() { store.processQueue(); }
function clearDone() { store.queue = store.queue.filter(q => q.status !== "done" && q.status !== "error"); }
function viewResult(id: string) { router.push(`/result/${id}`); }
async function copyAllTitles() {
  const text = store.queue.map(q => q.pageInfo.part).join('\n');
  try { await navigator.clipboard.writeText(text); } catch (_) {}
}
function updateItemTemplate(itemId: string, val: number) {
  const q = [...store.queue];
  const idx = q.findIndex(qi => qi.id === itemId);
  if (idx < 0) return;
  q[idx] = { ...q[idx], templateIndex: val >= 0 ? val : undefined };
  store.queue = q;
}
</script>

<template>
  <div class="queue-root">
    <div class="queue-header">
      <n-button text @click="router.push('/')"><template #icon><n-icon><ArrowBackOutline /></n-icon></template>返回</n-button>
      <n-text strong style="font-size:16px;">处理队列 ({{ store.queue.length }})</n-text>
      <n-space :size="8">
        <n-button size="small" @click="startProcessing" :disabled="store.isProcessing || store.queue.filter(q=>q.status==='pending').length===0">
          <template #icon><n-icon><PlayOutline /></n-icon></template>开始处理
        </n-button>
        <n-button size="small" @click="clearDone" :disabled="store.queue.filter(q=>q.status==='done'||q.status==='error').length===0">
          <template #icon><n-icon><TrashOutline /></n-icon></template>清除已完成
        </n-button>
        <n-button size="small" @click="copyAllTitles" :disabled="store.queue.length===0">
          <template #icon><n-icon><CopyOutline /></n-icon></template>复制标题
        </n-button>
      </n-space>
    </div>

    <div v-if="store.queue.length === 0" class="queue-empty">
      <n-text depth="3">队列为空，返回首页添加视频</n-text>
    </div>

    <div class="queue-list">
      <div v-for="item in store.queue" :key="item.id" class="queue-item" :class="{ running: item.status === 'running', done: item.status === 'done', error: item.status === 'error' }">
        <div class="q-row1">
          <span class="q-status">
            <n-icon v-if="item.status === 'done'" color="#18a058" size="16"><CheckmarkCircle /></n-icon>
            <n-icon v-else-if="item.status === 'error'" color="#d03050" size="16"><CloseCircle /></n-icon>
            <n-icon v-else-if="item.status === 'running'" color="#2080f0" size="16" class="spinning"><SyncOutline /></n-icon>
            <span v-else style="color:#ccc;">&#9679;</span>
          </span>
          <span class="q-title" :title="item.pageInfo.part">{{ item.pageInfo.part }}</span>
          <div class="q-meta">
            <span class="q-dur">{{ fmtDur(item.pageInfo.duration) }}</span>
            <span v-if="item.status !== 'done'" class="q-tag" :style="{ color: item.status === 'error' ? '#d03050' : item.status === 'running' ? '#2080f0' : '#999' }">
              {{ item.status === 'error' ? '失败' : item.status === 'running' ? item.stageLabel : '等待' }}
            </span>
            <span class="q-elapsed">{{ item.elapsedMs ? fmtElapsed(item.elapsedMs) : '' }}</span>
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
            <n-button v-if="item.status === 'done'" size="tiny" text @click="viewResult(item.id)" style="padding:0 4px;">
              <template #icon><n-icon size="16"><EyeOutline /></n-icon></template>
            </n-button>
          </div>
        </div>
        <div v-if="item.status === 'running'" class="q-row2">
          <div class="q-progress">
            <div class="q-bar-fill" :style="{ width: Math.round(item.progress*100)+'%' }"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.queue-root { padding: 20px 24px; max-width: 840px; margin: 0 auto; }
.queue-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 8px; }
.queue-empty { text-align: center; padding: 60px 0; }
.queue-list { display: flex; flex-direction: column; gap: 6px; }
.queue-item {
  display: flex; flex-direction: column; gap: 6px;
  padding: 10px 16px; background: #fff; border-radius: 8px;
  border: 1px solid #eee; transition: background .2s;
  overflow: hidden; min-width: 0;
}
.queue-item.running { background: #f0f7ff; border-color: #c8ddf8; }
.queue-item.done { background: #f6ffed; border-color: #c8e8b8; }
.queue-item.error { background: #fff2f0; border-color: #f0c8c0; }

.q-row1 { display: flex; align-items: center; gap: 10px; min-height: 22px; min-width: 0; width: 100%; }
.q-row2 { padding-left: 30px; padding-right: 0; }

.q-status { flex-shrink: 0; width: 20px; display: flex; align-items: center; justify-content: center; }
.q-title { flex: 1; min-width: 0; font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
.q-meta { flex-shrink: 0; display: flex; align-items: center; gap: 6px; }
.q-dur { font-size: 11px; color: #999; }
.q-tag { font-size: 11px; }
.q-elapsed { font-size: 10px; color: #aaa; }
.q-action { flex-shrink: 0; display: flex; align-items: center; }
.q-tpl-select { width: 72px; }
.q-tpl-select :deep(.n-base-selection) { --n-height: 24px; font-size: 11px; }
.q-tpl-select :deep(.n-base-selection-label) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.q-progress { width: 100%; height: 4px; background: #eee; border-radius: 2px; overflow: hidden; }
.q-bar-fill { height: 100%; background: #2080f0; border-radius: 2px; transition: width .3s ease; }

@keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
.spinning { animation: spin 1s linear infinite; }
</style>
