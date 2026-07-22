import { defineStore } from "pinia";
import { ref, watch, computed } from "vue";
import type { PipelineResult, PipelineProgress, VideoInfo, PageInfo, TaskState, QueueItem } from "../utils/types";
import { useTemplateStore } from "./templates";
import { useAuthStore } from "./auth";
import { SETTINGS_VERSION, loadSaved, saveToDisk, type Provider } from "./settings";
import { runPipelineWithPage, saveResultToFile, previewVideo, fetchModels } from "../utils/invoke";
import { runPipelineLocal } from "../utils/invoke";
import { listen } from "@tauri-apps/api/event";

const PROVIDERS: Provider[] = [
  { name: "DeepSeek", url: "https://api.deepseek.com", models: ["deepseek-chat", "deepseek-reasoner"] },
  { name: "OpenAI", url: "https://api.openai.com/v1/chat/completions", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"] },
  { name: "Custom", url: "", models: [] },
];

export const useAppStore = defineStore("app", () => {
  const saved = loadSaved();
  const ver = saved;

  const url = ref("");
  const proxy = ref(ver?.proxy ?? "");
  const aiApiUrl = ref(ver?.aiApiUrl ?? PROVIDERS[0].url);
  const aiApiKey = ref(ver?.aiApiKey ?? "");
  const aiModel = ref(ver?.aiModel ?? PROVIDERS[0].models[0]);
  const selectedProvider = ref(ver?.selectedProvider ?? 0);
  const customModels = ref<string[]>(ver?.customModels ?? []);
  // --- ASR settings ---
  type AsrModelOption = "paraformer" | "mimo";
  const asrModel = ref<AsrModelOption>(ver?.asrModel ?? "paraformer");
  const asrApiUrl = ref(ver?.asrApiUrl ?? "");
  const asrApiKey = ref(ver?.asrApiKey ?? "");

  // ---------- Pipeline state ----------
  const processing = ref(false);
  const progress = ref<PipelineProgress | null>(null);
  const result = ref<PipelineResult | null>(null);
  const error = ref("");
  const preview = ref<VideoInfo | null>(null);
  const previewLoading = ref(false);

  // ---------- Multi-page state ----------
  const selectedPages = ref<Set<number>>(new Set());
  const tasks = ref<TaskState[]>([]);
  const activeTaskIndex = ref(-1);
  const activeResultTab = ref<number>(0); // 0 = first page, N = pages[N-1], N+1 = merged

  // ---------- Queue state ----------
  const queue = ref<QueueItem[]>([]);
  const isProcessing = ref(false);
  let abortController: AbortController | null = null;
  const queueCount = computed(() => queue.value.length);

  const videoPages = computed<PageInfo[]>(() => preview.value?.pages ?? []);

  // All completed task results
  const completedTasks = computed(() => tasks.value.filter(t => t.status === "done"));
  const hasMultiPages = computed(() => videoPages.value.length > 1);

  // Active result (current tab)
  const activeResult = computed(() => {
    if (completedTasks.value.length === 0) return result.value;
    if (activeResultTab.value < completedTasks.value.length) {
      return completedTasks.value[activeResultTab.value].result;
    }
    // "merged" tab
    return null;
  });

  const mergedMarkdown = computed(() => {
    if (completedTasks.value.length === 0) return "";
    const parts = completedTasks.value.map(t => {
      if (!t.result) return "";
      return `## ${t.pageInfo.part}\n\n${t.result.markdown}`;
    });
    return `# ${preview.value?.title ?? ""}\n\n${parts.join("\n\n---\n\n")}`;
  });

  let previewTimer: ReturnType<typeof setTimeout> | null = null;
  let unlisten: (() => void) | null = null;

  // ---------- Persistence ----------
  function persistSettings() {
    saveToDisk({
      version: SETTINGS_VERSION, proxy: proxy.value, aiApiUrl: aiApiUrl.value, aiApiKey: aiApiKey.value,
      aiModel: aiModel.value, selectedProvider: selectedProvider.value, customModels: customModels.value,
      asrModel: asrModel.value, asrApiUrl: asrApiUrl.value, asrApiKey: asrApiKey.value,
    });
  }

  watch([proxy, aiApiUrl, aiApiKey, aiModel, selectedProvider, asrModel, asrApiUrl, asrApiKey], () => {
    persistSettings();
  }, { deep: false });

  // ---------- Favorites state ----------
  const favFolders = ref<any[]>([]);
  const favLoading = ref(false);
  const favCurrentFolderId = ref(0);
  const favCurrentFolderTitle = ref('');
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
  const followType = ref(1); // 1=anime, 2=drama
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



  // ---------- Favorites functions ----------
  async function loadFavFolders() {
    favLoading.value = true;
    try {
      const cookiesStr = JSON.stringify(useAuthStore().cookiesSaved);
      const { favGetFolders } = await import('../utils/invoke');
      const result = await favGetFolders(cookiesStr, proxy.value || undefined);
      favFolders.value = result.folders; console.log("FAV loadFavFolders OK:", result.folders.length, "folders");
      useAuthStore().loginUname = result.uname;
      useAuthStore().loginUid = result.uid;
      useAuthStore().loginFace = result.face;
      useAuthStore().isLoggedIn = true;
    } catch (e: any) {
      useAuthStore().loginError = String(e);
      if (String(e).includes('expired') || String(e).includes('login')) {
        useAuthStore().isLoggedIn = false;
      }
    } finally { favLoading.value = false; }
  }

  async function loadCollectedVideos(seasonId: number, mid: number, page: number) {
    favLoadingVideos.value = true;
    try {
      const ck = JSON.stringify(useAuthStore().cookiesSaved);
      const { invoke } = await import('@tauri-apps/api/core');
      const r = await invoke<any>('fav_collected_videos', { cookiesJson: ck, folderId: seasonId, mid, page, proxy: proxy.value || undefined });
      favVideos.value = r.videos;
      favPage.value = page;
      favTotalPages.value = r.total_pages;
      favTotal.value = r.total;
      favCurrentFolderId.value = seasonId;
    } catch(e:any){ useAuthStore().loginError = String(e); }
    finally { favLoadingVideos.value = false; }
  }

  async function loadFavVideos(folderId: number, page: number) {
    favLoadingVideos.value = true;
    try {
      const cookiesStr = JSON.stringify(useAuthStore().cookiesSaved); console.log("FAV loadFavVideos: folder=" + folderId + " page=" + page + " hasCookies=" + Object.keys(useAuthStore().cookiesSaved || {}).length); const { favGetVideos } = await import('../utils/invoke');
      const result = await favGetVideos(cookiesStr, folderId, page, proxy.value || undefined);
      favVideos.value = result.videos; console.log("FAV loadFavVideos OK:", result.videos.length, "videos, total=", result.total);
      favPage.value = page;
      favTotalPages.value = result.total_pages;
      favTotal.value = result.total;
      favCurrentFolderId.value = folderId;
    } catch (e: any) { console.error("FAV loadFavVideos ERROR:", e); useAuthStore().loginError = String(e); }
    finally { favLoadingVideos.value = false; }
  }

  
  async function loadFollowList(fType: number, page: number) {
    followLoading.value = true;
    try {
      const cookiesStr = JSON.stringify(useAuthStore().cookiesSaved);
      const { favGetFollowList } = await import('../utils/invoke');
      const result = await favGetFollowList(cookiesStr, fType, page, proxy.value || undefined);
      followItems.value = result.items;
      followPage.value = result.page;
      followTotalPages.value = result.total_pages;
      followTotal.value = result.total;
      followType.value = fType;
    } catch (e: any) { useAuthStore().loginError = String(e); }
    finally { followLoading.value = false; }
  }

  
  async function loadWatchLater(page: number) {
    watchLaterLoading.value = true;
    try {
      const ck = JSON.stringify(useAuthStore().cookiesSaved);
      const { favWatchLater } = await import("../utils/invoke");
      const r = await favWatchLater(ck, page, proxy.value || undefined);
      watchLaterItems.value = r.items; watchLaterPage.value = r.page;
      watchLaterTotalPages.value = r.total_pages;
    } catch(e:any){ useAuthStore().loginError = String(e); }
    finally { watchLaterLoading.value = false; }
  }
  async function loadHistory(page: number) {
    historyLoading.value = true;
    try {
      const ck = JSON.stringify(useAuthStore().cookiesSaved);
      const { favHistory } = await import("../utils/invoke");
      const r = await favHistory(ck, page, proxy.value || undefined);
      historyItems.value = r.items; historyPage.value = r.page;
      historyTotalPages.value = r.total_pages;
    } catch(e:any){ useAuthStore().loginError = String(e); }
    finally { historyLoading.value = false; }
  }

  function openFavFolder(folder: any) {
    favCurrentFolderId.value = folder.id;
    favCurrentFolderTitle.value = folder.title;
    favSelectedVideos.value = new Set();
    favIsCollected.value = !!folder.collected;
    favCurrentFolderMid.value = folder.mid || 0;
    if (folder.collected) {
      loadCollectedVideos(folder.id, folder.mid, 1);
    } else {
      loadFavVideos(folder.id, 1);
    }
  }

  function toggleFavVideo(idx: number) {
    const s = new Set(favSelectedVideos.value);
    if (s.has(idx)) s.delete(idx); else s.add(idx);
    favSelectedVideos.value = s;
  }

  function selectAllFavVideos() {
    favSelectedVideos.value = new Set(favVideos.value.map((_: any, i: number) => i));
  }

  function addFavVideosToQueue() {
    const sel: any[] = [];
    favSelectedVideos.value.forEach(i => { if (i < favVideos.value.length) sel.push(favVideos.value[i]); });
    if (sel.length === 0) return;
    sel.forEach(v => {
      const url = 'https://www.bilibili.com/video/' + v.bvid;
      addQueueItem({
        url,
        pageInfo: { page: 1, part: v.title, cid: v.cid, duration: v.duration },
        source: 'fav'
      });
    });
  }




  // ---------- Lifecycle ----------
  function switchProvider(idx: number) { selectedProvider.value = idx; const p = PROVIDERS[idx]; aiApiUrl.value = p.url; if (p.models.length>0 && customModels.value.length===0) aiModel.value = p.models[0]; }
  async function init() { console.log("[login] App init - checking..."); await useAuthStore().initCookiesPath();
    unlisten = await listen<PipelineProgress>("pipeline-progress", (ev) => {
      progress.value = ev.payload;
      const stageMap: Record<string,string> = {download:"下载中",ffmpeg:"转换格式",asr:"语音识别",refine:"AI 校对",ai:"AI 分析",done:"完成",preview:"检测中"};
      const msgMap: Record<string,string> = {"Getting video info and downloading audio...":"获取视频信息并下载音频...","Download complete":"下载完成","Converting audio format...":"转换音频格式...","Audio conversion complete":"音频转换完成","Running speech recognition...":"运行语音识别...","Speech recognition complete":"语音识别完成","AI proofreading transcript...":"AI 校对文稿...","Transcript proofread":"文稿校对完成","Extracting insights with AI...":"AI 提炼观点...","AI insights ready":"AI 观点提炼完成","Complete":"处理完成","Detecting video...":"检测视频中..."};
      // Update active task (multi-page pipeline in SourceUrlView)
      if (activeTaskIndex.value >= 0 && activeTaskIndex.value < tasks.value.length) {
        const task = tasks.value[activeTaskIndex.value];
        task.progress = ev.payload.progress;
        task.stageLabel = stageMap[ev.payload.stage] || ev.payload.stage;
        task.message = msgMap[ev.payload.message] || ev.payload.message;
      }
      // Update running queue item
      const qId = ev.payload.queue_item_id;
      const qIdx = qId ? queue.value.findIndex(q => q.id === qId) : queue.value.findIndex(q => q.status === 'running');
      if (qIdx >= 0) {
        console.log('progress listener: updating queue[', qIdx, '] stage=', ev.payload.stage, 'progress=', ev.payload.progress, 'msg=', ev.payload.message?.slice(0,50));
        const q = [...queue.value];
        q[qIdx] = { ...q[qIdx], progress: ev.payload.progress, stageLabel: stageMap[ev.payload.stage] || ev.payload.stage, message: msgMap[ev.payload.message] || ev.payload.message };
        queue.value = q;
      }
    });
    await useAuthStore().checkLoginStatus();
  }
  function cleanup() { if (unlisten) { unlisten(); unlisten = null; } }

  // ---------- URL detection ----------
  async function detectUrl(val: string) {
    if (previewTimer) clearTimeout(previewTimer);
    preview.value = null; previewLoading.value = false;
    selectedPages.value = new Set();
    if (!val.trim() || !val.includes("bilibili.com")) return;
    previewLoading.value = true;
    previewTimer = setTimeout(async () => {
      try {
        const info = await previewVideoFn(val);
        preview.value = info;
        if (info.pages && info.pages.length > 0) {
            const matchIdx = info.pages.findIndex(p => p.cid === info.cid);
            selectedPages.value = new Set([matchIdx >= 0 ? matchIdx : 0]);
        }
      } catch (e: any) { console.error("preview error:", e); error.value = String(e); }
      finally { previewLoading.value = false; }
    }, 600);
  }
  watch(url, (val) => { detectUrl(val); });

  // ---------- Page selection ----------
  function togglePage(idx: number) {
    const s = new Set(selectedPages.value);
    if (s.has(idx)) s.delete(idx); else s.add(idx);
    selectedPages.value = s;
  }
  // ---------- Preview (exposed for HomeView) ----------
  const PREVIEW_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const PREVIEW_CACHE_MAX = 20;
  const previewCache = new Map<string, { data: VideoInfo; ts: number }>();
  const _previewCacheKeys: string[] = []; // LRU order: most recent at end

  function clearPreviewCache() {
    previewCache.clear();
    _previewCacheKeys.length = 0;
  }

  async function previewVideoFn(val: string) {
    if (!val.includes("bilibili.com")) return await previewVideo(val, proxy.value || undefined);
    const cached = previewCache.get(val);
    if (cached && Date.now() - cached.ts < PREVIEW_CACHE_TTL) {
      console.log("preview: cache hit for", val.slice(0, 50));
      return cached.data;
    }
    console.log("preview: cache miss, fetching", val.slice(0, 50));
    const info = await previewVideo(val, proxy.value || undefined);
    previewCache.set(val, { data: info, ts: Date.now() });
    if (_previewCacheKeys.length >= PREVIEW_CACHE_MAX) {
      const oldest = _previewCacheKeys.shift();
      if (oldest) previewCache.delete(oldest);
    }
    _previewCacheKeys.push(val);
    return info;
  }

  async function refreshPreview(val: string) {
    previewCache.delete(val);
    return await previewVideo(val, proxy.value || undefined);
  }

  // ---------- Queue management ----------
  function addQueueItem(input: { url: string; pageInfo: PageInfo; source?: string; templateIndex?: number }) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    queue.value = [...queue.value, {
      id,
      source: (input.source || 'url') as QueueItem['source'],
      url: input.url,
      pageInfo: input.pageInfo,
      status: 'pending' as const,
      progress: 0,
      stageLabel: '等待中',
      message: '',
      templateIndex: input.templateIndex,
      result: null,
      error: '',
      createdAt: Date.now(),
    }];
  }

  function cancelQueue() {
    if (abortController) { abortController.abort(); isProcessing.value = false; abortController = null; }
  }

  function cancelQueueItem(id: string) {
    const q = queue.value;
    const idx = q.findIndex(qi => qi.id === id && qi.status === 'pending');
    if (idx >= 0) {
      const u = [...q];
      u[idx] = { ...u[idx], status: 'error' as const, error: '已取消', stageLabel: '取消' };
      queue.value = u;
    }
  }

  async function processQueue() {
    if (isProcessing.value) return;
    abortController = new AbortController();
    isProcessing.value = true;
    const CONCURRENCY = 2;
    const signal = abortController.signal;
    const slots: (Promise<void> | null)[] = Array(CONCURRENCY).fill(null);

    const fillSlot = (i: number) => {
      const pending = queue.value.filter(q => q.status === 'pending');
      if (pending.length === 0 || signal.aborted) return false;
      const item = pending[0];
      slots[i] = processQueueItem(item, signal).finally(() => { slots[i] = null; });
      return true;
    };

    console.log("processQueue started, concurrency=", CONCURRENCY, "pending=", queue.value.filter(q => q.status === 'pending').length);

    while (true) {
      let anyFilled = false;
      for (let i = 0; i < CONCURRENCY; i++) {
        if (!slots[i]) anyFilled = fillSlot(i) || anyFilled;
      }

      if (signal.aborted) break;

      const pendingCount = queue.value.filter(q => q.status === 'pending').length;
      if (pendingCount === 0 && slots.every(s => s === null)) break;

      // Wait for at least one slot to free, then fill again
      const active = slots.filter(Boolean) as Promise<void>[];
      if (active.length > 0) {
        try { await Promise.race(active); } catch (_) { /* slot handles errors internally */ }
      } else if (pendingCount === 0) {
        break;
      } else {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    console.log("processQueue finished");
    isProcessing.value = false;
    abortController = null;
  }

  async function processQueueItem(item: QueueItem, signal?: AbortSignal) {
    const idx = queue.value.findIndex(q => q.id === item.id);
    if (idx < 0) return;
    if (signal?.aborted) return;
    const updated = [...queue.value];
    updated[idx] = { ...item, status: 'running' as const, stageLabel: '开始处理' };
    const startTime = performance.now();
    queue.value = updated;
    const prompt = useTemplateStore().resolvePrompt(item.templateIndex);
    console.log('processQueue: item', idx, 'set to running, url=', item.url?.slice(0,50), 'cid=', item.pageInfo.cid, 'part=', item.pageInfo.part);
    try {
      if (signal?.aborted) return;
      let result: PipelineResult;
      if (item.source === 'local') {
        result = await runPipelineLocal(item.url!, item.pageInfo.part, aiApiUrl.value || undefined, aiApiKey.value || undefined, aiModel.value || undefined, prompt || undefined, asrModel.value, asrApiUrl.value || undefined, asrApiKey.value || undefined, item.id);
      } else {
        result = await runPipelineWithPage(item.url!, proxy.value || undefined, aiApiUrl.value || undefined, aiApiKey.value || undefined, aiModel.value || undefined, prompt || undefined, item.pageInfo.cid, asrModel.value, asrApiUrl.value || undefined, asrApiKey.value || undefined, item.id);
      }
      if (signal?.aborted) return;
      console.log('processQueue: item', idx, 'DONE, bvid=', result.video_info.bvid, 'title=', result.video_info.title?.slice(0,40));
      const done = [...queue.value];
      const doneIdx = done.findIndex(q => q.id === item.id);
      if (doneIdx >= 0) {
        done[doneIdx] = { ...done[doneIdx], status: 'done' as const, progress: 1, stageLabel: '完成', result, elapsedMs: Math.round(performance.now() - startTime) };
        queue.value = done;
      }
    } catch (e: any) {
      if (signal?.aborted) return;
      const err = [...queue.value];
      const errIdx = err.findIndex(q => q.id === item.id);
      if (errIdx >= 0) {
        err[errIdx] = { ...err[errIdx], status: 'error' as const, error: String(e), elapsedMs: Math.round(performance.now() - startTime) };
        queue.value = err;
      }
    }
  }

    function selectAllPages() {
    selectedPages.value = new Set(videoPages.value.map((_, i) => i));
  }

  // ---------- Pipeline ----------
  async function startPipeline() {
    if (!url.value.trim()) { error.value = "请输入 Bilibili 视频链接"; return; }
    if (!preview.value) return;

    const pages = videoPages.value;
    const selected: number[] = [];
    selectedPages.value.forEach(i => { if (i < pages.length) selected.push(i); });

    if (selected.length === 0) {
      error.value = "请至少选择一个分P";
      return;
    }

    // Reset state
    processing.value = true; error.value = ""; result.value = null;
    tasks.value = selected.map(i => ({
      pageKey: i,
      pageInfo: pages[i],
      status: "pending" as const,
      progress: 0, stageLabel: "等待中", message: "",
      result: null, error: "",
    }));
    activeTaskIndex.value = -1;

    // Sequential processing
    for (let ti = 0; ti < tasks.value.length; ti++) {
      activeTaskIndex.value = ti;
      tasks.value[ti].status = "running";
      try {
        const res = await runPipelineWithPage(
          url.value, proxy.value||undefined, aiApiUrl.value||undefined, aiApiKey.value||undefined,
          aiModel.value||undefined, "", tasks.value[ti].pageInfo.cid,
          asrModel.value, asrApiUrl.value||undefined, asrApiKey.value||undefined,
        );
        tasks.value[ti].status = "done";
        tasks.value[ti].result = res;
        tasks.value[ti].progress = 1;
        tasks.value[ti].stageLabel = "完成";
        // For single page, also set legacy result
        if (tasks.value.length === 1) result.value = res;
      } catch (e: any) {
        tasks.value[ti].status = "error";
        tasks.value[ti].error = String(e);
      }
    }

    processing.value = false;
    activeTaskIndex.value = -1;
    if (completedTasks.value.length > 0) {
      activeResultTab.value = 0;
    }
  }

  // ---------- Fetch models ----------
  async function fetchModelList() {
    if (!aiApiKey.value.trim()) { error.value = "请先输入 API 密钥"; return; }
    try { const models = await fetchModels(aiApiUrl.value, aiApiKey.value.trim()); if (models.length>0) { customModels.value = models; aiModel.value = models[0]; persistSettings(); } }
    catch (e: any) { const msg = String(e); error.value = msg.includes("401") ? "API 密钥无效" : "获取失败: "+msg; }
  }

  // ---------- Export ----------
  async function exportToFile() {
    const md = activeResultTab.value < completedTasks.value.length
      ? completedTasks.value[activeResultTab.value]?.result?.markdown ?? ""
      : mergedMarkdown.value;
    if (!md) return;
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const defaultName = completedTasks.value.length <= 1
        ? `${preview.value?.title ?? "output"}.md`
        : activeResultTab.value < completedTasks.value.length
          ? `${completedTasks.value[activeResultTab.value].pageInfo.part}.md`
          : `${preview.value?.title ?? "merged"}_合并.md`;
      const path = await save({ filters:[{name:"Markdown",extensions:["md"]}], defaultPath: defaultName });
      if (path) await saveResultToFile({ ...completedTasks.value[0]?.result as any, markdown: md }, path);
    } catch (e: any) { error.value = String(e); }
  }

  return {
    url, proxy, aiApiUrl, aiApiKey, aiModel, selectedProvider, processing, progress, result, error,
    preview, previewLoading, PROVIDERS,
    
    
    customModels, asrModel, asrApiUrl, asrApiKey,
    selectedPages, tasks, activeTaskIndex, videoPages, completedTasks, hasMultiPages,
    activeResultTab, activeResult, mergedMarkdown,
    init, cleanup, startPipeline, exportToFile, switchProvider, fetchModelList,
    persistSettings, togglePage, selectAllPages,
    queue, isProcessing, queueCount, previewVideoFn, addQueueItem, processQueue,
    refreshPreview, clearPreviewCache,
    cancelQueue, cancelQueueItem,
    // Favorites
    favFolders, favLoading, favCurrentFolderId, favCurrentFolderTitle, favIsCollected, favCurrentFolderMid, favVideos, favPage, favTotalPages, favTotal, favLoadingVideos, favSelectedVideos,
    loadFavFolders, loadFavVideos, loadCollectedVideos, openFavFolder, toggleFavVideo, selectAllFavVideos, addFavVideosToQueue, followItems, followLoading, followType, followPage, followTotalPages, followTotal, loadFollowList, watchLaterItems, watchLaterLoading, watchLaterPage, watchLaterTotalPages, loadWatchLater, historyItems, historyLoading, historyPage, historyTotalPages, loadHistory,
  };
});
