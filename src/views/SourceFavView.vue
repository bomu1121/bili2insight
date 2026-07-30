<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { NButton, NText, NIcon, NCheckbox, NSpin, NPagination, NInput, createDiscreteApi } from "naive-ui";
import { ArrowLeft, CirclePlus, FolderOpen, RotateCw, Bookmark, LogIn, Inbox, SearchX, Film, ListVideo, History } from "lucide-vue-next";
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
    <!-- ===== Tab Bar (ref: Linear segmented + custom typography) ===== -->
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
    <div v-if="!authStore.isLoggedIn" class="source-body">
      <div class="empty-state">
        <div class="empty-icon"><n-icon :size="36"><LogIn /></n-icon></div>
        <div class="empty-title">需要登录 B 站账号</div>
        <div class="empty-desc">登录后可导入收藏夹、合集、稍后再看等内容</div>
        <n-button type="primary" round @click="authStore.startLogin()">去登录</n-button>
      </div>
    </div>

    <!-- ===== Logged in: single column layout (ref: Arc + Raycast) ===== -->
    <div v-else class="source-body">

      <!-- =============== FOLDERS / COLLECTED =============== -->
      <template v-if="activeTab==='folders' || activeTab==='collected'">

        <!-- Folder browser mode -->
        <template v-if="!selectedFolderId">
          <div class="toolbar-row">
            <n-input v-model:value="folderSearch" placeholder="搜索收藏夹..." size="small" clearable class="toolbar-search" />
            <span class="toolbar-meta tnum" v-if="!folderSearch.trim()">{{ createdFolders.length }} 个收藏夹</span>
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
            <div v-else class="empty-state">
              <div class="empty-icon"><n-icon :size="36" color="var(--color-text-tertiary)"><SearchX v-if="folderSearch.trim()" /><Inbox v-else /></n-icon></div>
              <div class="empty-title">{{ folderSearch.trim() ? '无匹配结果' : '暂无内容' }}</div>
              <div class="empty-desc">{{ folderSearch.trim() ? '尝试其他关键词' : '还没有收藏任何视频' }}</div>
            </div>
          </n-spin>
        </template>

        <!-- Video list mode -->
        <template v-else>
          <div class="breadcrumb-bar">
            <div class="breadcrumb-left">
              <button class="breadcrumb-back" @click="backToFolders">
                <n-icon :size="15"><ArrowLeft /></n-icon>
              </button>
              <span class="breadcrumb-path">
                <span class="breadcrumb-channel">@channel</span>
                <span class="breadcrumb-sep">/</span>
                <span class="breadcrumb-current">{{ store.favCurrentFolderTitle }}</span>
              </span>
            </div>
            <div class="breadcrumb-right">
              <label class="breadcrumb-check">
                <n-checkbox
                  :checked="store.favSelectedVideos.size === store.favVideos.length && store.favVideos.length > 0"
                  @update:checked="store.selectAllFavVideos()"
                  size="small"
                />
              </label>
              <span class="breadcrumb-meta tnum" v-if="store.favSelectedVideos.size > 0">
                已选 <span class="nixie-num">{{ store.favSelectedVideos.size }}</span>/{{ store.favVideos.length }}
              </span>
              <span class="breadcrumb-meta tnum" v-else>
                <span class="nixie-num">{{ store.favTotal }}</span> 个视频
              </span>
              <n-button v-if="store.favSelectedVideos.size > 0" size="tiny" type="primary" @click="addSelectedToQueue">
                <template #icon><n-icon size="12"><CirclePlus /></n-icon></template>
                添加到队列
              </n-button>
            </div>
          </div>

          <n-spin :show="store.favLoadingVideos">
            <div v-if="store.favVideos.length > 0">
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
            <div v-else class="empty-state">
              <div class="empty-icon"><n-icon :size="36" color="var(--color-text-tertiary)"><Inbox /></n-icon></div>
              <div class="empty-title">此收藏夹为空</div>
              <div class="empty-desc">该收藏夹中还没有视频</div>
            </div>
          </n-spin>
        </template>
      </template>

      <!-- =============== FOLLOW =============== -->
      <template v-if="activeTab==='follow'">
        <div class="toolbar-row">
          <div class="pane-chips">
            <button class="chip" :class="{ on: store.followType===1 }" @click="store.loadFollowList(1,1)">追番</button>
            <button class="chip" :class="{ on: store.followType===2 }" @click="store.loadFollowList(2,1)">追剧</button>
          </div>
          <span class="toolbar-meta tnum">已加载 {{ store.followItems.length }} 项</span>
        </div>

        <n-spin :show="store.followLoading">
          <div v-if="store.followItems.length>0" class="video-list">
            <div v-for="(item, i) in store.followItems" :key="item.season_id" class="video-row" @click="store.addQueueItem({url:item.url,pageInfo:{page:1,part:item.title,cid:0,duration:0},source:'fav'});message.success('已添加: '+item.title)">
              <span class="row-no tnum">{{ String(i+1).padStart(3,'0') }}</span>
              <img v-if="item.cover" :src="item.cover" class="row-thumb" referrerpolicy="no-referrer" />
              <div class="row-info">
                <span class="row-title">{{ item.title }}</span>
                <span class="row-meta tnum">{{ item.type }}{{ item.area?' · '+item.area:'' }} · {{ item.new_ep||item.progress }}</span>
                <span class="row-meta tnum" style="opacity:0.65">{{ item.desc }}</span>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            <div class="empty-icon"><n-icon :size="36" color="var(--color-text-tertiary)"><Film /></n-icon></div>
            <div class="empty-title">暂无数据</div>
            <div class="empty-desc">点击「追番」或「追剧」加载内容</div>
          </div>
        </n-spin>
      </template>

      <!-- =============== WATCHLATER =============== -->
      <template v-if="activeTab==='watchlater'">
        <div class="toolbar-row">
          <span class="toolbar-label">稍后再看</span>
          <span class="toolbar-meta tnum">{{ store.watchLaterItems.length }} 个视频</span>
        </div>

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
          <div v-else class="empty-state">
            <div class="empty-icon"><n-icon :size="36" color="var(--color-text-tertiary)"><ListVideo /></n-icon></div>
            <div class="empty-title">暂无数据</div>
            <div class="empty-desc">点击「稍后再看」标签自动加载</div>
          </div>
          <div class="pane-pagination" v-if="store.watchLaterTotalPages > 1">
            <n-pagination :page="store.watchLaterPage" :page-count="store.watchLaterTotalPages" @update:page="(p:number)=>store.loadWatchLater(p)" size="small" />
          </div>
        </n-spin>
      </template>

      <!-- =============== HISTORY =============== -->
      <template v-if="activeTab==='history'">
        <div class="toolbar-row">
          <span class="toolbar-label">历史记录</span>
          <span class="toolbar-meta tnum">{{ store.historyItems.length }} 条</span>
        </div>

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
          <div v-else class="empty-state">
            <div class="empty-icon"><n-icon :size="36" color="var(--color-text-tertiary)"><History /></n-icon></div>
            <div class="empty-title">暂无数据</div>
            <div class="empty-desc">点击「历史记录」标签自动加载</div>
          </div>
          <div class="pane-pagination" v-if="store.historyTotalPages > 1">
            <n-pagination :page="store.historyPage" :page-count="store.historyTotalPages" @update:page="(p:number)=>store.loadHistory(p)" size="small" />
          </div>
        </n-spin>
      </template>

    </div>
  </div>
