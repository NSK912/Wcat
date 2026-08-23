import {
  Input,
  Output,
  BlobSource,
  StreamTarget,
  BufferTarget,
  Mp4OutputFormat,
  WebMOutputFormat,
  MkvOutputFormat,
  Conversion,
  ALL_FORMATS,
  VideoSample,
  AudioSample,
  Quality,
  canEncodeVideo,
  canEncodeAudio,
  AudioSampleSink,
  AudioSampleSource,
  VideoSampleSink,
  VideoSampleSource,
  OutputTrackGroup,
  type StreamTargetChunk,
  type VideoCodec,
  type AudioCodec,
  type QualityLevel,
} from 'mediabunny';
import { EditSettings, ClipTransform, TimelineTrackData, TimelineClip } from '../types';

const MASTER_AUDIO_SAMPLE_RATE = 48000;
const MASTER_AUDIO_CHANNELS = 2;

/**
 * Creates a silent AudioSample of zero PCM values to maintain container track audio/video synchronization
 */
function createSilentAudioSample(timestamp: number, duration: number, sampleRate = MASTER_AUDIO_SAMPLE_RATE, channels = MASTER_AUDIO_CHANNELS): AudioSample {
  const numberOfFrames = Math.max(1, Math.round(duration * sampleRate));
  const pcmData = new Float32Array(numberOfFrames * channels);
  return new AudioSample({
    format: 'f32-planar',
    sampleRate,
    numberOfChannels: channels,
    timestamp,
    data: pcmData,
  });
}

/**
 * Extracts float32 planar PCM data from any AudioSample safely without DOM/AudioContext dependence
 */
function extractPCMFloat32(sample: AudioSample): { pcm: Float32Array; frames: number; channels: number; rate: number } {
  const frames = sample.numberOfFrames || 0;
  const channels = sample.numberOfChannels || 2;
  const rate = sample.sampleRate || MASTER_AUDIO_SAMPLE_RATE;

  if (frames <= 0 || channels <= 0) {
    return { pcm: new Float32Array(0), frames: 0, channels: 1, rate };
  }

  const totalFloats = frames * channels;
  const pcm = new Float32Array(totalFloats);

  try {
    for (let ch = 0; ch < channels; ch++) {
      const planeBuf = new Float32Array(pcm.buffer, ch * frames * 4, frames);
      sample.copyTo(planeBuf, { planeIndex: ch, format: 'f32-planar' });
    }
  } catch (e) {
    try {
      sample.copyTo(pcm, { planeIndex: 0, format: 'f32' });
    } catch (e2) {
      pcm.fill(0);
    }
  }

  return { pcm, frames, channels, rate };
}

/**
 * Adapts an AudioSample to match target sampleRate and numberOfChannels
 */
function adaptAudioSample(
  sample: AudioSample,
  targetSampleRate: number = MASTER_AUDIO_SAMPLE_RATE,
  targetChannels: number = MASTER_AUDIO_CHANNELS
): AudioSample {
  if (sample.sampleRate === targetSampleRate && sample.numberOfChannels === targetChannels) {
    return sample;
  }

  const { pcm, frames: srcFrames, channels: srcChannels, rate: srcRate } = extractPCMFloat32(sample);

  if (srcFrames <= 0) {
    return createSilentAudioSample(sample.timestamp, sample.duration || 0.02, targetSampleRate, targetChannels);
  }

  const ratio = targetSampleRate / (srcRate || targetSampleRate);
  const dstFrames = Math.max(1, Math.round(srcFrames * ratio));
  const dstPCM = new Float32Array(dstFrames * targetChannels);

  for (let ch = 0; ch < targetChannels; ch++) {
    const srcCh = Math.min(ch, srcChannels - 1);
    const srcOffset = srcCh * srcFrames;
    const dstOffset = ch * dstFrames;

    for (let i = 0; i < dstFrames; i++) {
      const srcIdx = i / ratio;
      const i0 = Math.floor(srcIdx);
      const i1 = Math.min(i0 + 1, srcFrames - 1);
      const frac = srcIdx - i0;
      const v0 = pcm[srcOffset + i0] || 0;
      const v1 = pcm[srcOffset + i1] || 0;
      dstPCM[dstOffset + i] = v0 + (v1 - v0) * frac;
    }
  }

  return new AudioSample({
    format: 'f32-planar',
    sampleRate: targetSampleRate,
    numberOfChannels: targetChannels,
    timestamp: sample.timestamp,
    data: dstPCM,
  });
}

/**
 * Draws image source onto canvas with aspect ratio fit/cover and transforms/filters
 */
function drawFitCover(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  img: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  settings: EditSettings
) {
  ctx.save();
  ctx.filter = buildCanvasFilterString(settings);

  if (settings.flipH || settings.flipV) {
    ctx.translate(settings.flipH ? canvasWidth : 0, settings.flipV ? canvasHeight : 0);
    ctx.scale(settings.flipH ? -1 : 1, settings.flipV ? -1 : 1);
  }

  const srcRatio = srcWidth / srcHeight;
  const dstRatio = canvasWidth / canvasHeight;

  let sx = 0;
  let sy = 0;
  let sw = srcWidth;
  let sh = srcHeight;

  if (settings.cropAspect === 'free' && settings.freeCropRect) {
    const rect = settings.freeCropRect;
    sx = Math.max(0, Math.min(srcWidth - 2, Math.round(srcWidth * (rect.x || 0))));
    sy = Math.max(0, Math.min(srcHeight - 2, Math.round(srcHeight * (rect.y || 0))));
    sw = Math.max(8, Math.min(srcWidth - sx, Math.round(srcWidth * (rect.width || 1))));
    sh = Math.max(8, Math.min(srcHeight - sy, Math.round(srcHeight * (rect.height || 1))));
  } else if (Math.abs(srcRatio - dstRatio) > 0.01) {
    if (srcRatio > dstRatio) {
      sw = srcHeight * dstRatio;
      sx = (srcWidth - sw) / 2;
    } else {
      sh = srcWidth / dstRatio;
      sy = (srcHeight - sh) / 2;
    }
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvasWidth, canvasHeight);
  ctx.restore();
}

/**
 * Draws a layer onto canvas respecting x/y percentage, rotation, scale, and opacity
 */
function drawLayerToCanvas(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  img: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  transform: ClipTransform | undefined,
  canvasWidth: number,
  canvasHeight: number,
  settings?: EditSettings
) {
  const t = transform || { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 };
  const posX = (t.x / 100) * canvasWidth;
  const posY = (t.y / 100) * canvasHeight;
  const scale = t.scale ?? 1;
  const rotationDeg = t.rotation ?? 0;
  const opacity = t.opacity ?? 1;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  
  if (t.blur && t.blur > 0) {
    const currentFilter = ctx.filter === 'none' ? '' : ctx.filter;
    // Scale blur relative to a standard 640px preview width so it encodes visually similar to preview
    const scaledBlur = Math.max(1, Math.round(t.blur * (canvasWidth / 640)));
    ctx.filter = `${currentFilter} blur(${scaledBlur}px)`.trim();
  }

  ctx.translate(posX, posY);
  if (rotationDeg !== 0) {
    ctx.rotate((rotationDeg * Math.PI) / 180);
  }
  ctx.scale(scale, scale);

  const drawW = canvasWidth;
  const drawH = (srcHeight / srcWidth) * canvasWidth;

  ctx.drawImage(img, 0, 0, srcWidth, srcHeight, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
}

/**
 * Renders watermark overlay text onto canvas
 */
function drawWatermark(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  settings: EditSettings
) {
  if (!settings.watermarkText || !settings.watermarkText.trim()) return;

  ctx.save();
  const fontSize = settings.watermarkSize || 24;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillStyle = settings.watermarkColor || '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  const text = settings.watermarkText;
  const textMetrics = ctx.measureText(text);
  const padding = 20;
  let x = padding;
  let y = canvasHeight - padding;

  switch (settings.watermarkPosition) {
    case 'top-left':
      x = padding;
      y = padding + fontSize;
      break;
    case 'top-right':
      x = canvasWidth - textMetrics.width - padding;
      y = padding + fontSize;
      break;
    case 'bottom-left':
      x = padding;
      y = canvasHeight - padding;
      break;
    case 'bottom-right':
      x = canvasWidth - textMetrics.width - padding;
      y = canvasHeight - padding;
      break;
    case 'center':
      x = (canvasWidth - textMetrics.width) / 2;
      y = (canvasHeight + fontSize) / 2;
      break;
  }

  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * Checks if the browser natively supports WebCodecs API (VideoEncoder, VideoDecoder)
 */
export function isWebCodecsSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'VideoEncoder' in window &&
    'VideoDecoder' in window
  );
}

/**
 * Probes WebCodecs hardware acceleration & software capabilities
 */
export async function probeWebCodecsCapabilities(): Promise<{
  supported: boolean;
  hasHardwareAcceleration: boolean;
  codecs: { avc: boolean; hevc: boolean; vp9: boolean; av1: boolean };
  audioCodecs: { aac: boolean; opus: boolean };
}> {
  if (!isWebCodecsSupported()) {
    return {
      supported: false,
      hasHardwareAcceleration: false,
      codecs: { avc: false, hevc: false, vp9: false, av1: false },
      audioCodecs: { aac: false, opus: false },
    };
  }

  let hasHardwareAcceleration = false;
  const codecs = { avc: false, hevc: false, vp9: false, av1: false };
  const audioCodecs = { aac: false, opus: false };

  try {
    // Probe AVC / H.264
    const avcSupport = await VideoEncoder.isConfigSupported({
      codec: 'avc1.640028',
      width: 1920,
      height: 1080,
      bitrate: 4_000_000,
      framerate: 30,
      hardwareAcceleration: 'no-preference',
    });
    codecs.avc = !!avcSupport.supported;
    if (avcSupport.config?.hardwareAcceleration === 'prefer-hardware') {
      hasHardwareAcceleration = true;
    }
  } catch {}

  try {
    // Probe VP9
    const vp9Support = await VideoEncoder.isConfigSupported({
      codec: 'vp09.00.10.08',
      width: 1920,
      height: 1080,
      bitrate: 4_000_000,
      framerate: 30,
      hardwareAcceleration: 'no-preference',
    });
    codecs.vp9 = !!vp9Support.supported;
  } catch {}

  try {
    // Probe AV1
    const av1Support = await VideoEncoder.isConfigSupported({
      codec: 'av01.0.08M.10',
      width: 1920,
      height: 1080,
      bitrate: 4_000_000,
      framerate: 30,
      hardwareAcceleration: 'no-preference',
    });
    codecs.av1 = !!av1Support.supported;
  } catch {}

  try {
    // Probe HEVC / H.265
    const hevcSupport = await VideoEncoder.isConfigSupported({
      codec: 'hvc1.1.6.L93.B0',
      width: 1920,
      height: 1080,
      bitrate: 4_000_000,
      framerate: 30,
      hardwareAcceleration: 'no-preference',
    });
    codecs.hevc = !!hevcSupport.supported;
  } catch {}

  if (typeof AudioEncoder !== 'undefined') {
    try {
      const aacSupport = await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000,
      });
      audioCodecs.aac = !!aacSupport.supported;
    } catch {}

    try {
      const opusSupport = await AudioEncoder.isConfigSupported({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000,
      });
      audioCodecs.opus = !!opusSupport.supported;
    } catch {}
  }

  return {
    supported: true,
    hasHardwareAcceleration,
    codecs,
    audioCodecs,
  };
}

