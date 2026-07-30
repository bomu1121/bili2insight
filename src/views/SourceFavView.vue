<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { NButton, NText, NIcon, NCheckbox, NSpin, NPagination, NInput, createDiscreteApi } from "naive-ui";
import { ArrowLeft, CirclePlus, FolderOpen, RotateCw, Bookmark, LogIn } from "lucide-vue-next";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useAppStore } from "../stores/app";

const store = useAppStore();
const authStore = useAuthStore();
const router = useRouter();
const { message } = createDiscreteApi(["message"]);

// === Tabs (ref: Linear segmented + Steins;Gate @channel style) ===
const tabs = [
  { key: "folders", label: "收藏夹" },
  { key: "collected", label: "订阅合集" },
  { key: "follow", label: "追番追剧" },
  { key: "watchlater", label: "稍后再看" },
  { key: "history", label: "历史记录" },
] as const;

const activeTab = ref<"folders" | "collected" | "follow" | "watchlater" | "history">("folders");
watch(activeTab, (tab) => {
  selectedFolderId.value = null;
  if (tab === "watchlater" && store.watchLaterItems.length === 0) {
    store.loadWatchLater(1);
  } else if (tab === "history" && store.historyItems.length === 0) {
    store.loadHistory(1);
  }
});
const selectedFolderId = ref<number | null>(null);
const folderSearch = ref("");

onMounted(async () => {
  if (authStore.isLoggedIn) {
    await store.loadFavFolders();
  }
});

const createdFolders = computed(() => store.favFolders.filter((f: any) => !f.collected));
const collectedFolders = computed(() => store.favFolders.filter((f: any) => f.collected));

const activePaneFolders = computed(() => {
  if (activeTab.value === "collected") return collectedFolders.value;
  if (!folderSearch.value.trim()) return createdFolders.value;
  const q = folderSearch.value.toLowerCase();
  return createdFolders.value.filter((f: any) => f.title.toLowerCase().includes(q));
});

