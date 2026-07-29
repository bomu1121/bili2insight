<script setup lang="ts">
import { NIcon } from "naive-ui";
import { ref as homeRef, onMounted as homeMounted, computed } from "vue";
import { useScrollReveal } from "../composables/useScrollReveal";
import {
  LinkIcon,
  FolderOpen,
  CloudUpload,
  Clock,
  ArrowRight,
  Download,
  Mic,
  Sparkles,
  FileText,
  List,
} from "lucide-vue-next";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useAppStore } from "../stores/app";
import { createDiscreteApi } from "naive-ui";

const router = useRouter();
const authStore = useAuthStore();
const appStore = useAppStore();
const { message } = createDiscreteApi(["message"]);

const entries = [
  {
    key: "url",
    title: "B站链接",
    desc: "粘贴视频地址，自动解析分P并加入队列",
    icon: LinkIcon,
    tone: "url",
    action: () => router.push("/source/url"),
  },
  {
    key: "fav",
    title: "B站收藏夹",
    desc: "登录后批量导入收藏、合集与稍后再看",
    icon: FolderOpen,
    tone: "fav",
    action: () => {
      if (authStore.isLoggedIn) router.push("/source/fav");
      else message.warning("请先点击右上角头像登录B站账号");
    },
  },
  {
    key: "local",
    title: "本地文件",
    desc: "选择本机音频或视频，离线也能跑通流水线",
    icon: CloudUpload,
    tone: "local",
    action: () => router.push("/source/local"),
  },
  {
    key: "history",
    title: "历史记录",
    desc: "回看已生成的观点笔记，支持复制与导出",
    icon: Clock,
    tone: "history",
    action: () => router.push("/history"),
  },
];

const gridRef = homeRef<HTMLElement | null>(null);
const { revealed: gridRevealed } = useScrollReveal(gridRef, { staggerDelay: 80, threshold: 0.05 });

const flowSteps = [
  { label: "链接 / 文件", icon: LinkIcon },
  { label: "下载音频", icon: Download },
  { label: "语音识别", icon: Mic },
  { label: "AI 提炼", icon: Sparkles },
  { label: "导出笔记", icon: FileText },
];

const queuePending = computed(() => appStore.queue.filter(q => q.status === "pending").length);
const queueRunning = computed(() => appStore.queue.filter(q => q.status === "running").length);
const queueDone = computed(() => appStore.queue.filter(q => q.status === "done").length);
</script>

