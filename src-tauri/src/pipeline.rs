use crate::{VideoInfo, VideoPageInfo};
use crate::InsightResult;
use std::path::Path;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;
use serde_json::Value;

pub async fn download_bili_audio(
    app: &AppHandle, url: &str, output_dir: &Path, preview_only: bool, proxy: Option<&str>, page_cid: Option<i64>,
    progress: impl Fn(&str, f64, &str) + Send + 'static,
) -> Result<VideoInfo, anyhow::Error> {
    let mut cmd = app.shell().sidecar("bili_worker")
        .map_err(|e| anyhow::anyhow!("bili_worker sidecar not found: {}", e))?;
    cmd = cmd.args(["--url", url, "--output-dir", output_dir.to_str().unwrap_or(".")]);
    if preview_only { cmd = cmd.arg("--preview-only"); }
    if let Some(cid) = page_cid { cmd = cmd.args(["--cid", &cid.to_string()]); }
    if let Some(p) = proxy { cmd = cmd.args(["--proxy", p]); }
    println!("  [sidecar] spawning bili_worker, url={} cid={:?}", url, page_cid);
    let out = match tokio::time::timeout(std::time::Duration::from_secs(120), cmd.output()).await {
        Ok(Ok(out)) => {
            println!("  [sidecar] process exited, status={:?} stdout_len={} stderr_len={}", out.status, out.stdout.len(), out.stderr.len());
            out
        }
        Ok(Err(e)) => return Err(anyhow::anyhow!("bili_worker failed: {}", e)),
        Err(_) => return Err(anyhow::anyhow!("bili_worker timed out after 60s")),
    };
    if !out.status.success() {
        let stdout = String::from_utf8_lossy(&out.stdout);
        println!("  [sidecar] FAILED stdout={}", stdout);
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(anyhow::anyhow!("bili_worker failed: stdout={}, stderr={}", stdout, stderr));
    }
    let stdout = String::from_utf8(out.stdout)?;
    let mut video_info: Option<VideoInfo> = None;
    for line in stdout.lines() {
        if let Ok(val) = serde_json::from_str::<Value>(line) {
            match val["type"].as_str() {
                Some("progress") => { let s = val["stage"].as_str().unwrap_or(""); let m = val["message"].as_str().unwrap_or(""); progress(s, 0.1, m); }
                Some("result") => {
                    if let Some(vi) = val["video_info"].as_object() {
                        let pages: Vec<VideoPageInfo> = vi.get("pages").and_then(|p| p.as_array()).map(|a| a.iter().filter_map(|p| Some(VideoPageInfo { page: p.get("page")?.as_i64()?, part: p.get("part")?.as_str().unwrap_or("").to_string(), cid: p.get("cid")?.as_i64()?, duration: p.get("duration").and_then(|d| d.as_i64()).unwrap_or(0) })).collect()).unwrap_or_default();
                        video_info = Some(VideoInfo { cid: vi["cid"].as_i64().unwrap_or(0), bvid: vi["bvid"].as_str().unwrap_or("").to_string(), title: vi["title"].as_str().unwrap_or("").to_string(), description: vi["description"].as_str().unwrap_or("").to_string(), duration: vi["duration"].as_i64().unwrap_or(0), cover: vi["cover"].as_str().unwrap_or("").to_string(), uploader: vi["uploader"].as_str().unwrap_or("").to_string(), uploader_uid: vi["uploader_uid"].as_i64().unwrap_or(0), pubdate: vi["pubdate"].as_i64().unwrap_or(0), pages });
                    }
                }
                Some("error") => return Err(anyhow::anyhow!("{}", val["message"].as_str().unwrap_or("unknown"))),
                _ => {}
            }
        }
    }
    video_info.ok_or_else(|| anyhow::anyhow!("No video info in worker output"))
}

