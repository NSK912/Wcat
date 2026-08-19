import { SampleVideo } from '../types';
import {
  Input,
  Output,
  BlobSource,
  StreamTarget,
  BufferTarget,
  Mp4OutputFormat,
  WebMOutputFormat,
  MkvOutputFormat,
  Conversion,
  ALL_FORMATS,
  EncodedVideoPacketSource,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  EncodedPacket,
  type StreamTargetChunk
} from 'mediabunny';

/**
 * Detect media container format by extension and magic bytes (MP4 ISOBMFF vs WebM/MKV EBML)
 */
export async function detectMediaFormat(file: File): Promise<'mp4' | 'webm' | 'mkv' | 'unknown'> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (['mp4', 'm4v', 'mov'].includes(ext)) return 'mp4';
  if (ext === 'webm') return 'webm';
  if (ext === 'mkv') return 'mkv';

  try {
    const slice = await file.slice(0, 32).arrayBuffer();
    const bytes = new Uint8Array(slice);
    
    // Check EBML header: 0x1A 0x45 0xDF 0xA3
    if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
      return ext === 'mkv' ? 'mkv' : 'webm';
    }

    // Check MP4 ISOBMFF box (ftyp, moov, mdat, free, etc.)
    if (bytes.length >= 8) {
      const tag = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
      if (['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip', 'isom', 'mp41', 'mp42'].includes(tag)) {
        return 'mp4';
      }
    }
  } catch (e) {
    console.warn('Format detection fallback:', e);
  }

  return ext === 'webm' ? 'webm' : 'mp4';
}

/**
 * Creates a Mediabunny Target connected to a FileSystemWritableFileStream or in-memory BufferTarget
 */
function createMediabunnyTarget(writable: FileSystemWritableFileStream | null): StreamTarget | BufferTarget {
  if (!writable) {
    return new BufferTarget();
  }

  const customWritable = new WritableStream<StreamTargetChunk>({
    async write(chunk) {
      if (writable && typeof writable.write === 'function') {
        try {
          await writable.write(chunk);
        } catch (err) {
          // Direct fallback if chunk structure isn't directly unwrapped
          try {
            if (typeof (writable as any).seek === 'function' && typeof chunk.position === 'number') {
              await (writable as any).seek(chunk.position);
            }
            await writable.write(chunk.data);
          } catch (innerErr) {
            console.error('Writable write failure:', innerErr);
            throw innerErr;
          }
        }
      }
    },
    async close() {
      // Handled by outer caller
    }
  });

  return new StreamTarget(customWritable, { chunked: true });
}

/**
 * Determines output format instance for mediabunny based on filename or format
 */
function getOutputFormatForFile(filename: string): Mp4OutputFormat | WebMOutputFormat | MkvOutputFormat {
  const ext = filename.split('.').pop()?.toLowerCase() || 'mp4';
  if (ext === 'webm') {
    return new WebMOutputFormat();
  }
  if (ext === 'mkv') {
    return new MkvOutputFormat();
  }
  // Default to MP4 with fragmented fast start for seamless Zero-RAM streaming
  return new Mp4OutputFormat({ fastStart: 'fragmented' });
}

/**
 * Standard EBML VINT Reader
 */
export function readVint(buffer: Uint8Array, offset: number) {
  if (offset >= buffer.length) return null;
  const firstByte = buffer[offset];
  if (firstByte === 0) return null;

  let length = 1;
  let mask = 0x80;
  while ((firstByte & mask) === 0) {
    mask >>= 1;
    length++;
  }

  if (offset + length > buffer.length) return null;

  let value = firstByte & ~mask;
  for (let i = 1; i < length; i++) {
    value = (value * 256) + buffer[offset + i];
  }

  // Handle unknown size
  if (
    (length === 1 && value === 0x7F) ||
    (length === 2 && value === 0x3FFF) ||
    (length === 3 && value === 0x1FFFFF) ||
    (length === 4 && value === 0x0FFFFFFF) ||
    (length === 5 && value === 0x07FFFFFFFF) ||
    (length === 6 && value === 0x03FFFFFFFFFF) ||
    (length === 7 && value === 0x01FFFFFFFFFFFF) ||
    (length === 8 && value === 0x00FFFFFFFFFFFFFF)
  ) {
    value = -1; 
  }

  return { value, length };
}

export function writeVint(value: number, length: number): Uint8Array {
  const buf = new Uint8Array(length);
  let remaining = value;
  for (let i = length - 1; i >= 1; i--) {
    buf[i] = remaining & 0xff;
    remaining = Math.floor(remaining / 256);
  }
  buf[0] = remaining | (1 << (8 - length));
  return buf;
}

// --- Cues (Index) Builder Helpers ---
function concatBuffers(buffers: Uint8Array[]): Uint8Array {
    const totalLen = buffers.reduce((acc, b) => acc + b.length, 0);
    const res = new Uint8Array(totalLen);
    let offset = 0;
    for (const b of buffers) {
        res.set(b, offset);
        offset += b.length;
    }
    return res;
}

export function getVideoTrackNumber(tracksBuf: Uint8Array): number {
    let pos = 0;
    while (pos < tracksBuf.length) {
        const el = readElementHeader(tracksBuf, pos);
        if (!el) break;
        if (el.idHex === 'ae') { // TrackEntry
            const trackEntryView = tracksBuf.subarray(pos + el.totalHeaderLen, pos + el.totalHeaderLen + el.size);
            let innerPos = 0;
            let trackNum = -1;
            let trackType = -1;
            while (innerPos < trackEntryView.length) {
                const innerEl = readElementHeader(trackEntryView, innerPos);
                if (!innerEl) break;
                if (innerEl.idHex === 'd7') { // TrackNumber
                    if (innerEl.size === 1) trackNum = trackEntryView[innerPos + innerEl.totalHeaderLen];
                } else if (innerEl.idHex === '83') { // TrackType
                    if (innerEl.size === 1) trackType = trackEntryView[innerPos + innerEl.totalHeaderLen];
                }
                innerPos += innerEl.totalHeaderLen + innerEl.size;
            }
            if (trackType === 1 && trackNum !== -1) {
                return trackNum;
            }
        }
        pos += el.totalHeaderLen + el.size;
    }
    return 1; // fallback
}

export function buildSeekHead(cuesOffset: number): Uint8Array {
    const offsetBuf = new Uint8Array(8);
    let remaining = cuesOffset;
    for (let i = 7; i >= 0; i--) {
        offsetBuf[i] = remaining & 0xff;
        remaining = Math.floor(remaining / 256);
    }
    const seekPos = new Uint8Array([0x53, 0xAC, 0x88, ...offsetBuf]);
    const seekId = new Uint8Array([0x53, 0xAB, 0x84, 0x1C, 0x53, 0xBB, 0x6B]);
    const seekPayload = concatBuffers([seekId, seekPos]);
    const seekSize = encodeVintSize(seekPayload.length);
    const seek = concatBuffers([new Uint8Array([0x4D, 0xBB]), seekSize, seekPayload]);
    const seekHeadSize = encodeVintSize(seek.length);
    return concatBuffers([new Uint8Array([0x11, 0x4D, 0x9B, 0x74]), seekHeadSize, seek]);
}

