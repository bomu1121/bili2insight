import { defineStore } from "pinia";
import { ref, watch } from "vue";
import type { PipelineResult, PipelineProgress, VideoInfo } from "../utils/types";
import { runPipeline, saveResultToFile, previewVideo, fetchModels } from "../utils/invoke";
import { listen } from "@tauri-apps/api/event";

export interface Provider { name: string; url: string; models: string[]; }

const PROVIDERS: Provider[] = [
  { name: "DeepSeek", url: "https://api.deepseek.com", models: ["deepseek-chat", "deepseek-reasoner"] },
  { name: "OpenAI", url: "https://api.openai.com/v1/chat/completions", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"] },
  { name: "Custom", url: "", models: [] },
];

const DEFAULT_PROMPT = [
  "\u4f60\u662f\u4e00\u4f4d\u6df1\u5ea6\u5185\u5bb9\u7f16\u8f91\uff0c\u4e13\u95e8\u5c06\u53e3\u8bed\u5316\u7684\u89c6\u9891\u6587\u6848\u63d0\u70bc\u4e3a\u6709\u601d\u8003\u6df1\u5ea6\u3001\u6709\u903b\u8f91\u5f52\u7c7b\u7684\u7ed3\u6784\u5316\u7b14\u8bb0\u3002\u4f60\u4e0d\u505a\u7b80\u5355\u7684\u9010\u53e5\u8f6c\u5199\uff0c\u800c\u662f\u7406\u89e3\u89c6\u9891\u5728\u8ba8\u8bba\u54ea\u4e9b\u6838\u5fc3\u8bae\u9898\uff0c\u7136\u540e\u628a\u5206\u6563\u5728\u5168\u6587\u4e2d\u7684\u76f8\u5173\u73b0\u8c61\u3001\u4e8b\u5b9e\u3001\u4f8b\u8bc1\u548c\u5224\u65ad\u6574\u5408\u5230\u4e00\u8d77\uff0c\u5f62\u6210\u6709\u673a\u7684\u201c\u89c2\u70b9\u5757\u201d\u3002",
  "",
  "## \u56fa\u5b9a\u8f93\u51fa\u683c\u5f0f",
  "\u63a5\u5230\u89c6\u9891\u6587\u6848\u540e\uff0c\u4e25\u683c\u6309\u4ee5\u4e0b\u7ed3\u6784\u8f93\u51fa\uff1a",
  "",
  "\u3010\u603b\u4f53\u6982\u8981\u3011",
  "\uff083-5\u53e5\u8bdd\u6982\u62ec\uff1a\u89c6\u9891\u8bb2\u4e86\u4ec0\u4e48\u4e3b\u9898\u3001\u4f5c\u8005\u7684\u6838\u5fc3\u6001\u5ea6/\u7acb\u573a\u662f\u4ec0\u4e48\u3001\u5f97\u51fa\u4e86\u4ec0\u4e48\u5173\u952e\u7ed3\u8bba\u3002\uff09",
  "",
  "\u3010\u6838\u5fc3\u89c2\u70b9\u4e0e\u652f\u6491\u3011",
  "### \u89c2\u70b9\u5757N\uff1a[\u7528\u4e00\u53e5\u8bdd\u63d0\u70bc\u8fd9\u4e2a\u89c2\u70b9\u7684\u6838\u5fc3\u4e3b\u5f20]",
  "- \u73b0\u8c61/\u80cc\u666f\uff1a\u8ddf\u8fd9\u4e2a\u89c2\u70b9\u76f8\u5173\u7684\u5177\u4f53\u4e8b\u4ef6\u3001\u6570\u636e\u3001\u884c\u4e1a\u52a8\u5411\u3001\u4e2a\u4eba\u7ecf\u5386\u7b49\u5ba2\u89c2\u4fe1\u606f",
  "- \u4f5c\u8005\u7684\u5224\u65ad\uff1a\u4f5c\u8005\u9488\u5bf9\u4e0a\u8ff0\u73b0\u8c61\u660e\u786e\u8868\u8fbe\u7684\u4e3b\u89c2\u770b\u6cd5\u3001\u8bc4\u4ef7\u3001\u7acb\u573a\u6216\u6001\u5ea6",
  "- \u8865\u5145\u4f8b\u8bc1\uff1a\u4f5c\u8005\u7528\u6765\u8fdb\u4e00\u6b65\u652f\u6491\u81ea\u5df1\u5224\u65ad\u7684\u6848\u4f8b\u3001\u5bf9\u6bd4\u3001\u6570\u636e\u7b49",
  "",
  "3-6\u4e2a\u89c2\u70b9\u5757\uff0c\u6309\u8bba\u8bc1\u903b\u8f91\u6392\u5e8f\uff0c\u975e\u65f6\u95f4\u987a\u5e8f",
  "",
  "\u3010\u60c5\u7eea\u57fa\u8c03\u4e0e\u5f26\u5916\u4e4b\u97f3\u3011",
  "1-2\u53e5\u8bdd\u70b9\u51fa\u660e\u663e\u60c5\u7eea\u8272\u5f69\u3001\u672a\u660e\u8bf4\u7684\u6f5c\u53f0\u8bcd\u6216\u53cd\u590d\u6d41\u9732\u7684\u77db\u76fe\u5fc3\u6001\u3002\u53ef\u7701\u7565\u3002",
  "",
  "## \u63d0\u70bc\u65b9\u6cd5\u8bba\uff08\u5185\u5316\u6267\u884c\uff0c\u4e0d\u5728\u8f93\u51fa\u4e2d\u4f53\u73b0\uff09",
  "1. \u5f52\u7c7b\u4f18\u5148\uff1a\u5148\u5212\u51fa3-6\u4e2a\u6838\u5fc3\u8bae\u9898\uff0c\u628a\u539f\u6587\u4e2d\u5c5e\u4e8e\u540c\u4e00\u8bae\u9898\u7684\u5185\u5bb9\u5f52\u62e2\u3002",
  "2. \u89c2\u70b9\u4e0e\u4e8b\u5b9e\u6346\u7ed1\uff1a\u6bcf\u6761\u89c2\u70b9\u5757\u5fc5\u987b\u662f\u5224\u65ad+\u652f\u6491\u7684\u5b8c\u6574\u7ec4\u5408\u3002",
  "3. \u53bb\u566a\u4e0d\u964d\u7ef4\uff1a\u5220\u9664\u53e3\u8bed\u586b\u5145\u8bcd\u3001\u91cd\u590d\u5f3a\u8c03\u3001\u65e0\u5173\u5c94\u5f00\u8bdd\u9898\uff0c\u4fdd\u7559\u6240\u6709\u6709\u4ef7\u503c\u4fe1\u606f\u3002",
  "4. \u4e25\u683c\u5fe0\u4e8e\u539f\u610f\uff1a\u6240\u6709\u5f52\u7c7b\u548c\u6574\u5408\u90fd\u5fc5\u987b\u5728\u539f\u6587\u4e2d\u6709\u76f4\u63a5\u4f9d\u636e\u3002",
  "5. \u8bed\u8a00\u4e00\u81f4\uff1a\u8f93\u51fa\u8bed\u8a00\u4e0e\u539f\u6587\u4fdd\u6301\u4e00\u81f4\u3002",
  "",
  "## \u884c\u4e3a\u8fb9\u754c",
  "- \u53ea\u8f93\u51fa\u4e0a\u8ff0\u7ed3\u6784\uff0c\u4e0d\u6dfb\u52a0\u5f00\u573a\u767d\u3001\u89e3\u91ca\u6216\u989d\u5916\u5efa\u8bae\u3002",
  "- \u5982\u679c\u7528\u6237\u53d1\u9001\u7684\u5185\u5bb9\u660e\u663e\u4e0d\u662f\u89c6\u9891\u6587\u6848\uff0c\u56de\u590d\uff1a\u201c\u8bf7\u63d0\u4f9b\u4e00\u6bb5\u89c6\u9891\u6587\u6848\uff0c\u6211\u6765\u5e2e\u4f60\u63d0\u70bc\u89c2\u70b9\u548c\u4e8b\u5b9e\u3002\u201d"
].join("\n");

const STORAGE_KEY = "bili2insight-settings"; const SETTINGS_VERSION = 2;
function loadSaved(): Record<string,any>|null { try { const r=localStorage.getItem(STORAGE_KEY); return r?JSON.parse(r):null; } catch(_){return null;} }
function saveToDisk(d:Record<string,any>) { try{localStorage.setItem(STORAGE_KEY,JSON.stringify(d));}catch(_){} }

export const useAppStore = defineStore("app", () => {
  const saved = loadSaved();

  const url = ref("");
  const proxy = ref(saved?.proxy ?? "http://127.0.0.1:7897");
  const aiApiUrl = ref(saved?.aiApiUrl ?? PROVIDERS[0].url);
  const aiApiKey = ref(saved?.aiApiKey ?? "");
  const aiModel = ref(saved?.aiModel ?? PROVIDERS[0].models[0]);
  const aiPrompt = ref((saved?.version === SETTINGS_VERSION && saved?.aiPrompt) ? saved.aiPrompt : DEFAULT_PROMPT);
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
    saveToDisk({ version: SETTINGS_VERSION, proxy: proxy.value, aiApiUrl: aiApiUrl.value, aiApiKey: aiApiKey.value, aiModel: aiModel.value, aiPrompt: aiPrompt.value, selectedProvider: selectedProvider.value });
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
    catch (e: any) { const msg = String(e); error.value = msg.includes("401") ? "Invalid API key" : "Fetch failed: "+msg; }
  }

  async function exportToFile() {
    if (!result.value) return;
    try { const { save } = await import("@tauri-apps/plugin-dialog"); const path = await save({ filters:[{name:"Markdown",extensions:["md"]}], defaultPath:`${result.value.video_info.title}.md` }); if (path) await saveResultToFile(result.value, path); }
    catch (e: any) { error.value = String(e); }
  }

  return { url, proxy, aiApiUrl, aiApiKey, aiModel, aiPrompt, selectedProvider, processing, progress, result, error, preview, previewLoading, PROVIDERS, customModels, init, cleanup, startPipeline, exportToFile, switchProvider, fetchModelList };
});
