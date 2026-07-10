export interface VideoInfo {
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
}

export interface PipelineProgress {
  stage: string;
  progress: number;
  message: string;
}
