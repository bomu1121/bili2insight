import { defineStore } from "pinia";
import { ref } from "vue";
import { useAuthStore } from "./auth";
import { favGetFolders, favGetVideos } from "../utils/invoke";

export const useFavoritesStore = defineStore("favorites", () => {
  const favFolders = ref<any[]>([]);
  const favLoading = ref(false);
  const favCurrentFolderId = ref(0);
  const favCurrentFolderTitle = ref("");
  const favIsCollected = ref(false);
  const favCurrentFolderMid = ref(0);
  const favVideos = ref<any[]>([]);
  const favPage = ref(1);
  const favTotalPages = ref(0);
  const favTotal = ref(0);
  const favLoadingVideos = ref(false);
  const favSelectedVideos = ref<Set<number>>(new Set());

  const followItems = ref<any[]>([]);
  const followLoading = ref(false);
  const followType = ref(1);
  const followPage = ref(1);
  const followTotalPages = ref(0);
  const followTotal = ref(0);

  const watchLaterItems = ref<any[]>([]);
  const watchLaterLoading = ref(false);
  const watchLaterPage = ref(1);
  const watchLaterTotalPages = ref(0);

  const historyItems = ref<any[]>([]);
  const historyLoading = ref(false);
  const historyPage = ref(1);
  const historyTotalPages = ref(0);

  async function loadFavFolders() {
    favLoading.value = true;
    const auth = useAuthStore();
    try {
      const cookiesStr = JSON.stringify(auth.cookiesSaved);
      const result = await favGetFolders(cookiesStr, auth.proxy || undefined);
      favFolders.value = result.folders;
      auth.loginUname = result.uname;
      auth.loginUid = result.uid;
      auth.loginFace = result.face;
      auth.isLoggedIn = true;
    } catch (e: any) {
      auth.loginError = String(e);
      if (String(e).includes("expired") || String(e).includes("login")) auth.isLoggedIn = false;
    } finally { favLoading.value = false; }
  }

  async function loadCollectedVideos(seasonId: number, mid: number, page: number) {
    favLoadingVideos.value = true;
    try {
      const auth = useAuthStore();
      const ck = JSON.stringify(auth.cookiesSaved);
      const { invoke } = await import("@tauri-apps/api/core");
      const r = await invoke<any>("fav_collected_videos", { cookiesJson: ck, folderId: seasonId, mid, page, proxy: auth.proxy || undefined });
      favVideos.value = r.videos; favPage.value = page; favTotalPages.value = r.total_pages; favTotal.value = r.total;
      favCurrentFolderId.value = seasonId;
    } catch (e: any) { useAuthStore().loginError = String(e); }
    finally { favLoadingVideos.value = false; }
  }

  async function loadFavVideos(folderId: number, page: number) {
    favLoadingVideos.value = true;
    try {
      const auth = useAuthStore();
      const cookiesStr = JSON.stringify(auth.cookiesSaved);
      const result = await favGetVideos(cookiesStr, folderId, page, auth.proxy || undefined);
      favVideos.value = result.videos; favPage.value = page; favTotalPages.value = result.total_pages; favTotal.value = result.total;
      favCurrentFolderId.value = folderId;
    } catch (e: any) { useAuthStore().loginError = String(e); }
    finally { favLoadingVideos.value = false; }
  }

  async function loadFollowList(fType: number, page: number) {
    followLoading.value = true;
    try {
      const auth = useAuthStore();
      const cookiesStr = JSON.stringify(auth.cookiesSaved);
      const { favGetFollowList } = await import("../utils/invoke");
      const result = await favGetFollowList(cookiesStr, fType, page, auth.proxy || undefined);
      followItems.value = result.items; followPage.value = result.page; followTotalPages.value = result.total_pages; followTotal.value = result.total;
      followType.value = fType;
    } catch (e: any) { useAuthStore().loginError = String(e); }
    finally { followLoading.value = false; }
  }

  async function loadWatchLater(page: number) {
    watchLaterLoading.value = true;
    try {
      const auth = useAuthStore();
      const ck = JSON.stringify(auth.cookiesSaved);
      const { favWatchLater } = await import("../utils/invoke");
      const r = await favWatchLater(ck, page, auth.proxy || undefined);
      watchLaterItems.value = r.items; watchLaterPage.value = r.page; watchLaterTotalPages.value = r.total_pages;
    } catch (e: any) { useAuthStore().loginError = String(e); }
    finally { watchLaterLoading.value = false; }
  }

  async function loadHistory(page: number) {
    historyLoading.value = true;
    try {
      const auth = useAuthStore();
      const ck = JSON.stringify(auth.cookiesSaved);
      const { favHistory } = await import("../utils/invoke");
      const r = await favHistory(ck, page, auth.proxy || undefined);
      historyItems.value = r.items; historyPage.value = r.page; historyTotalPages.value = r.total_pages;
    } catch (e: any) { useAuthStore().loginError = String(e); }
    finally { historyLoading.value = false; }
  }

  function openFavFolder(folder: any) {
    favCurrentFolderId.value = folder.id;
    favCurrentFolderTitle.value = folder.title;
    favSelectedVideos.value = new Set();
    favIsCollected.value = !!folder.collected;
    favCurrentFolderMid.value = folder.mid || 0;
    if (folder.collected) loadCollectedVideos(folder.id, folder.mid, 1);
    else loadFavVideos(folder.id, 1);
  }

  function toggleFavVideo(idx: number) {
    const s = new Set(favSelectedVideos.value);
    if (s.has(idx)) s.delete(idx); else s.add(idx);
    favSelectedVideos.value = s;
  }

  function selectAllFavVideos() {
    favSelectedVideos.value = new Set(favVideos.value.map((_: any, i: number) => i));
  }

  async function addFavVideosToQueue() {
    const sel: any[] = [];
    favSelectedVideos.value.forEach(i => { if (i < favVideos.value.length) sel.push(favVideos.value[i]); });
    if (sel.length === 0) return;
    const { useAppStore } = await import('../stores/app');
    sel.forEach((v: any) => {
      useAppStore().addQueueItem({
        url: "https://www.bilibili.com/video/" + v.bvid,
        pageInfo: { page: 1, part: v.title, cid: v.cid, duration: v.duration },
        source: "fav",
      });
    });
  }

  return {
    favFolders, favLoading, favCurrentFolderId, favCurrentFolderTitle, favIsCollected, favCurrentFolderMid,
    favVideos, favPage, favTotalPages, favTotal, favLoadingVideos, favSelectedVideos,
    followItems, followLoading, followType, followPage, followTotalPages, followTotal,
    watchLaterItems, watchLaterLoading, watchLaterPage, watchLaterTotalPages,
    historyItems, historyLoading, historyPage, historyTotalPages,
    loadFavFolders, loadFavVideos, loadCollectedVideos, openFavFolder,
    toggleFavVideo, selectAllFavVideos, addFavVideosToQueue,
    loadFollowList, loadWatchLater, loadHistory,
  };
});

