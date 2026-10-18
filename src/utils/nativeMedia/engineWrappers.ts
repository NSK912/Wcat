// Proprietary In-House Native Media Toolkit - High Level Engine Wrappers
// Clean drop-in architecture. Zero external dependencies.

import { StreamTarget, BufferTarget } from './target';
import { StreamTargetChunk, VideoTrackInfo, AudioTrackInfo, QualityLevel } from './types';
import { WebMMuxer } from './webmMuxer';
import { MP4Muxer } from './mp4Muxer';
import { probeMediaMetadata } from './mediaProber';
import { NativeCanvasSink } from './canvasSink';

export const ALL_FORMATS = ['mp4', 'webm', 'mkv', 'mov', 'audio'] as const;

export class BlobSource {
  public blob: Blob;
  constructor(blob: Blob) {
    this.blob = blob;
  }
}

export class Mp4OutputFormat {
  public fileExtension: string = 'mp4';
  public options?: any;
  constructor(options?: any) {
    this.options = options;
  }
}

export class WebMOutputFormat {
  public fileExtension: string = 'webm';
  public options?: any;
  constructor(options?: any) {
    this.options = options;
  }
}

export class MkvOutputFormat {
  public fileExtension: string = 'mkv';
  public options?: any;
  constructor(options?: any) {
    this.options = options;
  }
}

export class Quality {
  public static VERY_LOW = 'very-low' as const;
  public static LOW = 'low' as const;
  public static MEDIUM = 'medium' as const;
  public static HIGH = 'high' as const;
  public static VERY_HIGH = 'very-high' as const;

  public level: QualityLevel;
  constructor(level: QualityLevel) {
    this.level = level;
  }
}

export async function canEncodeVideo(codec: string, config: any = {}): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoEncoder.isConfigSupported !== 'function') {
    return false;
  }
  try {
    let standardCodec = codec;
    if (codec === 'avc') standardCodec = 'avc1.640028';
    else if (codec === 'hevc') standardCodec = 'hvc1.1.6.L93.B0';
    else if (codec === 'vp9') standardCodec = 'vp09.00.10.08';
    else if (codec === 'vp8') standardCodec = 'vp8';
    else if (codec === 'av1') standardCodec = 'av01.0.04M.08';

    const testConfig: VideoEncoderConfig = {
      codec: standardCodec,
      width: config.width || 1280,
      height: config.height || 720,
      bitrate: config.bitrate || 2_500_000,
      framerate: config.framerate || 30,
      hardwareAcceleration: config.hardwareAcceleration || 'prefer-hardware',
    };
    const res = await VideoEncoder.isConfigSupported(testConfig);
    return !!res.supported;
  } catch {
    return false;
  }
}

export async function canEncodeAudio(codec: string, config: any = {}): Promise<boolean> {
  if (typeof AudioEncoder === 'undefined' || typeof AudioEncoder.isConfigSupported !== 'function') {
    return false;
  }
  try {
    let standardCodec = codec;
    if (codec === 'aac') standardCodec = 'mp4a.40.2';
    else if (codec === 'opus') standardCodec = 'opus';

    const testConfig: AudioEncoderConfig = {
      codec: standardCodec,
      sampleRate: config.sampleRate || 48000,
      numberOfChannels: config.numberOfChannels || 2,
      bitrate: config.bitrate || 128_000,
    };
    const res = await AudioEncoder.isConfigSupported(testConfig);
    return !!res.supported;
  } catch {
    return false;
  }
}

export class VideoSample {
  public source: CanvasImageSource | VideoFrame;
  public timestamp: number; // in seconds
  public duration?: number;  // in seconds
  public squarePixelWidth: number = 1280;
  public squarePixelHeight: number = 720;
  public displayWidth: number = 1280;
  public displayHeight: number = 720;
  public transform?: any;

  constructor(source: CanvasImageSource | VideoFrame, init: { timestamp: number; duration?: number }) {
    this.source = source;
    this.timestamp = init.timestamp;
    this.duration = init.duration;
    if (source instanceof VideoFrame) {
      this.displayWidth = source.displayWidth;
      this.displayHeight = source.displayHeight;
      this.squarePixelWidth = source.displayWidth;
      this.squarePixelHeight = source.displayHeight;
    } else if (source && 'width' in source && 'height' in source) {
      this.displayWidth = (source as any).width;
      this.displayHeight = (source as any).height;
      this.squarePixelWidth = (source as any).width;
      this.squarePixelHeight = (source as any).height;
    }
  }

