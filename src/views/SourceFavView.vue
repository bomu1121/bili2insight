<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { NButton, NText, NIcon, NCheckbox, NSpin, NPagination, NInput, createDiscreteApi } from 'naive-ui';
import { ArrowBackOutline, AddCircleOutline, FolderOpenOutline, RefreshOutline } from '@vicons/ionicons5';
import { useRouter } from 'vue-router';
import { useAppStore } from '../stores/app';

const store = useAppStore();
const router = useRouter();
const { message } = createDiscreteApi(['message']);

const showFolders = ref(true);
const folderSearch = ref('');

onMounted(async () => {
  if (!store.isLoggedIn) {
    await store.checkLoginStatus();
  }
  if (store.isLoggedIn) {
    await store.loadFavFolders();
  }
});

const filteredFolders = computed(() => {
  if (!folderSearch.value.trim()) return store.favFolders;
  const q = folderSearch.value.toLowerCase();
  return store.favFolders.filter((f: any) => f.title.toLowerCase().includes(q));
});

function openFolder(folder: any) {
  showFolders.value = false;
  store.openFavFolder(folder);
}

function backToFolders() {
  showFolders.value = true;
  store.favVideos = [];
}

async function loadPage(page: number) {
  await store.loadFavVideos(store.favCurrentFolderId, page);
}

function addSelectedToQueue() {
  const sel: any[] = [];
  store.favSelectedVideos.forEach((i: number) => {
    if (i < store.favVideos.length) sel.push(store.favVideos[i]);
  });
  if (sel.length === 0) {
    message.warning('请至少选择一个视频');
    return;
  }
  sel.forEach((v: any) => {
    const url = 'https://www.bilibili.com/video/' + v.bvid;
    store.addQueueItem({
      url,
      pageInfo: { page: 1, part: v.title, cid: v.cid, duration: v.duration },
      source: 'fav'
    });
  });
  message.success('已添加 ' + sel.length + ' 个视频到处理队列');
}

const fmtDur = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') : String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
};

</script>

