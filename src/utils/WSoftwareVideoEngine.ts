/**
 * WSoftwareVideoEngine
 * Software Video Engine that demuxes media packets, decodes video frames asynchronously into bitmaps,
 * performs PTS clock synchronization, and drives the WebGPUPipeline canvas.
 */

import {
  Input,
  BlobSource,
  ALL_FORMATS,
  CanvasSink,
} from 'mediabunny';
import { WebGPUPipeline, VideoShaderParams } from './WebGPUPipeline';
import { WSoftwareAudioEngine } from './WSoftwareAudioEngine';
import { WEngineLogger } from './WEngineDevTools';

export interface SoftwareEngineMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasVideo: boolean;
  hasAudio: boolean;
}

export class WSoftwareVideoEngine {
  private file: File | null = null;
  private input: Input | null = null;
  private videoTrack: any = null;
  private audioTrack: any = null;
  private canvasSink: CanvasSink | null = null;

  private pipeline: WebGPUPipeline;
  private audioEngine: WSoftwareAudioEngine;

  // Frame Cache & PTS Indexing
  private frameCanvases: (HTMLCanvasElement | OffscreenCanvas)[] = [];
  private frameTimestamps: number[] = [];
  private duration = 0;
  private width = 1280;
  private height = 720;
  private fps = 30;

  // Clock & Playback State
  private isPlaying = false;
  private currentTime = 0;
  private playbackRate = 1.0;
  private lastRafTime = 0;
  private animationFrameId: number | null = null;

  // Event callbacks
  private onTimeUpdateCb: ((time: number) => void) | null = null;
  private onEndedCb: (() => void) | null = null;
  private onLoadedCb: ((meta: SoftwareEngineMetadata) => void) | null = null;

  // Shader Parameters
  private shaderParams: VideoShaderParams = {
    brightness: 1.0,
    contrast: 1.0,
    filterType: 0,
    rotation: 0,
    flipH: 0,
    flipV: 0,
  };

  constructor(canvas: HTMLCanvasElement) {
    this.pipeline = new WebGPUPipeline(canvas);
    this.audioEngine = new WSoftwareAudioEngine();
  }

  public async init(): Promise<boolean> {
    WEngineLogger.log('System', 'info', 'Initializing WEngine Software Video System...');
    return await this.pipeline.init();
  }

  public async loadMedia(file: File): Promise<SoftwareEngineMetadata> {
    this.destroyMedia();
    this.file = file;

    WEngineLogger.log('Demuxer', 'info', `Parsing container and tracks for file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)...`);

    try {
      this.input = new Input({
        source: new BlobSource(file),
        formats: ALL_FORMATS,
      });

      const vTracks = await this.input.getVideoTracks();
      const aTracks = await this.input.getAudioTracks();

      this.videoTrack = vTracks.length > 0 ? vTracks[0] : null;
      this.audioTrack = aTracks.length > 0 ? aTracks[0] : null;

      let hasVideo = false;
      let hasAudio = false;

      if (this.videoTrack) {
        hasVideo = true;
        const vConfig = await this.videoTrack.getDecoderConfig();
        if (vConfig) {
          this.width = vConfig.codedWidth || 1280;
          this.height = vConfig.codedHeight || 720;
        }
        try {
          const trackDur = await this.videoTrack.computeDuration();
          if (trackDur && Number.isFinite(trackDur)) {
            this.duration = trackDur;
          }
        } catch (durErr) {
          WEngineLogger.log('Demuxer', 'warn', 'Failed to compute track duration directly:', durErr);
        }

        this.canvasSink = new CanvasSink(this.videoTrack);

        WEngineLogger.updateDecoderStatus({
          resolution: `${this.width}x${this.height}`,
          videoCodec: vConfig?.codec || 'auto-detected',
          decodedFramesCount: 0,
          droppedFramesCount: 0,
        });

        WEngineLogger.log('SoftwareVideo', 'info', `Video track detected: ${this.width}x${this.height}, duration: ${this.duration.toFixed(2)}s`);
      }

      if (this.audioTrack) {
        hasAudio = true;
        await this.audioEngine.loadFromTrack(this.audioTrack);
        if (this.duration <= 0) {
          this.duration = this.audioEngine.getDuration();
        }
      }

      // Start background asynchronous frame decoding into cache
      if (this.videoTrack && this.canvasSink) {
        this.startFrameExtraction();
      }

      const meta: SoftwareEngineMetadata = {
        duration: this.duration,
        width: this.width,
        height: this.height,
        fps: this.fps,
        hasVideo,
        hasAudio,
      };

      if (this.onLoadedCb) {
        this.onLoadedCb(meta);
      }

      return meta;
    } catch (err) {
      WEngineLogger.reportDecoderError(err);
      throw err;
    }
  }

