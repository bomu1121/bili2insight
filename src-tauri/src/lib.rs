mod commands;
mod pipeline;
mod export;
mod history;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct QrGenerateResult {
    pub qr_url: String,
    pub qrcode_key: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct QrPollResult {
    pub status_code: i64,
    pub message: String,
    pub logged_in: bool,
    pub cookies: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LoginCheckResult {
    pub logged_in: bool,
    pub uname: String,
    pub uid: i64,
    pub face: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FavFolder {
    pub id: i64,
    pub title: String,
    pub count: i64,
    pub mid: i64,
    #[serde(default)]
    pub collected: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FavFoldersResult {
    pub uid: i64,
    pub uname: String,
    pub face: String,
    pub folders: Vec<FavFolder>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FavVideo {
    pub bvid: String,
    pub title: String,
    pub cover: String,
    pub duration: i64,
    pub uploader: String,
    pub uploader_uid: i64,
    pub cid: i64,
    pub pubdate: i64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FavVideosResult {
    pub folder_id: i64,
    pub page: i64,
    pub total: i64,
    pub total_pages: i64,
    pub videos: Vec<FavVideo>,
}

#[derive(Clone, serde::Serialize)]
struct PipelineProgress {
    stage: String,
    progress: f64,
    message: String,
    queue_item_id: Option<String>,
}



#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VideoPageInfo {
    pub page: i64,
    pub part: String,
    pub cid: i64,
    pub duration: i64,
}
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VideoInfo {
    pub cid: i64,
    pub bvid: String,
    pub title: String,
    pub description: String,
    pub duration: i64,
    pub cover: String,
    pub uploader: String,
    pub uploader_uid: i64,
    pub pubdate: i64,
    pub pages: Vec<VideoPageInfo>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct InsightResult {
    pub summary: String,
    pub key_points: Vec<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PipelineResult {
    pub raw_transcript: String,
    pub video_info: VideoInfo,
    pub transcript: String,
    pub insights: InsightResult,
    pub markdown: String,
    pub ai_request: String,
    pub ai_raw_response: String,
}

pub struct AppState {
    pub http_client: reqwest::Client,
}

use tauri::Manager;

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
            commands::fetch_ai_models,
           commands::download_batch, commands::run_pipeline,
            commands::run_pipeline_local,
           commands::save_result,
            commands::save_result_to_file,
            commands::qr_generate,
            commands::qr_poll,
            commands::check_login,
            commands::fav_get_folders,
            commands::fav_get_videos,
            commands::fav_watch_later,
            commands::fav_collected_videos,
            commands::fav_history,
            commands::fav_get_follow_list,
            commands::get_cookies_path,
           commands::read_cookies_file,
            commands::clear_cookies_file,
           commands::sms_captcha,
           commands::sms_send,
           commands::sms_login,
            commands::history_toggle_star,
            commands::history_list,
            commands::history_get_result,
            commands::history_delete,
            commands::history_clear,
            commands::history_add,
       ])
       .setup(|app| {
           let http_client = reqwest::Client::builder()
               .timeout(std::time::Duration::from_secs(120))
               .pool_max_idle_per_host(4)
               .build()
               .expect("Failed to create HTTP client");
           app.manage(AppState { http_client });
            let history_data_dir = app.path().app_data_dir()
                .map_err(|e| format!("app_data_dir: {}", e))
                .unwrap_or_default()
                .join("history");
            app.manage(crate::history::HistoryState(
                std::sync::Mutex::new(crate::history::HistoryStore::load(history_data_dir))
            ));
           Ok(())
       })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
