<script setup lang="ts">
import { } from "vue";
import { NButton, NText, NIcon, NSpace } from "naive-ui";
import { ArrowBackOutline, TrashOutline, PlayOutline, EyeOutline, CheckmarkCircle, CloseCircle, SyncOutline } from "@vicons/ionicons5";
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

function startProcessing() { store.processQueue(); }
function clearDone() { store.queue = store.queue.filter(q => q.status !== "done" && q.status !== "error"); }
function viewResult(id: string) { router.push(`/result/${id}`); }
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
      </n-space>
    </div>

    <div v-if="store.queue.length === 0" class="queue-empty">
      <n-text depth="3">队列为空，返回首页添加视频</n-text>
    </div>

    <div class="queue-list">
      <div v-for="item in store.queue" :key="item.id" class="queue-item" :class="{ running: item.status === 'running', done: item.status === 'done', error: item.status === 'error' }">
        <span class="q-status">
          <n-icon v-if="item.status === 'done'" color="#18a058" size="16"><CheckmarkCircle /></n-icon>
          <n-icon v-else-if="item.status === 'error'" color="#d03050" size="16"><CloseCircle /></n-icon>
          <n-icon v-else-if="item.status === 'running'" color="#2080f0" size="16" class="spinning"><SyncOutline /></n-icon>
          <span v-else style="color:#ccc;">&#9679;</span>
        </span>
        <div class="q-info">
          <n-text style="font-size:13px;">{{ item.pageInfo.part }}</n-text>
          <n-text depth="3" style="font-size:11px;">{{ item.source === 'url' ? 'B站链接' : item.source === 'fav' ? '收藏夹' : '本地文件' }} &middot; {{ fmtDur(item.pageInfo.duration) }}</n-text>
        </div>
        <div class="q-progress" v-if="item.status !== 'pending'">
          <div class="q-bar-fill" :style="{ width: Math.round(item.progress*100)+'%', background: item.status === 'error' ? '#d03050' : item.status === 'done' ? '#18a058' : '#2080f0' }"></div>
        </div>
        <span class="q-label" :style="{ color: item.status === 'error' ? '#d03050' : item.status === 'done' ? '#18a058' : '#666' }">
          {{ item.status === 'error' ? '失败' : item.status === 'done' ? '完成' : item.status === 'running' ? item.stageLabel : '等待' }}
        </span>
        <span v-if="item.elapsedMs" class="q-elapsed">{{ fmtElapsed(item.elapsedMs) }}</span>
        <n-button v-if="item.status === 'done'" size="tiny" text @click="viewResult(item.id)" style="margin-left:6px;">
          <template #icon><n-icon size="16"><EyeOutline /></n-icon></template>
        </n-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.queue-root { padding: 20px 24px; max-width: 780px; margin: 0 auto; }
.queue-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 8px; }
.queue-empty { text-align: center; padding: 60px 0; }
.queue-list { display: flex; flex-direction: column; gap: 6px; }
.queue-item {
  display: flex; align-items: center; gap: 10px; padding: 12px 16px;
  background: #fff; border-radius: 8px; border: 1px solid #eee;
  transition: background .2s;
}
.queue-item.running { background: #f0f7ff; border-color: #c8ddf8; }
.queue-item.done { background: #f6ffed; border-color: #c8e8b8; }
.queue-item.error { background: #fff2f0; border-color: #f0c8c0; }
.q-status { flex-shrink: 0; width: 20px; display: flex; align-items: center; justify-content: center; }
.q-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.q-progress { width: 72px; height: 4px; background: #eee; border-radius: 2px; overflow: hidden; flex-shrink: 0; }
.q-bar-fill { height: 100%; border-radius: 2px; transition: width .3s ease; }
.q-label { font-size: 11px; width: 40px; text-align: right; flex-shrink: 0; }
.q-elapsed { font-size: 10px; color: #aaa; flex-shrink: 0; width: 48px; text-align: right; }
@keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
.spinning { animation: spin 1s linear infinite; }
</style>
