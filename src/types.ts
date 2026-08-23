export type VideoResolution = 'original' | '480' | '720' | '1080' | '2k' | '4k' | '8k';
export type EncodeSpeed = 'slow' | 'medium' | 'fast' | 'ultra-fast';
export type MediaType = 'any' | 'video' | 'audio' | 'image' | 'text';
export type TrackColor = 'indigo' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'fuchsia';

export interface ClipTransform {
  x: number; // percentage from center (50 = centered, 0 = left edge, 100 = right edge)
  y: number; // percentage from center (50 = centered, 0 = top edge, 100 = bottom edge)
  scale: number; // 1.0 is default size (0.1 to 3.0)
  rotation?: number; // 0, 90, 180, 270 deg
  opacity?: number; // 0 to 1
  blur?: number; // in pixels (e.g. 0 to 50)
  widthPct?: number; // optional custom width percentage
  heightPct?: number;
}

export interface TimelineClip {
  id: string;
  name: string;
  mediaType: MediaType;
  startTime: number;
  endTime: number;
  duration?: number;
  sourceStartTime?: number;
  sourceEndTime?: number;
  fileDuration?: number;
  file?: File;
  fileName?: string;
  previewUrl?: string;
  color?: TrackColor;
  transform?: ClipTransform;
}

export interface TimelineTrackData {
  id: string;
  name: string;
  mediaType: MediaType;
  color: TrackColor;
  clips: TimelineClip[];
  muted: boolean;
  locked: boolean;
  hidden: boolean;
  volume?: number;
}

export interface EditSettings {
  startTime: number;
  endTime: number;
  duration: number;
  filter: 'none' | 'grayscale' | 'sepia' | 'negative' | 'brightness' | 'vignette' | 'blur';
  brightness: number; // 0.5 to 2.0
  contrast: number; // 0.5 to 2.0
  speed: number; // 0.5, 1, 1.5, 2
  rotation: number; // 0, 90, 180, 270
  flipH: boolean;
  flipV: boolean;
  cropAspect: 'original' | '16:9' | '4:3' | '1:1' | '4:5' | '9:16' | '21:9' | 'free';
  freeCropRect?: { x: number; y: number; width: number; height: number }; // 0 to 1 normalized coordinates
  watermarkText: string;
  watermarkPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  watermarkColor: string;
  watermarkSize: number;
  volume: number; // 0 to 2
  muteAudio: boolean;
  outputFormat: 'mp4' | 'webm' | 'gif' | 'mp3' | 'mkv';
  encodeMode?: boolean; // When true, uses WebCodecs API Hardware Acceleration Pipeline
  videoCodec?: 'avc' | 'hevc' | 'vp9' | 'av1';
  audioCodec?: 'aac' | 'opus' | 'flac' | 'pcm-s16le' | 'mp3';
  audioBitrate?: number; // kbps: 64, 96, 128, 192, 256, 320
  videoQuality?: 'low' | 'medium' | 'high' | 'very-high';
  resolution?: VideoResolution;
  encodeSpeed?: EncodeSpeed;
  fps?: number; // 30, 60, 120 or custom fps (1 - 240)
}

export type ActiveTab = 'trim' | 'filters' | 'adjust' | 'text' | 'audio' | 'export';

export interface SampleVideo {
  id: string;
  name: string;
  url: string;
  duration: number;
  thumbnail: string;
}