  private async startFrameExtraction() {
    if (!this.canvasSink) return;
    WEngineLogger.log('SoftwareVideo', 'info', 'Beginning background frame stream extraction...');
    try {
      for await (const wrapped of this.canvasSink.canvases()) {
        this.frameCanvases.push(wrapped.canvas);
        this.frameTimestamps.push(wrapped.timestamp);
        WEngineLogger.incrementDecodedFrames();

        if (wrapped.timestamp > this.duration) {
          this.duration = wrapped.timestamp;
        }

        // Render first frame immediately
        if (this.frameCanvases.length === 1 && !this.isPlaying) {
          this.renderFrameAtTime(0);
        }
      }
      WEngineLogger.log('SoftwareVideo', 'info', `Frame extraction completed. Total frames decoded: ${this.frameCanvases.length}`);
    } catch (err) {
      WEngineLogger.reportDecoderError(err);
    }
  }

  public play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastRafTime = performance.now();

    WEngineLogger.log('SoftwareVideo', 'info', `Playback started at PTS: ${this.currentTime.toFixed(2)}s`);
    this.audioEngine.play(this.currentTime);
    this.tick();
  }

  public pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.audioEngine.pause();
    WEngineLogger.log('SoftwareVideo', 'info', `Playback paused at PTS: ${this.currentTime.toFixed(2)}s`);
  }

  public async seek(timeSeconds: number) {
    this.currentTime = Math.max(0, Math.min(timeSeconds, this.duration || 1000));
    WEngineLogger.log('SoftwareVideo', 'info', `Seek requested to PTS: ${this.currentTime.toFixed(2)}s`);
    if (this.isPlaying) {
      this.audioEngine.play(this.currentTime);
    }
    
    // Check if frame in cache or request random seek from sink
    if (this.frameCanvases.length > 0) {
      this.renderFrameAtTime(this.currentTime);
    } else if (this.canvasSink) {
      try {
        const wrapped = await this.canvasSink.getCanvas(this.currentTime);
        if (wrapped) {
          this.pipeline.renderSource(wrapped.canvas as any, this.shaderParams);
        }
      } catch (err) {
        WEngineLogger.reportDecoderError(err);
      }
    }

    if (this.onTimeUpdateCb) {
      this.onTimeUpdateCb(this.currentTime);
    }
  }

  public updateShaderParams(params: Partial<VideoShaderParams>) {
    this.shaderParams = { ...this.shaderParams, ...params };
    if (!this.isPlaying) {
      this.renderFrameAtTime(this.currentTime);
    }
  }

  public setVolume(vol: number, muted: boolean) {
    this.audioEngine.setVolume(vol, muted);
  }

  public setPlaybackRate(rate: number) {
    this.playbackRate = rate;
    this.audioEngine.setPlaybackRate(rate);
  }

  public setOnTimeUpdate(cb: (time: number) => void) {
    this.onTimeUpdateCb = cb;
  }

  public setOnEnded(cb: () => void) {
    this.onEndedCb = cb;
  }

  public setOnLoaded(cb: (meta: SoftwareEngineMetadata) => void) {
    this.onLoadedCb = cb;
  }

  private tick = () => {
    if (!this.isPlaying) return;
    const now = performance.now();
    const dt = (now - this.lastRafTime) / 1000;
    this.lastRafTime = now;

    this.currentTime += dt * this.playbackRate;

    if (this.duration > 0 && this.currentTime >= this.duration) {
      this.currentTime = this.duration;
      this.pause();
      if (this.onEndedCb) {
        this.onEndedCb();
      }
      return;
    }

    this.renderFrameAtTime(this.currentTime);

    if (this.onTimeUpdateCb) {
      this.onTimeUpdateCb(this.currentTime);
    }

    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  private renderFrameAtTime(targetTime: number) {
    if (this.frameCanvases.length === 0) return;

    // Binary search / nearest PTS match
    let low = 0;
    let high = this.frameTimestamps.length - 1;
    let bestIdx = 0;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this.frameTimestamps[mid] <= targetTime) {
        bestIdx = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const c = this.frameCanvases[bestIdx];
    if (c) {
      this.pipeline.renderSource(c as any, this.shaderParams);
    }
  }

  public getIsWebGPUSupported(): boolean {
    return this.pipeline.getIsSupported();
  }

  public destroyMedia() {
    this.pause();
    this.frameCanvases = [];
    this.frameTimestamps = [];
    this.canvasSink = null;
    this.audioEngine.destroy();
    this.currentTime = 0;
    this.duration = 0;
    WEngineLogger.log('SoftwareVideo', 'info', 'Software Video media buffer cleaned up.');
  }

  public destroy() {
    this.destroyMedia();
    this.pipeline.destroy();
  }
}
