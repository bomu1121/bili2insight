<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { NButton, NText, NIcon, NCheckbox, NSpin, NPagination, NInput, createDiscreteApi, NTabs, NTabPane } from "naive-ui";
import { ArrowLeft, CirclePlus, FolderOpen, RotateCw, Bookmark, ChevronRight, LogIn } from "lucide-vue-next";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useAppStore } from "../stores/app";

const store = useAppStore();
const authStore = useAuthStore();
const router = useRouter();
const { message } = createDiscreteApi(["message"]);

const activeTab = ref<"folders" | "collected" | "follow" | "watchlater" | "history">("folders");
watch(activeTab, (tab) => {
  if (tab === "watchlater" && store.watchLaterItems.length === 0) {
    store.loadWatchLater(1);
  } else if (tab === "history" && store.historyItems.length === 0) {
    store.loadHistory(1);
  }
});
const showFolders = ref(true);
const folderSearch = ref("");

onMounted(async () => {
  if (authStore.isLoggedIn) {
    await store.loadFavFolders();
  }
});

const filteredFolders = computed(() => {
  if (!folderSearch.value.trim()) return createdFolders.value;
  const q = folderSearch.value.toLowerCase();
  return createdFolders.value.filter((f: any) => f.title.toLowerCase().includes(q));
});

const createdFolders = computed(() => store.favFolders.filter((f: any) => !f.collected));
const collectedFolders = computed(() => store.favFolders.filter((f: any) => f.collected));

