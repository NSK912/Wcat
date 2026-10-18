// Proprietary In-House Native Media Toolkit (VideoCutterPro Native Engine)
// 100% Self-Contained. Zero External Dependencies.
// Conforms to ISO/IEC 14496-12 (ISOBMFF), RFC 8794 & Matroska specs, and W3C WebCodecs.

// ==========================================
// 1. TYPES & DATA STRUCTURES
// ==========================================

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

// ==========================================
// 2. TARGET WRITERS (STREAM & BUFFER)
// ==========================================

export class StreamTarget {
  private writable: WritableStream<StreamTargetChunk>;
  private writer: WritableStreamDefaultWriter<StreamTargetChunk> | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  public options?: any;

  constructor(writable: WritableStream<StreamTargetChunk>, options?: any) {
    this.writable = writable;
    this.options = options;
  }

  public async getWriter(): Promise<WritableStreamDefaultWriter<StreamTargetChunk>> {
    if (!this.writer) {
      this.writer = this.writable.getWriter();
    }
    return this.writer;
  }

  public on(event: string, fn: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
  }

  public off(event: string, fn: Function): void {
    this.listeners.get(event)?.delete(fn);
  }

  public emit(event: string, ...args: any[]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const fn of set) {
        try {
          fn(...args);
        } catch (e) {
          console.error(`Error in target listener for ${event}:`, e);
        }
      }
    }
  }

  public async write(chunk: StreamTargetChunk): Promise<void> {
    const w = await this.getWriter();
    await w.write(chunk);
    this.emit('write', {
      position: chunk.position,
      size: chunk.data.byteLength,
      end: (chunk.position ?? 0) + chunk.data.byteLength,
    });
  }

  public async close(): Promise<void> {
    if (this.writer) {
      try {
        await this.writer.close();
      } catch {}
      this.writer = null;
    }
  }
}

export class BufferTarget {
  private chunks: Uint8Array[] = [];
  public buffer: ArrayBuffer | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private currentLength = 0;

  constructor() {}

  public on(event: string, fn: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
  }

  public off(event: string, fn: Function): void {
    this.listeners.get(event)?.delete(fn);
  }

  public emit(event: string, ...args: any[]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const fn of set) {
        try {
          fn(...args);
        } catch (e) {
          console.error(`Error in target listener for ${event}:`, e);
        }
      }
    }
  }

  public async write(chunk: StreamTargetChunk | Uint8Array): Promise<void> {
    const data = (chunk && 'data' in chunk) ? chunk.data : (chunk as Uint8Array);
    this.chunks.push(data);
    this.currentLength += data.byteLength;
    this.emit('write', {
      position: (chunk && 'position' in chunk) ? chunk.position : this.currentLength - data.byteLength,
      size: data.byteLength,
      end: this.currentLength,
    });
  }

  public finalize(): ArrayBuffer {
    const out = new Uint8Array(this.currentLength);
    let offset = 0;
    for (const c of this.chunks) {
      out.set(c, offset);
      offset += c.byteLength;
    }
    this.buffer = out.buffer;
    return this.buffer;
  }

  public async close(): Promise<void> {
    this.finalize();
  }
}

// ==========================================
// 3. MP4 / MOV (ISOBMFF) DEMUXER
// ==========================================

interface BoxHeader {
  type: string;
  size: number;
  headerSize: number;
  offset: number;
}

export class MP4Demuxer {
  private file: File | Blob;
  private fileSize: number;
  public duration: number = 0;
  public timescale: number = 1000;
  public videoTracks: VideoTrackInfo[] = [];
  public audioTracks: AudioTrackInfo[] = [];
  private videoSamples: MediaSample[] = [];
  private audioSamples: MediaSample[] = [];
  private parsed = false;

  constructor(file: File | Blob) {
    this.file = file;
    this.fileSize = file.size;
  }

  private async readBytes(offset: number, length: number): Promise<Uint8Array> {
    const end = Math.min(offset + length, this.fileSize);
    if (offset >= end) return new Uint8Array(0);
    const slice = this.file.slice(offset, end);
    const ab = await slice.arrayBuffer();
    return new Uint8Array(ab);
  }

  public async parse(): Promise<boolean> {
    if (this.parsed) return true;

    try {
      let moovBox = await this.findTopLevelBox('moov', 0, Math.min(1024 * 1024, this.fileSize));
      
      if (!moovBox && this.fileSize > 1024 * 1024) {
        const tailSearchSize = Math.min(10 * 1024 * 1024, this.fileSize);
        const tailOffset = this.fileSize - tailSearchSize;
        moovBox = await this.findTopLevelBox('moov', tailOffset, tailSearchSize);
      }

      if (!moovBox) {
        moovBox = await this.scanTopLevelForMoov();
      }

      if (!moovBox) {
        return false;
      }

      const moovData = await this.readBytes(moovBox.offset + moovBox.headerSize, moovBox.size - moovBox.headerSize);
      if (moovData.length === 0) return false;

      this.parseMoov(moovData, moovBox.offset + moovBox.headerSize);
      this.parsed = true;
      return true;
    } catch (err) {
      console.warn('MP4Demuxer parse failed:', err);
      return false;
    }
  }

  private async scanTopLevelForMoov(): Promise<BoxHeader | null> {
    let offset = 0;
    while (offset < this.fileSize) {
      const headerBytes = await this.readBytes(offset, 16);
      if (headerBytes.length < 8) break;

      const view = new DataView(headerBytes.buffer, headerBytes.byteOffset, headerBytes.length);
      let size = view.getUint32(0);
      const type = String.fromCharCode(headerBytes[4], headerBytes[5], headerBytes[6], headerBytes[7]);
      let headerSize = 8;

      if (size === 1) {
        if (headerBytes.length < 16) break;
        const high = view.getUint32(8);
        const low = view.getUint32(12);
        size = high * 4294967296 + low;
        headerSize = 16;
      } else if (size === 0) {
        size = this.fileSize - offset;
      }

      if (type === 'moov') {
        return { type, size, headerSize, offset };
      }

      if (size <= 0 || offset + size > this.fileSize) break;
      offset += size;
    }
    return null;
  }

  private async findTopLevelBox(targetType: string, startOffset: number, length: number): Promise<BoxHeader | null> {
    const chunk = await this.readBytes(startOffset, length);
    if (chunk.length < 8) return null;

    let offset = 0;
    const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);

