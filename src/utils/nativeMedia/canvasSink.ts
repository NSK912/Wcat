// Proprietary In-House Native Media Toolkit - Hardware Accelerated CanvasSink
// Uses native browser WebCodecs (VideoDecoder) + OffscreenCanvas.
// 100% Worker compatible, zero-freeze.

import { CanvasSinkOptions, WrappedCanvas, MediaSample } from './types';
import { MP4Demuxer } from './mp4Demuxer';
import { EBMLDemuxer } from './ebmlDemuxer';

export class NativeCanvasSink {
  private file: File | Blob;
  private options: CanvasSinkOptions;
  private mp4: MP4Demuxer | null = null;
  private ebml: EBMLDemuxer | null = null;
  private decoder: VideoDecoder | null = null;
  private offscreenCanvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D | null;
  private currentDecodedFrame: VideoFrame | null = null;
  private framePromiseResolve: ((frame: VideoFrame | null) => void) | null = null;
  private isDecoderConfigured = false;
  private decoderConfig: VideoDecoderConfig | null = null;
  private samples: MediaSample[] = [];
  public duration: number = 0;
  public width: number = 1280;
  public height: number = 720;
  public rotation: number = 0;

  constructor(file: File | Blob, options: CanvasSinkOptions = {}) {
    this.file = file;
    this.options = options;
    const targetW = options.width || 1280;
    const targetH = options.height || 720;
    this.offscreenCanvas = new OffscreenCanvas(targetW, targetH);
    this.ctx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
  }

  public async init(): Promise<boolean> {
    const name = (this.file as File).name || '';
    const ext = name.split('.').pop()?.toLowerCase() || '';

    // Check MP4 vs WebM
    const isMp4 = ['mp4', 'm4v', 'mov'].includes(ext) || this.file.type.includes('mp4') || this.file.type.includes('quicktime');

    if (isMp4) {
      this.mp4 = new MP4Demuxer(this.file);
      const ok = await this.mp4.parse();
      if (ok && this.mp4.videoTracks.length > 0) {
        const vTrack = this.mp4.videoTracks[0];
        this.duration = this.mp4.duration || vTrack.duration;
        this.width = vTrack.width;
        this.height = vTrack.height;
        this.rotation = vTrack.rotation;
        this.decoderConfig = vTrack.decoderConfig || {
          codec: vTrack.codec || 'avc1.640028',
          codedWidth: vTrack.width,
          codedHeight: vTrack.height,
        };
        this.samples = this.mp4.getVideoSamples();
        this.setupDecoder();
        return true;
      }
    }

    // Try EBML (WebM / MKV)
    this.ebml = new EBMLDemuxer(this.file);
    const ebmlOk = await this.ebml.parse();
    if (ebmlOk && this.ebml.videoTracks.length > 0) {
      const vTrack = this.ebml.videoTracks[0];
      this.duration = this.ebml.duration || vTrack.duration;
      this.width = vTrack.width;
      this.height = vTrack.height;
      this.decoderConfig = vTrack.decoderConfig || {
        codec: vTrack.codec || 'vp8',
        codedWidth: vTrack.width,
        codedHeight: vTrack.height,
      };
      this.samples = await this.ebml.scanClusters();
      this.setupDecoder();
      return true;
    }

    return false;
  }

  private setupDecoder(): void {
    if (typeof VideoDecoder === 'undefined' || !this.decoderConfig) return;

    try {
      this.decoder = new VideoDecoder({
        output: (frame: VideoFrame) => {
          if (this.currentDecodedFrame) {
            this.currentDecodedFrame.close();
          }
          this.currentDecodedFrame = frame;
          if (this.framePromiseResolve) {
            const resolve = this.framePromiseResolve;
            this.framePromiseResolve = null;
            resolve(frame);
          }
        },
        error: (err: any) => {
          console.warn('NativeCanvasSink VideoDecoder error:', err);
          if (this.framePromiseResolve) {
            const resolve = this.framePromiseResolve;
            this.framePromiseResolve = null;
            resolve(null);
          }
        },
      });

      this.decoder.configure(this.decoderConfig);
      this.isDecoderConfigured = true;
    } catch (e) {
      console.warn('Failed to configure native VideoDecoder:', e);
    }
  }

  private async readSampleBytes(sample: MediaSample): Promise<Uint8Array> {
    if (this.mp4) {
      return await this.mp4.readSampleData(sample);
    } else if (this.ebml) {
      return await this.ebml.readSampleData(sample);
    }
    const slice = this.file.slice(sample.offset, sample.offset + sample.size);
    return new Uint8Array(await slice.arrayBuffer());
  }