function openFolder(folder: any) {
  selectedFolderId.value = folder.id;
  store.openFavFolder(folder);
}
function backToFolders() {
  selectedFolderId.value = null;
  store.favVideos = [];
  store.favIsCollected = false;
}
async function loadPage(p: number) {
  if (store.favIsCollected) {
    await store.loadCollectedVideos(store.favCurrentFolderId, store.favCurrentFolderMid, p);
  } else {
    await store.loadFavVideos(store.favCurrentFolderId, p);
  }
}
function addSelectedToQueue() {
  const sel: any[] = [];
  store.favSelectedVideos.forEach((i: number) => { if (i < store.favVideos.length) sel.push(store.favVideos[i]); });
  if (sel.length === 0) { message.warning("请至少选择一个视频"); return; }
  sel.forEach((v: any) => {
    store.addQueueItem({ url: "https://www.bilibili.com/video/" + v.bvid, pageInfo: { page: 1, part: v.title, cid: v.cid, duration: v.duration }, source: "fav" });
  });
  message.success("已添加 " + sel.length + " 个视频到处理队列");
}
function fmtDur(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0") : String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}
</script>

<template>
  <div class="source-root">
    <!-- ===== Page Header (ref: Linear sticky + Steins;Gate identity) ===== -->
    <div class="page-bar">
      <n-button text class="bar-back" @click="router.push('/')">
        <template #icon><n-icon size="15"><ArrowLeft /></n-icon></template>
      </n-button>
      <div class="bar-title">
        <span class="bar-prefix">&gt; &nbsp;信号源</span>
        <span class="bar-sep">/</span>
        <span class="bar-name">收藏夹</span>
      </div>
      <div class="bar-right">
        <n-button
          size="tiny" quaternary
          @click="store.loadFavFolders()"
          :loading="store.favLoading"
          title="刷新"
        >
          <template #icon><n-icon size="13"><RotateCw /></n-icon></template>
        </n-button>
      </div>
    </div>

    <!-- ===== Tab Bar (ref: Linear segmented control + custom typography) ===== -->
    <nav class="tab-bar">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tab-item"
        :class="{ active: activeTab === t.key }"
        @click="activeTab = t.key"
      >{{ t.label }}</button>
    </nav>

    <!-- Not logged in -- full-width -->
    <div v-if="!authStore.isLoggedIn" class="source-body single-pane">
      <div class="fav-empty">
        <div class="empty-icon"><n-icon :size="30"><LogIn /></n-icon></div>
        <div class="empty-title">需要登录 B 站账号</div>
        <div class="empty-desc">登录后可导入收藏夹、合集、稍后再看等内容</div>
        <n-button type="primary" round @click="authStore.startLogin()">去登录</n-button>
      </div>
    </div>

    <!-- ===== Dual Pane (ref: Hey inbox) ===== -->
    <template v-else>
      <div class="source-body dual-pane">
        <!-- LEFT: Directory -->
        <aside class="pane-left" :class="{ 'pane-left--full': activeTab==='follow' || activeTab==='watchlater' || activeTab==='history' }">
          <div class="pane-content">
            <!-- Folders / Collected -->
            <template title="刷新">
              <div class="pane-search">
                <n-input v-model:value="folderSearch" placeholder="搜索..." size="small" clearable />
              </div>
              <n-spin :show="store.favLoading">
                <div class="folder-list" v-if="activePaneFolders.length > 0">
                  <div
                    v-for="f in activePaneFolders"
                    :key="f.id"
                    class="folder-row"
                    :class="{ active: selectedFolderId === f.id }"
                    @click="openFolder(f)"
                  >
                    <div class="folder-row-icon">
                      <n-icon size="15" :color="activeTab==='collected' ? 'var(--color-accent-indigo)' : 'var(--color-accent-pink)'">
                        <Bookmark v-if="activeTab==='collected'" />
                        <FolderOpen v-else />
                      </n-icon>
                    </div>
                    <div class="folder-row-info">
                      <span class="folder-row-title">{{ f.title }}</span>
                      <span class="folder-row-count tnum">{{ f.count }}</span>
                    </div>
                  </div>
                </div>
                <div v-else class="pane-empty"><n-text depth="3">{{ folderSearch.trim() ? "无匹配结果" : "暂无内容" }}</n-text></div>
              </n-spin>
            </template>

            <!-- Follow -- type toggles -->
            <template v-if="activeTab==='follow'">
              <div class="pane-section-label">分类</div>
              <div class="pane-chips">
                <button class="chip" :class="{ on: store.followType===1 }" @click="store.loadFollowList(1,1)">追番</button>
                <button class="chip" :class="{ on: store.followType===2 }" @click="store.loadFollowList(2,1)">追剧</button>
              </div>
              <div class="pane-meta">已加载 {{ store.followItems.length }} 项</div>
              <div class="pane-hint">点击右侧卡片 → 添加至队列</div>
            </template>

            <template v-if="activeTab==='watchlater'">
              <div class="pane-section-label">稍后再看</div>
              <div class="pane-meta">{{ store.watchLaterItems.length }} 个视频</div>
              <div class="pane-hint">点击行 → 添加至队列</div>
            </template>

            <template v-if="activeTab==='history'">
              <div class="pane-section-label">历史记录</div>
              <div class="pane-meta">{{ store.historyItems.length }} 条</div>
              <div class="pane-hint">点击行 → 添加至队列</div>
            </template>
          </div>
        </aside>

        <!-- RIGHT: Content -->
        <main class="pane-right">
          <!-- Folder video browser (ref: Linear -- single unified sticky bar) -->
          <template v-if="(activeTab==='folders' || activeTab==='collected') && selectedFolderId">
            <n-spin :show="store.favLoadingVideos">
              <div v-if="store.favVideos.length > 0">
                <div class="right-top-bar">
                  <div class="right-top-left">
                    <span class="right-top-channel">@channel</span>
                    <span class="right-top-sep">/</span>
                    <span class="right-top-title">{{ store.favCurrentFolderTitle }}</span>
                  </div>
                  <div class="right-top-right">
                    <label class="right-top-check">
                      <n-checkbox
                        :checked="store.favSelectedVideos.size === store.favVideos.length && store.favVideos.length > 0"
                        @update:checked="store.selectAllFavVideos()"
                        size="small"
                      />
                    </label>
                    <span class="right-top-meta tnum" v-if="store.favSelectedVideos.size > 0">
                      已选 <span class="nixie-num">{{ store.favSelectedVideos.size }}</span>/{{ store.favVideos.length }}
                    </span>
                    <span class="right-top-meta tnum" v-else>
                      <span class="nixie-num">{{ store.favTotal }}</span> 个视频
                    </span>
                    <n-button v-if="store.favSelectedVideos.size > 0" size="tiny" type="primary" @click="addSelectedToQueue">
                      <template #icon><n-icon size="12"><CirclePlus /></n-icon></template>
                      添加到队列
                    </n-button>
                  </div>
                </div>

                <div class="video-list">
                  <div
                    v-for="(v, i) in store.favVideos"
                    :key="i"
                    class="video-row"
                    :class="{ sel: store.favSelectedVideos.has(i) }"
                    @click="store.toggleFavVideo(i)"
                  >
                    <span class="row-no tnum">{{ String(i+1).padStart(3,'0') }}</span>
                    <img v-if="v.cover" :src="v.cover" class="row-thumb" referrerpolicy="no-referrer" />
                    <div class="row-info">
                      <span class="row-title">{{ v.title }}</span>
                      <span class="row-meta tnum">{{ v.uploader }} · {{ fmtDur(v.duration) }}</span>
                    </div>
                  </div>
                </div>

                <n-text v-if="authStore.loginError" depth="3" type="error" style="font-size:12px;display:block;margin:8px 0;">{{ authStore.loginError }}</n-text>

                <div class="pane-pagination" v-if="store.favTotalPages > 1">
                  <n-pagination :page="store.favPage" :page-count="store.favTotalPages" @update:page="loadPage" size="small" />
                </div>
              </div>
              <div v-else class="pane-empty"><n-text depth="3">此收藏夹为空</n-text></div>
            </n-spin>
          </template>

          <!-- Placeholder -->
          <div v-else-if="(activeTab==='folders' || activeTab==='collected') && !selectedFolderId" class="pane-placeholder">
            <div class="placeholder-icon"><n-icon size="36" color="var(--color-text-tertiary)"><FolderOpen /></n-icon></div>
            <n-text depth="3">选择左侧文件夹查看视频</n-text>
          </div>

          <!-- Follow -->
          <template v-if="activeTab==='follow'">
            <n-spin :show="store.followLoading">
              <div v-if="store.followItems.length>0" class="follow-list">
                <div v-for="item in store.followItems" :key="item.season_id" class="follow-card" @click="store.addQueueItem({url:item.url,pageInfo:{page:1,part:item.title,cid:0,duration:0},source:'fav'});message.success('已添加: '+item.title)">
                  <img v-if="item.cover" :src="item.cover" class="follow-cover" referrerpolicy="no-referrer" />
                  <div class="follow-info">
                    <n-text style="font-size:13px;font-weight:600;">{{ item.title }}</n-text>
                    <n-text depth="3" style="font-size:11px;">{{ item.type }}{{ item.area?' · '+item.area:'' }} · {{ item.new_ep||item.progress }}</n-text>
                    <n-text depth="3" style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ item.desc }}</n-text>
                  </div>
                </div>
              </div>
              <div v-else class="pane-empty"><n-text depth="3">点击左侧“追番”或“追剧”加载</n-text></div>
            </n-spin>
          </template>

          <!-- Watchlater -->
          <template v-if="activeTab==='watchlater'">
            <n-spin :show="store.watchLaterLoading">
              <div v-if="store.watchLaterItems.length>0" class="video-list">
                <div v-for="(v,i) in store.watchLaterItems" :key="i" class="video-row" @click="store.addQueueItem({url:'https://www.bilibili.com/video/'+v.bvid,pageInfo:{page:1,part:v.title,cid:v.cid,duration:v.duration},source:'fav'});message.success('已添加')">
                  <span class="row-no tnum">{{ String(i+1).padStart(3,'0') }}</span>
                  <img v-if="v.cover" :src="v.cover" class="row-thumb" referrerpolicy="no-referrer" />
                  <div class="row-info">
                    <span class="row-title">{{ v.title }}</span>
                    <span class="row-meta tnum">{{ v.uploader }} · {{ fmtDur(v.duration) }}</span>
                  </div>
                </div>
              </div>
              <div v-else class="pane-empty"><n-text depth="3">点击上方标签自动加载</n-text></div>
            </n-spin>
            <div class="pane-pagination" v-if="store.watchLaterTotalPages > 1">
              <n-pagination :page="store.watchLaterPage" :page-count="store.watchLaterTotalPages" @update:page="(p:number)=>store.loadWatchLater(p)" size="small" />
            </div>
          </template>

          <!-- History -->
          <template v-if="activeTab==='history'">
            <n-spin :show="store.historyLoading">
              <div v-if="store.historyItems.length>0" class="video-list">
                <div v-for="(v,i) in store.historyItems" :key="i" class="video-row" @click="store.addQueueItem({url:'https://www.bilibili.com/video/'+v.bvid,pageInfo:{page:1,part:v.title,cid:v.cid,duration:v.duration},source:'fav'});message.success('已添加')">
                  <span class="row-no tnum">{{ String(i+1).padStart(3,'0') }}</span>
                  <img v-if="v.cover" :src="v.cover" class="row-thumb" referrerpolicy="no-referrer" />
                  <div class="row-info">
                    <span class="row-title">{{ v.title }}</span>
                    <span class="row-meta tnum">{{ v.uploader }} · {{ fmtDur(v.duration) }}</span>
                  </div>
                </div>
              </div>
              <div v-else class="pane-empty"><n-text depth="3">点击上方标签自动加载</n-text></div>
            </n-spin>
            <div class="pane-pagination" v-if="store.historyTotalPages > 1">
              <n-pagination :page="store.historyPage" :page-count="store.historyTotalPages" @update:page="(p:number)=>store.loadHistory(p)" size="small" />
            </div>
          </template>
        </main>
      </div>
    </template>
  </div>
