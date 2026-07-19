import { defineStore } from "pinia";
import { ref, watch, computed } from "vue";
import type { PipelineResult, PipelineProgress, VideoInfo, PageInfo, TaskState, QueueItem } from "../utils/types";
import { useTemplateStore } from "./templates";
import { useAuthStore } from "./auth";
import { SETTINGS_VERSION, loadSaved, saveToDisk, type Provider, type PromptTemplate } from "./settings";
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

});