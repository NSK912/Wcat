// Proprietary In-House Native Media Toolkit
// 100% Self-Contained, Zero External Dependencies

export type VideoCodec = 'avc' | 'hevc' | 'vp8' | 'vp9' | 'av1' | string;
export type AudioCodec = 'aac' | 'opus' | 'mp3' | 'vorbis' | 'flac' | string;

export type QualityLevel = 'very-low' | 'low' | 'medium' | 'high' | 'very-high' | number;

export interface StreamTargetChunk {
  data: Uint8Array;
  position?: number;
}

export interface MediaTrackInfo {
  id: number;
  type: 'video' | 'audio';
  codec: string;
  duration: number; // in seconds
  timescale: number;
  decoderConfig?: VideoDecoderConfig | AudioDecoderConfig;
}

export interface VideoTrackInfo extends MediaTrackInfo {
  type: 'video';
  width: number;
  height: number;
  rotation: number;
  fps: number;
  sampleCount: number;
  decoderConfig?: VideoDecoderConfig;
}

export interface AudioTrackInfo extends MediaTrackInfo {
  type: 'audio';
  sampleRate: number;
  numberOfChannels: number;
  decoderConfig?: AudioDecoderConfig;
}

export interface MediaMetadata {
  format: 'mp4' | 'webm' | 'mkv' | 'mov' | 'audio' | 'image' | 'unknown';
  duration: number; // in seconds
  width: number;
  height: number;
  rotation: number;
  fps: number;
  hasVideo: boolean;
  hasAudio: boolean;
  videoTracks: VideoTrackInfo[];
  audioTracks: AudioTrackInfo[];
  videoCodec?: string;
  audioCodec?: string;
}

export interface MediaSample {
  index: number;
  trackId: number;
  timestamp: number; // in seconds
  duration: number;  // in seconds
  isKeyframe: boolean;
  offset: number;    // byte offset in file
  size: number;      // byte size
  dts?: number;      // decode timestamp in seconds
}

export interface CanvasSinkOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill';
}

export interface WrappedCanvas {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  timestamp: number;
  duration: number;
}
