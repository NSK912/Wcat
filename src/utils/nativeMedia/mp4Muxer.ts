// Proprietary In-House Native Media Toolkit - Fragmented MP4 (fMP4) Muxer
// Zero external dependencies. Conforms to ISO/IEC 14496-12 (ISOBMFF).

import { StreamTargetChunk } from './types';

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
  private baseVideoTimeMs = 0;
  private isHeaderSent = false;

  constructor(options: MP4MuxerOptions) {
    this.options = options;
  }

  public async start(): Promise<void> {
    if (this.isHeaderSent) return;
    this.isHeaderSent = true;

    // 1. ftyp box
    const ftypPayload = new Uint8Array([
      0x69, 0x73, 0x6f, 0x6d, // major_brand: 'isom'
      0x00, 0x00, 0x02, 0x00, // minor_version: 512
      0x69, 0x73, 0x6f, 0x6d, // 'isom'
      0x69, 0x73, 0x6f, 0x32, // 'iso2'
      0x61, 0x76, 0x63, 0x31, // 'avc1'
      0x6d, 0x70, 0x34, 0x31, // 'mp41'
    ]);
    const ftypBox = createBox('ftyp', ftypPayload);

    // 2. moov box
    // mvhd
    const mvhdPayload = new Uint8Array(100);
    const mvhdView = new DataView(mvhdPayload.buffer);
    mvhdView.setUint32(12, 1000); // timescale = 1000Hz (ms)
    mvhdView.setUint32(16, 0);    // duration (0 in fragmented)
    mvhdView.setUint32(20, 0x00010000); // rate 1.0
    mvhdView.setUint16(24, 0x0100);     // volume 1.0
    // matrix unity
    mvhdView.setUint32(36, 0x00010000);
    mvhdView.setUint32(52, 0x00010000);
    mvhdView.setUint32(68, 0x40000000);
    mvhdView.setUint32(76, 3);          // next_track_id
    const mvhdBox = createBox('mvhd', mvhdPayload);

    // mvex box (contains trex for tracks)
    const trex1Payload = new Uint8Array(24);
    const trex1View = new DataView(trex1Payload.buffer);
    trex1View.setUint32(4, 1); // track 1 (video)
    trex1View.setUint32(8, 1); // default sample description index
    const trex1Box = createBox('trex', trex1Payload);

    const trex2Payload = new Uint8Array(24);
    const trex2View = new DataView(trex2Payload.buffer);
    trex2View.setUint32(4, 2); // track 2 (audio)
    trex2View.setUint32(8, 1);
    const trex2Box = createBox('trex', trex2Payload);

    const mvexPayload = new Uint8Array(trex1Box.length + trex2Box.length);
    mvexPayload.set(trex1Box, 0);
    mvexPayload.set(trex2Box, trex1Box.length);
    const mvexBox = createBox('mvex', mvexPayload);

    // trak 1: Video
    const w = this.options.width || 1280;
    const h = this.options.height || 720;

    const tkhdPayload = new Uint8Array(84);
    const tkhdView = new DataView(tkhdPayload.buffer);
    tkhdView.setUint32(0, 0x00000007); // flags enabled, in_movie, in_preview
    tkhdView.setUint32(12, 1); // track_id 1
    tkhdView.setUint32(36, 0x00010000);
    tkhdView.setUint32(52, 0x00010000);
    tkhdView.setUint32(68, 0x40000000);
    tkhdView.setUint32(76, w << 16);
    tkhdView.setUint32(80, h << 16);
    const tkhdBox = createBox('tkhd', tkhdPayload);

    const mdhdPayload = new Uint8Array(24);
    const mdhdView = new DataView(mdhdPayload.buffer);
    mdhdView.setUint32(12, 1000); // timescale
    const mdhdBox = createBox('mdhd', mdhdPayload);

    const hdlrPayload = new Uint8Array([
      0, 0, 0, 0, // version/flags
      0, 0, 0, 0, // pre-defined
      0x76, 0x69, 0x64, 0x65, // handler_type 'vide'
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // reserved
      0x56, 0x69, 0x64, 0x65, 0x6f, 0x48, 0x61, 0x6e, 0x64, 0x6c, 0x65, 0x72, 0 // 'VideoHandler\0'
    ]);
    const hdlrBox = createBox('hdlr', hdlrPayload);

    // vmhd
    const vmhdBox = createBox('vmhd', new Uint8Array([0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]));

    // dinf & dref
    const urlBox = createBox('url ', new Uint8Array([0, 0, 0, 1]));
    const drefPayload = new Uint8Array(8 + urlBox.length);
    new DataView(drefPayload.buffer).setUint32(4, 1); // entry count
    drefPayload.set(urlBox, 8);
    const drefBox = createBox('dref', drefPayload);
    const dinfBox = createBox('dinf', drefBox);

    // stsd with avc1
    const avc1Payload = new Uint8Array(78);
    const avc1View = new DataView(avc1Payload.buffer);
    avc1View.setUint16(6, 1); // data reference index
    avc1View.setUint16(24, w);
    avc1View.setUint16(26, h);
    avc1View.setUint32(28, 0x00480000); // 72 dpi
    avc1View.setUint32(32, 0x00480000);
    avc1View.setUint16(40, 1); // frame count
    avc1View.setUint16(74, 24); // depth
    avc1View.setInt16(76, -1);

    let avcCBox = new Uint8Array(0);
    if (this.options.description && this.options.description.length > 0) {
      avcCBox = createBox('avcC', this.options.description);
    } else {
      // Default baseline avcC header
      avcCBox = createBox('avcC', new Uint8Array([0x01, 0x64, 0x00, 0x1f, 0xff, 0xe1, 0x00, 0x00, 0x00]));
    }

    const avc1Box = createBox('avc1', new Uint8Array([...avc1Payload, ...avcCBox]));
    const stsdPayload = new Uint8Array(8 + avc1Box.length);
    new DataView(stsdPayload.buffer).setUint32(4, 1); // entry count
    stsdPayload.set(avc1Box, 8);
    const stsdBox = createBox('stsd', stsdPayload);

    // Empty tables for fragmented MP4
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

    // Flush fragment every ~1000ms or 30 frames
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

    // 1. Calculate mdat payload size
    let mdatDataSize = 0;
    for (const s of samples) mdatDataSize += s.data.length;

    // 2. Build moof box
    // mfhd
    const mfhdPayload = new Uint8Array(8);
    new DataView(mfhdPayload.buffer).setUint32(4, this.sequenceNumber++);
    const mfhdBox = createBox('mfhd', mfhdPayload);

    // tfhd
    const tfhdPayload = new Uint8Array(8);
    const tfhdView = new DataView(tfhdPayload.buffer);
    tfhdView.setUint32(0, 0x020000); // default-base-is-moof
    tfhdView.setUint32(4, 1);        // track 1
    const tfhdBox = createBox('tfhd', tfhdPayload);

    // tfdt
    const tfdtPayload = new Uint8Array(8);
    new DataView(tfdtPayload.buffer).setUint32(4, samples[0].timestampMs);
    const tfdtBox = createBox('tfdt', tfdtPayload);

    // trun (track run)
    // flags: 0x0001 (data-offset-present) | 0x0100 (sample-duration-present) | 0x0200 (sample-size-present) | 0x0400 (sample-flags-present) = 0x000701
    const trunHeaderSize = 16;
    const trunEntrySize = 12; // duration (4) + size (4) + flags (4)
    const trunPayload = new Uint8Array(trunHeaderSize + samples.length * trunEntrySize);
    const trunView = new DataView(trunPayload.buffer);

    trunView.setUint32(0, 0x000701); // flags
    trunView.setUint32(4, samples.length);

    let trunOffset = trunHeaderSize;
    for (const s of samples) {
      trunView.setUint32(trunOffset, s.durationMs);
      trunView.setUint32(trunOffset + 4, s.data.length);
      // flags: non-sync = 0x00010000, sync = 0x02000000
      trunView.setUint32(trunOffset + 8, s.isKey ? 0x02000000 : 0x00010000);
      trunOffset += trunEntrySize;
    }

    const trunBox = createBox('trun', trunPayload);
    const trafPayload = new Uint8Array([...tfhdBox, ...tfdtBox, ...trunBox]);
    const trafBox = createBox('traf', trafPayload);

    const moofPayload = new Uint8Array([...mfhdBox, ...trafBox]);
    const moofBox = createBox('moof', moofPayload);

    // Update trun data_offset to point right after moof box into mdat payload
    const dataOffsetVal = moofBox.length + 8; // moof + mdat header
    // In trunBox, offset 8 is data_offset
    const trunInsideTraf = tfhdBox.length + tfdtBox.length;
    const trunInsideMoof = 8 + mfhdBox.length + 8 + trunInsideTraf;
    const trunDataOffsetPos = trunInsideMoof + 8 + 8;
    new DataView(moofBox.buffer, moofBox.byteOffset + trunDataOffsetPos, 4).setInt32(0, dataOffsetVal);

    // 3. Build mdat box
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