  public async getCanvas(targetTimestamp: number): Promise<WrappedCanvas | null> {
    if (!this.isDecoderConfigured || !this.decoder || this.samples.length === 0) {
      return null;
    }

    try {
      // Find sample index closest to targetTimestamp
      let targetSampleIdx = 0;
      for (let i = 0; i < this.samples.length; i++) {
        if (this.samples[i].timestamp <= targetTimestamp) {
          targetSampleIdx = i;
        } else {
          break;
        }
      }

      // Find preceding keyframe
      let keyframeIdx = targetSampleIdx;
      while (keyframeIdx > 0 && !this.samples[keyframeIdx].isKeyframe) {
        keyframeIdx--;
      }

      // Reset decoder state for fast clean seek
      if (this.decoder.state === 'configured') {
        try {
          await this.decoder.flush();
        } catch {}
        this.decoder.reset();
        this.decoder.configure(this.decoderConfig!);
      }

      // Decode from keyframe up to target sample
      for (let i = keyframeIdx; i <= targetSampleIdx; i++) {
        const sample = this.samples[i];
        const data = await this.readSampleBytes(sample);
        if (data.length === 0) continue;

        const isLast = (i === targetSampleIdx);
        const chunk = new EncodedVideoChunk({
          type: sample.isKeyframe ? 'key' : 'delta',
          timestamp: Math.round(sample.timestamp * 1e6),
          duration: Math.round(sample.duration * 1e6),
          data,
        });

        if (isLast) {
          const framePromise = new Promise<VideoFrame | null>((resolve) => {
            this.framePromiseResolve = resolve;
          });
          this.decoder.decode(chunk);
          await this.decoder.flush();
          const frame = await framePromise;

          if (frame && this.ctx) {
            this.drawFrameToCanvas(frame);
            const ts = frame.timestamp / 1e6;
            const dur = (frame.duration || 33333) / 1e6;
            frame.close();
            this.currentDecodedFrame = null;
            return {
              canvas: this.offscreenCanvas,
              timestamp: ts,
              duration: dur,
            };
          }
        } else {
          this.decoder.decode(chunk);
        }
      }
    } catch (e) {
      console.warn('NativeCanvasSink getCanvas fail:', e);
    }

    return null;
  }

  private drawFrameToCanvas(frame: VideoFrame): void {
    if (!this.ctx) return;
    const cw = this.offscreenCanvas.width;
    const ch = this.offscreenCanvas.height;

    this.ctx.clearRect(0, 0, cw, ch);

    if (this.options.fit === 'cover') {
      const frameRatio = frame.displayWidth / frame.displayHeight;
      const canvasRatio = cw / ch;
      let sx = 0, sy = 0, sw = frame.displayWidth, sh = frame.displayHeight;

      if (frameRatio > canvasRatio) {
        sw = frame.displayHeight * canvasRatio;
        sx = (frame.displayWidth - sw) / 2;
      } else {
        sh = frame.displayWidth / canvasRatio;
        sy = (frame.displayHeight - sh) / 2;
      }
      this.ctx.drawImage(frame, sx, sy, sw, sh, 0, 0, cw, ch);
    } else {
      this.ctx.drawImage(frame, 0, 0, cw, ch);
    }
  }

  public async *canvases(startTime: number = 0): AsyncGenerator<WrappedCanvas> {
    if (!this.isDecoderConfigured || !this.decoder || this.samples.length === 0) return;

    // Find starting keyframe
    let startIdx = 0;
    for (let i = 0; i < this.samples.length; i++) {
      if (this.samples[i].timestamp <= startTime) {
        startIdx = i;
      } else {
        break;
      }
    }
    while (startIdx > 0 && !this.samples[startIdx].isKeyframe) {
      startIdx--;
    }

    if (this.decoder.state === 'configured') {
      try {
        await this.decoder.flush();
      } catch {}
      this.decoder.reset();
      this.decoder.configure(this.decoderConfig!);
    }

    for (let i = startIdx; i < this.samples.length; i++) {
      const sample = this.samples[i];
      const data = await this.readSampleBytes(sample);
      if (data.length === 0) continue;

      const chunk = new EncodedVideoChunk({
        type: sample.isKeyframe ? 'key' : 'delta',
        timestamp: Math.round(sample.timestamp * 1e6),
        duration: Math.round(sample.duration * 1e6),
        data,
      });

      const framePromise = new Promise<VideoFrame | null>((resolve) => {
        this.framePromiseResolve = resolve;
      });

      this.decoder.decode(chunk);

      // Only yield once past startTime
      if (sample.timestamp >= startTime - 0.05) {
        await this.decoder.flush();
        const frame = await framePromise;
        if (frame && this.ctx) {
          this.drawFrameToCanvas(frame);
          const ts = frame.timestamp / 1e6;
          const dur = (frame.duration || 33333) / 1e6;
          frame.close();
          this.currentDecodedFrame = null;
          yield {
            canvas: this.offscreenCanvas,
            timestamp: ts,
            duration: dur,
          };
        }
      }
    }
  }

  public async *canvasesAtTimestamps(timestamps: number[]): AsyncGenerator<WrappedCanvas> {
    for (const ts of timestamps) {
      const result = await this.getCanvas(ts);
      if (result) {
        yield result;
      }
    }
  }

  public close(): void {
    if (this.currentDecodedFrame) {
      try {
        this.currentDecodedFrame.close();
      } catch {}
      this.currentDecodedFrame = null;
    }
    if (this.decoder) {
      try {
        if (this.decoder.state !== 'closed') {
          this.decoder.close();
        }
      } catch {}
      this.decoder = null;
    }
  }
}
