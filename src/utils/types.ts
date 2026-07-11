export interface VideoInfo {
  cid: number;
  pages?: PageInfo[];
  bvid: string;
  title: string;
  description: string;
  duration: number;
  cover: string;
  uploader: string;
  uploader_uid: number;
  pubdate: number;
}

export interface InsightResult {
  summary: string;
  key_points: string[];
  tags: string[];
}

export interface PipelineResult {
  raw_transcript: string;
  video_info: VideoInfo;
  transcript: string;
  insights: InsightResult;
  markdown: string;
  ai_request: string;
  ai_raw_response: string;
}

export interface PipelineProgress {
  stage: string;
  progress: number;
  message: string;
}

export interface PageInfo {
  page: number;
  part: string;
  cid: number;
  duration: number;
}

export interface TaskState {
  pageKey: number;
  pageInfo: PageInfo;
  status: "pending" | "running" | "done" | "error";
  progress: number;
  stageLabel: string;
  message: string;
  result: PipelineResult | null;
  error: string;
}

export interface QueueItem {
  id: string;
  source: "url" | "fav" | "local";
  url?: string;
  pageInfo: PageInfo;
  status: "pending" | "running" | "done" | "error";
  progress: number;
  stageLabel: string;
  message: string;
  result: PipelineResult | null;
  error: string;
  createdAt: number;
}