    while (offset + 8 <= chunk.length) {
      const size32 = view.getUint32(offset);
      const type = String.fromCharCode(chunk[offset + 4], chunk[offset + 5], chunk[offset + 6], chunk[offset + 7]);
      let size = size32;
      let headerSize = 8;

      if (size32 === 1) {
        if (offset + 16 > chunk.length) break;
        const high = view.getUint32(offset + 8);
        const low = view.getUint32(offset + 12);
        size = high * 4294967296 + low;
        headerSize = 16;
      } else if (size32 === 0) {
        size = this.fileSize - (startOffset + offset);
      }

      if (type === targetType) {
        return { type, size, headerSize, offset: startOffset + offset };
      }

      if (size <= 0) break;
      offset += size;
    }
    return null;
  }

  private parseMoov(data: Uint8Array, fileBaseOffset: number): void {
    let offset = 0;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    while (offset + 8 <= data.length) {
      const size = view.getUint32(offset);
      const type = String.fromCharCode(data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]);
      if (size < 8) break;

      const boxPayload = data.subarray(offset + 8, Math.min(offset + size, data.length));

      if (type === 'mvhd') {
        this.parseMvhd(boxPayload);
      } else if (type === 'trak') {
        this.parseTrak(boxPayload, fileBaseOffset + offset + 8);
      }

      offset += size;
    }
  }

  private parseMvhd(data: Uint8Array): void {
    if (data.length < 24) return;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const version = view.getUint8(0);

    if (version === 1) {
      if (data.length < 32) return;
      this.timescale = view.getUint32(20);
      const durHigh = view.getUint32(24);
      const durLow = view.getUint32(28);
      const dur = durHigh * 4294967296 + durLow;
      if (this.timescale > 0) this.duration = dur / this.timescale;
    } else {
      this.timescale = view.getUint32(12);
      const dur = view.getUint32(16);
      if (this.timescale > 0) this.duration = dur / this.timescale;
    }
  }

  private parseTrak(data: Uint8Array, fileBaseOffset: number): void {
    let offset = 0;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    let trackId = 1;
    let trackWidth = 0;
    let trackHeight = 0;
    let rotation = 0;
    let handlerType = '';
    let mediaTimescale = this.timescale;
    let mediaDuration = this.duration;

    let stblData: Uint8Array | null = null;

    while (offset + 8 <= data.length) {
      const size = view.getUint32(offset);
      const type = String.fromCharCode(data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]);
      if (size < 8) break;

      const payload = data.subarray(offset + 8, Math.min(offset + size, data.length));

      if (type === 'tkhd') {
        const tkhdView = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
        const version = tkhdView.getUint8(0);
        trackId = version === 1 ? tkhdView.getUint32(16) : tkhdView.getUint32(12);

        const matrixOffset = version === 1 ? 48 : 40;
        if (payload.length >= matrixOffset + 36) {
          const b = tkhdView.getInt32(matrixOffset + 4) / 65536;
          const a = tkhdView.getInt32(matrixOffset) / 65536;
          if (a === 0 && b === 1) rotation = 90;
          else if (a === -1 && b === 0) rotation = 180;
          else if (a === 0 && b === -1) rotation = 270;
        }

        if (payload.length >= matrixOffset + 36 + 8) {
          trackWidth = tkhdView.getUint32(matrixOffset + 36) >> 16;
          trackHeight = tkhdView.getUint32(matrixOffset + 40) >> 16;
        }
      } else if (type === 'mdia') {
        let mOffset = 0;
        const mView = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

        while (mOffset + 8 <= payload.length) {
          const mSize = mView.getUint32(mOffset);
          const mType = String.fromCharCode(payload[mOffset + 4], payload[mOffset + 5], payload[mOffset + 6], payload[mOffset + 7]);
          if (mSize < 8) break;

          const mPayload = payload.subarray(mOffset + 8, Math.min(mOffset + mSize, payload.length));

          if (mType === 'mdhd') {
            const mdhdView = new DataView(mPayload.buffer, mPayload.byteOffset, mPayload.byteLength);
            const mVer = mdhdView.getUint8(0);
            if (mVer === 1) {
              mediaTimescale = mdhdView.getUint32(20);
              const dHigh = mdhdView.getUint32(24);
              const dLow = mdhdView.getUint32(28);
              mediaDuration = (dHigh * 4294967296 + dLow) / (mediaTimescale || 1);
            } else {
              mediaTimescale = mdhdView.getUint32(12);
              mediaDuration = mdhdView.getUint32(16) / (mediaTimescale || 1);
            }
          } else if (mType === 'hdlr') {
            if (mPayload.length >= 12) {
              handlerType = String.fromCharCode(mPayload[8], mPayload[9], mPayload[10], mPayload[11]);
            }
          } else if (mType === 'minf') {
            let minfOffset = 0;
            const minfView = new DataView(mPayload.buffer, mPayload.byteOffset, mPayload.byteLength);
            while (minfOffset + 8 <= mPayload.length) {
              const minfSize = minfView.getUint32(minfOffset);
              const minfType = String.fromCharCode(mPayload[minfOffset + 4], mPayload[minfOffset + 5], mPayload[minfOffset + 6], mPayload[minfOffset + 7]);
              if (minfSize < 8) break;

              if (minfType === 'stbl') {
                stblData = mPayload.subarray(minfOffset + 8, Math.min(minfOffset + minfSize, mPayload.length));
                break;
              }
              minfOffset += minfSize;
            }
          }

          mOffset += mSize;
        }
      }

      offset += size;
    }

    if (handlerType === 'vide' && stblData) {
      this.parseVideoTrack(trackId, trackWidth, trackHeight, rotation, mediaTimescale, mediaDuration, stblData);
    } else if (handlerType === 'soun' && stblData) {
      this.parseAudioTrack(trackId, mediaTimescale, mediaDuration, stblData);
    }
  }

  private parseVideoTrack(
    id: number,
    width: number,
    height: number,
    rotation: number,
    timescale: number,
    duration: number,
    stblData: Uint8Array
  ): void {
    const { codec, decoderConfig, samples } = this.parseSampleTable(stblData, timescale, id, 'video');

    const vWidth = width || (decoderConfig?.codedWidth ?? 1280);
    const vHeight = height || (decoderConfig?.codedHeight ?? 720);
    const sampleCount = samples.length;
    const fps = sampleCount > 0 && duration > 0 ? Math.round(sampleCount / duration) : 30;

    const trackInfo: VideoTrackInfo = {
      id,
      type: 'video',
      codec: codec || 'avc1.640028',
      duration: duration || this.duration,
      timescale,
      width: vWidth,
      height: vHeight,
      rotation,
      fps: fps || 30,
      sampleCount,
      decoderConfig,
    };

    this.videoTracks.push(trackInfo);
    this.videoSamples = samples;
    if (this.duration <= 0 && duration > 0) this.duration = duration;
  }

  private parseAudioTrack(
    id: number,
    timescale: number,
    duration: number,
    stblData: Uint8Array
  ): void {
    const { codec, decoderConfig, samples } = this.parseSampleTable(stblData, timescale, id, 'audio');

    const trackInfo: AudioTrackInfo = {
      id,
      type: 'audio',
      codec: codec || 'mp4a.40.2',
      duration: duration || this.duration,
      timescale,
      sampleRate: (decoderConfig as AudioDecoderConfig)?.sampleRate || 48000,
      numberOfChannels: (decoderConfig as AudioDecoderConfig)?.numberOfChannels || 2,
      decoderConfig: decoderConfig as AudioDecoderConfig,
    };

    this.audioTracks.push(trackInfo);
    this.audioSamples = samples;
    if (this.duration <= 0 && duration > 0) this.duration = duration;
  }

  private parseSampleTable(
    stbl: Uint8Array,
    timescale: number,
    trackId: number,
    type: 'video' | 'audio'
  ): { codec: string; decoderConfig: any; samples: MediaSample[] } {
    let offset = 0;
    const view = new DataView(stbl.buffer, stbl.byteOffset, stbl.byteLength);

    let codec = '';
    let decoderConfig: any = null;

    let stts: { count: number; delta: number }[] = [];
    let stsc: { firstChunk: number; samplesPerChunk: number }[] = [];
    let stsz: number[] = [];
    let uniformSampleSize = 0;
    let stco: number[] = [];
    let stss: Set<number> | null = null;
    let ctts: { count: number; offset: number }[] = [];

    while (offset + 8 <= stbl.length) {
      const size = view.getUint32(offset);
      const bType = String.fromCharCode(stbl[offset + 4], stbl[offset + 5], stbl[offset + 6], stbl[offset + 7]);
      if (size < 8) break;

      const payload = stbl.subarray(offset + 8, Math.min(offset + size, stbl.length));
      const pView = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

      if (bType === 'stsd') {
        if (payload.length >= 8) {
          const entryCount = pView.getUint32(4);
          let entryOffset = 8;
          for (let e = 0; e < entryCount && entryOffset + 8 <= payload.length; e++) {
            const entrySize = pView.getUint32(entryOffset);
            const format = String.fromCharCode(payload[entryOffset + 4], payload[entryOffset + 5], payload[entryOffset + 6], payload[entryOffset + 7]);
            codec = format;

            if (type === 'video') {
              let width = 0;
              let height = 0;
              if (payload.length >= entryOffset + 36) {
                width = pView.getUint16(entryOffset + 32) || pView.getUint16(entryOffset + 24);
                height = pView.getUint16(entryOffset + 34) || pView.getUint16(entryOffset + 26);
              }

              let description: Uint8Array | undefined;
              const entryEnd = Math.min(entryOffset + entrySize, payload.length);
              let subOffset = entryOffset + 86;
              while (subOffset + 8 <= entryEnd) {
                const subSize = pView.getUint32(subOffset);
                const subType = String.fromCharCode(payload[subOffset + 4], payload[subOffset + 5], payload[subOffset + 6], payload[subOffset + 7]);
                if (subSize < 8 || subOffset + subSize > entryEnd) break;

                if (subType === 'avcC' || subType === 'hvcC' || subType === 'vpcC' || subType === 'av1C') {
                  description = new Uint8Array(payload.subarray(subOffset + 8, subOffset + subSize));
                  if (subType === 'avcC' && description.length >= 4) {
                    const profile = description[1].toString(16).padStart(2, '0');
                    const compat = description[2].toString(16).padStart(2, '0');
                    const level = description[3].toString(16).padStart(2, '0');
                    codec = `avc1.${profile}${compat}${level}`;
                  }
                  break;
                }
                subOffset += subSize;
              }

              // Fallback scan if non-standard VisualSampleEntry header size was used
              if (!description) {
                for (let k = entryOffset + 24; k + 8 <= entryEnd; k++) {
                  const tag = String.fromCharCode(payload[k], payload[k + 1], payload[k + 2], payload[k + 3]);
                  if (tag === 'avcC' || tag === 'hvcC' || tag === 'vpcC' || tag === 'av1C') {
                    const boxStart = k - 4;
                    const subSize = pView.getUint32(boxStart);
                    if (subSize >= 8 && boxStart + subSize <= entryEnd) {
                      description = new Uint8Array(payload.subarray(boxStart + 8, boxStart + subSize));
                      if (tag === 'avcC' && description.length >= 4) {
                        const profile = description[1].toString(16).padStart(2, '0');
                        const compat = description[2].toString(16).padStart(2, '0');
                        const level = description[3].toString(16).padStart(2, '0');
                        codec = `avc1.${profile}${compat}${level}`;
                      }
                      break;
                    }
                  }
                }
              }

              if (codec === 'avc1') {
                codec = 'avc1.640028';
              }

              decoderConfig = {
                codec,
                codedWidth: width,
                codedHeight: height,
                description,
              };
            } else {
              let channels = 2;
              let sampleRate = 48000;
              if (payload.length >= entryOffset + 32) {
                channels = pView.getUint16(entryOffset + 24) || pView.getUint16(entryOffset + 16) || 2;
                sampleRate = pView.getUint16(entryOffset + 32) || pView.getUint16(entryOffset + 24) || 48000;
              }
              let description: Uint8Array | undefined;
              const entryEnd = Math.min(entryOffset + entrySize, payload.length);
              let subOffset = entryOffset + 36;
              while (subOffset + 8 <= entryEnd) {
                const subSize = pView.getUint32(subOffset);
                const subType = String.fromCharCode(payload[subOffset + 4], payload[subOffset + 5], payload[subOffset + 6], payload[subOffset + 7]);
                if (subSize < 8 || subOffset + subSize > entryEnd) break;

                if (subType === 'esds') {
                  description = new Uint8Array(payload.subarray(subOffset + 8, subOffset + subSize));
                  codec = 'mp4a.40.2';
                  break;
                }
                subOffset += subSize;
              }

              decoderConfig = {
                codec: codec === 'mp4a' ? 'mp4a.40.2' : codec,
                sampleRate,
                numberOfChannels: channels,
                description,
              };
            }

            entryOffset += entrySize;
          }
        }
      } else if (bType === 'stts') {
        if (payload.length >= 8) {
          const entryCount = pView.getUint32(4);
          let p = 8;
          for (let i = 0; i < entryCount && p + 8 <= payload.length; i++) {
            stts.push({
              count: pView.getUint32(p),
              delta: pView.getUint32(p + 4),
            });
            p += 8;
          }
        }
      } else if (bType === 'stsc') {
        if (payload.length >= 8) {
          const entryCount = pView.getUint32(4);
          let p = 8;
          for (let i = 0; i < entryCount && p + 12 <= payload.length; i++) {
            stsc.push({
              firstChunk: pView.getUint32(p),
              samplesPerChunk: pView.getUint32(p + 4),
            });
            p += 12;
          }
        }
      } else if (bType === 'stsz') {
        if (payload.length >= 12) {
          uniformSampleSize = pView.getUint32(4);
          const sampleCount = pView.getUint32(8);
          if (uniformSampleSize === 0) {
            let p = 12;
            for (let i = 0; i < sampleCount && p + 4 <= payload.length; i++) {
              stsz.push(pView.getUint32(p));
              p += 4;
            }
          }
        }
      } else if (bType === 'stco') {
        if (payload.length >= 8) {
          const entryCount = pView.getUint32(4);
          let p = 8;
          for (let i = 0; i < entryCount && p + 4 <= payload.length; i++) {
            stco.push(pView.getUint32(p));
            p += 4;
          }
        }
      } else if (bType === 'co64') {
        if (payload.length >= 8) {
          const entryCount = pView.getUint32(4);
          let p = 8;
          for (let i = 0; i < entryCount && p + 8 <= payload.length; i++) {
            const high = pView.getUint32(p);
            const low = pView.getUint32(p + 4);
            stco.push(high * 4294967296 + low);
            p += 8;
          }
        }
      } else if (bType === 'stss') {
        if (payload.length >= 8) {
          stss = new Set();
          const entryCount = pView.getUint32(4);
          let p = 8;
          for (let i = 0; i < entryCount && p + 4 <= payload.length; i++) {
            stss.add(pView.getUint32(p));
            p += 4;
          }
        }
      } else if (bType === 'ctts') {
        if (payload.length >= 8) {
          const entryCount = pView.getUint32(4);
          let p = 8;
          for (let i = 0; i < entryCount && p + 8 <= payload.length; i++) {
            ctts.push({
              count: pView.getUint32(p),
              offset: pView.getInt32(p + 4),
            });
            p += 8;
          }
        }
      }

      offset += size;
    }

    const samples: MediaSample[] = [];
    const totalSamples = uniformSampleSize > 0 ? (stsc.length > 0 ? 1000 : 0) : stsz.length;

    let dtsList: number[] = [];
    let currentDts = 0;
    for (const entry of stts) {
      for (let i = 0; i < entry.count; i++) {
        dtsList.push(currentDts / timescale);
        currentDts += entry.delta;
      }
    }

    let ptsList: number[] = [];
    if (ctts.length > 0) {
      let idx = 0;
      for (const entry of ctts) {
        for (let i = 0; i < entry.count; i++) {
          const dtsVal = dtsList[idx] ?? 0;
          ptsList.push(dtsVal + entry.offset / timescale);
          idx++;
        }
      }
    } else {
      ptsList = dtsList;
    }

    let sampleIdx = 0;
    let stscIdx = 0;

    for (let chunkIdx = 0; chunkIdx < stco.length; chunkIdx++) {
      const chunkNumber = chunkIdx + 1;
      if (stscIdx + 1 < stsc.length && chunkNumber >= stsc[stscIdx + 1].firstChunk) {
        stscIdx++;
      }
      const samplesInThisChunk = stsc[stscIdx]?.samplesPerChunk || 1;
      let chunkOffset = stco[chunkIdx];

      for (let s = 0; s < samplesInThisChunk && sampleIdx < totalSamples; s++) {
        const sSize = uniformSampleSize > 0 ? uniformSampleSize : stsz[sampleIdx];
        const sTimestamp = ptsList[sampleIdx] ?? (sampleIdx / 30);
        const nextTimestamp = ptsList[sampleIdx + 1] ?? (sTimestamp + 1 / 30);
        const sDuration = Math.max(0.001, nextTimestamp - sTimestamp);
        const isKey = stss ? stss.has(sampleIdx + 1) : true;

        samples.push({
          index: sampleIdx,
          trackId,
          timestamp: sTimestamp,
          duration: sDuration,
          isKeyframe: isKey,
          offset: chunkOffset,
          size: sSize,
          dts: dtsList[sampleIdx] ?? sTimestamp,
        });

        chunkOffset += sSize;
        sampleIdx++;
      }
    }

    return { codec, decoderConfig, samples };
  }

  public getVideoSamples(): MediaSample[] {
    return this.videoSamples;
  }

  public getAudioSamples(): MediaSample[] {
    return this.audioSamples;
  }

  public async readSampleData(sample: MediaSample): Promise<Uint8Array> {
    return await this.readBytes(sample.offset, sample.size);
  }

  public findNearestKeyframe(timestamp: number): MediaSample | null {
    if (this.videoSamples.length === 0) return null;
    let nearest: MediaSample = this.videoSamples[0];

    for (const sample of this.videoSamples) {
      if (sample.isKeyframe) {
        if (sample.timestamp <= timestamp) {
          nearest = sample;
        } else {
          break;
        }
      }
    }
    return nearest;
  }
}

