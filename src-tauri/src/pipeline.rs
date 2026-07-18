use crate::{VideoInfo, VideoPageInfo};
use crate::InsightResult;
use std::path::Path;
use tauri::{AppHandle, Manager};
use std::sync::atomic::{AtomicBool, Ordering};
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

async fn run_asr_sherpa(
    app: &AppHandle, wav_path: &str,
    progress: impl Fn(&str, f64, &str) + Send + 'static,
) -> Result<String, anyhow::Error> {
    let models_root = get_models_root(app)?;
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
    for line in stdout.lines() {
        if let Ok(val) = serde_json::from_str::<Value>(line) {
            match val["type"].as_str() {
                Some("progress") => { let m = val["message"].as_str().unwrap_or(""); progress("asr", 0.5, m); }
                Some("error") => return Err(anyhow::anyhow!("{}", val["message"].as_str().unwrap_or("unknown"))),
                _ => {}
            }
        }
    }
    parse_asr_output(&stdout)
}

async fn run_asr_api(
    app: &AppHandle, wav_path: &str,
    api_url: &str, api_key: Option<&str>,
    progress: impl Fn(&str, f64, &str) + Send + 'static,
) -> Result<String, anyhow::Error> {
    let mut cmd = app.shell().sidecar("asr_worker")
        .map_err(|e| anyhow::anyhow!("asr_worker sidecar not found: {}", e))?;
    cmd = cmd.args([
        "--backend", "api",
        "--wav", wav_path,
        "--api-url", api_url,
    ]);
    if let Some(key) = api_key {
        cmd = cmd.args(["--api-key", key]);
    }
    let out = cmd.output().await.map_err(|e| anyhow::anyhow!("ASR API failed: {}", e))?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        let stdout = String::from_utf8_lossy(&out.stdout);
        return Err(anyhow::anyhow!("ASR API failed: stdout={}, stderr={}", stdout, stderr));
    }
    let stdout = String::from_utf8(out.stdout)?;
    for line in stdout.lines() {
        if let Ok(val) = serde_json::from_str::<Value>(line) {
            match val["type"].as_str() {
                Some("progress") => { let m = val["message"].as_str().unwrap_or(""); progress("asr", 0.5, m); }
                Some("error") => return Err(anyhow::anyhow!("{}", val["message"].as_str().unwrap_or("unknown"))),
                _ => {}
            }
        }
    }
    parse_asr_output(&stdout)
}

pub async fn run_asr(
    app: &AppHandle, wav_path: &str,
    asr_model: &str, asr_api_url: Option<&str>, asr_api_key: Option<&str>,
    progress: impl Fn(&str, f64, &str) + Send + 'static,
) -> Result<String, anyhow::Error> {
    match asr_model {
        "mimo" | "mimo-api" => {
            let url = asr_api_url.ok_or_else(|| anyhow::anyhow!("ASR API URL required for MiMo backend"))?;
            run_asr_api(app, wav_path, url, asr_api_key, progress).await
        }
        _ => run_asr_sherpa_daemon(app, wav_path, progress).await,
    }
}

fn parse_asr_output(stdout: &str) -> Result<String, anyhow::Error> {
    let mut full_text = String::new();
    for line in stdout.lines() {
        if let Ok(val) = serde_json::from_str::<Value>(line) {
            match val["type"].as_str() {
                Some("result") => { if let Some(t) = val["text"].as_str() { full_text = t.to_string(); } }
                Some("error") => return Err(anyhow::anyhow!("{}", val["message"].as_str().unwrap_or("unknown"))),
                _ => {}
            }
        }
    }
    if full_text.is_empty() { return Err(anyhow::anyhow!("No transcription result")); }
    Ok(full_text)
}
// --- ASR Daemon (long-lived process, model loaded once) ---
const ASR_DAEMON_PORT: u16 = 9876;
static ASR_DAEMON_STARTED: AtomicBool = AtomicBool::new(false);