</template>


<style scoped>
/* ================================================================
   Steins;Gate Favorites — Inbox dual-pane
   ref: Linear (sticky header, segmented tabs, list accents)
        Steins;Gate DSGN (typography, glow, @channel prefix)
   ================================================================ */

/* --- Root --- */
.source-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* ===== PAGE HEADER ===== */
/* ref: Linear -- sticky, compact, identity-connected */
.page-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: var(--header-height);
  padding: 0 18px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 6;
}

/* Back -- minimal, no label, just arrow */
.bar-back {
  color: var(--color-text-tertiary);
  padding: 0;
  min-width: 28px;
  height: 28px;
}
.bar-back:hover { color: var(--color-text); }

/* Title (ref: Steins;Gate -- @channel path notation) */
.bar-title {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  font-size: 13px;
}
.bar-prefix {
  color: var(--color-text-tertiary);
  font-weight: 400;
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: -0.2px;
}
.bar-sep {
  color: var(--color-border-strong);
  margin: 0 2px;
  font-weight: 300;
}
.bar-name {
  color: var(--color-text);
  font-weight: 600;
}

.bar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ===== TAB BAR (ref: Linear segmented + Steins;Gate active prefix) ===== */
.tab-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 14px;
  background: var(--color-bg);
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.tab-bar::-webkit-scrollbar { display: none; }

