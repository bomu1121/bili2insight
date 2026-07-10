use crate::VideoInfo;
use crate::InsightResult;
use std::path::{Path, PathBuf};
use std::process::Command;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use serde_json::Value;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub async fn download_bili_audio(
    url: &str, output_dir: &Path, preview_only: bool, proxy: Option<&str>,
    progress: impl Fn(&str, f64, &str) + Send + 'static,
) -> Result<VideoInfo, anyhow::Error> {
    let worker_path = find_worker("worker/bili_worker.py")?;
    let mut cmd = Command::new("python");
    cmd.arg(&worker_path).arg("--url").arg(url).arg("--output-dir").arg(output_dir.to_string_lossy().as_ref());
    if preview_only { cmd.arg("--preview-only"); }
    if let Some(p) = proxy { cmd.arg("--proxy").arg(p); }
    #[cfg(target_os = "windows")] { cmd.creation_flags(CREATE_NO_WINDOW); }
    let output = cmd.output()?;
    if !output.status.success() { let stderr = String::from_utf8_lossy(&output.stderr); return Err(anyhow::anyhow!("Worker failed: {}", stderr)); }
    let stdout = String::from_utf8(output.stdout)?;
    let mut video_info: Option<VideoInfo> = None;
    for line in stdout.lines() {
        if let Ok(val) = serde_json::from_str::<Value>(line) {
            match val["type"].as_str() {
                Some("progress") => { let s = val["stage"].as_str().unwrap_or(""); let m = val["message"].as_str().unwrap_or(""); progress(s, 0.1, m); }
                Some("result") => {
                    if let Some(vi) = val["video_info"].as_object() {
                        video_info = Some(VideoInfo { bvid: vi["bvid"].as_str().unwrap_or("").to_string(), title: vi["title"].as_str().unwrap_or("").to_string(), description: vi["description"].as_str().unwrap_or("").to_string(), duration: vi["duration"].as_i64().unwrap_or(0), cover: vi["cover"].as_str().unwrap_or("").to_string(), uploader: vi["uploader"].as_str().unwrap_or("").to_string(), uploader_uid: vi["uploader_uid"].as_i64().unwrap_or(0), pubdate: vi["pubdate"].as_i64().unwrap_or(0) });
                    }
                }
                Some("error") => return Err(anyhow::anyhow!("{}", val["message"].as_str().unwrap_or("unknown"))),
                _ => {}
            }
        }
    }
    video_info.ok_or_else(|| anyhow::anyhow!("No video info in worker output"))
}

pub async fn extract_audio_wav(audio_path: &str, output_dir: &Path) -> Result<String, anyhow::Error> {
    let wav_path = output_dir.join(format!("{}.wav", Path::new(audio_path).file_stem().unwrap_or_default().to_string_lossy()));
    let mut cmd = Command::new("ffmpeg");
    cmd.args(["-y", "-i", audio_path, "-ar", "16000", "-ac", "1", "-sample_fmt", "s16", wav_path.to_string_lossy().as_ref()]);
    #[cfg(target_os = "windows")] { cmd.creation_flags(CREATE_NO_WINDOW); }
    let output = cmd.output()?;
    if !output.status.success() { let stderr = String::from_utf8_lossy(&output.stderr); return Err(anyhow::anyhow!("FFmpeg failed: {}", stderr)); }
    Ok(wav_path.to_string_lossy().to_string())
}

pub async fn run_asr(wav_path: &str, resource_dir: &str, progress: impl Fn(&str, f64, &str) + Send + 'static) -> Result<String, anyhow::Error> {
    let worker_path = find_worker("worker/asr_worker.py")?;
    let models_dir = find_models_dir(resource_dir)?;
    let mut cmd = Command::new("python");
    cmd.arg(&worker_path).arg("--wav").arg(wav_path).arg("--model").arg("paraformer").arg("--models-dir").arg(models_dir.to_string_lossy().as_ref());
    #[cfg(target_os = "windows")] { cmd.creation_flags(CREATE_NO_WINDOW); }
    let output = cmd.output()?;
    if !output.status.success() { let stderr = String::from_utf8_lossy(&output.stderr); return Err(anyhow::anyhow!("ASR failed: {}", stderr)); }
    let stdout = String::from_utf8(output.stdout)?;
    let mut full_text = String::new();
    for line in stdout.lines() {
        if let Ok(val) = serde_json::from_str::<Value>(line) {
            match val["type"].as_str() {
                Some("progress") => { let m = val["message"].as_str().unwrap_or(""); progress("asr", 0.5, m); }
                Some("result") => { if let Some(t) = val["text"].as_str() { full_text = t.to_string(); } }
                Some("error") => return Err(anyhow::anyhow!("{}", val["message"].as_str().unwrap_or("unknown"))),
                _ => {}
            }
        }
    }
    if full_text.is_empty() { return Err(anyhow::anyhow!("No transcription result")); }
    Ok(full_text)
}