async fn ensure_asr_daemon(app: &AppHandle) -> Result<(), anyhow::Error> {
    // Quick health check if daemon was previously started
    if ASR_DAEMON_STARTED.load(Ordering::Relaxed) {
        let client = app.state::<crate::AppState>().http_client.clone();
        if let Ok(resp) = client.get(format!("http://127.0.0.1:{}/health", ASR_DAEMON_PORT)).send().await {
            if resp.status().is_success() {
                return Ok(());
            }
        }
        // Daemon died, will restart
        ASR_DAEMON_STARTED.store(false, Ordering::Relaxed);
    }

    let models_root = get_models_root(app)?;
    if !models_root.exists() {
        return Err(anyhow::anyhow!("ASR model directory not found: {}", models_root.display()));
    }

    let (mut rx, _child) = app.shell().sidecar("asr_worker")
        .map_err(|e| anyhow::anyhow!("asr_worker sidecar not found: {}", e))?
        .args(["--daemon", "--model", "paraformer", "--models-dir", models_root.to_str().unwrap_or("")])
        .spawn()
        .map_err(|e| anyhow::anyhow!("Failed to spawn ASR daemon: {}", e))?;

    // The _child is intentionally leaked - the daemon runs independently.
    // We signal shutdown via HTTP /shutdown endpoint.
    std::mem::forget(_child);

    // Wait for "ready" message from daemon stdout (30s timeout)
    for _ in 0..30 {
        if let Some(event) = rx.recv().await {
            if let tauri_plugin_shell::process::CommandEvent::Stdout(line) = event {
                let line_str = String::from_utf8_lossy(&line);
                if line_str.contains("\"ready\"") {
                    ASR_DAEMON_STARTED.store(true, Ordering::Relaxed);
                    println!("[asr-daemon] Ready on port {}", ASR_DAEMON_PORT);
                    return Ok(());
                }
            }
        } else {
            break;
        }
    }
    Err(anyhow::anyhow!("ASR daemon failed to start within 30s"))
}

pub async fn shutdown_asr_daemon(app: &AppHandle) {
    if ASR_DAEMON_STARTED.swap(false, Ordering::Relaxed) {
        let client = app.state::<crate::AppState>().http_client.clone();
        let _ = client.post(format!("http://127.0.0.1:{}/shutdown", ASR_DAEMON_PORT)).send().await;
        println!("[asr-daemon] Shut down");
    }
}

async fn run_asr_sherpa_daemon(
    app: &AppHandle, wav_path: &str,
    progress: impl Fn(&str, f64, &str) + Send + 'static,
) -> Result<String, anyhow::Error> {
    ensure_asr_daemon(app).await?;
    let client = app.state::<crate::AppState>().http_client.clone();

    let resp = client
        .post(format!("http://127.0.0.1:{}/recognize", ASR_DAEMON_PORT))
        .json(&serde_json::json!({"wav_path": wav_path}))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("ASR daemon request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(anyhow::anyhow!("ASR daemon error {}: {}", status, body));
    }

    let json: Value = resp.json().await
        .map_err(|e| anyhow::anyhow!("ASR daemon response parse error: {}", e))?;

    let text = json["text"].as_str().unwrap_or("").to_string();
    if text.is_empty() && json.get("error").is_some() {
        return Err(anyhow::anyhow!("{}", json["error"].as_str().unwrap_or("unknown")));
    }
    progress("asr", 0.75, "Speech recognition complete");
    Ok(text)
}


fn get_models_root(app: &AppHandle) -> Result<std::path::PathBuf, anyhow::Error> {
    let resource_dir = app.path().resource_dir()
        .map_err(|e| anyhow::anyhow!("resource_dir error: {}", e))?;
    let path = resource_dir.join("models");
    if path.exists() {
        Ok(path)
    } else {
        // dev mode fallback: look in src-tauri/resources/
        let dev_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources").join("models");
        if dev_path.exists() { Ok(dev_path) } else { Ok(path) }
    }
}