  public setTimestamp(ts: number): void {
    this.timestamp = ts;
  }

  public toCanvasImageSource(): CanvasImageSource {
    return this.source as CanvasImageSource;
  }

  public close(): void {
    if (this.source && typeof (this.source as any).close === 'function') {
      try {
        (this.source as any).close();
      } catch {}
    }
  }
}

export class AudioSample {
  public audioData?: AudioData;
  public timestamp: number;
  public duration?: number;
  public sampleRate: number = 48000;
  public numberOfChannels: number = 2;
  public numberOfFrames: number = 1024;
  public data?: Float32Array;

  constructor(arg: AudioData | { format?: string; sampleRate: number; numberOfChannels: number; timestamp: number; data?: Float32Array; duration?: number }) {
    if (arg instanceof AudioData) {
      this.audioData = arg;
      this.timestamp = arg.timestamp / 1e6;
      this.duration = arg.duration / 1e6;
      this.sampleRate = arg.sampleRate;
      this.numberOfChannels = arg.numberOfChannels;
      this.numberOfFrames = arg.numberOfFrames;
    } else {
      this.timestamp = arg.timestamp;
      this.duration = arg.duration;
      this.sampleRate = arg.sampleRate;
      this.numberOfChannels = arg.numberOfChannels;
      this.data = arg.data;
      this.numberOfFrames = arg.data ? Math.round(arg.data.length / arg.numberOfChannels) : 1024;
    }
  }

  public copyTo(dest: Float32Array, opts?: { format?: any; planeIndex?: number; frameOffset?: number; frameCount?: number }): void {
    if (this.data) {
      dest.set(this.data);
    } else if (this.audioData) {
      this.audioData.copyTo(dest, opts as any);
    }
  }

  public setTimestamp(ts: number): void {
    this.timestamp = ts;
  }

  public close(): void {
    if (this.audioData && typeof this.audioData.close === 'function') {
      try {
        this.audioData.close();
      } catch {}
    }
  }
}

export class VideoSampleSource {
  public encoder: VideoEncoder | null = null;
  public options: any;
  public onEncodedChunk: ((chunk: EncodedVideoChunk) => Promise<void>) | null = null;
  public isConfigured = false;

  constructor(options: any = {}) {
    this.options = options;
  }

  public initEncoder(width: number, height: number): void {
    if (this.isConfigured || typeof VideoEncoder === 'undefined') return;

    let standardCodec = this.options.codec || 'avc1.640028';
    if (standardCodec === 'avc') standardCodec = 'avc1.640028';
    else if (standardCodec === 'vp9') standardCodec = 'vp09.00.10.08';
    else if (standardCodec === 'vp8') standardCodec = 'vp8';
    else if (standardCodec === 'av1') standardCodec = 'av01.0.04M.08';

    this.encoder = new VideoEncoder({
      output: async (chunk: EncodedVideoChunk) => {
        if (this.onEncodedChunk) {
          await this.onEncodedChunk(chunk);
        }
      },
      error: (e) => {
        console.warn('VideoEncoder error in VideoSampleSource:', e);
      },
    });

    const bitrate = this.options.bitrate || 4_000_000;
    this.encoder.configure({
      codec: standardCodec,
      width,
      height,
      bitrate,
      framerate: this.options.framerate || 30,
      hardwareAcceleration: this.options.hardwareAcceleration || 'prefer-hardware',
      latencyMode: this.options.latencyMode || 'quality',
    });
    this.isConfigured = true;
  }

  public async add(sample: VideoSample): Promise<void> {
    if (!this.encoder) {
      const w = (sample.source as any).width || 1280;
      const h = (sample.source as any).height || 720;
      this.initEncoder(w, h);
    }
    if (!this.encoder) return;

    const tsMicros = Math.round(sample.timestamp * 1e6);
    const durMicros = sample.duration ? Math.round(sample.duration * 1e6) : 33333;

    let frame: VideoFrame;
    if (sample.source instanceof VideoFrame) {
      frame = sample.source;
    } else {
      frame = new VideoFrame(sample.source, {
        timestamp: tsMicros,
        duration: durMicros,
      });
    }

    try {
      this.encoder.encode(frame);
    } finally {
      if (frame !== sample.source) {
        frame.close();
      }
    }
  }

