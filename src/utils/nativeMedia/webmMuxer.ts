// Proprietary In-House Native Media Toolkit - WebM / MKV Muxer
// Zero external dependencies. Conforms to RFC 8794 & Matroska specs.

import { StreamTargetChunk } from './types';

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
  videoCodec?: string; // 'vp8' | 'vp9' | 'av1' | 'h264'
  audioCodec?: string; // 'opus' | 'aac'
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
    // 1. EBML Header
    const docType = encodeElement('4282', encodeString('webm'));
    const docTypeVer = encodeElement('4287', encodeUint(4));
    const docTypeReadVer = encodeElement('4285', encodeUint(2));
    const ebmlHdr = encodeElement('1a45dfa3', new Uint8Array([...docType, ...docTypeVer, ...docTypeReadVer]));

    // 2. Segment (unknown size 0x01FFFFFFFFFFFFFF)
    const segId = new Uint8Array([0x18, 0x53, 0x80, 0x67]);
    const segSize = new Uint8Array([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);

    // 3. Segment Info
    const timecodeScale = encodeElement('2ad7b1', encodeUint(1000000)); // 1ms
    const muxingApp = encodeElement('4d80', encodeString('VideoCutterPro'));
    const writingApp = encodeElement('5741', encodeString('VideoCutterPro'));
    const infoPayload = new Uint8Array([...timecodeScale, ...muxingApp, ...writingApp]);
    const infoEl = encodeElement('1549a966', infoPayload);

    // 4. Tracks
    const trackEntries: number[] = [];

    // Video Track
    if (this.options.width && this.options.height) {
      const trackNum = encodeElement('d7', encodeUint(1));
      const trackUid = encodeElement('73c5', encodeUint(1));
      const trackType = encodeElement('83', encodeUint(1)); // video

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

    // Audio Track
    if (this.options.audioCodec) {
      const trackNum = encodeElement('d7', encodeUint(2));
      const trackUid = encodeElement('73c5', encodeUint(2));
      const trackType = encodeElement('83', encodeUint(2)); // audio
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

    // SimpleBlock format:
    // Track number (VINT) = 1 (video) -> 0x81
    // Relative Timecode (int16)
    // Flags (0x80 = keyframe)
    // Payload (NAL/VPx packet)
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
    // Start new cluster every ~1000ms or on keyframe
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
