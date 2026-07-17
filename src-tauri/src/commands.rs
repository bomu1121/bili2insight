use crate::PipelineProgress;
use crate::pipeline;
use crate::export;
use crate::VideoInfo;
use tauri::{AppHandle, Emitter, Manager};
use std::path::PathBuf;

fn emit_progress(app: &AppHandle, stage: &str, progress: f64, message: &str) {
    let _ = app.emit("pipeline-progress", PipelineProgress { stage: stage.to_string(), progress, message: message.to_string() });
}

#[tauri::command]
pub async fn preview_video(app: AppHandle, url: String, proxy: Option<String>, page_cid: Option<i64>) -> Result<VideoInfo, String> {
    emit_progress(&app, "preview", 0.0, "Detecting video...");
    let app_pv = app.clone();
    let result = pipeline::download_bili_audio(&app, &url, &PathBuf::from("."), true, proxy.as_deref(), page_cid,
        move |s, p, m| { let _ = app_pv.emit("pipeline-progress", PipelineProgress { stage: s.to_string(), progress: p, message: m.to_string() }); },
    ).await.map_err(|e| format!("Preview failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
pub async fn download_batch(app: AppHandle, url: String, proxy: Option<String>, cids: Vec<i64>) -> Result<crate::VideoInfo, String> {
    let output_dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("tasks");
    std::fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;
    emit_progress(&app, "download", 0.05, &format!("Batch downloading {} page(s)...", cids.len()));
    let app_dl = app.clone();
    let video_info = pipeline::download_bili_audio_batch(&app, &url, &output_dir, proxy.as_deref(), &cids,
        move |s, p, m| { let _ = app_dl.emit("pipeline-progress", PipelineProgress { stage: s.to_string(), progress: p, message: m.to_string() }); },
    ).await.map_err(|e| format!("Batch download failed: {}", e))?;
    emit_progress(&app, "download", 0.25, "Batch download complete");
    Ok(video_info)
}
#[tauri::command]
pub async fn run_pipeline(app: AppHandle, url: String, proxy: Option<String>, ai_api_url: Option<String>, ai_api_key: Option<String>, ai_model: Option<String>, ai_prompt: Option<String>, page_cid: Option<i64>,
    asr_model: Option<String>, asr_api_url: Option<String>, asr_api_key: Option<String>,
) -> Result<crate::PipelineResult, String> {
    let output_dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("tasks");
    std::fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;
    let start = std::time::Instant::now();
    println!("=== PIPELINE START [{:.0}s] url={} cid={:?} ===", start.elapsed().as_secs_f64(), url, page_cid);

    println!("  [STAGE:download] calling bili_worker sidecar...");
    emit_progress(&app, "download", 0.05, "Getting video info and downloading audio...");
    let app_dl = app.clone();
    let video_info = pipeline::download_bili_audio(&app, &url, &output_dir, false, proxy.as_deref(), page_cid,
        move |s, p, m| { let _ = app_dl.emit("pipeline-progress", PipelineProgress { stage: s.to_string(), progress: p, message: m.to_string() }); },
    ).await.map_err(|e| format!("Download failed: {}", e))?;
    println!("  [STAGE:download] DONE, bvid={} title={}", video_info.bvid, video_info.title);
    emit_progress(&app, "download", 0.25, "Download complete");

    let audio_tag = if let Some(cid) = page_cid { format!("{}_p{}", video_info.bvid, cid) } else { video_info.bvid.clone() };
    let audio_path = output_dir.join(format!("{}.m4a", audio_tag));
    println!("  [STAGE:ffmpeg] audio_tag={} audio_path={}", audio_tag, audio_path.display());
    emit_progress(&app, "ffmpeg", 0.30, "Converting audio format...");
    let wav_path = pipeline::extract_audio_wav(&app, &audio_path.to_string_lossy(), &output_dir).await.map_err(|e| format!("FFmpeg error: {}", e))?;
    println!("  [STAGE:ffmpeg] DONE, wav_path={}", wav_path);
    emit_progress(&app, "ffmpeg", 0.40, "Audio conversion complete");

    let asr_model_val = asr_model.unwrap_or_else(|| "paraformer".to_string());
    println!("  [STAGE:asr] starting speech recognition, model={}...", asr_model_val);
    emit_progress(&app, "asr", 0.45, "Running speech recognition...");
    let app_asr = app.clone();
    let transcript = pipeline::run_asr(&app, &wav_path,
        &asr_model_val, asr_api_url.as_deref(), asr_api_key.as_deref(),
        move |s, p, m| { let _ = app_asr.emit("pipeline-progress", PipelineProgress { stage: s.to_string(), progress: p, message: m.to_string() }); },
    ).await.map_err(|e| format!("ASR failed: {}", e))?;
    println!("  [STAGE:asr] DONE, transcript_len={}", transcript.len());
    emit_progress(&app, "asr", 0.75, "Speech recognition complete");

    let ai_url = ai_api_url.unwrap_or_else(|| "https://api.deepseek.com".to_string());
    let ai_key = ai_api_key.unwrap_or_default();
    let model = ai_model.unwrap_or_else(|| "deepseek-chat".to_string());

    let raw = transcript.clone();
    println!("  [STAGE:refine] calling AI proofread, model={}", model);
    emit_progress(&app, "refine", 0.76, "AI proofreading transcript...");
    let transcript = pipeline::refine_transcript(&ai_url, &ai_key, &model, &transcript).await.map_err(|e| format!("Refine failed: {}", e))?;
    println!("  [STAGE:refine] DONE, refined_len={}", transcript.len());
    emit_progress(&app, "refine", 0.80, "Transcript proofread");

    let prompt = ai_prompt.unwrap_or_else(|| "Please analyze the following video transcript...".to_string());
    println!("  [STAGE:ai] calling AI insights, prompt_len={}", prompt.len());
    emit_progress(&app, "ai", 0.81, "Extracting insights with AI...");
    let (insights, ai_raw) = pipeline::extract_insights(&ai_url, &ai_key, &model, &prompt, &transcript, &video_info.title).await.map_err(|e| format!("AI analysis failed: {}", e))?;
    println!("  [STAGE:ai] DONE, ai_raw_len={}", ai_raw.len());
    emit_progress(&app, "ai", 0.95, "AI insights ready");

    let ai_req = format!("SYSTEM: {}\n\nUSER: Video title: {}\n\nTranscript:\n{}", prompt, video_info.title, transcript);
    let markdown = export::generate_markdown(&video_info, &transcript, &insights);
    println!("=== PIPELINE END [{:.1}s] ===", start.elapsed().as_secs_f64());
    emit_progress(&app, "done", 1.0, "Complete");
    let _ = std::fs::remove_file(&audio_path);
    let _ = std::fs::remove_file(&wav_path);
    Ok(crate::PipelineResult { raw_transcript: raw, video_info, transcript, insights, markdown, ai_request: ai_req, ai_raw_response: ai_raw })
}

#[tauri::command]
#[allow(dead_code)]
pub async fn fetch_ai_models(api_url: String, api_key: String) -> Result<Vec<String>, String> {
    pipeline::fetch_models(&api_url, &api_key).await.map_err(|e| format!("Fetch failed: {}", e))
}

#[tauri::command]
#[allow(dead_code)]
pub async fn save_result(result: crate::PipelineResult) -> Result<String, String> { Ok(result.markdown) }

#[tauri::command]
pub fn get_cookies_path(app: AppHandle) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("bili_cookies.json").to_string_lossy().to_string())
}

#[tauri::command]
pub async fn save_result_to_file(_app: AppHandle, result: crate::PipelineResult, output_path: String) -> Result<(), String> {
    let path = PathBuf::from(&output_path);
    if let Some(parent) = path.parent() { std::fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    std::fs::write(&path, &result.markdown).map_err(|e| format!("Save failed: {}", e))?;
    #[cfg(target_os = "windows")]
    { if let Some(parent) = path.parent() { let _ = std::process::Command::new("explorer").arg(parent).spawn(); } }
    Ok(())
}

// --- Login & Favorites commands ---
#[tauri::command]
pub async fn qr_generate(app: AppHandle, proxy: Option<String>) -> Result<crate::QrGenerateResult, String> {
    pipeline::qr_generate_flow(&app, proxy.as_deref()).await.map_err(|e| format!("QR generate failed: {}", e))
}

#[tauri::command]
pub async fn qr_poll(app: AppHandle, qrcode_key: String, cookies_file: Option<String>, proxy: Option<String>) -> Result<crate::QrPollResult, String> {
    pipeline::qr_poll_flow(&app, &qrcode_key, cookies_file.as_deref(), proxy.as_deref()).await.map_err(|e| format!("QR poll failed: {}", e))
}

#[tauri::command]
pub async fn check_login(app: AppHandle, cookies_json: String, proxy: Option<String>) -> Result<crate::LoginCheckResult, String> {
    pipeline::check_login_flow(&app, &cookies_json, proxy.as_deref()).await.map_err(|e| format!("Check login failed: {}", e))
}

#[tauri::command]
pub async fn fav_get_folders(app: AppHandle, cookies_json: String, proxy: Option<String>) -> Result<crate::FavFoldersResult, String> {
    pipeline::fav_get_folders_flow(&app, &cookies_json, proxy.as_deref()).await.map_err(|e| format!("Get folders failed: {}", e))
}

#[tauri::command]
pub async fn fav_get_videos(app: AppHandle, cookies_json: String, folder_id: i64, page: i64, proxy: Option<String>) -> Result<crate::FavVideosResult, String> {
    pipeline::fav_get_videos_flow(&app, &cookies_json, folder_id, page, proxy.as_deref()).await.map_err(|e| format!("Get videos failed: {}", e))
}

#[tauri::command]
pub async fn sms_captcha(app: AppHandle, proxy: Option<String>) -> Result<serde_json::Value, String> {
    pipeline::sms_captcha_flow(&app, proxy.as_deref()).await.map_err(|e| format!("SMS captcha failed: {}", e))
}

#[tauri::command]
pub async fn sms_send(app: AppHandle, cid: String, tel: String, token: String, challenge: String, validate: String, seccode: String, proxy: Option<String>) -> Result<serde_json::Value, String> {
    pipeline::sms_send_flow(&app, &cid, &tel, &token, &challenge, &validate, &seccode, proxy.as_deref()).await.map_err(|e| format!("SMS send failed: {}", e))
}

#[tauri::command]
pub async fn sms_login(app: AppHandle, cid: String, tel: String, code: String, captcha_key: String, cookies_file: Option<String>, proxy: Option<String>) -> Result<serde_json::Value, String> {
    pipeline::sms_login_flow(&app, &cid, &tel, &code, &captcha_key, cookies_file.as_deref(), proxy.as_deref()).await.map_err(|e| format!("SMS login failed: {}", e))
}
