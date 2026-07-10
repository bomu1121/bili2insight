use crate::{VideoInfo, InsightResult};
use std::path::{Path, PathBuf};
use std::process::Command;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use serde_json::Value;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub async fn download_bili_audio(
    url: &str,
    output_dir: &Path,
    proxy: Option<&str>,
    progress: impl Fn(&str, f64, &str) + Send + 'static,
) -> Result<(VideoInfo, String), anyhow::Error> {
    let worker_path = find_worker("worker/bili_worker.py")?;

    let mut cmd = Command::new("python");
    cmd.arg(&worker_path)
        .arg("--url").arg(url)
        .arg("--output-dir").arg(output_dir.to_string_lossy().as_ref());

    if let Some(p) = proxy {
        cmd.arg("--proxy").arg(p);
    }

    #[cfg(target_os = "windows")]
    { cmd.creation_flags(CREATE_NO_WINDOW); }

    let output = cmd.output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow::anyhow!("Worker failed: {}", stderr));
    }

    let stdout = String::from_utf8(output.stdout)?;
    let mut video_info: Option<VideoInfo> = None;
    let mut audio_path: Option<String> = None;

    for line in stdout.lines() {
        if let Ok(val) = serde_json::from_str::<Value>(line) {
            match val["type"].as_str() {
                Some("progress") => {
                    let stage = val["stage"].as_str().unwrap_or("");
                    let msg = val["message"].as_str().unwrap_or("");
                    progress(stage, 0.1, msg);
                }
                Some("result") => {
                    if let Some(vi) = val["video_info"].as_object() {
                        video_info = Some(VideoInfo {
                            bvid: vi["bvid"].as_str().unwrap_or("").to_string(),
                            title: vi["title"].as_str().unwrap_or("").to_string(),
                            description: vi["description"].as_str().unwrap_or("").to_string(),
                            duration: vi["duration"].as_i64().unwrap_or(0),
                            cover: vi["cover"].as_str().unwrap_or("").to_string(),
                            uploader: vi["uploader"].as_str().unwrap_or("").to_string(),
                            uploader_uid: vi["uploader_uid"].as_i64().unwrap_or(0),
                            pubdate: vi["pubdate"].as_i64().unwrap_or(0),
                        });
                    }
                    audio_path = val["audio_path"].as_str().map(|s| s.to_string());
                }
                Some("error") => {
                    return Err(anyhow::anyhow!("{}", val["message"].as_str().unwrap_or("unknown")));
                }
                _ => {}
            }
        }
    }

    let vi = video_info.ok_or_else(|| anyhow::anyhow!("No video info in worker output"))?;
    let ap = audio_path.ok_or_else(|| anyhow::anyhow!("No audio path in worker output"))?;
    Ok((vi, ap))
}

pub async fn extract_audio_wav(
    audio_path: &str,
    output_dir: &Path,
) -> Result<String, anyhow::Error> {
    let input = Path::new(audio_path);
    let stem = input.file_stem().unwrap_or_default().to_string_lossy();
    let wav_path = output_dir.join(format!("{}.wav", stem));

    let mut cmd = Command::new("ffmpeg");
    cmd.args([
        "-y",
        "-i", audio_path,
        "-ar", "16000",
        "-ac", "1",
        "-sample_fmt", "s16",
        wav_path.to_string_lossy().as_ref(),
    ]);

    #[cfg(target_os = "windows")]
    { cmd.creation_flags(CREATE_NO_WINDOW); }

    let output = cmd.output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow::anyhow!("FFmpeg failed: {}", stderr));
    }

    Ok(wav_path.to_string_lossy().to_string())
}

pub async fn run_asr(
    wav_path: &str,
    resource_dir: &str,
    progress: impl Fn(&str, f64, &str) + Send + 'static,
) -> Result<String, anyhow::Error> {
    let worker_path = find_worker("worker/asr_worker.py")?;
    let models_dir = Path::new(resource_dir).join("models");
    let models_dir_str = models_dir.to_string_lossy().to_string();

    let mut cmd = Command::new("python");
    cmd.arg(&worker_path)
        .arg("--wav").arg(wav_path)
        .arg("--model").arg("paraformer")
        .arg("--models-dir").arg(&models_dir_str);

    #[cfg(target_os = "windows")]
    { cmd.creation_flags(CREATE_NO_WINDOW); }

    let output = cmd.output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow::anyhow!("ASR failed: {}", stderr));
    }

    let stdout = String::from_utf8(output.stdout)?;
    let mut full_text = String::new();

    for line in stdout.lines() {
        if let Ok(val) = serde_json::from_str::<Value>(line) {
            match val["type"].as_str() {
                Some("progress") => {
                    let msg = val["message"].as_str().unwrap_or("");
                    progress("asr", 0.5, msg);
                }
                Some("result") => {
                    if let Some(text) = val["text"].as_str() {
                        full_text = text.to_string();
                    }
                }
                Some("error") => {
                    return Err(anyhow::anyhow!("{}", val["message"].as_str().unwrap_or("unknown")));
                }
                _ => {}
            }
        }
    }

    if full_text.is_empty() {
        return Err(anyhow::anyhow!("No transcription result"));
    }

    Ok(full_text)
}

pub async fn extract_insights(
    api_url: &str,
    api_key: &str,
    model: &str,
    prompt: &str,
    transcript: &str,
    title: &str,
) -> Result<InsightResult, anyhow::Error> {
    let client = reqwest::Client::new();

    let user_content = format!(
        "视频标题：{}\n\n视频转录文本：\n{}",
        title, transcript
    );

    let mut req = client.post(api_url).json(&serde_json::json!({
        "model": model,
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": user_content}
        ],
        "temperature": 0.3,
    }));

    if !api_key.is_empty() {
        req = req.header("Authorization", format!("Bearer {}", api_key));
    }

    let resp = req.send().await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(anyhow::anyhow!("AI API error {}: {}", status, text));
    }

    let json: Value = resp.json().await?;
    let content = json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("");

    let content = content.trim();
    let content = if content.starts_with("```json") {
        content.strip_prefix("```json").and_then(|s| s.strip_suffix("```")).unwrap_or(content).trim()
    } else if content.starts_with("```") {
        content.strip_prefix("```").and_then(|s| s.strip_suffix("```")).unwrap_or(content).trim()
    } else {
        content
    };

    let insight: InsightResult = if let Ok(parsed) = serde_json::from_str::<InsightResult>(content) {
        parsed
    } else if let Ok(v) = serde_json::from_str::<Value>(content) {
        InsightResult {
            summary: v["summary"].as_str().unwrap_or("").to_string(),
            key_points: v["key_points"].as_array()
                .map(|a| a.iter().filter_map(|i| i.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default(),
            tags: v["tags"].as_array()
                .map(|a| a.iter().filter_map(|i| i.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default(),
        }
    } else {
        InsightResult {
            summary: content.to_string(),
            key_points: vec![],
            tags: vec![],
        }
    };

    Ok(insight)
}

fn find_worker(rel_path: &str) -> Result<String, anyhow::Error> {
    let exe_dir = std::env::current_exe()
        .ok().and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_default();

    let candidates = vec![
        exe_dir.join(rel_path),
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().map(|p| p.join(rel_path)).unwrap_or_default(),
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join(rel_path),
    ];

    for c in &candidates {
        if c.exists() {
            return Ok(c.to_string_lossy().to_string());
        }
    }

    Err(anyhow::anyhow!("Worker not found: {}. Searched: {:?}", rel_path, candidates))
}
