import { invoke } from "@tauri-apps/api/core";
import type { PipelineResult, VideoInfo, QrGenerateResult, QrPollResult, LoginCheckResult, FavFoldersResult, FavVideosResult } from "./types";

export async function previewVideo(url: string, proxy?: string): Promise<VideoInfo> {
  return invoke<VideoInfo>("preview_video", { url, proxy: proxy || null, pageCid: null });
}

export async function downloadBatch(url: string, cids: number[], proxy?: string): Promise<VideoInfo> {
  return invoke<VideoInfo>("download_batch", { url, cids, proxy: proxy || null });
}

export async function runPipelineWithPage(
  url: string, proxy?: string, aiApiUrl?: string, aiApiKey?: string,
  aiModel?: string, aiPrompt?: string, pageCid?: number,
): Promise<PipelineResult> {
  console.log("invoke run_pipeline", { url: url.slice(0,40), pageCid });
  try {
    const r = await invoke<PipelineResult>("run_pipeline", { url, proxy: proxy || null, aiApiUrl: aiApiUrl || null, aiApiKey: aiApiKey || null, aiModel: aiModel || null, aiPrompt: aiPrompt || null, pageCid: pageCid ?? null });
    console.log("invoke run_pipeline done");
    return r;
  } catch(e) { console.error("invoke run_pipeline FAILED:", e); throw e; }
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

export async function qrGenerate(proxy?: string): Promise<QrGenerateResult> { return invoke<QrGenerateResult>("qr_generate", { proxy: proxy || null }); }
export async function qrPoll(qrcodeKey: string, cookiesFile?: string, proxy?: string): Promise<QrPollResult> { return invoke<QrPollResult>("qr_poll", { qrcodeKey: qrcodeKey, cookiesFile: cookiesFile || null, proxy: proxy || null }); }
export async function checkLogin(cookiesJson: string, proxy?: string): Promise<LoginCheckResult> { return invoke<LoginCheckResult>("check_login", { cookiesJson, proxy: proxy || null }); }
export async function favGetFolders(cookiesJson: string, proxy?: string): Promise<FavFoldersResult> { return invoke<FavFoldersResult>("fav_get_folders", { cookiesJson, proxy: proxy || null }); }
export async function favGetVideos(cookiesJson: string, folderId: number, page: number, proxy?: string): Promise<FavVideosResult> { return invoke<FavVideosResult>("fav_get_videos", { cookiesJson, folderId, page, proxy: proxy || null }); }

export async function fetchModels(apiUrl: string, apiKey: string): Promise<string[]> { return invoke<string[]>('fetch_ai_models', { apiUrl, apiKey }); }
