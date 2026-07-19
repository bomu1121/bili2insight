<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { NButton, NText, NIcon, NCheckbox, NSpin, NPagination, NInput, createDiscreteApi, NTabs, NTabPane } from "naive-ui";
import { ArrowBackOutline, AddCircleOutline, FolderOpenOutline, RefreshOutline, PlayCircleOutline, TimeOutline, BookmarkOutline, TvOutline } from "@vicons/ionicons5";
import { useRouter } from "vue-router";
import { useFavoritesStore } from "../stores/favorites";
import { useAuthStore } from "../stores/auth";
import { useAppStore } from "../stores/app";

const store = useAppStore();
const authStore = useAuthStore();
const favStore = useFavoritesStore();
const router = useRouter();
const { message } = createDiscreteApi(["message"]);

const activeTab = ref<"folders" | "collected" | "follow" | "watchlater" | "history">("folders");
watch(activeTab, (tab) => {
  if (tab === "watchlater" && favStore.watchLaterItems.length === 0) {
    favStore.loadWatchLater(1);
  } else if (tab === "history" && favStore.historyItems.length === 0) {
    favStore.loadHistory(1);
  }
});
const showFolders = ref(true);
const folderSearch = ref("");

onMounted(async () => {
  if (authStore.isLoggedIn) {
    await favStore.loadFavFolders();
  }
});

const filteredFolders = computed(() => {
  if (!folderSearch.value.trim()) return favStore.favFolders;
  const q = folderSearch.value.toLowerCase();
  return favStore.favFolders.filter((f: any) => f.title.toLowerCase().includes(q));
});

const createdFolders = computed(() => favStore.favFolders.filter((f: any) => !f.collected));
const collectedFolders = computed(() => favStore.favFolders.filter((f: any) => f.collected));