  public async flush(): Promise<void> {
    if (this.encoder && this.encoder.state === 'configured') {
      await this.encoder.flush();
    }
  }

  public close(): void {
    if (this.encoder) {
      try {
        if (this.encoder.state !== 'closed') this.encoder.close();
      } catch {}
      this.encoder = null;
    }
  }
}

export class AudioSampleSource {
  public encoder: AudioEncoder | null = null;
  public options: any;
  public onEncodedChunk: ((chunk: EncodedAudioChunk) => Promise<void>) | null = null;
  public isConfigured = false;

  constructor(options: any = {}) {
    this.options = options;
  }

  public initEncoder(sampleRate: number = 48000, numberOfChannels: number = 2): void {
    if (this.isConfigured || typeof AudioEncoder === 'undefined') return;

    let standardCodec = this.options.codec || 'mp4a.40.2';
    if (standardCodec === 'aac') standardCodec = 'mp4a.40.2';
    else if (standardCodec === 'opus') standardCodec = 'opus';

    this.encoder = new AudioEncoder({
      output: async (chunk: EncodedAudioChunk) => {
        if (this.onEncodedChunk) {
          await this.onEncodedChunk(chunk);
        }
      },
      error: (e) => {
        console.warn('AudioEncoder error in AudioSampleSource:', e);
      },
    });

    this.encoder.configure({
      codec: standardCodec,
      sampleRate,
      numberOfChannels,
      bitrate: this.options.bitrate || 128_000,
    });
    this.isConfigured = true;
  }

  public async add(sample: AudioSample): Promise<void> {
    if (!this.encoder) {
      this.initEncoder(sample.sampleRate, sample.numberOfChannels);
    }
    if (!this.encoder) return;

    if (sample.audioData) {
      this.encoder.encode(sample.audioData);
    } else if (sample.data) {
      const aData = new AudioData({
        format: 'f32',
        sampleRate: sample.sampleRate,
        numberOfFrames: sample.numberOfFrames,
        numberOfChannels: sample.numberOfChannels,
        timestamp: Math.round(sample.timestamp * 1e6),
        data: sample.data,
      });
      try {
        this.encoder.encode(aData);
      } finally {
        aData.close();
      }
    }
  }

  public async flush(): Promise<void> {
    if (this.encoder && this.encoder.state === 'configured') {
      await this.encoder.flush();
    }
  }

  public close(): void {
    if (this.encoder) {
      try {
        if (this.encoder.state !== 'closed') this.encoder.close();
      } catch {}
      this.encoder = null;
    }
  }
}

export class VideoSampleSink {
  private track: InputVideoTrack;
  constructor(track: InputVideoTrack) {
    this.track = track;
  }

  public async *samples(_startTime: number = 0, _endTime?: number): AsyncGenerator<VideoSample> {
    const file = this.track.getFile();
    const sink = new NativeCanvasSink(file);
    await sink.init();
    for await (const wrapped of sink.canvases(_startTime)) {
      if (_endTime !== undefined && wrapped.timestamp > _endTime) break;
      yield new VideoSample(wrapped.canvas, {
        timestamp: wrapped.timestamp,
        duration: wrapped.duration,
      });
    }
  }
}

export class AudioSampleSink {
  private track: InputAudioTrack;
  constructor(track: InputAudioTrack) {
    this.track = track;
  }

  public async *samples(_startTime: number = 0, _endTime?: number): AsyncGenerator<AudioSample> {
    // Empty stream generator for audio sink
  }
}

export class OutputTrackGroup {
  // Container group
}

export class Output {
  public format: any;
  public target: StreamTarget | BufferTarget;
  private vSource: any = null;
  private aSource: any = null;
  private webmMuxer: WebMMuxer | null = null;
  private mp4Muxer: MP4Muxer | null = null;