// ==========================================
// 4. EBML (WEBM / MKV) DEMUXER
// ==========================================

function readVint(buf: Uint8Array, offset: number): { value: number; length: number } | null {
  if (offset >= buf.length) return null;
  const firstByte = buf[offset];
  if (firstByte === 0) return null;

  let length = 1;
  let mask = 0x80;
  while ((firstByte & mask) === 0 && length <= 8) {
    length++;
    mask >>= 1;
  }

  if (length > 8 || offset + length > buf.length) return null;

  let value = firstByte & (mask - 1);
  for (let i = 1; i < length; i++) {
    value = (value * 256) + buf[offset + i];
  }

  return { value, length };
}

function readElementHeader(buf: Uint8Array, offset: number) {
  const idVint = readVint(buf, offset);
  if (!idVint) return null;

  const sizeVint = readVint(buf, offset + idVint.length);
  if (!sizeVint) return null;

  let idHex = '';
  for (let i = 0; i < idVint.length; i++) {
    idHex += buf[offset + i].toString(16).padStart(2, '0');
  }

  return {
    idHex,
    idLength: idVint.length,
    size: sizeVint.value,
    sizeLength: sizeVint.length,
    totalHeaderLen: idVint.length + sizeVint.length,
  };
}

export class EBMLDemuxer {
  private file: File | Blob;
  private fileSize: number;
  public duration: number = 0;
  public timecodeScale: number = 1000000;
  public videoTracks: VideoTrackInfo[] = [];
  public audioTracks: AudioTrackInfo[] = [];
  private videoSamples: MediaSample[] = [];
  private parsed = false;

  constructor(file: File | Blob) {
    this.file = file;
    this.fileSize = file.size;
  }

  private async readBytes(offset: number, length: number): Promise<Uint8Array> {
    const end = Math.min(offset + length, this.fileSize);
    if (offset >= end) return new Uint8Array(0);
    const slice = this.file.slice(offset, end);
    const ab = await slice.arrayBuffer();
    return new Uint8Array(ab);
  }

  public async parse(): Promise<boolean> {
    if (this.parsed) return true;

    try {
      const headSize = Math.min(2 * 1024 * 1024, this.fileSize);
      const headBuf = await this.readBytes(0, headSize);
      if (headBuf.length < 16) return false;

      let pos = 0;
      const ebmlHdr = readElementHeader(headBuf, pos);
      if (!ebmlHdr || ebmlHdr.idHex !== '1a45dfa3') {
        return false;
      }
      pos += ebmlHdr.totalHeaderLen + ebmlHdr.size;

      const segHdr = readElementHeader(headBuf, pos);
      if (!segHdr || segHdr.idHex !== '18538067') {
        return false;
      }
      pos += segHdr.totalHeaderLen;

      while (pos + 4 < headBuf.length) {
        const el = readElementHeader(headBuf, pos);
        if (!el || el.size < 0) break;

        const payloadStart = pos + el.totalHeaderLen;
        const payloadEnd = payloadStart + el.size;

        if (el.idHex === '1549a966') {
          const infoBuf = headBuf.subarray(payloadStart, Math.min(payloadEnd, headBuf.length));
          this.parseInfo(infoBuf);
        } else if (el.idHex === '1654ae6b') {
          const tracksBuf = headBuf.subarray(payloadStart, Math.min(payloadEnd, headBuf.length));
          this.parseTracks(tracksBuf);
        } else if (el.idHex === '1f43b675') {
          break;
        }

        pos = payloadEnd;
      }

      if (this.duration <= 0 && this.fileSize > headSize) {
        await this.scanTailForDuration();
      }

      this.parsed = true;
      return true;
    } catch (err) {
      console.warn('EBMLDemuxer parse error:', err);
      return false;
    }
  }

  private parseInfo(buf: Uint8Array): void {
    let p = 0;
    while (p + 4 < buf.length) {
      const el = readElementHeader(buf, p);
      if (!el) break;

      const valOffset = p + el.totalHeaderLen;
      const valView = new DataView(buf.buffer, buf.byteOffset + valOffset, el.size);

      if (el.idHex === '2ad7b1') {
        let scale = 0;
        for (let i = 0; i < el.size; i++) {
          scale = scale * 256 + buf[valOffset + i];
        }
        if (scale > 0) this.timecodeScale = scale;
      } else if (el.idHex === '4489') {
        let rawDur = 0;
        if (el.size === 4) {
          rawDur = valView.getFloat32(0);
        } else if (el.size === 8) {
          rawDur = valView.getFloat64(0);
        }
        if (rawDur > 0) {
          this.duration = (rawDur * this.timecodeScale) / 1e9;
        }
      }

      p += el.totalHeaderLen + el.size;
    }
  }