/**
 * Helper to safely construct a Mediabunny Quality instance
 */
function resolveQuality(qualityStr?: string): Quality {
  const validLevels: QualityLevel[] = ['very-low', 'low', 'medium', 'high', 'very-high'];
  const level: QualityLevel = validLevels.includes(qualityStr as QualityLevel)
    ? (qualityStr as QualityLevel)
    : 'high';
  return new Quality(level);
}

/**
 * Calculates target dimensions based on resolution preset ('480', '720', '1080', '2k', '4k', '8k')
 */
export function getTargetDimensions(
  baseWidth: number,
  baseHeight: number,
  resolution?: string
): { width: number; height: number } {
  if (!resolution || resolution === 'original') {
    const w = Math.max(8, baseWidth - (baseWidth % 8));
    const h = Math.max(8, baseHeight - (baseHeight % 8));
    return { width: w, height: h };
  }

  let maxLongDim = 1920;
  let maxShortDim = 1080;

  switch (resolution) {
    case '480':
      maxLongDim = 854;
      maxShortDim = 480;
      break;
    case '720':
      maxLongDim = 1280;
      maxShortDim = 720;
      break;
    case '1080':
      maxLongDim = 1920;
      maxShortDim = 1080;
      break;
    case '2k':
      maxLongDim = 2560;
      maxShortDim = 1440;
      break;
    case '4k':
      maxLongDim = 3840;
      maxShortDim = 2160;
      break;
    case '8k':
      maxLongDim = 7680;
      maxShortDim = 4320;
      break;
    default:
      maxLongDim = 1920;
      maxShortDim = 1080;
      break;
  }

  const isLandscape = baseWidth >= baseHeight;
  const maxWidth = isLandscape ? maxLongDim : maxShortDim;
  const maxHeight = isLandscape ? maxShortDim : maxLongDim;

  let targetWidth = baseWidth;
  let targetHeight = baseHeight;

  // Scale to fit the requested bounding box, preserving aspect ratio (supports both upscale & downscale)
  const widthRatio = maxWidth / targetWidth;
  const heightRatio = maxHeight / targetHeight;
  const scale = Math.min(widthRatio, heightRatio);
  targetWidth = Math.round(targetWidth * scale);
  targetHeight = Math.round(targetHeight * scale);

  // Ensure dimensions are multiples of 8 for optimal hardware encoder compatibility
  targetWidth = Math.max(8, targetWidth - (targetWidth % 8));
  targetHeight = Math.max(8, targetHeight - (targetHeight % 8));

  return { width: targetWidth, height: targetHeight };
}

/**
 * Maps EncodeSpeed ('slow' | 'medium' | 'fast' | 'ultra-fast') to hardware acceleration and encoder latency hints
 */
function resolveSpeedConfig(speed?: string): {
  hardwareAcceleration: 'no-preference' | 'prefer-hardware' | 'prefer-software';
  latencyMode?: 'quality' | 'realtime';
} {
  switch (speed) {
    case 'ultra-fast':
      return { hardwareAcceleration: 'prefer-hardware', latencyMode: 'realtime' };
    case 'fast':
      return { hardwareAcceleration: 'prefer-hardware', latencyMode: 'quality' };
    case 'medium':
      return { hardwareAcceleration: 'no-preference', latencyMode: 'quality' };
    case 'slow':
      return { hardwareAcceleration: 'prefer-software', latencyMode: 'quality' };
    default:
      return { hardwareAcceleration: 'prefer-hardware', latencyMode: 'realtime' };
  }
}

/**
 * Automatically negotiates a supported video codec for the given resolution/quality.
 * Falls back across AVC -> VP9 -> VP8 -> AV1 -> HEVC if a specific profile is not supported.
 */
async function negotiateVideoCodec(
  preferredCodec: VideoCodec,
  width: number,
  height: number,
  quality: Quality,
  hwAcceleration: 'no-preference' | 'prefer-hardware' | 'prefer-software' = 'prefer-hardware'
): Promise<{ codec: VideoCodec; hwAccel: 'no-preference' | 'prefer-hardware' | 'prefer-software' }> {
  const safeWidth = Math.max(8, width - (width % 8));
  const safeHeight = Math.max(8, height - (height % 8));

  try {
    const isSupported = await canEncodeVideo(preferredCodec, {
      width: safeWidth,
      height: safeHeight,
      quality,
      hardwareAcceleration: hwAcceleration,
    });
    if (isSupported) return { codec: preferredCodec, hwAccel: hwAcceleration };
  } catch {
    // Continue to fallback candidates
  }

  const fallbackCandidates: VideoCodec[] = ['avc', 'vp9', 'vp8', 'av1', 'hevc'];
  for (const candidate of fallbackCandidates) {
    if (candidate === preferredCodec) continue;
    try {
      const supported = await canEncodeVideo(candidate, {
        width: safeWidth,
        height: safeHeight,
        quality,
        hardwareAcceleration: hwAcceleration,
      });
      if (supported) return { codec: candidate, hwAccel: hwAcceleration };
    } catch {}
  }

  // Fallback to no-preference if specific hardware/software constraint fails
  if (hwAcceleration !== 'no-preference') {
    return negotiateVideoCodec(preferredCodec, width, height, quality, 'no-preference');
  }

  return { codec: preferredCodec, hwAccel: hwAcceleration };
}

/**
 * Automatically negotiates supported audio codec
 */
async function negotiateAudioCodec(preferredCodec: AudioCodec): Promise<AudioCodec> {
  try {
    const isSupported = await canEncodeAudio(preferredCodec);
    if (isSupported) return preferredCodec;
  } catch {}

  const fallbacks: AudioCodec[] = ['aac', 'opus', 'flac'];
  for (const candidate of fallbacks) {
    if (candidate === preferredCodec) continue;
    try {
      const supported = await canEncodeAudio(candidate);
      if (supported) return candidate;
    } catch {}
  }

  return preferredCodec;
}

/**
 * Creates Mediabunny Target for WebCodecs Output
 */
function createWebCodecsTarget(writable: FileSystemWritableFileStream | null): StreamTarget | BufferTarget {
  if (!writable) {
    return new BufferTarget();
  }

  const customWritable = new WritableStream<StreamTargetChunk>({
    async write(chunk) {
      if (writable && typeof writable.write === 'function') {
        try {
          if (typeof chunk.position === 'number' && typeof (writable as any).seek === 'function') {
            await (writable as any).seek(chunk.position);
            await writable.write(chunk.data);
          } else {
            await writable.write(chunk);
          }
        } catch {
          try {
            if (typeof chunk.position === 'number') {
              await writable.write({ type: 'write', data: chunk.data, position: chunk.position } as any);
            } else {
              await writable.write(chunk.data);
            }
          } catch (innerErr) {
            console.error('Writable write failure in WebCodecs target:', innerErr);
            throw innerErr;
          }
        }
      }
    },
  });

  return new StreamTarget(customWritable, { chunked: true });
}

/**
 * Helper to build Canvas filter string from settings
 */
function buildCanvasFilterString(settings: EditSettings): string {
  let filterStr = `brightness(${settings.brightness}) contrast(${settings.contrast})`;
  switch (settings.filter) {
    case 'grayscale':
      filterStr += ' grayscale(100%)';
      break;
    case 'sepia':
      filterStr += ' sepia(100%)';
      break;
    case 'negative':
      filterStr += ' invert(100%)';
      break;
    case 'blur':
      filterStr += ' blur(3px)';
      break;
    case 'vignette':
      filterStr += ' contrast(120%) brightness(90%)';
      break;
    default:
      break;
  }
  return filterStr;
}

/**
 * Processes Single Video File using WebCodecs API (VideoDecoder & VideoEncoder)
 */
