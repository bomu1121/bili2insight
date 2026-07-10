import { defineStore } from "pinia";
import { ref } from "vue";
import type { PipelineResult, PipelineProgress } from "../utils/types";
import { runPipeline, saveResultToFile } from "../utils/invoke";
import { listen } from "@tauri-apps/api/event";

export const useAppStore = defineStore("app", () => {
  const url = ref("");
  const proxy = ref("http://127.0.0.1:7897");
  const aiApiUrl = ref("https://api.openai.com/v1/chat/completions");
  const aiApiKey = ref("");
  const aiModel = ref("gpt-4o-mini");
  const aiPrompt = ref("请分析以下视频转录文本，提炼出核心观点、关键信息点（3-5条），并给出3-5个标签。请以JSON格式输出：{\"summary\": \"摘要\", \"key_points\": [\"观点1\", \"观点2\", ...], \"tags\": [\"标签1\", \"标签2\", ...]}。只返回JSON，不要多余内容。");

  const processing = ref(false);
  const progress = ref<PipelineProgress | null>(null);
  const result = ref<PipelineResult | null>(null);
  const error = ref("");
  const ready = ref(false);

  let unlisten: (() => void) | null = null;

  async function init() {
    ready.value = false;
    unlisten = await listen<PipelineProgress>("pipeline-progress", (event) => {
      progress.value = event.payload;
    });
    ready.value = true;
  }

  function cleanup() {
    if (unlisten) {
      unlisten();
      unlisten = null;
    }
  }

  async function startPipeline() {
    if (!url.value.trim()) {
      error.value = "请输入B站视频链接";
      return;
    }

    processing.value = true;
    error.value = "";
    result.value = null;

    try {
      result.value = await runPipeline(
        url.value,
        proxy.value || undefined,
        aiApiUrl.value || undefined,
        aiApiKey.value || undefined,
        aiModel.value || undefined,
        aiPrompt.value || undefined,
      );
    } catch (e: any) {
      error.value = String(e);
    } finally {
      processing.value = false;
    }
  }

  async function exportToFile() {
    if (!result.value) return;
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({
        filters: [{ name: "Markdown", extensions: ["md"] }],
        defaultPath: `${result.value.video_info.title}.md`,
      });
      if (path) {
        await saveResultToFile(result.value, path);
      }
    } catch (e: any) {
      error.value = String(e);
    }
  }

  function reset() {
    processing.value = false;
    progress.value = null;
    result.value = null;
    error.value = "";
  }

  return {
    url, proxy, aiApiUrl, aiApiKey, aiModel, aiPrompt,
    processing, progress, result, error, ready,
    init, cleanup, startPipeline, exportToFile, reset,
  };
});
