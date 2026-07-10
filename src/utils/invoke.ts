import { invoke } from "@tauri-apps/api/core";
import type { PipelineResult, VideoInfo } from "./types";

export async function previewVideo(url: string, proxy?: string): Promise<VideoInfo> {
  return invoke<VideoInfo>("preview_video", { url, proxy: proxy || null });
}

export async function runPipeline(
  url: string, proxy?: string, aiApiUrl?: string, aiApiKey?: string,
  aiModel?: string, aiPrompt?: string,
): Promise<PipelineResult> {
  return invoke<PipelineResult>("run_pipeline", { url, proxy: proxy || null, aiApiUrl: aiApiUrl || null, aiApiKey: aiApiKey || null, aiModel: aiModel || null, aiPrompt: aiPrompt || null });
}

export async function saveResultToFile(result: PipelineResult, outputPath: string): Promise<void> {
  return invoke("save_result_to_file", { result, outputPath });
}
