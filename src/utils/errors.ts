/** Error codes matching the Rust ErrorCode enum. */
export type ErrorCode =
  | "network_error"
  | "auth_expired"
  | "config_missing"
  | "asr_failed"
  | "ai_api_error"
  | "bili_api_error"
  | "sidecar_not_found"
  | "sidecar_timeout"
  | "ffmpeg_error"
  | "io_error"
  | "parse_error"
  | "unknown";

/** Structured error returned by Rust Tauri commands. */
export interface AppError {
  code: ErrorCode;
  message: string;
  detail?: string;
}

/** User-friendly messages keyed by error code. */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  network_error: "网络连接失败，请检查网络或代理设置",
  auth_expired: "B站登录已过期，请重新扫码登录",
  config_missing: "缺少必要配置，请检查API密钥和模型设置",
  asr_failed: "语音识别失败，请检查ASR模型或API配置",
  ai_api_error: "AI API 调用失败，请检查API密钥和模型名称",
  bili_api_error: "B站API请求失败，请检查视频链接是否正确",
  sidecar_not_found: "处理组件未找到，请运行 python scripts/setup_dev.py",
  sidecar_timeout: "处理超时，请检查网络或重试",
  ffmpeg_error: "音频格式转换失败，请确认FFmpeg已正确安装",
  io_error: "文件读写失败，请检查磁盘空间和权限",
  parse_error: "数据解析失败，请重试",
  unknown: "发生未知错误，请重试",
};

/** Try to parse a caught error as a structured AppError. */
export function parseAppError(e: unknown): AppError {
  if (typeof e === "string") {
    // Tauri wraps the JSON error in a string
    try {
      const parsed = JSON.parse(e);
      if (parsed && typeof parsed.code === "string") {
        return parsed as AppError;
      }
    } catch {
      // Not JSON, treat as raw string
    }
    return { code: "unknown", message: e };
  }
  if (e && typeof e === "object" && "code" in e && typeof (e as AppError).code === "string") {
    return e as AppError;
  }
  return { code: "unknown", message: String(e) };
}

/** Get a user-friendly message from any error. */
export function getUserErrorMessage(e: unknown): string {
  const appErr = parseAppError(e);
  return ERROR_MESSAGES[appErr.code] || appErr.message || "发生未知错误";
}

/** Check if an error represents an expired auth session. */
export function isAuthExpired(e: unknown): boolean {
  return parseAppError(e).code === "auth_expired";
}
