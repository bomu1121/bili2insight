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
pub async fn preview_video(app: AppHandle, url: String, proxy: Option<String>) -> Result<VideoInfo, String> {
    emit_progress(&app, "preview", 0.0, "Detecting video...");
    let result = pipeline::download_bili_audio(&url, &PathBuf::from("."), true, proxy.as_deref(),
        move |s, p, m| { let _ = app.emit("pipeline-progress", PipelineProgress { stage: s.to_string(), progress: p, message: m.to_string() }); },
    ).await.map_err(|e| format!("Preview failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
pub async fn run_pipeline(app: AppHandle, url: String, proxy: Option<String>, ai_api_url: Option<String>, ai_api_key: Option<String>, ai_model: Option<String>, ai_prompt: Option<String>) -> Result<crate::PipelineResult, String> {
    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    let output_dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("tasks");
    std::fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;

    emit_progress(&app, "download", 0.05, "Getting video info and downloading audio...");
    let app_dl = app.clone();
    let video_info = pipeline::download_bili_audio(&url, &output_dir, false, proxy.as_deref(),
        move |s, p, m| { let _ = app_dl.emit("pipeline-progress", PipelineProgress { stage: s.to_string(), progress: p, message: m.to_string() }); },
    ).await.map_err(|e| format!("Download failed: {}", e))?;
    emit_progress(&app, "download", 0.25, "Download complete");

    let audio_path = output_dir.join(format!("{}.m4a", video_info.bvid));
    emit_progress(&app, "ffmpeg", 0.30, "Converting audio format...");
    let wav_path = pipeline::extract_audio_wav(&audio_path.to_string_lossy(), &output_dir).await.map_err(|e| format!("FFmpeg error: {}", e))?;
    emit_progress(&app, "ffmpeg", 0.40, "Audio conversion complete");

    emit_progress(&app, "asr", 0.45, "Running speech recognition...");
    let app_asr = app.clone();
    let transcript = pipeline::run_asr(&wav_path, &resource_dir.to_string_lossy(),
        move |s, p, m| { let _ = app_asr.emit("pipeline-progress", PipelineProgress { stage: s.to_string(), progress: p, message: m.to_string() }); },
    ).await.map_err(|e| format!("ASR failed: {}", e))?;
    emit_progress(&app, "asr", 0.75, "Speech recognition complete");

    emit_progress(&app, "ai", 0.80, "Extracting insights with AI...");
    let ai_url = ai_api_url.unwrap_or_else(|| "https://api.deepseek.com/v1/chat/completions".to_string());
    let ai_key = ai_api_key.unwrap_or_default();
    let model = ai_model.unwrap_or_else(|| "deepseek-chat".to_string());
    let prompt = ai_prompt.unwrap_or_else(|| "Please analyze the following video transcript, extract core insights (3-5 key points), and provide 3-5 tags. Output as JSON only: {\"summary\": \"...\", \"key_points\": [\"...\"], \"tags\": [\"...\"]}. Return JSON only, no extra text.".to_string());
    let insights = pipeline::extract_insights(&ai_url, &ai_key, &model, &prompt, &transcript, &video_info.title).await.map_err(|e| format!("AI analysis failed: {}", e))?;
    emit_progress(&app, "ai", 0.95, "AI insights ready");

    let markdown = export::generate_markdown(&video_info, &transcript, &insights);
    emit_progress(&app, "done", 1.0, "Complete");
    Ok(crate::PipelineResult { video_info, transcript, insights, markdown })
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
pub async fn save_result_to_file(_app: AppHandle, result: crate::PipelineResult, output_path: String) -> Result<(), String> {
    let path = PathBuf::from(&output_path);
    if let Some(parent) = path.parent() { std::fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    std::fs::write(&path, &result.markdown).map_err(|e| format!("Save failed: {}", e))?;
    #[cfg(target_os = "windows")]
    { if let Some(parent) = path.parent() { let _ = std::process::Command::new("explorer").arg(parent).spawn(); } }
    Ok(())
}