function openFolder(folder: any) {
  showFolders.value = false;
  store.openFavFolder(folder);
}
function backToFolders() {
  showFolders.value = true;
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
    <div class="page-bar">
      <n-button text class="bar-back" @click="router.push('/')"><template #icon><n-icon><ArrowLeft /></n-icon></template>返回</n-button>
      <div class="bar-title">
        <span class="bar-ic fav"><n-icon :size="15"><FolderOpen /></n-icon></span>
        <n-text strong>B站收藏</n-text>
      </div>
    </div>

    <div class="source-body">
      <div v-if="!authStore.isLoggedIn" class="fav-empty">
        <div class="empty-icon"><n-icon :size="30"><LogIn /></n-icon></div>
        <div class="empty-title">需要登录 B 站账号</div>
        <div class="empty-desc">登录后可导入收藏夹、合集、稍后再看等内容</div>
        <n-button type="primary" round @click="authStore.startLogin()">去登录</n-button>
      </div>

      <template v-else>
        <!-- Tab bar -->
        <n-tabs v-model:value="activeTab" type="line" size="small" v-if="showFolders">
          <n-tab-pane name="folders" tab="收藏夹"></n-tab-pane>
          <n-tab-pane name="collected" tab="订阅合集"></n-tab-pane>
          <n-tab-pane name="follow" tab="追番追剧"></n-tab-pane>
          <n-tab-pane name="watchlater" tab="稍后再看"></n-tab-pane>
          <n-tab-pane name="history" tab="历史记录"></n-tab-pane>
        </n-tabs>

        <!-- Tab: 收藏夹 -->
        <div v-if="showFolders && activeTab==='folders'">
          <div class="fav-bar">
            <n-input v-model:value="folderSearch" placeholder="搜索收藏夹..." size="small" clearable style="width:220px;" />
            <n-button size="small" @click="store.loadFavFolders()" :loading="store.favLoading">
              <template #icon><n-icon><RotateCw /></n-icon></template>
            </n-button>
          </div>
          <n-spin :show="store.favLoading">
            <div class="folder-grid" v-if="filteredFolders.length > 0">
              <div v-for="f in filteredFolders" :key="f.id" class="folder-card" @click="openFolder(f)">
                <div class="folder-icon"><n-icon size="20" color="var(--color-accent-pink)"><FolderOpen /></n-icon></div>
                <div class="folder-info">
                  <n-text style="font-size:14px;font-weight:600;">{{ f.title }}</n-text>
                  <n-text depth="3" style="font-size:12px;" class="tnum">{{ f.count }} 个视频</n-text>
                </div>
                <span class="folder-arrow"><n-icon :size="15"><ChevronRight /></n-icon></span>
              </div>
            </div>
            <div v-else class="fav-empty"><n-text depth="3">{{ folderSearch.trim() ? "未找到匹配的收藏夹" : "暂无收藏夹" }}</n-text></div>
          </n-spin>
        </div>

        <!-- Tab: 订阅合集 -->
        <div v-if="showFolders && activeTab==='collected'">
          <n-spin :show="store.favLoading">
            <div class="folder-grid" v-if="collectedFolders.length > 0">
              <div v-for="f in collectedFolders" :key="f.id" class="folder-card" @click="openFolder(f)">
                <div class="folder-icon"><n-icon size="20" color="var(--color-accent-pink)"><Bookmark /></n-icon></div>
                <div class="folder-info">
                  <n-text style="font-size:14px;font-weight:600;">{{ f.title }}</n-text>
                  <n-text depth="3" style="font-size:12px;" class="tnum">{{ f.count }} 个视频</n-text>
                </div>
                <span class="folder-arrow"><n-icon :size="15"><ChevronRight /></n-icon></span>
              </div>
            </div>
            <div v-else class="fav-empty"><n-text depth="3">暂无订阅合集</n-text></div>
          </n-spin>
        </div>

        <!-- Tab: 追番追剧 -->
        <div v-if="showFolders && activeTab==='follow'">
          <div class="fav-bar">
            <n-button size="small" :type="store.followType===1?'primary':'default'" @click="store.loadFollowList(1,1)">追番</n-button>
            <n-button size="small" :type="store.followType===2?'primary':'default'" @click="store.loadFollowList(2,1)">追剧</n-button>
          </div>
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
            <div v-else class="fav-empty"><n-text depth="3">点击"追番"或"追剧"加载</n-text></div>
          </n-spin>
        </div>

        <!-- Tab: 稍后再看 -->
        <div v-if="showFolders && activeTab==='watchlater'">
          <n-spin :show="store.watchLaterLoading">
            <div v-if="store.watchLaterItems.length>0">
              <div class="fav-video-list">
                <div v-for="(v,i) in store.watchLaterItems" :key="i" class="fav-video-row" @click="store.addQueueItem({url:'https://www.bilibili.com/video/'+v.bvid,pageInfo:{page:1,part:v.title,cid:v.cid,duration:v.duration},source:'fav'});message.success('已添加')">
                  <img v-if="v.cover" :src="v.cover" class="fav-thumb" referrerpolicy="no-referrer" />
                  <div class="fav-video-info">
                    <n-text style="font-size:13px;">{{ v.title }}</n-text>
                    <n-text depth="3" style="font-size:11px;" class="tnum">{{ v.uploader }} · {{ fmtDur(v.duration) }}</n-text>
                  </div>
                </div>
              </div>
            </div>
            <div v-else-if="store.watchLaterItems.length===0" class="fav-empty"><n-text depth="3">点击上方标签自动加载</n-text></div>
          </n-spin>
          <div class="fav-pagination" v-if="store.watchLaterTotalPages > 1">
            <n-pagination :page="store.watchLaterPage" :page-count="store.watchLaterTotalPages" @update:page="(p:number)=>store.loadWatchLater(p)" size="small" />
          </div>
        </div>

        <!-- Tab: 历史记录 -->
        <div v-if="showFolders && activeTab==='history'">
          <n-spin :show="store.historyLoading">
            <div v-if="store.historyItems.length>0">
              <div class="fav-video-list">
                <div v-for="(v,i) in store.historyItems" :key="i" class="fav-video-row" @click="store.addQueueItem({url:'https://www.bilibili.com/video/'+v.bvid,pageInfo:{page:1,part:v.title,cid:v.cid,duration:v.duration},source:'fav'});message.success('已添加')">
                  <img v-if="v.cover" :src="v.cover" class="fav-thumb" referrerpolicy="no-referrer" />
                  <div class="fav-video-info">
                    <n-text style="font-size:13px;">{{ v.title }}</n-text>
                    <n-text depth="3" style="font-size:11px;" class="tnum">{{ v.uploader }} · {{ fmtDur(v.duration) }}</n-text>
                  </div>
                </div>
              </div>
            </div>
            <div v-else-if="store.historyItems.length===0" class="fav-empty"><n-text depth="3">点击上方标签自动加载</n-text></div>
          </n-spin>
          <div class="fav-pagination" v-if="store.historyTotalPages > 1">
            <n-pagination :page="store.historyPage" :page-count="store.historyTotalPages" @update:page="(p:number)=>store.loadHistory(p)" size="small" />
          </div>
        </div>

        <!-- Folder content (videos) -->
        <div v-if="!showFolders">
          <div class="fav-bar folder-head">
            <n-button text @click="backToFolders"><template #icon><n-icon><ArrowLeft /></n-icon></template>返回目录</n-button>
            <n-text class="folder-head-title">{{ store.favCurrentFolderTitle }}</n-text>
            <n-text depth="3" style="font-size:12px;" class="tnum">共{{ store.favTotal }} 个视频</n-text>
          </div>
          <n-spin :show="store.favLoadingVideos">
            <div v-if="store.favVideos.length > 0">
              <div class="page-header-row">
                <n-checkbox :checked="store.favSelectedVideos.size === store.favVideos.length" @update:checked="store.selectAllFavVideos()">全选 ({{ store.favSelectedVideos.size }}/{{ store.favVideos.length }})</n-checkbox>
              </div>
              <div class="fav-video-list">
                <div v-for="(v, i) in store.favVideos" :key="i" class="fav-video-row" :class="{ sel: store.favSelectedVideos.has(i) }" @click="store.toggleFavVideo(i)">
                  <n-checkbox :checked="store.favSelectedVideos.has(i)" size="small" />
                  <img v-if="v.cover" :src="v.cover" class="fav-thumb" referrerpolicy="no-referrer" />
                  <div class="fav-video-info">
                    <n-text style="font-size:13px;">{{ v.title }}</n-text>
                    <n-text depth="3" style="font-size:11px;" class="tnum">{{ v.uploader }} · {{ fmtDur(v.duration) }}</n-text>
                  </div>
                </div>
              </div>
               <n-text v-if="authStore.loginError" depth="3" type="error" style="font-size:12px;display:block;margin:8px 0;">{{ authStore.loginError }}</n-text>
              <div class="fav-pagination" v-if="store.favTotalPages > 1">
                <n-pagination :page="store.favPage" :page-count="store.favTotalPages" @update:page="loadPage" size="small" />
              </div>
              <n-button type="primary" block @click="addSelectedToQueue" :disabled="store.favSelectedVideos.size === 0" style="margin-top:14px;">
                <template #icon><n-icon><CirclePlus /></n-icon></template>添加到处理队列
              </n-button>
            </div>
            <div v-else class="fav-empty"><n-text depth="3">此收藏夹为空</n-text></div>
          </n-spin>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.source-root { display: flex; flex-direction: column; height: 100%; overflow-y: auto; scrollbar-gutter: stable; }
.page-bar { display: flex; align-items: center; gap: 12px; height: var(--header-height); padding: 0 20px; background: var(--color-surface); border-bottom: 1px solid var(--color-border); flex-shrink: 0; position: sticky; top: 0; z-index: 5; }
.bar-back { color: var(--color-text-secondary); }
.bar-title { display: inline-flex; align-items: center; gap: 9px; font-size: 15px; }
.bar-ic { width: 26px; height: 26px; border-radius: 7px; display: grid; place-items: center; }
.bar-ic.fav { background: var(--color-accent-pink-soft); color: var(--color-accent-pink); }
.source-body { flex: 1; padding: 16px 24px 32px; max-width: var(--content-max-wide); margin: 0 auto; width: 100%; display: flex; flex-direction: column; gap: 12px; }
.fav-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 72px 16px; text-align: center; }
.empty-icon { width: 60px; height: 60px; border-radius: 16px; display: grid; place-items: center; background: var(--color-accent-pink-soft); color: var(--color-accent-pink); margin-bottom: 4px; }
.empty-title { font-size: 16px; font-weight: 650; color: var(--color-text); }
.empty-desc { font-size: 13px; color: var(--color-text-secondary); margin-bottom: 8px; }
.fav-bar { display: flex; align-items: center; gap: 8px; margin: 4px 0 8px; }
.folder-head { gap: 10px; }
.folder-head-title { font-size: 14px; font-weight: 600; flex: 1; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0 12px; }
.folder-grid { display: flex; flex-direction: column; gap: 8px; }
.folder-card { display: flex; align-items: center; gap: 16px; padding: 16px 18px; background: linear-gradient(90deg, rgba(212,135,149,0.1), rgba(212,135,149,0.02)); background-size: 0% 100%; background-repeat: no-repeat; border: 1px solid var(--color-border); border-left: 3px solid transparent; border-radius: var(--radius-lg); cursor: pointer; box-shadow: var(--shadow-xs); transition: background-size 0.4s cubic-bezier(0.22,0.61,0.36,1), border-color 0.3s, box-shadow 0.3s, border-left-color 0.3s, padding-left 0.3s; }
.folder-card:hover { background-size: 100% 100%; border-color: rgba(212,135,149,0.5); border-left-color: var(--color-accent-pink); padding-left: 15px; box-shadow: 0 0 0 1px rgba(212,135,149,0.3), 0 6px 28px rgba(0,0,0,0.4), 0 0 20px rgba(212,135,149,0.12); }
.folder-icon { width: 48px; height: 48px; display: grid; place-items: center; background: var(--color-accent-pink-soft); border-radius: 12px; flex-shrink: 0; transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s, background 0.3s; }
.folder-card:hover .folder-icon { transform: rotate(-6deg) scale(1.08); box-shadow: 0 0 20px rgba(212,135,149,0.25); background: rgba(212,135,149,0.15); }
.folder-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.folder-card .tnum { display: inline-block; padding: 2px 10px; background: rgba(212,135,149,0.08); border-radius: var(--radius-full); font-size: 11px; font-weight: 600; color: var(--color-accent-pink); align-self: flex-start; }
.folder-arrow { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: var(--color-text-tertiary); background: rgba(255,255,255,0.03); flex-shrink: 0; transition: background 0.3s, color 0.3s, box-shadow 0.3s, transform 0.35s cubic-bezier(0.34,1.56,0.64,1); }
.folder-card:hover .folder-arrow { background: rgba(212,135,149,0.2); color: var(--color-accent-pink); box-shadow: 0 0 16px rgba(212,135,149,0.45); transform: scale(1.15); }
.page-header-row { margin-bottom: 8px; padding: 0 4px; }
.fav-video-list { display: flex; flex-direction: column; gap: 6px; max-height: 460px; overflow-y: auto; }
.fav-video-row { display: flex; align-items: center; gap: 12px; padding: 9px 12px; border-radius: var(--radius-lg); cursor: pointer; border: 1px solid transparent; background: linear-gradient(90deg, rgba(139, 62, 62,0.07), transparent); background-size: 0% 100%; background-repeat: no-repeat; transition: background-size 0.35s cubic-bezier(0.22,0.61,0.36,1), border-color 0.2s, box-shadow 0.2s; }
.fav-video-row:hover { background-size: 100% 100%; border-color: rgba(139, 62, 62,0.25); box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
.fav-video-row.sel { background: var(--color-brand-soft); border-color: var(--color-brand-border); }
.fav-thumb { width: 96px; aspect-ratio: 16/9; object-fit: cover; border-radius: var(--radius-md); flex-shrink: 0; background: var(--color-surface-muted); }
.fav-video-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.fav-pagination { display: flex; justify-content: center; margin-top: 14px; }
.follow-list { display: flex; flex-direction: column; gap: 10px; }
.follow-card { display: flex; gap: 14px; padding: 12px; border-radius: var(--radius-lg); border: 1px solid var(--color-border); cursor: pointer; background: linear-gradient(90deg, rgba(212,135,149,0.1), rgba(212,135,149,0.02)); background-size: 0% 100%; background-repeat: no-repeat; box-shadow: var(--shadow-xs); transition: background-size 0.4s cubic-bezier(0.22,0.61,0.36,1), border-color 0.3s, box-shadow 0.3s; }
.follow-card:hover { background-size: 100% 100%; border-color: rgba(212,135,149,0.5); box-shadow: 0 0 0 2px rgba(212,135,149,0.3), 0 8px 32px rgba(0,0,0,0.4); }
.follow-cover { width: 72px; height: 96px; object-fit: cover; border-radius: var(--radius-md); flex-shrink: 0; background: var(--color-surface-muted); }
.follow-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; padding-top: 2px; }
.fav-video-row { animation: materialize 0.35s var(--spring-snappy) both; }
.fav-video-row:nth-child(1) { animation-delay: 0s; }
.fav-video-row:nth-child(2) { animation-delay: 0.05s; }
.fav-video-row:nth-child(3) { animation-delay: 0.1s; }
.fav-video-row:nth-child(4) { animation-delay: 0.15s; }
.fav-video-row:nth-child(5) { animation-delay: 0.2s; }
</style>