async function processImageToVideo(
  file: File,
  settings: EditSettings,
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  const startTime = performance.now();
  onProgress({
    percentage: 1,
    statusText: 'Initializing Image-to-Video Pipeline...',
    speedMBs: 0,
    log: `[WebCodecs API] Image Encoding Pipeline Initialized\nSource: ${file.name}`,
  });

  const bmp = await createImageBitmap(file);
  let sourceWidth = bmp.width;
  let sourceHeight = bmp.height;
  
  const hasCustomAspect = Boolean(settings.cropAspect && settings.cropAspect !== 'original');
  const hasResolutionPreset = Boolean(settings.resolution && settings.resolution !== 'original');

  let canvasWidth = sourceWidth;
  let canvasHeight = sourceHeight;

  if (hasCustomAspect) {
    if (settings.cropAspect === 'free' && settings.freeCropRect) {
      const rect = settings.freeCropRect;
      canvasWidth = Math.round(sourceWidth * Math.max(0.05, Math.min(1, rect.width || 1)));
      canvasHeight = Math.round(sourceHeight * Math.max(0.05, Math.min(1, rect.height || 1)));
    } else {
      let aspectMultiplier = 16 / 9;
      switch (settings.cropAspect) {
        case '16:9': aspectMultiplier = 16 / 9; break;
        case '4:3': aspectMultiplier = 4 / 3; break;
        case '1:1': aspectMultiplier = 1 / 1; break;
        case '4:5': aspectMultiplier = 4 / 5; break;
        case '9:16': aspectMultiplier = 9 / 16; break;
        case '21:9': aspectMultiplier = 21 / 9; break;
      }
      if (sourceWidth / sourceHeight > aspectMultiplier) {
        canvasHeight = sourceHeight;
        canvasWidth = Math.round(sourceHeight * aspectMultiplier);
      } else {
        canvasWidth = sourceWidth;
        canvasHeight = Math.round(sourceWidth / aspectMultiplier);
      }
    }
  }

  if (hasResolutionPreset) {
    const targetDims = getTargetDimensions(canvasWidth, canvasHeight, settings.resolution);
    canvasWidth = targetDims.width;
    canvasHeight = targetDims.height;
  }
  
  canvasWidth = Math.max(8, canvasWidth - (canvasWidth % 8));
  canvasHeight = Math.max(8, canvasHeight - (canvasHeight % 8));

  const speedConfig = resolveSpeedConfig(settings.encodeSpeed);
  const preferredVideoCodec = (settings.videoCodec as VideoCodec) || 'avc';
  const targetQuality = resolveQuality(settings.videoQuality);

  const negotiated = await negotiateVideoCodec(
    preferredVideoCodec,
    canvasWidth,
    canvasHeight,
    targetQuality,
    speedConfig.hardwareAcceleration
  );

  const targetVideoCodec = negotiated.codec;
  const targetHwAccel = negotiated.hwAccel;

  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  let outputFormat;
  if (ext === 'webm' || settings.outputFormat === 'webm' || targetVideoCodec === 'vp8' || targetVideoCodec === 'vp9') {
    outputFormat = new WebMOutputFormat();
  } else if (ext === 'mkv') {
    outputFormat = new MkvOutputFormat();
  } else {
    outputFormat = new Mp4OutputFormat({ fastStart: 'in-memory' });
  }

  const target = createWebCodecsTarget(writable);
  let totalWritten = 0;
  target.on('write', ({ end }) => {
    totalWritten = Math.max(totalWritten, end);
  });

  const output = new Output({ format: outputFormat, target });
  const vSource = new VideoSampleSource({
    codec: targetVideoCodec,
    quality: targetQuality,
    hardwareAcceleration: targetHwAccel
  });
  
  output.addVideoTrack(vSource);
  await output.start();

  const fps = (settings.fps && settings.fps > 0) ? Math.min(240, Math.max(1, Math.round(settings.fps))) : 30;
  const durationSecs = (settings.duration && settings.duration > 0) ? settings.duration : 5;
  const actualDuration = (settings.endTime > 0 && settings.endTime < durationSecs) ? settings.endTime : durationSecs;
  const frames = Math.ceil(actualDuration * fps);
  const frameDurationSec = 1 / fps;

  let offscreenCanvas: OffscreenCanvas | HTMLCanvasElement;
  let canvasCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  
  if (typeof OffscreenCanvas !== 'undefined') {
    offscreenCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    canvasCtx = offscreenCanvas.getContext('2d');
  } else {
    offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = canvasWidth;
    offscreenCanvas.height = canvasHeight;
    canvasCtx = offscreenCanvas.getContext('2d');
  }
  
  let lastTime = performance.now();
  let lastBytes = 0;
  
  for (let f = 0; f < frames; f++) {
    const origDuration = frameDurationSec;
    const w = canvasWidth;
    const h = canvasHeight;
    
    if (canvasCtx) {
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, w, h);
      
      canvasCtx.filter = buildCanvasFilterString(settings);
      if (settings.flipH || settings.flipV) {
        canvasCtx.translate(settings.flipH ? w : 0, settings.flipV ? h : 0);
        canvasCtx.scale(settings.flipH ? -1 : 1, settings.flipV ? -1 : 1);
      }
      
      const srcRatio = sourceWidth / sourceHeight;
      const dstRatio = w / h;
      let sx = 0; let sy = 0; let sw = sourceWidth; let sh = sourceHeight;
      
      if (settings.cropAspect === 'free' && settings.freeCropRect) {
        const rect = settings.freeCropRect;
        sx = Math.max(0, Math.min(sourceWidth - 2, Math.round(sourceWidth * (rect.x || 0))));
        sy = Math.max(0, Math.min(sourceHeight - 2, Math.round(sourceHeight * (rect.y || 0))));
        sw = Math.max(8, Math.min(sourceWidth - sx, Math.round(sourceWidth * (rect.width || 1))));
        sh = Math.max(8, Math.min(sourceHeight - sy, Math.round(sourceHeight * (rect.height || 1))));
      } else if (Math.abs(srcRatio - dstRatio) > 0.01) {
        if (srcRatio > dstRatio) {
          sw = sourceHeight * dstRatio;
          sx = (sourceWidth - sw) / 2;
        } else {
          sh = sourceWidth / dstRatio;
          sy = (sourceHeight - sh) / 2;
        }
      }
      canvasCtx.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h);
      canvasCtx.restore();
      
      if (settings.watermarkText && settings.watermarkText.trim()) {
        canvasCtx.save();
        const fontSize = settings.watermarkSize || 24;
        canvasCtx.font = `bold ${fontSize}px sans-serif`;
        canvasCtx.fillStyle = settings.watermarkColor || '#ffffff';
        canvasCtx.shadowColor = 'rgba(0,0,0,0.8)';
        canvasCtx.shadowBlur = 4;
        canvasCtx.shadowOffsetX = 1;
        canvasCtx.shadowOffsetY = 1;
        const text = settings.watermarkText;
        const textMetrics = canvasCtx.measureText(text);
        const padding = 20;
        let x = padding; let y = h - padding;
        switch (settings.watermarkPosition) {
          case 'top-left': x = padding; y = padding + fontSize; break;
          case 'top-right': x = w - textMetrics.width - padding; y = padding + fontSize; break;
          case 'bottom-left': x = padding; y = h - padding; break;
          case 'bottom-right': x = w - textMetrics.width - padding; y = h - padding; break;
          case 'center': x = (w - textMetrics.width) / 2; y = (h + fontSize) / 2; break;
        }
        canvasCtx.fillText(text, x, y);
        canvasCtx.restore();
      }
    }
    
    const pSample = new VideoSample(offscreenCanvas, { timestamp: f * frameDurationSec, duration: origDuration });
    await vSource.add(pSample);
    pSample.close();
    
    const now = performance.now();
    const elapsed = (now - lastTime) / 1000;
    if (elapsed > 0.5 || f === frames - 1) {
      const speedMBs = (totalWritten - lastBytes) / (1024 * 1024) / elapsed;
      lastTime = now;
      lastBytes = totalWritten;
      const currentPercent = Math.round((f / frames) * 100);
      onProgress({
        percentage: currentPercent,
        statusText: `Encoding Image (${currentPercent}%)...`,
        speedMBs,
      });
    }
  }
  
  bmp.close();
  await output.finalize();

  let blobUrl;
  if (target instanceof BufferTarget && target.buffer) {
    const isMp4 = outputFormat instanceof Mp4OutputFormat;
    const isMkv = outputFormat instanceof MkvOutputFormat;
    const mime = isMp4 ? 'video/mp4' : isMkv ? 'video/x-matroska' : 'video/webm';
    const blob = new Blob([target.buffer], { type: mime });
    blobUrl = URL.createObjectURL(blob);
    totalWritten = target.buffer.byteLength;
  }

  onProgress({
    percentage: 100,
    statusText: 'Image Encoding Complete!',
    speedMBs: 0,
    log: `[WebCodecs API] Image encoding finished. Total: ${(totalWritten / (1024 * 1024)).toFixed(2)} MB`,
  });

  return {
    success: true,
    totalBytesWritten: totalWritten,
    blobUrl,
  };
}

