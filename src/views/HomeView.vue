<script setup lang="ts">
import { NIcon } from "naive-ui";
import { ref as homeRef, onMounted as homeMounted } from "vue";
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
} from "lucide-vue-next";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { createDiscreteApi } from "naive-ui";

const router = useRouter();
const authStore = useAuthStore();
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

const heroRef = homeRef<HTMLElement | null>(null);
const flowRef = homeRef<HTMLElement | null>(null);
const { revealed: flowRevealed } = useScrollReveal(flowRef, { staggerDelay: 100, threshold: 0.05 });

const flowSteps = [
  { label: "链接 / 文件", icon: LinkIcon },
  { label: "下载音频", icon: Download },
  { label: "语音识别", icon: Mic },
  { label: "AI 提炼", icon: Sparkles },
  { label: "导出笔记", icon: FileText },
];
</script>

<template>
  <div class="home-root">

    <!-- Full-viewport immersive hero -->
    <section class="hero-screen">
      <div class="hero-bg"></div>
      <div class="hero-bg-grid"></div>

      <div class="hero-content">
        <div class="hero-kicker">
          <span class="kicker-dot signal-dot" />
          <span>世界线观测站</span>
        </div>
        <h1 class="hero-title">观测世界线，提取分歧点</h1>
        <p class="hero-sub">输入 B 站视频链接或导入本地文件，自动观测下载、转录与 AI 提炼，导出可读笔记。</p>
      </div>

      <!-- Glass cards floating at bottom of hero -->
      <div class="hero-cards">
        <button
          v-for="item in entries"
          :key="item.key"
          type="button"
          class="glass-card"
          :class="item.tone"
          @click="item.action()"
        >
          <div class="gc-icon">
            <n-icon :size="20"><component :is="item.icon" /></n-icon>
          </div>
          <div class="gc-copy">
            <div class="gc-label">{{ item.title }}</div>
            <div class="gc-desc">{{ item.desc }}</div>
          </div>
          <div class="gc-go">
            <n-icon :size="14"><ArrowRight /></n-icon>
          </div>
        </button>
      </div>

      <!-- Scroll hint -->
      <div class="hero-scroll-hint">
        <span>// 观测流水线</span>
        <span class="scroll-arrow">&#8595;</span>
      </div>
    </section>

    <!-- Flow pipeline: compact footer below hero -->
    <section ref="flowRef" class="flow-bar" :class="{ revealed: flowRevealed }">
      <div class="flow-bar-steps">
        <template v-for="(s, i) in flowSteps" :key="s.label">
          <div class="fb-step" :class="{ last: i === flowSteps.length - 1 }">
            <span class="fb-ic">
              <n-icon :size="13"><component :is="s.icon" /></n-icon>
            </span>
            <span class="fb-label">{{ s.label }}</span>
          </div>
          <span v-if="i < flowSteps.length - 1" class="fb-arrow">&rarr;</span>
        </template>
      </div>
    </section>

  </div>
</template>

<style scoped>
.home-root { overflow-y: auto; scrollbar-gutter: stable; }

/* ===== Full-viewport hero ===== */
.hero-screen {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
  padding: 64px 32px 80px;
  overflow: hidden;
}

/* Geometric background: world-line grid (ref: Steins;Gate divergence meter) */
.hero-bg {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse at 30% 20%, rgba(139, 62, 62,0.06) 0%, transparent 50%),
    radial-gradient(ellipse at 70% 80%, rgba(139, 62, 62,0.04) 0%, transparent 40%);
}
.hero-bg-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(139, 62, 62,0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(139, 62, 62,0.025) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
}

/* Hero content: centered text */
.hero-content { position: relative; z-index: 1; text-align: center; margin-bottom: 48px; }
.hero-kicker { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: var(--color-brand); background: var(--color-brand-soft); border: 1px solid var(--color-brand-border); padding: 5px 12px; border-radius: var(--radius-full); margin-bottom: 24px; font-family: var(--font-mono); letter-spacing: 0.03em; animation: heroSubFade 0.6s var(--spring-snappy) both; }
.kicker-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-brand); box-shadow: var(--brand-glow); animation: pulse-dot 2s var(--ease-out) infinite; }
.hero-title { font-size: 40px; font-weight: 750; letter-spacing: -0.03em; line-height: 1.2; color: var(--color-text); margin: 0 0 16px; animation: heroTitleReveal 0.7s var(--spring-snappy) 0.15s both; }
.hero-sub { font-size: 15px; line-height: 1.7; color: var(--color-text-secondary); margin: 0 auto; max-width: 540px; animation: heroSubFade 0.8s var(--spring-snappy) 0.3s both; }
@keyframes heroSubFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes heroTitleReveal { from { opacity: 0; transform: translateY(12px); filter: blur(4px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }

/* ===== Glass cards ===== */
.hero-cards {
  position: relative; z-index: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  max-width: 720px;
  width: 100%;
  animation: cardsRise 0.8s var(--spring-snappy) 0.5s both;
}
@keyframes cardsRise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }

/* Glass morphism (ref: macOS Frosted Glass, Stripe dashboard cards) */
.glass-card {
  display: flex; align-items: flex-start; gap: 12px; padding: 18px;
  text-align: left; cursor: pointer; font-family: inherit; color: inherit;
  background: color-mix(in srgb, var(--color-surface) 55%, transparent);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 40%, transparent);
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 12px rgba(0,0,0,0.15);
  transition: background var(--dur-3), border-color var(--dur-3), box-shadow var(--dur-3), transform var(--dur-3);
}
.glass-card:hover {
  background: color-mix(in srgb, var(--color-surface) 75%, transparent);
  border-color: color-mix(in srgb, var(--color-border-strong) 70%, transparent);
  box-shadow: 0 8px 32px rgba(0,0,0,0.25);
}