  private parseTracks(buf: Uint8Array): void {
    let p = 0;
    while (p + 4 < buf.length) {
      const el = readElementHeader(buf, p);
      if (!el) break;

      if (el.idHex === 'ae') {
        const entryBuf = buf.subarray(p + el.totalHeaderLen, p + el.totalHeaderLen + el.size);
        this.parseTrackEntry(entryBuf);
      }

      p += el.totalHeaderLen + el.size;
    }
  }

  private parseTrackEntry(buf: Uint8Array): void {
    let p = 0;
    let trackNum = 1;
    let trackType = 1;
    let codecId = '';
    let codecPrivate: Uint8Array | undefined;
    let width = 1280;
    let height = 720;
    let sampleRate = 48000;
    let channels = 2;

    while (p + 2 < buf.length) {
      const el = readElementHeader(buf, p);
      if (!el) break;

      const valOffset = p + el.totalHeaderLen;
      const valEnd = valOffset + el.size;
      const valView = new DataView(buf.buffer, buf.byteOffset + valOffset, el.size);

      if (el.idHex === 'd7') {
        trackNum = valView.getUint8(0);
      } else if (el.idHex === '83') {
        trackType = valView.getUint8(0);
      } else if (el.idHex === '86') {
        codecId = new TextDecoder().decode(buf.subarray(valOffset, valEnd)).trim();
      } else if (el.idHex === '63a2') {
        codecPrivate = buf.subarray(valOffset, valEnd);
      } else if (el.idHex === 'e0') {
        let vp = valOffset;
        while (vp + 2 < valEnd) {
          const vEl = readElementHeader(buf, vp);
          if (!vEl) break;
          const vOff = vp + vEl.totalHeaderLen;
          const vView = new DataView(buf.buffer, buf.byteOffset + vOff, vEl.size);
          if (vEl.idHex === 'b0') {
            width = vEl.size === 1 ? vView.getUint8(0) : vEl.size === 2 ? vView.getUint16(0) : vView.getUint32(0);
          } else if (vEl.idHex === 'ba') {
            height = vEl.size === 1 ? vView.getUint8(0) : vEl.size === 2 ? vView.getUint16(0) : vView.getUint32(0);
          }
          vp += vEl.totalHeaderLen + vEl.size;
        }
      } else if (el.idHex === 'e1') {
        let ap = valOffset;
        while (ap + 2 < valEnd) {
          const aEl = readElementHeader(buf, ap);
          if (!aEl) break;
          const aOff = ap + aEl.totalHeaderLen;
          const aView = new DataView(buf.buffer, buf.byteOffset + aOff, aEl.size);
          if (aEl.idHex === 'b5') {
            sampleRate = aEl.size === 4 ? aView.getFloat32(0) : aEl.size === 8 ? aView.getFloat64(0) : aView.getUint16(0);
          } else if (aEl.idHex === '9f') {
            channels = aView.getUint8(0);
          }
          ap += aEl.totalHeaderLen + aEl.size;
        }
      }

      p += el.totalHeaderLen + el.size;
    }

    if (trackType === 1) {
      let standardCodec = 'vp8';
      if (codecId.includes('VP9')) standardCodec = 'vp09.00.10.08';
      else if (codecId.includes('VP8')) standardCodec = 'vp8';
      else if (codecId.includes('AV1')) standardCodec = 'av01.0.04M.08';
      else if (codecId.includes('AVC') || codecId.includes('H264')) standardCodec = 'avc1.640028';

      this.videoTracks.push({
        id: trackNum,
        type: 'video',
        codec: standardCodec,
        duration: this.duration,
        timescale: 1000,
        width: width || 1280,
        height: height || 720,
        rotation: 0,
        fps: 30,
        sampleCount: 0,
        decoderConfig: {
          codec: standardCodec,
          codedWidth: width || 1280,
          codedHeight: height || 720,
          description: codecPrivate,
        },
      });
    } else if (trackType === 2) {
      let standardAudioCodec = 'opus';
      if (codecId.includes('OPUS')) standardAudioCodec = 'opus';
      else if (codecId.includes('VORBIS')) standardAudioCodec = 'vorbis';
      else if (codecId.includes('AAC')) standardAudioCodec = 'mp4a.40.2';

      this.audioTracks.push({
        id: trackNum,
        type: 'audio',
        codec: standardAudioCodec,
        duration: this.duration,
        timescale: 1000,
        sampleRate: Math.round(sampleRate) || 48000,
        numberOfChannels: channels || 2,
        decoderConfig: {
          codec: standardAudioCodec,
          sampleRate: Math.round(sampleRate) || 48000,
          numberOfChannels: channels || 2,
          description: codecPrivate,
        },
      });
    }
  }

  private async scanTailForDuration(): Promise<void> {
    const tailSize = Math.min(512 * 1024, this.fileSize);
    const tailOffset = this.fileSize - tailSize;
    const tailBuf = await this.readBytes(tailOffset, tailSize);

    let maxTimecode = 0;
    for (let i = 0; i < tailBuf.length - 8; i++) {
      if (tailBuf[i] === 0x1f && tailBuf[i + 1] === 0x43 && tailBuf[i + 2] === 0xb6 && tailBuf[i + 3] === 0x75) {
        const el = readElementHeader(tailBuf, i);
        if (el) {
          const innerOffset = i + el.totalHeaderLen;
          const tcEl = readElementHeader(tailBuf, innerOffset);
          if (tcEl && tcEl.idHex === 'e7') {
            let tc = 0;
            const tcValOffset = innerOffset + tcEl.totalHeaderLen;
            for (let b = 0; b < tcEl.size; b++) {
              tc = tc * 256 + tailBuf[tcValOffset + b];
            }
            if (tc > maxTimecode) maxTimecode = tc;
          }
        }
      }
    }

    if (maxTimecode > 0) {
      this.duration = (maxTimecode * this.timecodeScale) / 1e9;
      for (const t of this.videoTracks) t.duration = this.duration;
      for (const a of this.audioTracks) a.duration = this.duration;
    }
  }

  public async scanClusters(maxClusters: number = 200): Promise<MediaSample[]> {
    if (this.videoSamples.length > 0) return this.videoSamples;

    const samples: MediaSample[] = [];
    const videoTrackNum = this.videoTracks[0]?.id || 1;

    let filePos = 0;
    let clusterCount = 0;

    while (filePos < this.fileSize && clusterCount < maxClusters) {
      const chunkBuf = await this.readBytes(filePos, 512 * 1024);
      if (chunkBuf.length < 8) break;

      let p = 0;
      let clusterTimecode = 0;

      while (p + 4 < chunkBuf.length) {
        const el = readElementHeader(chunkBuf, p);
        if (!el || el.size < 0) {
          p++;
          continue;
        }

        if (el.idHex === '1f43b675') {
          clusterCount++;
          p += el.totalHeaderLen;
          continue;
        } else if (el.idHex === 'e7') {
          clusterTimecode = 0;
          const valStart = p + el.totalHeaderLen;
          for (let b = 0; b < el.size; b++) {
            clusterTimecode = clusterTimecode * 256 + chunkBuf[valStart + b];
          }
        } else if (el.idHex === 'a3') {
          const blockStart = p + el.totalHeaderLen;
          const tVint = readVint(chunkBuf, blockStart);
          if (tVint && tVint.value === videoTrackNum) {
            const timeOffset = blockStart + tVint.length;
            const timecodeRel = (chunkBuf[timeOffset] << 8) | chunkBuf[timeOffset + 1];
            const signedRel = (timecodeRel & 0x8000) ? timecodeRel - 0x10000 : timecodeRel;
            const flags = chunkBuf[timeOffset + 2];
            const isKey = (flags & 0x80) !== 0;

            const timeSec = ((clusterTimecode + signedRel) * this.timecodeScale) / 1e9;

            samples.push({
              index: samples.length,
              trackId: videoTrackNum,
              timestamp: Math.max(0, timeSec),
              duration: 1 / 30,
              isKeyframe: isKey,
              offset: filePos + p + el.totalHeaderLen,
              size: el.size,
            });
          }
        }

        p += el.totalHeaderLen + el.size;
      }

      filePos += p > 0 ? p : chunkBuf.length;
    }

    this.videoSamples = samples;
    return samples;
  }

  public async readSampleData(sample: MediaSample): Promise<Uint8Array> {
    return await this.readBytes(sample.offset, sample.size);
  }
}

// ==========================================
// 5. UNIVERSAL METADATA PROBER
// ==========================================

