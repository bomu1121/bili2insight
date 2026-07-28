<script setup lang="ts">
import { NIcon } from "naive-ui";
import { ref as homeRef, onMounted as homeMounted } from "vue";
import { useTilt } from "../composables/useMagnetic";
import { useScrollReveal } from "../composables/useScrollReveal";
import {
  LinkOutline,
  FolderOpenOutline,
  CloudUploadOutline,
  TimeOutline,
  ArrowForward,
  DownloadOutline,
  MicOutline,
  SparklesOutline,
  DocumentTextOutline,
} from "@vicons/ionicons5";
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
    icon: LinkOutline,
    tone: "url",
    action: () => router.push("/source/url"),
  },
  {
    key: "fav",
    title: "B站收藏夹",
    desc: "登录后批量导入收藏、合集与稍后再看",
    icon: FolderOpenOutline,
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
    icon: CloudUploadOutline,
    tone: "local",
    action: () => router.push("/source/local"),
  },
  {
    key: "history",
    title: "历史记录",
    desc: "回看已生成的观点笔记，支持复制与导出",
    icon: TimeOutline,
    tone: "history",
    action: () => router.push("/history"),
  },
];

const heroRef = homeRef<HTMLElement | null>(null);
const entryGridRef = homeRef<HTMLElement | null>(null);
const flowRef = homeRef<HTMLElement | null>(null);
const { revealed: flowRevealed } = useScrollReveal(flowRef, { staggerDelay: 100 });

const flowSteps = [
  { label: "链接 / 文件", icon: LinkOutline },
  { label: "下载音频", icon: DownloadOutline },
  { label: "语音识别", icon: MicOutline },
  { label: "AI 提炼", icon: SparklesOutline },
  { label: "导出笔记", icon: DocumentTextOutline },
];
</script>

<template>
  <div class="home-root">
    <div class="home-inner">
      <section class="hero spotlight">
        <div class="hero-kicker">
          <span class="kicker-dot signal-dot" />
          <span>世界线观测站</span>
        </div>
        <h1 class="hero-title glitch-hover" data-text="观测世界线，提取分歧点">观测世界线，提取分歧点</h1>
        <p class="hero-sub">输入 B 站视频链接或导入本地文件，自动观测下载、转录与 AI 提炼，导出可读笔记。</p>
      </section>

      <section ref="entryGridRef" class="entry-grid stagger-reveal">
        <button
          v-for="item in entries"
          :key="item.key"
          type="button"
          data-reactive-glow class="entry-card tilt-card hover-lift spotlight"
          :class="item.tone"
          @click="item.action()"
        >
          <div class="entry-icon">
            <n-icon :size="22">
              <component :is="item.icon" />
            </n-icon>
          </div>
          <div class="entry-copy">
            <div class="entry-label">{{ item.title }}</div>
            <div class="entry-desc">{{ item.desc }}</div>
          </div>
          <div class="entry-go">
            <n-icon :size="15"><ArrowForward /></n-icon>
          </div>
        </button>
      </section>

      <section ref="flowRef" class="flow" :class="{ revealed: flowRevealed }">
        <div class="flow-caption">// 观测流水线</div>
        <div class="flow-steps stagger-reveal" :class="{ revealed: flowRevealed }">
          <template v-for="(s, i) in flowSteps" :key="s.label">
            <div class="flow-step" :class="{ last: i === flowSteps.length - 1 }">
              <span class="flow-ic">
                <n-icon :size="13"><component :is="s.icon" /></n-icon>
              </span>
              <span class="flow-label">{{ s.label }}</span>
            </div>
            <span v-if="i < flowSteps.length - 1" class="flow-line" />
          </template>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.home-root { overflow-y: auto; scrollbar-gutter: stable; }