function openFolder(folder: any) {
  showFolders.value = false;
  favStore.openFavFolder(folder);
}
function backToFolders() {
  showFolders.value = true;
  favStore.favVideos = [];
  favStore.favIsCollected = false;
}
async function loadPage(p: number) {
  if (favStore.favIsCollected) {
    await favStore.loadCollectedVideos(favStore.favCurrentFolderId, favStore.favCurrentFolderMid, p);
  } else {
    await favStore.loadFavVideos(favStore.favCurrentFolderId, p);
  }
}
function addSelectedToQueue() {
  const sel: any[] = [];
  favStore.favSelectedVideos.forEach((i: number) => { if (i < favStore.favVideos.length) sel.push(favStore.favVideos[i]); });
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
    <div class="source-bar">
      <n-button text @click="router.push('/')"><template #icon><n-icon><ArrowBackOutline /></n-icon></template>返回</n-button>
      <n-text strong style="font-size:15px;">B站收藏</n-text>
    </div>

    <div class="source-body">
      <div v-if="!authStore.isLoggedIn" class="fav-empty">
        <n-icon size="48" color="#ccc"><FolderOpenOutline /></n-icon>
        <n-text depth="3" style="margin-top:12px;">请先登录B站账号以访问收藏</n-text>
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
            <n-button size="small" @click="favStore.loadFavFolders()" :loading="favStore.favLoading">
              <template #icon><n-icon><RefreshOutline /></n-icon></template>
            </n-button>
          </div>
          <n-spin :show="favStore.favLoading">
            <div class="folder-grid" v-if="createdFolders.length > 0">
              <div v-for="f in createdFolders" :key="f.id" class="folder-card" @click="openFolder(f)">
                <div class="folder-icon"><n-icon size="22" color="#00aeec"><FolderOpenOutline /></n-icon></div>
                <div class="folder-info">
                  <n-text style="font-size:14px;font-weight:500;">{{ f.title }}</n-text>
                  <n-text depth="3" style="font-size:12px;">{{ f.count }} 个视频</n-text>
                </div>
                <span class="folder-arrow">&rarr;</span>
              </div>
            </div>
            <div v-else class="fav-empty"><n-text depth="3">暂无收藏夹</n-text></div>
          </n-spin>
        </div>

        <!-- Tab: 订阅合集 -->
        <div v-if="showFolders && activeTab==='collected'">
          <n-spin :show="favStore.favLoading">
            <div class="folder-grid" v-if="collectedFolders.length > 0">
              <div v-for="f in collectedFolders" :key="f.id" class="folder-card" @click="openFolder(f)">
                <div class="folder-icon"><n-icon size="22" color="#f0a020"><BookmarkOutline /></n-icon></div>
                <div class="folder-info">
                  <n-text style="font-size:14px;font-weight:500;">{{ f.title }}</n-text>
                  <n-text depth="3" style="font-size:12px;">{{ f.count }} 个视频</n-text>
                </div>
                <span class="folder-arrow">&rarr;</span>
              </div>
            </div>
            <div v-else class="fav-empty"><n-text depth="3">暂无订阅合集</n-text></div>
          </n-spin>
        </div>

        <!-- Tab: 追番追剧 -->
        <div v-if="showFolders && activeTab==='follow'">
          <div class="fav-bar">
            <n-button size="small" :type="favStore.followType===1?'primary':'default'" @click="favStore.loadFollowList(1,1)">追番</n-button>
            <n-button size="small" :type="favStore.followType===2?'primary':'default'" @click="favStore.loadFollowList(2,1)">追剧</n-button>
          </div>
          <n-spin :show="favStore.followLoading">
            <div v-if="favStore.followItems.length>0" class="follow-list">
              <div v-for="item in favStore.followItems" :key="item.season_id" class="follow-card" @click="store.addQueueItem({url:item.url,pageInfo:{page:1,part:item.title,cid:0,duration:0},source:'fav'});message.success('已添加: '+item.title)">
                <img v-if="item.cover" :src="item.cover" class="follow-cover" referrerpolicy="no-referrer" />
                <div class="follow-info">
                  <n-text style="font-size:13px;font-weight:500;">{{ item.title }}</n-text>
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
          <n-spin :show="favStore.watchLaterLoading">
            <div v-if="favStore.watchLaterItems.length>0">
              <div class="fav-video-list">
                <div v-for="(v,i) in favStore.watchLaterItems" :key="i" class="fav-video-row" @click="store.addQueueItem({url:'https://www.bilibili.com/video/'+v.bvid,pageInfo:{page:1,part:v.title,cid:v.cid,duration:v.duration},source:'fav'});message.success('已添加')">
                  <img v-if="v.cover" :src="v.cover" class="fav-thumb" referrerpolicy="no-referrer" />
                  <div class="fav-video-info">
                    <n-text style="font-size:13px;">{{ v.title }}</n-text>
                    <n-text depth="3" style="font-size:11px;">{{ v.uploader }} · {{ fmtDur(v.duration) }}</n-text>
                  </div>
                </div>
              </div>
            </div>
            <div v-else-if="favStore.watchLaterItems.length===0" class="fav-empty"><n-text depth="3">点击上方标签自动加载</n-text></div>
          </n-spin>
          <div class="fav-pagination" v-if="favStore.watchLaterTotalPages > 1">
            <n-pagination :page="favStore.watchLaterPage" :page-count="favStore.watchLaterTotalPages" @update:page="(p:number)=>favStore.loadWatchLater(p)" size="small" />
          </div>
        </div>

        <!-- Tab: 历史记录 -->
        <div v-if="showFolders && activeTab==='history'">
          <n-spin :show="favStore.historyLoading">
            <div v-if="favStore.historyItems.length>0">
              <div class="fav-video-list">
                <div v-for="(v,i) in favStore.historyItems" :key="i" class="fav-video-row" @click="store.addQueueItem({url:'https://www.bilibili.com/video/'+v.bvid,pageInfo:{page:1,part:v.title,cid:v.cid,duration:v.duration},source:'fav'});message.success('已添加')">
                  <img v-if="v.cover" :src="v.cover" class="fav-thumb" referrerpolicy="no-referrer" />
                  <div class="fav-video-info">
                    <n-text style="font-size:13px;">{{ v.title }}</n-text>
                    <n-text depth="3" style="font-size:11px;">{{ v.uploader }} · {{ fmtDur(v.duration) }}</n-text>
                  </div>
                </div>
              </div>
            </div>
            <div v-else-if="favStore.historyItems.length===0" class="fav-empty"><n-text depth="3">点击上方标签自动加载</n-text></div>
          </n-spin>
          <div class="fav-pagination" v-if="favStore.historyTotalPages > 1">
            <n-pagination :page="favStore.historyPage" :page-count="favStore.historyTotalPages" @update:page="(p:number)=>favStore.loadHistory(p)" size="small" />
          </div>
        </div>

        <!-- Folder content (videos) -->
        <div v-if="!showFolders">
          <div class="fav-bar">
            <n-button text @click="backToFolders"><template #icon><n-icon><ArrowBackOutline /></n-icon></template>返回目录</n-button>
            <n-text style="font-size:14px;font-weight:500;flex:1;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0 12px;">{{ favStore.favCurrentFolderTitle }}</n-text>
            <n-text depth="3" style="font-size:12px;">共{{ favStore.favTotal }} 个视频</n-text>
          </div>
          <n-spin :show="favfavStore.favLoadingVideos">
            <div v-if="favStore.favVideos.length > 0">
              <div class="page-header-row">
                <n-checkbox :checked="favStore.favSelectedVideos.size === favStore.favVideos.length" @update:checked="favStore.selectAllFavVideos()">全选 ({{ favStore.favSelectedVideos.size }}/{{ favStore.favVideos.length }})</n-checkbox>
              </div>
              <div class="fav-video-list">
                <div v-for="(v, i) in favStore.favVideos" :key="i" class="fav-video-row" :class="{ sel: favStore.favSelectedVideos.has(i) }" @click="favStore.toggleFavVideo(i)">
                  <n-checkbox :checked="favStore.favSelectedVideos.has(i)" size="small" />
                  <img v-if="v.cover" :src="v.cover" class="fav-thumb" referrerpolicy="no-referrer" />
                  <div class="fav-video-info">
                    <n-text style="font-size:13px;">{{ v.title }}</n-text>
                    <n-text depth="3" style="font-size:11px;">{{ v.uploader }} · {{ fmtDur(v.duration) }}</n-text>
                  </div>
                </div>
              </div>
              <n-text v-if="store.loginError" depth="3" type="error" style="font-size:12px;display:block;margin:8px 0;">{{ store.loginError }}</n-text>
              <div class="fav-pagination" v-if="favStore.favTotalPages > 1">
                <n-pagination :page="favStore.favPage" :page-count="favStore.favTotalPages" @update:page="(p:number) => { if (favStore.favIsCollected) favStore.loadCollectedVideos(favStore.favCurrentFolderId, favStore.favCurrentFolderMid, p); else favStore.loadFavVideos(favStore.favCurrentFolderId, p); }" size="small" />
              </div>
              <n-button type="primary" block @click="addSelectedToQueue" :disabled="favStore.favSelectedVideos.size === 0" style="margin-top:14px;">
                <template #icon><n-icon><AddCircleOutline /></n-icon></template>添加到处理队列
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
.source-root { display: flex; flex-direction: column; height: 100%; }
.source-bar { display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: #fff; border-bottom: 1px solid #eee; flex-shrink: 0; }
.source-body { flex: 1; padding: 10px 20px; max-width: 820px; margin: 0 auto; width: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.fav-empty { display: flex; flex-direction: column; align-items: center; padding: 60px 0; text-align: center; }
.fav-bar { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
.folder-grid { display: flex; flex-direction: column; gap: 6px; }
.folder-card { display: flex; align-items: center; gap: 14px; padding: 12px 14px; background: #fff; border: 1px solid #eee; border-radius: 10px; cursor: pointer; transition: all .15s; }
.folder-card:hover { border-color: #00aeec; box-shadow: 0 2px 12px rgba(0,174,236,.08); }
.folder-icon { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: #f5f7fa; border-radius: 8px; flex-shrink: 0; }
.folder-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.folder-arrow { color: #ccc; flex-shrink: 0; font-size: 16px; }
.page-header-row { margin-bottom: 4px; }
.fav-video-list { display: flex; flex-direction: column; gap: 4px; max-height: 420px; overflow-y: auto; }
.fav-video-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 6px; cursor: pointer; transition: background .15s; }
.fav-video-row:hover { background: #f5f5f5; }
.fav-video-row.sel { background: #e8f4fd; }
.fav-thumb { width: 80px; height: 45px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }
.fav-video-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.fav-pagination { display: flex; justify-content: center; margin-top: 12px; }
.follow-list { display: flex; flex-direction: column; gap: 8px; }
.follow-card { display: flex; gap: 12px; padding: 10px; border-radius: 8px; border: 1px solid #eee; cursor: pointer; transition: all .15s; }
.follow-card:hover { border-color: #00aeec; }
.follow-cover { width: 72px; height: 96px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }
.follow-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
</style>
