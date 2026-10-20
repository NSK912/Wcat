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
  private chunks: { data: Uint8Array; position: number }[] = [];
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
    const raw = (chunk && 'data' in chunk) ? chunk.data : (chunk as Uint8Array);
    const pos = (chunk && 'position' in chunk && typeof chunk.position === 'number')
      ? chunk.position
      : this.currentLength;
    const copy = new Uint8Array(raw.byteLength);
    copy.set(raw);
    this.chunks.push({ data: copy, position: pos });
    const endPos = pos + copy.byteLength;
    if (endPos > this.currentLength) {
      this.currentLength = endPos;
    }
    this.emit('write', {
      position: pos,
      size: copy.byteLength,
      end: this.currentLength,
    });
  }

  public finalize(): ArrayBuffer {
    const out = new Uint8Array(this.currentLength);
    for (const c of this.chunks) {
      if (c.position >= 0 && c.position + c.data.byteLength <= out.byteLength) {
        out.set(c.data, c.position);
      }
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

function parseHevcCodecString(desc?: Uint8Array): { codec: string; is10Bit: boolean; profileIdc: number } {
  if (!desc || desc.length < 13) {
    return { codec: 'hvc1.1.6.L123.B0', is10Bit: false, profileIdc: 1 };
  }
  const profileSpace = (desc[1] >> 6) & 0x03;
  const pSpaceStr = profileSpace === 1 ? 'A' : profileSpace === 2 ? 'B' : profileSpace === 3 ? 'C' : '';
  const tierFlag = (desc[1] & 0x20) !== 0 ? 'H' : 'L';
  const profileIdc = desc[1] & 0x1f; // 1 = Main (8-bit), 2 = Main 10 (10-bit)
  const is10Bit = profileIdc === 2 || (desc[2] & 0x04) !== 0;
  const compatHex = profileIdc === 2 ? '4' : '6';
  const levelIdc = desc[12] || 123;
  return {
    codec: `hvc1.${pSpaceStr}${profileIdc}.${compatHex}.${tierFlag}${levelIdc}.B0`,
    is10Bit,
    profileIdc,
  };
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
  private pendingVideoStbl: { stblData: Uint8Array; timescale: number; id: number } | null = null;
  private pendingAudioStbl: { stblData: Uint8Array; timescale: number; id: number } | null = null;
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
      let moovBox = await this.scanTopLevelForMoov();

      if (!moovBox) {
        moovBox = await this.findTopLevelBox('moov', 0, Math.min(4 * 1024 * 1024, this.fileSize));
      }

      if (!moovBox && this.fileSize > 512 * 1024) {
        // Progressive backward chunk scan from EOF (supports 100GB+ files where moov is at the tail)
        const stepSize = 8 * 1024 * 1024;
        const maxTailScan = Math.min(this.fileSize, 128 * 1024 * 1024);
        for (let scanned = stepSize; scanned <= maxTailScan; scanned += stepSize) {
          const tailOffset = Math.max(0, this.fileSize - scanned);
          const readLen = Math.min(stepSize + 64, this.fileSize - tailOffset);
          moovBox = await this.findTopLevelBox('moov', tailOffset, readLen);
          if (moovBox) break;
          if (tailOffset === 0) break;
        }
      }

      if (!moovBox) {
        return false;
      }

      const moovPayloadSize = Math.min(moovBox.size - moovBox.headerSize, this.fileSize - (moovBox.offset + moovBox.headerSize));
      const moovData = await this.readBytes(moovBox.offset + moovBox.headerSize, moovPayloadSize);
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
    let steps = 0;
    while (offset < this.fileSize && steps < 64) {
      steps++;
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

      if (type === targetType && size >= 8) {
        return { type, size, headerSize, offset: startOffset + offset };
      }

      if (size <= 0) {
        offset += 4;
        continue;
      }
      offset += size;
    }

    // Fast SIMD-assisted Uint8Array.indexOf byte pattern search
    const t0 = targetType.charCodeAt(0);
    const t1 = targetType.charCodeAt(1);
    const t2 = targetType.charCodeAt(2);
    const t3 = targetType.charCodeAt(3);
    let searchIdx = 4;
    while (searchIdx + 4 <= chunk.length) {
      const idx = chunk.indexOf(t0, searchIdx);
      if (idx === -1 || idx + 4 > chunk.length) break;
      if (chunk[idx + 1] === t1 && chunk[idx + 2] === t2 && chunk[idx + 3] === t3) {
        const boxOffset = idx - 4;
        const bSize32 = view.getUint32(boxOffset);
        if (bSize32 === 1 && idx + 12 <= chunk.length) {
          const high = view.getUint32(boxOffset + 8);
          const low = view.getUint32(boxOffset + 12);
          const bSize64 = high * 4294967296 + low;
          if (bSize64 >= 16 && startOffset + boxOffset + bSize64 <= this.fileSize + 1024) {
            return { type: targetType, size: bSize64, headerSize: 16, offset: startOffset + boxOffset };
          }
        } else if (bSize32 >= 8 && startOffset + boxOffset + bSize32 <= this.fileSize + 1024) {
          return { type: targetType, size: bSize32, headerSize: 8, offset: startOffset + boxOffset };
        }
      }
      searchIdx = idx + 1;
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
    const { codec, decoderConfig, stts, sampleCount: metaSampleCount } = this.parseSampleTable(stblData, timescale, id, 'video', true);

    const vWidth = width || (decoderConfig?.codedWidth ?? 1280);
    const vHeight = height || (decoderConfig?.codedHeight ?? 720);
    const sampleCount = metaSampleCount || 0;
    const sttsFps = (stts && stts.length > 0 && stts[0].delta > 0 && timescale > 0)
      ? Math.round((timescale / stts[0].delta) * 100) / 100
      : 0;
    const fps = sttsFps || (sampleCount > 0 && duration > 0 ? Math.round(sampleCount / duration) : 30);

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

    if (this.videoTracks.length === 0 || sampleCount > (this.videoTracks[0]?.sampleCount || 0)) {
      this.videoTracks.unshift(trackInfo);
      this.pendingVideoStbl = { stblData, timescale, id };
      this.videoSamples = [];
    } else {
      this.videoTracks.push(trackInfo);
    }
    if (this.duration <= 0 && duration > 0) this.duration = duration;
  }

  private parseAudioTrack(
    id: number,
    timescale: number,
    duration: number,
    stblData: Uint8Array
  ): void {
    const { codec, decoderConfig } = this.parseSampleTable(stblData, timescale, id, 'audio', true);

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

    if (this.audioTracks.length === 0) {
      this.pendingAudioStbl = { stblData, timescale, id };
      this.audioSamples = [];
    }
    this.audioTracks.push(trackInfo);
    if (this.duration <= 0 && duration > 0) this.duration = duration;
  }

  private parseSampleTable(
    stbl: Uint8Array,
    timescale: number,
    trackId: number,
    type: 'video' | 'audio',
    metadataOnly: boolean = false
  ): { codec: string; decoderConfig: any; samples: MediaSample[]; stts?: { count: number; delta: number }[]; sampleCount?: number } {
    let offset = 0;
    const view = new DataView(stbl.buffer, stbl.byteOffset, stbl.byteLength);

    let codec = '';
    let decoderConfig: any = null;

    const stts: { count: number; delta: number }[] = [];
    const stsc: { firstChunk: number; samplesPerChunk: number }[] = [];
    let stsz = new Uint32Array(0);
    let uniformSampleSize = 0;
    let stszSampleCount = 0;
    let stco = new Float64Array(0);
    let stss: Set<number> | null = null;
    const ctts: { count: number; offset: number }[] = [];

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
                  const rawDesc = new Uint8Array(payload.subarray(subOffset + 8, subOffset + subSize));
                  if (subType === 'avcC' && rawDesc.length >= 4) {
                    description = rawDesc;
                    const profile = rawDesc[1].toString(16).padStart(2, '0');
                    const compat = rawDesc[2].toString(16).padStart(2, '0');
                    const level = rawDesc[3].toString(16).padStart(2, '0');
                    codec = `avc1.${profile}${compat}${level}`;
                  } else if (subType === 'av1C') {
                    if (rawDesc.length >= 3) {
                      const seqProfile = (rawDesc[1] >> 5) & 0x07;
                      const seqLevelIdx = rawDesc[1] & 0x1f;
                      const seqTier = (rawDesc[2] >> 7) & 0x01 ? 'H' : 'M';
                      const highBitdepth = (rawDesc[2] >> 6) & 0x01;
                      const twelveBit = (rawDesc[2] >> 5) & 0x01;
                      const bitDepth = highBitdepth ? (twelveBit ? '12' : '10') : '08';
                      const levelStr = String(seqLevelIdx || 8).padStart(2, '0');
                      codec = `av01.${seqProfile}.${levelStr}${seqTier}.${bitDepth}`;
                    } else {
                      codec = 'av01.0.08M.08';
                    }
                    description = rawDesc;
                  } else if (subType === 'vpcC') {
                    codec = 'vp09.00.41.08';
                    description = undefined;
                  } else if (subType === 'hvcC') {
                    const parsedHevc = parseHevcCodecString(rawDesc);
                    codec = parsedHevc.codec;
                    description = rawDesc;
                  }
                  break;
                }
                subOffset += subSize;
              }

              // Fallback scan if non-standard VisualSampleEntry header size was used
              if (!description && codec.length <= 4) {
                for (let k = entryOffset + 24; k + 8 <= entryEnd; k++) {
                  const tag = String.fromCharCode(payload[k], payload[k + 1], payload[k + 2], payload[k + 3]);
                  if (tag === 'avcC' || tag === 'hvcC' || tag === 'vpcC' || tag === 'av1C') {
                    const boxStart = k - 4;
                    const subSize = pView.getUint32(boxStart);
                    if (subSize >= 8 && boxStart + subSize <= entryEnd) {
                      const rawDesc = new Uint8Array(payload.subarray(boxStart + 8, boxStart + subSize));
                      if (tag === 'avcC' && rawDesc.length >= 4) {
                        description = rawDesc;
                        const profile = rawDesc[1].toString(16).padStart(2, '0');
                        const compat = rawDesc[2].toString(16).padStart(2, '0');
                        const level = rawDesc[3].toString(16).padStart(2, '0');
                        codec = `avc1.${profile}${compat}${level}`;
                      } else if (tag === 'av1C') {
                        if (rawDesc.length >= 3) {
                          const seqProfile = (rawDesc[1] >> 5) & 0x07;
                          const seqLevelIdx = rawDesc[1] & 0x1f;
                          const seqTier = (rawDesc[2] >> 7) & 0x01 ? 'H' : 'M';
                          const highBitdepth = (rawDesc[2] >> 6) & 0x01;
                          const twelveBit = (rawDesc[2] >> 5) & 0x01;
                          const bitDepth = highBitdepth ? (twelveBit ? '12' : '10') : '08';
                          const levelStr = String(seqLevelIdx || 8).padStart(2, '0');
                          codec = `av01.${seqProfile}.${levelStr}${seqTier}.${bitDepth}`;
                        } else {
                          codec = 'av01.0.08M.08';
                        }
                        description = rawDesc;
                      } else if (tag === 'vpcC') {
                        codec = 'vp09.00.41.08';
                        description = undefined;
                      } else if (tag === 'hvcC') {
                        const parsedHevc = parseHevcCodecString(rawDesc);
                        codec = parsedHevc.codec;
                        description = rawDesc;
                      }
                      break;
                    }
                  }
                }
              }

              if (codec === 'avc1') codec = 'avc1.640028';
              else if (codec === 'av01') codec = 'av01.0.08M.08';
              else if (codec === 'vp09') codec = 'vp09.00.41.08';
              else if (codec === 'hvc1' || codec === 'hev1') {
                codec = description ? parseHevcCodecString(description).codec : 'hvc1.1.6.L123.B0';
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
                } else if (subType === 'dOps') {
                  description = new Uint8Array(payload.subarray(subOffset + 8, subOffset + subSize));
                  codec = 'opus';
                  break;
                } else if (subType === 'dfLa') {
                  const dfLaPayload = payload.subarray(subOffset + 8, subOffset + subSize);
                  if (dfLaPayload.length > 4) {
                    const fLaCDesc = new Uint8Array(4 + dfLaPayload.length - 4);
                    fLaCDesc[0] = 0x66; fLaCDesc[1] = 0x4c; fLaCDesc[2] = 0x61; fLaCDesc[3] = 0x43;
                    fLaCDesc.set(dfLaPayload.subarray(4), 4);
                    description = fLaCDesc;
                  }
                  codec = 'flac';
                  break;
                }
                subOffset += subSize;
              }

              if (codec === 'Opus') codec = 'opus';
              else if (codec === 'fLaC') codec = 'flac';
              else if (codec === 'sowt') codec = 'pcm-s16';
              else if (codec === 'mp4a') codec = 'mp4a.40.2';

              decoderConfig = {
                codec,
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
          const entryCount = metadataOnly ? Math.min(1, pView.getUint32(4)) : pView.getUint32(4);
          let p = 8;
          for (let i = 0; i < entryCount && p + 8 <= payload.length; i++) {
            stts.push({
              count: pView.getUint32(p),
              delta: pView.getUint32(p + 4),
            });
            p += 8;
          }
        }
      } else if (bType === 'stsz') {
        if (payload.length >= 12) {
          uniformSampleSize = pView.getUint32(4);
          stszSampleCount = pView.getUint32(8);
          if (!metadataOnly && uniformSampleSize === 0) {
            const safeCount = Math.min(stszSampleCount, Math.floor((payload.length - 12) / 4));
            stsz = new Uint32Array(safeCount);
            let p = 12;
            for (let i = 0; i < safeCount; i++) {
              stsz[i] = pView.getUint32(p);
              p += 4;
            }
          }
        }
      } else if (!metadataOnly && bType === 'stsc') {
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
      } else if (!metadataOnly && bType === 'stco') {
        if (payload.length >= 8) {
          const entryCount = Math.min(pView.getUint32(4), Math.floor((payload.length - 8) / 4));
          stco = new Float64Array(entryCount);
          let p = 8;
          for (let i = 0; i < entryCount; i++) {
            stco[i] = pView.getUint32(p);
            p += 4;
          }
        }
      } else if (!metadataOnly && bType === 'co64') {
        if (payload.length >= 8) {
          const entryCount = Math.min(pView.getUint32(4), Math.floor((payload.length - 8) / 8));
          stco = new Float64Array(entryCount);
          let p = 8;
          for (let i = 0; i < entryCount; i++) {
            const high = pView.getUint32(p);
            const low = pView.getUint32(p + 4);
            stco[i] = high * 4294967296 + low;
            p += 8;
          }
        }
      } else if (!metadataOnly && bType === 'stss') {
        if (payload.length >= 8) {
          stss = new Set();
          const entryCount = pView.getUint32(4);
          let p = 8;
          for (let i = 0; i < entryCount && p + 4 <= payload.length; i++) {
            stss.add(pView.getUint32(p));
            p += 4;
          }
        }
      } else if (!metadataOnly && bType === 'ctts') {
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

    if (metadataOnly) {
      return { codec, decoderConfig, samples: [], stts, sampleCount: stszSampleCount };
    }

    const totalSamples = uniformSampleSize > 0 ? stszSampleCount : stsz.length;
    const samples: MediaSample[] = new Array(totalSamples);

    const dtsList = new Float64Array(totalSamples);
    let currentDts = 0;
    let dtsIdx = 0;
    const invTimescale = 1 / (timescale || 1000);
    for (const entry of stts) {
      const delta = entry.delta;
      for (let i = 0; i < entry.count && dtsIdx < totalSamples; i++) {
        dtsList[dtsIdx++] = currentDts * invTimescale;
        currentDts += delta;
      }
    }

    const ptsList = ctts.length > 0 ? new Float64Array(totalSamples) : dtsList;
    if (ctts.length > 0) {
      let idx = 0;
      for (const entry of ctts) {
        const offsetVal = entry.offset * invTimescale;
        for (let i = 0; i < entry.count && idx < totalSamples; i++) {
          ptsList[idx] = dtsList[idx] + offsetVal;
          idx++;
        }
      }
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
        const curDts = dtsList[sampleIdx] ?? (sampleIdx / 30);
        const nextDts = sampleIdx + 1 < totalSamples ? dtsList[sampleIdx + 1] : (curDts + 1 / 30);
        const sDuration = Math.max(0.001, nextDts - curDts);
        const isKey = stss ? stss.has(sampleIdx + 1) : true;

        samples[sampleIdx] = {
          index: sampleIdx,
          trackId,
          timestamp: sTimestamp,
          duration: sDuration,
          isKeyframe: isKey,
          offset: chunkOffset,
          size: sSize,
          dts: curDts,
        };

        chunkOffset += sSize;
        sampleIdx++;
      }
    }

    if (sampleIdx < samples.length) {
      samples.length = sampleIdx;
    }

    return { codec, decoderConfig, samples, stts, sampleCount: sampleIdx };
  }

  public getVideoSamples(): MediaSample[] {
    if (this.videoSamples.length === 0 && this.pendingVideoStbl) {
      const { stblData, timescale, id } = this.pendingVideoStbl;
      this.pendingVideoStbl = null;
      const res = this.parseSampleTable(stblData, timescale, id, 'video', false);
      this.videoSamples = res.samples;
    }
    return this.videoSamples;
  }

  public getAudioSamples(): MediaSample[] {
    if (this.audioSamples.length === 0 && this.pendingAudioStbl) {
      const { stblData, timescale, id } = this.pendingAudioStbl;
      this.pendingAudioStbl = null;
      const res = this.parseSampleTable(stblData, timescale, id, 'audio', false);
      this.audioSamples = res.samples;
    }
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

function readEbmlUint(buf: Uint8Array, offset: number, size: number): number {
  if (size <= 0 || offset + size > buf.length) return 0;
  let val = 0;
  for (let i = 0; i < size; i++) {
    val = val * 256 + buf[offset + i];
  }
  return val;
}

function readVint(buf: Uint8Array, offset: number): { value: number; length: number; isUnknown: boolean } | null {
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
  let allOnes = value === (mask - 1);
  for (let i = 1; i < length; i++) {
    const b = buf[offset + i];
    if (b !== 0xff) allOnes = false;
    value = (value * 256) + b;
  }

  return { value, length, isUnknown: allOnes };
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
    isUnknownSize: sizeVint.isUnknown,
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
  private audioSamples: MediaSample[] = [];
  private segmentPayloadOffset: number = 0;
  private firstClusterOffset: number = 0;
  private headerStripMap: Map<number, Uint8Array> = new Map();
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
      const initialRead = Math.min(256 * 1024, this.fileSize);
      const headBuf = await this.readBytes(0, initialRead);
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
      this.segmentPayloadOffset = pos;

      let fileOffset = pos;
      let steps = 0;
      while (fileOffset + 4 < this.fileSize && steps < 256) {
        steps++;
        let elBuf: Uint8Array;
        if (fileOffset + 16 <= headBuf.length) {
          elBuf = headBuf.subarray(fileOffset, fileOffset + 16);
        } else {
          elBuf = await this.readBytes(fileOffset, 16);
        }
        if (elBuf.length < 2) break;

        const el = readElementHeader(elBuf, 0);
        if (!el || el.size < 0) break;

        const payloadStart = fileOffset + el.totalHeaderLen;
        const payloadEnd = payloadStart + el.size;

        if (el.idHex === '1549a966') {
          const infoBuf = payloadEnd <= headBuf.length
            ? headBuf.subarray(payloadStart, payloadEnd)
            : await this.readBytes(payloadStart, Math.min(el.size, 1024 * 1024));
          this.parseInfo(infoBuf);
        } else if (el.idHex === '1654ae6b') {
          const tracksBuf = payloadEnd <= headBuf.length
            ? headBuf.subarray(payloadStart, payloadEnd)
            : await this.readBytes(payloadStart, Math.min(el.size, 2 * 1024 * 1024));
          this.parseTracks(tracksBuf);
        } else if (el.idHex === '1f43b675') {
          if (this.firstClusterOffset === 0) {
            this.firstClusterOffset = fileOffset;
          }
          if (this.videoTracks.length > 0 || this.audioTracks.length > 0) {
            break;
          }
        }

        if (el.isUnknownSize || el.size <= 0 && el.idHex === '1f43b675') {
          break;
        }

        fileOffset = payloadEnd;
      }

      if (this.duration <= 0) {
        await this.scanTailForDuration();
      }

      for (const t of this.videoTracks) t.duration = this.duration;
      for (const a of this.audioTracks) a.duration = this.duration;

      this.parsed = true;
      return true;
    } catch (err) {
      console.warn('EBMLDemuxer parse error:', err);
      return false;
    }
  }

  private parseInfo(buf: Uint8Array): void {
    let p = 0;
    let rawDur = 0;
    while (p + 2 <= buf.length) {
      const el = readElementHeader(buf, p);
      if (!el) break;

      const valOffset = p + el.totalHeaderLen;
      const valEnd = valOffset + el.size;
      if (valEnd > buf.length) break;

      if (el.idHex === '2ad7b1') {
        const scale = readEbmlUint(buf, valOffset, el.size);
        if (scale > 0) this.timecodeScale = scale;
      } else if (el.idHex === '4489') {
        const valView = new DataView(buf.buffer, buf.byteOffset + valOffset, el.size);
        if (el.size === 4) {
          rawDur = valView.getFloat32(0);
        } else if (el.size === 8) {
          rawDur = valView.getFloat64(0);
        }
      }

      p = valEnd;
    }

    if (rawDur > 0) {
      this.duration = (rawDur * this.timecodeScale) / 1e9;
    }
  }

  private parseTracks(buf: Uint8Array): void {
    let p = 0;
    while (p + 2 <= buf.length) {
      const el = readElementHeader(buf, p);
      if (!el) break;

      const valStart = p + el.totalHeaderLen;
      const valEnd = Math.min(buf.length, valStart + el.size);
      if (el.idHex === 'ae' && valEnd > valStart) {
        const entryBuf = buf.subarray(valStart, valEnd);
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
    let width = 0;
    let height = 0;
    let displayWidth = 0;
    let displayHeight = 0;
    let fps = 30;
    let sampleRate = 48000;
    let channels = 2;

    while (p + 2 <= buf.length) {
      const el = readElementHeader(buf, p);
      if (!el) break;

      const valOffset = p + el.totalHeaderLen;
      const valEnd = valOffset + el.size;
      if (valEnd > buf.length) break;

      if (el.idHex === 'd7') {
        trackNum = readEbmlUint(buf, valOffset, el.size) || 1;
      } else if (el.idHex === '83') {
        trackType = readEbmlUint(buf, valOffset, el.size);
      } else if (el.idHex === '23e383' || el.idHex === '234e7a') {
        const defaultDurNs = readEbmlUint(buf, valOffset, el.size);
        if (defaultDurNs > 0) {
          const calcFps = 1e9 / defaultDurNs;
          if (calcFps >= 1 && calcFps <= 240) fps = Math.round(calcFps * 100) / 100;
        }
      } else if (el.idHex === '86') {
        codecId = new TextDecoder().decode(buf.subarray(valOffset, valEnd)).replace(/\0/g, '').trim();
      } else if (el.idHex === '63a2') {
        codecPrivate = buf.slice(valOffset, valEnd);
      } else if (el.idHex === '6d80') {
        // ContentEncodings -> check for header stripping (ContentCompAlgo == 3)
        let cep = valOffset;
        while (cep + 2 <= valEnd) {
          const ceEl = readElementHeader(buf, cep);
          if (!ceEl) break;
          const ceStart = cep + ceEl.totalHeaderLen;
          const ceEnd = Math.min(valEnd, ceStart + ceEl.size);
          if (ceEl.idHex === '6240') {
            let ccp = ceStart;
            while (ccp + 2 <= ceEnd) {
              const ccEl = readElementHeader(buf, ccp);
              if (!ccEl) break;
              const ccStart = ccp + ccEl.totalHeaderLen;
              const ccEnd = Math.min(ceEnd, ccStart + ccEl.size);
              if (ccEl.idHex === '5034') {
                let compAlgo = 0;
                let strippedBytes: Uint8Array | null = null;
                let cmp = ccStart;
                while (cmp + 2 <= ccEnd) {
                  const cmEl = readElementHeader(buf, cmp);
                  if (!cmEl) break;
                  const cmStart = cmp + cmEl.totalHeaderLen;
                  const cmEnd = Math.min(ccEnd, cmStart + cmEl.size);
                  if (cmEl.idHex === '4254') {
                    compAlgo = readEbmlUint(buf, cmStart, cmEl.size);
                  } else if (cmEl.idHex === '4255') {
                    strippedBytes = buf.slice(cmStart, cmEnd);
                  }
                  cmp = cmEnd;
                }
                if (compAlgo === 3 && strippedBytes && strippedBytes.length > 0) {
                  this.headerStripMap.set(trackNum, strippedBytes);
                }
              }
              ccp = ccEnd;
            }
          }
          cep = ceEnd;
        }
      } else if (el.idHex === 'e0') {
        let vp = valOffset;
        while (vp + 2 <= valEnd) {
          const vEl = readElementHeader(buf, vp);
          if (!vEl) break;
          const vOff = vp + vEl.totalHeaderLen;
          const vEnd = vOff + vEl.size;
          if (vEnd > valEnd) break;
          if (vEl.idHex === 'b0') {
            width = readEbmlUint(buf, vOff, vEl.size);
          } else if (vEl.idHex === 'ba') {
            height = readEbmlUint(buf, vOff, vEl.size);
          } else if (vEl.idHex === '54b0') {
            displayWidth = readEbmlUint(buf, vOff, vEl.size);
          } else if (vEl.idHex === '54ba') {
            displayHeight = readEbmlUint(buf, vOff, vEl.size);
          } else if (vEl.idHex === '2383e3') {
            const fView = new DataView(buf.buffer, buf.byteOffset + vOff, vEl.size);
            const valFps = vEl.size === 4 ? fView.getFloat32(0) : vEl.size === 8 ? fView.getFloat64(0) : 0;
            if (valFps >= 1 && valFps <= 240) fps = Math.round(valFps * 100) / 100;
          }
          vp = vEnd;
        }
      } else if (el.idHex === 'e1') {
        let ap = valOffset;
        while (ap + 2 <= valEnd) {
          const aEl = readElementHeader(buf, ap);
          if (!aEl) break;
          const aOff = ap + aEl.totalHeaderLen;
          const aEnd = aOff + aEl.size;
          if (aEnd > valEnd) break;
          if (aEl.idHex === 'b5') {
            const aView = new DataView(buf.buffer, buf.byteOffset + aOff, aEl.size);
            sampleRate = aEl.size === 4 ? aView.getFloat32(0) : aEl.size === 8 ? aView.getFloat64(0) : readEbmlUint(buf, aOff, aEl.size);
          } else if (aEl.idHex === '9f') {
            channels = readEbmlUint(buf, aOff, aEl.size);
          }
          ap = aEnd;
        }
      }

      p = valEnd;
    }

    const finalWidth = width || displayWidth || 1280;
    const finalHeight = height || displayHeight || 720;

    if (trackType === 1) {
      let standardCodec = 'vp8';
      let description: Uint8Array | undefined = undefined;
      const upperCodec = codecId.toUpperCase();

      if (upperCodec.includes('AVC') || upperCodec.includes('H264')) {
        if (codecPrivate && codecPrivate.length >= 7 && codecPrivate[0] === 1) {
          const pHex = codecPrivate[1].toString(16).padStart(2, '0');
          const cHex = codecPrivate[2].toString(16).padStart(2, '0');
          const lHex = codecPrivate[3].toString(16).padStart(2, '0');
          standardCodec = `avc1.${pHex}${cHex}${lHex}`;
          description = codecPrivate;
        } else {
          standardCodec = 'avc1.640028';
          description = undefined;
        }
      } else if (upperCodec.includes('HEVC') || upperCodec.includes('H265') || upperCodec.includes('MPEGH')) {
        standardCodec = 'hev1.1.6.L120.90';
        if (codecPrivate && codecPrivate.length >= 22) {
          description = codecPrivate;
        }
      } else if (upperCodec.includes('VP9')) {
        standardCodec = 'vp09.00.10.08';
        description = undefined;
      } else if (upperCodec.includes('VP8')) {
        standardCodec = 'vp8';
        description = undefined;
      } else if (upperCodec.includes('AV1')) {
        if (codecPrivate && codecPrivate.length >= 4) {
          description = codecPrivate;
          const seqProfile = (codecPrivate[1] >> 5) & 0x07;
          const seqLevelIdx = codecPrivate[1] & 0x1f;
          const seqTier = (codecPrivate[2] >> 7) & 0x01 ? 'H' : 'M';
          const highBitdepth = (codecPrivate[2] >> 6) & 0x01;
          const twelveBit = (codecPrivate[2] >> 5) & 0x01;
          const bitDepth = highBitdepth ? (twelveBit ? '12' : '10') : '08';
          const levelStr = String(seqLevelIdx || 8).padStart(2, '0');
          standardCodec = `av01.${seqProfile}.${levelStr}${seqTier}.${bitDepth}`;
        } else {
          standardCodec = 'av01.0.04M.08';
          description = undefined;
        }
      }

      const decoderConfig: VideoDecoderConfig = {
        codec: standardCodec,
        codedWidth: finalWidth,
        codedHeight: finalHeight,
      };
      if (description) {
        decoderConfig.description = description;
      }

      this.videoTracks.push({
        id: trackNum,
        type: 'video',
        codec: standardCodec,
        duration: this.duration,
        timescale: 1000,
        width: finalWidth,
        height: finalHeight,
        rotation: 0,
        fps,
        sampleCount: 0,
        decoderConfig,
      });
    } else if (trackType === 2) {
      let standardAudioCodec = 'opus';
      const upperAudio = codecId.toUpperCase();
      if (upperAudio.includes('OPUS')) standardAudioCodec = 'opus';
      else if (upperAudio.includes('VORBIS')) standardAudioCodec = 'vorbis';
      else if (upperAudio.includes('AAC')) standardAudioCodec = 'mp4a.40.2';
      else if (upperAudio.includes('MP3') || upperAudio.includes('MPEG/L3')) standardAudioCodec = 'mp3';
      else if (upperAudio.includes('FLAC')) standardAudioCodec = 'flac';
      else if (upperAudio.includes('AC3')) standardAudioCodec = 'ac-3';

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
    const tailSize = Math.min(2 * 1024 * 1024, this.fileSize);
    const tailOffset = Math.max(0, this.fileSize - tailSize);
    const tailBuf = await this.readBytes(tailOffset, tailSize);

    let maxTimecode = 0;
    for (let i = 0; i < tailBuf.length - 12; i++) {
      if (tailBuf[i] === 0x1f && tailBuf[i + 1] === 0x43 && tailBuf[i + 2] === 0xb6 && tailBuf[i + 3] === 0x75) {
        const el = readElementHeader(tailBuf, i);
        if (el) {
          const innerOffset = i + el.totalHeaderLen;
          const tcEl = readElementHeader(tailBuf, innerOffset);
          if (tcEl && tcEl.idHex === 'e7' && innerOffset + tcEl.totalHeaderLen + tcEl.size <= tailBuf.length) {
            const tc = readEbmlUint(tailBuf, innerOffset + tcEl.totalHeaderLen, tcEl.size);
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

  private extractBlockSample(
    chunkBuf: Uint8Array,
    filePos: number,
    blockPayloadStart: number,
    blockPayloadSize: number,
    clusterTimecode: number,
    videoTrackNum: number,
    audioTrackNum: number,
    isSimpleBlock: boolean,
    hasReferenceBlock: boolean,
    defaultFrameDur: number,
    videoSamples: MediaSample[],
    audioSamples: MediaSample[]
  ): void {
    if (blockPayloadStart + 4 > chunkBuf.length || blockPayloadSize <= 4) return;
    const tVint = readVint(chunkBuf, blockPayloadStart);
    if (!tVint) return;
    const isVideo = tVint.value === videoTrackNum;
    const isAudio = audioTrackNum > 0 && tVint.value === audioTrackNum;
    if (!isVideo && !isAudio) return;

    const headerBaseLen = tVint.length + 3;
    if (blockPayloadSize <= headerBaseLen || blockPayloadStart + headerBaseLen > chunkBuf.length) return;

    const timeOffset = blockPayloadStart + tVint.length;
    const timecodeRel = (chunkBuf[timeOffset] << 8) | chunkBuf[timeOffset + 1];
    const signedRel = (timecodeRel & 0x8000) ? timecodeRel - 0x10000 : timecodeRel;
    const flags = chunkBuf[timeOffset + 2];
    const isKey = isAudio ? true : (isSimpleBlock ? (flags & 0x80) !== 0 : !hasReferenceBlock);
    const lacing = (flags & 0x06) >> 1;

    let headerExtra = 0;
    let frameSize = blockPayloadSize - headerBaseLen;

    if (lacing !== 0 && timeOffset + 3 < chunkBuf.length) {
      const laceCount = chunkBuf[timeOffset + 3] + 1;
      headerExtra = 1;
      if (lacing === 2) {
        // Fixed-size lacing
        frameSize = Math.floor((blockPayloadSize - (headerBaseLen + 1)) / laceCount);
      } else if (lacing === 1) {
        // Xiph lacing
        let firstSize = 0;
        let lp = timeOffset + 4;
        while (lp < chunkBuf.length) {
          const b = chunkBuf[lp++];
          firstSize += b;
          headerExtra++;
          if (b < 255) break;
        }
        for (let f = 1; f < laceCount - 1; f++) {
          while (lp < chunkBuf.length) {
            const b = chunkBuf[lp++];
            headerExtra++;
            if (b < 255) break;
          }
        }
        frameSize = firstSize;
      } else if (lacing === 3) {
        // EBML lacing
        const firstVint = readVint(chunkBuf, timeOffset + 4);
        if (firstVint) {
          frameSize = firstVint.value;
          let lp = timeOffset + 4 + firstVint.length;
          headerExtra += firstVint.length;
          for (let f = 1; f < laceCount - 1; f++) {
            const nextVint = readVint(chunkBuf, lp);
            if (!nextVint) break;
            lp += nextVint.length;
            headerExtra += nextVint.length;
          }
        }
      }
    }

    const totalBlockHeader = headerBaseLen + headerExtra;
    const payloadOffset = filePos + blockPayloadStart + totalBlockHeader;
    const payloadSize = lacing === 0
      ? (blockPayloadSize - totalBlockHeader)
      : Math.max(0, Math.min(frameSize, blockPayloadSize - totalBlockHeader));

    if (payloadSize <= 0) return;

    const timeSec = Math.max(0, ((clusterTimecode + signedRel) * this.timecodeScale) / 1e9);
    const targetList = isVideo ? videoSamples : audioSamples;

    targetList.push({
      index: targetList.length,
      trackId: tVint.value,
      timestamp: timeSec,
      dts: timeSec,
      duration: isVideo ? defaultFrameDur : 0.02,
      isKeyframe: isKey,
      offset: payloadOffset,
      size: payloadSize,
    });
  }

  public async scanClusters(
    maxClusters: number = 10000,
    startByteOffset?: number,
    maxScanBytes: number = 32 * 1024 * 1024
  ): Promise<MediaSample[]> {
    if (startByteOffset === undefined && this.videoSamples.length > 0) return this.videoSamples;

    const samples: MediaSample[] = [];
    const aSamples: MediaSample[] = [];
    const vTrack = this.videoTracks[0];
    const aTrack = this.audioTracks[0];
    const videoTrackNum = vTrack?.id || 1;
    const audioTrackNum = aTrack?.id || -1;
    const defaultFrameDur = 1 / (vTrack?.fps || 30);

    let filePos = startByteOffset !== undefined
      ? startByteOffset
      : this.firstClusterOffset > 0
      ? this.firstClusterOffset
      : this.segmentPayloadOffset > 0
      ? this.segmentPayloadOffset
      : 0;
    const initialFilePos = filePos;
    let clusterCount = 0;
    let clusterTimecode = 0;
    const CHUNK_SIZE = 2 * 1024 * 1024;

    // If starting from an arbitrary mid-file offset, align to the first Cluster magic bytes (1f 43 b6 75)
    if (startByteOffset !== undefined && startByteOffset > this.firstClusterOffset) {
      const alignBuf = await this.readBytes(filePos, Math.min(2 * 1024 * 1024, this.fileSize - filePos));
      let foundCluster = -1;
      for (let i = 0; i + 4 <= alignBuf.length; i++) {
        if (alignBuf[i] === 0x1f && alignBuf[i + 1] === 0x43 && alignBuf[i + 2] === 0xb6 && alignBuf[i + 3] === 0x75) {
          foundCluster = i;
          break;
        }
      }
      if (foundCluster >= 0) {
        filePos += foundCluster;
      } else {
        return this.videoSamples;
      }
    }

    while (filePos < this.fileSize && clusterCount < maxClusters && (filePos - initialFilePos) < maxScanBytes) {
      const chunkBuf = await this.readBytes(filePos, CHUNK_SIZE);
      if (chunkBuf.length < 8) break;

      const isEOFChunk = filePos + chunkBuf.length >= this.fileSize;
      let p = 0;

      while (p < chunkBuf.length) {
        if (!isEOFChunk && p > 0 && p + 64 > chunkBuf.length) {
          // Reload chunk starting at p so element & block headers are never split
          break;
        }

        const el = readElementHeader(chunkBuf, p);
        if (!el || el.size < 0) {
          if (!isEOFChunk && p > 0 && p + 16 > chunkBuf.length) {
            break;
          }
          p++;
          continue;
        }

        // Step INTO Master container elements: Segment (18538067) and Cluster (1f43b675)
        if (el.idHex === '18538067') {
          p += el.totalHeaderLen;
          continue;
        } else if (el.idHex === '1f43b675') {
          clusterCount++;
          if (clusterCount > maxClusters) break;
          p += el.totalHeaderLen;
          continue;
        } else if (el.idHex === 'e7') {
          if (!isEOFChunk && p > 0 && p + el.totalHeaderLen + el.size > chunkBuf.length) {
            break;
          }
          clusterTimecode = readEbmlUint(chunkBuf, p + el.totalHeaderLen, el.size);
          p += el.totalHeaderLen + el.size;
          continue;
        } else if (el.idHex === 'a3') {
          // SimpleBlock: only need first ~32 bytes of block payload to read header!
          const blockStart = p + el.totalHeaderLen;
          if (!isEOFChunk && p > 0 && blockStart + 32 > chunkBuf.length) {
            break;
          }
          this.extractBlockSample(
            chunkBuf,
            filePos,
            blockStart,
            el.size,
            clusterTimecode,
            videoTrackNum,
            audioTrackNum,
            true,
            false,
            defaultFrameDur,
            samples,
            aSamples
          );
          p += el.totalHeaderLen + el.size;
          continue;
        } else if (el.idHex === 'a0') {
          // BlockGroup: contains Block (a1) and optional ReferenceBlock (fb)
          const bgStart = p + el.totalHeaderLen;
          const bgEnd = bgStart + el.size;
          if (!isEOFChunk && p > 0 && bgEnd > chunkBuf.length && el.size < CHUNK_SIZE / 2) {
            break;
          }
          let bgPos = bgStart;
          const safeBgEnd = Math.min(chunkBuf.length, bgEnd);
          let foundBlockStart = -1;
          let foundBlockSize = 0;
          let hasReferenceBlock = false;
          let blockDur = defaultFrameDur;

          while (bgPos + 2 <= safeBgEnd) {
            const childEl = readElementHeader(chunkBuf, bgPos);
            if (!childEl) break;
            const cStart = bgPos + childEl.totalHeaderLen;
            const cEnd = cStart + childEl.size;
            if (childEl.idHex === 'a1') {
              foundBlockStart = cStart;
              foundBlockSize = childEl.size;
            } else if (childEl.idHex === 'fb') {
              hasReferenceBlock = true;
            } else if (childEl.idHex === '9b' && cEnd <= safeBgEnd) {
              const rawDur = readEbmlUint(chunkBuf, cStart, childEl.size);
              if (rawDur > 0) blockDur = (rawDur * this.timecodeScale) / 1e9;
            }
            bgPos = cEnd;
          }

          if (foundBlockStart >= 0 && foundBlockSize > 4) {
            this.extractBlockSample(
              chunkBuf,
              filePos,
              foundBlockStart,
              foundBlockSize,
              clusterTimecode,
              videoTrackNum,
              audioTrackNum,
              false,
              hasReferenceBlock,
              blockDur,
              samples,
              aSamples
            );
          }
          p += el.totalHeaderLen + el.size;
          continue;
        }

        if (el.isUnknownSize) {
          p += el.totalHeaderLen;
        } else {
          p += el.totalHeaderLen + el.size;
        }
      }

      filePos += p > 0 ? p : chunkBuf.length;
    }

    if (samples.length > 0) {
      if (!samples.some((s) => s.isKeyframe)) {
        samples[0].isKeyframe = true;
      }

      // Compute sorted presentation timestamps for monotonic DTS and accurate frame durations
      const sortedPts = samples.map((s) => s.timestamp).slice().sort((a, b) => a - b);
      for (let i = 0; i < samples.length; i++) {
        samples[i].dts = sortedPts[i];
      }

      const maxPts = sortedPts[sortedPts.length - 1] + defaultFrameDur;
      if (this.duration <= 0 || maxPts > this.duration) {
        this.duration = maxPts;
        for (const t of this.videoTracks) t.duration = this.duration;
        for (const a of this.audioTracks) a.duration = this.duration;
      }
      if (vTrack) {
        vTrack.sampleCount = samples.length;
      }
    }

    for (let i = 0; i < aSamples.length; i++) {
      if (i + 1 < aSamples.length) {
        const d = aSamples[i + 1].timestamp - aSamples[i].timestamp;
        if (d > 0 && d < 1.0) aSamples[i].duration = d;
      }
    }

    if (startByteOffset === undefined || this.videoSamples.length === 0) {
      this.videoSamples = samples;
      this.audioSamples = aSamples;
    }
    return samples;
  }

  public async scanClustersAroundTime(targetTimeSec: number): Promise<MediaSample[]> {
    if (this.videoSamples.length === 0) {
      await this.scanClusters(400, undefined, 16 * 1024 * 1024);
    }
    if (this.videoSamples.length > 0) {
      const firstTs = this.videoSamples[0].timestamp;
      const lastTs = this.videoSamples[this.videoSamples.length - 1].timestamp;
      if (targetTimeSec >= firstTs - 0.5 && targetTimeSec <= lastTs + 0.5) {
        return this.videoSamples;
      }
    }
    if (this.duration <= 0 || this.fileSize <= 16 * 1024 * 1024) {
      return this.videoSamples;
    }

    // Proportional byte-offset jump for 100GB+ WebM/MKV files without scanning from byte 0
    const leadSec = Math.max(0, targetTimeSec - 4);
    const ratio = Math.max(0, Math.min(0.99, leadSec / this.duration));
    const approxByteOffset = Math.max(this.firstClusterOffset, Math.floor(ratio * this.fileSize));
    const windowSamples = await this.scanClusters(300, approxByteOffset, 12 * 1024 * 1024);
    if (windowSamples.length > 0) {
      this.videoSamples = windowSamples;
    }
    return this.videoSamples;
  }

  public getVideoSamples(): MediaSample[] {
    return this.videoSamples;
  }

  public getAudioSamples(): MediaSample[] {
    return this.audioSamples;
  }

  public async readSampleData(sample: MediaSample): Promise<Uint8Array> {
    const raw = await this.readBytes(sample.offset, sample.size);
    const stripped = this.headerStripMap.get(sample.trackId);
    if (stripped && stripped.length > 0 && raw.length > 0) {
      const merged = new Uint8Array(stripped.length + raw.length);
      merged.set(stripped, 0);
      merged.set(raw, stripped.length);
      return merged;
    }
    return raw;
  }
}

// ==========================================
// 5. UNIVERSAL METADATA PROBER
// ==========================================

const parsedDemuxerCache = new WeakMap<Blob, { mp4?: MP4Demuxer; ebml?: EBMLDemuxer }>();

async function probeWithHtml5Media(file: File | Blob, isAudio: boolean): Promise<{ duration: number; width: number; height: number } | null> {
  if (typeof document === 'undefined') return null;
  try {
    const media = document.createElement(isAudio ? 'audio' : 'video');
    media.preload = 'metadata';
    media.muted = true;
    const blobUrl = URL.createObjectURL(file);
    media.src = blobUrl;

    return await new Promise<{ duration: number; width: number; height: number } | null>((resolve) => {
      let isDone = false;
      const timer = setTimeout(() => {
        cleanup();
        resolve(null);
      }, 2500);
      const cleanup = () => {
        if (isDone) return;
        isDone = true;
        clearTimeout(timer);
        URL.revokeObjectURL(blobUrl);
        media.removeAttribute('src');
        if (typeof (media as any).load === 'function') (media as any).load();
      };

      media.onloadedmetadata = () => {
        const d = media.duration;
        const w = (media as HTMLVideoElement).videoWidth || 1280;
        const h = (media as HTMLVideoElement).videoHeight || 720;
        cleanup();
        if (Number.isFinite(d) && d > 0) {
          resolve({ duration: d, width: w, height: h });
        } else {
          resolve(null);
        }
      };

      media.onerror = () => {
        cleanup();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

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

  const cached = parsedDemuxerCache.get(file);
  if (cached?.mp4 && cached.mp4.videoTracks.length + cached.mp4.audioTracks.length > 0) {
    const mp4 = cached.mp4;
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

  const headSlice = file.slice(0, 16);
  const headBuf = new Uint8Array(await headSlice.arrayBuffer());

  const isEBML = headBuf.length >= 4 && headBuf[0] === 0x1a && headBuf[1] === 0x45 && headBuf[2] === 0xdf && headBuf[3] === 0xa3;
  const isMp4OrMov = (headBuf.length >= 8 && (
    (headBuf[4] === 0x66 && headBuf[5] === 0x74 && headBuf[6] === 0x79 && headBuf[7] === 0x70) || // 'ftyp'
    (headBuf[4] === 0x6d && headBuf[5] === 0x6f && headBuf[6] === 0x6f && headBuf[7] === 0x76) || // 'moov'
    (headBuf[4] === 0x66 && headBuf[5] === 0x72 && headBuf[6] === 0x65 && headBuf[7] === 0x65) || // 'free'
    (headBuf[4] === 0x6d && headBuf[5] === 0x64 && headBuf[6] === 0x61 && headBuf[7] === 0x74)    // 'mdat'
  )) || ['mp4', 'm4v', 'mov', '3gp'].includes(ext);

  if (isMp4OrMov && !isEBML) {
    try {
      const mp4 = new MP4Demuxer(file);
      const ok = await mp4.parse();
      if (ok) {
        parsedDemuxerCache.set(file, { mp4 });
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
      const ebml = cached?.ebml || new EBMLDemuxer(file);
      const ok = cached?.ebml ? true : await ebml.parse();
      if (ok) {
        if (ebml.duration <= 0) {
          // Try instant HTML5 video duration first if in DOM, else scan only a tiny 1MB header window
          const html5Meta = await probeWithHtml5Media(file, false);
          if (html5Meta && html5Meta.duration > 0) {
            ebml.duration = html5Meta.duration;
            for (const t of ebml.videoTracks) t.duration = html5Meta.duration;
            for (const a of ebml.audioTracks) a.duration = html5Meta.duration;
          } else {
            await ebml.scanClusters(12, undefined, 1024 * 1024);
          }
        }
        parsedDemuxerCache.set(file, { ebml });
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

  // Fallback HTML5 media probe if running in Window/DOM environment (never in Worker)
  const isAudio = (file.type && file.type.startsWith('audio/')) || ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'].includes(ext);
  const html5Info = await probeWithHtml5Media(file, isAudio);
  if (html5Info && html5Info.duration > 0) {
    return {
      format: isAudio ? 'audio' : (['mp4', 'm4v', 'mov'].includes(ext) ? 'mp4' : 'unknown'),
      duration: html5Info.duration,
      width: html5Info.width,
      height: html5Info.height,
      rotation: 0,
      fps: 30,
      hasVideo: !isAudio,
      hasAudio: true,
      videoTracks: !isAudio ? [{
        id: 1,
        type: 'video',
        codec: 'avc1.640028',
        duration: html5Info.duration,
        timescale: 1000,
        width: html5Info.width,
        height: html5Info.height,
        rotation: 0,
        fps: 30,
        sampleCount: Math.round(html5Info.duration * 30),
      }] : [],
      audioTracks: [{
        id: 2,
        type: 'audio',
        codec: 'mp4a.40.2',
        duration: html5Info.duration,
        timescale: 1000,
        sampleRate: 48000,
        numberOfChannels: 2,
      }],
    };
  }

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
  private initPromise: Promise<boolean> | null = null;
  private isDecoderConfigured = false;
  private decoderConfig: VideoDecoderConfig | null = null;
  private preferSoftwareDecoder = false;
  private omitDecoderDescription = false;
  private hadDecoderError = false;
  private samples: MediaSample[] = [];
  private decodedFramesQueue: VideoFrame[] = [];
  private onFrameDecoded: (() => void) | null = null;
  private mode: 'seek' | 'stream' = 'seek';
  private seekTargetTimestamp: number = 0;
  private bestSeekDiff: number = Infinity;
  private bestSeekTimestamp: number = 0;
  private bestSeekDuration: number = 0.033;
  private hasSeekFrame: boolean = false;
  private hasDrawnSeekFrame: boolean = false;
  private streamStartTime: number = 0;
  private lastDecodedKeyIdx: number = -1;
  private lastDecodedSampleIdx: number = -1;
  private inFlightChunks: number = 0;
  private activeOperationId: number = 0;
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
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = this.doInit().finally(() => {
      this.initPromise = null;
    });
    return this.initPromise;
  }

  private async doInit(): Promise<boolean> {
    if (this.initialized && this.isDecoderConfigured && this.decoder && this.decoder.state !== 'closed' && this.samples.length > 0) {
      return true;
    }

    const cached = parsedDemuxerCache.get(this.file);
    if (cached?.mp4 && cached.mp4.videoTracks.length > 0) {
      this.mp4 = cached.mp4;
      const vTrack = this.mp4.videoTracks[0];
      this.duration = this.mp4.duration || vTrack.duration;
      this.width = vTrack.width;
      this.height = vTrack.height;
      this.rotation = vTrack.rotation;
      let configCodec = vTrack.decoderConfig?.codec || vTrack.codec || 'avc1.640028';
      if (configCodec === 'avc1') configCodec = 'avc1.640028';
      else if (configCodec === 'av01') configCodec = 'av01.0.08M.08';
      else if (configCodec === 'vp09') configCodec = 'vp09.00.41.08';
      else if (configCodec === 'hvc1' || configCodec === 'hev1') configCodec = 'hvc1.1.6.L123.B0';

      this.decoderConfig = {
        codec: configCodec,
        codedWidth: vTrack.width,
        codedHeight: vTrack.height,
        description: vTrack.decoderConfig?.description,
        optimizeForLatency: true,
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

    if (cached?.ebml && cached.ebml.videoTracks.length > 0) {
      this.ebml = cached.ebml;
      const vTrack = this.ebml.videoTracks[0];
      this.samples = await this.ebml.scanClusters();
      this.duration = this.ebml.duration || vTrack.duration;
      this.width = vTrack.width;
      this.height = vTrack.height;
      this.decoderConfig = {
        ...(vTrack.decoderConfig || {
          codec: vTrack.codec || 'vp8',
          codedWidth: vTrack.width,
          codedHeight: vTrack.height,
        }),
        optimizeForLatency: true,
      };
      if (!this.options.width && this.width > 0 && this.height > 0) {
        this.offscreenCanvas.width = this.width;
        this.offscreenCanvas.height = this.height;
      }
      this.setupDecoder();
      this.initialized = true;
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

    if (isMp4 && !isEBML) {
      try {
        this.mp4 = new MP4Demuxer(this.file);
        const ok = await this.mp4.parse();
        if (ok && this.mp4.videoTracks.length > 0) {
          parsedDemuxerCache.set(this.file, { mp4: this.mp4 });
          const vTrack = this.mp4.videoTracks[0];
          this.duration = this.mp4.duration || vTrack.duration;
          this.width = vTrack.width;
          this.height = vTrack.height;
          this.rotation = vTrack.rotation;
          let configCodec = vTrack.decoderConfig?.codec || vTrack.codec || 'avc1.640028';
          if (configCodec === 'avc1') configCodec = 'avc1.640028';
          else if (configCodec === 'av01') configCodec = 'av01.0.08M.08';
          else if (configCodec === 'vp09') configCodec = 'vp09.00.41.08';
          else if (configCodec === 'hvc1' || configCodec === 'hev1') configCodec = 'hvc1.1.6.L123.B0';

          this.decoderConfig = {
            codec: configCodec,
            codedWidth: vTrack.width,
            codedHeight: vTrack.height,
            description: vTrack.decoderConfig?.description,
            optimizeForLatency: true,
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
        parsedDemuxerCache.set(this.file, { ebml: this.ebml });
        const vTrack = this.ebml.videoTracks[0];
        this.samples = await this.ebml.scanClusters();
        this.duration = this.ebml.duration || vTrack.duration;
        this.width = vTrack.width;
        this.height = vTrack.height;
        this.decoderConfig = {
          ...(vTrack.decoderConfig || {
            codec: vTrack.codec || 'vp8',
            codedWidth: vTrack.width,
            codedHeight: vTrack.height,
          }),
          optimizeForLatency: true,
        };
        if (!this.options.width && this.width > 0 && this.height > 0) {
          this.offscreenCanvas.width = this.width;
          this.offscreenCanvas.height = this.height;
        }
        this.setupDecoder();
        this.initialized = true;
        return true;
      }
    } catch (ebmlErr) {
      console.warn('NativeCanvasSink EBML init failed:', ebmlErr);
    }

    return false;
  }

  private buildActiveDecoderConfig(): VideoDecoderConfig {
    const base = this.decoderConfig!;
    const cfg: VideoDecoderConfig = {
      ...base,
      optimizeForLatency: true,
    };
    if (this.omitDecoderDescription) {
      delete cfg.description;
    }
    if (this.preferSoftwareDecoder) {
      cfg.hardwareAcceleration = 'prefer-software';
    }
    return cfg;
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
      this.inFlightChunks = 0;
      this.hadDecoderError = false;
      this.decoder = new VideoDecoder({
        output: (frame: VideoFrame) => {
          try {
            this.inFlightChunks = Math.max(0, this.inFlightChunks - 1);
            const ts = frame.timestamp / 1e6;
            const dur = (frame.duration || 33333) / 1e6;

            if (this.mode === 'seek') {
              const diff = Math.abs(ts - this.seekTargetTimestamp);
              if (!this.hasSeekFrame || diff <= this.bestSeekDiff) {
                this.bestSeekDiff = diff;
                this.bestSeekTimestamp = ts;
                this.bestSeekDuration = dur;
                this.hasSeekFrame = true;
                if (!this.hasDrawnSeekFrame || ts >= this.seekTargetTimestamp - 0.12 || diff <= 0.08) {
                  this.drawFrameToCanvas(frame);
                  this.hasDrawnSeekFrame = true;
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

            // Cap queue to 8 frames max so GPU surface pool never blocks
            while (this.decodedFramesQueue.length >= 8) {
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
          } catch (outErr) {
            console.warn('VideoDecoder output frame error:', outErr);
            try { frame.close(); } catch {}
          }
        },
        error: (decErr) => {
          console.warn('VideoDecoder runtime error:', decErr);
          this.inFlightChunks = 0;
          this.hadDecoderError = true;
          this.preferSoftwareDecoder = true;
          this.omitDecoderDescription = true;
          this.lastDecodedKeyIdx = -1;
          this.lastDecodedSampleIdx = -1;
          if (this.onFrameDecoded) {
            const cb = this.onFrameDecoded;
            this.onFrameDecoded = null;
            cb();
          }
        },
      });

      const baseCfg = this.buildActiveDecoderConfig();
      const candidates: VideoDecoderConfig[] = [baseCfg];

      const c = (baseCfg.codec || '').toLowerCase();
      const isHevc = c.includes('hvc1') || c.includes('hev1') || c.includes('hevc') || c.includes('265');

      if (isHevc) {
        // Multi-candidate HEVC fallback matrix (crucial for Chrome / Windows / Linux WebCodecs differences)
        const desc = baseCfg.description;
        if (baseCfg.codec.startsWith('hvc1')) {
          candidates.push({ ...baseCfg, codec: baseCfg.codec.replace('hvc1', 'hev1') });
        } else if (baseCfg.codec.startsWith('hev1')) {
          candidates.push({ ...baseCfg, codec: baseCfg.codec.replace('hev1', 'hvc1') });
        }

        // Without description (for drivers requiring in-band parameter sets)
        candidates.push({ ...baseCfg, description: undefined });
        if (baseCfg.codec.startsWith('hvc1')) {
          candidates.push({ ...baseCfg, codec: baseCfg.codec.replace('hvc1', 'hev1'), description: undefined });
        }

        // Standard profile/level fallbacks (Main & Main 10)
        candidates.push({ ...baseCfg, codec: 'hvc1.1.6.L120.B0', description: desc });
        candidates.push({ ...baseCfg, codec: 'hev1.1.6.L120.B0', description: undefined });
        candidates.push({ ...baseCfg, codec: 'hvc1.2.4.L120.B0', description: desc });
        candidates.push({ ...baseCfg, codec: 'hev1.2.4.L120.B0', description: undefined });
        candidates.push({ ...baseCfg, codec: 'hev1.1.6.L93.B0', description: undefined });

        // Software fallback candidates
        candidates.push({ ...baseCfg, hardwareAcceleration: 'prefer-software' });
        candidates.push({ ...baseCfg, codec: 'hev1.1.6.L120.B0', hardwareAcceleration: 'prefer-software', description: undefined });
      } else {
        candidates.push({ ...baseCfg, description: undefined });
        candidates.push({ ...baseCfg, hardwareAcceleration: 'prefer-software' });
      }

      let configured = false;
      for (const cand of candidates) {
        try {
          this.decoder.configure(cand);
          configured = true;
          this.decoderConfig = cand;
          break;
        } catch {}
      }
      this.isDecoderConfigured = configured;
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

  private findSampleIndex(targetTimestamp: number): number {
    const s = this.samples;
    const len = s.length;
    if (len === 0) return 0;

    // Fast O(log N) binary search on DTS/timestamp
    let low = 0;
    let high = len - 1;
    while (low <= high) {
      const mid = (low + high) >>> 1;
      const midTs = s[mid].dts ?? s[mid].timestamp;
      if (midTs < targetTimestamp) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const center = Math.max(0, Math.min(len - 1, low));
    const windowStart = Math.max(0, center - 16);
    const windowEnd = Math.min(len - 1, center + 16);
    let bestIdx = center;
    let minDiff = Infinity;
    for (let i = windowStart; i <= windowEnd; i++) {
      const diff = Math.abs(s[i].timestamp - targetTimestamp);
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  private async readSampleRangeBytes(startIdx: number, endIdx: number): Promise<Uint8Array[]> {
    const count = endIdx - startIdx + 1;
    if (count <= 0) return [];
    if (count === 1) {
      return [await this.readSampleBytes(this.samples[startIdx])];
    }

    // Check if we can read the entire contiguous range in a single Blob.slice() call (up to 64MB)
    let minOffset = Infinity;
    let maxEnd = 0;
    for (let i = startIdx; i <= endIdx; i++) {
      const s = this.samples[i];
      if (s.offset < minOffset) minOffset = s.offset;
      if (s.offset + s.size > maxEnd) maxEnd = s.offset + s.size;
    }

    const span = maxEnd - minOffset;
    if (span > 0 && span <= 64 * 1024 * 1024 && !this.ebml) {
      const rangeBuf = new Uint8Array(await this.file.slice(minOffset, maxEnd).arrayBuffer());
      const out: Uint8Array[] = new Array(count);
      for (let i = startIdx; i <= endIdx; i++) {
        const s = this.samples[i];
        const relStart = s.offset - minOffset;
        out[i - startIdx] = rangeBuf.subarray(relStart, relStart + s.size);
      }
      return out;
    }

    // Parallel batched reads to avoid sequential disk I/O stalls on 100GB files
    const out: Uint8Array[] = new Array(count);
    const BATCH = 16;
    for (let b = startIdx; b <= endIdx; b += BATCH) {
      const bEnd = Math.min(endIdx, b + BATCH - 1);
      const promises: Promise<Uint8Array>[] = [];
      for (let i = b; i <= bEnd; i++) {
        promises.push(this.readSampleBytes(this.samples[i]));
      }
      const results = await Promise.all(promises);
      for (let j = 0; j < results.length; j++) {
        out[b - startIdx + j] = results[j];
      }
    }
    return out;
  }

  public stopStream(): void {
    this.activeOperationId++;
    if (this.onFrameDecoded) {
      const cb = this.onFrameDecoded;
      this.onFrameDecoded = null;
      cb();
    }
    for (const f of this.decodedFramesQueue) {
      try { f.close(); } catch {}
    }
    this.decodedFramesQueue = [];
  }

  public async getCanvas(targetTimestamp: number, fastKeyframeMode: boolean = false): Promise<WrappedCanvas | null> {
    const opId = ++this.activeOperationId;
    if (this.onFrameDecoded) {
      const cb = this.onFrameDecoded;
      this.onFrameDecoded = null;
      cb();
    }

    const run = async (): Promise<WrappedCanvas | null> => {
      if (this.activeOperationId !== opId) return null;
      await this.init();
      if (this.activeOperationId !== opId) return null;

      if (this.ebml) {
        this.samples = await this.ebml.scanClustersAroundTime(targetTimestamp);
        if (this.activeOperationId !== opId) return null;
      }

      if (!this.isDecoderConfigured || !this.decoder || this.samples.length === 0) {
        return null;
      }

      if (this.decoder.state === 'closed' || this.hadDecoderError) {
        this.setupDecoder();
        if (!this.decoder || (this.decoder as VideoDecoder).state === 'closed') return null;
      }

      try {
        this.mode = 'seek';
        this.seekTargetTimestamp = targetTimestamp;

        // O(log N) binary search for target sample index
        const targetSampleIdx = this.findSampleIndex(targetTimestamp);

        let keyframeIdx = targetSampleIdx;
        while (keyframeIdx > 0 && !this.samples[keyframeIdx].isKeyframe) {
          keyframeIdx--;
        }

        // Include up to 2 subsequent samples in case of B-frame reordering,
        // or in fastKeyframeMode (thumbnails) cap to keyframe window for instant 10x speed
        let decodeEndIdx = Math.min(this.samples.length - 1, targetSampleIdx + 2);
        if (fastKeyframeMode) {
          // Instant decode for thumbnails and scrubbing: only decode the keyframe + 1
          decodeEndIdx = Math.min(this.samples.length - 1, keyframeIdx + 1);
          this.seekTargetTimestamp = this.samples[keyframeIdx].timestamp;
        } else if (decodeEndIdx - keyframeIdx > 90 && this.file.size > 512 * 1024 * 1024) {
          // Cap long-GOP decode span on huge 100GB files so interactive seeks never stall
          decodeEndIdx = Math.min(decodeEndIdx, keyframeIdx + 90);
          this.seekTargetTimestamp = this.samples[decodeEndIdx].timestamp;
        }

        // If exact same sample range was already decoded, return cached canvas immediately
        if (
          this.lastDecodedKeyIdx === keyframeIdx &&
          this.lastDecodedSampleIdx >= targetSampleIdx &&
          this.hasSeekFrame &&
          (fastKeyframeMode || Math.abs(this.bestSeekTimestamp - targetTimestamp) < 0.05)
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
          this.decoder.state === 'configured' &&
          !this.hadDecoderError
        ) {
          // Incremental forward decode from previous position in the same GOP!
          startDecodeIdx = this.lastDecodedSampleIdx + 1;
          this.bestSeekDiff = Math.abs(this.bestSeekTimestamp - this.seekTargetTimestamp);
        } else {
          this.bestSeekDiff = Infinity;
          this.hasSeekFrame = false;
          this.hasDrawnSeekFrame = false;
          this.inFlightChunks = 0;
          if (this.decoder.state === 'configured') {
            try {
              this.decoder.reset();
              this.decoder.configure(this.buildActiveDecoderConfig());
            } catch {
              this.setupDecoder();
            }
          }
        }

        const targetExpectedTs = this.samples[Math.min(targetSampleIdx, decodeEndIdx)].timestamp;
        const payloads = await this.readSampleRangeBytes(startDecodeIdx, decodeEndIdx);
        if (this.activeOperationId !== opId) return null;

        for (let i = startDecodeIdx; i <= decodeEndIdx; i++) {
          if (this.activeOperationId !== opId) return null;
          const sample = this.samples[i];
          const data = payloads[i - startDecodeIdx];
          if (!data || data.length === 0) continue;

          if (!this.decoder || this.decoder.state !== 'configured' || this.hadDecoderError) {
            break;
          }

          this.inFlightChunks++;
          this.decoder.decode(new EncodedVideoChunk({
            type: sample.isKeyframe ? 'key' : 'delta',
            timestamp: Math.round(sample.timestamp * 1e6),
            duration: Math.round(sample.duration * 1e6),
            data,
          }));

          // Yield briefly if hardware decode queue gets deep on a long GOP so we can abort immediately if superseded
          if ((this.decoder.decodeQueueSize || 0) > 16) {
            await new Promise<void>((resolve) => {
              this.onFrameDecoded = resolve;
              setTimeout(resolve, 8);
            });
            if (this.activeOperationId !== opId) return null;
          }
        }

        if (this.activeOperationId !== opId) return null;

        // Wait for VideoDecoder to emit up to targetExpectedTs WITHOUT calling flush() if possible,
        // generous 1200ms wait so H.265 frames have adequate time to process without premature abortion
        const waitStart = performance.now();
        const maxWaitMs = fastKeyframeMode ? 300 : 1200;
        while (
          this.activeOperationId === opId &&
          !this.hadDecoderError &&
          this.decoder &&
          this.decoder.state === 'configured' &&
          (!this.hasDrawnSeekFrame || (this.bestSeekTimestamp < targetExpectedTs - 0.04 && (this.decoder.decodeQueueSize > 0 || this.inFlightChunks > 0))) &&
          performance.now() - waitStart < maxWaitMs
        ) {
          await new Promise<void>((resolve) => {
            this.onFrameDecoded = resolve;
            setTimeout(resolve, 8);
          });
        }

        if (this.activeOperationId !== opId) return null;

        if (this.hasDrawnSeekFrame && Math.abs(this.bestSeekTimestamp - targetExpectedTs) <= 0.06) {
          this.lastDecodedKeyIdx = keyframeIdx;
          this.lastDecodedSampleIdx = decodeEndIdx;
        } else if (this.decoder && this.decoder.state === 'configured' && !this.hadDecoderError) {
          // Only flush if B-frame reorder buffer held the target frame back
          let flushResolved = false;
          await Promise.race([
            this.decoder.flush().then(() => { flushResolved = true; }).catch(() => {}),
            new Promise<void>((resolve) => {
              this.onFrameDecoded = resolve;
              setTimeout(resolve, 400);
            }),
          ]);
          // W3C WebCodecs spec: flush() requires the next chunk to be a keyframe!
          this.lastDecodedKeyIdx = -1;
          this.lastDecodedSampleIdx = -1;
          if (!flushResolved && this.decoder && this.decoder.state === 'configured') {
            try {
              this.decoder.reset();
              this.decoder.configure(this.buildActiveDecoderConfig());
            } catch {}
          }
        } else {
          this.lastDecodedKeyIdx = -1;
          this.lastDecodedSampleIdx = -1;
        }

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
    try {
      const cw = this.offscreenCanvas.width || 1280;
      const ch = this.offscreenCanvas.height || 720;

      this.ctx.clearRect(0, 0, cw, ch);

      if (this.options.fit === 'cover') {
        const fw = frame.displayWidth || cw;
        const fh = frame.displayHeight || ch;
        const frameRatio = fw / fh;
        const canvasRatio = cw / ch;
        let sx = 0, sy = 0, sw = fw, sh = fh;

        if (frameRatio > canvasRatio) {
          sw = fh * canvasRatio;
          sx = (fw - sw) / 2;
        } else {
          sh = fw / canvasRatio;
          sy = (fh - sh) / 2;
        }
        this.ctx.drawImage(frame, sx, sy, sw, sh, 0, 0, cw, ch);
      } else {
        this.ctx.drawImage(frame, 0, 0, cw, ch);
      }
    } catch (e) {
      console.warn('drawFrameToCanvas error:', e);
    }
  }

  public async *canvases(startTime: number = 0): AsyncGenerator<WrappedCanvas> {
    if (this.ebml) {
      this.samples = await this.ebml.scanClustersAroundTime(startTime);
    }
    if (!this.isDecoderConfigured || !this.decoder || this.samples.length === 0) return;

    const opId = ++this.activeOperationId;
    if (this.onFrameDecoded) {
      const cb = this.onFrameDecoded;
      this.onFrameDecoded = null;
      cb();
    }

    if (this.decoder.state === 'closed') {
      this.setupDecoder();
      if (!this.decoder || (this.decoder as VideoDecoder).state === 'closed') return;
    }

    this.mode = 'stream';
    this.streamStartTime = startTime;
    this.lastDecodedKeyIdx = -1;
    this.lastDecodedSampleIdx = -1;

    let startIdx = this.findSampleIndex(startTime);
    while (startIdx > 0 && !this.samples[startIdx].isKeyframe) {
      startIdx--;
    }

    // Clear any previous queued frames
    for (const f of this.decodedFramesQueue) {
      try { f.close(); } catch {}
    }
    this.decodedFramesQueue = [];

    if (this.decoder.state === 'configured') {
      try {
        this.decoder.reset();
        this.inFlightChunks = 0;
        this.decoder.configure(this.decoderConfig!);
      } catch {
        this.setupDecoder();
      }
    }

    let sampleIdx = startIdx;
    let isFeeding = true;

    while (sampleIdx < this.samples.length || this.decodedFramesQueue.length > 0) {
      if (this.activeOperationId !== opId) return;
      this.mode = 'stream';

      if (!this.decoder || this.decoder.state === 'closed') {
        this.setupDecoder();
        if (!this.decoder || (this.decoder as VideoDecoder).state === 'closed') return;
        while (sampleIdx < this.samples.length && !this.samples[sampleIdx].isKeyframe) {
          sampleIdx++;
        }
      }

      // Feed chunks into decoder in contiguous batches so disk I/O is 8x faster on 100GB files
      const isPreRoll = sampleIdx < this.samples.length && this.samples[sampleIdx].timestamp < startTime - 0.05;
      const maxQueue = isPreRoll ? 12 : 6;
      const availSlots = Math.min(
        maxQueue - (this.decodedFramesQueue.length + this.inFlightChunks),
        maxQueue - (this.decoder.decodeQueueSize || 0)
      );
      if (sampleIdx < this.samples.length && this.decodedFramesQueue.length < 4 && availSlots > 0) {
        const batchCount = Math.min(availSlots, this.samples.length - sampleIdx, 8);
        const batchEndIdx = sampleIdx + batchCount - 1;
        const payloads = await this.readSampleRangeBytes(sampleIdx, batchEndIdx);
        if (this.activeOperationId !== opId) return;

        for (let k = 0; k < payloads.length; k++) {
          const sample = this.samples[sampleIdx++];
          const data = payloads[k];
          if (data && data.length > 0 && this.decoder && this.decoder.state === 'configured') {
            try {
              this.inFlightChunks++;
              this.decoder.decode(new EncodedVideoChunk({
                type: sample.isKeyframe ? 'key' : 'delta',
                timestamp: Math.round(sample.timestamp * 1e6),
                duration: Math.round(sample.duration * 1e6),
                data,
              }));
            } catch {
              this.inFlightChunks = Math.max(0, this.inFlightChunks - 1);
              break;
            }
          }
        }
      }

      if (this.activeOperationId !== opId) return;

      // Flush once when all chunks are fed to drain the decoder pipeline
      if (sampleIdx >= this.samples.length && isFeeding) {
        isFeeding = false;
        try {
          if (this.decoder && this.decoder.state === 'configured') {
            await Promise.race([
              this.decoder.flush(),
              new Promise<void>((r) => setTimeout(r, 800)),
            ]);
          }
        } catch {}
        this.inFlightChunks = 0;
      }

      if (this.activeOperationId !== opId) return;

      // Always yield to the macrotask queue when waiting for decoded frames so VideoDecoder output callback can fire
      if (
        this.decodedFramesQueue.length === 0 &&
        (this.inFlightChunks > 0 || (this.decoder && (this.decoder.decodeQueueSize || 0) > 0))
      ) {
        await new Promise<void>((resolve) => {
          this.onFrameDecoded = resolve;
          setTimeout(resolve, 12);
        });
        if (this.decodedFramesQueue.length === 0) {
          // Allow feeding additional packets if decoder is holding B-frame reorder buffer
          this.inFlightChunks = this.decoder?.decodeQueueSize || 0;
        }
      }

      if (this.activeOperationId !== opId) return;

      // Yield all decoded frames ready in the queue
      while (this.decodedFramesQueue.length > 0) {
        if (this.activeOperationId !== opId) return;
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
          if (this.activeOperationId !== opId) return;
        } else {
          try { frame.close(); } catch {}
        }
      }
    }
  }

  public async *canvasesAtTimestamps(timestamps: number[]): AsyncGenerator<WrappedCanvas> {
    for (const ts of timestamps) {
      const result = await this.getCanvas(ts, true);
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

function encodeFloat32(val: number): Uint8Array {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setFloat32(0, val, false);
  return new Uint8Array(buf);
}

/**
 * Helper to parse AV1 OBUs from a chunk and extract the Sequence Header OBU (type 1)
 * and generate a valid AV1CodecConfigurationRecord (av1C payload).
 */
export function extractAv1ConfigRecord(sampleData: Uint8Array): Uint8Array | null {
  let offset = 0;
  let seqHeaderObu: Uint8Array | null = null;
  let seqProfile = 0;
  let seqLevelIdx = 8; // Level 4.0
  let seqTier = 0;
  let highBitdepth = 0;
  let twelveBit = 0;
  let monochrome = 0;
  let chromaSubsamplingX = 1;
  let chromaSubsamplingY = 1;
  let chromaSamplePosition = 0;

  while (offset < sampleData.length) {
    const headerByte = sampleData[offset];
    const obuForbidden = (headerByte >> 7) & 0x01;
    if (obuForbidden !== 0) break;

    const obuType = (headerByte >> 3) & 0x0f;
    const obuExtensionFlag = (headerByte >> 2) & 0x01;
    const obuHasSizeField = (headerByte >> 1) & 0x01;

    let headerSize = 1;
    if (obuExtensionFlag) headerSize += 1;

    let obuPayloadSize = 0;
    if (obuHasSizeField) {
      let lebBytes = 0;
      let val = 0;
      while (offset + headerSize + lebBytes < sampleData.length && lebBytes < 8) {
        const b = sampleData[offset + headerSize + lebBytes];
        val |= (b & 0x7f) << (lebBytes * 7);
        lebBytes++;
        if ((b & 0x80) === 0) break;
      }
      headerSize += lebBytes;
      obuPayloadSize = val;
    } else {
      obuPayloadSize = sampleData.length - (offset + headerSize);
    }

    const totalObuSize = headerSize + obuPayloadSize;
    if (offset + totalObuSize > sampleData.length) break;

    if (obuType === 1) { // OBU_SEQUENCE_HEADER
      seqHeaderObu = sampleData.subarray(offset, offset + totalObuSize);

      const payloadStart = offset + headerSize;
      if (payloadStart + 2 <= sampleData.length) {
        const b0 = sampleData[payloadStart];
        seqProfile = (b0 >> 5) & 0x07;
        if (payloadStart + 3 <= sampleData.length) {
          const b1 = sampleData[payloadStart + 1];
          seqLevelIdx = (b1 >> 1) & 0x1f;
          seqTier = b1 & 0x01;
        }
      }
      break;
    }

    offset += totalObuSize;
  }

  if (seqHeaderObu && seqHeaderObu.length > 0) {
    const record = new Uint8Array(4 + seqHeaderObu.length);
    record[0] = 0x81; // marker (1) | version (1)
    record[1] = ((seqProfile & 0x07) << 5) | (seqLevelIdx & 0x1f);
    record[2] = ((seqTier & 0x01) << 7) | ((highBitdepth & 0x01) << 6) | ((twelveBit & 0x01) << 5) |
                ((monochrome & 0x01) << 4) | ((chromaSubsamplingX & 0x01) << 3) |
                ((chromaSubsamplingY & 0x01) << 2) | (chromaSamplePosition & 0x03);
    record[3] = 0x00;
    record.set(seqHeaderObu, 4);
    return record;
  }

  return null;
}

/**
 * Builds a compliant default AV1CodecConfigurationRecord with Sequence Header OBU.
 */
export function buildDefaultAv1ConfigRecord(w: number = 1920, h: number = 1080, fps: number = 30): Uint8Array {
  // Standard compliant AV1 Sequence Header OBU for Profile 0, Level 4.0, 8-bit YUV 4:2:0
  const seqHeaderObu = new Uint8Array([
    0x0a, 0x0b, 0x00, 0x00, 0x00, 0x24, 0xa0, 0x3c, 0x23, 0x80, 0x10, 0x00, 0x00
  ]);
  const record = new Uint8Array(4 + seqHeaderObu.length);
  record[0] = 0x81; // marker=1, version=1
  record[1] = (0 << 5) | 8; // Profile 0, Level 4.0
  record[2] = 0x0c; // Tier 0, 8-bit, 4:2:0
  record[3] = 0x00;
  record.set(seqHeaderObu, 4);
  return record;
}

export interface WebMMuxerOptions {
  width?: number;
  height?: number;
  fps?: number;
  framerate?: number;
  videoCodec?: string;
  audioCodec?: string;
  sampleRate?: number;
  channels?: number;
  videoDescription?: Uint8Array;
  audioDescription?: Uint8Array;
  isMkv?: boolean;
  onChunk: (chunk: StreamTargetChunk) => Promise<void> | void;
}

function concatByteArrays(arrays: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const a of arrays) total += a.byteLength;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const a of arrays) {
    out.set(a, pos);
    pos += a.byteLength;
  }
  return out;
}

function encodeFloat64(val: number): Uint8Array {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setFloat64(0, val, false);
  return new Uint8Array(buf);
}

export class WebMMuxer {
  private options: WebMMuxerOptions;
  private currentClusterTimecode: number = -1;
  private currentClusterBlocks: Uint8Array[] = [];
  private totalBytes = 0;
  private maxEndMs = 0;
  private durationPatchOffset = -1;
  private isHeaderSent = false;

  constructor(options: WebMMuxerOptions) {
    this.options = options;
  }

  public async start(): Promise<void> {
    // Lazy header emission in ensureStarted() once codec metadata/dimensions are finalized
  }

  private async ensureStarted(): Promise<void> {
    if (this.isHeaderSent) return;
    this.isHeaderSent = true;

    const docTypeStr = this.options.isMkv ? 'matroska' : 'webm';
    const docType = encodeElement('4282', encodeString(docTypeStr));
    const docTypeVer = encodeElement('4287', encodeUint(4));
    const docTypeReadVer = encodeElement('4285', encodeUint(2));
    const ebmlHdr = encodeElement('1a45dfa3', new Uint8Array([...docType, ...docTypeVer, ...docTypeReadVer]));

    const segId = new Uint8Array([0x18, 0x53, 0x80, 0x67]);
    const segSize = new Uint8Array([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);

    const timecodeScale = encodeElement('2ad7b1', encodeUint(1000000));
    const muxingApp = encodeElement('4d80', encodeString('VideoCutterPro'));
    const writingApp = encodeElement('5741', encodeString('VideoCutterPro'));
    const durationEl = encodeElement('4489', encodeFloat64(0));
    const infoPayload = new Uint8Array([...timecodeScale, ...muxingApp, ...writingApp, ...durationEl]);
    const infoEl = encodeElement('1549a966', infoPayload);

    const infoHeaderLen = infoEl.length - infoPayload.length;
    this.durationPatchOffset =
      ebmlHdr.length +
      segId.length +
      segSize.length +
      infoHeaderLen +
      timecodeScale.length +
      muxingApp.length +
      writingApp.length +
      3; // 0x44, 0x89, 0x88

    const trackEntries: number[] = [];

    if (this.options.width && this.options.height) {
      const trackNum = encodeElement('d7', encodeUint(1));
      const trackUid = encodeElement('73c5', encodeUint(1));
      const trackType = encodeElement('83', encodeUint(1));

      const fps = Math.max(1, Math.min(240, Math.round(this.options.fps || this.options.framerate || 30)));
      // DefaultDuration in nanoseconds (1_000_000_000 / fps) - standard way Matroska/WebM encodes framerate
      const defaultDurNs = Math.round(1_000_000_000 / fps);
      const defaultDurationEl = encodeElement('23e383', encodeUint(defaultDurNs));

      let codecIdStr = 'V_VP9';
      const c = (this.options.videoCodec || '').toLowerCase();
      const isAv1 = c.includes('av1') || c.includes('av01');
      if (c.includes('vp8')) codecIdStr = 'V_VP8';
      else if (isAv1) codecIdStr = 'V_AV1';
      else if (c.includes('hevc') || c.includes('hvc1') || c.includes('hev1') || c.includes('265')) codecIdStr = 'V_MPEGH/ISO/HEVC';
      else if (c.includes('avc') || c.includes('264')) codecIdStr = 'V_MPEG4/ISO/AVC';

      const codecId = encodeElement('86', encodeString(codecIdStr));

      let descBytes = this.options.videoDescription;
      if (isAv1 && (!descBytes || descBytes.byteLength < 4)) {
        descBytes = buildDefaultAv1ConfigRecord(this.options.width, this.options.height, fps);
        this.options.videoDescription = descBytes;
      }

      const codecPrivateEl = (descBytes && descBytes.byteLength > 0)
        ? encodeElement('63a2', descBytes)
        : new Uint8Array(0);

      const pixelW = encodeElement('b0', encodeUint(this.options.width));
      const pixelH = encodeElement('ba', encodeUint(this.options.height));
      const displayW = encodeElement('54b0', encodeUint(this.options.width));
      const displayH = encodeElement('54ba', encodeUint(this.options.height));
      const frameRateEl = encodeElement('2383e3', encodeFloat32(fps));

      // Colour element (0x55b0) for accurate color rendering in AV1 / VP9
      const matrixEl = encodeElement('55b1', encodeUint(1)); // BT.709
      const bitsEl = encodeElement('55b2', encodeUint(8));
      const subHEl = encodeElement('55b5', encodeUint(1)); // 4:2:0
      const subVEl = encodeElement('55b6', encodeUint(1));
      const rangeEl = encodeElement('55b9', encodeUint(1)); // Broadcast/Limited
      const transferEl = encodeElement('55ba', encodeUint(1)); // BT.709
      const primariesEl = encodeElement('55bb', encodeUint(1)); // BT.709
      const colourEl = encodeElement('55b0', new Uint8Array([
        ...matrixEl, ...bitsEl, ...subHEl, ...subVEl, ...rangeEl, ...transferEl, ...primariesEl
      ]));

      const videoSettings = encodeElement('e0', new Uint8Array([
        ...pixelW, ...pixelH, ...displayW, ...displayH, ...frameRateEl, ...colourEl
      ]));

      const vEntry = encodeElement('ae', new Uint8Array([
        ...trackNum, ...trackUid, ...trackType, ...defaultDurationEl, ...codecId, ...codecPrivateEl, ...videoSettings
      ]));
      trackEntries.push(...vEntry);
    }

    if (this.options.audioCodec) {
      const trackNum = encodeElement('d7', encodeUint(2));
      const trackUid = encodeElement('73c5', encodeUint(2));
      const trackType = encodeElement('83', encodeUint(2));

      let aCodecIdStr = 'A_OPUS';
      const ac = (this.options.audioCodec || '').toLowerCase();
      if (ac.includes('aac') || ac.includes('mp4a')) aCodecIdStr = 'A_AAC';
      else if (ac.includes('vorbis')) aCodecIdStr = 'A_VORBIS';
      else if (ac.includes('flac')) aCodecIdStr = 'A_FLAC';
      else if (ac.includes('mp3')) aCodecIdStr = 'A_MPEG/L3';
      else if (ac.includes('pcm')) aCodecIdStr = 'A_PCM/INT/LIT';

      const codecId = encodeElement('86', encodeString(aCodecIdStr));
      const sr = this.options.sampleRate || 48000;
      const ch = this.options.channels || 2;

      let aPrivBytes: Uint8Array | undefined = this.options.audioDescription;
      if (aCodecIdStr === 'A_FLAC' && aPrivBytes && aPrivBytes.byteLength > 0) {
        const hasMagic = aPrivBytes.length >= 4 && aPrivBytes[0] === 0x66 && aPrivBytes[1] === 0x4c && aPrivBytes[2] === 0x61 && aPrivBytes[3] === 0x43;
        if (!hasMagic) {
          const flacPriv = new Uint8Array(8 + aPrivBytes.length);
          flacPriv.set([0x66, 0x4c, 0x61, 0x43], 0); // 'fLaC'
          flacPriv[4] = 0x80; // Last metadata block + STREAMINFO (0)
          flacPriv[5] = (aPrivBytes.length >> 16) & 0xff;
          flacPriv[6] = (aPrivBytes.length >> 8) & 0xff;
          flacPriv[7] = aPrivBytes.length & 0xff;
          flacPriv.set(aPrivBytes, 8);
          aPrivBytes = flacPriv;
        }
      } else if (!aPrivBytes || aPrivBytes.byteLength === 0) {
        if (aCodecIdStr === 'A_OPUS') {
          const opusHead = new Uint8Array(19);
          opusHead.set(encodeString('OpusHead'), 0);
          opusHead[8] = 1;
          opusHead[9] = ch;
          opusHead[10] = 0x38;
          opusHead[11] = 0x01;
          new DataView(opusHead.buffer).setUint32(12, sr, true);
          opusHead[16] = 0;
          opusHead[17] = 0;
          opusHead[18] = 0;
          aPrivBytes = opusHead;
        } else if (aCodecIdStr === 'A_AAC') {
          aPrivBytes = new Uint8Array([0x11, 0x90]);
        }
      }
      const aCodecPrivEl = (aPrivBytes && aPrivBytes.byteLength > 0)
        ? encodeElement('63a2', aPrivBytes)
        : new Uint8Array(0);

      const sRate = encodeElement('b5', encodeFloat(sr));
      const chans = encodeElement('9f', encodeUint(ch));
      const audioSettings = encodeElement('e1', new Uint8Array([...sRate, ...chans]));

      const aEntry = encodeElement('ae', new Uint8Array([...trackNum, ...trackUid, ...trackType, ...codecId, ...aCodecPrivEl, ...audioSettings]));
      trackEntries.push(...aEntry);
    }

    const tracksEl = encodeElement('1654ae6b', new Uint8Array(trackEntries));
    const initData = new Uint8Array([...ebmlHdr, ...segId, ...segSize, ...infoEl, ...tracksEl]);
    await this.emitChunk(initData);
  }

  public async addVideoChunk(chunk: EncodedVideoChunk, meta?: any): Promise<void> {
    if (meta?.decoderConfig) {
      if (meta.decoderConfig.codec) {
        this.options.videoCodec = meta.decoderConfig.codec;
      }
      if (meta.decoderConfig.description) {
        const d = meta.decoderConfig.description;
        this.options.videoDescription = d instanceof Uint8Array
          ? d
          : new Uint8Array(d instanceof ArrayBuffer ? d : d.buffer, d.byteOffset || 0, d.byteLength);
      }
      if (!this.options.width && meta.decoderConfig.codedWidth) this.options.width = meta.decoderConfig.codedWidth;
      if (!this.options.height && meta.decoderConfig.codedHeight) this.options.height = meta.decoderConfig.codedHeight;
    }

    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);

    const c = (this.options.videoCodec || '').toLowerCase();
    const isAv1 = c.includes('av1') || c.includes('av01');
    if (isAv1 && (!this.options.videoDescription || this.options.videoDescription.byteLength < 8)) {
      const extracted = extractAv1ConfigRecord(data);
      if (extracted) {
        this.options.videoDescription = extracted;
      }
    }

    await this.ensureStarted();

    const timeMs = Math.max(0, Math.round(chunk.timestamp / 1000));
    const durMs = Math.max(1, Math.round((chunk.duration || 33333) / 1000));
    this.maxEndMs = Math.max(this.maxEndMs, timeMs + durMs);

    await this.addBlock(1, timeMs, chunk.type === 'key', data);
  }

  public async addAudioChunk(chunk: EncodedAudioChunk, meta?: any): Promise<void> {
    if (meta?.decoderConfig) {
      if (meta.decoderConfig.codec) {
        this.options.audioCodec = meta.decoderConfig.codec;
      }
      if (meta.decoderConfig.description) {
        const d = meta.decoderConfig.description;
        this.options.audioDescription = d instanceof Uint8Array
          ? d
          : new Uint8Array(d instanceof ArrayBuffer ? d : d.buffer, d.byteOffset || 0, d.byteLength);
      }
      if (meta.decoderConfig.sampleRate) this.options.sampleRate = meta.decoderConfig.sampleRate;
      if (meta.decoderConfig.numberOfChannels) this.options.channels = meta.decoderConfig.numberOfChannels;
    }
    if (!this.options.audioCodec) this.options.audioCodec = 'opus';
    await this.ensureStarted();

    const timeMs = Math.max(0, Math.round(chunk.timestamp / 1000));
    const durMs = Math.max(1, Math.round((chunk.duration || 21333) / 1000));
    this.maxEndMs = Math.max(this.maxEndMs, timeMs + durMs);

    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);

    await this.addBlock(2, timeMs, true, data);
  }

  private async addBlock(trackNum: number, timeMs: number, isKey: boolean, data: Uint8Array): Promise<void> {
    if (
      this.currentClusterTimecode < 0 ||
      timeMs < this.currentClusterTimecode ||
      (isKey && trackNum === 1 && timeMs - this.currentClusterTimecode >= 1000) ||
      timeMs - this.currentClusterTimecode >= 2000
    ) {
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
    await this.ensureStarted();
    await this.flushCluster();
    if (this.durationPatchOffset >= 0 && this.maxEndMs > 0) {
      await this.options.onChunk({
        data: encodeFloat64(this.maxEndMs),
        position: this.durationPatchOffset,
      });
    }
  }
}

// ==========================================
// 8. NATIVE MP4 MUXER (STANDARD ISO BMFF)
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

function buildBtrtBox(maxBitrate: number = 192000, avgBitrate: number = 192000, bufferSizeDB: number = 65536): Uint8Array {
  const payload = new Uint8Array(12);
  const view = new DataView(payload.buffer);
  view.setUint32(0, bufferSizeDB >>> 0);
  view.setUint32(4, Math.max(8000, Math.round(maxBitrate)) >>> 0);
  view.setUint32(8, Math.max(8000, Math.round(avgBitrate)) >>> 0);
  return createBox('btrt', payload);
}

function buildEsdsBox(audioSpecificConfig?: Uint8Array, bitrate: number = 128000): Uint8Array {
  if (audioSpecificConfig && audioSpecificConfig.length > 6 && audioSpecificConfig[0] === 0 && audioSpecificConfig[4] === 0x03) {
    // Already a full esds box payload from MP4Demuxer
    return createBox('esds', audioSpecificConfig);
  }
  const asc = (audioSpecificConfig && audioSpecificConfig.length >= 2)
    ? audioSpecificConfig
    : new Uint8Array([0x11, 0x90]); // 48000Hz 2ch AAC-LC
  const ascLen = asc.length;
  const decConfigLen = 13 + 2 + ascLen;
  const esDescrLen = 3 + 2 + decConfigLen + 3;
  const payload = new Uint8Array(4 + 2 + esDescrLen);
  const view = new DataView(payload.buffer);
  let p = 0;
  // version + flags = 0
  payload[p++] = 0; payload[p++] = 0; payload[p++] = 0; payload[p++] = 0;
  // ES_DescrTag = 0x03
  payload[p++] = 0x03;
  payload[p++] = esDescrLen;
  payload[p++] = 0x00; payload[p++] = 0x02; // ES_ID = 2
  payload[p++] = 0x00; // flags
  // DecoderConfigDescrTag = 0x04
  payload[p++] = 0x04;
  payload[p++] = decConfigLen;
  payload[p++] = 0x40; // objectTypeIndication = 0x40 (Audio ISO/IEC 14496-3)
  payload[p++] = 0x15; // streamType = 5 (AudioStream) << 2 | 1
  payload[p++] = 0x00; payload[p++] = 0x00; payload[p++] = 0x00; // bufferSizeDB
  const br = Math.max(32000, Math.round(bitrate || 128000));
  // maxBitrate
  view.setUint32(p, br);
  p += 4;
  // avgBitrate
  view.setUint32(p, br);
  p += 4;
  // DecSpecificInfoTag = 0x05
  payload[p++] = 0x05;
  payload[p++] = ascLen;
  payload.set(asc, p);
  p += ascLen;
  // SLConfigDescrTag = 0x06
  payload[p++] = 0x06;
  payload[p++] = 0x01;
  payload[p++] = 0x02;
  return createBox('esds', payload);
}

function buildDOpsBox(channels: number = 2, sampleRate: number = 48000, description?: Uint8Array): Uint8Array {
  let preSkip = 312;
  if (description && description.length >= 19) {
    const magic = String.fromCharCode(...description.subarray(0, 8));
    if (magic === 'OpusHead') {
      const dv = new DataView(description.buffer, description.byteOffset, description.byteLength);
      preSkip = dv.getUint16(10, true);
    }
  } else if (description && description.length >= 11 && description[0] === 0) {
    return createBox('dOps', description);
  }
  const payload = new Uint8Array(11);
  const view = new DataView(payload.buffer);
  payload[0] = 0; // Version = 0
  payload[1] = channels; // OutputChannelCount
  view.setUint16(2, preSkip, false); // PreSkip (Big-Endian in ISOBMFF dOps!)
  view.setUint32(4, sampleRate, false); // InputSampleRate (Big-Endian)
  view.setInt16(8, 0, false); // OutputGain
  payload[10] = 0; // ChannelMappingFamily = 0
  return createBox('dOps', payload);
}

function convertAnnexBToAvccIfNeeded(data: Uint8Array): { data: Uint8Array; avcC?: Uint8Array } {
  const isStart3 = data.length >= 4 && data[0] === 0 && data[1] === 0 && data[2] === 1;
  const isStart4 = data.length >= 5 && data[0] === 0 && data[1] === 0 && data[2] === 0 && data[3] === 1;
  if (!isStart3 && !isStart4) {
    return { data };
  }

  const nalUnits: Uint8Array[] = [];
  let sps: Uint8Array | null = null;
  let pps: Uint8Array | null = null;

  let i = 0;
  let nalStart = -1;
  while (i < data.length) {
    let scLen = 0;
    if (i + 3 < data.length && data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] === 1) {
      scLen = 4;
    } else if (i + 2 < data.length && data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1) {
      scLen = 3;
    }
    if (scLen > 0) {
      if (nalStart >= 0 && i > nalStart) {
        const nalu = data.subarray(nalStart, i);
        const nalType = nalu[0] & 0x1f;
        if (nalType === 7 && !sps) sps = nalu;
        else if (nalType === 8 && !pps) pps = nalu;
        nalUnits.push(nalu);
      }
      nalStart = i + scLen;
      i += scLen;
    } else {
      i++;
    }
  }
  if (nalStart >= 0 && nalStart < data.length) {
    const nalu = data.subarray(nalStart);
    const nalType = nalu[0] & 0x1f;
    if (nalType === 7 && !sps) sps = nalu;
    else if (nalType === 8 && !pps) pps = nalu;
    nalUnits.push(nalu);
  }

  if (nalUnits.length === 0) return { data };

  let totalLen = 0;
  for (const n of nalUnits) totalLen += 4 + n.length;
  const out = new Uint8Array(totalLen);
  const dv = new DataView(out.buffer);
  let pos = 0;
  for (const n of nalUnits) {
    dv.setUint32(pos, n.length);
    out.set(n, pos + 4);
    pos += 4 + n.length;
  }

  let avcC: Uint8Array | undefined;
  if (sps && sps.length >= 4 && pps) {
    avcC = new Uint8Array(11 + sps.length + pps.length);
    const av = new DataView(avcC.buffer);
    avcC[0] = 1;
    avcC[1] = sps[1];
    avcC[2] = sps[2];
    avcC[3] = sps[3];
    avcC[4] = 0xff;
    avcC[5] = 0xe1;
    av.setUint16(6, sps.length);
    avcC.set(sps, 8);
    let p = 8 + sps.length;
    avcC[p++] = 1;
    av.setUint16(p, pps.length);
    p += 2;
    avcC.set(pps, p);
  }

  return { data: out, avcC };
}

export interface MP4MuxerOptions {
  width?: number;
  height?: number;
  fps?: number;
  framerate?: number;
  videoCodec?: string;
  audioCodec?: string;
  audioBitrate?: number;
  sampleRate?: number;
  channels?: number;
  description?: Uint8Array;
  audioDescription?: Uint8Array;
  onChunk: (chunk: StreamTargetChunk) => Promise<void> | void;
}

interface RecordedSample {
  offset: number;
  size: number;
  timestampUs: number;
  durationUs: number;
  isKey: boolean;
}

function buildSttsBoxFromDeltas(deltas: number[]): Uint8Array {
  const runs: { count: number; delta: number }[] = [];
  for (const d of deltas) {
    const safeDelta = Math.max(1, d);
    if (runs.length > 0 && runs[runs.length - 1].delta === safeDelta) {
      runs[runs.length - 1].count++;
    } else {
      runs.push({ count: 1, delta: safeDelta });
    }
  }
  const payload = new Uint8Array(8 + runs.length * 8);
  const view = new DataView(payload.buffer);
  view.setUint32(4, runs.length);
  for (let i = 0; i < runs.length; i++) {
    view.setUint32(8 + i * 8, runs[i].count);
    view.setUint32(12 + i * 8, runs[i].delta);
  }
  return createBox('stts', payload);
}

function buildStssBoxFromSamples(samples: RecordedSample[]): Uint8Array {
  const keyIndices: number[] = [];
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].isKey) keyIndices.push(i + 1);
  }
  if (keyIndices.length === 0 && samples.length > 0) {
    keyIndices.push(1);
  }
  const payload = new Uint8Array(8 + keyIndices.length * 4);
  const view = new DataView(payload.buffer);
  view.setUint32(4, keyIndices.length);
  for (let i = 0; i < keyIndices.length; i++) {
    view.setUint32(8 + i * 4, keyIndices[i]);
  }
  return createBox('stss', payload);
}

function buildStscBoxEntries(entries: { firstChunk: number; samplesPerChunk: number; sampleDescIndex: number }[]): Uint8Array {
  const payload = new Uint8Array(8 + entries.length * 12);
  const view = new DataView(payload.buffer);
  view.setUint32(4, entries.length);
  for (let i = 0; i < entries.length; i++) {
    view.setUint32(8 + i * 12, entries[i].firstChunk);
    view.setUint32(12 + i * 12, entries[i].samplesPerChunk);
    view.setUint32(16 + i * 12, entries[i].sampleDescIndex);
  }
  return createBox('stsc', payload);
}

function buildStszBoxFromSizes(sizes: number[], uniformSize: number = 0, totalCount?: number): Uint8Array {
  if (uniformSize > 0) {
    const payload = new Uint8Array(12);
    const view = new DataView(payload.buffer);
    view.setUint32(4, uniformSize);
    view.setUint32(8, totalCount ?? sizes.length);
    return createBox('stsz', payload);
  }
  const payload = new Uint8Array(12 + sizes.length * 4);
  const view = new DataView(payload.buffer);
  view.setUint32(4, 0);
  view.setUint32(8, sizes.length);
  for (let i = 0; i < sizes.length; i++) {
    view.setUint32(12 + i * 4, sizes[i]);
  }
  return createBox('stsz', payload);
}

function buildStcoBoxFromOffsets(offsets: number[]): Uint8Array {
  const needs64 = offsets.some((o) => o > 0xffffffff);
  if (needs64) {
    const payload = new Uint8Array(8 + offsets.length * 8);
    const view = new DataView(payload.buffer);
    view.setUint32(4, offsets.length);
    for (let i = 0; i < offsets.length; i++) {
      const hi = Math.floor(offsets[i] / 0x100000000);
      const lo = offsets[i] >>> 0;
      view.setUint32(8 + i * 8, hi);
      view.setUint32(12 + i * 8, lo);
    }
    return createBox('co64', payload);
  }
  const payload = new Uint8Array(8 + offsets.length * 4);
  const view = new DataView(payload.buffer);
  view.setUint32(4, offsets.length);
  for (let i = 0; i < offsets.length; i++) {
    view.setUint32(8 + i * 4, offsets[i]);
  }
  return createBox('stco', payload);
}

export class MP4Muxer {
  private options: MP4MuxerOptions;
  private totalBytes = 0;
  private mdatHeaderOffset = 0;
  private mdatDataBytes = 0;
  private isMdatStarted = false;
  private videoSamples: RecordedSample[] = [];
  private audioSamples: RecordedSample[] = [];
  private hasAudioTrack = false;

  constructor(options: MP4MuxerOptions) {
    this.options = options;
    this.hasAudioTrack = Boolean(options.audioCodec);
  }

  public async start(): Promise<void> {
    await this.ensureMdatStarted();
  }

  private async ensureMdatStarted(): Promise<void> {
    if (this.isMdatStarted) return;
    this.isMdatStarted = true;

    const vc = (this.options.videoCodec || 'avc').toLowerCase();
    const isAv1 = vc.includes('av1') || vc.includes('av01');
    const ftypPayload = isAv1
      ? new Uint8Array([
          0x6d, 0x70, 0x34, 0x32, // 'mp42' major brand
          0x00, 0x00, 0x00, 0x00, // minor version 0
          0x6d, 0x70, 0x34, 0x32, // 'mp42'
          0x69, 0x73, 0x6f, 0x6d, // 'isom'
          0x61, 0x76, 0x30, 0x31, // 'av01' compatible brand
          0x69, 0x73, 0x6f, 0x36, // 'iso6'
        ])
      : new Uint8Array([
          0x69, 0x73, 0x6f, 0x6d,
          0x00, 0x00, 0x02, 0x00,
          0x69, 0x73, 0x6f, 0x6d,
          0x69, 0x73, 0x6f, 0x32,
          0x61, 0x76, 0x63, 0x31,
          0x6d, 0x70, 0x34, 0x31,
        ]);
    const ftypBox = createBox('ftyp', ftypPayload);
    await this.emitChunk(ftypBox);

    this.mdatHeaderOffset = this.totalBytes;
    const mdatHeader = new Uint8Array([0, 0, 0, 8, 0x6d, 0x64, 0x61, 0x74]);
    await this.emitChunk(mdatHeader);
  }

  public async addVideoChunk(chunk: EncodedVideoChunk, meta?: any): Promise<void> {
    if (meta?.decoderConfig) {
      if (meta.decoderConfig.codec) {
        this.options.videoCodec = meta.decoderConfig.codec;
      }
      if (meta.decoderConfig.description) {
        const d = meta.decoderConfig.description;
        this.options.description = d instanceof Uint8Array
          ? d
          : new Uint8Array(d instanceof ArrayBuffer ? d : d.buffer, d.byteOffset || 0, d.byteLength);
      }
      if (!this.options.width && meta.decoderConfig.codedWidth) this.options.width = meta.decoderConfig.codedWidth;
      if (!this.options.height && meta.decoderConfig.codedHeight) this.options.height = meta.decoderConfig.codedHeight;
    }

    await this.ensureMdatStarted();

    const rawData = new Uint8Array(chunk.byteLength);
    chunk.copyTo(rawData);

    const vc = (this.options.videoCodec || 'avc').toLowerCase();
    const isAv1 = vc.includes('av1') || vc.includes('av01');
    let sampleData = rawData;
    if (!isAv1 && !vc.includes('vp9') && !vc.includes('vp09') && !vc.includes('hevc') && !vc.includes('hvc1')) {
      const converted = convertAnnexBToAvccIfNeeded(rawData);
      sampleData = converted.data;
      if (converted.avcC && (!this.options.description || this.options.description.length === 0)) {
        this.options.description = converted.avcC;
      }
    } else if (isAv1 && (!this.options.description || this.options.description.length < 8)) {
      const extracted = extractAv1ConfigRecord(rawData);
      if (extracted) {
        this.options.description = extracted;
      }
    }

    const offset = this.totalBytes;
    await this.emitChunk(sampleData);
    this.mdatDataBytes += sampleData.byteLength;

    const timestampUs = Math.max(0, Math.round(chunk.timestamp));
    const durationUs = Math.max(1000, Math.round(chunk.duration || 33333));

    this.videoSamples.push({
      offset,
      size: sampleData.byteLength,
      timestampUs,
      durationUs,
      isKey: chunk.type === 'key',
    });
  }

  public async addAudioChunk(chunk: EncodedAudioChunk, meta?: any): Promise<void> {
    if (meta?.decoderConfig) {
      if (meta.decoderConfig.codec) {
        this.options.audioCodec = meta.decoderConfig.codec;
      }
      if (meta.decoderConfig.description) {
        const d = meta.decoderConfig.description;
        this.options.audioDescription = d instanceof Uint8Array
          ? d
          : new Uint8Array(d instanceof ArrayBuffer ? d : d.buffer, d.byteOffset || 0, d.byteLength);
      }
      if (meta.decoderConfig.sampleRate) this.options.sampleRate = meta.decoderConfig.sampleRate;
      if (meta.decoderConfig.numberOfChannels) this.options.channels = meta.decoderConfig.numberOfChannels;
    }
    this.hasAudioTrack = true;

    await this.ensureMdatStarted();

    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);

    const offset = this.totalBytes;
    await this.emitChunk(data);
    this.mdatDataBytes += data.byteLength;

    const timestampUs = Math.max(0, Math.round(chunk.timestamp));
    const durationUs = Math.max(1000, Math.round(chunk.duration || 21333));

    this.audioSamples.push({
      offset,
      size: data.byteLength,
      timestampUs,
      durationUs,
      isKey: true,
    });
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
    await this.ensureMdatStarted();

    const mdatTotalSize = 8 + this.mdatDataBytes;
    const mdatSizePatch = new Uint8Array(4);
    new DataView(mdatSizePatch.buffer).setUint32(0, mdatTotalSize >>> 0);
    await this.options.onChunk({
      data: mdatSizePatch,
      position: this.mdatHeaderOffset,
    });

    const targetFps = Math.max(1, Math.min(240, Math.round(this.options.fps || this.options.framerate || 30)));
    const videoTimescale = 90000;
    const nominalTicksPerFrame = Math.max(1, Math.round(videoTimescale / targetFps));
    const videoDeltas: number[] = [];
    let videoTotalTicks = 0;
    for (let i = 0; i < this.videoSamples.length; i++) {
      const curr = this.videoSamples[i];
      let deltaUs = curr.durationUs;
      if (i + 1 < this.videoSamples.length && this.videoSamples[i + 1].timestampUs > curr.timestampUs) {
        deltaUs = this.videoSamples[i + 1].timestampUs - curr.timestampUs;
      }
      let ticks = Math.max(1, Math.round((deltaUs * videoTimescale) / 1_000_000));
      if (Math.abs(ticks - nominalTicksPerFrame) <= Math.max(2, nominalTicksPerFrame * 0.1)) {
        ticks = nominalTicksPerFrame;
      }
      videoDeltas.push(ticks);
      videoTotalTicks += ticks;
    }
    const videoDurationMs = Math.round((videoTotalTicks * 1000) / videoTimescale);

    const hasAudio = this.hasAudioTrack && this.audioSamples.length > 0;
    const sampleRate = this.options.sampleRate || 48000;
    const channels = this.options.channels || 2;
    const ac = (this.options.audioCodec || 'aac').toLowerCase();
    const isPcm = ac.includes('pcm') || ac.includes('sowt');

    let audioTotalTicks = 0;
    const audioDeltas: number[] = [];
    let totalPcmFrames = 0;
    const pcmBytesPerFrame = channels * 2;
    const pcmStscEntries: { firstChunk: number; samplesPerChunk: number; sampleDescIndex: number }[] = [];

    if (hasAudio) {
      if (isPcm) {
        for (let i = 0; i < this.audioSamples.length; i++) {
          const framesInChunk = Math.max(1, Math.floor(this.audioSamples[i].size / pcmBytesPerFrame));
          totalPcmFrames += framesInChunk;
          if (pcmStscEntries.length === 0 || pcmStscEntries[pcmStscEntries.length - 1].samplesPerChunk !== framesInChunk) {
            pcmStscEntries.push({
              firstChunk: i + 1,
              samplesPerChunk: framesInChunk,
              sampleDescIndex: 1,
            });
          }
        }
        audioTotalTicks = totalPcmFrames;
      } else {
        for (let i = 0; i < this.audioSamples.length; i++) {
          const curr = this.audioSamples[i];
          let deltaUs = curr.durationUs;
          if (i + 1 < this.audioSamples.length && this.audioSamples[i + 1].timestampUs > curr.timestampUs) {
            deltaUs = this.audioSamples[i + 1].timestampUs - curr.timestampUs;
          }
          const ticks = Math.max(1, Math.round((deltaUs * sampleRate) / 1_000_000));
          audioDeltas.push(ticks);
          audioTotalTicks += ticks;
        }
      }
    }
    const audioDurationMs = hasAudio ? Math.round((audioTotalTicks * 1000) / sampleRate) : 0;
    const movieDurationMs = Math.max(1, videoDurationMs, audioDurationMs);

    const mvhdPayload = new Uint8Array(100);
    const mvhdView = new DataView(mvhdPayload.buffer);
    mvhdView.setUint32(12, 1000);
    mvhdView.setUint32(16, movieDurationMs);
    mvhdView.setUint32(20, 0x00010000);
    mvhdView.setUint16(24, 0x0100);
    mvhdView.setUint32(36, 0x00010000);
    mvhdView.setUint32(52, 0x00010000);
    mvhdView.setUint32(68, 0x40000000);
    mvhdView.setUint32(96, hasAudio ? 3 : 2);
    const mvhdBox = createBox('mvhd', mvhdPayload);

    const w = this.options.width || 1280;
    const h = this.options.height || 720;

    const tkhdPayload = new Uint8Array(84);
    const tkhdView = new DataView(tkhdPayload.buffer);
    tkhdView.setUint32(0, 0x00000003);
    tkhdView.setUint32(12, 1);
    tkhdView.setUint32(20, videoDurationMs || movieDurationMs);
    tkhdView.setUint32(36, 0x00010000);
    tkhdView.setUint32(52, 0x00010000);
    tkhdView.setUint32(68, 0x40000000);
    tkhdView.setUint32(76, w << 16);
    tkhdView.setUint32(80, h << 16);
    const tkhdBox = createBox('tkhd', tkhdPayload);

    const mdhdPayload = new Uint8Array(24);
    const mdhdView = new DataView(mdhdPayload.buffer);
    mdhdView.setUint32(12, videoTimescale);
    mdhdView.setUint32(16, videoTotalTicks);
    mdhdView.setUint16(20, 0x55c4);
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

    const vSamplePayload = new Uint8Array(78);
    const vSampleView = new DataView(vSamplePayload.buffer);
    vSampleView.setUint16(6, 1);
    vSampleView.setUint16(24, w);
    vSampleView.setUint16(26, h);
    vSampleView.setUint32(28, 0x00480000);
    vSampleView.setUint32(32, 0x00480000);
    vSampleView.setUint16(40, 1);
    vSampleView.setUint16(74, 24);
    vSampleView.setInt16(76, -1);

    const vc = (this.options.videoCodec || 'avc').toLowerCase();
    let sampleEntryTag = 'avc1';
    let configBox = new Uint8Array(0);

    if (vc.includes('hevc') || vc.includes('hvc1') || vc.includes('hev1') || vc.includes('265')) {
      sampleEntryTag = 'hvc1';
      if (this.options.description && this.options.description.length > 0) {
        configBox = createBox('hvcC', this.options.description);
      }
    } else if (vc.includes('av1') || vc.includes('av01')) {
      sampleEntryTag = 'av01';
      let av1Record = this.options.description;
      if (!av1Record || av1Record.length < 4) {
        av1Record = buildDefaultAv1ConfigRecord(w, h, targetFps);
        this.options.description = av1Record;
      }
      configBox = createBox('av1C', av1Record);

      // colr box: 'nclx' (BT.709 primaries, transfer, matrix, limited range)
      const colrPayload = new Uint8Array([
        0x6e, 0x63, 0x6c, 0x78, // 'nclx'
        0x00, 0x01,             // colour_primaries: 1 (BT.709)
        0x00, 0x01,             // transfer_characteristics: 1 (BT.709)
        0x00, 0x01,             // matrix_coefficients: 1 (BT.709)
        0x00,                   // full_range_flag: 0 (limited)
      ]);
      const colrBox = createBox('colr', colrPayload);

      // pasp box: 1:1 square pixel aspect ratio
      const paspPayload = new Uint8Array(8);
      const paspView = new DataView(paspPayload.buffer);
      paspView.setUint32(0, 1);
      paspView.setUint32(4, 1);
      const paspBox = createBox('pasp', paspPayload);

      configBox = concatByteArrays([configBox, colrBox, paspBox]);
    } else if (vc.includes('vp9') || vc.includes('vp09')) {
      sampleEntryTag = 'vp09';
      if (this.options.description && this.options.description.length > 0) {
        configBox = createBox('vpcC', this.options.description);
      } else {
        configBox = createBox('vpcC', new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x00, 0x0a, 0x80, 0x01, 0x01, 0x01, 0x00, 0x00]));
      }
    } else {
      sampleEntryTag = 'avc1';
      if (this.options.description && this.options.description.length > 0) {
        configBox = createBox('avcC', this.options.description);
      } else {
        configBox = createBox('avcC', new Uint8Array([0x01, 0x64, 0x00, 0x28, 0xff, 0xe1, 0x00, 0x00, 0x00]));
      }
    }

    const vSampleBox = createBox(sampleEntryTag, concatByteArrays([vSamplePayload, configBox]));
    const stsdPayload = new Uint8Array(8 + vSampleBox.length);
    new DataView(stsdPayload.buffer).setUint32(4, 1);
    stsdPayload.set(vSampleBox, 8);
    const stsdBox = createBox('stsd', stsdPayload);

    const vSttsBox = buildSttsBoxFromDeltas(videoDeltas);
    const vStssBox = buildStssBoxFromSamples(this.videoSamples);
    const vStscBox = buildStscBoxEntries(
      this.videoSamples.length > 0 ? [{ firstChunk: 1, samplesPerChunk: 1, sampleDescIndex: 1 }] : []
    );
    const vStszBox = buildStszBoxFromSizes(this.videoSamples.map((s) => s.size));
    const vStcoBox = buildStcoBoxFromOffsets(this.videoSamples.map((s) => s.offset));

    const stblBox = createBox('stbl', concatByteArrays([stsdBox, vSttsBox, vStssBox, vStscBox, vStszBox, vStcoBox]));
    const minfBox = createBox('minf', concatByteArrays([vmhdBox, dinfBox, stblBox]));
    const mdiaBox = createBox('mdia', concatByteArrays([mdhdBox, hdlrBox, minfBox]));
    const trak1Box = createBox('trak', concatByteArrays([tkhdBox, mdiaBox]));

    let trak2Box: Uint8Array = new Uint8Array(0);
    if (hasAudio) {
      const tkhd2Payload = new Uint8Array(84);
      const tkhd2View = new DataView(tkhd2Payload.buffer);
      tkhd2View.setUint32(0, 0x00000003);
      tkhd2View.setUint32(12, 2);
      tkhd2View.setUint32(20, audioDurationMs || movieDurationMs);
      tkhd2View.setUint16(32, 0x0100);
      tkhd2View.setUint32(36, 0x00010000);
      tkhd2View.setUint32(52, 0x00010000);
      tkhd2View.setUint32(68, 0x40000000);
      const tkhd2Box = createBox('tkhd', tkhd2Payload);

      const mdhd2Payload = new Uint8Array(24);
      const mdhd2View = new DataView(mdhd2Payload.buffer);
      mdhd2View.setUint32(12, sampleRate);
      mdhd2View.setUint32(16, audioTotalTicks);
      mdhd2View.setUint16(20, 0x55c4);
      const mdhd2Box = createBox('mdhd', mdhd2Payload);

      const hdlr2Payload = new Uint8Array([
        0, 0, 0, 0,
        0, 0, 0, 0,
        0x73, 0x6f, 0x75, 0x6e,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0x53, 0x6f, 0x75, 0x6e, 0x64, 0x48, 0x61, 0x6e, 0x64, 0x6c, 0x65, 0x72, 0
      ]);
      const hdlr2Box = createBox('hdlr', hdlr2Payload);
      const smhdBox = createBox('smhd', new Uint8Array(8));

      const aSamplePayload = new Uint8Array(28);
      const aSampleView = new DataView(aSamplePayload.buffer);
      aSampleView.setUint16(6, 1);
      aSampleView.setUint16(16, channels);
      aSampleView.setUint16(18, 0);
      aSampleView.setUint32(24, (sampleRate & 0xffff) << 16);

      const targetAudioBitrate = (this.options.audioBitrate && this.options.audioBitrate > 0)
        ? this.options.audioBitrate
        : 192000;
      const btrtBox = buildBtrtBox(targetAudioBitrate, targetAudioBitrate);

      let audioBox: Uint8Array;
      if (ac.includes('opus')) {
        const dOpsBox = buildDOpsBox(channels, sampleRate, this.options.audioDescription);
        audioBox = createBox('Opus', concatByteArrays([aSamplePayload, dOpsBox, btrtBox]));
      } else if (ac.includes('flac')) {
        let dfLaBox: Uint8Array = new Uint8Array(0);
        if (this.options.audioDescription && this.options.audioDescription.length > 0) {
          const desc = this.options.audioDescription;
          const metaBlock = (desc.length > 4 && desc[0] === 0x66 && desc[1] === 0x4c && desc[2] === 0x61 && desc[3] === 0x43)
            ? desc.subarray(4)
            : desc;
          const dfLaPayload = new Uint8Array(4 + metaBlock.length);
          dfLaPayload.set(metaBlock, 4);
          dfLaPayload[4] |= 0x80;
          dfLaBox = createBox('dfLa', dfLaPayload);
        }
        audioBox = createBox('fLaC', concatByteArrays([aSamplePayload, dfLaBox, btrtBox]));
      } else if (isPcm) {
        audioBox = createBox('sowt', concatByteArrays([aSamplePayload, btrtBox]));
      } else {
        const esdsBox = buildEsdsBox(this.options.audioDescription, targetAudioBitrate);
        audioBox = createBox('mp4a', concatByteArrays([aSamplePayload, esdsBox, btrtBox]));
      }

      const stsd2Payload = new Uint8Array(8 + audioBox.length);
      new DataView(stsd2Payload.buffer).setUint32(4, 1);
      stsd2Payload.set(audioBox, 8);
      const stsd2Box = createBox('stsd', stsd2Payload);

      let aSttsBox: Uint8Array;
      let aStscBox: Uint8Array;
      let aStszBox: Uint8Array;
      if (isPcm) {
        const sttsPayload = new Uint8Array(16);
        const sttsView = new DataView(sttsPayload.buffer);
        sttsView.setUint32(4, 1);
        sttsView.setUint32(8, totalPcmFrames);
        sttsView.setUint32(12, 1);
        aSttsBox = createBox('stts', sttsPayload);
        aStscBox = buildStscBoxEntries(pcmStscEntries);
        aStszBox = buildStszBoxFromSizes([], pcmBytesPerFrame, totalPcmFrames);
      } else {
        aSttsBox = buildSttsBoxFromDeltas(audioDeltas);
        aStscBox = buildStscBoxEntries([{ firstChunk: 1, samplesPerChunk: 1, sampleDescIndex: 1 }]);
        aStszBox = buildStszBoxFromSizes(this.audioSamples.map((s) => s.size));
      }
      const aStcoBox = buildStcoBoxFromOffsets(this.audioSamples.map((s) => s.offset));

      const stbl2Box = createBox('stbl', concatByteArrays([stsd2Box, aSttsBox, aStscBox, aStszBox, aStcoBox]));
      const minf2Box = createBox('minf', concatByteArrays([smhdBox, dinfBox, stbl2Box]));
      const mdia2Box = createBox('mdia', concatByteArrays([mdhd2Box, hdlr2Box, minf2Box]));
      trak2Box = createBox('trak', concatByteArrays([tkhd2Box, mdia2Box]));
    }

    const moovBox = createBox('moov', concatByteArrays([mvhdBox, trak1Box, trak2Box]));
    await this.emitChunk(moovBox);
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

function resolveWebCodecsVideoCodecString(codec: string, width: number = 1920, height: number = 1080, fps: number = 30): string {
  const pixels = width * height;
  const sampleRate = pixels * Math.max(1, fps || 30);
  if (codec === 'avc') {
    if (pixels > 2097152 || sampleRate > 125829120) return 'avc1.640034'; // Level 5.2 (4K/8K)
    if (pixels > 921600 || sampleRate > 27648000) {
      return sampleRate > 62914560 ? 'avc1.64002a' : 'avc1.640028'; // Level 4.2 (1080p60) / Level 4.0 (1080p30)
    }
    return 'avc1.64001f'; // Level 3.1 (720p30)
  }
  if (codec === 'hevc') {
    if (pixels > 2228224 || sampleRate > 133693440) return 'hvc1.1.6.L153.B0'; // Level 5.1 (4K)
    return 'hvc1.1.6.L123.B0'; // Level 4.1 (1080p)
  }
  if (codec === 'vp9') {
    if (pixels > 8912896 || sampleRate > 534773760) return 'vp09.00.60.08'; // Level 6.0 (8K)
    if (pixels > 2228224 || sampleRate > 133693440) return 'vp09.00.51.08'; // Level 5.1 (4K60)
    if (sampleRate > 62914560) return 'vp09.00.41.08'; // Level 4.1 (1080p60 / 2K)
    if (pixels > 921600 || sampleRate > 27648000) return 'vp09.00.40.08'; // Level 4.0 (1080p30 / 720p60)
    return 'vp09.00.31.08'; // Level 3.1 (720p30)
  }
  if (codec === 'av1') {
    if (pixels > 8912896 || sampleRate > 534773760) return 'av01.0.17M.08'; // Level 6.1 (8K)
    if (pixels > 2228224 || sampleRate > 133693440) return 'av01.0.13M.08'; // Level 5.1 (4K60)
    if (sampleRate > 62914560) return 'av01.0.09M.08'; // Level 4.1 (1080p60 / 2K)
    if (pixels > 921600 || sampleRate > 27648000) return 'av01.0.08M.08'; // Level 4.0 (1080p30 / 720p60)
    return 'av01.0.05M.08'; // Level 3.1 (720p30)
  }
  if (codec === 'vp8') return 'vp8';
  return codec || 'avc1.640028';
}

function getWebCodecsVideoCandidatesForFamily(codec: string, width: number, height: number, fps: number = 30): { wc: string; family: string }[] {
  const c = (codec || 'av1').toLowerCase();
  if (c === 'av1' || c.startsWith('av01')) {
    return [
      { wc: resolveWebCodecsVideoCodecString('av1', width, height, fps), family: 'av1' },
      { wc: 'av01.0.13M.08', family: 'av1' },
      { wc: 'av01.0.12M.08', family: 'av1' },
      { wc: 'av01.0.09M.08', family: 'av1' },
      { wc: 'av01.0.08M.08', family: 'av1' },
      { wc: 'av01.0.05M.08', family: 'av1' },
      { wc: 'av01.0.04M.08', family: 'av1' },
    ];
  }
  if (c === 'vp9' || c.startsWith('vp09')) {
    return [
      { wc: resolveWebCodecsVideoCodecString('vp9', width, height, fps), family: 'vp9' },
      { wc: 'vp09.00.51.08', family: 'vp9' },
      { wc: 'vp09.00.50.08', family: 'vp9' },
      { wc: 'vp09.00.41.08', family: 'vp9' },
      { wc: 'vp09.00.40.08', family: 'vp9' },
      { wc: 'vp09.00.31.08', family: 'vp9' },
      { wc: 'vp09.00.10.08', family: 'vp9' },
    ];
  }
  if (c === 'hevc' || c.startsWith('hvc1') || c.startsWith('hev1')) {
    return [
      { wc: resolveWebCodecsVideoCodecString('hevc', width, height, fps), family: 'hevc' },
      { wc: 'hvc1.1.6.L153.B0', family: 'hevc' },
      { wc: 'hvc1.1.6.L123.B0', family: 'hevc' },
    ];
  }
  if (c === 'vp8') {
    return [{ wc: 'vp8', family: 'vp8' }];
  }
  return [
    { wc: resolveWebCodecsVideoCodecString('avc', width, height, fps), family: 'avc' },
    { wc: 'avc1.640034', family: 'avc' },
    { wc: 'avc1.64002a', family: 'avc' },
    { wc: 'avc1.640028', family: 'avc' },
    { wc: 'avc1.42E01E', family: 'avc' },
  ];
}

export async function canEncodeVideo(codec: string, config: any = {}): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoEncoder.isConfigSupported !== 'function') {
    return false;
  }
  const w = Math.max(16, (config.width || 1280) - ((config.width || 1280) % 2));
  const h = Math.max(16, (config.height || 720) - ((config.height || 720) % 2));
  const fps = config.framerate || 30;
  const candidates = getWebCodecsVideoCandidatesForFamily(codec, w, h, fps);
  const hwModes: HardwareAcceleration[] = config.hardwareAcceleration
    ? [config.hardwareAcceleration]
    : ['no-preference', 'prefer-software', 'prefer-hardware'];

  for (const cand of candidates) {
    for (const hw of hwModes) {
      try {
        const testConfig: VideoEncoderConfig = {
          codec: cand.wc,
          width: w,
          height: h,
          bitrate: config.bitrate || 2_500_000,
          framerate: fps,
          hardwareAcceleration: hw,
        };
        const res = await VideoEncoder.isConfigSupported(testConfig);
        if (res.supported) return true;
      } catch {}
    }
  }
  return false;
}

export async function canEncodeAudio(codec: string, config: any = {}): Promise<boolean> {
  const c = (codec || '').toLowerCase();
  if (c === 'pcm-s16' || c === 'pcm' || c === 'pcm-s16le' || c === 'flac') {
    return true;
  }
  if (typeof AudioEncoder === 'undefined' || typeof AudioEncoder.isConfigSupported !== 'function') {
    return false;
  }
  try {
    let standardCodec = c;
    if (c === 'aac') standardCodec = 'mp4a.40.2';
    else if (c === 'opus') standardCodec = 'opus';

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

// ==========================================
// BUILT-IN RFC 9639 LOSSLESS FLAC ENCODER
// ==========================================

const FLAC_CRC8_TABLE = (() => {
  const t = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
    t[i] = crc;
  }
  return t;
})();

const FLAC_CRC16_TABLE = (() => {
  const t = new Uint16Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x8005) & 0xffff : (crc << 1) & 0xffff;
    }
    t[i] = crc;
  }
  return t;
})();

function writeFlacUtf8Number(val: number): Uint8Array {
  if (val < 0x80) return new Uint8Array([val]);
  if (val < 0x800) return new Uint8Array([0xc0 | (val >> 6), 0x80 | (val & 0x3f)]);
  if (val < 0x10000) return new Uint8Array([0xe0 | (val >> 12), 0x80 | ((val >> 6) & 0x3f), 0x80 | (val & 0x3f)]);
  if (val < 0x200000) {
    return new Uint8Array([
      0xf0 | (val >> 18),
      0x80 | ((val >> 12) & 0x3f),
      0x80 | ((val >> 6) & 0x3f),
      0x80 | (val & 0x3f),
    ]);
  }
  return new Uint8Array([
    0xf8 | (val >> 24),
    0x80 | ((val >> 18) & 0x3f),
    0x80 | ((val >> 12) & 0x3f),
    0x80 | ((val >> 6) & 0x3f),
    0x80 | (val & 0x3f),
  ]);
}

function buildFlacStreamInfoBlock(sampleRate: number, channels: number, blockSize: number = 1024): Uint8Array {
  const info = new Uint8Array(34);
  const view = new DataView(info.buffer);
  view.setUint16(0, blockSize);
  view.setUint16(2, blockSize);
  const sr = Math.min(0xfffff, Math.max(8000, Math.round(sampleRate)));
  const ch = Math.max(1, Math.min(8, channels)) - 1;
  const bps = 16 - 1;
  info[10] = (sr >> 12) & 0xff;
  info[11] = (sr >> 4) & 0xff;
  info[12] = ((sr & 0x0f) << 4) | ((ch & 0x07) << 1) | ((bps >> 4) & 0x01);
  info[13] = ((bps & 0x0f) << 4);
  return info;
}

function encodeFlacVerbatimFrame(
  interleavedFloat32: Float32Array,
  numFrames: number,
  channels: number,
  sampleRate: number,
  frameNumber: number
): Uint8Array {
  const ch = Math.max(1, Math.min(8, channels));
  const utf8Num = writeFlacUtf8Number(frameNumber);

  const bsCode = 0x07;
  const srCode = sampleRate <= 65535 ? 0x0d : 0x0e;
  const headerLen = 4 + utf8Num.length + 2 + 2 + 1;
  const subframesLen = ch * (1 + numFrames * 2);
  const totalLen = headerLen + subframesLen + 2;
  const out = new Uint8Array(totalLen);
  const view = new DataView(out.buffer);

  let p = 0;
  out[p++] = 0xff;
  out[p++] = 0xf8;
  out[p++] = (bsCode << 4) | srCode;
  out[p++] = ((ch - 1) << 4) | (0x04 << 1);
  out.set(utf8Num, p);
  p += utf8Num.length;
  view.setUint16(p, Math.max(0, numFrames - 1), false);
  p += 2;
  view.setUint16(p, srCode === 0x0d ? sampleRate : Math.round(sampleRate / 10), false);
  p += 2;

  let crc8 = 0;
  for (let i = 0; i < p; i++) {
    crc8 = FLAC_CRC8_TABLE[crc8 ^ out[i]];
  }
  out[p++] = crc8;

  for (let c = 0; c < ch; c++) {
    out[p++] = 0x02;
    for (let f = 0; f < numFrames; f++) {
      const idx = f * ch + c;
      const s = idx < interleavedFloat32.length ? Math.max(-1, Math.min(1, interleavedFloat32[idx])) : 0;
      const pcm = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
      view.setInt16(p, pcm, false);
      p += 2;
    }
  }

  let crc16 = 0;
  for (let i = 0; i < p; i++) {
    crc16 = ((crc16 << 8) & 0xffff) ^ FLAC_CRC16_TABLE[((crc16 >> 8) ^ out[i]) & 0xff];
  }
  view.setUint16(p, crc16, false);
  return out;
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

function calculateVideoBitrate(
  width: number,
  height: number,
  fps: number,
  quality?: Quality | QualityLevel | string,
  codec?: string
): number {
  const qLevel = (quality && typeof quality === 'object' && 'level' in quality)
    ? quality.level
    : (quality || 'high');
  let bpp = 0.10;
  switch (qLevel) {
    case 'very-low': bpp = 0.03; break;
    case 'low': bpp = 0.05; break;
    case 'medium': bpp = 0.09; break;
    case 'high': bpp = 0.15; break;
    case 'very-high': bpp = 0.25; break;
    default:
      if (typeof qLevel === 'number' && qLevel > 0) return qLevel;
      bpp = 0.15;
      break;
  }
  const c = (codec || 'avc').toLowerCase();
  const codecEff = (c.includes('av1') || c.includes('av01') || c.includes('vp9') || c.includes('vp09') || c.includes('hevc') || c.includes('hvc1'))
    ? 0.75
    : 1.0;
  const safeFps = Math.min(120, Math.max(15, fps || 30));
  const rawBitrate = Math.round(width * height * safeFps * bpp * codecEff);
  return Math.max(250_000, Math.min(120_000_000, rawBitrate));
}

export class VideoSampleSource {
  public encoder: VideoEncoder | null = null;
  public options: any;
  public codec: string;
  public onEncodedChunk: ((chunk: EncodedVideoChunk, meta?: any) => Promise<void>) | null = null;
  public isConfigured = false;
  private pendingOutput: Promise<void> = Promise.resolve();
  private frameCounter = 0;
  private failedConfigs: Set<string> = new Set();
  private activeConfigKey: string = '';
  private hasEmittedChunk = false;
  private lastEncoderError: any = null;

  constructor(options: any = {}) {
    this.options = options;
    this.codec = options.codec || 'av1';
  }

  private createEncoderInstance(safeW: number, safeH: number): VideoEncoder {
    return new VideoEncoder({
      output: (chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) => {
        this.hasEmittedChunk = true;
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        const clonedChunk: any = {
          type: chunk.type,
          timestamp: chunk.timestamp,
          duration: chunk.duration || 33333,
          byteLength: data.byteLength,
          data,
          copyTo: (dest: Uint8Array) => dest.set(data),
        };
        let desc = meta?.decoderConfig?.description;
        const cLower = (meta?.decoderConfig?.codec || this.codec || '').toLowerCase();
        if ((cLower.includes('av1') || cLower.includes('av01')) && (!desc || (desc instanceof Uint8Array && desc.byteLength < 8))) {
          const extracted = extractAv1ConfigRecord(data);
          if (extracted) desc = extracted;
        }

        const enrichedMeta = {
          ...meta,
          decoderConfig: {
            ...(meta?.decoderConfig || {}),
            codec: meta?.decoderConfig?.codec || this.codec,
            codedWidth: meta?.decoderConfig?.codedWidth || safeW,
            codedHeight: meta?.decoderConfig?.codedHeight || safeH,
            ...(desc ? { description: desc } : {}),
          },
        };
        if (this.onEncodedChunk) {
          const cb = this.onEncodedChunk;
          this.pendingOutput = this.pendingOutput.then(() => cb(clonedChunk, enrichedMeta)).catch((err) => {
            console.warn('Error writing encoded video chunk:', err);
          });
        }
      },
      error: (e) => {
        this.lastEncoderError = e;
        if (this.activeConfigKey) {
          this.failedConfigs.add(this.activeConfigKey);
        }
        this.isConfigured = false;
      },
    });
  }

  public async initEncoder(width: number, height: number): Promise<boolean> {
    if (this.isConfigured && this.encoder && this.encoder.state === 'configured') return true;
    if (typeof VideoEncoder === 'undefined') return false;

    const safeW = Math.max(16, width - (width % 2));
    const safeH = Math.max(16, height - (height % 2));

    const requestedCodec = (this.options.codec || 'av1').toLowerCase();
    const rawFps = Math.min(120, Math.max(1, Math.round(this.options.framerate || 30)));

    const rawCandidates: { wc: string; family: string }[] = [
      ...getWebCodecsVideoCandidatesForFamily(requestedCodec, safeW, safeH, rawFps),
      ...getWebCodecsVideoCandidatesForFamily('av1', safeW, safeH, rawFps),
      ...getWebCodecsVideoCandidatesForFamily('vp9', safeW, safeH, rawFps),
      ...getWebCodecsVideoCandidatesForFamily('avc', safeW, safeH, rawFps),
      { wc: 'vp8', family: 'vp8' },
    ];
    const seenWc = new Set<string>();
    const candidateEntries: { wc: string; family: string }[] = [];
    for (const c of rawCandidates) {
      if (!seenWc.has(c.wc)) {
        seenWc.add(c.wc);
        candidateEntries.push(c);
      }
    }

    const fpsVariants = rawFps > 60 ? [rawFps, 60, 30] : rawFps > 30 ? [rawFps, 30] : [rawFps];
    const latencyVariants: ('realtime' | 'quality' | undefined)[] = Array.from(
      new Set(['realtime', this.options.latencyMode || 'realtime', 'quality', undefined])
    );

    for (const cand of candidateEntries) {
      const isSoftwarePreferredFamily = cand.family === 'av1' || cand.family === 'vp9' || cand.family === 'vp8';
      const hwModes: HardwareAcceleration[] = isSoftwarePreferredFamily
        ? ['no-preference', 'prefer-software', 'prefer-hardware']
        : Array.from(new Set([
            (this.options.hardwareAcceleration as HardwareAcceleration) || 'no-preference',
            'no-preference',
            'prefer-software',
            'prefer-hardware',
          ]));

      for (const testFps of fpsVariants) {
        const bitrate = this.options.bitrate || calculateVideoBitrate(safeW, safeH, testFps, this.options.quality, cand.family);
        for (const hw of hwModes) {
          for (const lat of latencyVariants) {
            const configKey = `${cand.wc}|${hw}|${lat || 'default'}|${testFps}`;
            if (this.failedConfigs.has(configKey)) continue;

            const cfg: VideoEncoderConfig = {
              codec: cand.wc,
              width: safeW,
              height: safeH,
              bitrate,
              framerate: testFps,
              hardwareAcceleration: hw,
              ...(lat ? { latencyMode: lat } : {}),
              ...(cand.wc.startsWith('avc1') ? { avc: { format: 'avc' } } : {}),
            };

            try {
              if (typeof VideoEncoder.isConfigSupported === 'function') {
                const sup = await VideoEncoder.isConfigSupported(cfg);
                if (!sup || !sup.supported) {
                  this.failedConfigs.add(configKey);
                  continue;
                }
              }

              if (this.encoder) {
                try {
                  if (this.encoder.state !== 'closed') this.encoder.close();
                } catch {}
              }

              this.activeConfigKey = configKey;
              this.lastEncoderError = null;
              this.encoder = this.createEncoderInstance(safeW, safeH);
              this.encoder.configure(cfg);

              if (this.encoder.state === 'configured') {
                this.codec = cand.family;
                this.options.codec = cand.family;
                this.isConfigured = true;
                return true;
              } else {
                this.failedConfigs.add(configKey);
              }
            } catch {
              this.failedConfigs.add(configKey);
            }
          }
        }
      }
    }

    return false;
  }

  public async add(sample: VideoSample): Promise<void> {
    const w = this.options.width || (sample.source as any).width || sample.displayWidth || 1280;
    const h = this.options.height || (sample.source as any).height || sample.displayHeight || 720;

    const tsMicros = Math.max(0, Math.round(sample.timestamp * 1e6));
    const durMicros = sample.duration ? Math.max(1000, Math.round(sample.duration * 1e6)) : 33333;

    // If first chunk hasn't been emitted yet (or encoder closed from an async creation error),
    // verify the encoder by encoding and flushing, automatically falling back across candidate configs!
    if (!this.hasEmittedChunk || !this.encoder || this.encoder.state !== 'configured' || !this.isConfigured) {
      try {
        for (let attempt = 0; attempt < 24; attempt++) {
          if (!this.encoder || this.encoder.state !== 'configured' || !this.isConfigured) {
            const ok = await this.initEncoder(w, h);
            if (!ok || !this.encoder) break;
          }

          let attemptFrame: VideoFrame;
          if (sample.source instanceof VideoFrame) {
            attemptFrame = sample.source.clone();
          } else {
            attemptFrame = new VideoFrame(sample.source, {
              timestamp: tsMicros,
              duration: durMicros,
            });
          }

          this.lastEncoderError = null;
          try {
            this.encoder.encode(attemptFrame, { keyFrame: true });
          } catch (encErr) {
            this.lastEncoderError = encErr;
          } finally {
            try {
              attemptFrame.close();
            } catch {}
          }

          if (!this.lastEncoderError && this.encoder && this.encoder.state === 'configured') {
            try {
              await this.encoder.flush();
            } catch (flushErr) {
              this.lastEncoderError = flushErr;
            }
          }

          if (!this.lastEncoderError && this.hasEmittedChunk && this.encoder && this.encoder.state === 'configured') {
            this.frameCounter++;
            await this.pendingOutput;
            return;
          }

          if (this.activeConfigKey) {
            this.failedConfigs.add(this.activeConfigKey);
          }
          this.isConfigured = false;
          if (this.encoder) {
            try {
              if (this.encoder.state !== 'closed') this.encoder.close();
            } catch {}
            this.encoder = null;
          }
        }
      } finally {
        if (sample.source instanceof VideoFrame) {
          try {
            sample.source.close();
          } catch {}
        }
      }
      return;
    }

    let frame: VideoFrame;
    if (sample.source instanceof VideoFrame) {
      frame = sample.source;
    } else {
      frame = new VideoFrame(sample.source, {
        timestamp: tsMicros,
        duration: durMicros,
      });
    }

    const isKeyFrame = this.frameCounter % 60 === 0;
    this.frameCounter++;

    try {
      this.encoder.encode(frame, { keyFrame: isKeyFrame });
    } finally {
      if (frame !== sample.source) {
        frame.close();
      }
    }

    if (this.encoder && this.encoder.encodeQueueSize > 8) {
      await new Promise<void>((resolve) => {
        const enc = this.encoder;
        if (!enc) return resolve();
        const onDeq = () => {
          enc.removeEventListener('dequeue', onDeq);
          resolve();
        };
        enc.addEventListener('dequeue', onDeq, { once: true });
        setTimeout(() => {
          enc.removeEventListener('dequeue', onDeq);
          resolve();
        }, 12);
      });
    } else if (this.frameCounter % 4 === 0) {
      await new Promise<void>((r) => setTimeout(r, 0));
    }
    await this.pendingOutput;
  }

  public async flush(): Promise<void> {
    if (this.encoder && this.encoder.state === 'configured') {
      try {
        await this.encoder.flush();
      } catch (e) {
        console.warn('VideoEncoder flush warning:', e);
      }
    }
    await this.pendingOutput;
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
  public codec: string;
  public onEncodedChunk: ((chunk: EncodedAudioChunk, meta?: any) => Promise<void>) | null = null;
  public isConfigured = false;
  private pendingOutput: Promise<void> = Promise.resolve();

  constructor(options: any = {}) {
    this.options = options;
    this.codec = options.codec || 'opus';
  }

  public initEncoder(sampleRate: number = 48000, numberOfChannels: number = 2): void {
    if (this.isConfigured) return;

    if (typeof AudioEncoder !== 'undefined') {
      const standardCodec = 'opus';
      this.codec = 'opus';
      this.options.codec = 'opus';

      const targetBitrate = (this.options.bitrate && this.options.bitrate > 0)
        ? this.options.bitrate
        : 192_000;

      this.encoder = new AudioEncoder({
        output: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) => {
          const data = new Uint8Array(chunk.byteLength);
          chunk.copyTo(data);
          const clonedChunk: any = {
            type: chunk.type,
            timestamp: chunk.timestamp,
            duration: chunk.duration || 21333,
            byteLength: data.byteLength,
            data,
            copyTo: (dest: Uint8Array) => dest.set(data),
          };
          const enrichedMeta = {
            ...meta,
            decoderConfig: {
              ...(meta?.decoderConfig || {}),
              codec: meta?.decoderConfig?.codec || this.codec,
              sampleRate: meta?.decoderConfig?.sampleRate || sampleRate,
              numberOfChannels: meta?.decoderConfig?.numberOfChannels || numberOfChannels,
            },
          };
          if (this.onEncodedChunk) {
            const cb = this.onEncodedChunk;
            this.pendingOutput = this.pendingOutput.then(() => cb(clonedChunk, enrichedMeta)).catch((err) => {
              console.warn('Error writing encoded audio chunk:', err);
            });
          }
        },
        error: (e) => {
          console.warn('AudioEncoder error in AudioSampleSource:', e);
        },
      });

      try {
        this.encoder.configure({
          codec: standardCodec,
          sampleRate,
          numberOfChannels,
          bitrate: targetBitrate,
          bitrateMode: 'constant',
        } as AudioEncoderConfig);
        if (this.encoder.state === 'configured') {
          this.isConfigured = true;
          return;
        }
      } catch {
        try {
          this.encoder.configure({
            codec: standardCodec,
            sampleRate,
            numberOfChannels,
            bitrate: targetBitrate,
          });
          if (this.encoder.state === 'configured') {
            this.isConfigured = true;
            return;
          }
        } catch {}
      }
    }
  }

  public async add(sample: AudioSample): Promise<void> {
    if (!this.isConfigured && !this.encoder) {
      this.initEncoder(sample.sampleRate, sample.numberOfChannels);
    }
    if (!this.isConfigured || !this.encoder || this.encoder.state !== 'configured') return;

    if (sample.audioData) {
      this.encoder.encode(sample.audioData);
    } else if (sample.data) {
      const aData = new AudioData({
        format: 'f32',
        sampleRate: sample.sampleRate,
        numberOfFrames: sample.numberOfFrames,
        numberOfChannels: sample.numberOfChannels,
        timestamp: Math.max(0, Math.round(sample.timestamp * 1e6)),
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
      try {
        await this.encoder.flush();
      } catch (e) {
        console.warn('AudioEncoder flush warning:', e);
      }
    }
    await this.pendingOutput;
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
    try {
      for await (const wrapped of sink.canvases(_startTime)) {
        if (_endTime !== undefined && wrapped.timestamp > _endTime) break;
        yield new VideoSample(wrapped.canvas, {
          timestamp: wrapped.timestamp,
          duration: wrapped.duration,
        });
      }
    } finally {
      sink.close();
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
  private vOpts: any = null;
  private aSource: any = null;
  private aOpts: any = null;
  private webmMuxer: WebMMuxer | null = null;
  private mp4Muxer: MP4Muxer | null = null;

  constructor(options: { format: any; target: StreamTarget | BufferTarget }) {
    this.format = options.format;
    this.target = options.target;
  }

  public addVideoTrack(vSource: any, opts?: any): void {
    this.vSource = vSource;
    this.vOpts = opts;
  }

  public addAudioTrack(aSource: any, opts?: any): void {
    this.aSource = aSource;
    this.aOpts = opts;
  }

  public async start(): Promise<void> {
    const isWebM = this.format instanceof WebMOutputFormat || this.format instanceof MkvOutputFormat;
    const isMkv = this.format instanceof MkvOutputFormat;
    const onChunk = async (chunk: StreamTargetChunk) => {
      await this.target.write(chunk);
    };

    const initW = this.vOpts?.width || this.vOpts?.decoderConfig?.codedWidth || this.vSource?.options?.width || 1280;
    const initH = this.vOpts?.height || this.vOpts?.decoderConfig?.codedHeight || this.vSource?.options?.height || 720;
    const vDescRaw = this.vOpts?.decoderConfig?.description;
    const initVDesc = vDescRaw
      ? (vDescRaw instanceof Uint8Array ? vDescRaw : new Uint8Array(vDescRaw instanceof ArrayBuffer ? vDescRaw : vDescRaw.buffer, vDescRaw.byteOffset || 0, vDescRaw.byteLength))
      : undefined;
    const aDescRaw = this.aOpts?.decoderConfig?.description;
    const initADesc = aDescRaw
      ? (aDescRaw instanceof Uint8Array ? aDescRaw : new Uint8Array(aDescRaw instanceof ArrayBuffer ? aDescRaw : aDescRaw.buffer, aDescRaw.byteOffset || 0, aDescRaw.byteLength))
      : undefined;
    const initSampleRate = this.aOpts?.decoderConfig?.sampleRate || this.aSource?.options?.sampleRate || 48000;
    const initChannels = this.aOpts?.decoderConfig?.numberOfChannels || this.aSource?.options?.numberOfChannels || 2;
    const initAudioBitrate = this.aOpts?.bitrate || this.aSource?.options?.bitrate || 192000;
    const initFps = this.vOpts?.framerate || this.vOpts?.fps || this.vSource?.options?.framerate || this.vSource?.options?.fps || this.vSource?.trackInfo?.fps || 30;

    if (isWebM) {
      this.webmMuxer = new WebMMuxer({
        width: initW,
        height: initH,
        fps: initFps,
        framerate: initFps,
        videoCodec: this.vSource?.codec || this.vSource?.options?.codec || 'vp9',
        audioCodec: this.aSource ? (this.aSource?.codec || this.aSource?.options?.codec || 'opus') : undefined,
        sampleRate: initSampleRate,
        channels: initChannels,
        videoDescription: initVDesc,
        audioDescription: initADesc,
        isMkv,
        onChunk,
      });
      await this.webmMuxer.start();

      if (this.vSource && 'onEncodedChunk' in this.vSource) {
        this.vSource.onEncodedChunk = async (chunk: any, meta?: any) => {
          await this.webmMuxer!.addVideoChunk(chunk, meta);
        };
      }
      if (this.aSource && 'onEncodedChunk' in this.aSource) {
        this.aSource.onEncodedChunk = async (chunk: any, meta?: any) => {
          await this.webmMuxer!.addAudioChunk(chunk, meta);
        };
      }
    } else {
      this.mp4Muxer = new MP4Muxer({
        width: initW,
        height: initH,
        fps: initFps,
        framerate: initFps,
        videoCodec: this.vSource?.codec || this.vSource?.options?.codec || 'avc',
        audioCodec: this.aSource ? (this.aSource?.codec || this.aSource?.options?.codec || 'aac') : undefined,
        audioBitrate: initAudioBitrate,
        sampleRate: initSampleRate,
        channels: initChannels,
        description: initVDesc,
        audioDescription: initADesc,
        onChunk,
      });
      await this.mp4Muxer.start();

      if (this.vSource && 'onEncodedChunk' in this.vSource) {
        this.vSource.onEncodedChunk = async (chunk: any, meta?: any) => {
          await this.mp4Muxer!.addVideoChunk(chunk, meta);
        };
      }
      if (this.aSource && 'onEncodedChunk' in this.aSource) {
        this.aSource.onEncodedChunk = async (chunk: any, meta?: any) => {
          await this.mp4Muxer!.addAudioChunk(chunk, meta);
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

  public getFile(): File | Blob {
    return this.file;
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

  public async init(): Promise<boolean> {
    return await this.nativeSink.init();
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

  public stopStream(): void {
    this.nativeSink.stopStream();
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
  public options: any;
  public onEncodedChunk: ((chunk: any, meta?: any) => Promise<void>) | null = null;

  constructor(codec: string) {
    this.codec = codec;
    this.options = { codec };
  }

  public async add(packet: EncodedPacket, opts?: any): Promise<void> {
    if (!this.onEncodedChunk || !packet || !packet.data) return;
    const data = packet.data instanceof Uint8Array ? packet.data : new Uint8Array(packet.data);
    const chunk: any = {
      type: packet.type || 'key',
      timestamp: Math.max(0, Math.round((packet.timestamp || 0) * 1e6)),
      duration: Math.max(1000, Math.round((packet.duration || 0.033) * 1e6)),
      byteLength: data.byteLength,
      data,
      copyTo: (dest: Uint8Array) => dest.set(data),
    };
    const meta = opts?.decoderConfig ? { decoderConfig: opts.decoderConfig } : undefined;
    await this.onEncodedChunk(chunk, meta);
  }

  public async flush(): Promise<void> {}
  public async close(): Promise<void> {}
}

export class EncodedAudioPacketSource {
  public codec: string;
  public options: any;
  public onEncodedChunk: ((chunk: any, meta?: any) => Promise<void>) | null = null;

  constructor(codec: string) {
    this.codec = codec;
    this.options = { codec };
  }

  public async add(packet: EncodedPacket, opts?: any): Promise<void> {
    if (!this.onEncodedChunk || !packet || !packet.data) return;
    const data = packet.data instanceof Uint8Array ? packet.data : new Uint8Array(packet.data);
    const chunk: any = {
      type: packet.type || 'key',
      timestamp: Math.max(0, Math.round((packet.timestamp || 0) * 1e6)),
      duration: Math.max(1000, Math.round((packet.duration || 0.021) * 1e6)),
      byteLength: data.byteLength,
      data,
      copyTo: (dest: Uint8Array) => dest.set(data),
    };
    const meta = opts?.decoderConfig ? { decoderConfig: opts.decoderConfig } : undefined;
    await this.onEncodedChunk(chunk, meta);
  }

  public async flush(): Promise<void> {}
  public async close(): Promise<void> {}
}

export class EncodedPacketSink {
  private track: any;
  constructor(track: any) {
    this.track = track;
  }
  public packets(): AsyncIterable<EncodedPacket> {
    const track = this.track;
    return {
      [Symbol.asyncIterator]: async function* () {
        if (!track || typeof track.getFile !== 'function') return;
        const file: File | Blob = track.getFile();
        const isAudio = track.trackInfo?.type === 'audio' || track instanceof InputAudioTrack;

        const name = (file as File)?.name || '';
        const ext = name.split('.').pop()?.toLowerCase() || '';
        let headBuf = new Uint8Array(0);
        try {
          headBuf = new Uint8Array(await file.slice(0, 16).arrayBuffer());
        } catch {}

        const isEBML = headBuf.length >= 4 && headBuf[0] === 0x1a && headBuf[1] === 0x45 && headBuf[2] === 0xdf && headBuf[3] === 0xa3;
        const isMp4 = (headBuf.length >= 8 && (
          (headBuf[4] === 0x66 && headBuf[5] === 0x74 && headBuf[6] === 0x79 && headBuf[7] === 0x70) ||
          (headBuf[4] === 0x6d && headBuf[5] === 0x6f && headBuf[6] === 0x6f && headBuf[7] === 0x76) ||
          (headBuf[4] === 0x66 && headBuf[5] === 0x72 && headBuf[6] === 0x65 && headBuf[7] === 0x65) ||
          (headBuf[4] === 0x6d && headBuf[5] === 0x64 && headBuf[6] === 0x61 && headBuf[7] === 0x74)
        )) || ['mp4', 'm4v', 'mov', '3gp'].includes(ext);

        if (isMp4 && !isEBML) {
          const mp4 = new MP4Demuxer(file);
          const ok = await mp4.parse();
          if (ok) {
            const samples = isAudio ? mp4.getAudioSamples() : mp4.getVideoSamples();
            for (let i = 0; i < samples.length; i++) {
              const s = samples[i];
              const data = await mp4.readSampleData(s);
              if (data.byteLength > 0) {
                yield new EncodedPacket(
                  data,
                  s.isKeyframe ? 'key' : 'delta',
                  s.timestamp,
                  s.duration,
                  s.index,
                  data.byteLength
                );
              }
            }
            return;
          }
        }

        const ebml = new EBMLDemuxer(file);
        const ebmlOk = await ebml.parse();
        if (ebmlOk) {
          await ebml.scanClusters();
          const samples = isAudio ? ebml.getAudioSamples() : ebml.getVideoSamples();
          for (let i = 0; i < samples.length; i++) {
            const s = samples[i];
            const data = await ebml.readSampleData(s);
            if (data.byteLength > 0) {
              yield new EncodedPacket(
                data,
                s.isKeyframe ? 'key' : 'delta',
                s.timestamp,
                s.duration,
                s.index,
                data.byteLength
              );
            }
          }
        }
      },
    };
  }
}

export class Conversion {
  public options: any;
  public onProgress: (prog: number) => void = () => {};

  constructor(options: any) {
    this.options = options;
  }

  public static async init(opts: any): Promise<Conversion> {
    return new Conversion(opts);
  }

  public async execute(): Promise<void> {
    const input: Input = this.options?.input;
    const output: Output = this.options?.output;
    if (!input || !output) {
      throw new Error('Conversion requires both input and output');
    }

    const trim = this.options?.trim;
    const videoOpts = this.options?.video;
    const audioOpts = this.options?.audio;
    const startTime = typeof trim?.start === 'number' && trim.start > 0 ? trim.start : 0;
    const endTime = typeof trim?.end === 'number' && trim.end > 0 ? trim.end : undefined;

    // =========================================================================
    // Mode 1: WebCodecs Transcode (Decode -> Filter/Scale -> Encode -> Mux)
    // =========================================================================
    if (videoOpts?.forceTranscode) {
      const file = input.getFile();
      const targetW = videoOpts.processedWidth || videoOpts.width || 1280;
      const targetH = videoOpts.processedHeight || videoOpts.height || 720;

      // Probe source FPS if user selected Auto FPS (frameRate undefined)
      let sourceFps = 30;
      try {
        const vTracks = await input.getVideoTracks();
        if (vTracks.length > 0 && vTracks[0].trackInfo?.fps > 0) {
          sourceFps = vTracks[0].trackInfo.fps;
        }
      } catch {}

      const explicitFps = typeof videoOpts.frameRate === 'number' && videoOpts.frameRate > 0
        ? Math.min(240, Math.max(1, Math.round(videoOpts.frameRate)))
        : undefined;
      const fps = explicitFps || sourceFps || 30;

      const vSource = new VideoSampleSource({
        codec: videoOpts.codec || 'avc',
        quality: videoOpts.quality,
        hardwareAcceleration: videoOpts.hardwareAcceleration || 'prefer-hardware',
        latencyMode: videoOpts.latencyMode || 'quality',
        framerate: fps,
        width: targetW,
        height: targetH,
      });
      output.addVideoTrack(vSource, { width: targetW, height: targetH, framerate: fps, fps });

      let aSource: AudioSampleSource | null = null;
      if (!audioOpts?.discard) {
        aSource = new AudioSampleSource({
          codec: audioOpts?.codec || 'opus',
          bitrate: audioOpts?.bitrate || 192_000,
        });
        output.addAudioTrack(aSource, { bitrate: audioOpts?.bitrate || 192_000 });
      }

      await output.start();

      // Pre-decode audio buffer in browser if audio track is enabled and file size fits in RAM
      let decodedAudioBuf: AudioBuffer | null = null;
      if (aSource && typeof window !== 'undefined' && file.size <= 150 * 1024 * 1024) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          try {
            const ctx = new AudioCtx();
            const ab = await file.arrayBuffer();
            decodedAudioBuf = await ctx.decodeAudioData(ab);
            ctx.close().catch(() => {});
          } catch {}
        }
      }

      const sink = new NativeCanvasSink(file, {
        width: typeof videoOpts.process === 'function' ? undefined : targetW,
        height: typeof videoOpts.process === 'function' ? undefined : targetH,
        fit: videoOpts.fit || 'cover',
      });
      const sinkOk = await sink.init();
      const sourceDur = sink.duration || (await input.getDurationFromMetadata()) || 10;
      const actualEnd = endTime !== undefined ? Math.min(endTime, sourceDur > 0 ? sourceDur : endTime) : sourceDur;
      const totalDur = Math.max(0.1, actualEnd - startTime);

      let currentAudioTime = 0;
      const audioFrameSize = 1024;
      const audioSampleRate = 48000;
      const audioFrameDur = audioFrameSize / audioSampleRate;

      const encodeAudioUpTo = async (targetOutTime: number) => {
        if (!aSource || !decodedAudioBuf) return;
        const srcRate = decodedAudioBuf.sampleRate;
        const srcChans = decodedAudioBuf.numberOfChannels;
        const left = decodedAudioBuf.getChannelData(0);
        const right = srcChans > 1 ? decodedAudioBuf.getChannelData(1) : left;
        const totalSrcFrames = decodedAudioBuf.length;

        while (currentAudioTime < targetOutTime - 0.0005) {
          const srcSec = startTime + currentAudioTime;
          if (srcSec >= decodedAudioBuf.duration) break;
          const srcStartFrame = Math.round(srcSec * srcRate);
          const pcm = new Float32Array(audioFrameSize * 2);
          for (let i = 0; i < audioFrameSize; i++) {
            const exact = srcStartFrame + (i / audioSampleRate) * srcRate;
            const f0 = Math.floor(exact);
            if (f0 >= 0 && f0 < totalSrcFrames) {
              pcm[i * 2] = left[f0];
              pcm[i * 2 + 1] = right[f0];
            }
          }
          const aSample = new AudioSample({
            format: 'f32',
            sampleRate: audioSampleRate,
            numberOfChannels: 2,
            timestamp: currentAudioTime,
            duration: audioFrameDur,
            data: pcm,
          });
          await aSource.add(aSample);
          aSample.close();
          currentAudioTime += audioFrameDur;
        }
      };

      if (sinkOk) {
        try {
          let nextTargetOutTs = 0;
          const targetFrameDur = 1 / fps;

          for await (const wrapped of sink.canvases(startTime)) {
            if (endTime !== undefined && wrapped.timestamp > endTime + 0.05) {
              break;
            }
            const outTs = Math.max(0, wrapped.timestamp - startTime);
            const dur = wrapped.duration > 0 ? wrapped.duration : targetFrameDur;

            if (explicitFps) {
              // Resample frames to match explicit user-selected FPS
              if (outTs + dur < nextTargetOutTs - 0.002) {
                continue;
              }
              let sample = new VideoSample(wrapped.canvas, { timestamp: nextTargetOutTs, duration: targetFrameDur });
              if (typeof videoOpts.process === 'function') {
                const processedCanvas = await videoOpts.process(sample);
                if (processedCanvas) {
                  sample = new VideoSample(processedCanvas, { timestamp: nextTargetOutTs, duration: targetFrameDur });
                }
              }
              // Emit 1 or more frames if source frame spans multiple target frame intervals
              while (nextTargetOutTs <= outTs + dur - targetFrameDur * 0.5 || nextTargetOutTs <= outTs + 0.001) {
                const frameSample = new VideoSample(sample.source, { timestamp: nextTargetOutTs, duration: targetFrameDur });
                await vSource.add(frameSample);
                nextTargetOutTs += targetFrameDur;
                if (nextTargetOutTs > totalDur) break;
              }
              sample.close();
              await encodeAudioUpTo(nextTargetOutTs);
            } else {
              let sample = new VideoSample(wrapped.canvas, { timestamp: outTs, duration: dur });
              if (typeof videoOpts.process === 'function') {
                const processedCanvas = await videoOpts.process(sample);
                if (processedCanvas) {
                  sample = new VideoSample(processedCanvas, { timestamp: outTs, duration: dur });
                }
              }
              await vSource.add(sample);
              sample.close();
              await encodeAudioUpTo(outTs + dur);
            }

            const prog = Math.min(0.98, Math.max(0.02, outTs / totalDur));
            this.onProgress(prog);
          }
        } finally {
          sink.close();
        }
      }

      await encodeAudioUpTo(totalDur);
      await output.finalize();
      this.onProgress(1.0);
      return;
    }

    // =========================================================================
    // Mode 2: Lossless Stream Copy (Remux / Trim without Re-Encoding)
    // =========================================================================
    const vTracks = await input.getVideoTracks();
    const aTracks = await input.getAudioTracks();

    let vSource: EncodedVideoPacketSource | null = null;
    let aSource: EncodedAudioPacketSource | null = null;
    let vDecConfig: any = null;
    let aDecConfig: any = null;

    if (vTracks.length > 0) {
      const vCodec = (await vTracks[0].getCodec()) || 'avc';
      vDecConfig = await vTracks[0].getDecoderConfig();
      vSource = new EncodedVideoPacketSource(vCodec);
      output.addVideoTrack(vSource, {
        decoderConfig: vDecConfig ?? undefined,
        width: vTracks[0].displayWidth,
        height: vTracks[0].displayHeight,
        fps: vTracks[0].trackInfo?.fps || 30,
        framerate: vTracks[0].trackInfo?.fps || 30,
      });
    }

    if (aTracks.length > 0 && !audioOpts?.discard) {
      const aCodec = (await aTracks[0].getCodec()) || 'aac';
      aDecConfig = await aTracks[0].getDecoderConfig();
      aSource = new EncodedAudioPacketSource(aCodec);
      output.addAudioTrack(aSource, {
        decoderConfig: aDecConfig ?? undefined,
      });
    }

    if (!vSource && !aSource) {
      throw new Error('No compatible video or audio tracks found for stream copy');
    }

    await output.start();

    const vSink = vSource && vTracks.length > 0 ? new EncodedPacketSink(vTracks[0]) : null;
    const aSink = aSource && aTracks.length > 0 ? new EncodedPacketSink(aTracks[0]) : null;

    const vIter = vSink ? vSink.packets()[Symbol.asyncIterator]() : null;
    const aIter = aSink ? aSink.packets()[Symbol.asyncIterator]() : null;

    let nextV = vIter ? await vIter.next() : { done: true, value: undefined };
    let nextA = aIter ? await aIter.next() : { done: true, value: undefined };

    let isFirstV = true;
    let isFirstA = true;
    let minVTs: number | null = null;
    let minATs: number | null = null;
    let lastVTs = -0.001;
    let lastATs = -0.001;
    let packetCount = 0;

    const sourceDur = (await input.getDurationFromMetadata()) || 10;
    const totalDur = Math.max(0.1, (endTime ?? sourceDur) - startTime);

    while (!nextV.done || !nextA.done) {
      const rawVTime = !nextV.done && nextV.value ? nextV.value.timestamp : Infinity;
      const rawATime = !nextA.done && nextA.value ? nextA.value.timestamp : Infinity;

      if (rawVTime <= rawATime && !nextV.done && nextV.value) {
        const pkt = nextV.value;
        if (pkt.timestamp < startTime) {
          nextV = await vIter!.next();
          continue;
        }
        if (endTime !== undefined && pkt.timestamp > endTime) {
          nextV = { done: true, value: undefined };
          continue;
        }

        if (minVTs === null) minVTs = pkt.timestamp;
        const pTime = Math.max(lastVTs + 0.0001, Math.max(0, pkt.timestamp - minVTs));
        lastVTs = pTime;

        const shifted = new EncodedPacket(
          pkt.data,
          isFirstV ? 'key' : pkt.type,
          pTime,
          pkt.duration,
          pkt.sequenceNumber,
          pkt.byteLength,
          pkt.sideData
        );

        if (isFirstV && vDecConfig) {
          await vSource!.add(shifted, { decoderConfig: vDecConfig });
          isFirstV = false;
        } else {
          await vSource!.add(shifted);
        }

        packetCount++;
        if (packetCount % 30 === 0) {
          this.onProgress(Math.min(0.98, Math.max(0.02, pTime / totalDur)));
        }

        nextV = await vIter!.next();
      } else if (!nextA.done && nextA.value) {
        const pkt = nextA.value;
        if (pkt.timestamp < startTime) {
          nextA = await aIter!.next();
          continue;
        }
        if (endTime !== undefined && pkt.timestamp > endTime) {
          nextA = { done: true, value: undefined };
          continue;
        }

        if (minATs === null) minATs = pkt.timestamp;
        const pTime = Math.max(lastATs + 0.0001, Math.max(0, pkt.timestamp - minATs));
        lastATs = pTime;

        const shifted = new EncodedPacket(
          pkt.data,
          isFirstA ? 'key' : 'delta',
          pTime,
          pkt.duration,
          pkt.sequenceNumber,
          pkt.byteLength,
          pkt.sideData
        );

        if (isFirstA && aDecConfig) {
          await aSource!.add(shifted, { decoderConfig: aDecConfig });
          isFirstA = false;
        } else {
          await aSource!.add(shifted);
        }

        packetCount++;
        nextA = await aIter!.next();
      }
    }

    if (packetCount === 0) {
      throw new Error('No media packets found in specified range');
    }

    await output.finalize();
    this.onProgress(1.0);
  }
}