<template>
  <div class="source-root">
    <div class="source-bar">
      <n-button text @click="router.push('/')"><template #icon><n-icon><ArrowBackOutline /></n-icon></template>返回</n-button>
      <n-text strong style="font-size:15px;">B站收藏夹</n-text>
    </div>

    <div class="source-body">
      <!-- Not logged in -->
      <div v-if="!store.isLoggedIn" class="fav-empty">
        <n-icon size="48" color="#ccc"><FolderOpenOutline /></n-icon>
        <n-text depth="3" style="margin-top:12px;">请先登录B站账号以访问收藏夹</n-text>
        <n-button type="primary" @click="store.startLogin()" style="margin-top:16px;">登录</n-button>
      </div>

      <template v-else>
        <!-- Folder list -->
        <div v-if="showFolders">
          <div class="fav-bar">
            <n-input v-model:value="folderSearch" placeholder="搜索收藏夹..." size="small" clearable style="width:220px;" />
            <n-button size="small" @click="store.loadFavFolders()" :loading="store.favLoading">
              <template #icon><n-icon><RefreshOutline /></n-icon></template>
            </n-button>
          </div>
          <n-spin :show="store.favLoading">
            <div class="folder-grid" v-if="filteredFolders.length > 0">
              <div v-for="f in filteredFolders" :key="f.id" class="folder-card" @click="openFolder(f)">
                <div class="folder-icon"><n-icon size="22" :color="f.collected ? '#f0a020' : '#00aeec'"><FolderOpenOutline /></n-icon></div>
                <div class="folder-info">
                  <n-text style="font-size:14px;font-weight:500;">{{ f.title }}</n-text>
                  <n-text depth="3" style="font-size:12px;">{{ f.count }} 个视频{{ f.collected ? ' · 已收藏' : '' }}</n-text>
                </div>
                <span class="folder-arrow">&rarr;</span>
              </div>
            </div>
            <div v-else class="fav-empty">
              <n-text depth="3">暂无收藏夹</n-text>
            </div>
          </n-spin>
        </div>

        <!-- Videos in a folder -->
        <div v-else>
          <div class="fav-bar">
            <n-button text @click="backToFolders"><template #icon><n-icon><ArrowBackOutline /></n-icon></template>返回目录</n-button>
            <n-text style="font-size:14px;font-weight:500;flex:1;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0 12px;">{{ store.favCurrentFolderTitle }}</n-text>
            <n-text depth="3" style="font-size:12px;">共 {{ store.favTotal }} 个视频</n-text>
          </div>
          <n-spin :show="store.favLoadingVideos">
            <div v-if="store.favVideos.length > 0">
              <div class="page-header-row">
                <n-checkbox :checked="store.favSelectedVideos.size === store.favVideos.length" @update:checked="store.selectAllFavVideos()">
                  全选 ({{ store.favSelectedVideos.size }}/{{ store.favVideos.length }})
                </n-checkbox>
              </div>
              <div class="fav-video-list">
                <div v-for="(v, i) in store.favVideos" :key="i" class="fav-video-row" :class="{ sel: store.favSelectedVideos.has(i) }" @click="store.toggleFavVideo(i)">
                  <n-checkbox :checked="store.favSelectedVideos.has(i)" size="small" />
                  <img v-if="v.cover" :src="v.cover" class="fav-thumb" referrerpolicy="no-referrer" />
                  <div class="fav-video-info">
                    <n-text style="font-size:13px;">{{ v.title }}</n-text>
                    <n-text depth="3" style="font-size:11px;">{{ v.uploader }} . {{ fmtDur(v.duration) }}</n-text>
                  </div>
                </div>
              </div>
              <n-text v-if="store.loginError" depth="3" type="error" style="font-size:12px;display:block;margin:8px 0;">{{ store.loginError }}</n-text>
              <div class="fav-pagination" v-if="store.favTotalPages > 1">
                <n-pagination :page="store.favPage" :page-count="store.favTotalPages" @update:page="loadPage" size="small" />
              </div>
              <n-button type="primary" block @click="addSelectedToQueue" :disabled="store.favSelectedVideos.size === 0" style="margin-top:14px;">
                <template #icon><n-icon><AddCircleOutline /></n-icon></template>添加到处理队列
              </n-button>
            </div>
            <div v-else class="fav-empty">
              <n-text depth="3">此收藏夹为空</n-text>
            </div>
          </n-spin>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.source-root { display: flex; flex-direction: column; height: 100%; }
.source-bar { display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: #fff; border-bottom: 1px solid #eee; flex-shrink: 0; }
.source-body { flex: 1; padding: 24px; max-width: 780px; margin: 0 auto; width: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
.fav-empty { display: flex; flex-direction: column; align-items: center; padding: 60px 0; text-align: center; }
.fav-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.folder-grid { display: flex; flex-direction: column; gap: 6px; }
.folder-card {
  display: flex; align-items: center; gap: 14px; padding: 14px 16px;
  background: #fff; border: 1px solid #eee; border-radius: 10px;
  cursor: pointer; transition: all .15s;
}
.folder-card:hover { border-color: #00aeec; box-shadow: 0 2px 12px rgba(0,174,236,.08); }
.folder-icon { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: #f5f7fa; border-radius: 8px; flex-shrink: 0; }
.folder-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.folder-arrow { color: #ccc; flex-shrink: 0; font-size: 16px; }
.page-header-row { margin-bottom: 4px; }
.fav-video-list { display: flex; flex-direction: column; gap: 4px; max-height: 400px; overflow-y: auto; }
.fav-video-row {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px;
  border-radius: 6px; cursor: pointer; transition: background .15s;
}
.fav-video-row:hover { background: #f5f5f5; }
.fav-video-row.sel { background: #e8f4fd; }
.fav-thumb { width: 80px; height: 45px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }
.fav-video-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.fav-pagination { display: flex; justify-content: center; margin-top: 12px; }
</style>
