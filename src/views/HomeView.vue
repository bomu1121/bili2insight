<script setup lang="ts">
import { NIcon } from "naive-ui";
import { VideocamOutline, FolderOpenOutline, CloudUploadOutline } from "@vicons/ionicons5";
import { useRouter } from "vue-router";
import { useAppStore } from "../stores/app";
import { createDiscreteApi } from "naive-ui";
const router = useRouter();
const store = useAppStore();
const { message } = createDiscreteApi(["message"]);

function goToFav() {
  if (store.isLoggedIn) {
    router.push("/source/fav");
  } else {
    message.warning("请先点击右上角头像登录B站账号");
  }
}
</script>

<template>
  <div class="home-root">
    <div class="hero">
      <n-icon size="48" color="#00aeec"><VideocamOutline /></n-icon>
      <h1 class="hero-title">Bili2Insight</h1>
      <p class="hero-sub">B站视频 · AI 观点提炼 · 结构化笔记</p>
    </div>

    <div class="entry-grid">
      <button class="entry-btn" @click="router.push('/source/url')">
        <div class="entry-icon url"><n-icon size="28"><VideocamOutline /></n-icon></div>
        <div class="entry-label">B站链接</div>
        <div class="entry-desc">粘贴视频地址，自动解析并加入队列</div>
        <div class="entry-arrow">→</div>
      </button>

      <button class="entry-btn" @click="goToFav()">
        <div class="entry-icon fav"><n-icon size="28"><FolderOpenOutline /></n-icon></div>
        <div class="entry-label">B站收藏夹</div>
        <div class="entry-desc">登录B站账号，批量导入收藏视频</div>
        <div class="entry-arrow">→</div>
      </button>

      <button class="entry-btn disabled" disabled>
        <div class="entry-icon local"><n-icon size="28"><CloudUploadOutline /></n-icon></div>
        <div class="entry-label">本地文件</div>
        <div class="entry-desc">上传本地视频或音频文件</div>
        <div class="entry-badge">即将支持</div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.home-root { display: flex; flex-direction: column; align-items: center; padding: 60px 24px 40px; min-height: 100%; }
.hero { text-align: center; margin-bottom: 48px; }
.hero-title { font-size: 28px; font-weight: 700; margin: 14px 0 6px; color: #111; }
.hero-sub { font-size: 15px; color: #999; margin: 0; }
.entry-grid { display: flex; flex-direction: column; gap: 14px; width: 100%; max-width: 440px; }
.entry-btn {
  display: flex; align-items: center; gap: 16px; padding: 20px 24px;
  background: #fff; border: 1.5px solid #eee; border-radius: 14px;
  cursor: pointer; text-align: left; transition: all .2s; width: 100%; font-family: inherit;
}
.entry-btn:hover:not(:disabled) { border-color: #00aeec; box-shadow: 0 2px 16px rgba(0,174,236,.1); transform: translateY(-1px); }
.entry-btn:disabled { opacity: .5; cursor: not-allowed; }
.entry-icon { width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.entry-icon.url { background: #e8f4fd; color: #00aeec; }
.entry-icon.fav { background: #fef3e8; color: #f0a020; }
.entry-icon.local { background: #e8f8e8; color: #18a058; }
.entry-label { font-size: 17px; font-weight: 600; color: #222; flex: 1; }
.entry-desc { font-size: 12px; color: #aaa; }
.entry-arrow { font-size: 18px; color: #ccc; flex-shrink: 0; }
.entry-badge { font-size: 11px; color: #bbb; border: 1px dashed #ddd; padding: 2px 10px; border-radius: 10px; flex-shrink: 0; white-space: nowrap; }
</style>