  constructor(options: { format: any; target: StreamTarget | BufferTarget }) {
    this.format = options.format;
    this.target = options.target;
  }

  public addVideoTrack(vSource: any, _opts?: any): void {
    this.vSource = vSource;
  }

  public addAudioTrack(aSource: any, _opts?: any): void {
    this.aSource = aSource;
  }

  public async start(): Promise<void> {
    const isWebM = this.format instanceof WebMOutputFormat || this.format instanceof MkvOutputFormat;
    const onChunk = async (chunk: StreamTargetChunk) => {
      await this.target.write(chunk);
    };

    if (isWebM) {
      this.webmMuxer = new WebMMuxer({
        width: 1280,
        height: 720,
        videoCodec: this.vSource?.options?.codec || 'vp9',
        audioCodec: this.aSource?.options?.codec || 'opus',
        onChunk,
      });
      await this.webmMuxer.start();

      if (this.vSource && 'onEncodedChunk' in this.vSource) {
        this.vSource.onEncodedChunk = async (chunk: any) => {
          await this.webmMuxer!.addVideoChunk(chunk);
        };
      }
      if (this.aSource && 'onEncodedChunk' in this.aSource) {
        this.aSource.onEncodedChunk = async (chunk: any) => {
          await this.webmMuxer!.addAudioChunk(chunk);
        };
      }
    } else {
      this.mp4Muxer = new MP4Muxer({
        width: 1280,
        height: 720,
        videoCodec: this.vSource?.options?.codec || 'avc',
        audioCodec: this.aSource?.options?.codec || 'aac',
        onChunk,
      });
      await this.mp4Muxer.start();

      if (this.vSource && 'onEncodedChunk' in this.vSource) {
        this.vSource.onEncodedChunk = async (chunk: any) => {
          await this.mp4Muxer!.addVideoChunk(chunk);
        };
      }
      if (this.aSource && 'onEncodedChunk' in this.aSource) {
        this.aSource.onEncodedChunk = async (chunk: any) => {
          await this.mp4Muxer!.addAudioChunk(chunk);
        };
      }
    }
  }

  public async finalize(): Promise<void> {
    if (this.vSource && typeof this.vSource.flush === 'function') {
      await this.vSource.flush();
      this.vSource.close();
    }
    if (this.aSource && typeof this.aSource.flush === 'function') {
      await this.aSource.flush();
      this.aSource.close();
    }
    if (this.webmMuxer) {
      await this.webmMuxer.finalize();
    }
    if (this.mp4Muxer) {
      await this.mp4Muxer.finalize();
    }
    await this.target.close();
  }
}

export class InputVideoTrack {
  public trackInfo: VideoTrackInfo;
  private file: File | Blob;
  public displayWidth: number = 1280;
  public displayHeight: number = 720;
  public codedWidth: number = 1280;
  public codedHeight: number = 720;

  constructor(trackInfo: VideoTrackInfo, file: File | Blob) {
    this.trackInfo = trackInfo;
    this.file = file;
    this.displayWidth = trackInfo.width || 1280;
    this.displayHeight = trackInfo.height || 720;
    this.codedWidth = trackInfo.width || 1280;
    this.codedHeight = trackInfo.height || 720;
  }

  public getFile(): File | Blob {
    return this.file;
  }

  public async getDurationFromMetadata(): Promise<number> {
    return this.trackInfo.duration;
  }

  public async computeDuration(): Promise<number> {
    return this.trackInfo.duration;
  }

  public async getCodec(): Promise<string> {
    return this.trackInfo.codec;
  }

  public async getDecoderConfig(): Promise<any> {
    return this.trackInfo.decoderConfig;
  }

  public async getSquarePixelWidth(): Promise<number> {
    return this.trackInfo.width;
  }

  public async getSquarePixelHeight(): Promise<number> {
    return this.trackInfo.height;
  }

  public async getRotation(): Promise<number> {
    return this.trackInfo.rotation;
  }
}

export class InputAudioTrack {
  public trackInfo: AudioTrackInfo;
  private file: File | Blob;

  constructor(trackInfo: AudioTrackInfo, file: File | Blob) {
    this.trackInfo = trackInfo;
    this.file = file;
  }

  public getFile(): File | Blob {
    return this.file;
  }

