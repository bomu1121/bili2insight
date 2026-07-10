import { defineStore } from "pinia";
import { ref, watch } from "vue";
import type { PipelineResult, PipelineProgress, VideoInfo } from "../utils/types";
import { runPipeline, saveResultToFile, previewVideo, fetchModels } from "../utils/invoke";
import { listen } from "@tauri-apps/api/event";

export interface Provider { name: string; url: string; models: string[]; }

const PROVIDERS: Provider[] = [
  { name: "DeepSeek", url: "https://api.deepseek.com/v1/chat/completions", models: ["deepseek-chat", "deepseek-reasoner"] },
  { name: "OpenAI", url: "https://api.openai.com/v1/chat/completions", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"] },
  { name: "Custom", url: "", models: [] },
];

const STORAGE_KEY = "bili2insight-settings";
function loadSaved(): Record<string,any>|null { try { const r=localStorage.getItem(STORAGE_KEY); return r?JSON.parse(r):null; } catch(_){return null;} }
function saveToDisk(d:Record<string,any>) { try{localStorage.setItem(STORAGE_KEY,JSON.stringify(d));}catch(_){} }

export const useAppStore = defineStore("app", () => {
  const saved = loadSaved();

  const url = ref("");
  const proxy = ref(saved?.proxy ?? "http://127.0.0.1:7897");
  const aiApiUrl = ref(saved?.aiApiUrl ?? PROVIDERS[0].url);
  const aiApiKey = ref(saved?.aiApiKey ?? "");
  const aiModel = ref(saved?.aiModel ?? PROVIDERS[0].models[0]);
  const aiPrompt = ref(saved?.aiPrompt ?? "Please analyze the following video transcript, extract core insights (3-5 key points), and provide 3-5 tags. Output as JSON only: {\"summary\": \"...\", \"key_points\": [\"...\"], \"tags\": [\"...\"]}. Return JSON only, no extra text.");
  const selectedProvider = ref(saved?.selectedProvider ?? 0);

  const processing = ref(false);
  const progress = ref<PipelineProgress | null>(null);
  const result = ref<PipelineResult | null>(null);
  const error = ref("");

  const preview = ref<VideoInfo | null>(null);
  const previewLoading = ref(false);
  const customModels = ref<string[]>([]);
  let previewTimer: ReturnType<typeof setTimeout> | null = null;
  let unlisten: (() => void) | null = null;

  watch([proxy, aiApiUrl, aiApiKey, aiModel, aiPrompt, selectedProvider], () => {
    saveToDisk({ proxy: proxy.value, aiApiUrl: aiApiUrl.value, aiApiKey: aiApiKey.value, aiModel: aiModel.value, aiPrompt: aiPrompt.value, selectedProvider: selectedProvider.value });
  }, { deep: false });

  function switchProvider(idx: number) { selectedProvider.value = idx; const p = PROVIDERS[idx]; aiApiUrl.value = p.url; if (p.models.length>0) aiModel.value = p.models[0]; }
  async function init() { unlisten = await listen<PipelineProgress>("pipeline-progress", (ev) => { progress.value = ev.payload; }); }
  function cleanup() { if (unlisten) { unlisten(); unlisten = null; } }

  async function startPipeline() {
    if (!url.value.trim()) { error.value = "Please enter a Bilibili video URL"; return; }
    processing.value = true; error.value = ""; result.value = null;
    try { result.value = await runPipeline(url.value, proxy.value||undefined, aiApiUrl.value||undefined, aiApiKey.value||undefined, aiModel.value||undefined, aiPrompt.value||undefined); }
    catch (e: any) { error.value = String(e); }
    finally { processing.value = false; }
  }

  async function detectUrl(val: string) {
    if (previewTimer) clearTimeout(previewTimer);
    preview.value = null; previewLoading.value = false;
    if (!val.trim() || !val.includes("bilibili.com")) return;
    previewLoading.value = true;
    previewTimer = setTimeout(async () => { try { preview.value = await previewVideo(val, proxy.value||undefined); } catch (_){} finally { previewLoading.value = false; } }, 600);
  }
  watch(url, (val) => { detectUrl(val); });

  async function fetchModelList() {
    if (!aiApiKey.value.trim()) { error.value = "Please enter API key first"; return; }
    try { const models = await fetchModels(aiApiUrl.value, aiApiKey.value.trim()); if (models.length>0) { customModels.value = models; aiModel.value = models[0]; } }
    catch (e: any) { const msg = String(e); error.value = msg.includes("401") ? "Invalid API key - please check your key" : "Fetch failed: " + msg; }
  }

  async function exportToFile() {
    if (!result.value) return;
    try { const { save } = await import("@tauri-apps/plugin-dialog"); const path = await save({ filters:[{name:"Markdown",extensions:["md"]}], defaultPath:`${result.value.video_info.title}.md` }); if (path) await saveResultToFile(result.value, path); }
    catch (e: any) { error.value = String(e); }
  }

  return { url, proxy, aiApiUrl, aiApiKey, aiModel, aiPrompt, selectedProvider, processing, progress, result, error, preview, previewLoading, PROVIDERS, customModels, init, cleanup, startPipeline, exportToFile, switchProvider, fetchModelList };
});