<template>
  <div class="home-root">
    <div class="dashboard-body">
      <section ref="gridRef" class="card-grid" :class="{ revealed: gridRevealed }">
        <!-- URL card: largest, primary -->
        <div class="db-card url span-2" @click="entries[0].action()">
          <div class="db-card-accent"></div>
          <div class="db-card-inner">
            <div class="db-card-header">
              <div class="db-card-icon url"><n-icon :size="24"><LinkIcon /></n-icon></div>
              <div class="db-card-title">{{ entries[0].title }}</div>
              <n-icon :size="16" class="db-card-arrow"><ArrowRight /></n-icon>
            </div>
            <div class="db-card-desc">{{ entries[0].desc }}</div>
            <div class="db-card-stats">
              <span v-if="appStore.queue.length > 0" class="db-stat">
                <span class="db-stat-num tnum">{{ queuePending }}</span> 待处理
                <template v-if="queueRunning > 0">
                  &middot; <span class="db-stat-num running">{{ queueRunning }}</span> 处理中
                </template>
                <template v-if="queueDone > 0">
                  &middot; <span class="db-stat-num done">{{ queueDone }}</span> 已完成
                </template>
              </span>
              <span v-else class="db-stat empty">队列为空，粘贴链接开始</span>
            </div>
          </div>
        </div>

        <!-- Favorites card -->
        <div class="db-card fav" @click="entries[1].action()">
          <div class="db-card-accent"></div>
          <div class="db-card-inner">
            <div class="db-card-header">
              <div class="db-card-icon fav"><n-icon :size="20"><FolderOpen /></n-icon></div>
              <div class="db-card-title">{{ entries[1].title }}</div>
              <n-icon :size="16" class="db-card-arrow"><ArrowRight /></n-icon>
            </div>
            <div class="db-card-desc">{{ entries[1].desc }}</div>
            <div class="db-card-stats">
              <span class="db-badge" :class="authStore.isLoggedIn ? 'logged-in' : 'logged-out'">
                {{ authStore.isLoggedIn ? '已登录' : '需登录' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Local card -->
        <div class="db-card local" @click="entries[2].action()">
          <div class="db-card-accent"></div>
          <div class="db-card-inner">
            <div class="db-card-header">
              <div class="db-card-icon local"><n-icon :size="20"><CloudUpload /></n-icon></div>
              <div class="db-card-title">{{ entries[2].title }}</div>
              <n-icon :size="16" class="db-card-arrow"><ArrowRight /></n-icon>
            </div>
            <div class="db-card-desc">{{ entries[2].desc }}</div>
          </div>
        </div>

        <!-- History card -->
        <div class="db-card history" @click="entries[3].action()">
          <div class="db-card-accent"></div>
          <div class="db-card-inner">
            <div class="db-card-header">
              <div class="db-card-icon history"><n-icon :size="20"><Clock /></n-icon></div>
              <div class="db-card-title">{{ entries[3].title }}</div>
              <n-icon :size="16" class="db-card-arrow"><ArrowRight /></n-icon>
            </div>
            <div class="db-card-desc">{{ entries[3].desc }}</div>
          </div>
        </div>
      </section>

      <!-- Flow pipeline: vertical sticky sidebar -->
      <aside class="flow-sidebar">
        <div class="flow-sidebar-label">观测流水线</div>
        <div class="flow-sidebar-steps">
          <div v-for="(s, i) in flowSteps" :key="s.label" class="flow-side-step">
            <span class="fs-num">0{{ i + 1 }}</span>
            <span class="fs-ic">
              <n-icon :size="12"><component :is="s.icon" /></n-icon>
            </span>
            <span class="fs-label">{{ s.label }}</span>
          </div>
        </div>
        <div class="flow-sidebar-line"></div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.home-root { overflow-y: auto; scrollbar-gutter: stable; min-height: 100%; }

/* ===== Dashboard layout ===== */
.dashboard-body { display: flex; gap: 28px; max-width: var(--content-max-wide); margin: 0 auto; padding: 48px 32px 40px; align-items: flex-start; }

/* ===== Card grid ===== */
.card-grid { flex: 1; min-width: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

.card-grid.revealed .db-card { animation: cardReveal 0.5s var(--spring-snappy) both; }
.card-grid.revealed .db-card:nth-child(1) { animation-delay: 0s; }
.card-grid.revealed .db-card:nth-child(2) { animation-delay: 0.1s; }
.card-grid.revealed .db-card:nth-child(3) { animation-delay: 0.2s; }
.card-grid.revealed .db-card:nth-child(4) { animation-delay: 0.3s; }
@keyframes cardReveal { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

/* ===== Dashboard cards ===== */
.db-card { position: relative; background: linear-gradient(135deg, var(--color-surface), var(--color-surface-muted)); border: 1px solid var(--color-border-strong); border-radius: var(--radius-lg); cursor: pointer; overflow: hidden; transition: border-color var(--dur-2), box-shadow var(--dur-2), transform var(--dur-2); }
.db-card:hover { box-shadow: var(--shadow-hover); }

.db-card-accent { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; transition: width var(--dur-2), box-shadow var(--dur-2); }
.db-card.url .db-card-accent { background: var(--color-brand); }
.db-card.fav .db-card-accent { background: var(--color-accent-pink); }
.db-card.local .db-card-accent { background: var(--color-success); }
.db-card.history .db-card-accent { background: var(--color-accent-indigo); }
.db-card:hover .db-card-accent { width: 4px; box-shadow: var(--brand-glow-soft); }
.db-card.fav:hover .db-card-accent { box-shadow: 0 0 6px rgba(212,135,149,0.3); }
.db-card.local:hover .db-card-accent { box-shadow: 0 0 6px rgba(99,168,115,0.3); }
.db-card.history:hover .db-card-accent { box-shadow: 0 0 6px rgba(135,148,194,0.3); }

.db-card-inner { padding: 20px 20px 20px 17px; }

.db-card.span-2 { grid-column: 1 / -1; }

.db-card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.db-card-icon { width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; }
.db-card-icon.url { background: var(--color-brand-soft); color: var(--color-brand); }
.db-card-icon.fav { background: var(--color-accent-pink-soft); color: var(--color-accent-pink); }
.db-card-icon.local { background: var(--color-success-soft); color: var(--color-success); }
.db-card-icon.history { background: var(--color-accent-indigo-soft); color: var(--color-accent-indigo); }
.db-card-title { font-size: 15px; font-weight: 650; color: var(--color-text); flex: 1; }
.db-card-arrow { color: var(--color-text-tertiary); flex-shrink: 0; transition: transform var(--dur-2), color var(--dur-2); }
.db-card:hover .db-card-arrow { transform: translateX(3px); color: var(--color-text-secondary); }

.db-card-desc { font-size: 13px; line-height: 1.5; color: var(--color-text-secondary); margin-bottom: 10px; }

.db-card-stats { font-size: 12px; color: var(--color-text-tertiary); font-family: var(--font-mono); }
.db-stat { display: flex; align-items: center; gap: 6px; }
.db-stat-num { font-weight: 700; color: var(--color-brand); font-size: 16px; font-family: var(--font-mono); }
.db-stat-num.running { color: var(--color-warning); }
.db-stat-num.done { color: var(--color-success); }
.db-stat.empty { opacity: 0.5; }
.db-badge { display: inline-block; padding: 2px 10px; border-radius: var(--radius-full); font-size: 11px; font-weight: 600; font-family: var(--font-mono); }
.db-badge.logged-in { background: var(--color-success-soft); color: var(--color-success); }
.db-badge.logged-out { background: var(--color-warning-soft); color: var(--color-warning); }

/* ===== Flow sidebar ===== */
.flow-sidebar { width: 170px; flex-shrink: 0; position: sticky; top: 48px; }
.flow-sidebar-label { font-family: var(--font-mono); font-size: 10px; font-weight: 700; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 16px; padding-left: 12px; }
.flow-sidebar-steps { display: flex; flex-direction: column; gap: 0; }
.flow-side-step { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: var(--radius-md); transition: background var(--dur-2); cursor: default; }
.flow-side-step:hover { background: var(--color-ink-soft); }
.flow-side-step:last-child { background: var(--color-brand-soft); border: 1px solid var(--color-brand-border); }
.fs-num { font-family: var(--font-mono); font-size: 10px; font-weight: 700; color: var(--color-text-tertiary); width: 16px; text-align: right; flex-shrink: 0; }
.flow-side-step:last-child .fs-num { color: var(--color-brand); }
.fs-ic { width: 22px; height: 22px; border-radius: 50%; background: var(--color-ink-soft); color: var(--color-text-tertiary); display: grid; place-items: center; flex-shrink: 0; }
.flow-side-step:last-child .fs-ic { background: var(--color-brand); color: var(--color-text-inverse); box-shadow: var(--brand-glow-soft); }
.fs-label { font-size: 12px; color: var(--color-text-secondary); font-weight: 500; white-space: nowrap; }
.flow-side-step:last-child .fs-label { color: var(--color-brand); font-weight: 600; }
.flow-sidebar-line { height: 1px; background: linear-gradient(90deg, transparent, var(--color-brand-border), transparent); margin: 16px 12px 0; }

@media (max-width: 860px) {
  .dashboard-body { flex-direction: column; padding: 32px 20px 28px; }
  .card-grid { grid-template-columns: 1fr; }
  .db-card.span-2 { grid-column: auto; }
  .flow-sidebar { width: 100%; position: static; }
  .flow-sidebar-steps { flex-direction: row; flex-wrap: wrap; gap: 6px; }
  .flow-side-step { padding: 6px 10px; }
  .flow-sidebar-line { display: none; }
}
</style>