.tab-item {
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
  font-family: var(--font-family);
  transition: color 0.15s, background 0.15s;
}
.tab-item:hover {
  color: var(--color-text);
  background: var(--color-ink-hover);
}
.tab-item.active {
  color: var(--color-brand);
  background: rgba(139,62,62,0.12);
}
/* SteinsGate: active tab gets > prefix like @channel */
.tab-item.active::before {
  content: "> ";
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-brand);
}

/* --- Single-pane (not logged in) --- */
.single-pane {
  flex: 1;
  padding: 16px 24px 32px;
  max-width: var(--content-max-wide);
  margin: 0 auto;
  width: 100%;
  overflow-y: auto;
}

/* --- Dual-pane grid --- */
.dual-pane {
  flex: 1;
  display: grid;
  grid-template-columns: 256px 1fr;
  overflow: hidden;
}

/* ===== LEFT PANE ===== */
.pane-left {
  border-right: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pane-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px 16px;
}

.pane-search {
  margin-bottom: 8px;
}

/* Folder rows (ref: Linear -- compact, left accent) */
.folder-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.folder-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 9px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: background 0.12s, border-left-color 0.12s;
}
.folder-row:hover {
  background: var(--color-ink-hover);
}
.folder-row.active {
  background: var(--color-brand-soft);
  border-left-color: var(--color-brand);
}