export async function processWebCodecsEncodeStream(
  file: File,
  settings: EditSettings,
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  if (!isWebCodecsSupported()) {
    throw new Error('WebCodecs API is not supported in this browser.');
  }

  const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(file.name);
  if (isImage) {
    return processImageToVideo(file, settings, writable, onProgress);
  }

  const startTime = performance.now();
  onProgress({
    percentage: 1,
    statusText: 'Initializing WebCodecs API Processing Pipeline...',
    speedMBs: 0,
    log: `[WebCodecs API] Video Encoding Pipeline Initialized\n[WebCodecs API] Source: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`,
  });

  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  });

  // Inspect source video properties
  const videoTracks = await input.getVideoTracks();
  const audioTracks = await input.getAudioTracks();

  let rawWidth = 1920;
  let rawHeight = 1080;
  let sourceDuration = settings.duration || 0;

  if (videoTracks.length > 0) {
    const vTrack = videoTracks[0];
    rawWidth = vTrack.displayWidth || vTrack.codedWidth || 1920;
    rawHeight = vTrack.displayHeight || vTrack.codedHeight || 1080;
    const dur = await vTrack.computeDuration();
    if (dur && dur > 0) sourceDuration = dur;
    const codec = await vTrack.getCodec();
    onProgress({
      percentage: 3,
      statusText: `WebCodecs: Detected Video Track ${rawWidth}x${rawHeight} (${codec || 'H.264'})`,
      speedMBs: 0,
      log: `[WebCodecs API] Video Stream: ${rawWidth}x${rawHeight} (${codec || 'H.264'}), Duration: ${sourceDuration.toFixed(2)}s`,
    });
  }

  // Ensure dimensions are even numbers (vital for AVC/HEVC/VP9 hardware & software encoders)
  const sourceWidth = Math.max(8, rawWidth - (rawWidth % 8));
  const sourceHeight = Math.max(8, rawHeight - (rawHeight % 8));

  // Calculate Trim Timestamps
  let trimStart = settings.startTime > 0 ? settings.startTime : undefined;
  if (trimStart !== undefined && trimStart >= sourceDuration) trimStart = Math.max(0, sourceDuration - 0.1);
  let trimEnd: number | undefined = undefined;
  if (settings.endTime > 0 && sourceDuration > 0 && settings.endTime < sourceDuration - 0.1) {
    const isFullVideo = settings.duration > 0 && Math.abs(settings.endTime - settings.duration) < 0.1;
    if (!isFullVideo) {
      trimEnd = settings.endTime;
    }
  }
  if (trimStart !== undefined && trimEnd !== undefined && trimStart >= trimEnd) trimStart = Math.max(0, trimEnd - 0.1);

  onProgress({
    percentage: 5,
    statusText: 'Negotiating WebCodecs VideoEncoder & AudioEncoder configuration...',
    speedMBs: 0,
    log: `[WebCodecs API] Trim Range: ${trimStart ? `${trimStart.toFixed(2)}s` : '0.00s'} -> ${trimEnd ? `${trimEnd.toFixed(2)}s` : `${sourceDuration.toFixed(2)}s`}`,
  });

  // Check if we need canvas frame filtering (brightness, contrast, watermark, filters, flip, aspect ratio, resolution change)
  const hasCustomAspect = Boolean(settings.cropAspect && settings.cropAspect !== 'original');
  const hasResolutionPreset = Boolean(settings.resolution && settings.resolution !== 'original');

  let canvasWidth = sourceWidth;
  let canvasHeight = sourceHeight;

  if (hasCustomAspect) {
    if (settings.cropAspect === 'free' && settings.freeCropRect) {
      const rect = settings.freeCropRect;
      canvasWidth = Math.round(sourceWidth * Math.max(0.05, Math.min(1, rect.width || 1)));
      canvasHeight = Math.round(sourceHeight * Math.max(0.05, Math.min(1, rect.height || 1)));
    } else {
      let aspectMultiplier = 16 / 9;
      switch (settings.cropAspect) {
        case '16:9': aspectMultiplier = 16 / 9; break;
        case '4:3': aspectMultiplier = 4 / 3; break;
        case '1:1': aspectMultiplier = 1 / 1; break;
        case '4:5': aspectMultiplier = 4 / 5; break;
        case '9:16': aspectMultiplier = 9 / 16; break;
        case '21:9': aspectMultiplier = 21 / 9; break;
      }

      if (sourceWidth / sourceHeight > aspectMultiplier) {
        // Source is wider than target ratio
        canvasHeight = sourceHeight;
        canvasWidth = Math.round(sourceHeight * aspectMultiplier);
      } else {
        // Source is taller than target ratio
        canvasWidth = sourceWidth;
        canvasHeight = Math.round(sourceWidth / aspectMultiplier);
      }
    }

    // Ensure even dimensions
    canvasWidth = Math.max(8, canvasWidth - (canvasWidth % 8));
    canvasHeight = Math.max(8, canvasHeight - (canvasHeight % 8));

    onProgress({
      percentage: 7,
      statusText: `Applied scale ${settings.cropAspect}: Target resolution ${canvasWidth}x${canvasHeight}`,
      speedMBs: 0,
      log: `[WebCodecs API] Scale Aspect Ratio: ${settings.cropAspect} (Calculated Target Dimensions: ${canvasWidth}x${canvasHeight})`,
    });
  }

  if (hasResolutionPreset) {
    const targetDims = getTargetDimensions(canvasWidth, canvasHeight, settings.resolution);
    canvasWidth = targetDims.width;
    canvasHeight = targetDims.height;
    onProgress({
      percentage: 8,
      statusText: `Applied resolution preset: ${settings.resolution?.toUpperCase()} (${canvasWidth}x${canvasHeight})`,
      speedMBs: 0,
      log: `[WebCodecs API] Target Resolution: ${settings.resolution?.toUpperCase()} -> ${canvasWidth}x${canvasHeight}`,
    });
  }

  const needsCanvasProcessing =
    settings.filter !== 'none' ||
    settings.brightness !== 1.0 ||
    settings.contrast !== 1.0 ||
    settings.flipH ||
    settings.flipV ||
    Boolean(settings.watermarkText?.trim()) ||
    hasCustomAspect ||
    hasResolutionPreset;

  // Determine Speed, Video Codec & Quality with fallback negotiation using target dimensions
  const speedConfig = resolveSpeedConfig(settings.encodeSpeed);
  const preferredVideoCodec: VideoCodec = (settings.videoCodec as VideoCodec) || 'avc';
  const targetQuality = resolveQuality(settings.videoQuality);
  const negotiated = await negotiateVideoCodec(
    preferredVideoCodec,
    canvasWidth,
    canvasHeight,
    targetQuality,
    speedConfig.hardwareAcceleration
  );
  const targetVideoCodec = negotiated.codec;
  const targetHwAccel = negotiated.hwAccel;

  const preferredAudioCodec: AudioCodec = (settings.audioCodec as AudioCodec) || 'aac';
  const targetAudioCodec = await negotiateAudioCodec(preferredAudioCodec);

  // Determine Output Format compatible with negotiated codecs
  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  const reqFormat = (settings.outputFormat || (settings as any).containerFormat || '').toLowerCase();
  const targetExt = reqFormat || ext;

  let outputFormat;
  if (targetExt === 'webm' || settings.outputFormat === 'webm' || targetVideoCodec === 'vp8' || targetVideoCodec === 'vp9') {
    outputFormat = new WebMOutputFormat();
  } else if (targetExt === 'mkv' || settings.outputFormat === 'mkv') {
    outputFormat = new MkvOutputFormat();
  } else {
    // Standard MP4 with FastStart in-memory for 100% video preview thumbnail compatibility
    outputFormat = new Mp4OutputFormat({ fastStart: 'in-memory' });
  }

  const target = createWebCodecsTarget(writable);
  let totalWritten = 0;
  target.on('write', ({ end }) => {
    totalWritten = Math.max(totalWritten, end);
  });

  const output = new Output({ format: outputFormat, target });

  let offscreenCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
  let canvasCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;

  if (needsCanvasProcessing) {
    if (typeof OffscreenCanvas !== 'undefined') {
      offscreenCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
      canvasCtx = offscreenCanvas.getContext('2d');
    } else if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = canvasWidth;
      c.height = canvasHeight;
      offscreenCanvas = c;
      canvasCtx = c.getContext('2d');
    }
  }

  // Configure Mediabunny WebCodecs Pipeline with selected speed/acceleration configuration
  const conversion = await Conversion.init({
    input,
    output,
    trim: {
      start: trimStart,
      end: trimEnd,
    },
    video: {
      forceTranscode: true, // Forces WebCodecs VideoDecoder -> VideoEncoder pipeline
      codec: targetVideoCodec,
      quality: targetQuality,
      hardwareAcceleration: targetHwAccel,
      frameRate: (settings.fps && settings.fps > 0) ? Math.min(240, Math.max(1, Math.round(settings.fps))) : undefined,
      width: canvasWidth,
      height: canvasHeight,
      processedWidth: canvasWidth,
      processedHeight: canvasHeight,
      fit: 'cover',
      rotate: (settings.rotation as any) || undefined,
      allowRotationMetadata: false, // Bakes rotation into the WebCodecs pixel buffer
      process: needsCanvasProcessing && offscreenCanvas && canvasCtx
        ? async (sample: VideoSample) => {
            const canvas = offscreenCanvas!;
            const ctx = canvasCtx!;

            const img = sample.toCanvasImageSource();
            const w = canvas.width;
            const h = canvas.height;

            ctx.save();
            ctx.clearRect(0, 0, w, h);

            // Apply CSS Filters (Brightness, Contrast, Grayscale, etc.)
            ctx.filter = buildCanvasFilterString(settings);

            // Apply Horizontal / Vertical Flips
            if (settings.flipH || settings.flipV) {
              ctx.translate(settings.flipH ? w : 0, settings.flipV ? h : 0);
              ctx.scale(settings.flipH ? -1 : 1, settings.flipV ? -1 : 1);
            }

            // Calculate source crop rectangle to preserve aspect ratio without distortion
            const srcWidth = (img as any).width || (img as any).videoWidth || (sample as any).displayWidth || (sample as any).codedWidth || w;
            const srcHeight = (img as any).height || (img as any).videoHeight || (sample as any).displayHeight || (sample as any).codedHeight || h;

            const srcRatio = srcWidth / srcHeight;
            const dstRatio = w / h;

            let sx = 0;
            let sy = 0;
            let sw = srcWidth;
            let sh = srcHeight;

            if (settings.cropAspect === 'free' && settings.freeCropRect) {
              const rect = settings.freeCropRect;
              sx = Math.max(0, Math.min(srcWidth - 2, Math.round(srcWidth * (rect.x || 0))));
              sy = Math.max(0, Math.min(srcHeight - 2, Math.round(srcHeight * (rect.y || 0))));
              sw = Math.max(8, Math.min(srcWidth - sx, Math.round(srcWidth * (rect.width || 1))));
              sh = Math.max(8, Math.min(srcHeight - sy, Math.round(srcHeight * (rect.height || 1))));
            } else if (Math.abs(srcRatio - dstRatio) > 0.01) {
              if (srcRatio > dstRatio) {
                // Source is wider than destination: crop sides
                sw = srcHeight * dstRatio;
                sx = (srcWidth - sw) / 2;
              } else {
                // Source is taller than destination: crop top/bottom
                sh = srcWidth / dstRatio;
                sy = (srcHeight - sh) / 2;
              }
            }

            ctx.drawImage(img as any, sx, sy, sw, sh, 0, 0, w, h);
            ctx.restore();

            // Apply Watermark Overlay
            if (settings.watermarkText && settings.watermarkText.trim()) {
              ctx.save();
              const fontSize = settings.watermarkSize || 24;
              ctx.font = `bold ${fontSize}px sans-serif`;
              ctx.fillStyle = settings.watermarkColor || '#ffffff';
              ctx.shadowColor = 'rgba(0,0,0,0.8)';
              ctx.shadowBlur = 4;
              ctx.shadowOffsetX = 1;
              ctx.shadowOffsetY = 1;
              const text = settings.watermarkText;
              const textMetrics = ctx.measureText(text);
              const padding = 20;

              let x = padding;
              let y = h - padding;

              switch (settings.watermarkPosition) {
                case 'top-left':
                  x = padding;
                  y = padding + fontSize;
                  break;
                case 'top-right':
                  x = w - textMetrics.width - padding;
                  y = padding + fontSize;
                  break;
                case 'bottom-left':
                  x = padding;
                  y = h - padding;
                  break;
                case 'bottom-right':
                  x = w - textMetrics.width - padding;
                  y = h - padding;
                  break;
                case 'center':
                  x = (w - textMetrics.width) / 2;
                  y = (h + fontSize) / 2;
                  break;
              }

              ctx.fillText(text, x, y);
              ctx.restore();
            }

            return canvas as any;
          }
        : undefined,
    },
    audio: {
      discard: settings.muteAudio,
      forceTranscode: true, // Forces WebCodecs AudioDecoder -> AudioEncoder
      codec: targetAudioCodec,
      ...(settings.audioBitrate && settings.audioBitrate > 0
        ? { bitrate: settings.audioBitrate * 1000 }
        : { quality: resolveQuality('high') }),
    },
  });

  let lastTime = performance.now();
  let lastBytes = 0;
  let lastPercent = 0;

  conversion.onProgress = (prog: number) => {
    const now = performance.now();
    const elapsed = (now - lastTime) / 1000;
    let speedMBs = 0;
    if (elapsed > 0.5) {
      speedMBs = (totalWritten - lastBytes) / (1024 * 1024) / elapsed;
      lastTime = now;
      lastBytes = totalWritten;
    }

    const currentPercent = Math.min(99, Math.max(5, Math.round(prog * 100)));
    if (currentPercent !== lastPercent) {
      lastPercent = currentPercent;
      onProgress({
        percentage: currentPercent,
        statusText: `WebCodecs Re-Encoding (${currentPercent}%)...`,
        speedMBs,
        log: `[WebCodecs Encode] Progress: ${currentPercent}% | Written: ${(totalWritten / (1024 * 1024)).toFixed(2)} MB | Speed: ${speedMBs.toFixed(1)} MB/s`,
      });
    }
  };

  onProgress({
    percentage: 10,
    statusText: 'WebCodecs VideoEncoder actively processing frames...',
    speedMBs: 0,
    log: `[WebCodecs API] VideoEncoder started with Codec: ${targetVideoCodec.toUpperCase()} (HW: ${targetHwAccel}) (Audio: ${targetAudioCodec.toUpperCase()}) | Quality: ${settings.videoQuality || 'high'}`,
  });

  try {
    await conversion.execute();
  } catch (err: any) {
    if (err?.message?.includes('not supported') && targetHwAccel !== 'no-preference') {
      onProgress({
        percentage: 10,
        statusText: 'Hardware encoder rejected. Retrying with software encoder...',
        speedMBs: 0,
        log: `[WebCodecs API] Hardware encoder failed. Retrying with no-preference (Software). Error: ${err.message}`,
      });
      // Patch conversion object to use no-preference and retry
      if ((conversion as any).options?.video) {
        (conversion as any).options.video.hardwareAcceleration = 'no-preference';
        await conversion.execute();
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }

  let blobUrl: string | undefined;
  if (target instanceof BufferTarget && target.buffer) {
    const isMp4 = outputFormat instanceof Mp4OutputFormat;
    const isMkv = outputFormat instanceof MkvOutputFormat;
    const mime = isMp4 ? 'video/mp4' : isMkv ? 'video/x-matroska' : 'video/webm';
    const blob = new Blob([target.buffer], { type: mime });
    blobUrl = URL.createObjectURL(blob);
    totalWritten = target.buffer.byteLength;
  }

  const totalTimeSeconds = ((performance.now() - startTime) / 1000).toFixed(2);
  onProgress({
    percentage: 100,
    statusText: 'WebCodecs Encoding Complete!',
    speedMBs: 0,
    log: `[WebCodecs API] Encoding finished successfully in ${totalTimeSeconds}s! Total output size: ${(totalWritten / (1024 * 1024)).toFixed(2)} MB`,
  });

  return {
    success: true,
    totalBytesWritten: totalWritten,
    blobUrl,
  };
}

/**
 * Multi-Track Timeline Compositing & Transcoding Engine
 * Composites multiple timeline tracks (Base Track 0 + Overlays Track 1, 2, ... N-1)
 * concurrently across timeline time, respecting Z-index, transforms, and duration.
 */
export async function processWebCodecsMultiTrackTimeline(
  tracks: TimelineTrackData[],
  settings: EditSettings,
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  if (!isWebCodecsSupported()) {
    throw new Error('WebCodecs API is not supported in this browser.');
  }

  const visibleTracks = tracks.filter((t) => !t.hidden && t.clips && t.clips.length > 0);
  if (visibleTracks.length === 0) {
    throw new Error('No visible tracks or clips to export.');
  }

  // Pre-probe clip durations if missing or uninitialized
  for (const track of visibleTracks) {
    for (const clip of track.clips) {
      if (clip.file) {
        const isImg = clip.mediaType === 'image' || clip.file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(clip.file.name);
        if (!isImg) {
          let realDur = clip.fileDuration;
          if (!realDur || clip.endTime === undefined || clip.endTime <= clip.startTime) {
            try {
              const probeInput = new Input({ source: new BlobSource(clip.file), formats: ALL_FORMATS });
              const vTracks = await probeInput.getVideoTracks();
              if (vTracks.length > 0) {
                const d = await vTracks[0].computeDuration();
                if (d && Number.isFinite(d) && d > 0) realDur = d;
              }
              if (!realDur) {
                const aTracks = await probeInput.getAudioTracks();
                if (aTracks.length > 0) {
                  const d = await aTracks[0].computeDuration();
                  if (d && Number.isFinite(d) && d > 0) realDur = d;
                }
              }
            } catch (e) {
              console.warn('Demuxer probe warning in MultiTrackTimeline:', e);
            }
          }

          if (realDur && realDur > 0) {
            clip.fileDuration = realDur;
            if (clip.endTime === undefined || clip.endTime <= clip.startTime) {
              clip.endTime = (clip.startTime || 0) + realDur;
              clip.sourceEndTime = realDur;
            }
          }
        }
      }
    }
  }

  let minTimelineStart = Infinity;
  let maxTimelineEnd = 0;
  visibleTracks.forEach((t) => {
    t.clips.forEach((c) => {
      const start = c.startTime || 0;
      const dur =
        c.endTime !== undefined && c.startTime !== undefined && c.endTime > c.startTime
          ? c.endTime - c.startTime
          : c.duration || c.fileDuration || (c.mediaType === 'image' ? 5 : 10);
      const clipEnd = start + dur;
      if (start < minTimelineStart) minTimelineStart = start;
      if (clipEnd > maxTimelineEnd) maxTimelineEnd = clipEnd;
    });
  });

  if (minTimelineStart === Infinity) minTimelineStart = 0;

  const exportStart = minTimelineStart;
  const exportEnd = maxTimelineEnd > exportStart ? maxTimelineEnd : (settings.endTime > exportStart ? settings.endTime : exportStart + 10);
  const exportDuration = Math.max(0.1, exportEnd - exportStart);

  onProgress({
    percentage: 1,
    statusText: `Initializing True Multi-Track Engine (${visibleTracks.length} tracks, ${exportDuration.toFixed(2)}s)...`,
    speedMBs: 0,
    log: `[WebCodecs] True Compositor: ${visibleTracks.length} tracks, Duration: ${exportDuration.toFixed(2)}s`,
  });

  const bitmapMap = new Map<string, ImageBitmap>();
  for (const track of visibleTracks) {
    for (const clip of track.clips) {
      const isImg = clip.mediaType === 'image' || (clip.file && clip.file.type.startsWith('image/')) || (clip.file && /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(clip.file.name));
      if (isImg && clip.file) {
        try {
          const bmp = await createImageBitmap(clip.file);
          bitmapMap.set(clip.id, bmp);
        } catch (e) {
          console.warn('Failed to preload bitmap', e);
        }
      }
    }
  }

  let sourceWidth = 1920;
  let sourceHeight = 1080;
  let hasValidDims = false;

  for (const track of visibleTracks) {
    for (const clip of track.clips) {
      if (!clip.file) continue;
      const isImg = clip.mediaType === 'image' || clip.file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(clip.file.name);
      if (isImg) {
        const bmp = bitmapMap.get(clip.id);
        if (bmp && bmp.width > 0 && bmp.height > 0) {
          if (!hasValidDims) { sourceWidth = bmp.width; sourceHeight = bmp.height; hasValidDims = true; }
        }
      } else {
        try {
          const probeInput = new Input({ source: new BlobSource(clip.file), formats: ALL_FORMATS });
          const probeVTracks = await probeInput.getVideoTracks();
          if (probeVTracks.length > 0) {
            sourceWidth = probeVTracks[0].displayWidth || probeVTracks[0].codedWidth || 1920;
            sourceHeight = probeVTracks[0].displayHeight || probeVTracks[0].codedHeight || 1080;
            hasValidDims = true;
            break;
          }
        } catch (e) {}
      }
    }
    if (hasValidDims) break;
  }

  sourceWidth = Math.max(8, sourceWidth - (sourceWidth % 8));
  sourceHeight = Math.max(8, sourceHeight - (sourceHeight % 8));

  const hasCustomAspect = Boolean(settings.cropAspect && settings.cropAspect !== 'original');
  const hasResolutionPreset = Boolean(settings.resolution && settings.resolution !== 'original');
  let canvasWidth = sourceWidth;
  let canvasHeight = sourceHeight;

  if (hasCustomAspect) {
    const [num, den] = (settings.cropAspect as string).split(':').map(Number);
    if (num && den) {
      if (sourceWidth / sourceHeight > num / den) canvasWidth = Math.round(sourceHeight * (num / den));
      else canvasHeight = Math.round(sourceWidth / (num / den));
    }
  }
  if (hasResolutionPreset) {
    const targetDims = getTargetDimensions(canvasWidth, canvasHeight, settings.resolution);
    canvasWidth = targetDims.width;
    canvasHeight = targetDims.height;
  }

  const preferredVideoCodec: VideoCodec = (settings.videoCodec as VideoCodec) || 'avc';
  const targetQuality = resolveQuality(settings.videoQuality);
  const speedConfig = resolveSpeedConfig(settings.encodeSpeed);

  const negotiated = await negotiateVideoCodec(preferredVideoCodec, canvasWidth, canvasHeight, targetQuality, speedConfig.hardwareAcceleration);
  const targetVideoCodec = negotiated.codec;
  const targetHwAccel = negotiated.hwAccel;

  const preferredAudioCodec: AudioCodec = (settings.audioCodec as AudioCodec) || 'aac';
  const targetAudioCodec = await negotiateAudioCodec(preferredAudioCodec);

  let outputFormat;
  const requestedFormat = (settings.outputFormat || (settings as any).containerFormat || '').toLowerCase();
  const firstFileExt = visibleTracks[0]?.clips[0]?.file?.name.split('.').pop()?.toLowerCase() || 'mp4';
  const effectiveFormat = requestedFormat || firstFileExt;

  if (effectiveFormat === 'webm' || targetVideoCodec === 'vp8' || targetVideoCodec === 'vp9') outputFormat = new WebMOutputFormat();
  else if (effectiveFormat === 'mkv') outputFormat = new MkvOutputFormat();
  else outputFormat = new Mp4OutputFormat({ fastStart: 'in-memory' });

  const target = createWebCodecsTarget(writable);
  let totalWritten = 0;
  target.on('write', ({ end }) => { totalWritten = Math.max(totalWritten, end); });

  const output = new Output({ format: outputFormat, target });
  const vSource = new VideoSampleSource({ codec: targetVideoCodec, quality: targetQuality, hardwareAcceleration: targetHwAccel, latencyMode: speedConfig.latencyMode });
  output.addVideoTrack(vSource);

  let aSource: AudioSampleSource | null = null;
  if (!settings.muteAudio) {
    aSource = new AudioSampleSource({
      codec: targetAudioCodec,
      ...(settings.audioBitrate && settings.audioBitrate > 0 ? { bitrate: settings.audioBitrate * 1000 } : { quality: resolveQuality('high') }),
    });
    output.addAudioTrack(aSource);
  }

  await output.start();

  let offscreenCanvas: OffscreenCanvas | HTMLCanvasElement;
  let canvasCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (typeof OffscreenCanvas !== 'undefined') {
    offscreenCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    canvasCtx = offscreenCanvas.getContext('2d');
  } else {
    offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = canvasWidth;
    offscreenCanvas.height = canvasHeight;
    canvasCtx = offscreenCanvas.getContext('2d');
  }

  const clipDecoders = new Map<string, {
    vSink: VideoSampleSink;
    iterator: AsyncIterator<VideoSample>;
    currentSample: VideoSample | null;
    lastDrawnSample: VideoSample | null;
  }>();

  const audioClipDecoders = new Map<string, {
    aSink: AudioSampleSink;
    iterator: AsyncIterator<AudioSample>;
  }>();
  
  onProgress({ percentage: 5, statusText: 'Initializing media compositing engine...', speedMBs: 0 });

  let lastProgressTime = performance.now();
  let lastBytes = 0;
  const fps = (settings.fps && settings.fps > 0) ? Math.min(240, Math.max(1, Math.round(settings.fps))) : 30;
  const frameDur = 1 / fps;
  const frames = Math.ceil(exportDuration * fps);
  let currentAudioTime = 0;

  // Synchronous Lockstep Audio/Video Compositing Loop
  for (let f = 0; f < frames; f++) {
    const t = exportStart + f * frameDur;
    const outT = f * frameDur;

    if (canvasCtx) {
      canvasCtx.save();
      canvasCtx.fillStyle = '#000000';
      canvasCtx.fillRect(0, 0, canvasWidth, canvasHeight);

      for (let i = 0; i < visibleTracks.length; i++) {
        const track = visibleTracks[i];
        const activeClip = track.clips.find((c) => {
          const start = c.startTime || 0;
          const dur = c.endTime !== undefined && c.endTime > start ? c.endTime - start : c.duration || c.fileDuration || (c.mediaType === 'image' ? 5 : 10);
          return t >= start && t < start + dur;
        });

        if (activeClip && activeClip.file) {
          const isImg = activeClip.mediaType === 'image' || activeClip.file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(activeClip.file.name);
          if (isImg) {
            const bmp = bitmapMap.get(activeClip.id);
            if (bmp) {
              if (activeClip.transform) drawLayerToCanvas(canvasCtx, bmp, bmp.width, bmp.height, activeClip.transform, canvasWidth, canvasHeight);
              else drawFitCover(canvasCtx, bmp, bmp.width, bmp.height, canvasWidth, canvasHeight, settings);
            }
          } else {
            let decoder = clipDecoders.get(activeClip.id);
            if (!decoder) {
              try {
                const input = new Input({ source: new BlobSource(activeClip.file), formats: ALL_FORMATS });
                const vTracks = await input.getVideoTracks();
                if (vTracks.length > 0) {
                  const vSink = new VideoSampleSink(vTracks[0]);
                  const sourceStart = activeClip.sourceStartTime || 0;
                  const dur = activeClip.endTime !== undefined && activeClip.endTime > (activeClip.startTime || 0)
                    ? activeClip.endTime - (activeClip.startTime || 0)
                    : activeClip.duration || activeClip.fileDuration || 10;
                  const sourceEnd = (activeClip.sourceEndTime !== undefined ? activeClip.sourceEndTime : sourceStart + dur) + 5;
                  decoder = {
                    vSink,
                    iterator: vSink.samples(sourceStart, sourceEnd)[Symbol.asyncIterator](),
                    currentSample: null,
                    lastDrawnSample: null,
                  };
                  clipDecoders.set(activeClip.id, decoder);
                }
              } catch (e) {
                console.warn('Failed on-demand decoder creation for clip', activeClip.id, e);
              }
            }

            if (decoder) {
              const timeInClip = t - (activeClip.startTime || 0) + (activeClip.sourceStartTime || 0);
              let sampleToDraw = decoder.currentSample;
              while (true) {
                if (!sampleToDraw) {
                  try {
                    const { value, done } = await decoder.iterator.next();
                    if (done) break;
                    sampleToDraw = value;
                  } catch (err) {
                    console.warn('Decoder iterator error, resetting decoder for clip:', activeClip.id, err);
                    clipDecoders.delete(activeClip.id);
                    break;
                  }
                }
                if (!sampleToDraw) break;

                const sampleDuration = sampleToDraw.duration > 0 ? sampleToDraw.duration : frameDur;
                const sampleEndTime = sampleToDraw.timestamp + sampleDuration;

                if (sampleEndTime <= timeInClip + 0.001) {
                  if (decoder.lastDrawnSample && decoder.lastDrawnSample !== sampleToDraw) {
                    decoder.lastDrawnSample.close();
                  }
                  decoder.lastDrawnSample = sampleToDraw;
                  sampleToDraw = null;
                  continue;
                }
                break;
              }
              decoder.currentSample = sampleToDraw;
              const sampleToRender = sampleToDraw || decoder.lastDrawnSample;
              if (sampleToRender) {
                const img = sampleToRender.toCanvasImageSource();
                const sqW = sampleToRender.squarePixelWidth || canvasWidth;
                const sqH = sampleToRender.squarePixelHeight || canvasHeight;
                if (activeClip.transform) {
                  drawLayerToCanvas(canvasCtx, img, sqW, sqH, activeClip.transform, canvasWidth, canvasHeight);
                } else {
                  drawFitCover(canvasCtx, img, sqW, sqH, canvasWidth, canvasHeight, settings);
                }
              }
            }
          }
        }
      }
      drawWatermark(canvasCtx, canvasWidth, canvasHeight, settings);
      canvasCtx.restore();
    }

    // Write Video Frame
    const outSample = new VideoSample(offscreenCanvas, { timestamp: outT, duration: frameDur });
    await vSource.add(outSample);
    outSample.close();

    // Write Interleaved Audio Frame(s) Synchronously
    if (aSource && !settings.muteAudio) {
      const targetAudioEnd = outT + frameDur;
      while (currentAudioTime < targetAudioEnd - 0.0005) {
        const currentTimelinePos = exportStart + currentAudioTime;

        // Find active audio clip across non-muted tracks
        let activeAudioClip: TimelineClip | null = null;
        for (const track of visibleTracks) {
          if (track.muted) continue;
          const clip = track.clips.find((c) => {
            if (!c.file) return false;
            const isImg = c.mediaType === 'image' || c.file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(c.file.name);
            if (isImg) return false;
            const start = c.startTime || 0;
            const dur = c.endTime !== undefined && c.endTime > start ? c.endTime - start : c.duration || c.fileDuration || 10;
            return currentTimelinePos >= start && currentTimelinePos < start + dur;
          });
          if (clip) {
            activeAudioClip = clip;
            break;
          }
        }

        if (activeAudioClip && activeAudioClip.file) {
          let audioDecoder = audioClipDecoders.get(activeAudioClip.id);
          if (!audioDecoder) {
            try {
              const input = new Input({ source: new BlobSource(activeAudioClip.file), formats: ALL_FORMATS });
              const aTracks = await input.getAudioTracks();
              if (aTracks.length > 0) {
                const aSink = new AudioSampleSink(aTracks[0]);
                const sourceStart = activeAudioClip.sourceStartTime || 0;
                const dur = activeAudioClip.endTime !== undefined && activeAudioClip.endTime > (activeAudioClip.startTime || 0)
                  ? activeAudioClip.endTime - (activeAudioClip.startTime || 0)
                  : activeAudioClip.duration || activeAudioClip.fileDuration || 10;
                const sourceEnd = (activeAudioClip.sourceEndTime !== undefined ? activeAudioClip.sourceEndTime : sourceStart + dur) + 5;
                audioDecoder = {
                  aSink,
                  iterator: aSink.samples(sourceStart, sourceEnd)[Symbol.asyncIterator](),
                };
                audioClipDecoders.set(activeAudioClip.id, audioDecoder);
              }
            } catch (e) {
              console.warn('Failed on-demand audio decoder creation', activeAudioClip.id, e);
            }
          }

          if (audioDecoder) {
            let aSample = null;
            let done = true;
            try {
              const res = await audioDecoder.iterator.next();
              aSample = res.value;
              done = res.done;
            } catch (err) {
              console.warn('Audio decoder iterator error:', err);
              audioClipDecoders.delete(activeAudioClip.id);
            }
            if (!done && aSample) {
              const adaptedSample = adaptAudioSample(aSample, MASTER_AUDIO_SAMPLE_RATE, MASTER_AUDIO_CHANNELS);
              const stepDur = adaptedSample.duration > 0 ? adaptedSample.duration : 0.02;
              adaptedSample.setTimestamp(currentAudioTime);
              await aSource.add(adaptedSample);
              currentAudioTime += stepDur;
              if (adaptedSample !== aSample) adaptedSample.close();
              try { aSample.close(); } catch {}
              continue;
            }
          }
        }

        // No audio clip active at currentTimelinePos -> fill silence buffer to keep audio track synchronized
        const gapDur = Math.min(0.04, targetAudioEnd - currentAudioTime);
        if (gapDur > 0.0001) {
          const silentSample = createSilentAudioSample(currentAudioTime, gapDur, MASTER_AUDIO_SAMPLE_RATE, MASTER_AUDIO_CHANNELS);
          await aSource.add(silentSample);
          currentAudioTime += silentSample.duration;
          silentSample.close();
        } else {
          break;
        }
      }
    }

    const now = performance.now();
    const elapsed = (now - lastProgressTime) / 1000;
    if (elapsed > 0.5) {
      const speedMBs = (totalWritten - lastBytes) / (1024 * 1024) / elapsed;
      lastProgressTime = now;
      lastBytes = totalWritten;
      const pct = Math.min(95, Math.max(5, Math.round((f / frames) * 90)));
      onProgress({
        percentage: pct,
        statusText: `Compositing Frame ${f}/${frames} (${pct}%)...`,
        speedMBs,
        log: `[WebCodecs] Frame: ${f}/${frames} | Time: ${(t - exportStart).toFixed(1)}s / ${exportDuration.toFixed(1)}s | Speed: ${speedMBs.toFixed(1)} MB/s`,
      });
    }
  }

  for (const decoder of clipDecoders.values()) {
    if (decoder.currentSample) { decoder.currentSample.close(); decoder.currentSample = null; }
    if (decoder.lastDrawnSample) { decoder.lastDrawnSample.close(); decoder.lastDrawnSample = null; }
  }

  // Finalize multiplexer output to ensure container headers (moov/cues) are written
  await output.finalize();

  let blobUrl: string | undefined;
  if (target instanceof BufferTarget && target.buffer) {
    const isMp4 = outputFormat instanceof Mp4OutputFormat;
    const isMkv = outputFormat instanceof MkvOutputFormat;
    const mime = isMp4 ? 'video/mp4' : isMkv ? 'video/x-matroska' : 'video/webm';
    const blob = new Blob([target.buffer], { type: mime });
    blobUrl = URL.createObjectURL(blob);
    totalWritten = target.buffer.byteLength;
  }

  return { success: true, totalBytesWritten: totalWritten, blobUrl };
}


/**
 * Concat multiple files / clips / tracks using WebCodecs API transcoding
 */
export async function processWebCodecsConcatStream(
  inputItems: any[],
  settings: EditSettings,
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  const isTracks = inputItems.length > 0 && inputItems[0].clips !== undefined;
  
  if (isTracks) {
    return processWebCodecsMultiTrackTimeline(
      inputItems as TimelineTrackData[],
      settings,
      writable,
      onProgress
    );
  }

  // 1. Flatten if inputItems are raw files
  const files = inputItems as File[];
  const isExplicitTrim = settings.endTime > 0 && settings.duration > 0 && settings.endTime < settings.duration - 0.1;
  const segments = files.map((f) => {
    const isImg = f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(f.name);
    const isAud = f.type.startsWith('audio/') || /\.(mp3|wav|aac|m4a|flac|ogg|opus)$/i.test(f.name);
    return {
      file: f,
      name: f.name,
      startTime: 0,
      sourceStartTime: settings.startTime || 0,
      duration: isExplicitTrim ? (settings.endTime - (settings.startTime || 0)) : (isImg ? 5 : 0),
      isImage: isImg,
      isAudio: isAud,
      isVideo: !isImg && !isAud,
      transform: undefined as ClipTransform | undefined,
    };
  });

  if (segments.length === 0) {
    throw new Error('No valid video or image files/clips provided for concatenation');
  }

  onProgress({
    percentage: 1,
    statusText: `WebCodecs Concat Engine: Preparing ${segments.length} clips...`,
    speedMBs: 0,
    log: `[WebCodecs Concat] Merging ${segments.length} stream segments with WebCodecs normalization:`,
  });

  segments.forEach((seg, i) => {
    onProgress({
      percentage: 2,
      statusText: `Inspecting [${i + 1}/${segments.length}] ${seg.name}...`,
      speedMBs: 0,
      log: `  Segment [${i + 1}]: ${seg.name} (${seg.isImage ? 'Image' : seg.isVideo ? 'Video' : 'Audio'}, Duration: ${seg.duration.toFixed(2)}s)`,
    });
  });

  // If only 1 segment and it's a single file without timeline tracks, redirect to single encode
  if (segments.length === 1 && !isTracks) {
    return processWebCodecsEncodeStream(segments[0].file, settings, writable, onProgress);
  }

  const preferredVideoCodec: VideoCodec = (settings.videoCodec as VideoCodec) || 'avc';
  const targetQuality = resolveQuality(settings.videoQuality);

  // Probe width & height from first valid video or image segment
  let sourceWidth = 1920;
  let sourceHeight = 1080;
  let hasValidDims = false;

  for (const seg of segments) {
    if (seg.isImage) {
      try {
        const bmp = await createImageBitmap(seg.file);
        if (bmp.width > 0 && bmp.height > 0) {
          sourceWidth = bmp.width;
          sourceHeight = bmp.height;
          hasValidDims = true;
          bmp.close();
          break;
        }
        bmp.close();
      } catch (e) {
        console.warn('Probe image error', e);
      }
    } else if (seg.isVideo) {
      try {
        const firstInput = new Input({ source: new BlobSource(seg.file), formats: ALL_FORMATS });
        const firstVTracks = await firstInput.getVideoTracks();
        if (firstVTracks.length > 0) {
          sourceWidth = firstVTracks[0].displayWidth || firstVTracks[0].codedWidth || 1920;
          sourceHeight = firstVTracks[0].displayHeight || firstVTracks[0].codedHeight || 1080;
          hasValidDims = true;
          break;
        }
      } catch (e) {
        console.warn('Probe video error', e);
      }
    }
  }

  // Ensure source dimensions are even
  sourceWidth = Math.max(8, sourceWidth - (sourceWidth % 8));
  sourceHeight = Math.max(8, sourceHeight - (sourceHeight % 8));

  const hasCustomAspect = Boolean(settings.cropAspect && settings.cropAspect !== 'original');
  const hasResolutionPreset = Boolean(settings.resolution && settings.resolution !== 'original');

  let canvasWidth = sourceWidth;
  let canvasHeight = sourceHeight;

  if (hasCustomAspect) {
    if (settings.cropAspect === 'free' && settings.freeCropRect) {
      const rect = settings.freeCropRect;
      canvasWidth = Math.round(sourceWidth * Math.max(0.05, Math.min(1, rect.width || 1)));
      canvasHeight = Math.round(sourceHeight * Math.max(0.05, Math.min(1, rect.height || 1)));
    } else {
      let aspectMultiplier = 16 / 9;
      switch (settings.cropAspect) {
        case '16:9': aspectMultiplier = 16 / 9; break;
        case '4:3': aspectMultiplier = 4 / 3; break;
        case '1:1': aspectMultiplier = 1 / 1; break;
        case '4:5': aspectMultiplier = 4 / 5; break;
        case '9:16': aspectMultiplier = 9 / 16; break;
        case '21:9': aspectMultiplier = 21 / 9; break;
      }
      if (sourceWidth / sourceHeight > aspectMultiplier) {
        canvasHeight = sourceHeight;
        canvasWidth = Math.round(sourceHeight * aspectMultiplier);
      } else {
        canvasWidth = sourceWidth;
        canvasHeight = Math.round(sourceWidth / aspectMultiplier);
      }
    }
    canvasWidth = Math.max(8, canvasWidth - (canvasWidth % 8));
    canvasHeight = Math.max(8, canvasHeight - (canvasHeight % 8));
  }

  if (hasResolutionPreset) {
    const targetDims = getTargetDimensions(canvasWidth, canvasHeight, settings.resolution);
    canvasWidth = targetDims.width;
    canvasHeight = targetDims.height;
  }

  const negotiated = await negotiateVideoCodec(preferredVideoCodec, canvasWidth, canvasHeight, targetQuality);
  const targetVideoCodec = negotiated.codec;
  const targetHwAccel = negotiated.hwAccel;
  const preferredAudioCodec: AudioCodec = (settings.audioCodec as AudioCodec) || 'aac';
  const targetAudioCodec = await negotiateAudioCodec(preferredAudioCodec);

  const firstSeg = segments[0];
  const ext = firstSeg.file.name.split('.').pop()?.toLowerCase() || 'mp4';
  const format =
    ext === 'webm' || targetVideoCodec === 'vp8' || targetVideoCodec === 'vp9'
      ? new WebMOutputFormat()
      : ext === 'mkv'
      ? new MkvOutputFormat()
      : new Mp4OutputFormat({ fastStart: 'in-memory' });

  const target = createWebCodecsTarget(writable);
  let totalWritten = 0;
  target.on('write', ({ end }) => {
    totalWritten = Math.max(totalWritten, end);
  });
  const output = new Output({ format, target });

  // Create single continuous output tracks
  const vSource = new VideoSampleSource({
    codec: targetVideoCodec,
    quality: targetQuality,
    hardwareAcceleration: targetHwAccel
  });
  const aSource = new AudioSampleSource({
    codec: targetAudioCodec,
    ...(settings.audioBitrate && settings.audioBitrate > 0
      ? { bitrate: settings.audioBitrate * 1000 }
      : { quality: resolveQuality('high') }),
  });

  output.addVideoTrack(vSource);
  output.addAudioTrack(aSource);

  await output.start();

  let currentVideoTime = 0;
  let currentAudioTime = 0;
  let lastWrittenVideoTime = -1;
  let lastWrittenAudioTime = -1;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const file = seg.file;
    const isImage = seg.isImage || file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(file.name);

    onProgress({
      percentage: Math.round((i / segments.length) * 100),
      statusText: `WebCodecs Concat: Encoding segment ${i + 1}/${segments.length} (${seg.name})...`,
      speedMBs: 0,
      log: `[WebCodecs Concat] Processing segment ${i + 1}/${segments.length}: ${seg.name} (${isImage ? 'Image' : 'Video'})`,
    });

    if (isImage) {
      // =========================================================================
      // 🖼️ IMAGE SEGMENT ENCODING (Generate continuous 30fps video frames)
      // =========================================================================
      const bmp = await createImageBitmap(file);
      const imgWidth = bmp.width;
      const imgHeight = bmp.height;
      const segDuration = seg.duration > 0 ? seg.duration : 5;
      const fps = (settings.fps && settings.fps > 0) ? Math.min(240, Math.max(1, Math.round(settings.fps))) : 30;
      const frames = Math.ceil(segDuration * fps);
      const frameDurationSec = 1 / fps;

      let segCanvas: OffscreenCanvas | HTMLCanvasElement;
      let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;

      if (typeof OffscreenCanvas !== 'undefined') {
        segCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
        ctx = segCanvas.getContext('2d');
      } else {
        segCanvas = document.createElement('canvas');
        segCanvas.width = canvasWidth;
        segCanvas.height = canvasHeight;
        ctx = segCanvas.getContext('2d');
      }

      const hasLayerTransform = seg.transform !== undefined;
      const t = seg.transform || { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 };
      const opacity = t.opacity ?? 1;

      for (let f = 0; f < frames; f++) {
        if (ctx) {
          ctx.save();
          ctx.clearRect(0, 0, canvasWidth, canvasHeight);
          ctx.filter = buildCanvasFilterString(settings);
          if (settings.flipH || settings.flipV) {
            ctx.translate(settings.flipH ? canvasWidth : 0, settings.flipV ? canvasHeight : 0);
            ctx.scale(settings.flipH ? -1 : 1, settings.flipV ? -1 : 1);
          }

          if (hasLayerTransform) {
            // Apply layer positioning (x/y in percentage, rotation, scale, opacity)
            const posX = (t.x / 100) * canvasWidth;
            const posY = (t.y / 100) * canvasHeight;
            const scale = t.scale || 1;
            const rotationDeg = t.rotation || 0;

            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
            if (t.blur && t.blur > 0) {
              const currentFilter = ctx.filter === 'none' ? '' : ctx.filter;
              const scaledBlur = Math.max(1, Math.round(t.blur * (canvasWidth / 640)));
              ctx.filter = `${currentFilter} blur(${scaledBlur}px)`.trim();
            }
            ctx.translate(posX, posY);
            if (rotationDeg !== 0) {
              ctx.rotate((rotationDeg * Math.PI) / 180);
            }
            ctx.scale(scale, scale);

            // Layer media is sized relative to canvasWidth with native aspect ratio (matching VideoPlayer.tsx w-full h-auto)
            const drawW = canvasWidth;
            const drawH = (imgHeight / imgWidth) * canvasWidth;
            ctx.drawImage(bmp, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();
          } else {
            const srcRatio = imgWidth / imgHeight;
            const dstRatio = canvasWidth / canvasHeight;
            let sx = 0; let sy = 0; let sw = imgWidth; let sh = imgHeight;

            if (settings.cropAspect === 'free' && settings.freeCropRect) {
              const rect = settings.freeCropRect;
              sx = Math.max(0, Math.min(imgWidth - 2, Math.round(imgWidth * (rect.x || 0))));
              sy = Math.max(0, Math.min(imgHeight - 2, Math.round(imgHeight * (rect.y || 0))));
              sw = Math.max(8, Math.min(imgWidth - sx, Math.round(imgWidth * (rect.width || 1))));
              sh = Math.max(8, Math.min(imgHeight - sy, Math.round(imgHeight * (rect.height || 1))));
            } else if (Math.abs(srcRatio - dstRatio) > 0.01) {
              if (srcRatio > dstRatio) {
                sw = imgHeight * dstRatio;
                sx = (imgWidth - sw) / 2;
              } else {
                sh = imgWidth / dstRatio;
                sy = (imgHeight - sh) / 2;
              }
            }
            ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, canvasWidth, canvasHeight);
          }
          ctx.restore();

          if (settings.watermarkText && settings.watermarkText.trim()) {
            ctx.save();
            const fontSize = settings.watermarkSize || 24;
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.fillStyle = settings.watermarkColor || '#ffffff';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            const text = settings.watermarkText;
            const textMetrics = ctx.measureText(text);
            const padding = 20;
            let x = padding; let y = canvasHeight - padding;
            switch (settings.watermarkPosition) {
              case 'top-left': x = padding; y = padding + fontSize; break;
              case 'top-right': x = canvasWidth - textMetrics.width - padding; y = padding + fontSize; break;
              case 'bottom-left': x = padding; y = canvasHeight - padding; break;
              case 'bottom-right': x = canvasWidth - textMetrics.width - padding; y = canvasHeight - padding; break;
              case 'center': x = (canvasWidth - textMetrics.width) / 2; y = (canvasHeight + fontSize) / 2; break;
            }
            ctx.fillText(text, x, y);
            ctx.restore();
          }
        }

        const pSample = new VideoSample(segCanvas, {
          timestamp: currentVideoTime + (f * frameDurationSec),
          duration: frameDurationSec,
        });
        await vSource.add(pSample);
        pSample.close();
      }

      bmp.close();
      currentVideoTime += segDuration;
      currentAudioTime += segDuration;

    } else {
      // =========================================================================
      // 🎥 VIDEO SEGMENT ENCODING
      // =========================================================================
      const input = new Input({
        source: new BlobSource(file),
        formats: ALL_FORMATS,
      });

      let maxVidDur = 0;
      let maxAudDur = 0;

      const vTracks = await input.getVideoTracks();
      const aTracks = await input.getAudioTracks();

      const hasLayerTransform = seg.transform !== undefined;
      const t = seg.transform || { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 };
      const opacity = t.opacity ?? 1;

      const needsCanvasProcessing =
        hasLayerTransform ||
        settings.filter !== 'none' ||
        settings.brightness !== 1.0 ||
        settings.contrast !== 1.0 ||
        settings.flipH ||
        settings.flipV ||
        Boolean(settings.watermarkText?.trim()) ||
        hasCustomAspect ||
        hasResolutionPreset;

      let offscreenCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
      let canvasCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;

      if (needsCanvasProcessing) {
        if (typeof OffscreenCanvas !== 'undefined') {
          offscreenCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
          canvasCtx = offscreenCanvas.getContext('2d');
        } else {
          offscreenCanvas = document.createElement('canvas');
          offscreenCanvas.width = canvasWidth;
          offscreenCanvas.height = canvasHeight;
          canvasCtx = offscreenCanvas.getContext('2d');
        }
      }

      const sourceStart = seg.sourceStartTime || 0;
      const segMaxDuration = seg.duration > 0 ? seg.duration : undefined;

      const videoPromise = (async () => {
        if (vTracks.length > 0) {
          let segmentElapsedVideoTime = 0;
          let lastSourceVideoTime = -1;
          const vSink = new VideoSampleSink(vTracks[0]);
          for await (const sample of vSink.samples()) {
            const origDuration = sample.duration || (1 / (settings.fps || 30));

            if (sourceStart > 0 && sample.timestamp < sourceStart) {
              sample.close();
              continue;
            }
            if (segMaxDuration !== undefined && sample.timestamp >= sourceStart + segMaxDuration) {
              sample.close();
              break;
            }

            if (lastSourceVideoTime !== -1) {
              let delta = sample.timestamp - lastSourceVideoTime;
              if (delta < 0 || delta > 1.0) {
                 delta = origDuration;
              }
              segmentElapsedVideoTime += delta;
            }
            lastSourceVideoTime = sample.timestamp;

            let pSample = sample;

            if (needsCanvasProcessing && offscreenCanvas && canvasCtx) {
              const canvas = offscreenCanvas;
              const ctx = canvasCtx;
              const img = pSample.toCanvasImageSource();
              const w = canvasWidth;
              const h = canvasHeight;
              
              ctx.save();
              ctx.clearRect(0, 0, w, h);

              // Apply CSS Filters (Brightness, Contrast, Grayscale, etc.)
              ctx.filter = buildCanvasFilterString(settings);

              // Apply Horizontal / Vertical Flips
              if (settings.flipH || settings.flipV) {
                ctx.translate(settings.flipH ? w : 0, settings.flipV ? h : 0);
                ctx.scale(settings.flipH ? -1 : 1, settings.flipV ? -1 : 1);
              }

              // Calculate source crop rectangle to preserve aspect ratio without distortion
              const srcWidth = pSample.squarePixelWidth;
              const srcHeight = pSample.squarePixelHeight;
              const srcRatio = srcWidth / srcHeight;
              const dstRatio = w / h;

              if (hasLayerTransform) {
                // Apply layer positioning (x/y in percentage, rotation, scale, opacity)
                const posX = (t.x / 100) * w;
                const posY = (t.y / 100) * h;
                const scale = t.scale || 1;
                const rotationDeg = t.rotation || 0;

                ctx.save();
                ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
                if (t.blur && t.blur > 0) {
                  const currentFilter = ctx.filter === 'none' ? '' : ctx.filter;
                  const scaledBlur = Math.max(1, Math.round(t.blur * (w / 640)));
                  ctx.filter = `${currentFilter} blur(${scaledBlur}px)`.trim();
                }
                ctx.translate(posX, posY);
                if (rotationDeg !== 0) {
                  ctx.rotate((rotationDeg * Math.PI) / 180);
                }
                ctx.scale(scale, scale);

                // Layer media is sized relative to canvas width with native video aspect ratio
                const drawW = w;
                const drawH = (srcHeight / srcWidth) * w;
                ctx.drawImage(img as any, 0, 0, srcWidth, srcHeight, -drawW / 2, -drawH / 2, drawW, drawH);
                ctx.restore();
              } else {
                let sx = 0;
                let sy = 0;
                let sw = srcWidth;
                let sh = srcHeight;

                if (settings.cropAspect === 'free' && settings.freeCropRect) {
                  const rect = settings.freeCropRect;
                  sx = Math.max(0, Math.min(srcWidth - 2, Math.round(srcWidth * (rect.x || 0))));
                  sy = Math.max(0, Math.min(srcHeight - 2, Math.round(srcHeight * (rect.y || 0))));
                  sw = Math.max(8, Math.min(srcWidth - sx, Math.round(srcWidth * (rect.width || 1))));
                  sh = Math.max(8, Math.min(srcHeight - sy, Math.round(srcHeight * (rect.height || 1))));
                } else if (Math.abs(srcRatio - dstRatio) > 0.01) {
                  if (srcRatio > dstRatio) {
                    sw = srcHeight * dstRatio;
                    sx = (srcWidth - sw) / 2;
                  } else {
                    sh = srcWidth / dstRatio;
                    sy = (srcHeight - sh) / 2;
                  }
                }

                ctx.drawImage(img as any, sx, sy, sw, sh, 0, 0, w, h);
              }
              ctx.restore();

              // Apply Watermark Overlay
              if (settings.watermarkText && settings.watermarkText.trim()) {
                ctx.save();
                const fontSize = settings.watermarkSize || 24;
                ctx.font = `bold ${fontSize}px sans-serif`;
                ctx.fillStyle = settings.watermarkColor || '#ffffff';
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;

                const text = settings.watermarkText;
                const textMetrics = ctx.measureText(text);
                const padding = 20;
                let x = padding;
                let y = h - padding;

                switch (settings.watermarkPosition) {
                  case 'top-left':
                    x = padding;
                    y = padding + fontSize;
                    break;
                  case 'top-right':
                    x = w - textMetrics.width - padding;
                    y = padding + fontSize;
                    break;
                  case 'bottom-left':
                    x = padding;
                    y = h - padding;
                    break;
                  case 'bottom-right':
                    x = w - textMetrics.width - padding;
                    y = h - padding;
                    break;
                  case 'center':
                    x = (w - textMetrics.width) / 2;
                    y = (h + fontSize) / 2;
                    break;
                }

                ctx.fillText(text, x, y);
                ctx.restore();
              }

              const canvasSample = new VideoSample(canvas, { timestamp: pSample.timestamp, duration: origDuration });
              pSample = canvasSample;

            } else if (pSample.squarePixelWidth !== canvasWidth || pSample.squarePixelHeight !== canvasHeight) {
                const scaledSample = await pSample.transform({ width: canvasWidth, height: canvasHeight, fit: 'cover' });
                pSample = scaledSample;
            }

            let outTime = currentVideoTime + segmentElapsedVideoTime;
            if (outTime <= lastWrittenVideoTime) outTime = lastWrittenVideoTime + 0.001;
            lastWrittenVideoTime = outTime;
            
            pSample.setTimestamp(outTime);
            await vSource.add(pSample);
            maxVidDur = Math.max(maxVidDur, segmentElapsedVideoTime + origDuration);
            if (pSample !== sample) pSample.close();
            sample.close();
          }
        }
      })();

      const audioPromise = (async () => {
        if (aTracks.length > 0 && !settings.muteAudio) {
          let segmentElapsedAudioTime = 0;
          let lastSourceAudioTime = -1;
          const aSink = new AudioSampleSink(aTracks[0]);
          for await (const sample of aSink.samples()) {
            const origDuration = sample.duration || 0.02;

            if (sourceStart > 0 && sample.timestamp < sourceStart) {
              sample.close();
              continue;
            }
            if (segMaxDuration !== undefined && sample.timestamp >= sourceStart + segMaxDuration) {
              sample.close();
              break;
            }

            if (lastSourceAudioTime !== -1) {
              let delta = sample.timestamp - lastSourceAudioTime;
              if (delta < 0 || delta > 1.0) {
                 delta = origDuration;
              }
              segmentElapsedAudioTime += delta;
            }
            lastSourceAudioTime = sample.timestamp;

            let outTime = currentAudioTime + segmentElapsedAudioTime;
            if (outTime <= lastWrittenAudioTime) outTime = lastWrittenAudioTime + origDuration;
            lastWrittenAudioTime = outTime;
            
            const adaptedSample = adaptAudioSample(sample, MASTER_AUDIO_SAMPLE_RATE, MASTER_AUDIO_CHANNELS);
            adaptedSample.setTimestamp(outTime);
            await aSource.add(adaptedSample);
            maxAudDur = Math.max(maxAudDur, segmentElapsedAudioTime + origDuration);
            if (adaptedSample !== sample) adaptedSample.close();
            sample.close();
          }
        }
      })();

      await videoPromise;

      if (aTracks.length > 0 && !settings.muteAudio) {
        await audioPromise;
      } else if (!settings.muteAudio) {
        // Generate silent audio for video segments without audio track to keep audio stream synced
        const segDur = maxVidDur > 0 ? maxVidDur : (seg.duration || 5);
        let silencePos = 0;
        while (silencePos < segDur) {
          const step = Math.min(0.1, segDur - silencePos);
          let outTime = currentAudioTime + silencePos;
          if (outTime <= lastWrittenAudioTime) outTime = lastWrittenAudioTime + 0.001;
          
          const silentSample = createSilentAudioSample(outTime, step, MASTER_AUDIO_SAMPLE_RATE, MASTER_AUDIO_CHANNELS);
          await aSource.add(silentSample);
          lastWrittenAudioTime = outTime;
          silencePos += step;
          silentSample.close();
        }
        maxAudDur = segDur;
      }

      const segDur = Math.max(maxVidDur, maxAudDur, seg.duration || 0);
      currentVideoTime += segDur;
      currentAudioTime += segDur;
    }
  }

  await output.finalize();

  let blobUrl: string | undefined;
  if (target instanceof BufferTarget && target.buffer) {
    const isMp4 = format instanceof Mp4OutputFormat;
    const isMkv = format instanceof MkvOutputFormat;
    const mime = isMp4 ? 'video/mp4' : isMkv ? 'video/x-matroska' : 'video/webm';
    const blob = new Blob([target.buffer], { type: mime });
    blobUrl = URL.createObjectURL(blob);
    totalWritten = target.buffer.byteLength;
  }

  onProgress({
    percentage: 100,
    statusText: 'WebCodecs Concat Complete!',
    speedMBs: 0,
    log: `[WebCodecs Concat] All ${segments.length} segments merged & encoded successfully! Total: ${(totalWritten / (1024 * 1024)).toFixed(2)} MB`,
  });

  return {
    success: true,
    totalBytesWritten: totalWritten,
    blobUrl,
  };
}