pub async fn download_bili_audio_batch(
    app: &AppHandle, url: &str, output_dir: &Path, proxy: Option<&str>, page_cids: &[i64],
    progress: impl Fn(&str, f64, &str) + Send + 'static,
) -> Result<crate::VideoInfo, anyhow::Error> {
    let mut cmd = app.shell().sidecar("bili_worker")
        .map_err(|e| anyhow::anyhow!("bili_worker sidecar not found: {}", e))?;
    cmd = cmd.args(["--url", url, "--output-dir", output_dir.to_str().unwrap_or(".")]);
    let cids_str = page_cids.iter().map(|c| c.to_string()).collect::<Vec<_>>().join(",");
    cmd = cmd.args(["--cids", &cids_str]);
    if let Some(p) = proxy { cmd = cmd.args(["--proxy", p]); }
    println!("  [sidecar] spawning bili_worker BATCH, url={} cids={}", url, cids_str);
    let out = match tokio::time::timeout(std::time::Duration::from_secs(180), cmd.output()).await {
        Ok(Ok(out)) => {
            println!("  [sidecar] batch process exited, status={:?} stdout_len={} stderr_len={}", out.status, out.stdout.len(), out.stderr.len());
            out
        }
        Ok(Err(e)) => return Err(anyhow::anyhow!("bili_worker batch failed: {}", e)),
        Err(_) => return Err(anyhow::anyhow!("bili_worker batch timed out after 180s")),
    };
    if !out.status.success() {
        let stdout = String::from_utf8_lossy(&out.stdout);
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(anyhow::anyhow!("bili_worker batch failed: stdout={}, stderr={}", stdout, stderr));
    }
    let stdout = String::from_utf8(out.stdout)?;
    let mut video_info: Option<crate::VideoInfo> = None;
    for line in stdout.lines() {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(line) {
            match val["type"].as_str() {
                Some("progress") => { let s = val["stage"].as_str().unwrap_or(""); let m = val["message"].as_str().unwrap_or(""); progress(s, 0.1, m); }
                Some("result") => {
                    if let Some(vi) = val["video_info"].as_object() {
                        let pages: Vec<crate::VideoPageInfo> = vi.get("pages").and_then(|p| p.as_array()).map(|a| a.iter().filter_map(|p| Some(crate::VideoPageInfo { page: p.get("page")?.as_i64()?, part: p.get("part")?.as_str().unwrap_or("").to_string(), cid: p.get("cid")?.as_i64()?, duration: p.get("duration").and_then(|d| d.as_i64()).unwrap_or(0) })).collect()).unwrap_or_default();
                        video_info = Some(crate::VideoInfo { cid: vi["cid"].as_i64().unwrap_or(0), bvid: vi["bvid"].as_str().unwrap_or("").to_string(), title: vi["title"].as_str().unwrap_or("").to_string(), description: vi["description"].as_str().unwrap_or("").to_string(), duration: vi["duration"].as_i64().unwrap_or(0), cover: vi["cover"].as_str().unwrap_or("").to_string(), uploader: vi["uploader"].as_str().unwrap_or("").to_string(), uploader_uid: vi["uploader_uid"].as_i64().unwrap_or(0), pubdate: vi["pubdate"].as_i64().unwrap_or(0), pages });
                    }
                }
                Some("error") => return Err(anyhow::anyhow!("{}", val["message"].as_str().unwrap_or("unknown"))),
                _ => {}
            }
        }
    }
    video_info.ok_or_else(|| anyhow::anyhow!("No video info in worker output"))
}

pub async fn extract_audio_wav(
    app: &AppHandle, audio_path: &str, output_dir: &Path
) -> Result<String, anyhow::Error> {
    let stem = Path::new(audio_path).file_stem().unwrap_or_default().to_string_lossy();
    let wav_path = output_dir.join(format!("{}.wav", stem));
    let cmd = app.shell().sidecar("ffmpeg")
        .map_err(|e| anyhow::anyhow!("ffmpeg sidecar not found: {}", e))?;
    let out = cmd.args(["-y", "-i", audio_path, "-ar", "16000", "-ac", "1", "-sample_fmt", "s16", wav_path.to_str().unwrap_or("")])
        .output().await.map_err(|e| anyhow::anyhow!("FFmpeg failed: {}", e))?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(anyhow::anyhow!("FFmpeg failed: {}", stderr));
    }
    Ok(wav_path.to_string_lossy().to_string())
}

pub async fn run_asr(
    app: &AppHandle, wav_path: &str, progress: impl Fn(&str, f64, &str) + Send + 'static,
) -> Result<String, anyhow::Error> {
    let models_root = {
        let resource_dir = app.path().resource_dir()
            .map_err(|e| anyhow::anyhow!("resource_dir error: {}", e))?;
        let path = resource_dir.join("models");
        if path.exists() {
            path
        } else {
            // dev mode fallback: look in src-tauri/resources/
            let dev_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("resources").join("models");
            if dev_path.exists() { dev_path } else { path }
        }
    };
    if !models_root.exists() {
        return Err(anyhow::anyhow!("ASR model directory not found: {}", models_root.display()));
    }
    let mut cmd = app.shell().sidecar("asr_worker")
        .map_err(|e| anyhow::anyhow!("asr_worker sidecar not found: {}", e))?;
    cmd = cmd.args(["--wav", wav_path, "--model", "paraformer", "--models-dir", models_root.to_str().unwrap_or("")]);
    let out = cmd.output().await.map_err(|e| anyhow::anyhow!("ASR failed: {}", e))?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(anyhow::anyhow!("ASR failed: {}", stderr));
    }
    let stdout = String::from_utf8(out.stdout)?;
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

