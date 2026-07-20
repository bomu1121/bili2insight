<script setup lang="ts">
import { NIcon } from "naive-ui";
import {
  LinkOutline,
  FolderOpenOutline,
  CloudUploadOutline,
  TimeOutline,
  ChevronForwardOutline,
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
</script>

<template>
  <div class="home-root">
    <div class="home-glow" aria-hidden="true" />

    <section class="hero">
      <div class="brand-mark" aria-hidden="true">
        <span class="brand-mark-inner">B2</span>
      </div>
      <h1 class="hero-title">Bili2Insight</h1>
      <p class="hero-sub">把 B 站长视频，变成可阅读、可导出的结构化笔记</p>
      <div class="hero-chips">
        <span class="chip">AI 观点提炼</span>
        <span class="chip">语音识别</span>
        <span class="chip">Markdown 导出</span>
      </div>
    </section>

    <section class="entry-grid">
      <button
        v-for="item in entries"
        :key="item.key"
        type="button"
        class="entry-card"
        :class="item.tone"
        @click="item.action()"
      >
        <div class="entry-icon">
          <n-icon :size="26">
            <component :is="item.icon" />
          </n-icon>
        </div>
        <div class="entry-copy">
          <div class="entry-label">{{ item.title }}</div>
          <div class="entry-desc">{{ item.desc }}</div>
        </div>
        <div class="entry-go">
          <n-icon :size="18"><ChevronForwardOutline /></n-icon>
        </div>
      </button>
    </section>
  </div>
</template>

<style scoped>
.home-root {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 48px var(--space-6) 56px;
  overflow: auto;
}
.home-glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 70% 45% at 50% -10%, rgba(0, 174, 236, 0.14), transparent 60%),
    radial-gradient(ellipse 40% 30% at 90% 80%, rgba(124, 58, 237, 0.06), transparent 55%);
}
.hero {
  position: relative;
  z-index: 1;
  text-align: center;
  margin-bottom: 40px;
  max-width: 560px;
}
.brand-mark {
  width: 64px;
  height: 64px;
  margin: 0 auto 18px;
  border-radius: 18px;
  background: linear-gradient(145deg, var(--color-brand), #0088c9);
  box-shadow: 0 12px 28px rgba(0, 174, 236, 0.28);
  display: grid;
  place-items: center;
}
.brand-mark-inner {
  color: #fff;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.04em;
}
.hero-title {
  font-size: 34px;
  font-weight: 760;
  letter-spacing: -0.03em;
  margin: 0 0 10px;
  color: var(--color-text);
}
.hero-sub {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}
.hero-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 18px;
}
.chip {
  font-size: 12px;
  color: var(--color-brand-hover);
  background: var(--color-brand-soft);
  border: 1px solid rgba(0, 174, 236, 0.18);
  padding: 4px 10px;
  border-radius: var(--radius-full);
}
.entry-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  width: 100%;
  max-width: var(--content-max-home);
}
.entry-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-height: 118px;
  padding: 18px 16px 18px 18px;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  color: inherit;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  box-shadow: var(--shadow-sm);
  transition:
    transform 0.22s var(--ease-out),
    box-shadow 0.22s var(--ease-out),
    border-color 0.22s var(--ease-out);
}
.entry-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-hover);
  border-color: transparent;
}
.entry-card:focus-visible {
  outline: 2px solid var(--color-brand);
  outline-offset: 2px;
}
.entry-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  transition: transform 0.22s var(--ease-out);
}
.entry-card:hover .entry-icon {
  transform: scale(1.05);
}
.entry-card.url .entry-icon {
  background: var(--color-brand-soft);
  color: var(--color-brand);
}
.entry-card.fav .entry-icon {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}
.entry-card.local .entry-icon {
  background: var(--color-success-soft);
  color: var(--color-success);
}
.entry-card.history .entry-icon {
  background: var(--color-accent-purple-soft);
  color: var(--color-accent-purple);
}
.entry-copy {
  flex: 1;
  min-width: 0;
  padding-top: 2px;
}
.entry-label {
  font-size: 16px;
  font-weight: 650;
  color: var(--color-text);
  margin-bottom: 6px;
}
.entry-desc {
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--color-text-secondary);
}
.entry-go {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  display: grid;
  place-items: center;
  color: var(--color-text-tertiary);
  background: var(--color-bg);
  flex-shrink: 0;
  margin-top: 2px;
  transition: background 0.2s, color 0.2s, transform 0.2s var(--ease-out);
}
.entry-card:hover .entry-go {
  background: var(--color-brand);
  color: #fff;
  transform: translateX(2px);
}
@media (max-width: 720px) {
  .entry-grid {
    grid-template-columns: 1fr;
  }
  .hero-title {
    font-size: 28px;
  }
}
</style>