.folder-row-icon {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  background: var(--color-ink-soft);
  border-radius: 6px;
  flex-shrink: 0;
}

.folder-row-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.folder-row-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.folder-row-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  background: var(--color-ink-soft);
  padding: 1px 6px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

/* Left pane section labels / meta */
.pane-section-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-top: 10px;
  margin-bottom: 4px;
}
.pane-section-label:first-child { margin-top: 0; }

.pane-meta {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin: 4px 0;
}

.pane-chips {
  display: flex;
  gap: 4px;
}
.chip {
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  font-family: var(--font-family);
}
.chip:hover {
  border-color: var(--color-brand-border);
  color: var(--color-text);
}
.chip.on {
  background: var(--color-brand-soft);
  border-color: var(--color-brand-border);
  color: var(--color-brand);
}

.pane-hint {
  font-size: 11px;
  color: var(--color-text-tertiary);
  line-height: 1.5;
  margin-top: 6px;
}

.pane-empty {
  padding: 24px 0;
  text-align: center;
}

/* ===== RIGHT PANE ===== */
.pane-right {
  overflow-y: auto;
  padding: 10px 18px 24px;
}

.pane-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding-top: 80px;
  text-align: center;
}
.placeholder-icon { opacity: 0.25; }

/* Right top bar (ref: Linear -- single unified sticky bar: title + count + checkbox + actions) */
.right-top-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  margin-bottom: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  position: sticky;
  top: 0;
  z-index: 4;
}
.right-top-left {
  display: flex;
  align-items: baseline;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.right-top-channel {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.right-top-sep {
  color: var(--color-border-strong);
  margin: 0 2px;
  font-weight: 300;
}
.right-top-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.right-top-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.right-top-check {
  display: flex;
  cursor: pointer;
}
.right-top-meta {
  font-size: 11px;
  color: var(--color-text-secondary);
}
/* Nixie tube style — reused in right-top-bar */
.nixie-num {
  color: var(--divergence-color);
  text-shadow: var(--divergence-glow);
  font-weight: 700;
}

/* Video list (ref: Linear -- no height cap, natural flow) */
.video-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.video-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 9px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background 0.12s, border-left-color 0.12s;
}
.video-row:hover {
  background: var(--color-ink-hover);
}
.video-row.sel {
  background: var(--color-brand-soft);
  border-left-color: var(--color-brand);
}

.row-no {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  min-width: 32px;
  flex-shrink: 0;
  transition: color 0.15s;
}
.video-row.sel .row-no { color: var(--color-brand); }

.row-thumb {
  width: 84px;
  aspect-ratio: 16/9;
  object-fit: cover;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  background: var(--color-surface-muted);
}

.row-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.row-title {
  font-size: 13px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-meta {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.pane-pagination {
  display: flex;
  justify-content: center;
  margin-top: 14px;
}

/* Follow list */
.follow-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.follow-card {
  display: flex;
  gap: 12px;
  padding: 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  cursor: pointer;
  background: var(--color-surface);
  transition: border-color 0.18s, box-shadow 0.18s;
}
.follow-card:hover {
  border-color: var(--color-accent-pink-border);
  box-shadow: 0 2px 12px rgba(0,0,0,0.18);
}
.follow-cover {
  width: 66px;
  height: 88px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  background: var(--color-surface-muted);
}
.follow-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding-top: 2px;
}

/* Not logged in empty state */
.fav-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 72px 16px;
  text-align: center;
}
.empty-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: var(--color-accent-pink-soft);
  color: var(--color-accent-pink);
  margin-bottom: 4px;
}
.empty-title { font-size: 15px; font-weight: 650; color: var(--color-text); }
.empty-desc { font-size: 13px; color: var(--color-text-secondary); margin-bottom: 8px; }

/* Staggered entrance */
.video-row { animation: materialize 0.28s var(--ease-out) both; }
.video-row:nth-child(1) { animation-delay: 0s; }
.video-row:nth-child(2) { animation-delay: 0.04s; }
.video-row:nth-child(3) { animation-delay: 0.08s; }
.video-row:nth-child(4) { animation-delay: 0.12s; }
.video-row:nth-child(5) { animation-delay: 0.16s; }
</style>