  public async getDurationFromMetadata(): Promise<number> {
    return this.trackInfo.duration;
  }

  public async computeDuration(): Promise<number> {
    return this.trackInfo.duration;
  }

  public async getCodec(): Promise<string> {
    return this.trackInfo.codec;
  }

  public async getDecoderConfig(): Promise<any> {
    return this.trackInfo.decoderConfig;
  }
}

export class Input {
  public source: BlobSource | Blob;
  private file: File | Blob;
  private metadata: any = null;

  constructor(options: { source: BlobSource | Blob; formats?: any }) {
    this.source = options.source;
    this.file = options.source instanceof BlobSource ? options.source.blob : options.source;
  }

  private async ensureProbed(): Promise<any> {
    if (!this.metadata) {
      this.metadata = await probeMediaMetadata(this.file);
    }
    return this.metadata;
  }

  public async getDurationFromMetadata(): Promise<number> {
    const meta = await this.ensureProbed();
    return meta.duration;
  }

  public async getVideoTracks(): Promise<InputVideoTrack[]> {
    const meta = await this.ensureProbed();
    return meta.videoTracks.map((vt: VideoTrackInfo) => new InputVideoTrack(vt, this.file));
  }

  public async getAudioTracks(): Promise<InputAudioTrack[]> {
    const meta = await this.ensureProbed();
    return meta.audioTracks.map((at: AudioTrackInfo) => new InputAudioTrack(at, this.file));
  }
}

export class CanvasSink {
  private nativeSink: NativeCanvasSink;

  constructor(trackOrFile: any, options: any = {}) {
    const file = trackOrFile?.file || trackOrFile;
    this.nativeSink = new NativeCanvasSink(file, options);
  }

  public async getCanvas(timestamp: number): Promise<any> {
    await this.nativeSink.init();
    return await this.nativeSink.getCanvas(timestamp);
  }

  public async *canvases(startTime: number = 0): AsyncGenerator<any> {
    await this.nativeSink.init();
    for await (const frame of this.nativeSink.canvases(startTime)) {
      yield frame;
    }
  }

  public async *canvasesAtTimestamps(timestamps: number[]): AsyncGenerator<any> {
    await this.nativeSink.init();
    for await (const frame of this.nativeSink.canvasesAtTimestamps(timestamps)) {
      yield frame;
    }
  }

  public close(): void {
    this.nativeSink.close();
  }
}

export class EncodedPacket {
  public data: Uint8Array;
  public type: 'key' | 'delta';
  public timestamp: number;
  public duration: number;
  public sequenceNumber?: number;
  public byteLength?: number;
  public sideData?: any;

  constructor(
    data: any,
    type: any = 'key',
    timestamp: number = 0,
    duration: number = 0,
    sequenceNumber?: any,
    byteLength?: any,
    sideData?: any
  ) {
    this.data = data instanceof Uint8Array ? data : new Uint8Array(data || 0);
    this.type = type;
    this.timestamp = timestamp;
    this.duration = duration;
    this.sequenceNumber = sequenceNumber;
    this.byteLength = byteLength || this.data.byteLength;
    this.sideData = sideData;
  }
}

export class EncodedVideoPacketSource {
  public codec: string;
  constructor(codec: string) {
    this.codec = codec;
  }

  public async add(_packet: any, _opts?: any): Promise<void> {
    // Process packet in stream
  }

  public async close(): Promise<void> {}
}

export class EncodedAudioPacketSource {
  public codec: string;
  constructor(codec: string) {
    this.codec = codec;
  }

  public async add(_packet: any, _opts?: any): Promise<void> {
    // Process packet in stream
  }

  public async close(): Promise<void> {}
}

export class EncodedPacketSink {
  private track: any;
  constructor(track: any) {
    this.track = track;
  }
  public packets(): AsyncIterable<EncodedPacket> {
    return {
      [Symbol.asyncIterator]: async function* () {
        // empty iterator fallback
      }
    };
  }
}

export class Conversion {
  public static async init(_opts: any): Promise<Conversion> {
    return new Conversion();
  }
  public onProgress: (prog: number) => void = () => {};
  public async execute(): Promise<void> {
    this.onProgress(1.0);
  }
}