.glass-card.url:hover { border-color: color-mix(in srgb, var(--color-brand) 50%, transparent); box-shadow: 0 8px 32px rgba(0,0,0,0.25), 0 0 20px rgba(139, 62, 62,0.15); }
.glass-card.fav:hover { border-color: rgba(212,135,149,0.5); box-shadow: 0 8px 32px rgba(0,0,0,0.25), 0 0 20px rgba(212,135,149,0.15); }
.glass-card.local:hover { border-color: rgba(99,168,115,0.5); box-shadow: 0 8px 32px rgba(0,0,0,0.25), 0 0 20px rgba(99,168,115,0.15); }
.glass-card.history:hover { border-color: rgba(135,148,194,0.5); box-shadow: 0 8px 32px rgba(0,0,0,0.25), 0 0 20px rgba(135,148,194,0.15); }

.gc-icon { width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; }
.glass-card.url .gc-icon { background: var(--color-brand-soft); color: var(--color-brand); }
.glass-card.fav .gc-icon { background: var(--color-accent-pink-soft); color: var(--color-accent-pink); }
.glass-card.local .gc-icon { background: var(--color-success-soft); color: var(--color-success); }
.glass-card.history .gc-icon { background: var(--color-accent-indigo-soft); color: var(--color-accent-indigo); }

.gc-copy { flex: 1; min-width: 0; padding-top: 1px; }
.gc-label { font-size: 15px; font-weight: 650; color: var(--color-text); margin-bottom: 4px; }
.gc-desc { font-size: 12px; line-height: 1.5; color: var(--color-text-secondary); }
.gc-go { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; color: var(--color-text-tertiary); background: var(--color-ink-soft); flex-shrink: 0; margin-top: 4px; transition: background var(--dur-2), color var(--dur-2), transform var(--dur-2); }
.glass-card:hover .gc-go { transform: translateX(3px); }

/* Scroll hint */
.hero-scroll-hint {
  position: absolute; bottom: 28px; z-index: 1;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  font-family: var(--font-mono); font-size: 10px; color: var(--color-text-tertiary);
  opacity: 0.5; animation: heroSubFade 0.8s var(--spring-snappy) 1s both;
}
.scroll-arrow { font-size: 16px; animation: bounce 2s infinite; }
@keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(6px); } }

/* ===== Flow footer bar ===== */
.flow-bar {
  max-width: var(--content-max-wide); margin: 0 auto;
  padding: 32px 32px 48px;
  opacity: 0; transform: translateY(12px);
  transition: opacity 0.6s var(--spring-snappy), transform 0.6s var(--spring-snappy);
}
.flow-bar.revealed { opacity: 1; transform: translateY(0); }
.flow-bar-steps { display: flex; align-items: center; justify-content: center; gap: 0; }
.fb-step { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-full); flex-shrink: 0; transition: border-color var(--dur-2), background var(--dur-2); }
.fb-step:hover { border-color: var(--color-brand-border); background: var(--color-brand-soft); }
.fb-step.last { border-color: var(--color-brand-border); background: var(--color-brand-soft); }
.fb-step.last .fb-label { color: var(--color-brand); font-weight: 600; }
.fb-ic { width: 26px; height: 26px; border-radius: 50%; background: var(--color-ink-soft); color: var(--color-text-tertiary); display: grid; place-items: center; }
.fb-step:hover .fb-ic { background: var(--color-brand-soft); color: var(--color-brand); }
.fb-step.last .fb-ic { background: var(--color-brand); color: var(--color-text-inverse); box-shadow: var(--brand-glow-soft); }
.fb-label { font-size: 12.5px; color: var(--color-text-secondary); font-weight: 500; white-space: nowrap; }
.fb-arrow { margin: 0 8px; color: var(--color-border-strong); font-family: var(--font-mono); font-size: 18px; font-weight: 300; }

@media (max-width: 860px) {
  .hero-screen { padding: 48px 24px 64px; }
  .hero-title { font-size: 28px; }
  .hero-cards { grid-template-columns: 1fr; max-width: 440px; }
  .flow-bar { padding: 24px 24px 36px; }
  .flow-bar-steps { flex-wrap: wrap; gap: 8px; justify-content: flex-start; }
  .fb-arrow { display: none; }
}
</style>
