<script setup lang="ts">
import { NIcon } from "naive-ui";
import { ref as homeRef, onMounted as homeMounted } from "vue";
import { useTilt } from "../composables/useMagnetic";
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
const entryGridRef = homeRef<HTMLElement | null>(null);
const flowRef = homeRef<HTMLElement | null>(null);
const { revealed: flowRevealed } = useScrollReveal(flowRef, { staggerDelay: 100 });
const { revealed: entryRevealed } = useScrollReveal(entryGridRef, { staggerDelay: 80 });

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
    <div class="home-inner">
      <section class="hero">
        <div class="hero-kicker">
          <span class="kicker-dot signal-dot" />
          <span>世界线观测站</span>
        </div>
        <h1 class="hero-title glitch-hover" data-text="观测世界线，提取分歧点">观测世界线，提取分歧点</h1>
        <p class="hero-sub">输入 B 站视频链接或导入本地文件，自动观测下载、转录与 AI 提炼，导出可读笔记。</p>
      </section>

      <section ref="entryGridRef" class="entry-grid stagger-reveal" :class="{ revealed: entryRevealed }">
        <button
          v-for="item in entries"
          :key="item.key"
          type="button"
          data-reactive-glow class="entry-card tilt-card spotlight"
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
            <n-icon :size="15"><ArrowRight /></n-icon>
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

/*
  Home: entry card grid + hero + flow pipeline pattern
  - colors via CSS custom properties (var(--color-*) / var(--shadow-*))
  - hover uses box-shadow lift (var(--shadow-entry-hover-depth)), not translateY
  - per-card tone colors via rgba overrides + theme-aware depth shadow
  - transitions unified at 0.18s (border-color, box-shadow, background)
*/

.home-root { overflow-y: auto; scrollbar-gutter: stable; }
.home-inner { max-width: var(--content-max-home); margin: 0 auto; padding: 64px 32px 48px; display: flex; flex-direction: column; }