</template>


<style scoped>
/* ================================================================
   Steins;Gate Favorites — Single Column (ref: Arc + Raycast)
   C: 收藏夹为中心的单页体验 -- full-width, breadcrumb nav
   ================================================================ */

/* --- Root --- */
.source-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* ===== TAB BAR (ref: Linear segmented + Steins;Gate active prefix) ===== */
.tab-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 18px;
  min-height: 38px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
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
.tab-item.active::before {
  content: "> ";
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-brand);
}

/* ===== SOURCE BODY -- single column, full width (ref: Arc) ===== */
.source-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px 40px;
  max-width: 960px;
  width: 100%;
  margin: 0 auto;
  scrollbar-gutter: stable;
}

/* ===== BREADCRUMB BAR (ref: Arc -- back navigation + path) ===== */
.breadcrumb-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--color-border);
  /* ref: Linear -- breadcrumbs scroll with content, header is the only fixed element */
}

.breadcrumb-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.breadcrumb-back {
  color: var(--color-text-tertiary);
  padding: 4px;
  min-width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}
.breadcrumb-back:hover {
  color: var(--color-text);
  background: var(--color-ink-hover);
}

.breadcrumb-path {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  font-size: 13px;
  min-width: 0;
}
.breadcrumb-channel {
  color: var(--color-text-tertiary);
  font-weight: 400;
  font-family: var(--font-mono);
  font-size: 12px;
}
.breadcrumb-sep {
  color: var(--color-border-strong);
  margin: 0 2px;
  font-weight: 300;
}
.breadcrumb-current {
  color: var(--color-text);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.breadcrumb-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.breadcrumb-check {
  display: flex;
  cursor: pointer;
}
.breadcrumb-meta {
  font-size: 11px;
  color: var(--color-text-secondary);
}

/* ===== TOOLBAR ROW (ref: Raycast -- compact action bar) ===== */
.toolbar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0 14px;
  min-height: 44px;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 4px;
}
.toolbar-search {
  max-width: 280px;
}
.toolbar-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}
.toolbar-meta {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-left: auto;
  flex-shrink: 0;
}

