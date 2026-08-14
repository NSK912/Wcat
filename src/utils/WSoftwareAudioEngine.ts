/**
 * WEngine Software Audio Engine
 * Demuxes compressed audio packets (AAC/Opus/PCM), decodes into float planar PCM,
 * and plays via Web Audio API AudioBufferSourceNode with sample-accurate clock synchronization.
 */

import { AudioSampleSink } from 'mediabunny';
import { WEngineLogger } from './WEngineDevTools';

export class WSoftwareAudioEngine {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private isLoaded = false;
  private isPlaying = false;
  private startCtxTime = 0;
  private startMediaOffset = 0;
  private currentPlaybackRate = 1.0;
  private currentVolume = 1.0;
  private isMuted = false;

  constructor() {}

  public async loadFromTrack(audioTrack: any): Promise<boolean> {
    this.destroy();
    WEngineLogger.log('SoftwareAudio', 'info', 'Loading audio track into Software PCM decoder...');
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioCtx();
      }

      const aSink = new AudioSampleSink(audioTrack);
      const chunks: Float32Array[][] = [];
      let totalFrames = 0;
      let sampleRate = 44100;
      let channels = 2;

      for await (const sample of aSink.samples()) {
        sampleRate = sample.sampleRate;
        channels = sample.numberOfChannels;
        const channelList: Float32Array[] = [];
        for (let c = 0; c < channels; c++) {
          const plane = new Float32Array(sample.numberOfFrames);
          sample.copyTo(plane, { planeIndex: c });
          channelList.push(plane);
        }
        chunks.push(channelList);
        totalFrames += sample.numberOfFrames;
        sample.close();
      }

      if (totalFrames > 0 && this.audioContext) {
        this.audioBuffer = this.audioContext.createBuffer(channels, totalFrames, sampleRate);
        for (let c = 0; c < channels; c++) {
          const channelData = this.audioBuffer.getChannelData(c);
          let offset = 0;
          for (const ch of chunks) {
            channelData.set(ch[c], offset);
            offset += ch[c].length;
          }
        }
        this.isLoaded = true;

        WEngineLogger.updateAudioStatus({
          sampleRate,
          channels,
          bufferDuration: this.audioBuffer.duration,
          contextState: this.audioContext.state,
        });
        WEngineLogger.log('SoftwareAudio', 'info', `Audio track decoded into PCM Float32: ${channels}ch, ${sampleRate}Hz, ${this.audioBuffer.duration.toFixed(2)}s`);
        return true;
      }
    } catch (err) {
      WEngineLogger.reportAudioError(err);
    }
    return false;
  }

  public play(fromTimeSeconds: number) {
    if (!this.isLoaded || !this.audioBuffer || !this.audioContext) return;
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch((e) => WEngineLogger.reportAudioError(e));
    }

    this.stop();

    try {
      this.sourceNode = this.audioContext.createBufferSource();
      this.sourceNode.buffer = this.audioBuffer;
      this.sourceNode.playbackRate.value = this.currentPlaybackRate;

      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.isMuted ? 0 : this.currentVolume;

      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);

      this.startCtxTime = this.audioContext.currentTime;
      this.startMediaOffset = Math.max(0, Math.min(fromTimeSeconds, this.audioBuffer.duration));

      this.sourceNode.start(0, this.startMediaOffset);
      this.isPlaying = true;
      WEngineLogger.log('SoftwareAudio', 'info', `Audio playback started at offset: ${this.startMediaOffset.toFixed(2)}s`);
    } catch (e) {
      WEngineLogger.reportAudioError(e);
    }
  }

  public pause() {
    this.stop();
  }

  public stop() {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }
    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch {}
      this.gainNode = null;
    }
    this.isPlaying = false;
  }

  public setVolume(vol: number, muted: boolean) {
    this.currentVolume = Math.max(0, Math.min(1, vol));
    this.isMuted = muted;
    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setValueAtTime(
        this.isMuted ? 0 : this.currentVolume,
        this.audioContext.currentTime
      );
    }
  }

  public setPlaybackRate(rate: number) {
    this.currentPlaybackRate = rate;
    if (this.sourceNode && this.audioContext) {
      this.sourceNode.playbackRate.setValueAtTime(rate, this.audioContext.currentTime);
    }
  }

  public getDuration(): number {
    return this.audioBuffer ? this.audioBuffer.duration : 0;
  }

  public destroy() {
    this.stop();
    this.audioBuffer = null;
    this.isLoaded = false;
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
    WEngineLogger.log('SoftwareAudio', 'info', 'Software Audio Engine resources released.');
  }
}