function encodeVintSize(value: number): Uint8Array {
   if (value === -1) return new Uint8Array([0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);
   if (value < 127) return writeVint(value, 1);
   if (value < 16383) return writeVint(value, 2);
   if (value < 2097151) return writeVint(value, 3);
   if (value < 268435455) return writeVint(value, 4);
   if (value < 34359738367) return writeVint(value, 5); // 5 bytes max usually sufficient for JS numbers, but just in case
   return writeVint(value, 8); // Need larger for very big values, but for safety
}

function encodeUint(value: number): Uint8Array {
    if (value === 0) return new Uint8Array([0]);
    const bytes = [];
    let remaining = value;
    while (remaining > 0) {
        bytes.unshift(remaining & 0xff);
        remaining = Math.floor(remaining / 256);
    }
    return new Uint8Array(bytes);
}

function encodeElement(idHex: string, payload: Uint8Array): Uint8Array {
    const idBytes = [];
    for (let i = 0; i < idHex.length; i += 2) {
        idBytes.push(parseInt(idHex.substring(i, i + 2), 16));
    }
    const sizeBytes = encodeVintSize(payload.length);
    const result = new Uint8Array(idBytes.length + sizeBytes.length + payload.length);
    result.set(idBytes, 0);
    result.set(sizeBytes, idBytes.length);
    result.set(payload, idBytes.length + sizeBytes.length);
    return result;
}

function buildCuesElement(cuePoints: { time: number, offset: number }[], trackNum: number = 1): Uint8Array {
    const cuePointBuffers = cuePoints.map(cp => {
        const cueTime = encodeElement('B3', encodeUint(Math.floor(cp.time)));
        const cueTrack = encodeElement('F7', encodeUint(trackNum));
        const cueClusterPosition = encodeElement('F1', encodeUint(cp.offset));
        const cueTrackPositions = encodeElement('B7', concatBuffers([cueTrack, cueClusterPosition]));
        return encodeElement('BB', concatBuffers([cueTime, cueTrackPositions]));
    });
    return encodeElement('1C53BB6B', concatBuffers(cuePointBuffers));
}
// ------------------------------------

/**
 * Read raw bytes from File
 */
async function readSlice(file: File, offset: number, size: number): Promise<Uint8Array> {
  const end = Math.min(offset + size, file.size);
  if (offset >= end) return new Uint8Array(0);
  const slice = file.slice(offset, end);
  return new Uint8Array(await slice.arrayBuffer());
}

/**
 * Element parser that reads ID and Size from a buffer
 */
function readElementHeader(buf: Uint8Array, offset: number) {
  const idVint = readVint(buf, offset);
  if (!idVint) return null;
  
  const sizeVint = readVint(buf, offset + idVint.length);
  if (!sizeVint) return null;

  // Compute hex string ID for easy matching
  let idHex = '';
  for (let i = 0; i < idVint.length; i++) {
    idHex += buf[offset + i].toString(16).padStart(2, '0');
  }

  return {
    idHex,
    idLength: idVint.length,
    size: sizeVint.value,
    sizeLength: sizeVint.length,
    totalHeaderLen: idVint.length + sizeVint.length
  };
}

/**
 * Standard compliant EBML Tree traversal to extract Clusters
 */
interface ClusterMeta {
  offset: number;
  size: number;
  headerLen: number;
  timecode: number;
  timecodeOffset: number;
  timecodeLength: number;
  timecodeValueLength: number;
}

interface FileMeta {
  ebmlHeader: Uint8Array;
  segmentInfo: Uint8Array;
  segmentTracks: Uint8Array;
  clusters: ClusterMeta[];
  segmentOffset: number;
  segmentHeaderLen: number;
  fileDurationMs: number;
  timecodeScale: number;
  videoTrackNum: number;
}

const ID_EBML = '1a45dfa3';
const ID_SEGMENT = '18538067';
const ID_INFO = '1549a966';
const ID_TRACKS = '1654ae6b';
const ID_CLUSTER = '1f43b675';
const ID_TIMECODE = 'e7';
const ID_DURATION = '4489';
const ID_TIMECODESCALE = '2ad7b1';

async function parseWebMFile(file: File): Promise<FileMeta> {
  // Read first MB to parse headers
  let buf = await readSlice(file, 0, 1024 * 1024);
  let pos = 0;
  
  let meta: FileMeta = {
    ebmlHeader: new Uint8Array(0),
    segmentInfo: new Uint8Array(0),
    segmentTracks: new Uint8Array(0),
    clusters: [],
    segmentOffset: 0,
    segmentHeaderLen: 0,
    fileDurationMs: 0,
    timecodeScale: 1000000,
    videoTrackNum: 1 // default
  };

  let timecodeScale = 1000000; // default 1ms

  // 1. Read EBML Header
  const ebmlHdr = readElementHeader(buf, pos);
  if (!ebmlHdr || ebmlHdr.idHex !== ID_EBML) throw new Error("Invalid WebM: No EBML Header");
  meta.ebmlHeader = buf.slice(pos, pos + ebmlHdr.totalHeaderLen + ebmlHdr.size);
  pos += ebmlHdr.totalHeaderLen + ebmlHdr.size;

  // 2. Read Segment
  const segHdr = readElementHeader(buf, pos);
  if (!segHdr || segHdr.idHex !== ID_SEGMENT) throw new Error("Invalid WebM: No Segment");
  meta.segmentOffset = pos;
  meta.segmentHeaderLen = segHdr.totalHeaderLen;
  pos += segHdr.totalHeaderLen;

  let filePos = pos;
  
  // Traverse Segment Elements
  while (filePos < file.size) {
    if (filePos >= file.size) break;
    
    // We need to make sure we have enough buffer
    if (filePos - meta.segmentOffset + 64 > buf.length) {
       buf = await readSlice(file, filePos, 1024 * 1024);
       pos = 0;
    } else {
       pos = filePos - (meta.segmentOffset + meta.segmentHeaderLen); // relative to first buffer if it fit? No, offset tracking is easier.
    }

    // A better way: Always read small chunks to get headers
    const hdrBuf = await readSlice(file, filePos, 32);
    if (hdrBuf.length === 0) break;

    const el = readElementHeader(hdrBuf, 0);
    if (!el) break; // End of file or invalid

    if (el.idHex === ID_INFO) {
      meta.segmentInfo = await readSlice(file, filePos, el.totalHeaderLen + el.size);
      
      // Parse Info for Duration & TimecodeScale
      let infoPos = el.totalHeaderLen;
      while (infoPos < meta.segmentInfo.length) {
         const infoEl = readElementHeader(meta.segmentInfo, infoPos);
         if (!infoEl) break;
         if (infoEl.idHex === ID_TIMECODESCALE) {
            let scale = 0;
            for(let i=0; i<infoEl.size; i++) scale = (scale * 256) + meta.segmentInfo[infoPos + infoEl.totalHeaderLen + i];
            timecodeScale = scale;
         }
         if (infoEl.idHex === ID_DURATION) {
            // Duration is usually a 4-byte or 8-byte float
            const view = new DataView(meta.segmentInfo.buffer, meta.segmentInfo.byteOffset + infoPos + infoEl.totalHeaderLen, infoEl.size);
            if (infoEl.size === 4) meta.fileDurationMs = view.getFloat32(0);
            else if (infoEl.size === 8) meta.fileDurationMs = view.getFloat64(0);
         }
         infoPos += infoEl.totalHeaderLen + infoEl.size;
      }
      
      filePos += el.totalHeaderLen + el.size;
    } else if (el.idHex === ID_TRACKS) {
      meta.segmentTracks = await readSlice(file, filePos, el.totalHeaderLen + el.size);
      
      // Parse Tracks to find Video Track Number
      let trackPos = el.totalHeaderLen; // skip Tracks header
      while (trackPos < meta.segmentTracks.length) {
          const trackEntryEl = readElementHeader(meta.segmentTracks, trackPos);
          if (!trackEntryEl) break;
          if (trackEntryEl.idHex === 'ae') { // TrackEntry
              let entryPos = trackPos + trackEntryEl.totalHeaderLen;
              const entryEnd = entryPos + trackEntryEl.size;
              let currentTrackNum = 1;
              while (entryPos < entryEnd) {
                  const propEl = readElementHeader(meta.segmentTracks, entryPos);
                  if (!propEl) break;
                  if (propEl.idHex === 'd7') { // TrackNumber
                      let num = 0;
                      for (let i = 0; i < propEl.size; i++) {
                          num = (num * 256) + meta.segmentTracks[entryPos + propEl.totalHeaderLen + i];
                      }
                      currentTrackNum = num;
                  } else if (propEl.idHex === '83') { // TrackType
                      let tType = meta.segmentTracks[entryPos + propEl.totalHeaderLen];
                      if (tType === 1) { // 1 = Video
                          meta.videoTrackNum = currentTrackNum;
                      }
                  }
                  entryPos += propEl.totalHeaderLen + propEl.size;
              }
          }
          trackPos += trackEntryEl.totalHeaderLen + trackEntryEl.size;
      }

      filePos += el.totalHeaderLen + el.size;
    } else if (el.idHex === ID_CLUSTER) {
      // It's a cluster. We read its Timecode.
      const clusterHeaderLen = el.totalHeaderLen;
      const clusterSize = el.size === -1 ? (file.size - filePos - clusterHeaderLen) : el.size; // Unknown size means till EOF
      
      // Read first bytes of cluster to get Timecode
      const clusterBuf = await readSlice(file, filePos + clusterHeaderLen, Math.min(1024, clusterSize));
      
      let innerPos = 0;
      let clusterTc = 0;
      let tcOffset = 0;
      let tcLen = 0;
      let tcValLen = 0;

      while (innerPos < clusterBuf.length) {
         const innerEl = readElementHeader(clusterBuf, innerPos);
         if (!innerEl) break;
         if (innerEl.idHex === ID_TIMECODE) {
            let tc = 0;
            for(let k=0; k<innerEl.size; k++) {
                tc = (tc * 256) + clusterBuf[innerPos + innerEl.totalHeaderLen + k];
            }
            clusterTc = tc;
            tcOffset = filePos + clusterHeaderLen + innerPos;
            tcLen = innerEl.totalHeaderLen + innerEl.size;
            tcValLen = innerEl.size;
            break; // Found Timecode
         }
         innerPos += innerEl.totalHeaderLen + innerEl.size;
      }

      meta.clusters.push({
        offset: filePos,
        size: clusterSize === -1 ? -1 : (clusterHeaderLen + clusterSize),
        headerLen: clusterHeaderLen,
        timecode: clusterTc,
        timecodeOffset: tcOffset,
        timecodeLength: tcLen,
        timecodeValueLength: tcValLen
      });

      if (el.size === -1) {
         // Unknown size cluster usually means it's the last one and goes to EOF
         break;
      }
      filePos += el.totalHeaderLen + el.size;
    } else {
      // Skip unknown/unneeded elements (Cues, Tags, etc)
      if (el.size === -1) break; 
      filePos += el.totalHeaderLen + el.size;
    }
  }

  // Adjust duration if needed based on scale (usually 1000000ns = 1ms)
  if (meta.fileDurationMs > 0 && timecodeScale !== 1000000) {
      meta.fileDurationMs = (meta.fileDurationMs * timecodeScale) / 1000000;
  }
  
  meta.timecodeScale = timecodeScale;

  return meta;
}

/**
 * Deep search for Max Frame Timecode in a Cluster 
 * (Standard compliant reading of SimpleBlock/BlockGroup)
 */
async function getClusterMaxFrameTimecode(file: File, cluster: ClusterMeta): Promise<number> {
    const scanSize = cluster.size === -1 ? (file.size - cluster.offset) : cluster.size;
    if (scanSize <= cluster.headerLen) return cluster.timecode;

    // To be fast, we read chunks of the cluster and parse elements forward
    // Since we want standard compliance, we MUST parse forward. 
    // We can't backwards scan.
    let filePos = cluster.offset + cluster.headerLen;
    const endPos = cluster.offset + scanSize;
    
    let maxRelativeTc = 0;

    // Buffer to process
    let currentChunkSize = 256 * 1024; // 256KB chunks
    
    while (filePos < endPos) {
       const toRead = Math.min(currentChunkSize, endPos - filePos);
       const buf = await readSlice(file, filePos, toRead);
       if (buf.length === 0) break;

       let pos = 0;
       let lastValidPos = 0;

       while (pos < buf.length - 8) {
           const el = readElementHeader(buf, pos);
           if (!el) {
               // Need more data
               break; 
           }

           // If element exceeds buffer, we need to advance filePos to the next element
           if (pos + el.totalHeaderLen + el.size > buf.length) {
               break;
           }

           if (el.idHex === 'a3') { // SimpleBlock
               const trackVint = readVint(buf, pos + el.totalHeaderLen);
               if (trackVint) {
                   const tcPos = pos + el.totalHeaderLen + trackVint.length;
                   let relTc = (buf[tcPos] << 8) | buf[tcPos + 1];
                   if (relTc & 0x8000) relTc -= 0x10000;
                   if (relTc > maxRelativeTc) maxRelativeTc = relTc;
               }
           } else if (el.idHex === 'a0') { // BlockGroup
               // Parse inside BlockGroup to find Block (0xA1)
               let bgPos = pos + el.totalHeaderLen;
               const bgEnd = bgPos + el.size;
               while(bgPos < bgEnd) {
                   const innerEl = readElementHeader(buf, bgPos);
                   if (!innerEl) break;
                   if (innerEl.idHex === 'a1') { // Block
                       const trackVint = readVint(buf, bgPos + innerEl.totalHeaderLen);
                       if (trackVint) {
                           const tcPos = bgPos + innerEl.totalHeaderLen + trackVint.length;
                           let relTc = (buf[tcPos] << 8) | buf[tcPos + 1];
                           if (relTc & 0x8000) relTc -= 0x10000;
                           if (relTc > maxRelativeTc) maxRelativeTc = relTc;
                       }
                   }
                   bgPos += innerEl.totalHeaderLen + innerEl.size;
               }
           }
           
           pos += el.totalHeaderLen + el.size;
           lastValidPos = pos;
       }

       if (lastValidPos === 0) {
           // Buffer too small to read even one element? 
           // Extremely rare unless frame is > 256KB. We skip ahead by 1 byte (fallback) 
           // to avoid infinite loop, but strictly speaking we should increase buffer size.
           filePos += buf.length; 
       } else {
           filePos += lastValidPos;
       }
    }

    return cluster.timecode + maxRelativeTc;
}

/**
 * Mediabunny Stream Trim Engine (Handles MP4, MOV, MKV, WebM, TS)
 */
async function processMediabunnyTrimStream(
  file: File,
  startTime: number,
  endTime: number,
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  try {
    onProgress({
      percentage: 2,
      statusText: 'กำลังเตรียม Input และสร้าง Pipeline การตัดต่อ...',
      speedMBs: 0,
      log: `[INIT] Starting Trim: ${file.name}, Range: ${startTime.toFixed(2)}s -> ${endTime.toFixed(2)}s`
    });

    const input = new Input({
      source: new BlobSource(file),
      formats: ALL_FORMATS,
    });

    const format = getOutputFormatForFile(file.name);
    const target = createMediabunnyTarget(writable);
    const output = new Output({ format, target });

    const conversion = await Conversion.init({
      input,
      output,
      trim: {
        start: startTime > 0 ? startTime : undefined,
        end: endTime > 0 ? endTime : undefined,
      },
    });

    let lastTime = performance.now();
    let lastBytes = 0;
    let totalWritten = 0;

    target.on('write', ({ end }) => {
      totalWritten = Math.max(totalWritten, end);
    });

    conversion.onProgress = (prog) => {
      const now = performance.now();
      const elapsed = (now - lastTime) / 1000;
      let speedMBs = 0;
      if (elapsed > 0.5) {
        speedMBs = ((totalWritten - lastBytes) / (1024 * 1024)) / elapsed;
        lastTime = now;
        lastBytes = totalWritten;
      }
      onProgress({
        percentage: Math.min(99, Math.round(prog * 100)),
        statusText: `กำลังตัดวิดีโอ (${Math.round(prog * 100)}%)...`,
        speedMBs,
        log: `[TRIM PROGRESS] ${(prog * 100).toFixed(1)}% complete, written: ${(totalWritten / (1024 * 1024)).toFixed(2)} MB`
      });
    };

    await conversion.execute();

    let blobUrl: string | undefined;
    if (target instanceof BufferTarget && target.buffer) {
      const isMp4 = file.name.toLowerCase().endsWith('.mp4');
      const blob = new Blob([target.buffer], { type: isMp4 ? 'video/mp4' : 'video/webm' });
      blobUrl = URL.createObjectURL(blob);
      totalWritten = target.buffer.byteLength;
    }

    onProgress({
      percentage: 100,
      statusText: 'ตัดไฟล์วิดีโอสำเร็จเรียบร้อย!',
      speedMBs: 0,
      log: `[DONE] Trim finished successfully! Total written: ${(totalWritten / (1024 * 1024)).toFixed(2)} MB`
    });
    return { success: true, totalBytesWritten: totalWritten, blobUrl };
  } catch (err: any) {
    console.error('Mediabunny Trim Error:', err);
    onProgress({
      percentage: 0,
      statusText: `เกิดข้อผิดพลาด: ${err?.message || err}`,
      speedMBs: 0,
      log: `[ERROR] Trim failed: ${err?.message || err}\n${err?.stack || ''}`
    });
    throw err;
  }
}

/**
 * Mediabunny Stream Remux Engine (Repairs containers, fixes moov/cues/faststart without transcode)
 */
async function processMediabunnyRemuxStream(
  file: File,
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  try {
    onProgress({
      percentage: 2,
      statusText: 'กำลังเตรียม Input และสร้าง Pipeline การรีมิกซ์...',
      speedMBs: 0,
      log: `[INIT] Starting Remux/FastStart: ${file.name}`
    });

    const input = new Input({
      source: new BlobSource(file),
      formats: ALL_FORMATS,
    });

    const format = getOutputFormatForFile(file.name);
    const target = createMediabunnyTarget(writable);
    const output = new Output({ format, target });

    const conversion = await Conversion.init({
      input,
      output,
    });

    let lastTime = performance.now();
    let lastBytes = 0;
    let totalWritten = 0;

    target.on('write', ({ end }) => {
      totalWritten = Math.max(totalWritten, end);
    });

    conversion.onProgress = (prog) => {
      const now = performance.now();
      const elapsed = (now - lastTime) / 1000;
      let speedMBs = 0;
      if (elapsed > 0.5) {
        speedMBs = ((totalWritten - lastBytes) / (1024 * 1024)) / elapsed;
        lastTime = now;
        lastBytes = totalWritten;
      }
      onProgress({
        percentage: Math.min(99, Math.round(prog * 100)),
        statusText: `กำลังรีมิกซ์และซ่อมแซมโครงสร้างไฟล์ (${Math.round(prog * 100)}%)...`,
        speedMBs,
        log: `[REMUX PROGRESS] ${(prog * 100).toFixed(1)}% complete, written: ${(totalWritten / (1024 * 1024)).toFixed(2)} MB`
      });
    };

    await conversion.execute();

    let blobUrl: string | undefined;
    if (target instanceof BufferTarget && target.buffer) {
      const isMp4 = file.name.toLowerCase().endsWith('.mp4');
      const blob = new Blob([target.buffer], { type: isMp4 ? 'video/mp4' : 'video/webm' });
      blobUrl = URL.createObjectURL(blob);
      totalWritten = target.buffer.byteLength;
    }

    onProgress({
      percentage: 100,
      statusText: 'รีมิกซ์โครงสร้างไฟล์สำเร็จเรียบร้อย!',
      speedMBs: 0,
      log: `[DONE] Remux finished successfully! Total written: ${(totalWritten / (1024 * 1024)).toFixed(2)} MB`
    });
    return { success: true, totalBytesWritten: totalWritten, blobUrl };
  } catch (err: any) {
    console.error('Mediabunny Remux Error:', err);
    onProgress({
      percentage: 0,
      statusText: `เกิดข้อผิดพลาด: ${err?.message || err}`,
      speedMBs: 0,
      log: `[ERROR] Remux failed: ${err?.message || err}\n${err?.stack || ''}`
    });
    throw err;
  }
}

/**
 * Mediabunny Multi-File Packet Concat Stream
 */
async function processMediabunnyConcatStream(
  files: File[],
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  try {
    if (!files.length) return { success: false };

    onProgress({
      percentage: 2,
      statusText: `กำลังเตรียมและตรวจสอบโครงสร้าง ${files.length} ไฟล์...`,
      speedMBs: 0,
      log: `[INIT] Starting multi-file concatenation for ${files.length} files.`
    });

    const firstFile = files[0];
    const input0 = new Input({ source: new BlobSource(firstFile), formats: ALL_FORMATS });
    const format = getOutputFormatForFile(firstFile.name);
    const target = createMediabunnyTarget(writable);
    const output = new Output({ format, target });

    const vTracks = await input0.getVideoTracks();
    const aTracks = await input0.getAudioTracks();

    let vSource: EncodedVideoPacketSource | null = null;
    let aSource: EncodedAudioPacketSource | null = null;
    let vDecConfig: any = null;
    let aDecConfig: any = null;

    if (vTracks.length > 0) {
      const vCodec = await vTracks[0].getCodec();
      if (vCodec) {
        vDecConfig = await vTracks[0].getDecoderConfig();
        vSource = new EncodedVideoPacketSource(vCodec);
        output.addVideoTrack(vSource, {
          decoderConfig: vDecConfig ?? undefined,
        });
        onProgress({
          percentage: 4,
          statusText: `พบวิดีโอแทร็ก: ${vCodec}`,
          speedMBs: 0,
          log: `[TRACK] Video track added: codec=${vCodec}, width=${vDecConfig?.codedWidth || 'auto'}, height=${vDecConfig?.codedHeight || 'auto'}`
        });
      }
    }

    if (aTracks.length > 0) {
      const aCodec = await aTracks[0].getCodec();
      if (aCodec) {
        aDecConfig = await aTracks[0].getDecoderConfig();
        aSource = new EncodedAudioPacketSource(aCodec);
        output.addAudioTrack(aSource, {
          decoderConfig: aDecConfig ?? undefined,
        });
        onProgress({
          percentage: 6,
          statusText: `พบออดิโอแทร็ก: ${aCodec}`,
          speedMBs: 0,
          log: `[TRACK] Audio track added: codec=${aCodec}, channels=${aDecConfig?.numberOfChannels || 'auto'}, rate=${aDecConfig?.sampleRate || 'auto'}`
        });
      }
    }

    if (!vSource && !aSource) {
      throw new Error(`ไม่พบแทร็กวิดีโอหรือเสียงที่รองรับในไฟล์ ${firstFile.name}`);
    }

    await output.start();
    onProgress({
      percentage: 8,
      statusText: `เริ่มสตรีมและรวมวิดีโอแบบ Lossless...`,
      speedMBs: 0,
      log: `[STREAM] Output container started successfully.`
    });

    let vOffset = 0;
    let aOffset = 0;
    let totalWritten = 0;
    target.on('write', ({ end }) => {
      totalWritten = Math.max(totalWritten, end);
    });

    let lastTime = performance.now();
    let lastBytes = 0;

    for (let fIdx = 0; fIdx < files.length; fIdx++) {
      const file = files[fIdx];
      onProgress({
        percentage: Math.round(((fIdx) / files.length) * 90) + 8,
        statusText: `กำลังรวมไฟล์ ${fIdx + 1}/${files.length} (${file.name})...`,
        speedMBs: 0,
        log: `[PROCESS] Processing input file ${fIdx + 1}/${files.length}: ${file.name} (size: ${(file.size / (1024 * 1024)).toFixed(2)} MB, base offsets: V=${vOffset.toFixed(3)}s, A=${aOffset.toFixed(3)}s)`
      });

      const input = fIdx === 0 ? input0 : new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
      const curVTracks = await input.getVideoTracks();
      const curATracks = await input.getAudioTracks();

      let maxVEnd = 0;
      let maxAEnd = 0;
      let vPktCount = 0;
      let aPktCount = 0;

      const hasV = vSource && curVTracks.length > 0;
      const hasA = aSource && curATracks.length > 0;

      const curVDecConfig = hasV ? await curVTracks[0].getDecoderConfig() : null;
      const curADecConfig = hasA ? await curATracks[0].getDecoderConfig() : null;

      const vSink = hasV ? new EncodedPacketSink(curVTracks[0]) : null;
      const aSink = hasA ? new EncodedPacketSink(curATracks[0]) : null;

      const vIterator = vSink ? vSink.packets()[Symbol.asyncIterator]() : null;
      const aIterator = aSink ? aSink.packets()[Symbol.asyncIterator]() : null;

      let nextV = vIterator ? await vIterator.next() : { done: true, value: undefined };
      let nextA = aIterator ? await aIterator.next() : { done: true, value: undefined };

      let isFirstVInFile = true;
      let isFirstAInFile = true;

      // Interleave video and audio packets strictly in chronological order
      while (!nextV.done || !nextA.done) {
        const vTime = (!nextV.done && nextV.value) ? (nextV.value.timestamp + vOffset) : Infinity;
        const aTime = (!nextA.done && nextA.value) ? (nextA.value.timestamp + aOffset) : Infinity;

        if (vTime <= aTime && !nextV.done && nextV.value) {
          const pkt = nextV.value;
          const shifted = new EncodedPacket(
            pkt.data,
            pkt.type,
            vTime,
            pkt.duration,
            pkt.sequenceNumber,
            pkt.byteLength,
            pkt.sideData
          );
          if (isFirstVInFile && (curVDecConfig || vDecConfig)) {
            await vSource!.add(shifted, { decoderConfig: (curVDecConfig || vDecConfig) });
            isFirstVInFile = false;
          } else {
            await vSource!.add(shifted);
          }
          vPktCount++;
          const pktEnd = pkt.timestamp + (pkt.duration || 0);
          if (pktEnd > maxVEnd) maxVEnd = pktEnd;

          nextV = await vIterator!.next();
        } else if (!nextA.done && nextA.value) {
          const pkt = nextA.value;
          // In audio tracks, the first packet must be 'key', but subsequent audio packets should be 'delta'
          // so Muxer doesn't treat every audio frame as a new GOP boundary causing timestamp validation errors.
          const audioPktType = (fIdx === 0 && isFirstAInFile) ? 'key' : 'delta';
          const shifted = new EncodedPacket(
            pkt.data,
            audioPktType,
            aTime,
            pkt.duration,
            pkt.sequenceNumber,
            pkt.byteLength,
            pkt.sideData
          );
          if (isFirstAInFile && (curADecConfig || aDecConfig)) {
            await aSource!.add(shifted, { decoderConfig: (curADecConfig || aDecConfig) });
            isFirstAInFile = false;
          } else {
            await aSource!.add(shifted);
          }
          aPktCount++;
          const pktEnd = pkt.timestamp + (pkt.duration || 0);
          if (pktEnd > maxAEnd) maxAEnd = pktEnd;

          nextA = await aIterator!.next();
        }
      }

      const now = performance.now();
      const elapsed = (now - lastTime) / 1000;
      let speedMBs = 0;
      if (elapsed > 0.5) {
        speedMBs = ((totalWritten - lastBytes) / (1024 * 1024)) / elapsed;
        lastTime = now;
        lastBytes = totalWritten;
      }

      onProgress({
        percentage: Math.round(((fIdx + 1) / files.length) * 90) + 8,
        statusText: `รวมไฟล์ที่ ${fIdx + 1}/${files.length} เสร็จ (${file.name})`,
        speedMBs,
        log: `[DONE FILE] ${file.name}: ${vPktCount} video packets (${maxVEnd.toFixed(3)}s), ${aPktCount} audio packets (${maxAEnd.toFixed(3)}s)`
      });

      const segmentDuration = Math.max(maxVEnd, maxAEnd);
      vOffset += maxVEnd > 0 ? maxVEnd : segmentDuration;
      aOffset += maxAEnd > 0 ? maxAEnd : segmentDuration;
    }

    if (vSource) vSource.close();
    if (aSource) aSource.close();
    await output.finalize();

    let blobUrl: string | undefined;
    if (target instanceof BufferTarget && target.buffer) {
      const isMp4 = firstFile.name.toLowerCase().endsWith('.mp4');
      const blob = new Blob([target.buffer], { type: isMp4 ? 'video/mp4' : 'video/webm' });
      blobUrl = URL.createObjectURL(blob);
      totalWritten = target.buffer.byteLength;
    }

    const finalTotalDuration = Math.max(vOffset, aOffset);
    onProgress({
      percentage: 100,
      statusText: 'รวมไฟล์วิดีโอสำเร็จเรียบร้อย!',
      speedMBs: 0,
      log: `[COMPLETE] Concat finished successfully! Total written: ${(totalWritten / (1024 * 1024)).toFixed(2)} MB, total duration: ${finalTotalDuration.toFixed(3)}s`
    });

    return { success: true, totalBytesWritten: totalWritten || 1, blobUrl };
  } catch (err: any) {
    console.error('Mediabunny Concat Error:', err);
    onProgress({
      percentage: 0,
      statusText: `เกิดข้อผิดพลาด: ${err?.message || err}`,
      speedMBs: 0,
      log: `[ERROR] Concat failed: ${err?.message || err}\n${err?.stack || ''}`
    });
    throw err;
  }
}

/**
 * Standard Process Concat Stream - Unified router for MP4, WebM, MKV
 */
export async function processNativeConcatStream(
  files: File[],
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  try {
    if (!files.length) return { success: false };

    // Detect format of first file
    const firstFormat = await detectMediaFormat(files[0]);
    onProgress({
      percentage: 1,
      statusText: `ตรวจพบฟอร์แมตไฟล์: ${firstFormat.toUpperCase()}`,
      speedMBs: 0,
      log: `[DETECT] Detected input container format: ${firstFormat.toUpperCase()}`
    });

    if (firstFormat === 'webm' || firstFormat === 'mkv') {
      onProgress({
        percentage: 2,
        statusText: `ใช้งาน Native Zero-RAM EBML Engine สำหรับ ${firstFormat.toUpperCase()}...`,
        speedMBs: 0,
        log: `[ENGINE] Selected Native Zero-RAM EBML Streaming Engine for ${firstFormat.toUpperCase()} files`
      });
      try {
        return await processNativeEBMLConcatStream(files, writable, onProgress);
      } catch (nativeErr) {
        console.warn("Native EBML concat failed, falling back to Mediabunny:", nativeErr);
        onProgress({
          percentage: 5,
          statusText: 'สลับไปยัง Mediabunny Engine (Fallback)...',
          speedMBs: 0,
          log: `[FALLBACK] Native EBML engine error, switching to Mediabunny: ${nativeErr}`
        });
        return await processMediabunnyConcatStream(files, writable, onProgress);
      }
    }

    // For MP4 / MOV / TS and other formats, use Mediabunny
    return await processMediabunnyConcatStream(files, writable, onProgress);
  } catch (error) {
    console.error("Concat Stream Router Error:", error);
    return { success: false };
  }
}

async function processNativeEBMLConcatStream(
  files: File[],
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  try {
    const fileMetas: FileMeta[] = [];
    let totalDurationMs = 0;
    for (let i = 0; i < files.length; i++) {
        const meta = await parseWebMFile(files[i]);
        fileMetas.push(meta);
        totalDurationMs += meta.fileDurationMs;
    }

    let totalBytesWritten = 0;
    let segmentDataOffset = 0;
    const cuePoints: { time: number, offset: number }[] = [];
    
    // Write Base Headers from first file
    const firstMeta = fileMetas[0];
    
    // Patch the Duration in SegmentInfo for Standard Compliance
    const patchedSegmentInfo = new Uint8Array(firstMeta.segmentInfo);
    const infoHdr = readElementHeader(patchedSegmentInfo, 0);
    if (infoHdr) {
        let pos = infoHdr.totalHeaderLen;
        while (pos < patchedSegmentInfo.length) {
            const el = readElementHeader(patchedSegmentInfo, pos);
            if (!el) break;
            if (el.idHex === '4489') { // ID_DURATION
                const durationVal = (totalDurationMs * 1000000) / firstMeta.timecodeScale;
                const view = new DataView(patchedSegmentInfo.buffer, patchedSegmentInfo.byteOffset + pos + el.totalHeaderLen, el.size);
                if (el.size === 4) view.setFloat32(0, durationVal);
                else if (el.size === 8) view.setFloat64(0, durationVal);
            }
            pos += el.totalHeaderLen + el.size;
        }
    }

    let seekHeadOffset = 0;
    let videoTrackNum = 1;
    if (firstMeta) {
        videoTrackNum = getVideoTrackNumber(firstMeta.segmentTracks);
    }

    if (writable) {
        await writable.write(firstMeta.ebmlHeader);
        totalBytesWritten += firstMeta.ebmlHeader.length;
        
        // We write Segment ID with Unknown Size (0x01FFFFFFFFFFFFFF)
        const segId = new Uint8Array([0x18, 0x53, 0x80, 0x67]);
        const segSize = new Uint8Array([0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);
        await writable.write(segId);
        await writable.write(segSize);
        totalBytesWritten += segId.length + segSize.length;

        segmentDataOffset = totalBytesWritten;

        seekHeadOffset = totalBytesWritten;
        const dummySeekHead = buildSeekHead(0);
        await writable.write(dummySeekHead);
        totalBytesWritten += dummySeekHead.length;

        await writable.write(patchedSegmentInfo);
        totalBytesWritten += patchedSegmentInfo.length;

        await writable.write(firstMeta.segmentTracks);
        totalBytesWritten += firstMeta.segmentTracks.length;
    }

    let globalTimecodeOffset = 0;
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks for streaming

    for (let fIdx = 0; fIdx < files.length; fIdx++) {
        const file = files[fIdx];
        const meta = fileMetas[fIdx];
        let fileMaxFrameTc = 0;

        for (let cIdx = 0; cIdx < meta.clusters.length; cIdx++) {
            const cluster = meta.clusters[cIdx];
            const newTc = cluster.timecode + globalTimecodeOffset;
            
            // Calculate absolute frame max in this cluster for accurate offset calculation
            const clusterMaxTc = await getClusterMaxFrameTimecode(file, cluster);
            if (clusterMaxTc > fileMaxFrameTc) fileMaxFrameTc = clusterMaxTc;

            // Stream Cluster to output, patching the timecode
            if (writable) {
                cuePoints.push({ time: newTc, offset: totalBytesWritten - segmentDataOffset });
                
                // Encode new Timecode value dynamically to avoid byte overflow
                const newTcValBuf = encodeUint(newTc);
                const newTcSizeVint = encodeVintSize(newTcValBuf.length);
                const newTcElementLength = 1 + newTcSizeVint.length + newTcValBuf.length;

                // Calculate the new Cluster Size
                const sizeDiff = newTcElementLength - cluster.timecodeLength;
                const newClusterPayloadSize = cluster.size === -1 ? -1 : (cluster.size - cluster.headerLen + sizeDiff);

                // Write patched Cluster Header
                const clusterId = new Uint8Array([0x1F, 0x43, 0xB6, 0x75]);
                const clusterSizeVint = encodeVintSize(newClusterPayloadSize);
                await writable.write(clusterId);
                await writable.write(clusterSizeVint);
                totalBytesWritten += clusterId.length + clusterSizeVint.length;

                // Write from after cluster header up to timecode offset
                const preTcSize = cluster.timecodeOffset - (cluster.offset + cluster.headerLen);
                if (preTcSize > 0) {
                    const preTcBuf = await readSlice(file, cluster.offset + cluster.headerLen, preTcSize);
                    await writable.write(preTcBuf);
                    totalBytesWritten += preTcBuf.length;
                }

                // Write the new Timecode element
                await writable.write(new Uint8Array([0xE7]));
                await writable.write(newTcSizeVint);
                await writable.write(newTcValBuf);
                totalBytesWritten += 1 + newTcSizeVint.length + newTcValBuf.length;

                // Stream the rest of the cluster
                const restOffset = cluster.timecodeOffset + cluster.timecodeLength;
                const restSize = cluster.size === -1 ? (file.size - restOffset) : (cluster.offset + cluster.size - restOffset);
                
                let streamPos = restOffset;
                const streamEnd = restOffset + restSize;
                
                while (streamPos < streamEnd) {
                    const toRead = Math.min(CHUNK_SIZE, streamEnd - streamPos);
                    const chunk = await readSlice(file, streamPos, toRead);
                    await writable.write(chunk);
                    totalBytesWritten += chunk.length;
                    streamPos += chunk.length;
                }
            }
            
            // Update Progress
            const overallProg = ((fIdx / files.length) + ((cIdx + 1) / meta.clusters.length) * (1 / files.length)) * 100;
            onProgress({ percentage: overallProg, statusText: `กำลังรวมไฟล์ที่ ${fIdx + 1}/${files.length}... (Standard Engine)`, speedMBs: 0 });
        }

        // Advance global timecode offset
        // Ensure strictly monotonic timestamps, adding 33ms (1 frame at 30fps) to avoid gaps/stalls
        if (fileMaxFrameTc > 0) {
            globalTimecodeOffset += fileMaxFrameTc + 33;
        } else if (meta.fileDurationMs > 0) {
            globalTimecodeOffset += meta.fileDurationMs;
        }
    }

    if (writable && cuePoints.length > 0) {
        onProgress({ percentage: 99, statusText: 'กำลังสร้างสารบัญ (Cues Index)...', speedMBs: 0 });
        const cuesOffset = totalBytesWritten - segmentDataOffset;
        const cuesBuffer = buildCuesElement(cuePoints, videoTrackNum);
        await writable.write(cuesBuffer);
        totalBytesWritten += cuesBuffer.length;
        
        try {
            const actualSeekHead = buildSeekHead(cuesOffset);
            await writable.write({ type: 'write', position: seekHeadOffset, data: actualSeekHead });

            const totalSegmentSize = totalBytesWritten - segmentDataOffset;
            const actualSegmentSize = writeVint(totalSegmentSize, 8);
            await writable.write({ type: 'write', position: firstMeta.ebmlHeader.length + 4, data: actualSegmentSize });
        } catch (seekErr) {
            console.warn("SeekHead or SegmentSize update failed:", seekErr);
        }
    }

    onProgress({ percentage: 100, statusText: 'สำเร็จ! (Standard Engine)', speedMBs: 0 });
    return { success: true, totalBytesWritten };
  } catch (error) {
    console.error("Concat Stream Error:", error);
    return { success: false };
  }
}

/**
 * Standard Process Trim Stream - Unified router for MP4, WebM, MKV
 */
export async function processNativeTrimStream(
  file: File,
  startTime: number,
  endTime: number,
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  try {
     const format = await detectMediaFormat(file);

     if (format === 'webm' || format === 'mkv') {
       onProgress({
         percentage: 2,
         statusText: `ใช้งาน Native Zero-RAM EBML Engine สำหรับตัดไฟล์ ${format.toUpperCase()}...`,
         speedMBs: 0,
         log: `[ENGINE] Selected Native Zero-RAM EBML Streaming Engine for ${format.toUpperCase()} trim`
       });
       try {
         return await executeNativeEBMLTrimStream(file, startTime, endTime, writable, onProgress);
       } catch (nativeErr) {
         console.warn("Native EBML trim failed, falling back to Mediabunny:", nativeErr);
         onProgress({
           percentage: 5,
           statusText: 'สลับไปยัง Mediabunny Engine (Fallback)...',
           speedMBs: 0,
           log: `[FALLBACK] Native EBML trim error, switching to Mediabunny: ${nativeErr}`
         });
         return await processMediabunnyTrimStream(file, startTime, endTime, writable, onProgress);
       }
     }

     return await processMediabunnyTrimStream(file, startTime, endTime, writable, onProgress);
  } catch (err) {
     console.error("Trim Stream Error:", err);
     return { success: false };
  }
}

async function executeNativeEBMLTrimStream(
  file: File,
  startTime: number,
  endTime: number,
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  try {
     onProgress({ percentage: 0, statusText: 'กำลังวิเคราะห์โครงสร้างไฟล์เพื่อตัดวิดีโอ (Standard Engine)...', speedMBs: 0 });
     
     const meta = await parseWebMFile(file);
     let totalBytesWritten = 0;
     let segmentDataOffset = 0;
     const cuePoints: { time: number, offset: number }[] = [];

     const startMs = startTime * 1000;
     const endMs = endTime * 1000;
     const CHUNK_SIZE = 1024 * 1024;

     // Patch the Duration in SegmentInfo for Standard Compliance
     const patchedSegmentInfo = new Uint8Array(meta.segmentInfo);
     const infoHdr = readElementHeader(patchedSegmentInfo, 0);
     if (infoHdr) {
         let pos = infoHdr.totalHeaderLen;
         while (pos < patchedSegmentInfo.length) {
            const el = readElementHeader(patchedSegmentInfo, pos);
            if (!el) break;
            if (el.idHex === '4489') { // ID_DURATION
                const durationMs = endMs - startMs;
                const durationVal = (durationMs * 1000000) / meta.timecodeScale;
                
                const view = new DataView(patchedSegmentInfo.buffer, patchedSegmentInfo.byteOffset + pos + el.totalHeaderLen, el.size);
                if (el.size === 4) view.setFloat32(0, durationVal);
                else if (el.size === 8) view.setFloat64(0, durationVal);
            }
            pos += el.totalHeaderLen + el.size;
         }
     }

     let seekHeadOffset = 0;
     let videoTrackNum = getVideoTrackNumber(meta.segmentTracks);

     if (writable) {
        await writable.write(meta.ebmlHeader);
        totalBytesWritten += meta.ebmlHeader.length;
        
        const segId = new Uint8Array([0x18, 0x53, 0x80, 0x67]);
        const segSize = new Uint8Array([0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);
        await writable.write(segId);
        await writable.write(segSize);
        totalBytesWritten += segId.length + segSize.length;
        
        segmentDataOffset = totalBytesWritten;

        seekHeadOffset = totalBytesWritten;
        const dummySeekHead = buildSeekHead(0);
        await writable.write(dummySeekHead);
        totalBytesWritten += dummySeekHead.length;

        await writable.write(patchedSegmentInfo);
        totalBytesWritten += patchedSegmentInfo.length;

        await writable.write(meta.segmentTracks);
        totalBytesWritten += meta.segmentTracks.length;
     }

     let firstIncludedTimecode = -1;

     for (let cIdx = 0; cIdx < meta.clusters.length; cIdx++) {
         const cluster = meta.clusters[cIdx];
         
         // Standard compliant exact filtering
         if (cluster.timecode > endMs) break; 
         
         const clusterMaxTc = await getClusterMaxFrameTimecode(file, cluster);
         if (clusterMaxTc < startMs) continue; // Before start time

         if (firstIncludedTimecode === -1) {
             firstIncludedTimecode = cluster.timecode;
         }

         const newTc = cluster.timecode - firstIncludedTimecode;
         if (newTc < 0) continue; // Safety check

         if (writable) {
             cuePoints.push({ time: newTc, offset: totalBytesWritten - segmentDataOffset });
             // Encode new Timecode value dynamically to avoid byte overflow
             const newTcValBuf = encodeUint(newTc);
             const newTcSizeVint = encodeVintSize(newTcValBuf.length);
             const newTcElementLength = 1 + newTcSizeVint.length + newTcValBuf.length;

             // Calculate the new Cluster Size
             const sizeDiff = newTcElementLength - cluster.timecodeLength;
             const newClusterPayloadSize = cluster.size === -1 ? -1 : (cluster.size - cluster.headerLen + sizeDiff);

             // Write patched Cluster Header
             const clusterId = new Uint8Array([0x1F, 0x43, 0xB6, 0x75]);
             const clusterSizeVint = encodeVintSize(newClusterPayloadSize);
             await writable.write(clusterId);
             await writable.write(clusterSizeVint);
             totalBytesWritten += clusterId.length + clusterSizeVint.length;

             // Write from after cluster header up to timecode offset
             const preTcSize = cluster.timecodeOffset - (cluster.offset + cluster.headerLen);
             if (preTcSize > 0) {
                 const preTcBuf = await readSlice(file, cluster.offset + cluster.headerLen, preTcSize);
                 await writable.write(preTcBuf);
                 totalBytesWritten += preTcBuf.length;
             }

             // Write the new Timecode element
             await writable.write(new Uint8Array([0xE7]));
             await writable.write(newTcSizeVint);
             await writable.write(newTcValBuf);
             totalBytesWritten += 1 + newTcSizeVint.length + newTcValBuf.length;

             const restOffset = cluster.timecodeOffset + cluster.timecodeLength;
             const restSize = cluster.size === -1 ? (file.size - restOffset) : (cluster.offset + cluster.size - restOffset);
             
             let streamPos = restOffset;
             const streamEnd = restOffset + restSize;
             
             while (streamPos < streamEnd) {
                 const toRead = Math.min(CHUNK_SIZE, streamEnd - streamPos);
                 const chunk = await readSlice(file, streamPos, toRead);
                 await writable.write(chunk);
                 totalBytesWritten += chunk.length;
                 streamPos += chunk.length;
             }
         }

         const prog = (cIdx / meta.clusters.length) * 100;
         onProgress({ percentage: prog, statusText: 'กำลังตัดและสตรีมวิดีโอ (Standard Engine)...', speedMBs: 0 });
     }

     if (writable && cuePoints.length > 0) {
         onProgress({ percentage: 99, statusText: 'กำลังสร้างสารบัญ (Cues Index)...', speedMBs: 0 });
         const cuesOffset = totalBytesWritten - segmentDataOffset;
         const cuesBuffer = buildCuesElement(cuePoints, videoTrackNum);
         await writable.write(cuesBuffer);
         totalBytesWritten += cuesBuffer.length;
         
         try {
             const actualSeekHead = buildSeekHead(cuesOffset);
             await writable.write({ type: 'write', position: seekHeadOffset, data: actualSeekHead });

             const totalSegmentSize = totalBytesWritten - segmentDataOffset;
             const actualSegmentSize = writeVint(totalSegmentSize, 8);
             await writable.write({ type: 'write', position: meta.ebmlHeader.length + 4, data: actualSegmentSize });
         } catch (seekErr) {
             console.warn("SeekHead update failed:", seekErr);
         }
     }

     onProgress({ percentage: 100, statusText: 'ตัดไฟล์สำเร็จ! (Standard Engine)', speedMBs: 0 });
     return { success: true, totalBytesWritten };
  } catch (err) {
     console.error("Trim Stream Error:", err);
     return { success: false };
  }
}

/**
 * Standard Process Remux Stream - Unified router for MP4, WebM, MKV
 */
export async function processNativeRemuxStream(
  file: File,
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  try {
     const format = await detectMediaFormat(file);

     if (format === 'webm' || format === 'mkv') {
       onProgress({
         percentage: 2,
         statusText: `ใช้งาน Native Zero-RAM EBML Engine สำหรับซ่อมแซมไฟล์ ${format.toUpperCase()}...`,
         speedMBs: 0,
         log: `[ENGINE] Selected Native Zero-RAM EBML Streaming Engine for ${format.toUpperCase()} remux`
       });
       try {
         return await executeNativeEBMLRemuxStream(file, writable, onProgress);
       } catch (nativeErr) {
         console.warn("Native EBML remux failed, falling back to Mediabunny:", nativeErr);
         onProgress({
           percentage: 5,
           statusText: 'สลับไปยัง Mediabunny Engine (Fallback)...',
           speedMBs: 0,
           log: `[FALLBACK] Native EBML remux error, switching to Mediabunny: ${nativeErr}`
         });
         return await processMediabunnyRemuxStream(file, writable, onProgress);
       }
     }

     return await processMediabunnyRemuxStream(file, writable, onProgress);
  } catch (err) {
     console.error("Remux Stream Router Error:", err);
     return { success: false };
  }
}

async function executeNativeEBMLRemuxStream(
  file: File,
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  try {
     onProgress({ percentage: 0, statusText: 'กำลังวิเคราะห์โครงสร้างไฟล์เพื่อซ่อมแซม (Standard Remux Engine)...', speedMBs: 0 });
     
     const meta = await parseWebMFile(file);
     let totalBytesWritten = 0;
     let segmentDataOffset = 0;
     const cuePoints: { time: number, offset: number }[] = [];

     const CHUNK_SIZE = 1024 * 1024;

     // Patch the Duration in SegmentInfo for Standard Compliance
     const patchedSegmentInfo = new Uint8Array(meta.segmentInfo);
     const infoHdr = readElementHeader(patchedSegmentInfo, 0);
     if (infoHdr) {
         let pos = infoHdr.totalHeaderLen;
         while (pos < patchedSegmentInfo.length) {
            const el = readElementHeader(patchedSegmentInfo, pos);
            if (!el) break;
            if (el.idHex === '4489') { // ID_DURATION
                const durationVal = (meta.fileDurationMs * 1000000) / meta.timecodeScale;
                const view = new DataView(patchedSegmentInfo.buffer, patchedSegmentInfo.byteOffset + pos + el.totalHeaderLen, el.size);
                if (el.size === 4) view.setFloat32(0, durationVal);
                else if (el.size === 8) view.setFloat64(0, durationVal);
            }
            pos += el.totalHeaderLen + el.size;
         }
     }

     let seekHeadOffset = 0;
     let videoTrackNum = getVideoTrackNumber(meta.segmentTracks);

     if (writable) {
        await writable.write(meta.ebmlHeader);
        totalBytesWritten += meta.ebmlHeader.length;
        
        const segId = new Uint8Array([0x18, 0x53, 0x80, 0x67]);
        const segSize = new Uint8Array([0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);
        await writable.write(segId);
        await writable.write(segSize);
        totalBytesWritten += segId.length + segSize.length;
        
        segmentDataOffset = totalBytesWritten;

        seekHeadOffset = totalBytesWritten;
        const dummySeekHead = buildSeekHead(0);
        await writable.write(dummySeekHead);
        totalBytesWritten += dummySeekHead.length;

        await writable.write(patchedSegmentInfo);
        totalBytesWritten += patchedSegmentInfo.length;

        await writable.write(meta.segmentTracks);
        totalBytesWritten += meta.segmentTracks.length;
     }

     let firstIncludedTimecode = -1;

     for (let cIdx = 0; cIdx < meta.clusters.length; cIdx++) {
         const cluster = meta.clusters[cIdx];
         
         if (firstIncludedTimecode === -1) {
             firstIncludedTimecode = cluster.timecode;
         }

         const newTc = cluster.timecode - firstIncludedTimecode;
         if (newTc < 0) continue; // Safety check

         if (writable) {
             cuePoints.push({ time: newTc, offset: totalBytesWritten - segmentDataOffset });
             // Encode new Timecode value dynamically to avoid byte overflow
             const newTcValBuf = encodeUint(newTc);
             const newTcSizeVint = encodeVintSize(newTcValBuf.length);
             const newTcElementLength = 1 + newTcSizeVint.length + newTcValBuf.length;

             // Calculate the new Cluster Size
             const sizeDiff = newTcElementLength - cluster.timecodeLength;
             const newClusterPayloadSize = cluster.size === -1 ? -1 : (cluster.size - cluster.headerLen + sizeDiff);

             // Write patched Cluster Header
             const clusterId = new Uint8Array([0x1F, 0x43, 0xB6, 0x75]);
             const clusterSizeVint = encodeVintSize(newClusterPayloadSize);
             await writable.write(clusterId);
             await writable.write(clusterSizeVint);
             totalBytesWritten += clusterId.length + clusterSizeVint.length;

             // Write from after cluster header up to timecode offset
             const preTcSize = cluster.timecodeOffset - (cluster.offset + cluster.headerLen);
             if (preTcSize > 0) {
                 const preTcBuf = await readSlice(file, cluster.offset + cluster.headerLen, preTcSize);
                 await writable.write(preTcBuf);
                 totalBytesWritten += preTcBuf.length;
             }

             // Write the new Timecode element
             await writable.write(new Uint8Array([0xE7]));
             await writable.write(newTcSizeVint);
             await writable.write(newTcValBuf);
             totalBytesWritten += 1 + newTcSizeVint.length + newTcValBuf.length;

             const restOffset = cluster.timecodeOffset + cluster.timecodeLength;
             const restSize = cluster.size === -1 ? (file.size - restOffset) : (cluster.offset + cluster.size - restOffset);
             
             let streamPos = restOffset;
             const streamEnd = restOffset + restSize;
             
             while (streamPos < streamEnd) {
                 const toRead = Math.min(CHUNK_SIZE, streamEnd - streamPos);
                 const chunk = await readSlice(file, streamPos, toRead);
                 await writable.write(chunk);
                 totalBytesWritten += chunk.length;
                 streamPos += chunk.length;
             }
         }

         const prog = (cIdx / meta.clusters.length) * 100;
         onProgress({ percentage: prog, statusText: 'กำลังรีมิกซ์โครงสร้างไฟล์ (Standard Remux)...', speedMBs: 0 });
     }

     if (writable && cuePoints.length > 0) {
         onProgress({ percentage: 99, statusText: 'กำลังสร้างสารบัญ (Cues Index)...', speedMBs: 0 });
         const cuesOffset = totalBytesWritten - segmentDataOffset;
         const cuesBuffer = buildCuesElement(cuePoints, videoTrackNum);
         await writable.write(cuesBuffer);
         totalBytesWritten += cuesBuffer.length;
         
         try {
             const actualSeekHead = buildSeekHead(cuesOffset);
             await writable.write({ type: 'write', position: seekHeadOffset, data: actualSeekHead });

             const totalSegmentSize = totalBytesWritten - segmentDataOffset;
             const actualSegmentSize = writeVint(totalSegmentSize, 8);
             await writable.write({ type: 'write', position: meta.ebmlHeader.length + 4, data: actualSegmentSize });
         } catch (seekErr) {
             console.warn("SeekHead update failed:", seekErr);
         }
     }

     onProgress({ percentage: 100, statusText: 'รีมิกซ์ไฟล์สำเร็จ! (Standard Remux)', speedMBs: 0 });
     return { success: true, totalBytesWritten };
  } catch (err) {
     console.error("Remux Stream Error:", err);
     return { success: false };
  }
}
