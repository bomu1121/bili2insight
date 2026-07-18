use crate::PipelineProgress;
use crate::pipeline;
use crate::export;
use crate::VideoInfo;
use crate::history::{HistoryEntry, HistoryListResult, HistoryState};
use tauri::{AppHandle, Emitter, Manager};
use std::path::PathBuf;

fn emit_progress(app: &AppHandle, stage: &str, progress: f64, message: &str, queue_item_id: Option<&str>) {
    let _ = app.emit("pipeline-progress", PipelineProgress { stage: stage.to_string(), progress, message: message.to_string(), queue_item_id: queue_item_id.map(|s| s.to_string()) });
}

#[tauri::command]
pub async fn preview_video(app: AppHandle, url: String, proxy: Option<String>, page_cid: Option<i64>) -> Result<VideoInfo, String> {
    emit_progress(&app, "preview", 0.0, "Detecting video...", None);
    let app_pv = app.clone();
    let result = pipeline::download_bili_audio(&app, &url, &PathBuf::from("."), true, proxy.as_deref(), page_cid,
        move |s, p, m| { let _ = app_pv.emit("pipeline-progress", PipelineProgress { stage: s.to_string(), progress: p, message: m.to_string(), queue_item_id: None }); },
    ).await.map_err(|e| format!("Preview failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
pub async fn download_batch(app: AppHandle, url: String, proxy: Option<String>, cids: Vec<i64>) -> Result<crate::VideoInfo, String> {
    let output_dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("tasks");
    std::fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;
    emit_progress(&app, "download", 0.05, &format!("Batch downloading {} page(s)...", cids.len()), None);
    let app_dl = app.clone();
    let video_info = pipeline::download_bili_audio_batch(&app, &url, &output_dir, proxy.as_deref(), &cids,
        move |s, p, m| { let _ = app_dl.emit("pipeline-progress", PipelineProgress { stage: s.to_string(), progress: p, message: m.to_string(), queue_item_id: None }); },
    ).await.map_err(|e| format!("Batch download failed: {}", e))?;
    emit_progress(&app, "download", 0.25, "Batch download complete", None);
    Ok(video_info)
}
#[tauri::command]
pub async fn run_pipeline(app: AppHandle, url: String, proxy: Option<String>, ai_api_url: Option<String>, ai_api_key: Option<String>, ai_model: Option<String>, ai_prompt: Option<String>, page_cid: Option<i64>,
    asr_model: Option<String>, asr_api_url: Option<String>, asr_api_key: Option<String>,
    queue_item_id: Option<String>,
) -> Result<crate::PipelineResult, String> {
    let output_dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("tasks");
    std::fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;
    let start = std::time::Instant::now();
    println!("=== PIPELINE START [{:.0}s] url={} cid={:?} ===", start.elapsed().as_secs_f64(), url, page_cid);

    println!("  [STAGE:download] calling bili_worker sidecar...");
    emit_progress(&app, "download", 0.05, "Getting video info and downloading audio...", queue_item_id.as_deref());
    let app_dl = app.clone();
    let mut video_info = pipeline::download_bili_audio(&app, &url, &output_dir, false, proxy.as_deref(), page_cid,
        move |s, p, m| { let _ = app_dl.emit("pipeline-progress", PipelineProgress { stage: s.to_string(), progress: p, message: m.to_string(), queue_item_id: None }); },
    ).await.map_err(|e| format!("Download failed: {}", e))?;
    // If processing a specific page, override video_info with the page's part title
    if let Some(cid) = page_cid {
        if let Some(page) = video_info.pages.iter().find(|p| p.cid == cid) {
            if !page.part.is_empty() {
                println!("  [STAGE:download] page title override: cur={} new={}", video_info.title, page.part);
                video_info.title = page.part.clone();
                video_info.cid = page.cid;
                video_info.duration = page.duration;
            }
        }
    }
    println!("  [STAGE:download] DONE, bvid={} title={}", video_info.bvid, video_info.title);
    emit_progress(&app, "download", 0.25, "Download complete", queue_item_id.as_deref());

        // cid=0 means "unknown / use default page" - treat same as None
    let audio_tag = match page_cid {
        Some(cid) if cid > 0 => format!("{}_p{}", video_info.bvid, cid),
        _ => video_info.bvid.clone(),
    };
    let audio_path = output_dir.join(format!("{}.m4a", audio_tag));
    println!("  [STAGE:ffmpeg] audio_tag={} audio_path={}", audio_tag, audio_path.display());
    emit_progress(&app, "ffmpeg", 0.30, "Converting audio format...", queue_item_id.as_deref());
    let wav_path = pipeline::extract_audio_wav(&app, &audio_path.to_string_lossy(), &output_dir).await.map_err(|e| format!("FFmpeg error: {}", e))?;
    println!("  [STAGE:ffmpeg] DONE, wav_path={}", wav_path);
    emit_progress(&app, "ffmpeg", 0.40, "Audio conversion complete", queue_item_id.as_deref());

    let asr_model_val = asr_model.unwrap_or_else(|| "paraformer".to_string());
    println!("  [STAGE:asr] starting speech recognition, model={}...", asr_model_val);
    emit_progress(&app, "asr", 0.45, "Running speech recognition...", queue_item_id.as_deref());
    let app_asr = app.clone();
    let transcript = pipeline::run_asr(&app, &wav_path,
        &asr_model_val, asr_api_url.as_deref(), asr_api_key.as_deref(),
        move |s, p, m| { let _ = app_asr.emit("pipeline-progress", PipelineProgress { stage: s.to_string(), progress: p, message: m.to_string(), queue_item_id: None }); },
    ).await.map_err(|e| format!("ASR failed: {}", e))?;
    println!("  [STAGE:asr] DONE, transcript_len={}", transcript.len());
    emit_progress(&app, "asr", 0.75, "Speech recognition complete", queue_item_id.as_deref());

    let ai_url = ai_api_url.unwrap_or_else(|| "https://api.deepseek.com".to_string());
    let ai_key = ai_api_key.unwrap_or_default();
    let model = ai_model.unwrap_or_else(|| "deepseek-chat".to_string());

    let raw = transcript.clone();
    println!("  [STAGE:refine] calling AI proofread, model={}", model);
    emit_progress(&app, "refine", 0.76, "AI proofreading transcript...", queue_item_id.as_deref());
    let client = app.state::<crate::AppState>().http_client.clone();
    let transcript = pipeline::refine_transcript(&client, &ai_url, &ai_key, &model, &transcript).await.map_err(|e| format!("Refine failed: {}", e))?;
    println!("  [STAGE:refine] DONE, refined_len={}", transcript.len());
    emit_progress(&app, "refine", 0.80, "Transcript proofread", queue_item_id.as_deref());

    let prompt = ai_prompt.unwrap_or_else(|| "Please analyze the following video transcript...".to_string());
    println!("  [STAGE:ai] calling AI insights, prompt_len={}", prompt.len());
    emit_progress(&app, "ai", 0.81, "Extracting insights with AI...", queue_item_id.as_deref());
    let (insights, ai_raw) = pipeline::extract_insights(&client, &ai_url, &ai_key, &model, &prompt, &transcript, &video_info.title).await.map_err(|e| format!("AI analysis failed: {}", e))?;
    println!("  [STAGE:ai] DONE, ai_raw_len={}", ai_raw.len());
    emit_progress(&app, "ai", 0.95, "AI insights ready", queue_item_id.as_deref());

    let ai_req = format!("SYSTEM: {}\n\nUSER: Video title: {}\n\nTranscript:\n{}", prompt, video_info.title, transcript);
    let markdown = export::generate_markdown(&video_info, &transcript, &insights);
   println!("=== PIPELINE END [{:.1}s] ===", start.elapsed().as_secs_f64());
   emit_progress(&app, "done", 1.0, "Complete", queue_item_id.as_deref());
    let hs = app.state::<HistoryState>();
    if let Ok(mut store) = hs.0.lock() {
        let id = uuid::Uuid::new_v4().to_string();
        let full_json = serde_json::to_string(&crate::PipelineResult {
            raw_transcript: raw.clone(),
            video_info: video_info.clone(),
            transcript: transcript.clone(),
            insights: insights.clone(),
            markdown: markdown.clone(),
            ai_request: ai_req.clone(),
            ai_raw_response: ai_raw.clone(),
        }).unwrap_or_default();
        let _ = store.add(crate::history::HistoryEntry {
            id,
            created_at: chrono::Utc::now().timestamp_millis(),
            source: "url".to_string(),
            url: url.clone(),
            title: video_info.title.clone(),
            bvid: video_info.bvid.clone(),
            uploader: video_info.uploader.clone(),
            duration: video_info.duration,
            cover: video_info.cover.clone(),
            summary: insights.summary.chars().take(300).collect(),
            elapsed_ms: start.elapsed().as_millis() as i64,
            template_name: String::new(),
            status: "done".to_string(),
            error_msg: String::new(),
        }, &full_json);
    }
   let _ = std::fs::remove_file(&audio_path);
   let _ = std::fs::remove_file(&wav_path);
   Ok(crate::PipelineResult { raw_transcript: raw, video_info, transcript, insights, markdown, ai_request: ai_req, ai_raw_response: ai_raw })
}

#[tauri::command]
pub async fn run_pipeline_local(app: AppHandle, file_path: String, file_name: String,
    ai_api_url: Option<String>, ai_api_key: Option<String>, ai_model: Option<String>, ai_prompt: Option<String>,
    asr_model: Option<String>, asr_api_url: Option<String>, asr_api_key: Option<String>,
    queue_item_id: Option<String>,
) -> Result<crate::PipelineResult, String> {
    let output_dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("tasks");
    std::fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;
    let start = std::time::Instant::now();
    println!("=== PIPELINE LOCAL START [{:.0}s] file={} ===", start.elapsed().as_secs_f64(), file_path);

    let video_info = crate::VideoInfo {
        cid: 0,
        bvid: format!("local_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs()),
        title: file_name.clone(),
        description: String::new(),
        duration: 0,
        cover: String::new(),
        uploader: "本地文件".to_string(),
        uploader_uid: 0,
        pubdate: 0,
        pages: vec![],
    };

    emit_progress(&app, "ffmpeg", 0.10, "Converting audio format...", queue_item_id.as_deref());
    let wav_path = pipeline::extract_audio_wav(&app, &file_path, &output_dir).await.map_err(|e| format!("FFmpeg error: {}", e))?;
    println!("  [STAGE:ffmpeg] DONE, wav_path={}", wav_path);
    emit_progress(&app, "ffmpeg", 0.25, "Audio conversion complete", queue_item_id.as_deref());

    let asr_model_val = asr_model.unwrap_or_else(|| "paraformer".to_string());
    println!("  [STAGE:asr] starting speech recognition, model={}...", asr_model_val);
    emit_progress(&app, "asr", 0.30, "Running speech recognition...", queue_item_id.as_deref());
    let app_asr = app.clone();
    let transcript = pipeline::run_asr(&app, &wav_path,
        &asr_model_val, asr_api_url.as_deref(), asr_api_key.as_deref(),
        move |s, p, m| { let _ = app_asr.emit("pipeline-progress", PipelineProgress { stage: s.to_string(), progress: p, message: m.to_string(), queue_item_id: None }); },
    ).await.map_err(|e| format!("ASR failed: {}", e))?;
    println!("  [STAGE:asr] DONE, transcript_len={}", transcript.len());
    emit_progress(&app, "asr", 0.65, "Speech recognition complete", queue_item_id.as_deref());

    let ai_url = ai_api_url.unwrap_or_else(|| "https://api.deepseek.com".to_string());
    let ai_key = ai_api_key.unwrap_or_default();
    let model = ai_model.unwrap_or_else(|| "deepseek-chat".to_string());

    let raw = transcript.clone();
    println!("  [STAGE:refine] calling AI proofread, model={}", model);
    emit_progress(&app, "refine", 0.66, "AI proofreading transcript...", queue_item_id.as_deref());
    let client = app.state::<crate::AppState>().http_client.clone();
    let transcript = pipeline::refine_transcript(&client, &ai_url, &ai_key, &model, &transcript).await.map_err(|e| format!("Refine failed: {}", e))?;
    println!("  [STAGE:refine] DONE, refined_len={}", transcript.len());
    emit_progress(&app, "refine", 0.75, "Transcript proofread", queue_item_id.as_deref());

    let prompt = ai_prompt.unwrap_or_else(|| "Please analyze the following video transcript...".to_string());
    println!("  [STAGE:ai] calling AI insights, prompt_len={}", prompt.len());
    emit_progress(&app, "ai", 0.76, "Extracting insights with AI...", queue_item_id.as_deref());
    let (insights, ai_raw) = pipeline::extract_insights(&client, &ai_url, &ai_key, &model, &prompt, &transcript, &video_info.title).await.map_err(|e| format!("AI analysis failed: {}", e))?;
    println!("  [STAGE:ai] DONE, ai_raw_len={}", ai_raw.len());
    emit_progress(&app, "ai", 0.95, "AI insights ready", queue_item_id.as_deref());

    let ai_req = format!("SYSTEM: {}\n\nUSER: Video title: {}\n\nTranscript:\n{}", prompt, video_info.title, transcript);
    let markdown = crate::export::generate_markdown(&video_info, &transcript, &insights);
   println!("=== PIPELINE LOCAL END [{:.1}s] ===", start.elapsed().as_secs_f64());
   emit_progress(&app, "done", 1.0, "Complete", queue_item_id.as_deref());
    let hs = app.state::<HistoryState>();
    if let Ok(mut store) = hs.0.lock() {
        let id = uuid::Uuid::new_v4().to_string();
        let full_json = serde_json::to_string(&crate::PipelineResult {
            raw_transcript: raw.clone(),
            video_info: video_info.clone(),
            transcript: transcript.clone(),
            insights: insights.clone(),
            markdown: markdown.clone(),
            ai_request: ai_req.clone(),
            ai_raw_response: ai_raw.clone(),
        }).unwrap_or_default();
        let _ = store.add(crate::history::HistoryEntry {
            id,
            created_at: chrono::Utc::now().timestamp_millis(),
            source: "local".to_string(),
            url: file_path.clone(),
            title: file_name.clone(),
            bvid: String::new(),
            uploader: String::new(),
            duration: 0,
            cover: String::new(),
            summary: insights.summary.chars().take(300).collect(),
            elapsed_ms: start.elapsed().as_millis() as i64,
            template_name: String::new(),
            status: "done".to_string(),
            error_msg: String::new(),
        }, &full_json);
    }
   let _ = std::fs::remove_file(&wav_path);
   Ok(crate::PipelineResult { raw_transcript: raw, video_info, transcript, insights, markdown, ai_request: ai_req, ai_raw_response: ai_raw })
}

#[tauri::command]
#[allow(dead_code)]
pub async fn fetch_ai_models(app: AppHandle, api_url: String, api_key: String) -> Result<Vec<String>, String> {
    let client = app.state::<crate::AppState>().http_client.clone();
    pipeline::fetch_models(&client, &api_url, &api_key).await.map_err(|e| format!("Fetch failed: {}", e))
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
pub fn read_cookies_file(app: AppHandle) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = dir.join("bili_cookies.json");
    std::fs::read_to_string(&path).map_err(|e| format!("Cannot read cookies: {}", e))
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
pub async fn fav_get_follow_list(app: AppHandle, cookies_json: String, follow_type: i64, page: i64, proxy: Option<String>) -> Result<serde_json::Value, String> {
    pipeline::fav_get_follow_list_flow(&app, &cookies_json, follow_type, page, proxy.as_deref()).await.map_err(|e| format!("Get follow list failed: {}", e))
}

#[tauri::command]
pub async fn fav_collected_videos(app: AppHandle, cookies_json: String, folder_id: i64, mid: i64, page: i64, proxy: Option<String>) -> Result<crate::FavVideosResult, String> {
    let val = pipeline::fav_collected_videos_flow(&app, &cookies_json, folder_id, mid, page, proxy.as_deref()).await.map_err(|e| format!("Collected videos failed: {}", e))?;
    Ok(serde_json::from_value(val).map_err(|e| format!("Parse error: {}", e))?)
}

#[tauri::command]
pub async fn fav_watch_later(app: AppHandle, cookies_json: String, page: i64, proxy: Option<String>) -> Result<serde_json::Value, String> {
    pipeline::fav_watch_later_flow(&app, &cookies_json, page, proxy.as_deref()).await.map_err(|e| format!("Watch later failed: {}", e))
}

#[tauri::command]
pub async fn fav_history(app: AppHandle, cookies_json: String, page: i64, proxy: Option<String>) -> Result<serde_json::Value, String> {
    pipeline::fav_history_flow(&app, &cookies_json, page, proxy.as_deref()).await.map_err(|e| format!("History failed: {}", e))
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

// --- History commands ---

#[tauri::command]
pub fn history_list(state: tauri::State<'_, HistoryState>, page: u32, page_size: u32, search: Option<String>) -> Result<HistoryListResult, String> {
    let store = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(store.list(page, page_size, search.as_deref()))
}

#[tauri::command]
pub fn history_get_result(state: tauri::State<'_, HistoryState>, id: String) -> Result<String, String> {
    let store = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
    store.get_result(&id).ok_or_else(|| "Result not found".to_string())
}

#[tauri::command]
pub fn history_delete(state: tauri::State<'_, HistoryState>, id: String) -> Result<bool, String> {
    let mut store = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
    store.delete(&id).map_err(|e| format!("Delete error: {}", e))
}

#[tauri::command]
pub fn history_clear(state: tauri::State<'_, HistoryState>) -> Result<usize, String> {
    let mut store = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
    store.clear().map_err(|e| format!("Clear error: {}", e))
}

#[tauri::command]
pub fn history_add(state: tauri::State<'_, HistoryState>, entry: HistoryEntry, full_result_json: String) -> Result<(), String> {
    let mut store = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
    store.add(entry, &full_result_json).map_err(|e| format!("Add error: {}", e))
}