.home-inner { max-width: var(--content-max-home); margin: 0 auto; padding: 64px 32px 48px; display: flex; flex-direction: column; }
.hero { margin-bottom: 36px; }
.hero-kicker { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: var(--color-brand); background: var(--color-brand-soft); border: 1px solid var(--color-brand-border); padding: 5px 12px; border-radius: var(--radius-full); margin-bottom: 18px; font-family: var(--font-mono); letter-spacing: 0.03em; animation: heroSubFade 0.6s var(--spring-snappy) both; }
.kicker-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-brand); box-shadow: var(--brand-glow); animation: pulse-dot 2s var(--ease-out) infinite; }
.hero-title { font-size: 32px; font-weight: 750; letter-spacing: -0.015em; line-height: 1.3; color: var(--color-text); margin: 0 0 12px; animation: heroTitleReveal 0.7s var(--spring-snappy) 0.15s both; }
.hero-sub { font-size: 14px; line-height: 1.7; color: var(--color-text-secondary); margin: 0; max-width: 520px; animation: heroSubFade 0.8s var(--spring-snappy) 0.3s both; }
@keyframes heroSubFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes heroTitleReveal { from { opacity: 0; transform: translateY(12px); filter: blur(4px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }

.entry-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.entry-card { display: flex; align-items: flex-start; gap: 14px; padding: 16px; text-align: left; cursor: pointer; font-family: inherit; color: inherit; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-xs); transition: border-color 0.3s, box-shadow 0.3s; transform-style: preserve-3d; perspective: 800px; }
.entry-card:hover { border-color: rgba(111, 181, 132, 0.4); box-shadow: 0 0 0 2px rgba(111,181,132,0.25), 0 8px 32px rgba(0,0,0,0.4), 0 0 24px rgba(111,181,132,0.12); }
.entry-card:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(111,181,132,0.3); }
.entry-icon { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; }
.entry-card:hover .entry-icon { animation: icon-bounce 0.5s var(--spring-snappy) both; }
.entry-card.url .entry-icon { background: var(--color-brand-soft); color: var(--color-brand); }
.entry-card.fav .entry-icon { background: var(--color-accent-pink-soft); color: var(--color-accent-pink); }
.entry-card.local .entry-icon { background: var(--color-success-soft); color: var(--color-success); }
.entry-card.history .entry-icon { background: var(--color-accent-indigo-soft); color: var(--color-accent-indigo); }
.entry-copy { flex: 1; min-width: 0; padding-top: 1px; }
.entry-label { font-size: 15px; font-weight: 650; color: var(--color-text); margin-bottom: 5px; }
.entry-desc { font-size: 12.5px; line-height: 1.55; color: var(--color-text-secondary); }
.entry-go { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; color: var(--color-text-tertiary); background: var(--color-ink-soft); flex-shrink: 0; margin-top: 4px; transition: background var(--dur-2), color var(--dur-2), box-shadow var(--dur-2); }
.entry-card:hover .entry-go { background: var(--color-ink); color: var(--color-brand); box-shadow: var(--brand-glow-soft); }

.flow { margin-top: 44px; }
.flow-caption { font-size: 11px; font-weight: 600; color: var(--color-text-tertiary); margin-bottom: 14px; font-family: var(--font-mono); letter-spacing: 0.03em; }
.flow-steps { display: flex; align-items: center; gap: 10px; }
.flow-step { display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px 5px 5px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-full); flex-shrink: 0; transition: border-color var(--dur-2); }
.flow-step:hover { border-color: var(--color-border-strong); }
.flow-ic { width: 24px; height: 24px; border-radius: 50%; background: var(--color-ink-soft); color: var(--color-text-tertiary); display: grid; place-items: center; }
.flow-step.last { border-color: var(--color-brand-border); background: var(--color-brand-soft); }
.flow-step.last .flow-ic { background: var(--color-brand); color: var(--color-text-inverse); box-shadow: var(--brand-glow-soft); }
.flow-step.last .flow-label { color: var(--color-brand); font-weight: 600; }
.flow-label { font-size: 12px; color: var(--color-text-secondary); font-weight: 500; white-space: nowrap; }
.flow-line { flex: 1; min-width: 12px; height: 1px; background: var(--color-border-strong); position: relative; }
.flow-line::after { content: ""; position: absolute; right: 0; top: -2.5px; border-left: 5px solid var(--color-border-strong); border-top: 3px solid transparent; border-bottom: 3px solid transparent; }

@media (max-width: 860px) { .home-inner { padding: 44px 24px 36px; } .entry-grid { grid-template-columns: 1fr; } .hero-title { font-size: 26px; } .flow-line { display: none; } .flow-steps { flex-wrap: wrap; } }
</style>