pub async fn refine_transcript(api_url: &str, api_key: &str, model: &str, transcript: &str) -> Result<String, anyhow::Error> {
    let api_url = if api_url.contains("/chat/completions") { api_url.to_string() } else if api_url.ends_with("/") { format!("{}v1/chat/completions", api_url) } else { format!("{}/v1/chat/completions", api_url) };
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| anyhow::anyhow!("refine client build error: {}", e))?;
    let prompt = "Please correct any speech recognition errors in the following transcript. Fix misrecognized words, add proper punctuation, and correct formatting. Keep the original meaning and style. Output only the corrected transcript, no explanations.";
    let mut req = client.post(&api_url).json(&serde_json::json!({"model": model, "messages": [{"role": "system", "content": prompt}, {"role": "user", "content": transcript}], "temperature": 0.2}));
    if !api_key.is_empty() { req = req.header("Authorization", format!("Bearer {}", api_key)); }
    let resp = req.send().await?;
    if !resp.status().is_success() { let s = resp.status(); let t = resp.text().await.unwrap_or_default(); return Err(anyhow::anyhow!("Refine API error {}: {}", s, t)); }
    let json: Value = resp.json().await?;
    let content = json["choices"][0]["message"]["content"].as_str().unwrap_or("").trim().to_string();
    if content.is_empty() { return Err(anyhow::anyhow!("Empty refine response")); }
    Ok(content)
}

pub async fn extract_insights(api_url: &str, api_key: &str, model: &str, prompt: &str, transcript: &str, title: &str) -> Result<(InsightResult, String), anyhow::Error> {
    let api_url = if api_url.contains("/chat/completions") { api_url.to_string() } else if api_url.ends_with("/") { format!("{}v1/chat/completions", api_url) } else { format!("{}/v1/chat/completions", api_url) };
    let client = reqwest::Client::new();
    let user_content = format!("Video title: {}\n\nTranscript:\n{}", title, transcript);
    let mut req = client.post(&api_url).json(&serde_json::json!({"model": model, "messages": [{"role": "system", "content": prompt}, {"role": "user", "content": user_content}], "temperature": 0.3}));
    if !api_key.is_empty() { req = req.header("Authorization", format!("Bearer {}", api_key)); }
    let resp = req.send().await?;
    if !resp.status().is_success() { let s = resp.status(); let t = resp.text().await.unwrap_or_default(); return Err(anyhow::anyhow!("AI API error {}: {}", s, t)); }
    let json: Value = resp.json().await?;
    let content = json["choices"][0]["message"]["content"].as_str().unwrap_or("").trim();
    let content = if content.starts_with("```json") { content.strip_prefix("```json").and_then(|s| s.strip_suffix("```")).unwrap_or(content).trim() } else if content.starts_with("```") { content.strip_prefix("```").and_then(|s| s.strip_suffix("```")).unwrap_or(content).trim() } else { content };
    let raw = content.to_string();
    Ok((serde_json::from_str::<InsightResult>(content).unwrap_or_else(|_| {
        serde_json::from_str::<Value>(content).map(|v| InsightResult { summary: v["summary"].as_str().unwrap_or("").to_string(), key_points: v["key_points"].as_array().map(|a| a.iter().filter_map(|i| i.as_str().map(|s| s.to_string())).collect()).unwrap_or_default(), tags: v["tags"].as_array().map(|a| a.iter().filter_map(|i| i.as_str().map(|s| s.to_string())).collect()).unwrap_or_default() }).unwrap_or(InsightResult { summary: content.to_string(), key_points: vec![], tags: vec![] })
    }), raw))
}

pub async fn fetch_models(api_url: &str, api_key: &str) -> Result<Vec<String>, anyhow::Error> {
    let base = api_url.trim_end_matches("/chat/completions").trim_end_matches('/');
    let models_url = format!("{}/models", base);
    let client = reqwest::Client::new();
    let mut req = client.get(&models_url);
    if !api_key.is_empty() { req = req.header("Authorization", format!("Bearer {}", api_key)); }
    let resp = req.send().await?;
    if !resp.status().is_success() { let s = resp.status(); let t = resp.text().await.unwrap_or_default(); return Err(anyhow::anyhow!("API error {}: {}", s, t)); }
    let json: Value = resp.json().await?;
    let models: Vec<String> = json["data"].as_array().map(|a| a.iter().filter_map(|m| m["id"].as_str().map(|s| s.to_string())).collect()).unwrap_or_default();
    if models.is_empty() { return Err(anyhow::anyhow!("No models found")); }
    Ok(models)
}
