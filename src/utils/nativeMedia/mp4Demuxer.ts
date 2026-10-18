// Proprietary In-House Native Media Toolkit - MP4 / MOV (ISOBMFF) Demuxer
// Zero external dependencies. Conforms to ISO/IEC 14496-12.

import { VideoTrackInfo, AudioTrackInfo, MediaSample } from './types';

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
      // 1. Locate moov box (either near start or near end of file)
      let moovBox = await this.findTopLevelBox('moov', 0, Math.min(1024 * 1024, this.fileSize));
      
      if (!moovBox && this.fileSize > 1024 * 1024) {
        // Fast search from end of file (e.g. non-faststart MP4)
        const tailSearchSize = Math.min(10 * 1024 * 1024, this.fileSize);
        const tailOffset = this.fileSize - tailSearchSize;
        moovBox = await this.findTopLevelBox('moov', tailOffset, tailSearchSize);
      }

      if (!moovBox) {
        // Sequential scan of top-level boxes
        moovBox = await this.scanTopLevelForMoov();
      }

      if (!moovBox) {
        return false;
      }

      // Read entire moov data
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

    // Track metadata objects
    let stblData: Uint8Array | null = null;
    let stblFileOffset = 0;

    while (offset + 8 <= data.length) {
      const size = view.getUint32(offset);
      const type = String.fromCharCode(data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]);
      if (size < 8) break;

      const payload = data.subarray(offset + 8, Math.min(offset + size, data.length));

      if (type === 'tkhd') {
        const tkhdView = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
        const version = tkhdView.getUint8(0);
        trackId = version === 1 ? tkhdView.getUint32(16) : tkhdView.getUint32(12);

        // Matrix begins at offset 40 (v0) or 48 (v1)
        const matrixOffset = version === 1 ? 48 : 40;
        if (payload.length >= matrixOffset + 36) {
          const b = tkhdView.getInt32(matrixOffset + 4) / 65536;
          const a = tkhdView.getInt32(matrixOffset) / 65536;
          if (a === 0 && b === 1) rotation = 90;
          else if (a === -1 && b === 0) rotation = 180;
          else if (a === 0 && b === -1) rotation = 270;
        }

        // Width and height are 16.16 fixed point numbers at end of tkhd
        if (payload.length >= matrixOffset + 36 + 8) {
          trackWidth = tkhdView.getUint32(matrixOffset + 36) >> 16;
          trackHeight = tkhdView.getUint32(matrixOffset + 40) >> 16;
        }
      } else if (type === 'mdia') {
        // Parse mdia
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
            // Find stbl inside minf
            let minfOffset = 0;
            const minfView = new DataView(mPayload.buffer, mPayload.byteOffset, mPayload.byteLength);
            while (minfOffset + 8 <= mPayload.length) {
              const minfSize = minfView.getUint32(minfOffset);
              const minfType = String.fromCharCode(mPayload[minfOffset + 4], mPayload[minfOffset + 5], mPayload[minfOffset + 6], mPayload[minfOffset + 7]);
              if (minfSize < 8) break;

              if (minfType === 'stbl') {
                stblData = mPayload.subarray(minfOffset + 8, Math.min(minfOffset + minfSize, mPayload.length));
                stblFileOffset = fileBaseOffset + offset + 8 + mOffset + 8 + minfOffset + 8;
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

    // Table arrays
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
        // Sample description
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
                width = pView.getUint16(entryOffset + 24);
                height = pView.getUint16(entryOffset + 26);
              }

              let description: Uint8Array | undefined;
              // Check for avcC, hvcC, vpcC, av1C inside entry
              let subOffset = entryOffset + 78;
              while (subOffset + 8 <= entryOffset + entrySize && subOffset + 8 <= payload.length) {
                const subSize = pView.getUint32(subOffset);
                const subType = String.fromCharCode(payload[subOffset + 4], payload[subOffset + 5], payload[subOffset + 6], payload[subOffset + 7]);
                if (subSize < 8) break;

                if (subType === 'avcC' || subType === 'hvcC' || subType === 'vpcC' || subType === 'av1C') {
                  description = payload.subarray(subOffset + 8, subOffset + subSize);
                  if (subType === 'avcC') {
                    const profile = payload[subOffset + 9].toString(16).padStart(2, '0');
                    const compat = payload[subOffset + 10].toString(16).padStart(2, '0');
                    const level = payload[subOffset + 11].toString(16).padStart(2, '0');
                    codec = `avc1.${profile}${compat}${level}`;
                  }
                  break;
                }
                subOffset += subSize;
              }

              decoderConfig = {
                codec,
                codedWidth: width,
                codedHeight: height,
                description,
              };
            } else {
              // Audio entry
              let channels = 2;
              let sampleRate = 48000;
              if (payload.length >= entryOffset + 32) {
                channels = pView.getUint16(entryOffset + 16);
                sampleRate = pView.getUint16(entryOffset + 24);
              }
              let description: Uint8Array | undefined;
              let subOffset = entryOffset + 28;
              while (subOffset + 8 <= entryOffset + entrySize && subOffset + 8 <= payload.length) {
                const subSize = pView.getUint32(subOffset);
                const subType = String.fromCharCode(payload[subOffset + 4], payload[subOffset + 5], payload[subOffset + 6], payload[subOffset + 7]);
                if (subSize < 8) break;

                if (subType === 'esds') {
                  description = payload.subarray(subOffset + 8, subOffset + subSize);
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
            stss.add(pView.getUint32(p)); // 1-indexed sample numbers
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

    // Reconstruct samples with offset, timestamp, duration, isKeyframe
    const samples: MediaSample[] = [];
    const totalSamples = uniformSampleSize > 0 ? (stsc.length > 0 ? 1000 : 0) : stsz.length;

    // 1. Expand DTS timestamps from stts
    let dtsList: number[] = [];
    let currentDts = 0;
    for (const entry of stts) {
      for (let i = 0; i < entry.count; i++) {
        dtsList.push(currentDts / timescale);
        currentDts += entry.delta;
      }
    }

    // 2. Expand PTS from ctts
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

    // 3. Map samples to chunk byte offsets
    let sampleIdx = 0;
    let stscIdx = 0;

    for (let chunkIdx = 0; chunkIdx < stco.length; chunkIdx++) {
      const chunkNumber = chunkIdx + 1; // 1-indexed
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

        // Keyframe check: if stss exists, only samples in stss are keyframes. If no stss (e.g. audio), all are keyframes.
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
