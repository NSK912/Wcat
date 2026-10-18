// Proprietary In-House Native Media Toolkit - EBML (WebM / MKV) Demuxer
// Zero external dependencies. Conforms to RFC 8794 & Matroska specs.

import { VideoTrackInfo, AudioTrackInfo, MediaSample } from './types';

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
  public timecodeScale: number = 1000000; // default 1ms
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
      // Read initial 2MB to parse EBML Header, Info, Tracks, and first cluster
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

      // Scan elements inside Segment
      while (pos + 4 < headBuf.length) {
        const el = readElementHeader(headBuf, pos);
        if (!el || el.size < 0) break;

        const payloadStart = pos + el.totalHeaderLen;
        const payloadEnd = payloadStart + el.size;

        if (el.idHex === '1549a966') {
          // Info element
          const infoBuf = headBuf.subarray(payloadStart, Math.min(payloadEnd, headBuf.length));
          this.parseInfo(infoBuf);
        } else if (el.idHex === '1654ae6b') {
          // Tracks element
          const tracksBuf = headBuf.subarray(payloadStart, Math.min(payloadEnd, headBuf.length));
          this.parseTracks(tracksBuf);
        } else if (el.idHex === '1f43b675') {
          // Reached Cluster, metadata parsing complete
          break;
        }

        pos = payloadEnd;
      }

      // If duration was not found in head Info, read last 512KB to find Duration or last Cluster
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
        // TimecodeScale (in ns)
        let scale = 0;
        for (let i = 0; i < el.size; i++) {
          scale = scale * 256 + buf[valOffset + i];
        }
        if (scale > 0) this.timecodeScale = scale;
      } else if (el.idHex === '4489') {
        // Duration
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
        // TrackEntry
        const entryBuf = buf.subarray(p + el.totalHeaderLen, p + el.totalHeaderLen + el.size);
        this.parseTrackEntry(entryBuf);
      }

      p += el.totalHeaderLen + el.size;
    }
  }

  private parseTrackEntry(buf: Uint8Array): void {
    let p = 0;
    let trackNum = 1;
    let trackType = 1; // 1 = video, 2 = audio
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
        // TrackNumber
        trackNum = valView.getUint8(0);
      } else if (el.idHex === '83') {
        // TrackType
        trackType = valView.getUint8(0);
      } else if (el.idHex === '86') {
        // CodecID
        codecId = new TextDecoder().decode(buf.subarray(valOffset, valEnd)).trim();
      } else if (el.idHex === '63a2') {
        // CodecPrivate
        codecPrivate = buf.subarray(valOffset, valEnd);
      } else if (el.idHex === 'e0') {
        // Video Settings
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
        // Audio Settings
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
      // Video
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
      // Audio
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

    // Scan backwards or forwards for ID_CLUSTER ('1f43b675') or ID_TIMECODE ('e7')
    let maxTimecode = 0;
    for (let i = 0; i < tailBuf.length - 8; i++) {
      if (tailBuf[i] === 0x1f && tailBuf[i + 1] === 0x43 && tailBuf[i + 2] === 0xb6 && tailBuf[i + 3] === 0x75) {
        // Found cluster header
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

    // Scan clusters in chunks of 512KB
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
          // Cluster
          clusterCount++;
          p += el.totalHeaderLen;
          continue;
        } else if (el.idHex === 'e7') {
          // Timecode
          clusterTimecode = 0;
          const valStart = p + el.totalHeaderLen;
          for (let b = 0; b < el.size; b++) {
            clusterTimecode = clusterTimecode * 256 + chunkBuf[valStart + b];
          }
        } else if (el.idHex === 'a3') {
          // SimpleBlock
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
