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
import { EditSettings } from '../types';

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
          await writable.write(chunk);
        } catch {
          try {
            if (typeof (writable as any).seek === 'function' && typeof chunk.position === 'number') {
              await (writable as any).seek(chunk.position);
            }
            await writable.write(chunk.data);
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

  const fps = 30;
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
  let trimEnd = settings.endTime > 0 && settings.endTime < sourceDuration ? settings.endTime : undefined;
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
  let outputFormat;
  if (ext === 'webm' || settings.outputFormat === 'webm' || targetVideoCodec === 'vp8' || targetVideoCodec === 'vp9') {
    outputFormat = new WebMOutputFormat();
  } else if (ext === 'mkv') {
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
      quality: resolveQuality('high'),
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
 * Concat multiple files / clips / tracks using WebCodecs API transcoding
 */
export async function processWebCodecsConcatStream(
  inputItems: any[],
  settings: EditSettings,
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  // 1. Flatten if inputItems are tracks or files, preserving layer transform and track properties
  let segments: Array<{
    file: File;
    name: string;
    startTime: number;
    endTime?: number;
    sourceStartTime?: number;
    sourceEndTime?: number;
    duration: number;
    isImage: boolean;
    isVideo: boolean;
    isAudio: boolean;
    transform?: ClipTransform;
    trackIndex?: number;
    trackVolume?: number;
    trackMuted?: boolean;
  }> = [];

  const isTracks = inputItems.length > 0 && inputItems[0].clips !== undefined;
  
  if (isTracks) {
    const allClips: any[] = [];
    inputItems.forEach((t: any, trackIdx: number) => {
      if (!t.hidden && t.clips) {
        t.clips.forEach((c: any) => {
          allClips.push({
            ...c,
            trackIndex: trackIdx,
            trackVolume: t.volume ?? 1,
            trackMuted: !!t.muted,
          });
        });
      }
    });
    // Sort by timeline start time
    allClips.sort((a, b) => a.startTime - b.startTime);
    allClips.forEach((c: any) => {
      if (c.file) {
        const isImg = c.mediaType === 'image' || c.file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(c.file.name);
        const isAud = c.mediaType === 'audio' || c.file.type.startsWith('audio/') || /\.(mp3|wav|aac|m4a|flac|ogg|opus)$/i.test(c.file.name);
        const clipDur = (c.endTime !== undefined && c.startTime !== undefined && c.endTime > c.startTime)
          ? (c.endTime - c.startTime)
          : (c.duration || c.fileDuration || (isImg ? 5 : 10));

        segments.push({
          file: c.file,
          name: c.name || c.file.name,
          startTime: c.startTime || 0,
          endTime: c.endTime,
          sourceStartTime: c.sourceStartTime || 0,
          sourceEndTime: c.sourceEndTime,
          duration: clipDur,
          isImage: isImg,
          isAudio: isAud,
          isVideo: !isImg && !isAud,
          transform: c.transform,
          trackIndex: c.trackIndex,
          trackVolume: c.trackVolume,
          trackMuted: c.trackMuted,
        });
      }
    });
  } else {
    const files = inputItems as File[];
    segments = files.map(f => {
      const isImg = f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(f.name);
      const isAud = f.type.startsWith('audio/') || /\.(mp3|wav|aac|m4a|flac|ogg|opus)$/i.test(f.name);
      return {
        file: f,
        name: f.name,
        startTime: 0,
        sourceStartTime: settings.startTime || 0,
        duration: (settings.endTime ? settings.endTime - (settings.startTime || 0) : (isImg ? 5 : 0)),
        isImage: isImg,
        isAudio: isAud,
        isVideo: !isImg && !isAud,
      };
    });
  }

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
    quality: resolveQuality('high')
  });

  output.addVideoTrack(vSource);
  output.addAudioTrack(aSource);

  await output.start();

  let currentVideoTime = 0;
  let currentAudioTime = 0;

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
      const fps = 30;
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
          const vSink = new VideoSampleSink(vTracks[0]);
          for await (const sample of vSink.samples()) {
            const origDuration = sample.duration;

            if (sourceStart > 0 && sample.timestamp < sourceStart) {
              sample.close();
              continue;
            }
            if (segMaxDuration !== undefined && sample.timestamp >= sourceStart + segMaxDuration) {
              sample.close();
              break;
            }

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

            pSample.setTimestamp(Math.max(0, pSample.timestamp - sourceStart) + currentVideoTime);
            await vSource.add(pSample);
            maxVidDur = Math.max(maxVidDur, (pSample.timestamp + origDuration) - currentVideoTime);
            if (pSample !== sample) pSample.close();
            sample.close();
          }
        }
      })();

      const audioPromise = (async () => {
        if (aTracks.length > 0 && !settings.muteAudio) {
          const aSink = new AudioSampleSink(aTracks[0]);
          for await (const sample of aSink.samples()) {
            const origDuration = sample.duration;

            if (sourceStart > 0 && sample.timestamp < sourceStart) {
              sample.close();
              continue;
            }
            if (segMaxDuration !== undefined && sample.timestamp >= sourceStart + segMaxDuration) {
              sample.close();
              break;
            }

            sample.setTimestamp(Math.max(0, sample.timestamp - sourceStart) + currentAudioTime);
            await aSource.add(sample);
            maxAudDur = Math.max(maxAudDur, (sample.timestamp + origDuration) - currentAudioTime);
            sample.close();
          }
        }
      })();

      await Promise.all([videoPromise, audioPromise]);

      currentVideoTime += maxVidDur > 0 ? maxVidDur : (seg.duration || 0);
      currentAudioTime += maxAudDur > 0 ? maxAudDur : (seg.duration || 0);
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