export async function probeMediaMetadata(file: File | Blob): Promise<MediaMetadata> {
  if (file.type && file.type.startsWith('image/')) {
    return {
      format: 'image',
      duration: 5,
      width: 1920,
      height: 1080,
      rotation: 0,
      fps: 30,
      hasVideo: true,
      hasAudio: false,
      videoTracks: [],
      audioTracks: [],
    };
  }

  const name = (file as File).name || '';
  const ext = name.split('.').pop()?.toLowerCase() || '';

  const headSlice = file.slice(0, 16);
  const headBuf = new Uint8Array(await headSlice.arrayBuffer());

  const isEBML = headBuf.length >= 4 && headBuf[0] === 0x1a && headBuf[1] === 0x45 && headBuf[2] === 0xdf && headBuf[3] === 0xa3;
  const isMp4OrMov = (headBuf.length >= 8 && (
    (headBuf[4] === 0x66 && headBuf[5] === 0x74 && headBuf[6] === 0x79 && headBuf[7] === 0x70) || // 'ftyp'
    (headBuf[4] === 0x6d && headBuf[5] === 0x6f && headBuf[6] === 0x6f && headBuf[7] === 0x76) || // 'moov'
    (headBuf[4] === 0x66 && headBuf[5] === 0x72 && headBuf[6] === 0x65 && headBuf[7] === 0x65) || // 'free'
    (headBuf[4] === 0x6d && headBuf[5] === 0x64 && headBuf[6] === 0x61 && headBuf[7] === 0x74)    // 'mdat'
  )) || ['mp4', 'm4v', 'mov', '3gp'].includes(ext);

  if (isMp4OrMov) {
    try {
      const mp4 = new MP4Demuxer(file);
      const ok = await mp4.parse();
      if (ok) {
        const vTrack = mp4.videoTracks[0];
        const aTrack = mp4.audioTracks[0];
        return {
          format: ext === 'mov' ? 'mov' : 'mp4',
          duration: mp4.duration || (vTrack?.duration ?? aTrack?.duration ?? 0),
          width: vTrack?.width || 1280,
          height: vTrack?.height || 720,
          rotation: vTrack?.rotation || 0,
          fps: vTrack?.fps || 30,
          hasVideo: mp4.videoTracks.length > 0,
          hasAudio: mp4.audioTracks.length > 0,
          videoTracks: mp4.videoTracks,
          audioTracks: mp4.audioTracks,
          videoCodec: vTrack?.codec,
          audioCodec: aTrack?.codec,
        };
      }
    } catch (e) {
      console.warn('MP4 probe fallback required:', e);
    }
  }

  if (isEBML || ['webm', 'mkv'].includes(ext)) {
    try {
      const ebml = new EBMLDemuxer(file);
      const ok = await ebml.parse();
      if (ok) {
        const vTrack = ebml.videoTracks[0];
        const aTrack = ebml.audioTracks[0];
        return {
          format: ext === 'mkv' ? 'mkv' : 'webm',
          duration: ebml.duration || (vTrack?.duration ?? aTrack?.duration ?? 0),
          width: vTrack?.width || 1280,
          height: vTrack?.height || 720,
          rotation: vTrack?.rotation || 0,
          fps: vTrack?.fps || 30,
          hasVideo: ebml.videoTracks.length > 0,
          hasAudio: ebml.audioTracks.length > 0,
          videoTracks: ebml.videoTracks,
          audioTracks: ebml.audioTracks,
          videoCodec: vTrack?.codec,
          audioCodec: aTrack?.codec,
        };
      }
    } catch (e) {
      console.warn('EBML probe fallback required:', e);
    }
  }

  // Fallback HTML5 media probe with strict 2-second timeout
  try {
    const isAudio = file.type.startsWith('audio/') || ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'].includes(ext);
    const media = document.createElement(isAudio ? 'audio' : 'video');
    media.preload = 'metadata';
    const blobUrl = URL.createObjectURL(file);
    media.src = blobUrl;

    const html5Dur = await new Promise<number>((resolve) => {
      const timer = setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
        media.removeAttribute('src');
        if (typeof (media as any).load === 'function') (media as any).load();
        resolve(0);
      }, 2000);

      media.onloadedmetadata = () => {
        clearTimeout(timer);
        const d = media.duration;
        URL.revokeObjectURL(blobUrl);
        media.removeAttribute('src');
        if (typeof (media as any).load === 'function') (media as any).load();
        resolve(Number.isFinite(d) && d > 0 ? d : 0);
      };

      media.onerror = () => {
        clearTimeout(timer);
        URL.revokeObjectURL(blobUrl);
        media.removeAttribute('src');
        if (typeof (media as any).load === 'function') (media as any).load();
        resolve(0);
      };
    });

    if (html5Dur > 0) {
      return {
        format: isAudio ? 'audio' : 'unknown',
        duration: html5Dur,
        width: (media as HTMLVideoElement).videoWidth || 1280,
        height: (media as HTMLVideoElement).videoHeight || 720,
        rotation: 0,
        fps: 30,
        hasVideo: !isAudio,
        hasAudio: true,
        videoTracks: [],
        audioTracks: [],
      };
    }
  } catch {}

  return {
    format: 'unknown',
    duration: 0,
    width: 1280,
    height: 720,
    rotation: 0,
    fps: 30,
    hasVideo: false,
    hasAudio: false,
    videoTracks: [],
    audioTracks: [],
  };
}

// ==========================================
// 6. NATIVE CANVAS SINK (HARDWARE ACCELERATED)
// ==========================================

export class NativeCanvasSink {
  private file: File | Blob;
  private options: CanvasSinkOptions;
  private mp4: MP4Demuxer | null = null;
  private ebml: EBMLDemuxer | null = null;
  private decoder: VideoDecoder | null = null;
  private offscreenCanvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D | null;
  private initialized = false;
  private isDecoderConfigured = false;
  private decoderConfig: VideoDecoderConfig | null = null;
  private samples: MediaSample[] = [];
  private decodedFramesQueue: VideoFrame[] = [];
  private onFrameDecoded: (() => void) | null = null;
  private mode: 'seek' | 'stream' = 'seek';
  private seekTargetTimestamp: number = 0;
  private bestSeekDiff: number = Infinity;
  private bestSeekTimestamp: number = 0;
  private bestSeekDuration: number = 0.033;
  private hasSeekFrame: boolean = false;
  private streamStartTime: number = 0;
  private lastDecodedKeyIdx: number = -1;
  private lastDecodedSampleIdx: number = -1;
  private lockPromise: Promise<any> = Promise.resolve();
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
    if (this.initialized && this.isDecoderConfigured && this.decoder && this.decoder.state !== 'closed' && this.samples.length > 0) {
      return true;
    }

    const name = (this.file as File)?.name || '';
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const fileType = this.file?.type || '';

    let headBuf = new Uint8Array(0);
    try {
      const headSlice = this.file.slice(0, 16);
      headBuf = new Uint8Array(await headSlice.arrayBuffer());
    } catch {}

    const isEBML = headBuf.length >= 4 && headBuf[0] === 0x1a && headBuf[1] === 0x45 && headBuf[2] === 0xdf && headBuf[3] === 0xa3;
    const isMp4 = (headBuf.length >= 8 && (
      (headBuf[4] === 0x66 && headBuf[5] === 0x74 && headBuf[6] === 0x79 && headBuf[7] === 0x70) || // 'ftyp'
      (headBuf[4] === 0x6d && headBuf[5] === 0x6f && headBuf[6] === 0x6f && headBuf[7] === 0x76) || // 'moov'
      (headBuf[4] === 0x66 && headBuf[5] === 0x72 && headBuf[6] === 0x65 && headBuf[7] === 0x65) || // 'free'
      (headBuf[4] === 0x6d && headBuf[5] === 0x64 && headBuf[6] === 0x61 && headBuf[7] === 0x74)    // 'mdat'
    )) || ['mp4', 'm4v', 'mov', '3gp'].includes(ext) || fileType.includes('mp4') || fileType.includes('quicktime');

    if (isMp4 || !isEBML) {
      try {
        this.mp4 = new MP4Demuxer(this.file);
        const ok = await this.mp4.parse();
        if (ok && this.mp4.videoTracks.length > 0) {
          const vTrack = this.mp4.videoTracks[0];
          this.duration = this.mp4.duration || vTrack.duration;
          this.width = vTrack.width;
          this.height = vTrack.height;
          this.rotation = vTrack.rotation;
          let configCodec = vTrack.decoderConfig?.codec || vTrack.codec || 'avc1.640028';
          if (configCodec === 'avc1') configCodec = 'avc1.640028';

          this.decoderConfig = {
            codec: configCodec,
            codedWidth: vTrack.width,
            codedHeight: vTrack.height,
            description: vTrack.decoderConfig?.description,
          };
          if (!this.options.width && this.width > 0 && this.height > 0) {
            this.offscreenCanvas.width = this.width;
            this.offscreenCanvas.height = this.height;
          }
          this.samples = this.mp4.getVideoSamples();
          this.setupDecoder();
          this.initialized = true;
          return true;
        }
      } catch (mp4Err) {
        console.warn('NativeCanvasSink MP4 init fallback to EBML:', mp4Err);
      }
    }

