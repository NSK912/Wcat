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
 * Automatically negotiates a supported video codec for the given resolution/quality.
 * Falls back across AVC -> VP9 -> VP8 -> AV1 -> HEVC if a specific profile is not supported.
 */
async function negotiateVideoCodec(
  preferredCodec: VideoCodec,
  width: number,
  height: number,
  quality: Quality
): Promise<VideoCodec> {
  const safeWidth = Math.max(2, width - (width % 2));
  const safeHeight = Math.max(2, height - (height % 2));

  try {
    const isSupported = await canEncodeVideo(preferredCodec, {
      width: safeWidth,
      height: safeHeight,
      quality,
      hardwareAcceleration: 'no-preference',
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
        hardwareAcceleration: 'no-preference',
      });
      if (supported) return candidate;
    } catch {}
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
  const trimStart = settings.startTime > 0 ? settings.startTime : undefined;
  const trimEnd = settings.endTime > 0 && settings.endTime < sourceDuration ? settings.endTime : undefined;

  onProgress({
    percentage: 5,
    statusText: 'Negotiating WebCodecs VideoEncoder & AudioEncoder configuration...',
    speedMBs: 0,
    log: `[WebCodecs API] Trim Range: ${trimStart ? `${trimStart.toFixed(2)}s` : '0.00s'} -> ${trimEnd ? `${trimEnd.toFixed(2)}s` : `${sourceDuration.toFixed(2)}s`}`,
  });

  // Determine Video Codec & Quality with fallback negotiation
  const preferredVideoCodec: VideoCodec = (settings.videoCodec as VideoCodec) || 'avc';
  const targetQuality = resolveQuality(settings.videoQuality);
  const targetVideoCodec = await negotiateVideoCodec(
    preferredVideoCodec,
    sourceWidth,
    sourceHeight,
    targetQuality
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

  // Check if we need canvas frame filtering (brightness, contrast, watermark, filters, flip)
  const needsCanvasProcessing =
    settings.filter !== 'none' ||
    settings.brightness !== 1.0 ||
    settings.contrast !== 1.0 ||
    settings.flipH ||
    settings.flipV ||
    Boolean(settings.watermarkText?.trim());

  let offscreenCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
  let canvasCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;

  if (needsCanvasProcessing) {
    if (typeof OffscreenCanvas !== 'undefined') {
      offscreenCanvas = new OffscreenCanvas(sourceWidth, sourceHeight);
      canvasCtx = offscreenCanvas.getContext('2d');
    } else if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = sourceWidth;
      c.height = sourceHeight;
      offscreenCanvas = c;
      canvasCtx = c.getContext('2d');
    }
  }

  // Configure Mediabunny WebCodecs Pipeline with 'no-preference' to support both HW & SW encoding
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
      hardwareAcceleration: 'no-preference',
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

            ctx.drawImage(img as any, 0, 0, w, h);
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
  files: File[],
  settings: EditSettings,
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  if (files.length === 0) {
    throw new Error('No files provided for concatenation');
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

  // Build sequential conversions per file
  let currentFileIdx = 0;
  for (const file of files) {
    currentFileIdx++;
    onProgress({
      percentage: Math.round(((currentFileIdx - 1) / files.length) * 100),
      statusText: `WebCodecs Concat: Encoding segment ${currentFileIdx}/${files.length} (${file.name})...`,
      speedMBs: 0,
      log: `[WebCodecs Concat] Processing segment ${currentFileIdx}/${files.length}: ${file.name}`,
    });

    const input = new Input({
      source: new BlobSource(file),
      formats: ALL_FORMATS,
    });

    const conversion = await Conversion.init({
      input,
      output,
      composable: true, // Allows multiple file segments targeting the same output
      video: {
        forceTranscode: true,
        codec: targetVideoCodec,
        quality: targetQuality,
        hardwareAcceleration: 'no-preference',
      },
      audio: {
        discard: settings.muteAudio,
        forceTranscode: true,
        codec: targetAudioCodec,
        quality: resolveQuality('high'),
      },
    });

    conversion.onProgress = (prog: number) => {
      const overall = Math.round((((currentFileIdx - 1) + prog) / files.length) * 100);
      onProgress({
        percentage: Math.min(99, overall),
        statusText: `WebCodecs Concat [${currentFileIdx}/${files.length}]: ${Math.round(prog * 100)}%`,
        speedMBs: 0,
      });
    };

    await conversion.execute();
  }

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
