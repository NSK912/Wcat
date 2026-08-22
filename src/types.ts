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
  cropAspect: 'original' | '16:9' | '4:3' | '1:1' | '4:5' | '9:16' | '21:9';
  watermarkText: string;
  watermarkPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  watermarkColor: string;
  watermarkSize: number;
  volume: number; // 0 to 2
  muteAudio: boolean;
  outputFormat: 'mp4' | 'webm' | 'gif' | 'mp3';
  encodeMode?: boolean; // When true, uses WebCodecs API Hardware Acceleration Pipeline
  videoCodec?: 'avc' | 'hevc' | 'vp9' | 'av1';
  audioCodec?: 'aac' | 'opus';
  videoQuality?: 'low' | 'medium' | 'high' | 'very-high';
}

export type ActiveTab = 'trim' | 'filters' | 'adjust' | 'text' | 'audio' | 'export';

export interface SampleVideo {
  id: string;
  name: string;
  url: string;
  duration: number;
  thumbnail: string;
}