    try {
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
        if (!this.options.width && this.width > 0 && this.height > 0) {
          this.offscreenCanvas.width = this.width;
          this.offscreenCanvas.height = this.height;
        }
        this.samples = await this.ebml.scanClusters();
        this.setupDecoder();
        this.initialized = true;
        return true;
      }
    } catch (ebmlErr) {
      console.warn('NativeCanvasSink EBML init failed:', ebmlErr);
    }

    return false;
  }

  private setupDecoder(): void {
    if (typeof VideoDecoder === 'undefined' || !this.decoderConfig) return;

    if (this.decoder) {
      try {
        if (this.decoder.state !== 'closed') {
          this.decoder.close();
        }
      } catch {}
      this.decoder = null;
    }

    try {
      this.decodedFramesQueue = [];
      this.lastDecodedKeyIdx = -1;
      this.lastDecodedSampleIdx = -1;
      this.decoder = new VideoDecoder({
        output: (frame: VideoFrame) => {
          const ts = frame.timestamp / 1e6;
          const dur = (frame.duration || 33333) / 1e6;

          if (this.mode === 'seek') {
            // Immediately draw if closest to targetTimestamp and close VideoFrame synchronously
            // so hardware VideoFrame surface pool NEVER stalls or deadlocks!
            const diff = Math.abs(ts - this.seekTargetTimestamp);
            if (!this.hasSeekFrame || diff <= this.bestSeekDiff) {
              this.bestSeekDiff = diff;
              this.bestSeekTimestamp = ts;
              this.bestSeekDuration = dur;
              this.hasSeekFrame = true;
              if (!this.hasSeekFrame || ts >= this.seekTargetTimestamp - 0.12 || diff <= 0.06) {
                this.drawFrameToCanvas(frame);
              } else {
                this.drawFrameToCanvas(frame);
              }
            }
            try {
              frame.close();
            } catch {}
            if (this.onFrameDecoded) {
              const cb = this.onFrameDecoded;
              this.onFrameDecoded = null;
              cb();
            }
            return;
          }

          // Stream mode: immediately discard pre-roll frames before streamStartTime
          if (ts < this.streamStartTime - 0.05) {
            try {
              frame.close();
            } catch {}
            if (this.onFrameDecoded) {
              const cb = this.onFrameDecoded;
              this.onFrameDecoded = null;
              cb();
            }
            return;
          }

          // Cap queue to 2 frames max so GPU surface pool never blocks
          while (this.decodedFramesQueue.length >= 2) {
            const oldest = this.decodedFramesQueue.shift();
            if (oldest) {
              try {
                oldest.close();
              } catch {}
            }
          }

          this.decodedFramesQueue.push(frame);
          if (this.onFrameDecoded) {
            const cb = this.onFrameDecoded;
            this.onFrameDecoded = null;
            cb();
          }
        },
        error: (err: any) => {
          console.warn('NativeCanvasSink VideoDecoder error:', err);
          if (this.onFrameDecoded) {
            const cb = this.onFrameDecoded;
            this.onFrameDecoded = null;
            cb();
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
    const run = async (): Promise<WrappedCanvas | null> => {
      if (!this.isDecoderConfigured || !this.decoder || this.samples.length === 0) {
        return null;
      }

      if (this.decoder.state === 'closed') {
        this.setupDecoder();
        if (!this.decoder || (this.decoder as VideoDecoder).state === 'closed') return null;
      }

      try {
        this.mode = 'seek';
        this.seekTargetTimestamp = targetTimestamp;

        // Find sample index in decode order whose timestamp is closest/up to targetTimestamp
        let targetSampleIdx = 0;
        let minSampleDiff = Infinity;
        for (let i = 0; i < this.samples.length; i++) {
          const s = this.samples[i];
          const diff = Math.abs(s.timestamp - targetTimestamp);
          if (diff < minSampleDiff) {
            minSampleDiff = diff;
            targetSampleIdx = i;
          }
          if (s.dts > targetTimestamp + 0.25 && i > targetSampleIdx + 4) {
            break;
          }
        }

        // Include up to 2 subsequent samples in case of B-frame reordering
        const decodeEndIdx = Math.min(this.samples.length - 1, targetSampleIdx + 2);

        let keyframeIdx = targetSampleIdx;
        while (keyframeIdx > 0 && !this.samples[keyframeIdx].isKeyframe) {
          keyframeIdx--;
        }

        // If exact same sample range was already decoded, return cached canvas immediately
        if (
          this.lastDecodedKeyIdx === keyframeIdx &&
          this.lastDecodedSampleIdx === decodeEndIdx &&
          this.hasSeekFrame &&
          Math.abs(this.bestSeekTimestamp - targetTimestamp) < 0.06
        ) {
          return {
            canvas: this.offscreenCanvas,
            timestamp: this.bestSeekTimestamp,
            duration: this.bestSeekDuration,
          };
        }

        // Clear any leftover stream frames
        for (const f of this.decodedFramesQueue) {
          try { f.close(); } catch {}
        }
        this.decodedFramesQueue = [];

        let startDecodeIdx = keyframeIdx;
        if (
          this.lastDecodedKeyIdx === keyframeIdx &&
          this.lastDecodedSampleIdx >= keyframeIdx &&
          this.lastDecodedSampleIdx < decodeEndIdx &&
          this.decoder.state === 'configured'
        ) {
          // Incremental forward decode from previous position in the same GOP!
          startDecodeIdx = this.lastDecodedSampleIdx + 1;
          this.bestSeekDiff = Math.abs(this.bestSeekTimestamp - targetTimestamp);
        } else {
          this.bestSeekDiff = Infinity;
          this.hasSeekFrame = false;
          if (this.decoder.state === 'configured') {
            this.decoder.reset();
            this.decoder.configure(this.decoderConfig!);
          }
        }

        for (let i = startDecodeIdx; i <= decodeEndIdx; i++) {
          const sample = this.samples[i];
          const data = await this.readSampleBytes(sample);
          if (data.length === 0) continue;

          this.decoder.decode(new EncodedVideoChunk({
            type: sample.isKeyframe ? 'key' : 'delta',
            timestamp: Math.round(sample.timestamp * 1e6),
            duration: Math.round(sample.duration * 1e6),
            data,
          }));
        }

        // Flush with safety timeout so worker never hangs
        await Promise.race([
          this.decoder.flush(),
          new Promise<void>((r) => setTimeout(r, 1500)),
        ]);

        this.lastDecodedKeyIdx = keyframeIdx;
        this.lastDecodedSampleIdx = decodeEndIdx;

        if (this.hasSeekFrame && this.ctx) {
          return {
            canvas: this.offscreenCanvas,
            timestamp: this.bestSeekTimestamp,
            duration: this.bestSeekDuration,
          };
        }
      } catch (e) {
        console.warn('NativeCanvasSink getCanvas fail:', e);
        this.lastDecodedKeyIdx = -1;
        this.lastDecodedSampleIdx = -1;
      }

      return null;
    };

    const next = this.lockPromise.then(run, run);
    this.lockPromise = next.catch(() => {});
    return next;
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

    if (this.decoder.state === 'closed') {
      this.setupDecoder();
      if (!this.decoder || (this.decoder as VideoDecoder).state === 'closed') return;
    }

    this.mode = 'stream';
    this.streamStartTime = startTime;
    this.lastDecodedKeyIdx = -1;
    this.lastDecodedSampleIdx = -1;

    let startIdx = 0;
    for (let i = 0; i < this.samples.length; i++) {
      if (this.samples[i].timestamp <= startTime) {
        startIdx = i;
      } else if (this.samples[i].dts > startTime + 0.1) {
        break;
      }
    }
    while (startIdx > 0 && !this.samples[startIdx].isKeyframe) {
      startIdx--;
    }

    // Clear any previous queued frames
    for (const f of this.decodedFramesQueue) {
      try { f.close(); } catch {}
    }
    this.decodedFramesQueue = [];

    if (this.decoder.state === 'configured') {
      this.decoder.reset();
      this.decoder.configure(this.decoderConfig!);
    }

    let sampleIdx = startIdx;
    let isFeeding = true;

    while (sampleIdx < this.samples.length || this.decodedFramesQueue.length > 0) {
      // Feed chunks into decoder while keeping queue small so GPU surfaces never stall
      const maxQueue = sampleIdx < this.samples.length && this.samples[sampleIdx].timestamp < startTime - 0.1 ? 6 : 2;
      while (
        sampleIdx < this.samples.length &&
        this.decodedFramesQueue.length < 2 &&
        (this.decoder.decodeQueueSize || 0) < maxQueue
      ) {
        const sample = this.samples[sampleIdx++];
        const data = await this.readSampleBytes(sample);
        if (data.length > 0 && this.decoder && this.decoder.state === 'configured') {
          this.decoder.decode(new EncodedVideoChunk({
            type: sample.isKeyframe ? 'key' : 'delta',
            timestamp: Math.round(sample.timestamp * 1e6),
            duration: Math.round(sample.duration * 1e6),
            data,
          }));
        }
      }

      // Flush once when all chunks are fed to drain the decoder pipeline
      if (sampleIdx >= this.samples.length && isFeeding) {
        isFeeding = false;
        try {
          await Promise.race([
            this.decoder.flush(),
            new Promise<void>((r) => setTimeout(r, 1000)),
          ]);
        } catch {}
      }

      // If output queue is empty and decoder is still processing, await next output callback
      if (this.decodedFramesQueue.length === 0 && (sampleIdx < this.samples.length || (this.decoder.decodeQueueSize || 0) > 0)) {
        await new Promise<void>((resolve) => {
          this.onFrameDecoded = resolve;
          setTimeout(resolve, 25);
        });
      }

      // Yield all decoded frames ready in the queue
      while (this.decodedFramesQueue.length > 0) {
        const frame = this.decodedFramesQueue.shift()!;
        const ts = frame.timestamp / 1e6;
        const dur = (frame.duration || 33333) / 1e6;

        if (ts >= startTime - 0.05 && this.ctx) {
          this.drawFrameToCanvas(frame);
          try { frame.close(); } catch {}
          yield {
            canvas: this.offscreenCanvas,
            timestamp: ts,
            duration: dur,
          };
        } else {
          try { frame.close(); } catch {}
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
    for (const f of this.decodedFramesQueue) {
      try { f.close(); } catch {}
    }
    this.decodedFramesQueue = [];
    this.initialized = false;
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

// ==========================================
// 7. WEBM / MKV MUXER
// ==========================================

function writeVint(val: number): Uint8Array {
  if (val < 127) return new Uint8Array([0x80 | val]);
  if (val < 16383) return new Uint8Array([0x40 | (val >> 8), val & 0xff]);
  if (val < 2097151) return new Uint8Array([0x20 | (val >> 16), (val >> 8) & 0xff, val & 0xff]);
  if (val < 268435455) return new Uint8Array([0x10 | (val >> 24), (val >> 16) & 0xff, (val >> 8) & 0xff, val & 0xff]);
  const bytes = [0x08, 0, 0, 0, (val >> 24) & 0xff, (val >> 16) & 0xff, (val >> 8) & 0xff, val & 0xff];
  return new Uint8Array(bytes);
}

function encodeElement(idHex: string, payload: Uint8Array): Uint8Array {
  const idBytes: number[] = [];
  for (let i = 0; i < idHex.length; i += 2) {
    idBytes.push(parseInt(idHex.substring(i, i + 2), 16));
  }
  const sizeBytes = writeVint(payload.length);
  const out = new Uint8Array(idBytes.length + sizeBytes.length + payload.length);
  out.set(idBytes, 0);
  out.set(sizeBytes, idBytes.length);
  out.set(payload, idBytes.length + sizeBytes.length);
  return out;
}

function encodeUint(val: number): Uint8Array {
  if (val === 0) return new Uint8Array([0]);
  const b: number[] = [];
  let rem = val;
  while (rem > 0) {
    b.unshift(rem & 0xff);
    rem = Math.floor(rem / 256);
  }
  return new Uint8Array(b);
}

function encodeString(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function encodeFloat(val: number): Uint8Array {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setFloat32(0, val);
  return new Uint8Array(buf);
}

export interface WebMMuxerOptions {
  width?: number;
  height?: number;
  videoCodec?: string;
  audioCodec?: string;
  sampleRate?: number;
  channels?: number;
  onChunk: (chunk: StreamTargetChunk) => Promise<void> | void;
}

export class WebMMuxer {
  private options: WebMMuxerOptions;
  private currentClusterTimecode: number = -1;
  private currentClusterBlocks: Uint8Array[] = [];
  private totalBytes = 0;
  private durationSec = 0;

  constructor(options: WebMMuxerOptions) {
    this.options = options;
  }

  public async start(): Promise<void> {
    const docType = encodeElement('4282', encodeString('webm'));
    const docTypeVer = encodeElement('4287', encodeUint(4));
    const docTypeReadVer = encodeElement('4285', encodeUint(2));
    const ebmlHdr = encodeElement('1a45dfa3', new Uint8Array([...docType, ...docTypeVer, ...docTypeReadVer]));

    const segId = new Uint8Array([0x18, 0x53, 0x80, 0x67]);
    const segSize = new Uint8Array([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);

    const timecodeScale = encodeElement('2ad7b1', encodeUint(1000000));
    const muxingApp = encodeElement('4d80', encodeString('VideoCutterPro'));
    const writingApp = encodeElement('5741', encodeString('VideoCutterPro'));
    const infoPayload = new Uint8Array([...timecodeScale, ...muxingApp, ...writingApp]);
    const infoEl = encodeElement('1549a966', infoPayload);

    const trackEntries: number[] = [];

    if (this.options.width && this.options.height) {
      const trackNum = encodeElement('d7', encodeUint(1));
      const trackUid = encodeElement('73c5', encodeUint(1));
      const trackType = encodeElement('83', encodeUint(1));

      let codecIdStr = 'V_VP9';
      const c = (this.options.videoCodec || '').toLowerCase();
      if (c.includes('vp8')) codecIdStr = 'V_VP8';
      else if (c.includes('av1') || c.includes('av01')) codecIdStr = 'V_AV1';
      else if (c.includes('avc') || c.includes('264')) codecIdStr = 'V_MPEG4/ISO/AVC';

      const codecId = encodeElement('86', encodeString(codecIdStr));
      const pixelW = encodeElement('b0', encodeUint(this.options.width));
      const pixelH = encodeElement('ba', encodeUint(this.options.height));
      const videoSettings = encodeElement('e0', new Uint8Array([...pixelW, ...pixelH]));

      const vEntry = encodeElement('ae', new Uint8Array([...trackNum, ...trackUid, ...trackType, ...codecId, ...videoSettings]));
      trackEntries.push(...vEntry);
    }

    if (this.options.audioCodec) {
      const trackNum = encodeElement('d7', encodeUint(2));
      const trackUid = encodeElement('73c5', encodeUint(2));
      const trackType = encodeElement('83', encodeUint(2));
      const codecId = encodeElement('86', encodeString('A_OPUS'));

      const sRate = encodeElement('b5', encodeFloat(this.options.sampleRate || 48000));
      const chans = encodeElement('9f', encodeUint(this.options.channels || 2));
      const audioSettings = encodeElement('e1', new Uint8Array([...sRate, ...chans]));

      const aEntry = encodeElement('ae', new Uint8Array([...trackNum, ...trackUid, ...trackType, ...codecId, ...audioSettings]));
      trackEntries.push(...aEntry);
    }

    const tracksEl = encodeElement('1654ae6b', new Uint8Array(trackEntries));
    const initData = new Uint8Array([...ebmlHdr, ...segId, ...segSize, ...infoEl, ...tracksEl]);
    await this.emitChunk(initData);
  }

  public async addVideoChunk(chunk: EncodedVideoChunk): Promise<void> {
    const timeMs = Math.round(chunk.timestamp / 1000);
    this.durationSec = Math.max(this.durationSec, chunk.timestamp / 1e6);

    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);

    await this.addBlock(1, timeMs, chunk.type === 'key', data);
  }

  public async addAudioChunk(chunk: EncodedAudioChunk): Promise<void> {
    const timeMs = Math.round(chunk.timestamp / 1000);
    this.durationSec = Math.max(this.durationSec, chunk.timestamp / 1e6);

    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);

    await this.addBlock(2, timeMs, true, data);
  }

  private async addBlock(trackNum: number, timeMs: number, isKey: boolean, data: Uint8Array): Promise<void> {
    if (this.currentClusterTimecode < 0 || (isKey && trackNum === 1 && timeMs - this.currentClusterTimecode >= 1000) || timeMs - this.currentClusterTimecode >= 2000) {
      await this.flushCluster();
      this.currentClusterTimecode = timeMs;
    }

    const relTime = Math.max(-32768, Math.min(32767, timeMs - this.currentClusterTimecode));
    const trackByte = trackNum === 1 ? 0x81 : 0x82;
    const timeBytes = [(relTime >> 8) & 0xff, relTime & 0xff];
    const flags = isKey ? 0x80 : 0x00;

    const blockHeader = new Uint8Array([trackByte, ...timeBytes, flags]);
    const blockPayload = new Uint8Array(blockHeader.length + data.length);
    blockPayload.set(blockHeader, 0);
    blockPayload.set(data, blockHeader.length);

    const simpleBlock = encodeElement('a3', blockPayload);
    this.currentClusterBlocks.push(simpleBlock);
  }

  private async flushCluster(): Promise<void> {
    if (this.currentClusterBlocks.length === 0 || this.currentClusterTimecode < 0) return;

    const tcEl = encodeElement('e7', encodeUint(this.currentClusterTimecode));
    let totalPayloadLen = tcEl.length;
    for (const b of this.currentClusterBlocks) totalPayloadLen += b.length;

    const clusterPayload = new Uint8Array(totalPayloadLen);
    clusterPayload.set(tcEl, 0);
    let offset = tcEl.length;
    for (const b of this.currentClusterBlocks) {
      clusterPayload.set(b, offset);
      offset += b.length;
    }

    const clusterEl = encodeElement('1f43b675', clusterPayload);
    await this.emitChunk(clusterEl);

    this.currentClusterBlocks = [];
  }

  private async emitChunk(data: Uint8Array): Promise<void> {
    const pos = this.totalBytes;
    this.totalBytes += data.byteLength;
    await this.options.onChunk({
      data,
      position: pos,
    });
  }

  public async finalize(): Promise<void> {
    await this.flushCluster();
  }
}

// ==========================================
// 8. FRAGMENTED MP4 (fMP4) MUXER
// ==========================================

function createBox(type: string, payload: Uint8Array): Uint8Array {
  const size = 8 + payload.length;
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  view.setUint32(0, size);
  for (let i = 0; i < 4; i++) {
    out[4 + i] = type.charCodeAt(i);
  }
  out.set(payload, 8);
  return out;
}

export interface MP4MuxerOptions {
  width?: number;
  height?: number;
  videoCodec?: string;
  audioCodec?: string;
  sampleRate?: number;
  channels?: number;
  description?: Uint8Array;
  onChunk: (chunk: StreamTargetChunk) => Promise<void> | void;
}

interface QueuedSample {
  data: Uint8Array;
  timestampMs: number;
  durationMs: number;
  isKey: boolean;
}

export class MP4Muxer {
  private options: MP4MuxerOptions;
  private sequenceNumber = 1;
  private totalBytes = 0;
  private queuedVideo: QueuedSample[] = [];
  private queuedAudio: QueuedSample[] = [];
  private isHeaderSent = false;

  constructor(options: MP4MuxerOptions) {
    this.options = options;
  }

  public async start(): Promise<void> {
    if (this.isHeaderSent) return;
    this.isHeaderSent = true;

    const ftypPayload = new Uint8Array([
      0x69, 0x73, 0x6f, 0x6d,
      0x00, 0x00, 0x02, 0x00,
      0x69, 0x73, 0x6f, 0x6d,
      0x69, 0x73, 0x6f, 0x32,
      0x61, 0x76, 0x63, 0x31,
      0x6d, 0x70, 0x34, 0x31,
    ]);
    const ftypBox = createBox('ftyp', ftypPayload);

    const mvhdPayload = new Uint8Array(100);
    const mvhdView = new DataView(mvhdPayload.buffer);
    mvhdView.setUint32(12, 1000);
    mvhdView.setUint32(16, 0);
    mvhdView.setUint32(20, 0x00010000);
    mvhdView.setUint16(24, 0x0100);
    mvhdView.setUint32(36, 0x00010000);
    mvhdView.setUint32(52, 0x00010000);
    mvhdView.setUint32(68, 0x40000000);
    mvhdView.setUint32(76, 3);
    const mvhdBox = createBox('mvhd', mvhdPayload);

    const trex1Payload = new Uint8Array(24);
    const trex1View = new DataView(trex1Payload.buffer);
    trex1View.setUint32(4, 1);
    trex1View.setUint32(8, 1);
    const trex1Box = createBox('trex', trex1Payload);

    const trex2Payload = new Uint8Array(24);
    const trex2View = new DataView(trex2Payload.buffer);
    trex2View.setUint32(4, 2);
    trex2View.setUint32(8, 1);
    const trex2Box = createBox('trex', trex2Payload);

    const mvexPayload = new Uint8Array(trex1Box.length + trex2Box.length);
    mvexPayload.set(trex1Box, 0);
    mvexPayload.set(trex2Box, trex1Box.length);
    const mvexBox = createBox('mvex', mvexPayload);

    const w = this.options.width || 1280;
    const h = this.options.height || 720;

    const tkhdPayload = new Uint8Array(84);
    const tkhdView = new DataView(tkhdPayload.buffer);
    tkhdView.setUint32(0, 0x00000007);
    tkhdView.setUint32(12, 1);
    tkhdView.setUint32(36, 0x00010000);
    tkhdView.setUint32(52, 0x00010000);
    tkhdView.setUint32(68, 0x40000000);
    tkhdView.setUint32(76, w << 16);
    tkhdView.setUint32(80, h << 16);
    const tkhdBox = createBox('tkhd', tkhdPayload);

    const mdhdPayload = new Uint8Array(24);
    const mdhdView = new DataView(mdhdPayload.buffer);
    mdhdView.setUint32(12, 1000);
    const mdhdBox = createBox('mdhd', mdhdPayload);

    const hdlrPayload = new Uint8Array([
      0, 0, 0, 0,
      0, 0, 0, 0,
      0x76, 0x69, 0x64, 0x65,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0x56, 0x69, 0x64, 0x65, 0x6f, 0x48, 0x61, 0x6e, 0x64, 0x6c, 0x65, 0x72, 0
    ]);
    const hdlrBox = createBox('hdlr', hdlrPayload);

    const vmhdBox = createBox('vmhd', new Uint8Array([0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]));

    const urlBox = createBox('url ', new Uint8Array([0, 0, 0, 1]));
    const drefPayload = new Uint8Array(8 + urlBox.length);
    new DataView(drefPayload.buffer).setUint32(4, 1);
    drefPayload.set(urlBox, 8);
    const drefBox = createBox('dref', drefPayload);
    const dinfBox = createBox('dinf', drefBox);

    const avc1Payload = new Uint8Array(78);
    const avc1View = new DataView(avc1Payload.buffer);
    avc1View.setUint16(6, 1);
    avc1View.setUint16(24, w);
    avc1View.setUint16(26, h);
    avc1View.setUint32(28, 0x00480000);
    avc1View.setUint32(32, 0x00480000);
    avc1View.setUint16(40, 1);
    avc1View.setUint16(74, 24);
    avc1View.setInt16(76, -1);

    let avcCBox = new Uint8Array(0);
    if (this.options.description && this.options.description.length > 0) {
      avcCBox = createBox('avcC', this.options.description);
    } else {
      avcCBox = createBox('avcC', new Uint8Array([0x01, 0x64, 0x00, 0x1f, 0xff, 0xe1, 0x00, 0x00, 0x00]));
    }

    const avc1Box = createBox('avc1', new Uint8Array([...avc1Payload, ...avcCBox]));
    const stsdPayload = new Uint8Array(8 + avc1Box.length);
    new DataView(stsdPayload.buffer).setUint32(4, 1);
    stsdPayload.set(avc1Box, 8);
    const stsdBox = createBox('stsd', stsdPayload);

    const sttsBox = createBox('stts', new Uint8Array(8));
    const stscBox = createBox('stsc', new Uint8Array(8));
    const stszBox = createBox('stsz', new Uint8Array(12));
    const stcoBox = createBox('stco', new Uint8Array(8));

    const stblPayload = new Uint8Array([...stsdBox, ...sttsBox, ...stscBox, ...stszBox, ...stcoBox]);
    const stblBox = createBox('stbl', stblPayload);
    const minfPayload = new Uint8Array([...vmhdBox, ...dinfBox, ...stblBox]);
    const minfBox = createBox('minf', minfPayload);
    const mdiaPayload = new Uint8Array([...mdhdBox, ...hdlrBox, ...minfBox]);
    const mdiaBox = createBox('mdia', mdiaPayload);

    const trak1Box = createBox('trak', new Uint8Array([...tkhdBox, ...mdiaBox]));
    const moovPayload = new Uint8Array([...mvhdBox, ...trak1Box, ...mvexBox]);
    const moovBox = createBox('moov', moovPayload);

    const initData = new Uint8Array(ftypBox.length + moovBox.length);
    initData.set(ftypBox, 0);
    initData.set(moovBox, ftypBox.length);

    await this.emitChunk(initData);
  }

  public async addVideoChunk(chunk: EncodedVideoChunk): Promise<void> {
    if (!this.isHeaderSent) await this.start();

    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);

    const timeMs = Math.round(chunk.timestamp / 1000);
    const durMs = Math.max(1, Math.round((chunk.duration || 33333) / 1000));

    this.queuedVideo.push({
      data,
      timestampMs: timeMs,
      durationMs: durMs,
      isKey: chunk.type === 'key',
    });

    if (this.queuedVideo.length >= 30) {
      await this.flushFragment();
    }
  }

  public async addAudioChunk(chunk: EncodedAudioChunk): Promise<void> {
    if (!this.isHeaderSent) await this.start();

    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);

    const timeMs = Math.round(chunk.timestamp / 1000);
    const durMs = Math.max(1, Math.round((chunk.duration || 21333) / 1000));

    this.queuedAudio.push({
      data,
      timestampMs: timeMs,
      durationMs: durMs,
      isKey: true,
    });
  }

  private async flushFragment(): Promise<void> {
    if (this.queuedVideo.length === 0) return;

    const samples = this.queuedVideo;
    this.queuedVideo = [];

    let mdatDataSize = 0;
    for (const s of samples) mdatDataSize += s.data.length;

    const mfhdPayload = new Uint8Array(8);
    new DataView(mfhdPayload.buffer).setUint32(4, this.sequenceNumber++);
    const mfhdBox = createBox('mfhd', mfhdPayload);

    const tfhdPayload = new Uint8Array(8);
    const tfhdView = new DataView(tfhdPayload.buffer);
    tfhdView.setUint32(0, 0x020000);
    tfhdView.setUint32(4, 1);
    const tfhdBox = createBox('tfhd', tfhdPayload);

    const tfdtPayload = new Uint8Array(8);
    new DataView(tfdtPayload.buffer).setUint32(4, samples[0].timestampMs);
    const tfdtBox = createBox('tfdt', tfdtPayload);

    const trunHeaderSize = 16;
    const trunEntrySize = 12;
    const trunPayload = new Uint8Array(trunHeaderSize + samples.length * trunEntrySize);
    const trunView = new DataView(trunPayload.buffer);

    trunView.setUint32(0, 0x000701);
    trunView.setUint32(4, samples.length);

    let trunOffset = trunHeaderSize;
    for (const s of samples) {
      trunView.setUint32(trunOffset, s.durationMs);
      trunView.setUint32(trunOffset + 4, s.data.length);
      trunView.setUint32(trunOffset + 8, s.isKey ? 0x02000000 : 0x00010000);
      trunOffset += trunEntrySize;
    }

    const trunBox = createBox('trun', trunPayload);
    const trafPayload = new Uint8Array([...tfhdBox, ...tfdtBox, ...trunBox]);
    const trafBox = createBox('traf', trafPayload);

    const moofPayload = new Uint8Array([...mfhdBox, ...trafBox]);
    const moofBox = createBox('moof', moofPayload);

    const dataOffsetVal = moofBox.length + 8;
    const trunInsideTraf = tfhdBox.length + tfdtBox.length;
    const trunInsideMoof = 8 + mfhdBox.length + 8 + trunInsideTraf;
    const trunDataOffsetPos = trunInsideMoof + 8 + 8;
    new DataView(moofBox.buffer, moofBox.byteOffset + trunDataOffsetPos, 4).setInt32(0, dataOffsetVal);

    const mdatPayload = new Uint8Array(mdatDataSize);
    let p = 0;
    for (const s of samples) {
      mdatPayload.set(s.data, p);
      p += s.data.length;
    }
    const mdatBox = createBox('mdat', mdatPayload);

    const fragment = new Uint8Array(moofBox.length + mdatBox.length);
    fragment.set(moofBox, 0);
    fragment.set(mdatBox, moofBox.length);

    await this.emitChunk(fragment);
  }

  private async emitChunk(data: Uint8Array): Promise<void> {
    const pos = this.totalBytes;
    this.totalBytes += data.byteLength;
    await this.options.onChunk({
      data,
      position: pos,
    });
  }

  public async finalize(): Promise<void> {
    if (!this.isHeaderSent) await this.start();
    await this.flushFragment();
  }
}

// ==========================================
// 9. HIGH LEVEL ENGINE WRAPPERS
// ==========================================

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
  public timestamp: number;
  public duration?: number;
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
    const file = trackOrFile?.file || (typeof trackOrFile?.getFile === 'function' ? trackOrFile.getFile() : trackOrFile);
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