.hero { margin-bottom: 40px; }
.hero-kicker { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: var(--color-brand); background: var(--color-brand-soft); border: 1px solid var(--color-brand-border); padding: 5px 12px; border-radius: var(--radius-full); margin-bottom: 20px; font-family: var(--font-mono); letter-spacing: 0.03em; animation: heroSubFade 0.6s var(--spring-snappy) both; }
.kicker-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-brand); box-shadow: var(--brand-glow); animation: pulse-dot 2s var(--ease-out) infinite; }
.hero-title { font-size: 32px; font-weight: 750; letter-spacing: -0.02em; line-height: 1.25; color: var(--color-text); margin: 0 0 14px; animation: heroTitleReveal 0.7s var(--spring-snappy) 0.15s both; transition: text-shadow 0.3s ease; }
.hero-title:hover { text-shadow: 0 0 20px rgba(111,181,132,0.25), 0 0 40px rgba(111,181,132,0.1); }
.hero-sub { font-size: 14px; line-height: 1.7; color: var(--color-text-secondary); margin: 0; max-width: 520px; animation: heroSubFade 0.8s var(--spring-snappy) 0.3s both; }
@keyframes heroSubFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes heroTitleReveal { from { opacity: 0; transform: translateY(12px); filter: blur(4px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }

.entry-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.entry-card { display: flex; align-items: flex-start; gap: 14px; padding: 18px; text-align: left; cursor: pointer; font-family: inherit; color: inherit; background: var(--color-surface); border: 1.5px solid var(--color-border-strong); border-radius: var(--radius-lg); box-shadow: var(--shadow-xs); transition: border-color 0.18s, box-shadow 0.18s, background 0.18s; transform-style: preserve-3d; perspective: 800px; }
/* Per-card hover colors */
.entry-card.url:hover { border-color: rgba(111,181,132,0.45); box-shadow: 0 0 0 2px rgba(111,181,132,0.25), var(--shadow-entry-hover-depth), 0 0 20px rgba(111,181,132,0.1); }
.entry-card.fav:hover { border-color: rgba(212,135,149,0.45); box-shadow: 0 0 0 2px rgba(212,135,149,0.25), var(--shadow-entry-hover-depth), 0 0 20px rgba(212,135,149,0.1); }
.entry-card.local:hover { border-color: rgba(99,168,115,0.45); box-shadow: 0 0 0 2px rgba(99,168,115,0.25), var(--shadow-entry-hover-depth), 0 0 20px rgba(99,168,115,0.1); }
.entry-card.history:hover { border-color: rgba(135,148,194,0.45); box-shadow: 0 0 0 2px rgba(135,148,194,0.25), var(--shadow-entry-hover-depth), 0 0 20px rgba(135,148,194,0.1); }
.entry-card:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(111,181,132,0.3); }
.entry-icon { width: 42px; height: 42px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; }
.entry-card:hover .entry-icon { animation: icon-bounce 0.5s var(--spring-snappy) both; }
.entry-card.url .entry-icon { background: var(--color-brand-soft); color: var(--color-brand); }
.entry-card.fav .entry-icon { background: var(--color-accent-pink-soft); color: var(--color-accent-pink); }
.entry-card.local .entry-icon { background: var(--color-success-soft); color: var(--color-success); }
.entry-card.history .entry-icon { background: var(--color-accent-indigo-soft); color: var(--color-accent-indigo); }
.entry-copy { flex: 1; min-width: 0; padding-top: 1px; }
.entry-label { font-size: 15px; font-weight: 650; color: var(--color-text); margin-bottom: 5px; }
.entry-desc { font-size: 12.5px; line-height: 1.55; color: var(--color-text-secondary); }
.entry-go { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; color: var(--color-text-secondary); background: var(--color-ink-soft); flex-shrink: 0; margin-top: 5px; transition: background 0.18s, color 0.18s, box-shadow 0.18s; }
.entry-card.url:hover .entry-go { background: rgba(111,181,132,0.15); color: var(--color-brand); box-shadow: 0 0 10px rgba(111,181,132,0.25); }
.entry-card.fav:hover .entry-go { background: rgba(212,135,149,0.15); color: var(--color-accent-pink); box-shadow: 0 0 10px rgba(212,135,149,0.25); }
.entry-card.local:hover .entry-go { background: rgba(99,168,115,0.15); color: var(--color-success); box-shadow: 0 0 10px rgba(99,168,115,0.25); }
.entry-card.history:hover .entry-go { background: rgba(135,148,194,0.15); color: var(--color-accent-indigo); box-shadow: 0 0 10px rgba(135,148,194,0.25); }

.flow { margin-top: 48px; }
.flow-caption { font-size: 12px; font-weight: 600; color: var(--color-text-secondary); margin-bottom: 16px; font-family: var(--font-mono); letter-spacing: 0.04em; }
.flow-steps { display: flex; align-items: center; gap: 0; }
.flow-step { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px 6px 6px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-full); flex-shrink: 0; transition: border-color 0.25s, box-shadow 0.25s; }
.flow-step:hover { border-color: var(--color-border-strong); }
.flow-ic { width: 26px; height: 26px; border-radius: 50%; background: var(--color-ink-soft); color: var(--color-text-tertiary); display: grid; place-items: center; transition: background 0.25s, color 0.25s; }
.flow-step:hover .flow-ic { background: var(--color-ink); color: var(--color-text); }
.flow-step.last { border-color: var(--color-brand-border); background: var(--color-brand-soft); }
.flow-step.last .flow-ic { background: var(--color-brand); color: var(--color-text-inverse); box-shadow: var(--brand-glow-soft); }
.flow-step.last .flow-label { color: var(--color-brand); font-weight: 600; }
.flow-label { font-size: 12.5px; color: var(--color-text-secondary); font-weight: 500; white-space: nowrap; }
.flow-line { flex: 1; min-width: 16px; height: 1.5px; background: var(--color-border-strong); margin: 0 6px; position: relative; }
.flow-line::after { content: ""; position: absolute; right: -1px; top: -3px; width: 0; height: 0; border-left: 5px solid var(--color-border-strong); border-top: 3.5px solid transparent; border-bottom: 3.5px solid transparent; }

@media (max-width: 860px) { .home-inner { padding: 44px 24px 36px; } .entry-grid { grid-template-columns: 1fr; } .hero-title { font-size: 26px; } .flow-line { display: none; } .flow-steps { flex-wrap: wrap; gap: 8px; } }
</style>
