import { defineStore } from "pinia";
import { ref } from "vue";
import type { PipelineResult, PipelineProgress } from "../utils/types";
import { runPipeline, saveResultToFile } from "../utils/invoke";
import { listen } from "@tauri-apps/api/event";

export const useAppStore = defineStore("app", () => {
  const url = ref("");
  const proxy = ref("http://127.0.0.1:7897");
  const aiApiUrl = ref("https://api.deepseek.com/v1/chat/completions");
  const aiApiKey = ref("");
  const aiModel = ref("deepseek-chat");
  const aiPrompt = ref(`Please analyze the following video transcript, extract core insights (3-5 key points), and provide 3-5 tags. Output as JSON only: {"summary": "...", "key_points": ["..."], "tags": ["..."]}. Return JSON only, no extra text.`);

  const processing = ref(false);
  const progress = ref<PipelineProgress | null>(null);
  const result = ref<PipelineResult | null>(null);
  const error = ref("");

  let unlisten: (() => void) | null = null;

  async function init() {
    unlisten = await listen<PipelineProgress>("pipeline-progress", (event) => {
      progress.value = event.payload;
    });
  }

  function cleanup() {
    if (unlisten) { unlisten(); unlisten = null; }
  }

  async function startPipeline() {
    if (!url.value.trim()) { error.value = "Please enter a Bilibili video URL"; return; }
    processing.value = true; error.value = ""; result.value = null;
    try {
      result.value = await runPipeline(url.value, proxy.value || undefined, aiApiUrl.value || undefined, aiApiKey.value || undefined, aiModel.value || undefined, aiPrompt.value || undefined);
    } catch (e: any) { error.value = String(e); }
    finally { processing.value = false; }
  }

  async function exportToFile() {
    if (!result.value) return;
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({ filters: [{ name: "Markdown", extensions: ["md"] }], defaultPath: `${result.value.video_info.title}.md` });
      if (path) { await saveResultToFile(result.value, path); }
    } catch (e: any) { error.value = String(e); }
  }

  function reset() { processing.value = false; progress.value = null; result.value = null; error.value = ""; }

  return { url, proxy, aiApiUrl, aiApiKey, aiModel, aiPrompt, processing, progress, result, error, init, cleanup, startPipeline, exportToFile, reset };
});
