import { defineStore } from "pinia";
import { ref, watch, computed } from "vue";
import type { PipelineResult, PipelineProgress, VideoInfo, PageInfo, TaskState } from "../utils/types";
import { runPipelineWithPage, saveResultToFile, previewVideo, fetchModels } from "../utils/invoke";
import { listen } from "@tauri-apps/api/event";

export interface Provider { name: string; url: string; models: string[]; }
export interface PromptTemplate { name: string; prompt: string; builtin: boolean; }

const PROVIDERS: Provider[] = [
  { name: "DeepSeek", url: "https://api.deepseek.com", models: ["deepseek-chat", "deepseek-reasoner"] },
  { name: "OpenAI", url: "https://api.openai.com/v1/chat/completions", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"] },
  { name: "Custom", url: "", models: [] },
];

const PROMPT_GUANDIAN = [
  "你是深度内容编辑，专门将口语化的视频文案提炼为有思考深度、有逻辑归类的结构化笔记。",
  "不做简单逐句改写，而是理解视频在讨论哪些核心议题，然后把分散在全文中的相关现象、事实、例证和判断整合到一起。",
  "",
  "【总体概要】（3-5句话概括）",
  "",
  "【核心观点与支撑】### 观点块N：[核心主张]",
  "- 现象/背景 - 作者的判断 - 补充例证",
  "3-6个观点块，按论证逻辑排序",
  "",
  "【情绪基调与弦外之音】（可选）",
].join("\n");

const PROMPT_TECH = [
  "你是技术文档工程师，专门将口语化的技术教程提炼为结构严谨、可直接使用的结构化技术笔记。",
  "提炼目标不是概括，而是还原——让没看过原视频的开发者也能理解核心概念并完成操作。",
  "",
  "【视频目标】【前置条件】【核心概念】【操作步骤】【关键技术细节】【常见坑与解决方案】【最终效果/成果验证】【延伸与参考】",
  "",
  "提炼原则：结构化还原优先；技术信息零损耗；口语转技术书面语；不添加原文没有的技术信息。",
].join("\n");

const PROMPT_TRACE = [
  "你是专业的视频文案信息提取与溯源助手。从视频文字稿中提取有用信息，并为每一条标注清晰的信源。",
  "",
  "有用信息：关键事实、数据、观点、结论、名称、操作步骤、注意事项。信源要求：时间戳或原文定位 + 原文引用。",
  "按类型分块输出，信息密集时先给不超过200字的核心摘要。不编造，语义模糊加注存疑。",
].join("\n");

const BUILTIN_TEMPLATES: PromptTemplate[] = [
  { name: "观点提炼", prompt: PROMPT_GUANDIAN, builtin: true },
  { name: "技术文案提炼", prompt: PROMPT_TECH, builtin: true },
  { name: "信息溯源", prompt: PROMPT_TRACE, builtin: true },
];

const STORAGE_KEY = "bili2insight-settings"; const SETTINGS_VERSION = 3;

function loadSaved(): Record<string,any>|null { try { const r=localStorage.getItem(STORAGE_KEY); return r?JSON.parse(r):null; } catch(_){return null;} }
function saveToDisk(d:Record<string,any>) { try{localStorage.setItem(STORAGE_KEY,JSON.stringify(d));}catch(_){} }

export const useAppStore = defineStore("app", () => {
  const saved = loadSaved();
  const ver = saved?.version === SETTINGS_VERSION ? saved : null;

  const url = ref("");
  const proxy = ref(ver?.proxy ?? "http://127.0.0.1:7897");
  const aiApiUrl = ref(ver?.aiApiUrl ?? PROVIDERS[0].url);
  const aiApiKey = ref(ver?.aiApiKey ?? "");
  const aiModel = ref(ver?.aiModel ?? PROVIDERS[0].models[0]);
  const selectedProvider = ref(ver?.selectedProvider ?? 0);
  const customModels = ref<string[]>(ver?.customModels ?? []);
  const selectedTemplateIndex = ref(ver?.selectedTemplateIndex ?? 0);
  const customTemplates = ref<PromptTemplate[]>(ver?.customTemplates ?? []);

  const allTemplates = computed(() => [...BUILTIN_TEMPLATES, ...customTemplates.value]);
  const aiPrompt = computed(() => {
    const idx = selectedTemplateIndex.value;
    if (idx < BUILTIN_TEMPLATES.length) return BUILTIN_TEMPLATES[idx].prompt;
    const ci = idx - BUILTIN_TEMPLATES.length;
    return customTemplates.value[ci]?.prompt ?? "";
  });

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
      selectedTemplateIndex: selectedTemplateIndex.value, customTemplates: customTemplates.value,
    });
  }

  watch([proxy, aiApiUrl, aiApiKey, aiModel, selectedProvider, selectedTemplateIndex, customTemplates], () => {
    persistSettings();
  }, { deep: false });

  // ---------- Lifecycle ----------
  function switchProvider(idx: number) { selectedProvider.value = idx; const p = PROVIDERS[idx]; aiApiUrl.value = p.url; if (p.models.length>0 && customModels.value.length===0) aiModel.value = p.models[0]; }
  async function init() {
    unlisten = await listen<PipelineProgress>("pipeline-progress", (ev) => {
      progress.value = ev.payload;
      if (activeTaskIndex.value >= 0 && activeTaskIndex.value < tasks.value.length) {
        const task = tasks.value[activeTaskIndex.value];
        task.progress = ev.payload.progress;
        task.stageLabel = ({download:"下载中",ffmpeg:"转换格式",asr:"语音识别",refine:"AI 校对",ai:"AI 分析",done:"完成"} as Record<string,string>)[ev.payload.stage] || ev.payload.stage;
        task.message = ev.payload.message;
      }
    });
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
        const info = await previewVideo(val, proxy.value||undefined);
        preview.value = info;
        if (info.pages && info.pages.length > 1) {
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
          aiModel.value||undefined, aiPrompt.value||undefined, tasks.value[ti].pageInfo.cid,
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

  // ---------- Template management ----------
  function selectTemplate(idx: number) { selectedTemplateIndex.value = idx; }
  function addCustomTemplate() {
    const name = "自定义 "+(customTemplates.value.length+1);
    customTemplates.value = [...customTemplates.value, { name, prompt: "请分析以下视频文案...", builtin: false }];
    selectedTemplateIndex.value = BUILTIN_TEMPLATES.length + customTemplates.value.length - 1;
  }
  function deleteCustomTemplate(idx: number) {
    const ci = idx - BUILTIN_TEMPLATES.length;
    if (ci < 0 || ci >= customTemplates.value.length) return;
    customTemplates.value = customTemplates.value.filter((_, i) => i !== ci);
    if (selectedTemplateIndex.value >= idx) selectedTemplateIndex.value = Math.max(0, selectedTemplateIndex.value - 1);
  }
  function updateTemplatePrompt(idx: number, prompt: string) {
    if (idx < BUILTIN_TEMPLATES.length) return;
    const ci = idx - BUILTIN_TEMPLATES.length;
    if (ci < 0 || ci >= customTemplates.value.length) return;
    const updated = [...customTemplates.value];
    updated[ci] = { ...updated[ci], prompt };
    customTemplates.value = updated;
  }
  function updateTemplateName(idx: number, name: string) {
    if (idx < BUILTIN_TEMPLATES.length) return;
    const ci = idx - BUILTIN_TEMPLATES.length;
    if (ci < 0 || ci >= customTemplates.value.length) return;
    const updated = [...customTemplates.value];
    updated[ci] = { ...updated[ci], name };
    customTemplates.value = updated;
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
    url, proxy, aiApiUrl, aiApiKey, aiModel, aiPrompt, selectedProvider, processing, progress, result, error,
    preview, previewLoading, PROVIDERS, BUILTIN_TEMPLATES, allTemplates, selectedTemplateIndex, customTemplates, customModels,
    selectedPages, tasks, activeTaskIndex, videoPages, completedTasks, hasMultiPages, activeResultTab,
    activeResult, mergedMarkdown,
    init, cleanup, startPipeline, exportToFile, switchProvider, fetchModelList,
    selectTemplate, addCustomTemplate, deleteCustomTemplate, updateTemplatePrompt, updateTemplateName, persistSettings,
    togglePage, selectAllPages,
  };
});