pub async fn refine_transcript(client: &reqwest::Client, api_url: &str, api_key: &str, model: &str, transcript: &str) -> Result<String, anyhow::Error> {
    let api_url = if api_url.contains("/chat/completions") { api_url.to_string() } else if api_url.ends_with("/") { format!("{}v1/chat/completions", api_url) } else { format!("{}/v1/chat/completions", api_url) };
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

pub async fn extract_insights(client: &reqwest::Client, api_url: &str, api_key: &str, model: &str, prompt: &str, transcript: &str, title: &str) -> Result<(InsightResult, String), anyhow::Error> {
    let api_url = if api_url.contains("/chat/completions") { api_url.to_string() } else if api_url.ends_with("/") { format!("{}v1/chat/completions", api_url) } else { format!("{}/v1/chat/completions", api_url) };
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

pub async fn fetch_models(client: &reqwest::Client, api_url: &str, api_key: &str) -> Result<Vec<String>, anyhow::Error> {
    let base = api_url.trim_end_matches("/chat/completions").trim_end_matches('/');
    let models_url = format!("{}/models", base);
    let mut req = client.get(&models_url);
    if !api_key.is_empty() { req = req.header("Authorization", format!("Bearer {}", api_key)); }
    let resp = req.send().await?;
    if !resp.status().is_success() { let s = resp.status(); let t = resp.text().await.unwrap_or_default(); return Err(anyhow::anyhow!("API error {}: {}", s, t)); }
    let json: Value = resp.json().await?;
    let models: Vec<String> = json["data"].as_array().map(|a| a.iter().filter_map(|m| m["id"].as_str().map(|s| s.to_string())).collect()).unwrap_or_default();
    if models.is_empty() { return Err(anyhow::anyhow!("No models found")); }
    Ok(models)
}

// --- Login & Favorites mode runner ---
async fn run_bili_mode(app: &AppHandle, mode: &str, extra_args: &[(&str, &str)], proxy: Option<&str>) -> Result<serde_json::Value, anyhow::Error> {
    let mut cmd = app.shell().sidecar("bili_worker")
        .map_err(|e| anyhow::anyhow!("bili_worker sidecar not found: {}", e))?;
    cmd = cmd.args(["--mode", mode]);
    for (k, v) in extra_args {
        cmd = cmd.args([k, v]);
    }
    if let Some(p) = proxy {
        cmd = cmd.args(["--proxy", p]);
    }
    println!("  [sidecar/mode] spawning bili_worker mode={}", mode);
    let out = match tokio::time::timeout(std::time::Duration::from_secs(60), cmd.output()).await {
        Ok(Ok(out)) => {
            println!("  [sidecar/mode] process exited, status={:?} stdout_len={}", out.status, out.stdout.len());
            out
        }
        Ok(Err(e)) => return Err(anyhow::anyhow!("bili_worker mode {} failed: {}", mode, e)),
        Err(_) => return Err(anyhow::anyhow!("bili_worker mode {} timed out", mode)),
    };
    if !out.status.success() {
        let stdout = String::from_utf8_lossy(&out.stdout);
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(anyhow::anyhow!("bili_worker mode {} failed: stdout={}, stderr={}", mode, stdout, stderr));
    }
    let stdout = String::from_utf8(out.stdout)?;
    println!("  [sidecar/mode] stdout [{}]: {}", mode, &stdout.chars().take(800).collect::<String>());
    let mut result: Option<serde_json::Value> = None;
    for line in stdout.lines() {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(line) {
            match val["type"].as_str() {
                Some("result") => { println!("  [sidecar/mode] result found: keys={:?}", val.as_object().map(|o| o.keys().collect::<Vec<_>>())); result = Some(val.clone()); }
                Some("error") => return Err(anyhow::anyhow!("{}", val["message"].as_str().unwrap_or("unknown"))),
                Some("progress") => { println!("  [sidecar/mode] progress: {:?}", val.get("message").and_then(|v| v.as_str()).unwrap_or("")); }
                _ => {}
            }
        }
    }
    result.ok_or_else(|| anyhow::anyhow!("No result from bili_worker mode {}", mode))
}

pub async fn qr_generate_flow(app: &AppHandle, proxy: Option<&str>) -> Result<crate::QrGenerateResult, anyhow::Error> {
    let val = run_bili_mode(app, "qr_generate", &[], proxy).await?;
    Ok(serde_json::from_value(val)?)
}

pub async fn qr_poll_flow(app: &AppHandle, qrcode_key: &str, cookies_file: Option<&str>, proxy: Option<&str>) -> Result<crate::QrPollResult, anyhow::Error> {
    let mut args = vec![("--qrcode-key", qrcode_key)];
    let cf_str;
    if let Some(cf) = cookies_file {
        cf_str = cf.to_string();
        args.push(("--cookies-file", &cf_str));
    }
    let val = run_bili_mode(app, "qr_poll", &args, proxy).await?;
    Ok(serde_json::from_value(val)?)
}

pub async fn check_login_flow(app: &AppHandle, cookies_json: &str, proxy: Option<&str>) -> Result<crate::LoginCheckResult, anyhow::Error> {
    let val = run_bili_mode(app, "check_login", &[("--cookies", cookies_json)], proxy).await?;
    Ok(serde_json::from_value(val)?)
}

pub async fn fav_get_folders_flow(app: &AppHandle, cookies_json: &str, proxy: Option<&str>) -> Result<crate::FavFoldersResult, anyhow::Error> {
    let val = run_bili_mode(app, "fav_folders", &[("--cookies", cookies_json)], proxy).await?;
    Ok(serde_json::from_value(val)?)
}

pub async fn fav_get_videos_flow(app: &AppHandle, cookies_json: &str, folder_id: i64, page: i64, proxy: Option<&str>) -> Result<crate::FavVideosResult, anyhow::Error> {
    let fid = folder_id.to_string();
    let pg = page.to_string();
    let val = run_bili_mode(app, "fav_videos", &[("--cookies", cookies_json), ("--folder-id", &fid), ("--page", &pg)], proxy).await?;
    Ok(serde_json::from_value(val)?)
}

pub async fn fav_get_follow_list_flow(app: &AppHandle, cookies_json: &str, follow_type: i64, page: i64, proxy: Option<&str>) -> Result<serde_json::Value, anyhow::Error> {
    let ft = follow_type.to_string();
    let pg = page.to_string();
    run_bili_mode(app, "fav_follow_list", &[("--cookies", cookies_json), ("--follow-type", &ft), ("--page", &pg)], proxy).await
}

pub async fn fav_collected_videos_flow(app: &AppHandle, cookies_json: &str, folder_id: i64, mid: i64, page: i64, proxy: Option<&str>) -> Result<serde_json::Value, anyhow::Error> {
    let fid = folder_id.to_string();
    let m = mid.to_string();
    let pg = page.to_string();
    run_bili_mode(app, "fav_collected_videos", &[("--cookies", cookies_json), ("--folder-id", &fid), ("--mid", &m), ("--page", &pg)], proxy).await
}

pub async fn fav_watch_later_flow(app: &AppHandle, cookies_json: &str, page: i64, proxy: Option<&str>) -> Result<serde_json::Value, anyhow::Error> {
    let pg = page.to_string();
    run_bili_mode(app, "fav_watch_later", &[("--cookies", cookies_json), ("--page", &pg)], proxy).await
}

pub async fn fav_history_flow(app: &AppHandle, cookies_json: &str, page: i64, proxy: Option<&str>) -> Result<serde_json::Value, anyhow::Error> {
    let pg = page.to_string();
    run_bili_mode(app, "fav_history", &[("--cookies", cookies_json), ("--page", &pg)], proxy).await
}

pub async fn sms_captcha_flow(app: &AppHandle, proxy: Option<&str>) -> Result<serde_json::Value, anyhow::Error> {
    run_bili_mode(app, "sms_captcha", &[], proxy).await
}

pub async fn sms_send_flow(app: &AppHandle, cid: &str, tel: &str, token: &str, challenge: &str, validate: &str, seccode: &str, proxy: Option<&str>) -> Result<serde_json::Value, anyhow::Error> {
    let packed = format!("{},{},{},{},{},{}", cid, tel, token, challenge, validate, seccode);
    run_bili_mode(app, "sms_send", &[("--qrcode-key", &packed)], proxy).await
}

pub async fn sms_login_flow(app: &AppHandle, cid: &str, tel: &str, code: &str, captcha_key: &str, cookies_file: Option<&str>, proxy: Option<&str>) -> Result<serde_json::Value, anyhow::Error> {
    let packed = format!("{},{},{},{}", cid, tel, code, captcha_key);
    let mut args = vec![("--qrcode-key", packed.as_str())];
    let cf;
    if let Some(cf_val) = cookies_file {
        cf = cf_val.to_string();
        args.push(("--cookies-file", &cf));
    }
    run_bili_mode(app, "sms_login", &args, proxy).await
}
