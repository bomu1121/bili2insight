mod commands;
mod pipeline;
mod export;

#[derive(Clone, serde::Serialize)]
struct PipelineProgress {
    stage: String,
    progress: f64,
    message: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VideoInfo {
    pub bvid: String,
    pub title: String,
    pub description: String,
    pub duration: i64,
    pub cover: String,
    pub uploader: String,
    pub uploader_uid: i64,
    pub pubdate: i64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct InsightResult {
    pub summary: String,
    pub key_points: Vec<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PipelineResult {
    pub video_info: VideoInfo,
    pub transcript: String,
    pub insights: InsightResult,
    pub markdown: String,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            commands::preview_video,
            commands::run_pipeline,
            commands::save_result,
            commands::save_result_to_file,
        ])
        .setup(|app| {
            let _app_handle = app.handle().clone();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