/* ===== NIXIE number (reused) ===== */
.nixie-num {
  color: var(--divergence-color);
  text-shadow: var(--divergence-glow);
  font-weight: 700;
}

/* ===== FOLDER LIST (ref: Linear -- compact, full-width list) ===== */
.folder-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.folder-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: background 0.15s, border-left-color 0.15s;
}
.folder-row:hover {
  background: var(--color-ink-hover);
}
.folder-row.active {
  background: var(--color-brand-soft);
  border-left-color: var(--color-brand);
}

.folder-row-icon {
  width: 32px;
  height: 32px;
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

/* ===== CHIPS (ref: Linear) ===== */
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

/* ===== VIDEO LIST (ref: Linear -- full-width rows) ===== */
.video-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.video-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background 0.15s, border-left-color 0.15s;
  animation: materialize 0.28s var(--ease-out) both;
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
  min-width: 36px;
  flex-shrink: 0;
  transition: color 0.15s;
}
.video-row.sel .row-no { color: var(--color-brand); }

.row-thumb {
  width: 96px;
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

/* ===== UNIFIED EMPTY STATE (ref: Notion + Refactoring UI) ===== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 64px 16px;
  text-align: center;
}
.empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: var(--color-ink-soft);
  color: var(--color-text-tertiary);
  margin-bottom: 4px;
  border: 1px solid var(--color-border);
}
.empty-title {
  font-size: 15px;
  font-weight: 650;
  color: var(--color-text);
}
.empty-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

/* ===== SKELETON LOADING (ref: Linear) ===== */
.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.skeleton-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
}
.skeleton-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--color-ink-soft);
  animation: skel-pulse 1.6s ease-in-out infinite;
  flex-shrink: 0;
}
.skeleton-no {
  width: 36px;
  height: 13px;
  border-radius: 4px;
  background: var(--color-ink-soft);
  animation: skel-pulse 1.6s ease-in-out infinite;
  flex-shrink: 0;
}
.skeleton-thumb {
  width: 96px;
  aspect-ratio: 16/9;
  border-radius: var(--radius-sm);
  background: var(--color-ink-soft);
  animation: skel-pulse 1.6s ease-in-out infinite;
  flex-shrink: 0;
}
.skeleton-lines {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.skeleton-line {
  border-radius: 4px;
  background: var(--color-ink-soft);
  animation: skel-pulse 1.6s ease-in-out infinite;
}
.skeleton-line--title {
  height: 13px;
  width: 70%;
}
.skeleton-line--meta {
  height: 10px;
  width: 45%;
}
.skeleton-line--wide {
  height: 13px;
  width: 85%;
}

@keyframes skel-pulse {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 0.7; }
}


/* ===== SCROLLBAR (ref: Linear -- thin, subtle, anti-ornament) ===== */
.source-body::-webkit-scrollbar {
  width: 5px;
}
.source-body::-webkit-scrollbar-track {
  background: transparent;
}
.source-body::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
  transition: background 0.2s;
}
.source-body::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-strong);
}

/* Firefox thin scrollbar */
.source-body {
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}
</style>