pub async fn extract_insights(api_url: &str, api_key: &str, model: &str, prompt: &str, transcript: &str, title: &str) -> Result<InsightResult, anyhow::Error> {
    let client = reqwest::Client::new();
    let user_content = format!("Video title: {}\n\nTranscript:\n{}", title, transcript);
    let mut req = client.post(api_url).json(&serde_json::json!({"model": model, "messages": [{"role": "system", "content": prompt}, {"role": "user", "content": user_content}], "temperature": 0.3}));
    let api_key = api_key.trim(); if !api_key.is_empty() { req = req.header("Authorization", format!("Bearer {}", api_key)); }
    let resp = req.send().await?;
    if !resp.status().is_success() { let s = resp.status(); let t = resp.text().await.unwrap_or_default(); return Err(anyhow::anyhow!("AI API error {}: {}", s, t)); }
    let json: Value = resp.json().await?;
    let content = json["choices"][0]["message"]["content"].as_str().unwrap_or("").trim();
    let content = if content.starts_with("```json") { content.strip_prefix("```json").and_then(|s| s.strip_suffix("```")).unwrap_or(content).trim() } else if content.starts_with("```") { content.strip_prefix("```").and_then(|s| s.strip_suffix("```")).unwrap_or(content).trim() } else { content };
    Ok(serde_json::from_str::<InsightResult>(content).unwrap_or_else(|_| {
        serde_json::from_str::<Value>(content).map(|v| InsightResult { summary: v["summary"].as_str().unwrap_or("").to_string(), key_points: v["key_points"].as_array().map(|a| a.iter().filter_map(|i| i.as_str().map(|s| s.to_string())).collect()).unwrap_or_default(), tags: v["tags"].as_array().map(|a| a.iter().filter_map(|i| i.as_str().map(|s| s.to_string())).collect()).unwrap_or_default() }).unwrap_or(InsightResult { summary: content.to_string(), key_points: vec![], tags: vec![] })
    }))
}

fn find_models_dir(resource_dir: &str) -> Result<PathBuf, anyhow::Error> {
    let candidates: Vec<PathBuf> = vec![Path::new(resource_dir).join("models"), PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("models"), PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().map(|p| p.join("models")).unwrap_or_default(), PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("models"), PathBuf::from("../models")];
    for c in &candidates { if c.join("paraformer-large").exists() || c.join("sense-voice-small").exists() { return Ok(c.clone()); } }
    Err(anyhow::anyhow!("Models directory not found. Searched: {:?}", candidates))
}

fn find_worker(rel_path: &str) -> Result<String, anyhow::Error> {
    let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(|p| p.to_path_buf())).unwrap_or_default();
    let candidates = vec![exe_dir.join(rel_path), PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().map(|p| p.join(rel_path)).unwrap_or_default(), PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join(rel_path)];
    for c in &candidates { if c.exists() { return Ok(c.to_string_lossy().to_string()); } }
    Err(anyhow::anyhow!("Worker not found: {}. Searched: {:?}", rel_path, candidates))
}

pub async fn fetch_models(api_url: &str, api_key: &str) -> Result<Vec<String>, anyhow::Error> {
    let base = api_url.trim_end_matches("/chat/completions").trim_end_matches('/');
    let models_url = format!("{}/models", base);
    let client = reqwest::Client::new();
    let mut req = client.get(&models_url);
    let api_key = api_key.trim(); if !api_key.is_empty() { req = req.header("Authorization", format!("Bearer {}", api_key)); }
    let resp = req.send().await?;
    if !resp.status().is_success() {
        let s = resp.status(); let t = resp.text().await.unwrap_or_default();
        return Err(anyhow::anyhow!("API error {}: {}", s, t));
    }
    let json: serde_json::Value = resp.json().await?;
    let models: Vec<String> = json["data"].as_array()
        .map(|a| a.iter().filter_map(|m| m["id"].as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();
    if models.is_empty() { return Err(anyhow::anyhow!("No models found")); }
    Ok(models)
}
