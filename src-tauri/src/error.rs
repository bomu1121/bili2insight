use serde::Serialize;

/// Structured error codes for the application.
/// Each variant maps to a user-facing error category.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    /// Network / HTTP connectivity issues
    NetworkError,
    /// B站 authentication expired (cookies invalid)
    AuthExpired,
    /// Missing required configuration (API key, model path, etc.)
    ConfigMissing,
    /// ASR / speech recognition failed
    AsrFailed,
    /// AI / LLM API returned an error
    AiApiError,
    /// Bilibili API returned an error
    BiliApiError,
    /// Python sidecar binary not found
    SidecarNotFound,
    /// Python sidecar process timed out
    SidecarTimeout,
    /// FFmpeg conversion failed
    FfmpegError,
    /// File I/O error
    IoError,
    /// Data parsing / deserialization error
    ParseError,
    /// Uncategorized / unknown error
    Unknown,
}

/// Structured application error returned by Tauri commands.
#[derive(Debug, Clone, Serialize)]
pub struct AppError {
    pub code: ErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

impl AppError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self { code, message: message.into(), detail: None }
    }

    pub fn with_detail(code: ErrorCode, message: &str, detail: String) -> Self {
        Self { code, message: message.into(), detail: Some(detail) }
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{:?}] {}", self.code, self.message)
    }
}

impl From<anyhow::Error> for AppError {
    fn from(e: anyhow::Error) -> Self {
        let msg = e.to_string();
        let code = classify_error(&msg);
        AppError { code, message: msg, detail: None }
    }
}

impl From<String> for AppError {
    fn from(msg: String) -> Self {
        let code = classify_error(&msg);
        AppError { code, message: msg, detail: None }
    }
}

/// Classify an error message string into an ErrorCode.
/// Used as a fallback when existing error strings are converted.
pub fn classify_error(msg: &str) -> ErrorCode {
    let lower = msg.to_lowercase();
    if lower.contains("timed out") || lower.contains("timeout") {
        ErrorCode::SidecarTimeout
    } else if lower.contains("401") || lower.contains("unauthorized") || lower.contains("expired") {
        ErrorCode::AuthExpired
    } else if lower.contains("cookie") || lower.contains("login") {
        ErrorCode::AuthExpired
    } else if lower.contains("sidecar") || (lower.contains("not found") && lower.contains("worker")) {
        ErrorCode::SidecarNotFound
    } else if lower.contains("asr") || lower.contains("transcri") || lower.contains("speech") {
        ErrorCode::AsrFailed
    } else if lower.contains("ffmpeg") {
        ErrorCode::FfmpegError
    } else if lower.contains("api") || lower.contains("ai ") || lower.contains("llm") {
        ErrorCode::AiApiError
    } else if lower.contains("model") || lower.contains("key ") || lower.contains("config") || lower.contains("missing") {
        ErrorCode::ConfigMissing
    } else if lower.contains("network") || lower.contains("connect") || lower.contains("dns") || lower.contains("refused") {
        ErrorCode::NetworkError
    } else if lower.contains("parse") || lower.contains("json") || lower.contains("deserializ") {
        ErrorCode::ParseError
    } else if lower.contains("io ") || lower.contains("file") || lower.contains("permission") {
        ErrorCode::IoError
    } else if lower.contains("bili") {
        ErrorCode::BiliApiError
    } else {
        ErrorCode::Unknown
    }
}

/// Helper: create an AppError from an error string with automatic classification.
pub fn to_app_error(msg: impl Into<String>) -> AppError {
    let msg = msg.into();
    let code = classify_error(&msg);
    AppError { code, message: msg, detail: None }
}
