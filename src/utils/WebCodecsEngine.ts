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
    const w = Math.max(2, baseWidth - (baseWidth % 2));
    const h = Math.max(2, baseHeight - (baseHeight % 2));
    return { width: w, height: h };
  }

  let targetShortDim = 1080;
  switch (resolution) {
    case '480':
      targetShortDim = 480;
      break;
    case '720':
      targetShortDim = 720;
      break;
    case '1080':
      targetShortDim = 1080;
      break;
    case '2k':
      targetShortDim = 1440;
      break;
    case '4k':
      targetShortDim = 2160;
      break;
    case '8k':
      targetShortDim = 4320;
      break;
    default:
      targetShortDim = 1080;
      break;
  }

  const aspectRatio = baseWidth / baseHeight;
  let targetWidth: number;
  let targetHeight: number;

  if (baseWidth >= baseHeight) {
    // Landscape or square: short dimension is height
    targetHeight = targetShortDim;
    targetWidth = Math.round(targetShortDim * aspectRatio);
  } else {
    // Portrait: short dimension is width
    targetWidth = targetShortDim;
    targetHeight = Math.round(targetShortDim / aspectRatio);
  }

  // Ensure dimensions are even numbers for encoder compatibility
  targetWidth = Math.max(2, targetWidth - (targetWidth % 2));
  targetHeight = Math.max(2, targetHeight - (targetHeight % 2));

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
): Promise<VideoCodec> {
  const safeWidth = Math.max(2, width - (width % 2));
  const safeHeight = Math.max(2, height - (height % 2));

  try {
    const isSupported = await canEncodeVideo(preferredCodec, {
      width: safeWidth,
      height: safeHeight,
      quality,
      hardwareAcceleration: hwAcceleration,
    });
    if (isSupported) return preferredCodec;
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
      if (supported) return candidate;
    } catch {}
  }

  // Fallback to no-preference if specific hardware/software constraint fails
  if (hwAcceleration !== 'no-preference') {
    return negotiateVideoCodec(preferredCodec, width, height, quality, 'no-preference');
  }

  return preferredCodec;
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
export async function processWebCodecsEncodeStream(
  file: File,
  settings: EditSettings,
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  if (!isWebCodecsSupported()) {
    throw new Error('WebCodecs API is not supported in this browser.');
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
  const sourceWidth = Math.max(2, rawWidth - (rawWidth % 2));
  const sourceHeight = Math.max(2, rawHeight - (rawHeight % 2));

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
    canvasWidth = Math.max(2, canvasWidth - (canvasWidth % 2));
    canvasHeight = Math.max(2, canvasHeight - (canvasHeight % 2));

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
  const targetVideoCodec = await negotiateVideoCodec(
    preferredVideoCodec,
    canvasWidth,
    canvasHeight,
    targetQuality,
    speedConfig.hardwareAcceleration
  );

  const preferredAudioCodec: AudioCodec = (settings.audioCodec as AudioCodec) || 'aac';
  const targetAudioCodec = await negotiateAudioCodec(preferredAudioCodec);

  // Determine Output Format compatible with negotiated codecs
  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  let outputFormat;
  if (ext === 'webm' || settings.outputFormat === 'webm' || targetVideoCodec === 'vp8') {
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
      hardwareAcceleration: speedConfig.hardwareAcceleration,
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
              sw = Math.max(2, Math.min(srcWidth - sx, Math.round(srcWidth * (rect.width || 1))));
              sh = Math.max(2, Math.min(srcHeight - sy, Math.round(srcHeight * (rect.height || 1))));
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
    log: `[WebCodecs API] VideoEncoder started with Codec: ${targetVideoCodec.toUpperCase()} (Audio: ${targetAudioCodec.toUpperCase()}) | Quality: ${settings.videoQuality || 'high'}`,
  });

  await conversion.execute();

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
 * Concat multiple files using WebCodecs API transcoding
 */
export async function processWebCodecsConcatStream(
  inputItems: any[],
  settings: EditSettings,
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
// 1. Flatten if inputItems are tracks
  let files: File[] = [];
  let segments: any[] = [];
  const isTracks = inputItems.length > 0 && inputItems[0].clips !== undefined;
  
  if (isTracks) {
    const allClips = [];
    inputItems.forEach(t => {
      if (!t.hidden) {
        t.clips.forEach(c => allClips.push(c));
      }
    });
    // Sort by timeline start time
    allClips.sort((a, b) => a.startTime - b.startTime);
    allClips.forEach(c => {
      if (c.file && (c.mediaType === 'video' || c.file.type.startsWith('video/'))) {
        segments.push({
          file: c.file,
          name: c.name || c.file.name,
          startTime: c.startTime,
          sourceStartTime: c.sourceStartTime || 0,
          duration: c.duration || c.fileDuration || 0
        });
        files.push(c.file);
      }
    });
  } else {
    files = inputItems as File[];
    segments = files.map(f => ({
      file: f,
      name: f.name,
      sourceStartTime: settings.startTime || 0,
      duration: (settings.endTime ? settings.endTime - (settings.startTime || 0) : 0)
    }));
  }

  if (segments.length === 0) {
    throw new Error('No valid video files/clips provided for concatenation');
  }

  onProgress({
    percentage: 1,
    statusText: `WebCodecs Concat Engine: Preparing ${files.length} files...`,
    speedMBs: 0,
    log: `[WebCodecs Concat] Merging ${files.length} video streams with WebCodecs normalization:`,
  });

  files.forEach((f, i) => {
    onProgress({
      percentage: 2,
      statusText: `Inspecting [${i + 1}/${files.length}] ${f.name}...`,
      speedMBs: 0,
      log: `  File [${i + 1}]: ${f.name} (${(f.size / (1024 * 1024)).toFixed(2)} MB)`,
    });
  });

  // If only 1 file, redirect to single encode
  if (files.length === 1) {
    return processWebCodecsEncodeStream(files[0], settings, writable, onProgress);
  }

  const firstFile = files[0];
  const preferredVideoCodec: VideoCodec = (settings.videoCodec as VideoCodec) || 'avc';
  const targetQuality = resolveQuality(settings.videoQuality);
  const targetVideoCodec = await negotiateVideoCodec(preferredVideoCodec, 1920, 1080, targetQuality);
  const preferredAudioCodec: AudioCodec = (settings.audioCodec as AudioCodec) || 'aac';
  const targetAudioCodec = await negotiateAudioCodec(preferredAudioCodec);

  const ext = firstFile.name.split('.').pop()?.toLowerCase() || 'mp4';
  const format =
    ext === 'webm' || targetVideoCodec === 'vp8'
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
    width: 1920,
    height: 1080,
    hardwareAcceleration: 'no-preference'
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

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress({
      percentage: Math.round((i / files.length) * 100),
      statusText: `WebCodecs Concat: Encoding segment ${i + 1}/${files.length} (${file.name})...`,
      speedMBs: 0,
      log: `[WebCodecs Concat] Processing segment ${i + 1}/${files.length}: ${file.name}`,
    });

    const input = new Input({
      source: new BlobSource(file),
      formats: ALL_FORMATS,
    });

    let maxVidDur = 0;
    let maxAudDur = 0;

    const vTracks = await input.getVideoTracks();
    if (vTracks.length > 0) {
      const vSink = new VideoSampleSink(vTracks[0]);
      for await (const sample of vSink.samples()) {
        const origDuration = sample.duration;
        let pSample = sample;
        if (sample.squarePixelWidth !== 1920 || sample.squarePixelHeight !== 1080) {
            pSample = await sample.transform({ width: 1920, height: 1080, fit: 'cover' });
        }
        pSample.setTimestamp(pSample.timestamp + currentVideoTime);
        await vSource.add(pSample);
        maxVidDur = Math.max(maxVidDur, pSample.timestamp + origDuration - currentVideoTime);
        if (pSample !== sample) pSample.close();
        sample.close();
      }
    }

    const aTracks = await input.getAudioTracks();
    if (aTracks.length > 0 && !settings.muteAudio) {
      const aSink = new AudioSampleSink(aTracks[0]);
      for await (const sample of aSink.samples()) {
        const origDuration = sample.duration;
        sample.setTimestamp(sample.timestamp + currentAudioTime);
        await aSource.add(sample);
        maxAudDur = Math.max(maxAudDur, sample.timestamp + origDuration - currentAudioTime);
        sample.close();
      }
    }

    currentVideoTime += maxVidDur;
    currentAudioTime += maxAudDur;
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
    log: `[WebCodecs Concat] All ${files.length} files merged & encoded successfully! Total: ${(totalWritten / (1024 * 1024)).toFixed(2)} MB`,
  });

  return {
    success: true,
    totalBytesWritten: totalWritten,
    blobUrl,
  };
}
