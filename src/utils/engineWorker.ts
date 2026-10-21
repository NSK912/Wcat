import { EditSettings, ClipTransform, TimelineTrackData, TimelineClip, SampleVideo } from '../types';
import { HardwareBlurEngine } from './HardwareBlur';
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
  VideoSample,
  AudioSample,
  Quality,
  canEncodeVideo,
  canEncodeAudio,
  AudioSampleSink,
  AudioSampleSource,
  VideoSampleSink,
  VideoSampleSource,
  OutputTrackGroup,
  probeMediaMetadata,
  NativeAudioSink,
  SimpleAudioBuffer,
  type StreamTargetChunk,
  type VideoCodec,
  type AudioCodec,
  type QualityLevel,
} from './nativeMedia';


export interface FileValidationResult {
  valid: boolean;
  error?: string;
  duration?: number;
}

/**
 * Validates whether a file is valid media before any URL.createObjectURL or <video> element
 * or demuxer touches it. This prevents browser Aw, Snap! tab renderer crashes caused by corrupted
 * atom boxes, zero sizes, or malformed container headers.
 */
export async function validateMediaFile(file: File): Promise<FileValidationResult> {
  // 1. Basic size sanity check
  if (!file || file.size === 0) {
    return { valid: false, error: 'The file is empty (0 bytes).' };
  }

  // 2. Images: fast lightweight probe
  if (file.type.startsWith('image/')) {
    return { valid: true, duration: 5 };
  }

  // 3. Fast binary container sanity check (Pre-flight Quarantine)
  // Read first 64KB to verify container header integrity
  try {
    const headChunk = await file.slice(0, Math.min(file.size, 65536)).arrayBuffer();
    const bytes = new Uint8Array(headChunk);

    if (bytes.length < 8) {
      return { valid: false, error: 'The file is too small or incomplete.' };
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isMp4OrMov = ext === 'mp4' || ext === 'm4v' || ext === 'mov' || file.type.includes('mp4') || file.type.includes('quicktime');

    if (isMp4OrMov) {
      let offset = 0;
      let validBoxesFound = 0;

      while (offset + 8 <= bytes.length) {
        const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
        const boxSize = view.getUint32(0);
        const boxType = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);

        if (boxSize === 0) {
          if (offset === 0) {
            return { valid: false, error: 'Corrupted video structure (Zero box header size).' };
          }
          break;
        }

        const isAsciiType = /^[a-zA-Z0-9_]{4}$/.test(boxType);
        if (!isAsciiType) {
          if (validBoxesFound === 0) {
            return { valid: false, error: 'Corrupted video file or non-standard MP4/MOV format.' };
          }
          break;
        }

        validBoxesFound++;
        if (boxSize < 8) {
          return { valid: false, error: 'Corrupted video structure (Box size less than 8 bytes).' };
        }

        offset += boxSize;
      }

      if (validBoxesFound === 0) {
        return { valid: false, error: 'Video header not found (file may be corrupted).' };
      }
    } else if (ext === 'webm' || ext === 'mkv' || file.type.includes('webm') || file.type.includes('matroska')) {
      if (!(bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3)) {
        return { valid: false, error: 'Corrupted WebM/MKV file (EBML header not found).' };
      }
    }
  } catch (err: any) {
    return { valid: false, error: `Failed to read file data: ${err?.message || 'unknown error'}` };
  }

  // 4. Proprietary Native Demuxer probe (direct, exact, and non-blocking)
  const nativeProbePromise = (async () => {
    try {
      const meta = await probeMediaMetadata(file);
      if (meta.duration && Number.isFinite(meta.duration) && meta.duration > 0) {
        return { valid: true, duration: meta.duration };
      }
      return { valid: true, duration: meta.duration || 0 };
    } catch (e: any) {
      return { valid: false, error: `File decoding failed: ${e?.message || 'media data is corrupted'}` };
    }
  })();

  return await nativeProbePromise;
}



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
          if (typeof chunk.position === 'number') {
            await (writable as any).write({ type: 'write', position: chunk.position, data: chunk.data });
          } else {
            await (writable as any).write(chunk.data || chunk);
          }
        } catch (err) {
          try {
            if (typeof (writable as any).seek === 'function' && typeof chunk.position === 'number') {
              await (writable as any).seek(chunk.position);
            }
            await (writable as any).write(chunk.data || chunk);
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
 * Determines output format instance based on filename or format
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

interface DiagnosticContext {
  operation: 'Trim' | 'Remux' | 'Concat';
  engine: 'Mediabunny' | 'Native EBML' | 'Router';
  files?: File[];
  file?: File;
  stage: string;
  startTime?: number;
  endTime?: number;
  totalWritten?: number;
  lastProgressPct?: number;
  vCodec?: string;
  aCodec?: string;
}

export function reportMediabunnyDetailedError(
  err: any,
  context: DiagnosticContext,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void
) {
  const fileInfo = context.file
    ? `File: "${context.file.name}" (${(context.file.size / (1024 * 1024)).toFixed(2)} MB, type: ${context.file.type || 'unknown'})`
    : context.files
    ? `Files (${context.files.length}): ${context.files.map(f => `"${f.name}" (${(f.size / (1024 * 1024)).toFixed(2)} MB)`).join(', ')}`
    : 'Files: N/A';

  const errMsg = err?.message || String(err);
  const errStack = err?.stack || '';
  const errName = err?.name || 'Error';

  let diagnosis = '';
  let suggestion = '';

  if (errMsg.includes('Timestamps cannot be smaller') || errMsg.includes('GOP') || errMsg.includes('timestamp')) {
    diagnosis = 'Non-monotonic audio/video packet timestamps or out-of-order keyframes detected in container.';
    suggestion = 'The source MP4/MOV file has audio drift or B-frame reordering issues. Try remuxing the file to MKV/WebM first.';
  } else if (errMsg.includes('Decoder') || errMsg.includes('Codec') || errMsg.includes('unsupported') || errMsg.includes('supported')) {
    diagnosis = 'Browser demuxer or output container codec incompatibility.';
    suggestion = 'Your browser WebCodecs demuxer cannot process this specific codec stream without transcoding.';
  } else if (errMsg.includes('Quota') || errMsg.includes('write') || errMsg.includes('disk') || errMsg.includes('FileSystem')) {
    diagnosis = 'Disk write or OPFS storage quota failure.';
    suggestion = 'Verify browser storage permissions and available free disk space.';
  } else if (errMsg.includes('EBML') || errMsg.includes('Header') || errMsg.includes('atom') || errMsg.includes('moov') || errMsg.includes('corrupt')) {
    diagnosis = 'Corrupted or truncated container header/atoms.';
    suggestion = 'The video file header may be missing moov atoms or truncated.';
  } else {
    diagnosis = `Mediabunny pipeline error occurred during ${context.operation} at stage "${context.stage}".`;
    suggestion = 'Review the stack trace below or try processing with a different container format.';
  }

  const lines = [
    `[ERROR STAGE] Pipeline failed at stage: "${context.stage}"`,
    `[ERROR METADATA] Engine: ${context.engine} | Operation: ${context.operation} | Last Progress: ${context.lastProgressPct || 0}%`,
    `[ERROR INPUT] ${fileInfo}`,
    ...(context.vCodec ? [`[TRACK INFO] Video Track Codec: ${context.vCodec}`] : []),
    ...(context.aCodec ? [`[TRACK INFO] Audio Track Codec: ${context.aCodec}`] : []),
    `[WRITTEN DATA] Total written before error: ${((context.totalWritten || 0) / (1024 * 1024)).toFixed(2)} MB`,
    `[ERROR TYPE] ${errName}: ${errMsg}`,
    `[DIAGNOSIS] ${diagnosis}`,
    `[SUGGESTION] ${suggestion}`,
    ...(errStack ? [`[STACK TRACE]\n${errStack}`] : [])
  ];

  for (const line of lines) {
    onProgress({
      percentage: 0,
      statusText: `Error: ${errMsg}`,
      speedMBs: 0,
      log: line
    });
  }
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
  let stage = 'Initializing Input Pipeline';
  let totalWritten = 0;
  let lastProgress = 2;
  let vCodec: string | undefined;
  let aCodec: string | undefined;

  try {
    onProgress({
      percentage: 2,
      statusText: 'Preparing input and trimming pipeline...',
      speedMBs: 0,
      log: `[INIT] Starting Trim: "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB), Range: ${startTime.toFixed(2)}s -> ${endTime.toFixed(2)}s`
    });

    // Strategy 1: Native High-Performance Conversion
    // Preserves B-frame PTS/DTS offsets, faststart moov atoms, and smooth preview playback
    try {
      stage = 'Opening Media Input';
      const input = new Input({
        source: new BlobSource(file),
        formats: ALL_FORMATS,
      });

      stage = 'Demuxing & Inspecting Tracks';
      try {
        const vTracks = await input.getVideoTracks();
        if (vTracks.length > 0) vCodec = (await vTracks[0].getCodec()) || 'unknown';
        const aTracks = await input.getAudioTracks();
        if (aTracks.length > 0) aCodec = (await aTracks[0].getCodec()) || 'unknown';
      } catch (e) {
        // Track inspection optional
      }

      stage = 'Initializing Mediabunny Output Format & Target';
      const format = getOutputFormatForFile(file.name);
      const target = createMediabunnyTarget(writable);
      const output = new Output({ format, target });

      target.on('write', ({ end }) => {
        totalWritten = Math.max(totalWritten, end);
      });

      stage = 'Configuring Mediabunny Conversion';
      let _start = startTime > 0 ? startTime : undefined;
      let _end = endTime > 0 ? endTime : undefined;
      
      const vTracks = await input.getVideoTracks();
      let sourceDur = 0;
      if (vTracks.length > 0) {
          const dur = await vTracks[0].computeDuration();
          if (dur) sourceDur = dur;
      }
      
      if (sourceDur > 0) {
          if (_start !== undefined && _start >= sourceDur) _start = Math.max(0, sourceDur - 0.1);
          if (_end !== undefined && _end > sourceDur) _end = sourceDur;
      }
      if (_start !== undefined && _end !== undefined && _start >= _end) {
          _start = Math.max(0, _end - 0.1);
      }

      const conversion = await Conversion.init({
        input,
        output,
        trim: {
          start: _start,
          end: _end,
        },
      });

      let lastTime = performance.now();
      let lastBytes = 0;

      stage = 'Executing Conversion Stream';
      conversion.onProgress = (prog) => {
        const now = performance.now();
        const elapsed = (now - lastTime) / 1000;
        let speedMBs = 0;
        if (elapsed > 0.5) {
          speedMBs = ((totalWritten - lastBytes) / (1024 * 1024)) / elapsed;
          lastTime = now;
          lastBytes = totalWritten;
        }
        lastProgress = Math.min(99, Math.round(prog * 100));
        onProgress({
          percentage: lastProgress,
          statusText: `Trimming video (${lastProgress}%)...`,
          speedMBs,
          log: `[TRIM PROGRESS] ${lastProgress}% complete, written: ${(totalWritten / (1024 * 1024)).toFixed(2)} MB`
        });
      };

      await conversion.execute();

      stage = 'Creating Final Output Blob / Buffer';
      let blobUrl: string | undefined;
      if (target instanceof BufferTarget && target.buffer) {
        const isMp4 = file.name.toLowerCase().endsWith('.mp4');
        const mime = isMp4 ? 'video/mp4' : file.name.toLowerCase().endsWith('.mkv') ? 'video/x-matroska' : 'video/webm';
        const blob = new Blob([target.buffer], { type: mime });
        blobUrl = URL.createObjectURL(blob);
        totalWritten = target.buffer.byteLength;
      }

      onProgress({
        percentage: 100,
        statusText: 'Video trim completed successfully!',
        speedMBs: 0,
        log: `[DONE] Native trim finished successfully! Total written: ${(totalWritten / (1024 * 1024)).toFixed(2)} MB`
      });

      return { success: true, totalBytesWritten: totalWritten, blobUrl };
    } catch (nativeErr: any) {
      const errMsg = nativeErr?.message || String(nativeErr);
      console.warn('Native Conversion failed, falling back to Packet Repair Stream:', nativeErr);

      onProgress({
        percentage: 5,
        statusText: 'Timestamp drift detected, activating Packet Repair Mode...',
        speedMBs: 0,
        log: `[NOTICE] Native Conversion notice: ${errMsg}. Switching to Packet Repair Stream...`
      });
    }

    // Strategy 2: Fallback Packet Repair Stream for files with non-monotonic timestamps or GOP issues
    totalWritten = 0;
    stage = 'Opening Media Input (Packet Repair)';
    const input = new Input({
      source: new BlobSource(file),
      formats: ALL_FORMATS,
    });

    stage = 'Demuxing & Inspecting Tracks (Packet Repair)';
    const vTracks = await input.getVideoTracks();
    const aTracks = await input.getAudioTracks();

    let vSource: EncodedVideoPacketSource | null = null;
    let aSource: EncodedAudioPacketSource | null = null;
    let vDecConfig: any = null;
    let aDecConfig: any = null;

    if (vTracks.length > 0) {
      vCodec = (await vTracks[0].getCodec()) || 'unknown';
      vDecConfig = await vTracks[0].getDecoderConfig();
      vSource = new EncodedVideoPacketSource(vCodec as any);
    }

    if (aTracks.length > 0) {
      aCodec = (await aTracks[0].getCodec()) || 'unknown';
      aDecConfig = await aTracks[0].getDecoderConfig();
      aSource = new EncodedAudioPacketSource(aCodec as any);
    }

    if (!vSource && !aSource) {
      throw new Error(`No supported video or audio tracks found in file ${file.name}`);
    }

    stage = 'Initializing Mediabunny Output Format & Target (Packet Repair)';
    const format = getOutputFormatForFile(file.name);
    const target = createMediabunnyTarget(writable);
    const output = new Output({ format, target });

    if (vSource) output.addVideoTrack(vSource, { decoderConfig: vDecConfig ?? undefined, fps: vTracks[0]?.trackInfo?.fps || 30, framerate: vTracks[0]?.trackInfo?.fps || 30 });
    if (aSource) output.addAudioTrack(aSource, { decoderConfig: aDecConfig ?? undefined });

    stage = 'Starting Output Writer (Packet Repair)';
    await output.start();

    target.on('write', ({ end }) => {
      totalWritten = Math.max(totalWritten, end);
    });

    stage = 'Processing Packets (Packet Repair)';
    const vSink = vSource && vTracks.length > 0 ? new EncodedPacketSink(vTracks[0]) : null;
    const aSink = aSource && aTracks.length > 0 ? new EncodedPacketSink(aTracks[0]) : null;

    const vIterator = vSink ? vSink.packets()[Symbol.asyncIterator]() : null;
    const aIterator = aSink ? aSink.packets()[Symbol.asyncIterator]() : null;

    let nextV = vIterator ? await vIterator.next() : { done: true, value: undefined };
    let nextA = aIterator ? await aIterator.next() : { done: true, value: undefined };

    let isFirstV = true;
    let isFirstA = true;
    let minVTs: number | null = null;
    let minATs: number | null = null;

    let lastTime = performance.now();
    let lastBytes = 0;

    while (!nextV.done || !nextA.done) {
      const rawVTime = (!nextV.done && nextV.value) ? nextV.value.timestamp : Infinity;
      const rawATime = (!nextA.done && nextA.value) ? nextA.value.timestamp : Infinity;

      if (rawVTime <= rawATime && !nextV.done && nextV.value) {
        const pkt = nextV.value;
        if (pkt.timestamp < startTime) {
          nextV = await vIterator!.next();
          continue;
        }
        if (endTime > 0 && pkt.timestamp > endTime) {
          nextV = { done: true, value: undefined };
          continue;
        }

        if (minVTs === null) minVTs = pkt.timestamp;
        const pTime = Math.max(0, pkt.timestamp - minVTs);

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

        const now = performance.now();
        const elapsed = (now - lastTime) / 1000;
        if (elapsed > 0.5) {
          const speedMBs = ((totalWritten - lastBytes) / (1024 * 1024)) / elapsed;
          lastTime = now;
          lastBytes = totalWritten;
          onProgress({
            percentage: 50,
            statusText: `Trimming video in repair mode...`,
            speedMBs,
            log: `[REPAIR PROGRESS] Time: ${pTime.toFixed(2)}s, written: ${(totalWritten / (1024 * 1024)).toFixed(2)} MB`
          });
        }

        nextV = await vIterator!.next();
      } else if (!nextA.done && nextA.value) {
        const pkt = nextA.value;
        if (pkt.timestamp < startTime) {
          nextA = await aIterator!.next();
          continue;
        }
        if (endTime > 0 && pkt.timestamp > endTime) {
          nextA = { done: true, value: undefined };
          continue;
        }

        if (minATs === null) minATs = pkt.timestamp;
        const pTime = Math.max(0, pkt.timestamp - minATs);

        const audioPktType = isFirstA ? 'key' : 'delta';

        const shifted = new EncodedPacket(
          pkt.data,
          audioPktType,
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

        nextA = await aIterator!.next();
      }
    }

    stage = 'Finalizing Container Output (Packet Repair)';
    if (vSource) vSource.close();
    if (aSource) aSource.close();
    await output.finalize();

    stage = 'Creating Final Output Blob / Buffer';
    let blobUrl: string | undefined;
    if (target instanceof BufferTarget && target.buffer) {
      const isMp4 = file.name.toLowerCase().endsWith('.mp4');
      const blob = new Blob([target.buffer], { type: isMp4 ? 'video/mp4' : 'video/webm' });
      blobUrl = URL.createObjectURL(blob);
      totalWritten = target.buffer.byteLength;
    }

    onProgress({
      percentage: 100,
      statusText: 'Video trim completed with Packet Repair!',
      speedMBs: 0,
      log: `[DONE] Repair trim finished! Total written: ${(totalWritten / (1024 * 1024)).toFixed(2)} MB`
    });

    return { success: true, totalBytesWritten: totalWritten, blobUrl };
  } catch (err: any) {
    console.error('Mediabunny Trim Error:', err);
    reportMediabunnyDetailedError(err, {
      operation: 'Trim',
      engine: 'Mediabunny',
      file,
      stage,
      startTime,
      endTime,
      totalWritten,
      lastProgressPct: lastProgress,
      vCodec,
      aCodec
    }, onProgress);
    throw err;
  }
}

/**
 * Helper to normalize video codecs for Mediabunny muxers
 */
export function normalizeVideoCodec(rawCodec: string | undefined | null): 'avc' | 'hevc' | 'vp9' | 'av1' | 'vp8' | 'prores' | null {
  if (!rawCodec) return null;
  const c = rawCodec.toLowerCase().trim();
  if (c.includes('avc') || c.includes('h264') || c.includes('h.264') || c.startsWith('avc1')) return 'avc';
  if (c.includes('hevc') || c.includes('h265') || c.includes('h.265') || c.startsWith('hev1') || c.startsWith('hvc1')) return 'hevc';
  if (c.includes('vp9') || c.includes('vp09')) return 'vp9';
  if (c.includes('av1') || c.includes('av01')) return 'av1';
  if (c.includes('vp8') || c.includes('vp08')) return 'vp8';
  if (c.includes('prores') || c.startsWith('ap4')) return 'prores';
  return null;
}

/**
 * Helper to normalize audio codecs for Mediabunny muxers
 */
export function normalizeAudioCodec(rawCodec: string | undefined | null): 'aac' | 'opus' | 'mp3' | 'vorbis' | 'flac' | 'ac3' | 'eac3' | 'dts' | 'pcm-s16' | null {
  if (!rawCodec) return null;
  const c = rawCodec.toLowerCase().trim();
  if (c.includes('aac') || c.includes('mp4a')) return 'aac';
  if (c.includes('opus')) return 'opus';
  if (c.includes('mp3')) return 'mp3';
  if (c.includes('vorbis')) return 'vorbis';
  if (c.includes('flac')) return 'flac';
  if (c.includes('ac3') || c.includes('ac-3')) return 'ac3';
  if (c.includes('eac3') || c.includes('ec-3')) return 'eac3';
  if (c.includes('dts')) return 'dts';
  if (c.includes('pcm')) return 'pcm-s16';
  return null;
}

/**
 * Mediabunny Stream Remux Engine (Repairs containers, fixes moov/cues/faststart without transcode)
 * Handles large files (30GB+) with zero RAM buffering and real-time streaming progress
 */
async function processMediabunnyRemuxStream(
  file: File,
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  let stage = 'Initializing Input Pipeline';
  let totalWritten = 0;
  let lastProgress = 2;
  let vCodec: string | undefined;
  let aCodec: string | undefined;

  const fileSizeMB = file.size / (1024 * 1024);

  try {
    onProgress({
      percentage: 2,
      statusText: 'Preparing input and remux pipeline...',
      speedMBs: 0,
      log: `[STAGE 1/3] Initializing Remux Pipeline for "${file.name}" (${fileSizeMB.toFixed(2)} MB)`
    });

    // =========================================================================
    // Strategy 1: High-Performance Direct Stream Copy
    // =========================================================================
    try {
      stage = 'Opening Media Input';
      const input = new Input({
        source: new BlobSource(file),
        formats: ALL_FORMATS,
      });

      stage = 'Demuxing & Inspecting Tracks';
      try {
        const vTracks = await input.getVideoTracks();
        if (vTracks.length > 0) vCodec = (await vTracks[0].getCodec()) || 'unknown';
        const aTracks = await input.getAudioTracks();
        if (aTracks.length > 0) aCodec = (await aTracks[0].getCodec()) || 'unknown';
        
        onProgress({
          percentage: 4,
          statusText: 'Tracks inspected, configuring target container...',
          speedMBs: 0,
          log: `[PROBE] Video Track: ${vCodec || 'none'}, Audio Track: ${aCodec || 'none'}`
        });
      } catch (e) {
        // Track inspection optional
      }

      stage = 'Initializing Output Format & Target';
      const format = getOutputFormatForFile(file.name);
      const target = createMediabunnyTarget(writable);
      const output = new Output({ format, target });

      let lastTime = performance.now();
      let lastBytes = 0;

      onProgress({
        percentage: 5,
        statusText: `[STAGE 2/3] Streaming packet copy and container repair...`,
        speedMBs: 0,
        log: `[STAGE 2/3] Streaming packet copy to target container (${format.fileExtension.toUpperCase()})...`
      });

      // Byte-stream real-time progress monitor (Zero upfront delay, works like FFmpeg)
      target.on('write', ({ end }) => {
        totalWritten = Math.max(totalWritten, end);
        const now = performance.now();
        const elapsed = (now - lastTime) / 1000;
        if (elapsed > 0.3) {
          const speedMBs = ((totalWritten - lastBytes) / (1024 * 1024)) / elapsed;
          lastTime = now;
          lastBytes = totalWritten;
          // Scale stream copying to 2% - 90% so that the final container flush takes 91% - 100%
          const prog = Math.min(90, Math.max(2, Math.round((totalWritten / file.size) * 88) + 2));
          lastProgress = prog;
          const remainingBytes = Math.max(0, file.size - totalWritten);
          const etaSec = speedMBs > 0 ? remainingBytes / (speedMBs * 1024 * 1024) : 0;
          const etaText = etaSec > 0 ? ` (ETA: ${Math.ceil(etaSec)}s)` : '';
          const writtenMB = (totalWritten / (1024 * 1024)).toFixed(1);
          onProgress({
            percentage: prog,
            statusText: `Remuxing: ${writtenMB} / ${fileSizeMB.toFixed(1)} MB (${speedMBs.toFixed(1)} MB/s)${etaText}`,
            speedMBs,
            log: `[REMUX PROGRESS] ${prog}% | Written: ${writtenMB} / ${fileSizeMB.toFixed(1)} MB | Speed: ${speedMBs.toFixed(1)} MB/s${etaText}`
          });
        }
      });

      stage = 'Configuring Mediabunny Conversion';
      const conversion = await Conversion.init({
        input,
        output,
      });

      // CRITICAL: We intentionally do NOT set conversion.onProgress here!
      // Assigning conversion.onProgress forces Mediabunny to call track.computeDuration(),
      // which scans all 30GB of packets upfront taking 15+ minutes before writing anything!
      // Our target.on('write') monitor above gives instant real-time progress with ZERO delay!

      stage = 'Executing Conversion Stream';
      await conversion.execute();

      stage = 'Finalizing Remux Container Output';
      onProgress({
        percentage: 91,
        statusText: 'Data packaging complete. Synchronizing container index...',
        speedMBs: 0,
        log: `[STAGE 3/4] Data packaging complete (${(totalWritten / (1024 * 1024)).toFixed(2)} MB). Synchronizing container index...`
      });

      let blobUrl: string | undefined;
      if (target instanceof BufferTarget && target.buffer) {
        const isMp4 = file.name.toLowerCase().endsWith('.mp4');
        const blob = new Blob([target.buffer], { type: isMp4 ? 'video/mp4' : 'video/webm' });
        blobUrl = URL.createObjectURL(blob);
        totalWritten = target.buffer.byteLength;
      }

      return { success: true, totalBytesWritten: totalWritten, blobUrl };
    } catch (nativeErr: any) {
      const errMsg = nativeErr?.message || String(nativeErr);
      console.warn('Native Remux Conversion failed, falling back to Packet Repair Stream:', nativeErr);

      onProgress({
        percentage: 5,
        statusText: 'Activating FFmpeg-Grade Packet Repair Engine...',
        speedMBs: 0,
        log: `[REPAIR NOTICE] Direct conversion reported container drift (${errMsg}). Activating FFmpeg-Grade Packet Repair Stream...`
      });
    }

    // =========================================================================
    // Strategy 2: Fallback FFmpeg-Grade Packet Repair Stream
    // =========================================================================
    totalWritten = 0;
    stage = 'Opening Media Input (Packet Repair)';
    const input = new Input({
      source: new BlobSource(file),
      formats: ALL_FORMATS,
    });

    stage = 'Demuxing & Inspecting Tracks (Packet Repair)';
    const vTracks = await input.getVideoTracks();
    const aTracks = await input.getAudioTracks();

    let vSource: EncodedVideoPacketSource | null = null;
    let aSource: EncodedAudioPacketSource | null = null;
    let vDecConfig: any = null;
    let aDecConfig: any = null;

    if (vTracks.length > 0) {
      try {
        const rawVCodec = await vTracks[0].getCodec();
        const normV = normalizeVideoCodec(rawVCodec);
        if (normV) {
          vDecConfig = await vTracks[0].getDecoderConfig();
          vSource = new EncodedVideoPacketSource(normV);
          vCodec = normV;
        }
      } catch (e) {
        console.warn('Video track inspection in repair mode notice:', e);
      }
    }

    if (aTracks.length > 0) {
      try {
        const rawACodec = await aTracks[0].getCodec();
        const normA = normalizeAudioCodec(rawACodec);
        if (normA) {
          aDecConfig = await aTracks[0].getDecoderConfig();
          aSource = new EncodedAudioPacketSource(normA);
          aCodec = normA;
        }
      } catch (e) {
        console.warn('Audio track inspection in repair mode notice:', e);
      }
    }

    if (!vSource && !aSource) {
      throw new Error(`No compatible video or audio tracks could be recovered from file ${file.name}`);
    }

    stage = 'Initializing Output Format & Target (Packet Repair)';
    const format = getOutputFormatForFile(file.name);
    const target = createMediabunnyTarget(writable);
    const output = new Output({ format, target });

    if (vSource) output.addVideoTrack(vSource, { decoderConfig: vDecConfig ?? undefined, fps: vTracks[0]?.trackInfo?.fps || 30, framerate: vTracks[0]?.trackInfo?.fps || 30 });
    if (aSource) output.addAudioTrack(aSource, { decoderConfig: aDecConfig ?? undefined });

    stage = 'Starting Output Writer (Packet Repair)';
    await output.start();

    let lastTime = performance.now();
    let lastBytes = 0;

    target.on('write', ({ end }) => {
      totalWritten = Math.max(totalWritten, end);
      const now = performance.now();
      const elapsed = (now - lastTime) / 1000;
      if (elapsed > 0.4) {
        const speedMBs = ((totalWritten - lastBytes) / (1024 * 1024)) / elapsed;
        lastTime = now;
        lastBytes = totalWritten;
        // Scale stream copying to 2% - 90% so that the final container flush takes 91% - 100%
        const prog = Math.min(90, Math.max(2, Math.round((totalWritten / file.size) * 88) + 2));
        lastProgress = prog;
        const remainingBytes = Math.max(0, file.size - totalWritten);
        const etaSec = speedMBs > 0 ? remainingBytes / (speedMBs * 1024 * 1024) : 0;
        const etaText = etaSec > 0 ? ` (ETA: ${Math.ceil(etaSec)}s)` : '';
        const writtenMB = (totalWritten / (1024 * 1024)).toFixed(1);
        onProgress({
          percentage: prog,
          statusText: `Repairing: ${writtenMB} / ${fileSizeMB.toFixed(1)} MB (${speedMBs.toFixed(1)} MB/s)${etaText}`,
          speedMBs,
          log: `[REPAIR PROGRESS] ${prog}% | Written: ${writtenMB} / ${fileSizeMB.toFixed(1)} MB | Speed: ${speedMBs.toFixed(1)} MB/s${etaText}`
        });
      }
    });

    stage = 'Processing Packets (Packet Repair)';
    const vSink = vSource && vTracks.length > 0 ? new EncodedPacketSink(vTracks[0]) : null;
    const aSink = aSource && aTracks.length > 0 ? new EncodedPacketSink(aTracks[0]) : null;

    const vIterator = vSink ? vSink.packets()[Symbol.asyncIterator]() : null;
    const aIterator = aSink ? aSink.packets()[Symbol.asyncIterator]() : null;

    let nextV = vIterator ? await vIterator.next() : { done: true, value: undefined };
    let nextA = aIterator ? await aIterator.next() : { done: true, value: undefined };

    let isFirstV = true;
    let isFirstA = true;
    let minVTs: number | null = null;
    let minATs: number | null = null;
    let lastVTs = -0.001;
    let lastATs = -0.001;

    try {
      while (!nextV.done || !nextA.done) {
        const rawVTime = (!nextV.done && nextV.value) ? nextV.value.timestamp : Infinity;
        const rawATime = (!nextA.done && nextA.value) ? nextA.value.timestamp : Infinity;

        if (rawVTime <= rawATime && !nextV.done && nextV.value) {
          const pkt = nextV.value;

          if (minVTs === null) minVTs = pkt.timestamp;
          const rawPTime = Math.max(0, pkt.timestamp - minVTs);
          const pTime = Math.max(lastVTs + 0.0001, rawPTime);
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

          try {
            nextV = await vIterator!.next();
          } catch (vIterErr) {
            console.warn('Video stream reached damaged packet or EOF:', vIterErr);
            nextV = { done: true, value: undefined };
          }
        } else if (!nextA.done && nextA.value) {
          const pkt = nextA.value;

          if (minATs === null) minATs = pkt.timestamp;
          const rawPTime = Math.max(0, pkt.timestamp - minATs);
          const pTime = Math.max(lastATs + 0.0001, rawPTime);
          lastATs = pTime;

          const audioPktType = isFirstA ? 'key' : 'delta';

          const shifted = new EncodedPacket(
            pkt.data,
            audioPktType,
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

          try {
            nextA = await aIterator!.next();
          } catch (aIterErr) {
            console.warn('Audio stream reached damaged packet or EOF:', aIterErr);
            nextA = { done: true, value: undefined };
          }
        }
      }
    } catch (loopErr) {
      console.warn('Packet repair loop encountered error near EOF, finalizing valid stream:', loopErr);
      onProgress({
        percentage: 98,
        statusText: 'Finalizing recovered media stream...',
        speedMBs: 0,
        log: `[REPAIR NOTICE] Recovered data stream, cleanly finalizing container: ${loopErr}`
      });
    }

    stage = 'Finalizing Container Output (Packet Repair)';
    try { if (vSource) vSource.close(); } catch {}
    try { if (aSource) aSource.close(); } catch {}
    await output.finalize();

    stage = 'Creating Final Output Blob / Buffer';
    let blobUrl: string | undefined;
    if (target instanceof BufferTarget && target.buffer) {
      const isMp4 = file.name.toLowerCase().endsWith('.mp4');
      const blob = new Blob([target.buffer], { type: isMp4 ? 'video/mp4' : 'video/webm' });
      blobUrl = URL.createObjectURL(blob);
      totalWritten = target.buffer.byteLength;
    }

    onProgress({
      percentage: 91,
      statusText: 'Repaired data packaging complete. Synchronizing container index...',
      speedMBs: 0,
      log: `[STAGE 3/4] Repaired stream packaging complete (${(totalWritten / (1024 * 1024)).toFixed(2)} MB). Preparing disk flush...`
    });

    return { success: true, totalBytesWritten: totalWritten, blobUrl };
  } catch (err: any) {
    console.error('Mediabunny Remux Error:', err);
    reportMediabunnyDetailedError(err, {
      operation: 'Remux',
      engine: 'Mediabunny',
      file,
      stage,
      totalWritten,
      lastProgressPct: lastProgress,
      vCodec,
      aCodec
    }, onProgress);
    throw err;
  }
}

/**
 * Mediabunny Multi-File Packet Concat Stream
 */
async function processMediabunnyConcatStream(
  files: File[],
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void,
  abortSignal?: AbortSignal
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  let stage = 'Initializing Concat Pipeline';
  let totalWritten = 0;
  let lastProgress = 2;
  let vCodec: string | undefined;
  let aCodec: string | undefined;

  try {
    if (!files.length) return { success: false };

    onProgress({
      percentage: 2,
      statusText: `Preparing and analyzing ${files.length} files...`,
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
          fps: vTracks[0]?.trackInfo?.fps || 30,
          framerate: vTracks[0]?.trackInfo?.fps || 30,
        });
        onProgress({
          percentage: 4,
          statusText: `Found video track: ${vCodec}`,
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
          statusText: `Found audio track: ${aCodec}`,
          speedMBs: 0,
          log: `[TRACK] Audio track added: codec=${aCodec}, channels=${aDecConfig?.numberOfChannels || 'auto'}, rate=${aDecConfig?.sampleRate || 'auto'}`
        });
      }
    }

    if (!vSource && !aSource) {
      throw new Error(`No supported video or audio tracks found in file ${firstFile.name}`);
    }

    await output.start();
    onProgress({
      percentage: 8,
      statusText: `Starting lossless video stream concat...`,
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
      if (abortSignal?.aborted) throw Object.assign(new Error('AbortError'), { name: 'AbortError' });
      const file = files[fIdx];
      onProgress({
        percentage: Math.round(((fIdx) / files.length) * 90) + 8,
        statusText: `Merging file ${fIdx + 1}/${files.length} (${file.name})...`,
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
        statusText: `Merged file ${fIdx + 1}/${files.length} (${file.name})`,
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
      statusText: 'Video concatenation completed successfully!',
      speedMBs: 0,
      log: `[COMPLETE] Concat finished successfully! Total written: ${(totalWritten / (1024 * 1024)).toFixed(2)} MB, total duration: ${finalTotalDuration.toFixed(3)}s`
    });

    return { success: true, totalBytesWritten: totalWritten || 1, blobUrl };
  } catch (err: any) {
    console.error('Mediabunny Concat Error:', err);
    reportMediabunnyDetailedError(err, {
      operation: 'Concat',
      engine: 'Mediabunny',
      files,
      stage,
      totalWritten,
      lastProgressPct: lastProgress,
      vCodec,
      aCodec
    }, onProgress);
    throw err;
  }
}

/**
 * Standard Process Concat Stream - Unified router for MP4, WebM, MKV
 */
export async function processNativeConcatStream(
  files: File[],
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void,
  abortSignal?: AbortSignal
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  try {
    if (!files.length) return { success: false };

    // Detect format of first file
    const firstFormat = await detectMediaFormat(files[0]);
    onProgress({
      percentage: 1,
      statusText: `Detected container format: ${firstFormat.toUpperCase()}`,
      speedMBs: 0,
      log: `[DETECT] Detected input container format: ${firstFormat.toUpperCase()}`
    });

    if (firstFormat === 'webm' || firstFormat === 'mkv') {
      onProgress({
        percentage: 2,
        statusText: `Using Native Zero-RAM EBML Engine for ${firstFormat.toUpperCase()}...`,
        speedMBs: 0,
        log: `[ENGINE] Selected Native Zero-RAM EBML Streaming Engine for ${firstFormat.toUpperCase()} files`
      });
      try {
        return await processNativeEBMLConcatStream(files, writable, onProgress, abortSignal);
      } catch (nativeErr) {
        console.warn("Native EBML concat failed, falling back to Mediabunny:", nativeErr);
        onProgress({
          percentage: 5,
          statusText: 'Switching to Mediabunny Engine (Fallback)...',
          speedMBs: 0,
          log: `[FALLBACK] Native EBML engine error, switching to Mediabunny: ${nativeErr}\n[NOTICE] Switched to Mediabunny Engine due to container structure. Processing will take longer.`
        });
        return await processMediabunnyConcatStream(files, writable, onProgress);
      }
    }

    // For MP4 / MOV / TS and other formats, use Mediabunny
    onProgress({
      percentage: 2,
      statusText: `Using Mediabunny Engine for ${firstFormat.toUpperCase()} files...`,
      speedMBs: 0,
      log: `[ENGINE] Selected Mediabunny Engine for ${firstFormat.toUpperCase()} files\n[NOTICE] Processing ${firstFormat.toUpperCase()} containers with Mediabunny Engine will be slower than MKV/WebM due to MP4 index recalculation.`
    });
    return await processMediabunnyConcatStream(files, writable, onProgress, abortSignal);
  } catch (error) {
    console.error("Concat Stream Router Error:", error);
    return { success: false };
  }
}

async function processNativeEBMLConcatStream(
  files: File[],
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void,
  abortSignal?: AbortSignal
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  try {
    const fileMetas: FileMeta[] = [];
    let totalDurationMs = 0;
    for (let i = 0; i < files.length; i++) {
        if (abortSignal?.aborted) throw Object.assign(new Error('AbortError'), { name: 'AbortError' });
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

    const memChunks: Uint8Array[] = [];
    const writeBytes = async (data: Uint8Array) => {
      if (writable) {
        await writable.write(data);
      } else {
        memChunks.push(data.slice());
      }
      totalBytesWritten += data.length;
    };

    await writeBytes(firstMeta.ebmlHeader);

    // We write Segment ID with Unknown Size (0x01FFFFFFFFFFFFFF)
    const segId = new Uint8Array([0x18, 0x53, 0x80, 0x67]);
    const segSize = new Uint8Array([0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);
    await writeBytes(segId);
    await writeBytes(segSize);

    segmentDataOffset = totalBytesWritten;

    seekHeadOffset = totalBytesWritten;
    const dummySeekHead = buildSeekHead(0);
    await writeBytes(dummySeekHead);

    await writeBytes(patchedSegmentInfo);
    await writeBytes(firstMeta.segmentTracks);

    let globalTimecodeOffset = 0;
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks for streaming

    for (let fIdx = 0; fIdx < files.length; fIdx++) {
        if (abortSignal?.aborted) throw Object.assign(new Error('AbortError'), { name: 'AbortError' });
        const file = files[fIdx];
        const meta = fileMetas[fIdx];
        let fileMaxFrameTc = 0;

        for (let cIdx = 0; cIdx < meta.clusters.length; cIdx++) {
            const cluster = meta.clusters[cIdx];
            const newTc = cluster.timecode + globalTimecodeOffset;
            
            // Calculate absolute frame max in this cluster for accurate offset calculation
            const clusterMaxTc = await getClusterMaxFrameTimecode(file, cluster);
            if (clusterMaxTc > fileMaxFrameTc) fileMaxFrameTc = clusterMaxTc;

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
            await writeBytes(clusterId);
            await writeBytes(clusterSizeVint);

            // Write from after cluster header up to timecode offset
            const preTcSize = cluster.timecodeOffset - (cluster.offset + cluster.headerLen);
            if (preTcSize > 0) {
                const preTcBuf = await readSlice(file, cluster.offset + cluster.headerLen, preTcSize);
                await writeBytes(preTcBuf);
            }

            // Write the new Timecode element
            await writeBytes(new Uint8Array([0xE7]));
            await writeBytes(newTcSizeVint);
            await writeBytes(newTcValBuf);

            // Stream the rest of the cluster
            const restOffset = cluster.timecodeOffset + cluster.timecodeLength;
            const restSize = cluster.size === -1 ? (file.size - restOffset) : (cluster.offset + cluster.size - restOffset);
            
            let streamPos = restOffset;
            const streamEnd = restOffset + restSize;
            
            while (streamPos < streamEnd) {
                const toRead = Math.min(CHUNK_SIZE, streamEnd - streamPos);
                const chunk = await readSlice(file, streamPos, toRead);
                await writeBytes(chunk);
                streamPos += chunk.length;
            }
            
            // Update Progress
            const overallProg = ((fIdx / files.length) + ((cIdx + 1) / meta.clusters.length) * (1 / files.length)) * 100;
            onProgress({ percentage: overallProg, statusText: `Merging file ${fIdx + 1}/${files.length}... (Standard Engine)`, speedMBs: 0 });
        }

        // Advance global timecode offset
        // Ensure strictly monotonic timestamps, adding 33ms (1 frame at 30fps) to avoid gaps/stalls
        if (fileMaxFrameTc > 0) {
            globalTimecodeOffset += fileMaxFrameTc + 33;
        } else if (meta.fileDurationMs > 0) {
            globalTimecodeOffset += meta.fileDurationMs;
        }
    }

    if (cuePoints.length > 0) {
        onProgress({ percentage: 99, statusText: 'Creating Cues Index...', speedMBs: 0 });
        const cuesOffset = totalBytesWritten - segmentDataOffset;
        const cuesBuffer = buildCuesElement(cuePoints, videoTrackNum);
        await writeBytes(cuesBuffer);
        
        if (writable) {
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
    }

    let blobUrl: string | undefined;
    if (!writable && memChunks.length > 0) {
      const isMkv = files[0].name.toLowerCase().endsWith('.mkv');
      const blob = new Blob(memChunks, { type: isMkv ? 'video/x-matroska' : 'video/webm' });
      blobUrl = URL.createObjectURL(blob);
    }

    onProgress({ percentage: 100, statusText: 'Success! (Standard Engine)', speedMBs: 0 });
    return { success: totalBytesWritten > 0, totalBytesWritten, blobUrl };
  } catch (error) {
    console.error("Concat Stream Error:", error);
    throw error;
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
         statusText: `Using Native Zero-RAM EBML Engine for ${format.toUpperCase()} trim...`,
         speedMBs: 0,
         log: `[ENGINE] Selected Native Zero-RAM EBML Streaming Engine for ${format.toUpperCase()} trim`
       });
       try {
         return await executeNativeEBMLTrimStream(file, startTime, endTime, writable, onProgress);
       } catch (nativeErr) {
         console.warn("Native EBML trim failed, falling back to Mediabunny:", nativeErr);
         onProgress({
           percentage: 5,
           statusText: 'Switching to Mediabunny Engine (Fallback)...',
           speedMBs: 0,
           log: `[FALLBACK] Native EBML trim error, switching to Mediabunny: ${nativeErr}\n[NOTICE] Switched to Mediabunny Engine due to container structure. Processing will take longer.`
         });
         return await processMediabunnyTrimStream(file, startTime, endTime, writable, onProgress);
       }
     }

     onProgress({
       percentage: 2,
       statusText: `Using Mediabunny Engine for ${format.toUpperCase()} trim...`,
       speedMBs: 0,
       log: `[ENGINE] Selected Mediabunny Engine for ${format.toUpperCase()} trim\n[NOTICE] Processing ${format.toUpperCase()} containers with Mediabunny Engine will be slower than MKV/WebM due to MP4 index recalculation.`
     });
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
     onProgress({ percentage: 0, statusText: 'Analyzing file structure for trimming (Standard Engine)...', speedMBs: 0 });
     
     const meta = await parseWebMFile(file);
     let totalBytesWritten = 0;
     let segmentDataOffset = 0;
     const cuePoints: { time: number, offset: number }[] = [];

     let startMs = Math.max(0, startTime * 1000);
     const maxClusterMs = meta.clusters.length > 0 ? meta.clusters[meta.clusters.length - 1].timecode + 5000 : 0;
     const effectiveFileDurMs = meta.fileDurationMs > 0 ? meta.fileDurationMs : maxClusterMs;
     let endMs = endTime > 0 ? endTime * 1000 : effectiveFileDurMs;

     if (effectiveFileDurMs > 0) {
         if (startMs >= effectiveFileDurMs) {
             startMs = Math.max(0, effectiveFileDurMs - 100);
         }
         if (endMs <= 0 || endMs > effectiveFileDurMs) {
             endMs = effectiveFileDurMs;
         }
     }
     if (endMs > 0 && startMs >= endMs) {
         startMs = Math.max(0, endMs - 100);
     }
     const CHUNK_SIZE = 1024 * 1024;

     // Patch the Duration in SegmentInfo for Standard Compliance
     const patchedSegmentInfo = new Uint8Array(meta.segmentInfo);
     const infoHdr = readElementHeader(patchedSegmentInfo, 0);
     if (infoHdr && endMs > startMs) {
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
     const memChunks: Uint8Array[] = [];
     const writeBytes = async (data: Uint8Array) => {
        if (writable) {
           await writable.write(data);
        } else {
           memChunks.push(data.slice());
        }
        totalBytesWritten += data.length;
     };

     await writeBytes(meta.ebmlHeader);
     
     const segId = new Uint8Array([0x18, 0x53, 0x80, 0x67]);
     const segSize = new Uint8Array([0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);
     await writeBytes(segId);
     await writeBytes(segSize);
     
     segmentDataOffset = totalBytesWritten;

     seekHeadOffset = totalBytesWritten;
     const dummySeekHead = buildSeekHead(0);
     await writeBytes(dummySeekHead);

     await writeBytes(patchedSegmentInfo);
     await writeBytes(meta.segmentTracks);

     let firstIncludedTimecode = -1;

     for (let cIdx = 0; cIdx < meta.clusters.length; cIdx++) {
         const cluster = meta.clusters[cIdx];
         
         // Standard compliant exact filtering
         if (endMs > 0 && cluster.timecode > endMs) break; 
         
         const clusterMaxTc = await getClusterMaxFrameTimecode(file, cluster);
         if (clusterMaxTc < startMs) continue; // Before start time

         if (firstIncludedTimecode === -1) {
             firstIncludedTimecode = cluster.timecode;
         }

         const newTc = cluster.timecode - firstIncludedTimecode;
         if (newTc < 0) continue; // Safety check

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
         await writeBytes(clusterId);
         await writeBytes(clusterSizeVint);

         // Write from after cluster header up to timecode offset
         const preTcSize = cluster.timecodeOffset - (cluster.offset + cluster.headerLen);
         if (preTcSize > 0) {
             const preTcBuf = await readSlice(file, cluster.offset + cluster.headerLen, preTcSize);
             await writeBytes(preTcBuf);
         }

         // Write the new Timecode element
         await writeBytes(new Uint8Array([0xE7]));
         await writeBytes(newTcSizeVint);
         await writeBytes(newTcValBuf);

         const restOffset = cluster.timecodeOffset + cluster.timecodeLength;
         const restSize = cluster.size === -1 ? (file.size - restOffset) : (cluster.offset + cluster.size - restOffset);
         
         let streamPos = restOffset;
         const streamEnd = restOffset + restSize;
         
         while (streamPos < streamEnd) {
             const toRead = Math.min(CHUNK_SIZE, streamEnd - streamPos);
             const chunk = await readSlice(file, streamPos, toRead);
             await writeBytes(chunk);
             streamPos += chunk.length;
         }

         const prog = (cIdx / meta.clusters.length) * 100;
         onProgress({ percentage: prog, statusText: 'Trimming and streaming video (Standard Engine)...', speedMBs: 0 });
     }

     if (cuePoints.length > 0) {
         onProgress({ percentage: 99, statusText: 'Creating Cues Index...', speedMBs: 0 });
         const cuesOffset = totalBytesWritten - segmentDataOffset;
         const cuesBuffer = buildCuesElement(cuePoints, videoTrackNum);
         await writeBytes(cuesBuffer);
         
         if (writable) {
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
     }

     let blobUrl: string | undefined;
     if (!writable && memChunks.length > 0) {
         const isMkv = file.name.toLowerCase().endsWith('.mkv');
         const blob = new Blob(memChunks, { type: isMkv ? 'video/x-matroska' : 'video/webm' });
         blobUrl = URL.createObjectURL(blob);
     }

     onProgress({ percentage: 100, statusText: 'Trimming successful! (Standard Engine)', speedMBs: 0 });
     return { success: totalBytesWritten > 0, totalBytesWritten, blobUrl };
  } catch (err) {
     console.error("Trim Stream Error:", err);
     throw err;
  }
}

/**
 * Standard Process Remux Stream - Unified high-performance router for MP4, WebM, MKV, MOV, TS
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
         statusText: `Using Native Zero-RAM EBML Engine for ${format.toUpperCase()} remux...`,
         speedMBs: 0,
         log: `[ENGINE] Selected Native Zero-RAM EBML Remux & Cues Repair Engine for ${format.toUpperCase()} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`
       });
       try {
         const res = await executeNativeEBMLRemuxStream(file, writable, onProgress);
         if (res.success && (res.totalBytesWritten || 0) > 0) {
           return res;
         }
       } catch (nativeErr) {
         console.warn("Native EBML remux failed, falling back to Mediabunny:", nativeErr);
       }
     }

     onProgress({
       percentage: 2,
       statusText: `Initializing zero-RAM streaming engine for ${format.toUpperCase()}...`,
       speedMBs: 0,
       log: `[ENGINE] Selected Zero-RAM Streaming Remux & Repair Engine for ${format.toUpperCase()} (${(file.size / (1024 * 1024)).toFixed(2)} MB)\n[MODE] Lossless Stream Copy (No re-encoding) + Container Header & Sync Index Repair`
     });
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
     onProgress({ percentage: 0, statusText: 'Analyzing file structure for remuxing (Standard Remux Engine)...', speedMBs: 0 });
     
     const meta = await parseWebMFile(file);
     let totalBytesWritten = 0;
     let segmentDataOffset = 0;
     const cuePoints: { time: number, offset: number }[] = [];

     const CHUNK_SIZE = 1024 * 1024;

     // Patch the Duration in SegmentInfo for Standard Compliance
     const patchedSegmentInfo = new Uint8Array(meta.segmentInfo);
     const infoHdr = readElementHeader(patchedSegmentInfo, 0);
     if (infoHdr && meta.fileDurationMs > 0) {
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
     const memChunks: Uint8Array[] = [];
     const writeBytes = async (data: Uint8Array) => {
        if (writable) {
           await writable.write(data);
        } else {
           memChunks.push(data.slice());
        }
        totalBytesWritten += data.length;
     };

     await writeBytes(meta.ebmlHeader);
     
     const segId = new Uint8Array([0x18, 0x53, 0x80, 0x67]);
     const segSize = new Uint8Array([0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);
     await writeBytes(segId);
     await writeBytes(segSize);
     
     segmentDataOffset = totalBytesWritten;

     seekHeadOffset = totalBytesWritten;
     const dummySeekHead = buildSeekHead(0);
     await writeBytes(dummySeekHead);

     await writeBytes(patchedSegmentInfo);
     await writeBytes(meta.segmentTracks);

     let firstIncludedTimecode = -1;

     for (let cIdx = 0; cIdx < meta.clusters.length; cIdx++) {
         const cluster = meta.clusters[cIdx];
         
         if (firstIncludedTimecode === -1) {
             firstIncludedTimecode = cluster.timecode;
         }

         const newTc = cluster.timecode - firstIncludedTimecode;
         if (newTc < 0) continue; // Safety check

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
         await writeBytes(clusterId);
         await writeBytes(clusterSizeVint);

         // Write from after cluster header up to timecode offset
         const preTcSize = cluster.timecodeOffset - (cluster.offset + cluster.headerLen);
         if (preTcSize > 0) {
             const preTcBuf = await readSlice(file, cluster.offset + cluster.headerLen, preTcSize);
             await writeBytes(preTcBuf);
         }

         // Write the new Timecode element
         await writeBytes(new Uint8Array([0xE7]));
         await writeBytes(newTcSizeVint);
         await writeBytes(newTcValBuf);

         const restOffset = cluster.timecodeOffset + cluster.timecodeLength;
         const restSize = cluster.size === -1 ? (file.size - restOffset) : (cluster.offset + cluster.size - restOffset);
         
         let streamPos = restOffset;
         const streamEnd = restOffset + restSize;
         
         while (streamPos < streamEnd) {
             const toRead = Math.min(CHUNK_SIZE, streamEnd - streamPos);
             const chunk = await readSlice(file, streamPos, toRead);
             await writeBytes(chunk);
             streamPos += chunk.length;
         }

         const prog = (cIdx / meta.clusters.length) * 100;
         onProgress({ percentage: prog, statusText: 'Remuxing file structure (Standard Remux)...', speedMBs: 0 });
     }

     if (cuePoints.length > 0) {
         onProgress({ percentage: 99, statusText: 'Creating Cues Index...', speedMBs: 0 });
         const cuesOffset = totalBytesWritten - segmentDataOffset;
         const cuesBuffer = buildCuesElement(cuePoints, videoTrackNum);
         await writeBytes(cuesBuffer);
         
         if (writable) {
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
     }

     let blobUrl: string | undefined;
     if (!writable && memChunks.length > 0) {
         const isMkv = file.name.toLowerCase().endsWith('.mkv');
         const blob = new Blob(memChunks, { type: isMkv ? 'video/x-matroska' : 'video/webm' });
         blobUrl = URL.createObjectURL(blob);
     }

     onProgress({ percentage: 100, statusText: 'Remuxing successful! (Standard Remux)', speedMBs: 0 });
     return { success: totalBytesWritten > 0, totalBytesWritten, blobUrl };
  } catch (err) {
     console.error("Remux Stream Error:", err);
     throw err;
  }
}



const MASTER_AUDIO_SAMPLE_RATE = 48000;
const MASTER_AUDIO_CHANNELS = 2;
const AUDIO_FRAME_SIZE = 1024; // Standard AAC & Opus frame size (1024 samples at 48000Hz = ~21.33ms per frame)
const AUDIO_FRAME_DURATION = AUDIO_FRAME_SIZE / MASTER_AUDIO_SAMPLE_RATE;

export type DecodedAudioBuffer = SimpleAudioBuffer | AudioBuffer;

const decodedAudioBufferCache = new Map<string, DecodedAudioBuffer | null>();

/**
 * Lightweight in-memory WAV decoder for 8/16/24/32-bit PCM and 32-bit IEEE float WAV files
 */
async function parseWavFile(file: File): Promise<SimpleAudioBuffer | null> {
  if (file.size < 44) return null;
  const headBuf = new Uint8Array(await file.slice(0, 44).arrayBuffer());
  const isRiff = headBuf[0] === 0x52 && headBuf[1] === 0x49 && headBuf[2] === 0x46 && headBuf[3] === 0x46; // 'RIFF'
  const isWave = headBuf[8] === 0x57 && headBuf[9] === 0x41 && headBuf[10] === 0x56 && headBuf[11] === 0x45; // 'WAVE'
  if (!isRiff || !isWave) return null;

  const view = new DataView(headBuf.buffer, headBuf.byteOffset, headBuf.byteLength);
  const audioFormat = view.getUint16(20, true);
  const numChannels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const bitsPerSample = view.getUint16(34, true);

  if ((audioFormat !== 1 && audioFormat !== 3) || numChannels < 1 || sampleRate < 4000) return null;

  const fullBytes = new Uint8Array(await file.arrayBuffer());
  let dataOffset = 12;
  let dataSize = 0;
  while (dataOffset + 8 <= fullBytes.length) {
    const id = String.fromCharCode(fullBytes[dataOffset], fullBytes[dataOffset + 1], fullBytes[dataOffset + 2], fullBytes[dataOffset + 3]);
    const sz = new DataView(fullBytes.buffer, fullBytes.byteOffset + dataOffset + 4, 4).getUint32(0, true);
    if (id === 'data') {
      dataOffset += 8;
      dataSize = Math.min(sz, fullBytes.length - dataOffset);
      break;
    }
    dataOffset += 8 + sz;
  }

  if (dataSize <= 0) return null;
  const bytesPerSample = bitsPerSample / 8;
  const numFrames = Math.floor(dataSize / (numChannels * bytesPerSample));
  if (numFrames <= 0) return null;

  const outBuf = new SimpleAudioBuffer(numChannels, numFrames, sampleRate);
  const ch0 = outBuf.getChannelData(0);
  const ch1 = numChannels > 1 ? outBuf.getChannelData(1) : ch0;
  const dataView = new DataView(fullBytes.buffer, fullBytes.byteOffset + dataOffset, dataSize);

  let bytePtr = 0;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      let val = 0;
      if (audioFormat === 1) {
        if (bitsPerSample === 16) {
          val = dataView.getInt16(bytePtr, true) / 32768.0;
          bytePtr += 2;
        } else if (bitsPerSample === 24) {
          const b0 = fullBytes[dataOffset + bytePtr];
          const b1 = fullBytes[dataOffset + bytePtr + 1];
          const b2 = fullBytes[dataOffset + bytePtr + 2];
          let int24 = (b2 << 24) | (b1 << 16) | (b0 << 8);
          val = int24 / 2147483648.0;
          bytePtr += 3;
        } else if (bitsPerSample === 8) {
          val = (fullBytes[dataOffset + bytePtr] - 128) / 128.0;
          bytePtr += 1;
        } else if (bitsPerSample === 32) {
          val = dataView.getInt32(bytePtr, true) / 2147483648.0;
          bytePtr += 4;
        }
      } else if (audioFormat === 3) {
        val = dataView.getFloat32(bytePtr, true);
        bytePtr += 4;
      }
      if (c === 0) ch0[i] = val;
      else if (c === 1) ch1[i] = val;
    }
  }

  return outBuf;
}

/**
 * Decodes audio file directly in Worker using WebCodecs NativeAudioSink.
 * Supports targeted time-slice decoding [startSec, endSec] so only trimmed clips are decoded,
 * preventing unnecessary multi-gigabyte reads of long media files.
 */
async function getAudioBufferForFile(
  file: File,
  startSec?: number,
  endSec?: number
): Promise<DecodedAudioBuffer | null> {
  const isRange = typeof startSec === 'number' && typeof endSec === 'number';
  const rStart = isRange ? Math.max(0, startSec! - 0.5) : 0;
  const rEnd = isRange ? endSec! + 0.5 : 0;
  const cacheKey = isRange
    ? `${file.name}_${file.size}_range_${rStart.toFixed(2)}_${rEnd.toFixed(2)}`
    : `${file.name}_${file.size}_${file.lastModified}`;

  if (decodedAudioBufferCache.has(cacheKey)) {
    return decodedAudioBufferCache.get(cacheKey) ?? null;
  }

  // 1. Decode via WebCodecs NativeAudioSink fast targeted range decoder
  try {
    const sink = new NativeAudioSink(file);
    const outBuf = isRange
      ? await sink.decodeRange(rStart, rEnd)
      : await sink.decodeAll();
    if (outBuf && outBuf.length > 0) {
      decodedAudioBufferCache.set(cacheKey, outBuf);
      return outBuf;
    }
  } catch (err) {
    console.warn('NativeAudioSink audio decode failed for file:', file.name, err);
  }

  // 2. Try OfflineAudioContext if whole file requested and fits in RAM
  if (!isRange) {
    const OfflineCtx = typeof OfflineAudioContext !== 'undefined'
      ? OfflineAudioContext
      : (typeof (self as any).OfflineAudioContext !== 'undefined'
          ? (self as any).OfflineAudioContext
          : (typeof (self as any).webkitOfflineAudioContext !== 'undefined'
              ? (self as any).webkitOfflineAudioContext
              : null));

    if (OfflineCtx && file.size <= 200 * 1024 * 1024) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const ctx = new OfflineCtx(1, 1, 44100);
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        if (audioBuffer && audioBuffer.length > 0) {
          decodedAudioBufferCache.set(cacheKey, audioBuffer);
          return audioBuffer;
        }
      } catch {}
    }

    try {
      const wavBuf = await parseWavFile(file);
      if (wavBuf && wavBuf.length > 0) {
        decodedAudioBufferCache.set(cacheKey, wavBuf);
        return wavBuf;
      }
    } catch {}
  }

  decodedAudioBufferCache.set(cacheKey, null);
  return null;
}

/**
 * Extracts Float32 interleaved PCM samples in a uniform 1024-frame AudioSample block to prevent AAC/Opus frame jitter and audio stuttering
 */
function createAudioSampleBlock(
  audioBuffer: DecodedAudioBuffer,
  sourceStartSec: number,
  outputTimestamp: number,
  volumeMultiplier: number = 1.0
): AudioSample {
  const targetSampleRate = MASTER_AUDIO_SAMPLE_RATE;
  const targetChannels = MASTER_AUDIO_CHANNELS;
  const numFrames = AUDIO_FRAME_SIZE;
  const pcmData = new Float32Array(numFrames * targetChannels);

  const srcRate = audioBuffer.sampleRate;
  const srcChannels = audioBuffer.numberOfChannels;
  const totalSrcFrames = audioBuffer.length;
  const srcStartFrame = Math.round(sourceStartSec * srcRate);

  const leftChannel = audioBuffer.getChannelData(0);
  const rightChannel = srcChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel;

  for (let i = 0; i < numFrames; i++) {
    const srcFrameExact = srcStartFrame + (i / targetSampleRate) * srcRate;
    const f0 = Math.floor(srcFrameExact);
    const f1 = Math.min(f0 + 1, totalSrcFrames - 1);
    const frac = srcFrameExact - f0;

    let lVal = 0;
    let rVal = 0;

    if (f0 >= 0 && f0 < totalSrcFrames) {
      const l0 = leftChannel[f0];
      const l1 = f1 < totalSrcFrames ? leftChannel[f1] : l0;
      lVal = l0 + (l1 - l0) * frac;

      const r0 = rightChannel[f0];
      const r1 = f1 < totalSrcFrames ? rightChannel[f1] : r0;
      rVal = r0 + (r1 - r0) * frac;
    }

    pcmData[i * 2] = lVal * volumeMultiplier;
    pcmData[i * 2 + 1] = rVal * volumeMultiplier;
  }

  return new AudioSample({
    format: 'f32',
    sampleRate: targetSampleRate,
    numberOfChannels: targetChannels,
    timestamp: outputTimestamp,
    data: pcmData,
  });
}

/**
 * Creates a uniform 1024-frame silent AudioSample block of zero PCM values
 */
interface AudioSourceInfo {
  buffer: DecodedAudioBuffer;
  sourceStartSec: number;
  volumeMultiplier: number;
}

function createMixedAudioSampleBlock(
  sources: AudioSourceInfo[],
  outputTimestamp: number
): AudioSample {
  const targetSampleRate = MASTER_AUDIO_SAMPLE_RATE;
  const targetChannels = MASTER_AUDIO_CHANNELS;
  const numFrames = AUDIO_FRAME_SIZE;
  const pcmData = new Float32Array(numFrames * targetChannels);

  for (const src of sources) {
    const srcRate = src.buffer.sampleRate;
    const srcChannels = src.buffer.numberOfChannels;
    const totalSrcFrames = src.buffer.length;
    const bufferStartSec = (src.buffer as any).startSec || 0;
    const relativeSourceSec = src.sourceStartSec - bufferStartSec;
    const srcStartFrame = Math.round(relativeSourceSec * srcRate);

    const leftChannel = src.buffer.getChannelData(0);
    const rightChannel = srcChannels > 1 ? src.buffer.getChannelData(1) : leftChannel;

    for (let i = 0; i < numFrames; i++) {
      const srcFrameExact = srcStartFrame + (i / targetSampleRate) * srcRate;
      const f0 = Math.floor(srcFrameExact);
      const f1 = Math.min(f0 + 1, totalSrcFrames - 1);
      const frac = srcFrameExact - f0;

      let lVal = 0;
      let rVal = 0;

      if (f0 >= 0 && f0 < totalSrcFrames) {
        const l0 = leftChannel[f0];
        const l1 = f1 < totalSrcFrames ? leftChannel[f1] : l0;
        lVal = l0 + (l1 - l0) * frac;

        const r0 = rightChannel[f0];
        const r1 = f1 < totalSrcFrames ? rightChannel[f1] : r0;
        rVal = r0 + (r1 - r0) * frac;
      }

      // Direct planar write: Plane 0 (left), Plane 1 (right)
      pcmData[i] += lVal * src.volumeMultiplier;
      pcmData[numFrames + i] += rVal * src.volumeMultiplier;
    }
  }

  // Clamp to prevent clipping
  for (let i = 0; i < pcmData.length; i++) {
    if (pcmData[i] > 1.0) pcmData[i] = 1.0;
    else if (pcmData[i] < -1.0) pcmData[i] = -1.0;
  }

  return new AudioSample({
    format: 'f32-planar',
    sampleRate: targetSampleRate,
    numberOfChannels: targetChannels,
    timestamp: outputTimestamp,
    data: pcmData,
  });
}

function createSilentAudioBlock(timestamp: number): AudioSample {
  const pcmData = new Float32Array(AUDIO_FRAME_SIZE * MASTER_AUDIO_CHANNELS);
  return new AudioSample({
    format: 'f32-planar',
    sampleRate: MASTER_AUDIO_SAMPLE_RATE,
    numberOfChannels: MASTER_AUDIO_CHANNELS,
    timestamp,
    data: pcmData,
  });
}

function createSilentAudioSample(timestamp: number, duration: number, sampleRate = MASTER_AUDIO_SAMPLE_RATE, channels = MASTER_AUDIO_CHANNELS): AudioSample {
  const numberOfFrames = Math.max(1, Math.round(duration * sampleRate));
  const pcmData = new Float32Array(numberOfFrames * channels);
  return new AudioSample({
    format: 'f32',
    sampleRate,
    numberOfChannels: channels,
    timestamp,
    data: pcmData,
  });
}

/**
 * Extracts float32 planar PCM data from any AudioSample safely without DOM/AudioContext dependence
 */
function extractPCMFloat32(sample: AudioSample): { pcm: Float32Array; frames: number; channels: number; rate: number } {
  const frames = sample.numberOfFrames || 0;
  const channels = sample.numberOfChannels || 2;
  const rate = sample.sampleRate || MASTER_AUDIO_SAMPLE_RATE;

  if (frames <= 0 || channels <= 0) {
    return { pcm: new Float32Array(0), frames: 0, channels: 1, rate };
  }

  const totalFloats = frames * channels;
  const pcm = new Float32Array(totalFloats);

  if (sample.data) {
    for (let ch = 0; ch < channels; ch++) {
      for (let i = 0; i < frames; i++) {
        pcm[ch * frames + i] = sample.data[i * channels + ch] || 0;
      }
    }
    return { pcm, frames, channels, rate };
  }

  try {
    for (let ch = 0; ch < channels; ch++) {
      const planeBuf = new Float32Array(pcm.buffer, ch * frames * 4, frames);
      sample.copyTo(planeBuf, { planeIndex: ch, format: 'f32-planar' });
    }
  } catch (e) {
    try {
      sample.copyTo(pcm, { planeIndex: 0, format: 'f32' });
    } catch (e2) {
      pcm.fill(0);
    }
  }

  return { pcm, frames, channels, rate };
}

/**
 * Adapts an AudioSample to match target sampleRate and numberOfChannels
 */
function adaptAudioSample(
  sample: AudioSample,
  targetSampleRate: number = MASTER_AUDIO_SAMPLE_RATE,
  targetChannels: number = MASTER_AUDIO_CHANNELS
): AudioSample {
  if (sample.sampleRate === targetSampleRate && sample.numberOfChannels === targetChannels && sample.data) {
    return sample;
  }

  const { pcm, frames: srcFrames, channels: srcChannels, rate: srcRate } = extractPCMFloat32(sample);

  if (srcFrames <= 0) {
    return createSilentAudioSample(sample.timestamp, sample.duration || 0.02, targetSampleRate, targetChannels);
  }

  const ratio = targetSampleRate / (srcRate || targetSampleRate);
  const dstFrames = Math.max(1, Math.round(srcFrames * ratio));
  const dstPCM = new Float32Array(dstFrames * targetChannels);

  for (let i = 0; i < dstFrames; i++) {
    const srcIdx = i / ratio;
    const i0 = Math.floor(srcIdx);
    const i1 = Math.min(i0 + 1, srcFrames - 1);
    const frac = srcIdx - i0;

    for (let ch = 0; ch < targetChannels; ch++) {
      const srcCh = Math.min(ch, srcChannels - 1);
      const v0 = pcm[srcCh * srcFrames + i0] || 0;
      const v1 = pcm[srcCh * srcFrames + i1] || 0;
      dstPCM[i * targetChannels + ch] = v0 + (v1 - v0) * frac;
    }
  }

  return new AudioSample({
    format: 'f32',
    sampleRate: targetSampleRate,
    numberOfChannels: targetChannels,
    timestamp: sample.timestamp,
    duration: sample.duration,
    data: dstPCM,
  });
}

/**
 * Validates whether an object is a live, valid, unclosed CanvasImageSource that can be passed to drawImage.
 */
export function isValidCanvasImageSource(img: any): img is CanvasImageSource {
  if (!img) return false;
  try {
    if (typeof VideoFrame !== 'undefined' && img instanceof VideoFrame) {
      return img.format !== null && img.codedWidth > 0 && img.codedHeight > 0;
    }
    if ('format' in img && (img as any).format === null) {
      return false;
    }
    if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) {
      return img.width > 0 && img.height > 0;
    }
    if (typeof HTMLCanvasElement !== 'undefined' && img instanceof HTMLCanvasElement) {
      return img.width > 0 && img.height > 0;
    }
    if (typeof OffscreenCanvas !== 'undefined' && img instanceof OffscreenCanvas) {
      return img.width > 0 && img.height > 0;
    }
    if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
      return img.complete && img.naturalWidth > 0;
    }
    if (typeof HTMLVideoElement !== 'undefined' && img instanceof HTMLVideoElement) {
      return img.readyState >= 2 && img.videoWidth > 0;
    }
    if (typeof img === 'object' && ('width' in img || 'videoWidth' in img || 'displayWidth' in img)) {
      const w = (img as any).width || (img as any).videoWidth || (img as any).displayWidth;
      const h = (img as any).height || (img as any).videoHeight || (img as any).displayHeight;
      return typeof w === 'number' && w > 0 && typeof h === 'number' && h > 0;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Draws image source onto canvas with aspect ratio fit/cover and transforms/filters
 */
function drawFitCover(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  img: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  settings: EditSettings
) {
  if (!isValidCanvasImageSource(img)) return;

  ctx.save();
  try {
    ctx.filter = buildCanvasFilterString(settings);

    if (settings.flipH || settings.flipV) {
      ctx.translate(settings.flipH ? canvasWidth : 0, settings.flipV ? canvasHeight : 0);
      ctx.scale(settings.flipH ? -1 : 1, settings.flipV ? -1 : 1);
    }

    const srcRatio = srcWidth / srcHeight;
    const dstRatio = canvasWidth / canvasHeight;

    if (settings.cropAspect === 'free' && settings.freeCropRect) {
      const rect = settings.freeCropRect;
      const sx = Math.max(0, Math.min(srcWidth - 2, Math.round(srcWidth * (rect.x || 0))));
      const sy = Math.max(0, Math.min(srcHeight - 2, Math.round(srcHeight * (rect.y || 0))));
      const sw = Math.max(8, Math.min(srcWidth - sx, Math.round(srcWidth * (rect.width || 1))));
      const sh = Math.max(8, Math.min(srcHeight - sy, Math.round(srcHeight * (rect.height || 1))));
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvasWidth, canvasHeight);
    } else if (Math.abs(srcRatio - dstRatio) > 0.01) {
      let sx = 0;
      let sy = 0;
      let sw = srcWidth;
      let sh = srcHeight;
      if (srcRatio > dstRatio) {
        sw = srcHeight * dstRatio;
        sx = (srcWidth - sw) / 2;
      } else {
        sh = srcWidth / dstRatio;
        sy = (srcHeight - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvasWidth, canvasHeight);
    } else {
      // 5-parameter drawImage allows browser to correctly map VideoFrame visibleRect without codedWidth padding
      ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
    }
  } catch (err) {
    console.warn('drawFitCover drawImage failed:', err);
  } finally {
    ctx.restore();
  }
}

/**
 * Draws a layer onto canvas respecting x/y percentage, rotation, scale, and opacity
 */
function drawLayerToCanvas(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  img: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  transform: ClipTransform | undefined,
  canvasWidth: number,
  canvasHeight: number,
  settings?: EditSettings,
  transitionOpacity: number = 1.0,
  transitionClipPath?: string
) {
  if (!isValidCanvasImageSource(img)) return;

  const t = transform || { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 };
  const posX = (t.x / 100) * canvasWidth;
  const posY = (t.y / 100) * canvasHeight;
  const scale = t.scale ?? 1;
  const rotationDeg = t.rotation ?? 0;
  const opacity = (t.opacity ?? 1) * transitionOpacity;

  ctx.save();
  try {
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity));

    if (transitionClipPath && transitionClipPath.startsWith('polygon(')) {
      const match = transitionClipPath.match(/(\d+)%/);
      if (match) {
        const pct = parseInt(match[1], 10) / 100;
        ctx.beginPath();
        ctx.rect(0, 0, canvasWidth * pct, canvasHeight);
        ctx.clip();
      }
    }
    
    let sourceToDraw = img;
    if (t.blur && t.blur > 0) {
      const currentFilter = ctx.filter === 'none' ? '' : ctx.filter;
      // Scale blur relative to a standard 640px preview width so it encodes visually similar to preview
      // CSS blur(R) has standard deviation R. Poisson disk blur visually matches at roughly 2x - 2.5x the radius.
      const cssSigmaToPoissonRadius = 2.4; 
      const scaledBlur = Math.max(1, Math.round(t.blur * (canvasWidth / 640) * cssSigmaToPoissonRadius));
      
      try {
        sourceToDraw = HardwareBlurEngine.instance.applyBlur(img, srcWidth, srcHeight, scaledBlur);
      } catch (blurErr) {
        console.warn('Hardware blur failed, falling back to unblurred image:', blurErr);
        sourceToDraw = img;
      }
      // Remove the blur from CSS filter since we've already applied it to the source
      ctx.filter = currentFilter;
    }

    if (!isValidCanvasImageSource(sourceToDraw)) {
      return;
    }

    ctx.translate(posX, posY);
    if (rotationDeg !== 0) {
      ctx.rotate((rotationDeg * Math.PI) / 180);
    }
    ctx.scale(scale, scale);

    const drawW = canvasWidth;
    const drawH = (srcHeight / srcWidth) * canvasWidth;

    // Use 5-parameter drawImage so native VideoFrame visibleRect is accurately mapped without right-edge black line/border
    ctx.drawImage(sourceToDraw, -drawW / 2, -drawH / 2, drawW, drawH);
  } catch (err) {
    console.warn('drawLayerToCanvas drawImage failed:', err);
  } finally {
    ctx.restore();
  }
}

/**
 * Renders watermark overlay text onto canvas
 */
function drawWatermark(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  settings: EditSettings
) {
  if (!settings.watermarkText || !settings.watermarkText.trim()) return;

  ctx.save();
  const fontSize = settings.watermarkSize || 24;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillStyle = settings.watermarkColor || '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  const text = settings.watermarkText;
  const textMetrics = ctx.measureText(text);
  const padding = 20;
  let x = padding;
  let y = canvasHeight - padding;

  switch (settings.watermarkPosition) {
    case 'top-left':
      x = padding;
      y = padding + fontSize;
      break;
    case 'top-right':
      x = canvasWidth - textMetrics.width - padding;
      y = padding + fontSize;
      break;
    case 'bottom-left':
      x = padding;
      y = canvasHeight - padding;
      break;
    case 'bottom-right':
      x = canvasWidth - textMetrics.width - padding;
      y = canvasHeight - padding;
      break;
    case 'center':
      x = (canvasWidth - textMetrics.width) / 2;
      y = (canvasHeight + fontSize) / 2;
      break;
  }

  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * Checks if the browser natively supports WebCodecs API (VideoEncoder, VideoDecoder)
 */
export function isWebCodecsSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'VideoEncoder' in window &&
    'VideoDecoder' in window
  );
}

/**
 * Probes WebCodecs hardware acceleration & software capabilities
 */
export async function probeWebCodecsCapabilities(): Promise<{
  supported: boolean;
  hasHardwareAcceleration: boolean;
  codecs: { avc: boolean; hevc: boolean; vp9: boolean; av1: boolean };
  audioCodecs: { aac: boolean; opus: boolean };
}> {
  if (!isWebCodecsSupported()) {
    return {
      supported: false,
      hasHardwareAcceleration: false,
      codecs: { avc: false, hevc: false, vp9: false, av1: false },
      audioCodecs: { aac: false, opus: false },
    };
  }

  let hasHardwareAcceleration = false;
  const codecs = { avc: false, hevc: false, vp9: false, av1: false };
  const audioCodecs = { aac: false, opus: false };

  try {
    // Probe AVC / H.264
    const avcSupport = await VideoEncoder.isConfigSupported({
      codec: 'avc1.640028',
      width: 1920,
      height: 1080,
      bitrate: 4_000_000,
      framerate: 30,
      hardwareAcceleration: 'no-preference',
    });
    codecs.avc = !!avcSupport.supported;
    if (avcSupport.config?.hardwareAcceleration === 'prefer-hardware') {
      hasHardwareAcceleration = true;
    }
  } catch {}

  try {
    // Probe VP9
    const vp9Support = await VideoEncoder.isConfigSupported({
      codec: 'vp09.00.10.08',
      width: 1920,
      height: 1080,
      bitrate: 4_000_000,
      framerate: 30,
      hardwareAcceleration: 'no-preference',
    });
    codecs.vp9 = !!vp9Support.supported;
  } catch {}

  try {
    // Probe AV1
    const av1Support = await VideoEncoder.isConfigSupported({
      codec: 'av01.0.08M.10',
      width: 1920,
      height: 1080,
      bitrate: 4_000_000,
      framerate: 30,
      hardwareAcceleration: 'no-preference',
    });
    codecs.av1 = !!av1Support.supported;
  } catch {}

  try {
    // Probe HEVC / H.265
    const hevcSupport = await VideoEncoder.isConfigSupported({
      codec: 'hvc1.1.6.L93.B0',
      width: 1920,
      height: 1080,
      bitrate: 4_000_000,
      framerate: 30,
      hardwareAcceleration: 'no-preference',
    });
    codecs.hevc = !!hevcSupport.supported;
  } catch {}

  if (typeof AudioEncoder !== 'undefined') {
    try {
      const aacSupport = await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000,
      });
      audioCodecs.aac = !!aacSupport.supported;
    } catch {}

    try {
      const opusSupport = await AudioEncoder.isConfigSupported({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000,
      });
      audioCodecs.opus = !!opusSupport.supported;
    } catch {}
  }

  return {
    supported: true,
    hasHardwareAcceleration,
    codecs,
    audioCodecs,
  };
}

/**
 * Helper to safely construct a Mediabunny Quality instance
 */
function resolveQuality(qualityStr?: string): Quality {
  const validLevels: QualityLevel[] = ['very-low', 'low', 'medium', 'high', 'very-high'];
  const level: QualityLevel = validLevels.includes(qualityStr as QualityLevel)
    ? (qualityStr as QualityLevel)
    : 'high';
  return new Quality(level);
}

/**
 * Calculates target dimensions based on resolution preset ('480', '720', '1080', '2k', '4k', '8k')
 */
export function getTargetDimensions(
  baseWidth: number,
  baseHeight: number,
  resolution?: string
): { width: number; height: number } {
  if (!resolution || resolution === 'original') {
    const w = Math.max(8, baseWidth - (baseWidth % 8));
    const h = Math.max(8, baseHeight - (baseHeight % 8));
    return { width: w, height: h };
  }

  let maxLongDim = 1920;
  let maxShortDim = 1080;

  switch (resolution) {
    case '480':
      maxLongDim = 854;
      maxShortDim = 480;
      break;
    case '720':
      maxLongDim = 1280;
      maxShortDim = 720;
      break;
    case '1080':
      maxLongDim = 1920;
      maxShortDim = 1080;
      break;
    case '2k':
      maxLongDim = 2560;
      maxShortDim = 1440;
      break;
    case '4k':
      maxLongDim = 3840;
      maxShortDim = 2160;
      break;
    case '8k':
      maxLongDim = 7680;
      maxShortDim = 4320;
      break;
    default:
      maxLongDim = 1920;
      maxShortDim = 1080;
      break;
  }

  const isLandscape = baseWidth >= baseHeight;
  const maxWidth = isLandscape ? maxLongDim : maxShortDim;
  const maxHeight = isLandscape ? maxShortDim : maxLongDim;

  let targetWidth = baseWidth;
  let targetHeight = baseHeight;

  // Scale to fit the requested bounding box, preserving aspect ratio (supports both upscale & downscale)
  const widthRatio = maxWidth / targetWidth;
  const heightRatio = maxHeight / targetHeight;
  const scale = Math.min(widthRatio, heightRatio);
  targetWidth = Math.round(targetWidth * scale);
  targetHeight = Math.round(targetHeight * scale);

  // Ensure dimensions are multiples of 8 for optimal hardware encoder compatibility
  targetWidth = Math.max(8, Math.round(targetWidth / 8) * 8);
  targetHeight = Math.max(8, Math.round(targetHeight / 8) * 8);

  return { width: targetWidth, height: targetHeight };
}

/**
 * Maps EncodeSpeed ('slow' | 'medium' | 'fast' | 'ultra-fast') to hardware acceleration and encoder latency hints
 */
function resolveSpeedConfig(speed?: string): {
  hardwareAcceleration: 'no-preference' | 'prefer-hardware' | 'prefer-software';
  latencyMode?: 'quality' | 'realtime';
} {
  switch (speed) {
    case 'ultra-fast':
      return { hardwareAcceleration: 'prefer-hardware', latencyMode: 'realtime' };
    case 'fast':
      return { hardwareAcceleration: 'prefer-hardware', latencyMode: 'quality' };
    case 'medium':
      return { hardwareAcceleration: 'no-preference', latencyMode: 'quality' };
    case 'slow':
      return { hardwareAcceleration: 'prefer-software', latencyMode: 'quality' };
    default:
      return { hardwareAcceleration: 'prefer-hardware', latencyMode: 'realtime' };
  }
}

/**
 * Automatically negotiates a supported video codec for the given resolution/quality.
 * Tries the preferred codec across all hardware acceleration modes before falling back to other candidates.
 */
async function negotiateVideoCodec(
  preferredCodec: VideoCodec,
  width: number,
  height: number,
  quality: Quality,
  hwAcceleration: 'no-preference' | 'prefer-hardware' | 'prefer-software' = 'prefer-hardware'
): Promise<{ codec: VideoCodec; hwAccel: 'no-preference' | 'prefer-hardware' | 'prefer-software' }> {
  const safeWidth = Math.max(8, width - (width % 8));
  const safeHeight = Math.max(8, height - (height % 8));

  const accelModes: ('prefer-hardware' | 'no-preference' | 'prefer-software')[] = [
    hwAcceleration,
    'no-preference',
    'prefer-software',
  ];
  const uniqueModes = Array.from(new Set(accelModes));

  // 1. FIRST: Try preferred codec across all acceleration modes
  for (const mode of uniqueModes) {
    try {
      const isSupported = await canEncodeVideo(preferredCodec, {
        width: safeWidth,
        height: safeHeight,
        quality,
        hardwareAcceleration: mode,
      });
      if (isSupported) return { codec: preferredCodec, hwAccel: mode };
    } catch {}
  }

  // 2. SECOND: If preferred codec is unsupported in all modes, try fallback candidates
  const fallbackCandidates: VideoCodec[] = Array.from(
    new Set([preferredCodec, 'hevc', 'av1', 'vp9', 'avc', 'vp8'])
  );

  for (const candidate of fallbackCandidates) {
    if (candidate === preferredCodec) continue;
    for (const mode of uniqueModes) {
      try {
        const supported = await canEncodeVideo(candidate, {
          width: safeWidth,
          height: safeHeight,
          quality,
          hardwareAcceleration: mode,
        });
        if (supported) return { codec: candidate, hwAccel: mode };
      } catch {}
    }
  }

  return { codec: preferredCodec, hwAccel: 'no-preference' };
}

/**
 * Automatically negotiates supported audio codec
 */
async function negotiateAudioCodec(preferredCodec: AudioCodec | string): Promise<AudioCodec> {
  const c = String(preferredCodec || 'opus').toLowerCase();
  let requested: AudioCodec = 'opus';
  if (c === 'aac' || c.includes('mp4a')) {
    requested = 'aac';
  } else if (c === 'flac') {
    requested = 'flac';
  } else if (c.includes('pcm')) {
    requested = 'pcm-s16';
  } else {
    requested = 'opus';
  }

  if (typeof AudioEncoder !== 'undefined') {
    const isSupported = async (cand: string) => {
      try {
        const res = await AudioEncoder.isConfigSupported({
          codec: cand,
          sampleRate: 48000,
          numberOfChannels: 2,
          bitrate: 192000,
        });
        return Boolean(res && res.supported);
      } catch {
        return false;
      }
    };

    if (requested === 'aac') {
      if (await isSupported('mp4a.40.2')) return 'aac';
      if (await isSupported('opus')) return 'opus';
    } else if (requested === 'opus') {
      if (await isSupported('opus')) return 'opus';
      if (await isSupported('mp4a.40.2')) return 'aac';
    } else if (requested === 'flac') {
      if (await isSupported('flac')) return 'flac';
      if (await isSupported('opus')) return 'opus';
    }
  }

  return requested;
}

/**
 * Creates Mediabunny Target for WebCodecs Output
 */
function createWebCodecsTarget(writable: FileSystemWritableFileStream | null): StreamTarget | BufferTarget {
  if (!writable) {
    return new BufferTarget();
  }

  const customWritable = new WritableStream<StreamTargetChunk>({
    async write(chunk) {
      if (writable && typeof writable.write === 'function') {
        try {
          if (typeof chunk.position === 'number' && typeof (writable as any).seek === 'function') {
            await (writable as any).seek(chunk.position);
            await writable.write(chunk.data);
          } else {
            await (writable as any).write(chunk);
          }
        } catch {
          try {
            if (typeof chunk.position === 'number') {
              await writable.write({ type: 'write', data: chunk.data, position: chunk.position } as any);
            } else {
              await writable.write(chunk.data);
            }
          } catch (innerErr) {
            console.error('Writable write failure in WebCodecs target:', innerErr);
            throw innerErr;
          }
        }
      }
    },
  });

  return new StreamTarget(customWritable, { chunked: true });
}

/**
 * Helper to build Canvas filter string from settings
 */
function buildCanvasFilterString(settings: EditSettings): string {
  let filterStr = `brightness(${settings.brightness}) contrast(${settings.contrast})`;
  switch (settings.filter) {
    case 'grayscale':
      filterStr += ' grayscale(100%)';
      break;
    case 'sepia':
      filterStr += ' sepia(100%)';
      break;
    case 'negative':
      filterStr += ' invert(100%)';
      break;
    case 'blur':
      filterStr += ' blur(3px)';
      break;
    case 'vignette':
      filterStr += ' contrast(120%) brightness(90%)';
      break;
    default:
      break;
  }
  return filterStr;
}

/**
 * Processes Single Video File using WebCodecs API (VideoDecoder & VideoEncoder)
 */
async function processImageToVideo(
  file: File,
  settings: EditSettings,
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  const startTime = performance.now();
  onProgress({
    percentage: 1,
    statusText: 'Initializing Image-to-Video Pipeline...',
    speedMBs: 0,
    log: `[WebCodecs API] Image Encoding Pipeline Initialized\nSource: ${file.name}`,
  });

  const bmp = await createImageBitmap(file);
  let sourceWidth = bmp.width;
  let sourceHeight = bmp.height;
  
  const hasCustomAspect = Boolean(settings.cropAspect && settings.cropAspect !== 'original');
  const hasResolutionPreset = Boolean(settings.resolution && settings.resolution !== 'original');

  let canvasWidth = sourceWidth;
  let canvasHeight = sourceHeight;

  if (hasCustomAspect) {
    if (settings.cropAspect === 'free' && settings.freeCropRect) {
      const rect = settings.freeCropRect;
      canvasWidth = Math.round(sourceWidth * Math.max(0.05, Math.min(1, rect.width || 1)));
      canvasHeight = Math.round(sourceHeight * Math.max(0.05, Math.min(1, rect.height || 1)));
    } else {
      let aspectMultiplier = 16 / 9;
      switch (settings.cropAspect) {
        case '16:9': aspectMultiplier = 16 / 9; break;
        case '4:3': aspectMultiplier = 4 / 3; break;
        case '1:1': aspectMultiplier = 1 / 1; break;
        case '4:5': aspectMultiplier = 4 / 5; break;
        case '9:16': aspectMultiplier = 9 / 16; break;
        case '21:9': aspectMultiplier = 21 / 9; break;
      }
      if (sourceWidth / sourceHeight > aspectMultiplier) {
        canvasHeight = sourceHeight;
        canvasWidth = Math.round(sourceHeight * aspectMultiplier);
      } else {
        canvasWidth = sourceWidth;
        canvasHeight = Math.round(sourceWidth / aspectMultiplier);
      }
    }
  }

  if (hasResolutionPreset) {
    const targetDims = getTargetDimensions(canvasWidth, canvasHeight, settings.resolution);
    canvasWidth = targetDims.width;
    canvasHeight = targetDims.height;
  }
  
  canvasWidth = Math.max(8, canvasWidth - (canvasWidth % 8));
  canvasHeight = Math.max(8, canvasHeight - (canvasHeight % 8));

  const speedConfig = resolveSpeedConfig(settings.encodeSpeed);
  const preferredVideoCodec = (settings.videoCodec as VideoCodec) || 'avc';
  const targetQuality = resolveQuality(settings.videoQuality);

  const negotiated = await negotiateVideoCodec(
    preferredVideoCodec,
    canvasWidth,
    canvasHeight,
    targetQuality,
    speedConfig.hardwareAcceleration
  );

  const targetVideoCodec = negotiated.codec;
  const targetHwAccel = negotiated.hwAccel;

  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  let outputFormat;
  if (ext === 'webm' || settings.outputFormat === 'webm' || targetVideoCodec === 'vp8' || targetVideoCodec === 'vp9') {
    outputFormat = new WebMOutputFormat();
  } else if (ext === 'mkv') {
    outputFormat = new MkvOutputFormat();
  } else {
    outputFormat = new Mp4OutputFormat({ fastStart: 'in-memory' });
  }

  const target = createWebCodecsTarget(writable);
  let totalWritten = 0;
  target.on('write', ({ end }) => {
    totalWritten = Math.max(totalWritten, end);
  });

  const fps = (settings.fps && settings.fps > 0) ? Math.min(240, Math.max(1, Math.round(settings.fps))) : 30;
  const output = new Output({ format: outputFormat, target });
  const vSource = new VideoSampleSource({
    codec: targetVideoCodec,
    quality: targetQuality,
    hardwareAcceleration: targetHwAccel,
    latencyMode: speedConfig.latencyMode,
    width: canvasWidth,
    height: canvasHeight,
    framerate: fps,
  });
  
  output.addVideoTrack(vSource, { width: canvasWidth, height: canvasHeight, framerate: fps, fps });
  await output.start();

  const durationSecs = (settings.duration && settings.duration > 0) ? settings.duration : 5;
  const actualDuration = (settings.endTime > 0 && settings.endTime < durationSecs) ? settings.endTime : durationSecs;
  const frames = Math.ceil(actualDuration * fps);
  const frameDurationSec = 1 / fps;

  let offscreenCanvas: OffscreenCanvas | HTMLCanvasElement;
  let canvasCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  
  if (typeof OffscreenCanvas !== 'undefined') {
    offscreenCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    canvasCtx = offscreenCanvas.getContext('2d');
  } else {
    offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = canvasWidth;
    offscreenCanvas.height = canvasHeight;
    canvasCtx = offscreenCanvas.getContext('2d');
  }
  
  let lastTime = performance.now();
  let lastBytes = 0;
  
  for (let f = 0; f < frames; f++) {
    const origDuration = frameDurationSec;
    const w = canvasWidth;
    const h = canvasHeight;
    
    if (canvasCtx) {
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, w, h);
      
      canvasCtx.filter = buildCanvasFilterString(settings);
      if (settings.flipH || settings.flipV) {
        canvasCtx.translate(settings.flipH ? w : 0, settings.flipV ? h : 0);
        canvasCtx.scale(settings.flipH ? -1 : 1, settings.flipV ? -1 : 1);
      }
      
      const srcRatio = sourceWidth / sourceHeight;
      const dstRatio = w / h;
      
      if (settings.cropAspect === 'free' && settings.freeCropRect) {
        const rect = settings.freeCropRect;
        const sx = Math.max(0, Math.min(sourceWidth - 2, Math.round(sourceWidth * (rect.x || 0))));
        const sy = Math.max(0, Math.min(sourceHeight - 2, Math.round(sourceHeight * (rect.y || 0))));
        const sw = Math.max(8, Math.min(sourceWidth - sx, Math.round(sourceWidth * (rect.width || 1))));
        const sh = Math.max(8, Math.min(sourceHeight - sy, Math.round(sourceHeight * (rect.height || 1))));
        canvasCtx.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h);
      } else if (Math.abs(srcRatio - dstRatio) > 0.01) {
        let sx = 0; let sy = 0; let sw = sourceWidth; let sh = sourceHeight;
        if (srcRatio > dstRatio) {
          sw = sourceHeight * dstRatio;
          sx = (sourceWidth - sw) / 2;
        } else {
          sh = sourceWidth / dstRatio;
          sy = (sourceHeight - sh) / 2;
        }
        canvasCtx.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h);
      } else {
        canvasCtx.drawImage(bmp, 0, 0, w, h);
      }
      canvasCtx.restore();
      
      if (settings.watermarkText && settings.watermarkText.trim()) {
        canvasCtx.save();
        const fontSize = settings.watermarkSize || 24;
        canvasCtx.font = `bold ${fontSize}px sans-serif`;
        canvasCtx.fillStyle = settings.watermarkColor || '#ffffff';
        canvasCtx.shadowColor = 'rgba(0,0,0,0.8)';
        canvasCtx.shadowBlur = 4;
        canvasCtx.shadowOffsetX = 1;
        canvasCtx.shadowOffsetY = 1;
        const text = settings.watermarkText;
        const textMetrics = canvasCtx.measureText(text);
        const padding = 20;
        let x = padding; let y = h - padding;
        switch (settings.watermarkPosition) {
          case 'top-left': x = padding; y = padding + fontSize; break;
          case 'top-right': x = w - textMetrics.width - padding; y = padding + fontSize; break;
          case 'bottom-left': x = padding; y = h - padding; break;
          case 'bottom-right': x = w - textMetrics.width - padding; y = h - padding; break;
          case 'center': x = (w - textMetrics.width) / 2; y = (h + fontSize) / 2; break;
        }
        canvasCtx.fillText(text, x, y);
        canvasCtx.restore();
      }
    }
    
    const pSample = new VideoSample(offscreenCanvas, { timestamp: f * frameDurationSec, duration: origDuration });
    await vSource.add(pSample);
    pSample.close();
    
    const now = performance.now();
    const elapsed = (now - lastTime) / 1000;
    if (elapsed > 0.5 || f === frames - 1) {
      const speedMBs = (totalWritten - lastBytes) / (1024 * 1024) / elapsed;
      lastTime = now;
      lastBytes = totalWritten;
      const currentPercent = Math.round((f / frames) * 100);
      onProgress({
        percentage: currentPercent,
        statusText: `Encoding Image (${currentPercent}%)...`,
        speedMBs,
      });
    }
  }
  
  bmp.close();
  await output.finalize();

  let blobUrl;
  if (target instanceof BufferTarget && target.buffer) {
    const isMp4 = outputFormat instanceof Mp4OutputFormat;
    const isMkv = outputFormat instanceof MkvOutputFormat;
    const mime = isMp4 ? 'video/mp4' : isMkv ? 'video/x-matroska' : 'video/webm';
    const blob = new Blob([target.buffer], { type: mime });
    blobUrl = URL.createObjectURL(blob);
    totalWritten = target.buffer.byteLength;
  }

  onProgress({
    percentage: 100,
    statusText: 'Image Encoding Complete!',
    speedMBs: 0,
    log: `[WebCodecs API] Image encoding finished. Total: ${(totalWritten / (1024 * 1024)).toFixed(2)} MB`,
  });

  return {
    success: true,
    totalBytesWritten: totalWritten,
    blobUrl,
  };
}

export async function processWebCodecsEncodeStream(
  file: File,
  settings: EditSettings,
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  if (!isWebCodecsSupported()) {
    throw new Error('WebCodecs API is not supported in this browser.');
  }

  const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(file.name);
  if (isImage) {
    return processImageToVideo(file, settings, writable, onProgress);
  }

  const startTime = performance.now();
  onProgress({
    percentage: 1,
    statusText: 'Initializing WebCodecs API Processing Pipeline...',
    speedMBs: 0,
    log: `[WebCodecs API] Video Encoding Pipeline Initialized\n[WebCodecs API] Source: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`,
  });

  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  });

  // Inspect source video properties
  const videoTracks = await input.getVideoTracks();
  const audioTracks = await input.getAudioTracks();

  let rawWidth = 1920;
  let rawHeight = 1080;
  let sourceDuration = settings.duration || 0;

  if (videoTracks.length > 0) {
    const vTrack = videoTracks[0];
    rawWidth = vTrack.displayWidth || vTrack.codedWidth || 1920;
    rawHeight = vTrack.displayHeight || vTrack.codedHeight || 1080;
    const dur = await vTrack.computeDuration();
    if (dur && dur > 0) sourceDuration = dur;
    const codec = await vTrack.getCodec();
    onProgress({
      percentage: 3,
      statusText: `WebCodecs: Detected Video Track ${rawWidth}x${rawHeight} (${codec || 'H.264'})`,
      speedMBs: 0,
      log: `[WebCodecs API] Video Stream: ${rawWidth}x${rawHeight} (${codec || 'H.264'}), Duration: ${sourceDuration.toFixed(2)}s`,
    });
  }

  // Ensure dimensions are even numbers (vital for AVC/HEVC/VP9 hardware & software encoders)
  const sourceWidth = Math.max(8, rawWidth - (rawWidth % 8));
  const sourceHeight = Math.max(8, rawHeight - (rawHeight % 8));

  // Calculate Trim Timestamps
  let trimStart = settings.startTime > 0 ? settings.startTime : undefined;
  if (trimStart !== undefined && trimStart >= sourceDuration) trimStart = Math.max(0, sourceDuration - 0.1);
  let trimEnd: number | undefined = undefined;
  if (settings.endTime > 0 && sourceDuration > 0 && settings.endTime < sourceDuration - 0.1) {
    const isFullVideo = settings.duration > 0 && Math.abs(settings.endTime - settings.duration) < 0.1;
    if (!isFullVideo) {
      trimEnd = settings.endTime;
    }
  }
  if (trimStart !== undefined && trimEnd !== undefined && trimStart >= trimEnd) trimStart = Math.max(0, trimEnd - 0.1);

  onProgress({
    percentage: 5,
    statusText: 'Negotiating WebCodecs VideoEncoder & AudioEncoder configuration...',
    speedMBs: 0,
    log: `[WebCodecs API] Trim Range: ${trimStart ? `${trimStart.toFixed(2)}s` : '0.00s'} -> ${trimEnd ? `${trimEnd.toFixed(2)}s` : `${sourceDuration.toFixed(2)}s`}`,
  });

  // Check if we need canvas frame filtering (brightness, contrast, watermark, filters, flip, aspect ratio, resolution change)
  const hasCustomAspect = Boolean(settings.cropAspect && settings.cropAspect !== 'original');
  const hasResolutionPreset = Boolean(settings.resolution && settings.resolution !== 'original');

  let canvasWidth = sourceWidth;
  let canvasHeight = sourceHeight;

  if (hasCustomAspect) {
    if (settings.cropAspect === 'free' && settings.freeCropRect) {
      const rect = settings.freeCropRect;
      canvasWidth = Math.round(sourceWidth * Math.max(0.05, Math.min(1, rect.width || 1)));
      canvasHeight = Math.round(sourceHeight * Math.max(0.05, Math.min(1, rect.height || 1)));
    } else {
      let aspectMultiplier = 16 / 9;
      switch (settings.cropAspect) {
        case '16:9': aspectMultiplier = 16 / 9; break;
        case '4:3': aspectMultiplier = 4 / 3; break;
        case '1:1': aspectMultiplier = 1 / 1; break;
        case '4:5': aspectMultiplier = 4 / 5; break;
        case '9:16': aspectMultiplier = 9 / 16; break;
        case '21:9': aspectMultiplier = 21 / 9; break;
      }

      if (sourceWidth / sourceHeight > aspectMultiplier) {
        // Source is wider than target ratio
        canvasHeight = sourceHeight;
        canvasWidth = Math.round(sourceHeight * aspectMultiplier);
      } else {
        // Source is taller than target ratio
        canvasWidth = sourceWidth;
        canvasHeight = Math.round(sourceWidth / aspectMultiplier);
      }
    }

    // Ensure even dimensions
    canvasWidth = Math.max(8, canvasWidth - (canvasWidth % 8));
    canvasHeight = Math.max(8, canvasHeight - (canvasHeight % 8));

    onProgress({
      percentage: 7,
      statusText: `Applied scale ${settings.cropAspect}: Target resolution ${canvasWidth}x${canvasHeight}`,
      speedMBs: 0,
      log: `[WebCodecs API] Scale Aspect Ratio: ${settings.cropAspect} (Calculated Target Dimensions: ${canvasWidth}x${canvasHeight})`,
    });
  }

  if (hasResolutionPreset) {
    const targetDims = getTargetDimensions(canvasWidth, canvasHeight, settings.resolution);
    canvasWidth = targetDims.width;
    canvasHeight = targetDims.height;
    onProgress({
      percentage: 8,
      statusText: `Applied resolution preset: ${settings.resolution?.toUpperCase()} (${canvasWidth}x${canvasHeight})`,
      speedMBs: 0,
      log: `[WebCodecs API] Target Resolution: ${settings.resolution?.toUpperCase()} -> ${canvasWidth}x${canvasHeight}`,
    });
  }

  const needsCanvasProcessing =
    settings.filter !== 'none' ||
    settings.brightness !== 1.0 ||
    settings.contrast !== 1.0 ||
    settings.flipH ||
    settings.flipV ||
    Boolean(settings.watermarkText?.trim()) ||
    hasCustomAspect ||
    hasResolutionPreset;

  // Determine Speed, Video Codec & Quality with fallback negotiation using target dimensions
  const speedConfig = resolveSpeedConfig(settings.encodeSpeed);
  const preferredVideoCodec: VideoCodec = (settings.videoCodec as VideoCodec) || 'avc';
  const targetQuality = resolveQuality(settings.videoQuality);
  const negotiated = await negotiateVideoCodec(
    preferredVideoCodec,
    canvasWidth,
    canvasHeight,
    targetQuality,
    speedConfig.hardwareAcceleration
  );
  const targetVideoCodec = negotiated.codec;
  const targetHwAccel = negotiated.hwAccel;

  const preferredAudioCodec: AudioCodec = (settings.audioCodec as AudioCodec) || 'opus';
  const targetAudioCodec = await negotiateAudioCodec(preferredAudioCodec);

  const vidLog = targetVideoCodec === preferredVideoCodec
    ? `${targetVideoCodec.toUpperCase()} (${targetHwAccel})`
    : `${targetVideoCodec.toUpperCase()} (Fallback from ${preferredVideoCodec.toUpperCase()})`;
  const normPrefAud = (preferredAudioCodec as string) === 'pcm-s16le' ? 'pcm-s16' : preferredAudioCodec;
  const audLog = targetAudioCodec === normPrefAud
    ? `${targetAudioCodec.toUpperCase()}`
    : `${targetAudioCodec.toUpperCase()} (Fallback from ${preferredAudioCodec.toUpperCase()})`;

  onProgress({
    percentage: 1,
    statusText: `Encoding via WebCodecs (${targetVideoCodec.toUpperCase()} / ${targetAudioCodec.toUpperCase()})`,
    speedMBs: 0,
    log: `[WebCodecs Pipeline] Video Codec: ${vidLog} | Audio Codec: ${audLog}`,
  });

  // Determine Output Format compatible with negotiated codecs
  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  const reqFormat = (settings.outputFormat || (settings as any).containerFormat || '').toLowerCase();
  const targetExt = reqFormat || ext;

  let outputFormat;
  if (targetExt === 'webm' || settings.outputFormat === 'webm') {
    outputFormat = new WebMOutputFormat();
  } else if (targetExt === 'mkv' || settings.outputFormat === 'mkv') {
    outputFormat = new MkvOutputFormat();
  } else {
    // Standard MP4 with complete sample tables and accurate duration metadata
    outputFormat = new Mp4OutputFormat({ fastStart: 'in-memory' });
  }

  const target = createWebCodecsTarget(writable);
  let totalWritten = 0;
  target.on('write', ({ end }) => {
    totalWritten = Math.max(totalWritten, end);
  });

  const output = new Output({ format: outputFormat, target });

  let offscreenCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
  let canvasCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;

  if (needsCanvasProcessing) {
    if (typeof OffscreenCanvas !== 'undefined') {
      offscreenCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
      canvasCtx = offscreenCanvas.getContext('2d');
    } else if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = canvasWidth;
      c.height = canvasHeight;
      offscreenCanvas = c;
      canvasCtx = c.getContext('2d');
    }
  }

  // Configure Mediabunny WebCodecs Pipeline with selected speed/acceleration configuration
  const conversion = await Conversion.init({
    input,
    output,
    trim: {
      start: trimStart,
      end: trimEnd,
    },
    video: {
      forceTranscode: true, // Forces WebCodecs VideoDecoder -> VideoEncoder pipeline
      codec: targetVideoCodec,
      quality: targetQuality,
      hardwareAcceleration: targetHwAccel,
      latencyMode: speedConfig.latencyMode,
      frameRate: (settings.fps && settings.fps > 0) ? Math.min(240, Math.max(1, Math.round(settings.fps))) : undefined,
      width: canvasWidth,
      height: canvasHeight,
      processedWidth: canvasWidth,
      processedHeight: canvasHeight,
      fit: 'cover',
      rotate: (settings.rotation as any) || undefined,
      allowRotationMetadata: false, // Bakes rotation into the WebCodecs pixel buffer
      process: needsCanvasProcessing && offscreenCanvas && canvasCtx
        ? async (sample: VideoSample) => {
            const canvas = offscreenCanvas!;
            const ctx = canvasCtx!;

            const img = sample.toCanvasImageSource();
            const w = canvas.width;
            const h = canvas.height;

            ctx.save();
            ctx.clearRect(0, 0, w, h);

            if (!isValidCanvasImageSource(img)) {
              ctx.restore();
              return;
            }

            try {
              // Apply CSS Filters (Brightness, Contrast, Grayscale, etc.)
              ctx.filter = buildCanvasFilterString(settings);

              // Apply Horizontal / Vertical Flips
              if (settings.flipH || settings.flipV) {
                ctx.translate(settings.flipH ? w : 0, settings.flipV ? h : 0);
                ctx.scale(settings.flipH ? -1 : 1, settings.flipV ? -1 : 1);
              }

              // Calculate source crop rectangle to preserve aspect ratio without distortion
              const srcWidth = (img as any).width || (img as any).videoWidth || (sample as any).displayWidth || (sample as any).codedWidth || w;
              const srcHeight = (img as any).height || (img as any).videoHeight || (sample as any).displayHeight || (sample as any).codedHeight || h;

              const srcRatio = srcWidth / srcHeight;
              const dstRatio = w / h;

              if (settings.cropAspect === 'free' && settings.freeCropRect) {
                const rect = settings.freeCropRect;
                const sx = Math.max(0, Math.min(srcWidth - 2, Math.round(srcWidth * (rect.x || 0))));
                const sy = Math.max(0, Math.min(srcHeight - 2, Math.round(srcHeight * (rect.y || 0))));
                const sw = Math.max(8, Math.min(srcWidth - sx, Math.round(srcWidth * (rect.width || 1))));
                const sh = Math.max(8, Math.min(srcHeight - sy, Math.round(srcHeight * (rect.height || 1))));
                ctx.drawImage(img as any, sx, sy, sw, sh, 0, 0, w, h);
              } else if (Math.abs(srcRatio - dstRatio) > 0.01) {
                let sx = 0;
                let sy = 0;
                let sw = srcWidth;
                let sh = srcHeight;
                if (srcRatio > dstRatio) {
                  // Source is wider than destination: crop sides
                  sw = srcHeight * dstRatio;
                  sx = (srcWidth - sw) / 2;
                } else {
                  // Source is taller than destination: crop top/bottom
                  sh = srcWidth / dstRatio;
                  sy = (srcHeight - sh) / 2;
                }
                ctx.drawImage(img as any, sx, sy, sw, sh, 0, 0, w, h);
              } else {
                // 5-parameter drawImage maps VideoFrame visibleRect directly without codedWidth padding
                ctx.drawImage(img as any, 0, 0, w, h);
              }
            } catch (drawErr) {
              console.warn('Canvas process drawImage failed:', drawErr);
            } finally {
              ctx.restore();
            }

            // Apply Watermark Overlay
            if (settings.watermarkText && settings.watermarkText.trim()) {
              ctx.save();
              const fontSize = settings.watermarkSize || 24;
              ctx.font = `bold ${fontSize}px sans-serif`;
              ctx.fillStyle = settings.watermarkColor || '#ffffff';
              ctx.shadowColor = 'rgba(0,0,0,0.8)';
              ctx.shadowBlur = 4;
              ctx.shadowOffsetX = 1;
              ctx.shadowOffsetY = 1;
              const text = settings.watermarkText;
              const textMetrics = ctx.measureText(text);
              const padding = 20;

              let x = padding;
              let y = h - padding;

              switch (settings.watermarkPosition) {
                case 'top-left':
                  x = padding;
                  y = padding + fontSize;
                  break;
                case 'top-right':
                  x = w - textMetrics.width - padding;
                  y = padding + fontSize;
                  break;
                case 'bottom-left':
                  x = padding;
                  y = h - padding;
                  break;
                case 'bottom-right':
                  x = w - textMetrics.width - padding;
                  y = h - padding;
                  break;
                case 'center':
                  x = (w - textMetrics.width) / 2;
                  y = (h + fontSize) / 2;
                  break;
              }

              ctx.fillText(text, x, y);
              ctx.restore();
            }

            return canvas as any;
          }
        : undefined,
    },
    audio: {
      discard: settings.muteAudio,
      forceTranscode: true, // Forces WebCodecs AudioDecoder -> AudioEncoder
      codec: targetAudioCodec,
      ...(settings.audioBitrate && settings.audioBitrate > 0
        ? { bitrate: settings.audioBitrate * 1000 }
        : { quality: resolveQuality('high') }),
    },
  });

  let lastTime = performance.now();
  let lastBytes = 0;
  let lastPercent = 0;

  conversion.onProgress = (prog: number) => {
    const now = performance.now();
    const elapsed = (now - lastTime) / 1000;
    let speedMBs = 0;
    if (elapsed > 0.5) {
      speedMBs = (totalWritten - lastBytes) / (1024 * 1024) / elapsed;
      lastTime = now;
      lastBytes = totalWritten;
    }

    const currentPercent = Math.min(99, Math.max(5, Math.round(prog * 100)));
    if (currentPercent !== lastPercent) {
      lastPercent = currentPercent;
      onProgress({
        percentage: currentPercent,
        statusText: `WebCodecs Re-Encoding (${currentPercent}%)...`,
        speedMBs,
        log: `[WebCodecs Encode] Progress: ${currentPercent}% | Written: ${(totalWritten / (1024 * 1024)).toFixed(2)} MB | Speed: ${speedMBs.toFixed(1)} MB/s`,
      });
    }
  };

  onProgress({
    percentage: 10,
    statusText: 'WebCodecs VideoEncoder actively processing frames...',
    speedMBs: 0,
    log: `[WebCodecs API] VideoEncoder started with Codec: ${targetVideoCodec.toUpperCase()} (HW: ${targetHwAccel}) (Audio: ${targetAudioCodec.toUpperCase()}) | Quality: ${settings.videoQuality || 'high'}`,
  });

  try {
    await conversion.execute();
  } catch (err: any) {
    if (err?.message?.includes('not supported') && targetHwAccel !== 'no-preference') {
      onProgress({
        percentage: 10,
        statusText: 'Hardware encoder rejected. Retrying with software encoder...',
        speedMBs: 0,
        log: `[WebCodecs API] Hardware encoder failed. Retrying with no-preference (Software). Error: ${err.message}`,
      });
      // Patch conversion object to use no-preference and retry
      if ((conversion as any).options?.video) {
        (conversion as any).options.video.hardwareAcceleration = 'no-preference';
        await conversion.execute();
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }

  let blobUrl: string | undefined;
  if (target instanceof BufferTarget && target.buffer) {
    const isMp4 = outputFormat instanceof Mp4OutputFormat;
    const isMkv = outputFormat instanceof MkvOutputFormat;
    const mime = isMp4 ? 'video/mp4' : isMkv ? 'video/x-matroska' : 'video/webm';
    const blob = new Blob([target.buffer], { type: mime });
    blobUrl = URL.createObjectURL(blob);
    totalWritten = target.buffer.byteLength;
  }

  const totalTimeSeconds = ((performance.now() - startTime) / 1000).toFixed(2);
  onProgress({
    percentage: 100,
    statusText: 'WebCodecs Encoding Complete!',
    speedMBs: 0,
    log: `[WebCodecs API] Encoding finished successfully in ${totalTimeSeconds}s! Total output size: ${(totalWritten / (1024 * 1024)).toFixed(2)} MB`,
  });

  return {
    success: true,
    totalBytesWritten: totalWritten,
    blobUrl,
  };
}

/**
 * Multi-Track Timeline Compositing & Transcoding Engine
 * Composites multiple timeline tracks (Base Track 0 + Overlays Track 1, 2, ... N-1)
 * concurrently across timeline time, respecting Z-index, transforms, and duration.
 */
const TRANSITION_HALF = 0.5;

function calculateTransitionState(
  activeClip: TimelineClip,
  prevClip: TimelineClip | null,
  nextClip: TimelineClip | null,
  t: number
): { isActive: boolean; opacity: number; clipPath?: string } {
  const clipStart = activeClip.startTime || 0;
  const clipDur = activeClip.endTime !== undefined && activeClip.endTime > clipStart
    ? activeClip.endTime - clipStart
    : activeClip.duration || activeClip.fileDuration || (activeClip.mediaType === 'image' ? 5 : 10);
  const clipEnd = clipStart + clipDur;

  const prevClipEnd = prevClip
    ? (prevClip.endTime !== undefined && prevClip.endTime > (prevClip.startTime || 0)
        ? prevClip.endTime
        : (prevClip.startTime || 0) + (prevClip.duration || prevClip.fileDuration || 10))
    : 0;

  const hasOutgoing = activeClip.transition && activeClip.transition !== 'none' && nextClip && Math.abs(clipEnd - (nextClip.startTime || 0)) < 0.15;
  const hasIncoming = prevClip && prevClip.transition && prevClip.transition !== 'none' && Math.abs(prevClipEnd - clipStart) < 0.15;

  const isNormallyActive = t >= clipStart && t <= clipEnd;
  const isInOutgoing = hasOutgoing && t >= (clipEnd - TRANSITION_HALF) && t <= (clipEnd + TRANSITION_HALF);
  const isInIncoming = hasIncoming && t >= (prevClipEnd - TRANSITION_HALF) && t <= (prevClipEnd + TRANSITION_HALF);
  const isSoloFadeEnd = activeClip.transition === 'fade' && !hasOutgoing && t >= (clipEnd - TRANSITION_HALF) && t <= clipEnd;

  if (!isNormallyActive && !isInOutgoing && !isInIncoming && !isSoloFadeEnd) {
    return { isActive: false, opacity: 1.0 };
  }

  let transitionOpacity = 1.0;
  let transitionClipPath: string | undefined = undefined;

  if (isInOutgoing) {
    const transType = activeClip.transition;
    const p = Math.max(0, Math.min(1, (t - (clipEnd - TRANSITION_HALF)) / (2 * TRANSITION_HALF)));
    if (transType === 'fade') {
      transitionOpacity = p <= 0.5 ? (1.0 - p * 2) : 0.0;
    } else if (transType === 'crossfade' || transType === 'dissolve') {
      transitionOpacity = 1.0 - p;
    } else if (transType === 'wipe') {
      transitionOpacity = 1.0;
    }
  } else if (isInIncoming) {
    const transType = prevClip!.transition;
    const p = Math.max(0, Math.min(1, (t - (prevClipEnd - TRANSITION_HALF)) / (2 * TRANSITION_HALF)));
    if (transType === 'fade') {
      transitionOpacity = p > 0.5 ? ((p - 0.5) * 2) : 0.0;
    } else if (transType === 'crossfade' || transType === 'dissolve') {
      transitionOpacity = p;
    } else if (transType === 'wipe') {
      transitionOpacity = 1.0;
      const pct = Math.round(p * 100);
      transitionClipPath = `polygon(0 0, ${pct}% 0, ${pct}% 100%, 0 100%)`;
    }
  } else if (isSoloFadeEnd) {
    const p = Math.max(0, Math.min(1, (t - (clipEnd - TRANSITION_HALF)) / TRANSITION_HALF));
    transitionOpacity = 1.0 - p;
  }

  return { isActive: true, opacity: transitionOpacity, clipPath: transitionClipPath };
}

export async function processWebCodecsMultiTrackTimeline(
  tracks: TimelineTrackData[],
  settings: EditSettings,
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void,
  abortSignal?: AbortSignal
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  await HardwareBlurEngine.instance.init();
  if (!isWebCodecsSupported()) {
    throw new Error('WebCodecs API is not supported in this browser.');
  }

  const visibleTracks = tracks.filter((t) => !t.hidden && t.clips && t.clips.length > 0);
  if (visibleTracks.length === 0) {
    throw new Error('No visible tracks or clips to export.');
  }

  // Pre-probe clip durations if missing or uninitialized
  for (const track of visibleTracks) {
    for (const clip of track.clips) {
      if (clip.file) {
        const isImg = clip.mediaType === 'image' || clip.file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(clip.file.name);
        if (!isImg) {
          let realDur = clip.fileDuration;
          const isPlaceholder10 =
            !clip.isTrimmed &&
            clip.fileDuration === 10 &&
            Math.abs((clip.endTime || 0) - (clip.startTime || 0) - 10) < 0.05;
          if (!realDur || isPlaceholder10 || clip.endTime === undefined || clip.endTime <= clip.startTime) {
            let probedDur = 0;
            const isAud = clip.mediaType === 'audio' || clip.file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac|opus)$/i.test(clip.file.name);
            if (isAud) {
              const audioBuf = await getAudioBufferForFile(clip.file);
              if (audioBuf) {
                probedDur = audioBuf.duration;
              }
            }
            if (!probedDur) {
              try {
                const probeInput = new Input({ source: new BlobSource(clip.file), formats: ALL_FORMATS });
                const vTracks = await probeInput.getVideoTracks();
                if (vTracks.length > 0) {
                  const d = await vTracks[0].computeDuration();
                  if (d && Number.isFinite(d) && d > 0) probedDur = d;
                }
                if (!probedDur) {
                  const aTracks = await probeInput.getAudioTracks();
                  if (aTracks.length > 0) {
                    const d = await aTracks[0].computeDuration();
                    if (d && Number.isFinite(d) && d > 0) probedDur = d;
                  }
                }
              } catch (e) {
                console.warn('Demuxer probe warning in MultiTrackTimeline:', e);
              }
            }
            if (probedDur > 0) {
              realDur = probedDur;
            }
          }

          if (realDur && realDur > 0) {
            clip.fileDuration = realDur;
            if (clip.endTime === undefined || clip.endTime <= clip.startTime || isPlaceholder10) {
              clip.endTime = (clip.startTime || 0) + realDur;
              clip.sourceEndTime = realDur;
            }
          }
        }
      }
    }
  }

  let minTimelineStart = Infinity;
  let maxTimelineEnd = 0;
  visibleTracks.forEach((t) => {
    t.clips.forEach((c) => {
      const start = c.startTime || 0;
      const dur =
        c.endTime !== undefined && c.startTime !== undefined && c.endTime > c.startTime
          ? c.endTime - c.startTime
          : c.duration || c.fileDuration || (c.mediaType === 'image' ? 5 : 10);
      const clipEnd = start + dur;
      if (start < minTimelineStart) minTimelineStart = start;
      if (clipEnd > maxTimelineEnd) maxTimelineEnd = clipEnd;
    });
  });

  if (minTimelineStart === Infinity) minTimelineStart = 0;

  const exportStart = minTimelineStart;
  const exportEnd = maxTimelineEnd > exportStart ? maxTimelineEnd : (settings.endTime > exportStart ? settings.endTime : exportStart + 10);
  const exportDuration = Math.max(0.1, exportEnd - exportStart);

  onProgress({
    percentage: 1,
    statusText: `Initializing True Multi-Track Engine (${visibleTracks.length} tracks, ${exportDuration.toFixed(2)}s)...`,
    speedMBs: 0,
    log: `[WebCodecs] True Compositor: ${visibleTracks.length} tracks, Duration: ${exportDuration.toFixed(2)}s`,
  });

  const bitmapMap = new Map<string, ImageBitmap>();
  for (const track of visibleTracks) {
    for (const clip of track.clips) {
      const isImg = clip.mediaType === 'image' || (clip.file && clip.file.type.startsWith('image/')) || (clip.file && /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(clip.file.name));
      if (isImg && clip.file) {
        try {
          const bmp = await createImageBitmap(clip.file);
          bitmapMap.set(clip.id, bmp);
        } catch (e) {
          console.warn('Failed to preload bitmap', e);
        }
      }
    }
  }

  let sourceWidth = 1920;
  let sourceHeight = 1080;
  let sourceFps = 30;
  let hasValidDims = false;

  for (const track of visibleTracks) {
    for (const clip of track.clips) {
      if (!clip.file) continue;
      const isImg = clip.mediaType === 'image' || clip.file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(clip.file.name);
      const isAudio = clip.mediaType === 'audio' || clip.file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac|opus|wma)$/i.test(clip.file.name);
      if (isImg) {
        const bmp = bitmapMap.get(clip.id);
        if (bmp && bmp.width > 0 && bmp.height > 0) {
          if (!hasValidDims) { sourceWidth = bmp.width; sourceHeight = bmp.height; hasValidDims = true; }
        }
      } else if (!isAudio) {
        try {
          const probeInput = new Input({ source: new BlobSource(clip.file), formats: ALL_FORMATS });
          const probeVTracks = await probeInput.getVideoTracks();
          if (probeVTracks.length > 0) {
            sourceWidth = probeVTracks[0].displayWidth || probeVTracks[0].codedWidth || 1920;
            sourceHeight = probeVTracks[0].displayHeight || probeVTracks[0].codedHeight || 1080;
            if (probeVTracks[0].trackInfo?.fps > 0) {
              sourceFps = probeVTracks[0].trackInfo.fps;
            }
            hasValidDims = true;
            break;
          }
        } catch (e) {}
      }
    }
    if (hasValidDims) break;
  }

  sourceWidth = Math.max(8, Math.round(sourceWidth / 8) * 8);
  sourceHeight = Math.max(8, Math.round(sourceHeight / 8) * 8);

  const hasCustomAspect = Boolean(settings.cropAspect && settings.cropAspect !== 'original');
  const hasResolutionPreset = Boolean(settings.resolution && settings.resolution !== 'original');
  let canvasWidth = sourceWidth;
  let canvasHeight = sourceHeight;

  if (hasCustomAspect) {
    const [num, den] = (settings.cropAspect as string).split(':').map(Number);
    if (num && den) {
      if (sourceWidth / sourceHeight > num / den) canvasWidth = Math.round(sourceHeight * (num / den));
      else canvasHeight = Math.round(sourceWidth / (num / den));
    }
  }
  if (hasResolutionPreset) {
    const targetDims = getTargetDimensions(canvasWidth, canvasHeight, settings.resolution);
    canvasWidth = targetDims.width;
    canvasHeight = targetDims.height;
  }

  // Ensure canvas dimensions are strictly multiples of 8 for hardware encoder macroblock alignment
  canvasWidth = Math.max(8, Math.round(canvasWidth / 8) * 8);
  canvasHeight = Math.max(8, Math.round(canvasHeight / 8) * 8);

  const preferredVideoCodec: VideoCodec = (settings.videoCodec as VideoCodec) || 'avc';
  const targetQuality = resolveQuality(settings.videoQuality);
  const speedConfig = resolveSpeedConfig(settings.encodeSpeed);

  const negotiated = await negotiateVideoCodec(preferredVideoCodec, canvasWidth, canvasHeight, targetQuality, speedConfig.hardwareAcceleration);
  const targetVideoCodec = negotiated.codec;
  const targetHwAccel = negotiated.hwAccel;

  const preferredAudioCodec: AudioCodec = (settings.audioCodec as AudioCodec) || 'opus';
  const targetAudioCodec = await negotiateAudioCodec(preferredAudioCodec);

  const vidLog = targetVideoCodec === preferredVideoCodec
    ? `${targetVideoCodec.toUpperCase()} (${targetHwAccel})`
    : `${targetVideoCodec.toUpperCase()} (Fallback from ${preferredVideoCodec.toUpperCase()})`;
  const normPrefAud = (preferredAudioCodec as string) === 'pcm-s16le' ? 'pcm-s16' : preferredAudioCodec;
  const audLog = targetAudioCodec === normPrefAud
    ? `${targetAudioCodec.toUpperCase()}`
    : `${targetAudioCodec.toUpperCase()} (Fallback from ${preferredAudioCodec.toUpperCase()})`;

  onProgress({
    percentage: 1,
    statusText: `Multi-track Timeline Initialized (${targetVideoCodec.toUpperCase()} / ${targetAudioCodec.toUpperCase()})`,
    speedMBs: 0,
    log: `[WebCodecs Pipeline] Timeline Video Codec: ${vidLog} | Audio Codec: ${audLog} | Target: ${canvasWidth}x${canvasHeight}`,
  });

  let outputFormat;
  const requestedFormat = (settings.outputFormat || (settings as any).containerFormat || '').toLowerCase();
  const firstFileExt = visibleTracks[0]?.clips[0]?.file?.name.split('.').pop()?.toLowerCase() || 'mp4';
  const effectiveFormat = requestedFormat || firstFileExt;

  if (effectiveFormat === 'webm') outputFormat = new WebMOutputFormat();
  else if (effectiveFormat === 'mkv') outputFormat = new MkvOutputFormat();
  else outputFormat = new Mp4OutputFormat({ fastStart: 'in-memory' });

  const target = createWebCodecsTarget(writable);
  let totalWritten = 0;
  target.on('write', ({ end }) => { totalWritten = Math.max(totalWritten, end); });

  const fps = (settings.fps && settings.fps > 0)
    ? Math.min(240, Math.max(1, Math.round(settings.fps)))
    : Math.min(240, Math.max(1, Math.round(sourceFps || 30)));
  const output = new Output({ format: outputFormat, target });
  const vSource = new VideoSampleSource({
    codec: targetVideoCodec,
    quality: targetQuality,
    hardwareAcceleration: targetHwAccel,
    latencyMode: speedConfig.latencyMode,
    width: canvasWidth,
    height: canvasHeight,
    framerate: fps,
  });
  output.addVideoTrack(vSource, { width: canvasWidth, height: canvasHeight, framerate: fps, fps });

  let aSource: AudioSampleSource | null = null;
  if (!settings.muteAudio) {
    const targetAudioBitrate = settings.audioBitrate && settings.audioBitrate > 0 ? settings.audioBitrate * 1000 : 192000;
    aSource = new AudioSampleSource({
      codec: targetAudioCodec,
      bitrate: targetAudioBitrate,
    });
    output.addAudioTrack(aSource, { bitrate: targetAudioBitrate });
  }

  await output.start();

  // Pre-warm audio buffers once per clip before entering the frame loop
  if (aSource && !settings.muteAudio) {
    onProgress({
      percentage: 2,
      statusText: 'Preparing audio track...',
      speedMBs: 0,
      log: `[WebCodecs Audio] Fast decoding audio buffers...`,
    });
    for (const track of visibleTracks) {
      if (track.muted) continue;
      for (const clip of track.clips) {
        if (abortSignal?.aborted) {
          throw Object.assign(new Error('AbortError'), { name: 'AbortError' });
        }
        if (!clip.file) continue;
        const isImg = clip.mediaType === 'image' || clip.file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(clip.file.name);
        if (!isImg) {
          const clipSrcStart = clip.sourceStartTime || 0;
          const clipTimelineDur = (clip.endTime && clip.startTime && clip.endTime > clip.startTime)
            ? clip.endTime - clip.startTime
            : (clip.duration || 60);
          const clipSrcEnd = (typeof clip.sourceEndTime === 'number' && clip.sourceEndTime > clipSrcStart)
            ? clip.sourceEndTime
            : clipSrcStart + clipTimelineDur;

          const t0 = performance.now();
          const buf = await getAudioBufferForFile(clip.file, clipSrcStart, clipSrcEnd).catch(() => null);
          const elapsed = (performance.now() - t0).toFixed(0);
          if (buf) {
            onProgress({
              percentage: 3,
              statusText: `Audio buffer ready (${clip.file.name})`,
              speedMBs: 0,
              log: `[WebCodecs Audio] Fast decoded trimmed range [${clipSrcStart.toFixed(1)}s - ${clipSrcEnd.toFixed(1)}s] for ${clip.file.name} in ${elapsed}ms (${buf.duration.toFixed(1)}s, ${buf.sampleRate}Hz, ${buf.numberOfChannels}ch)`,
            });
          }
        }
      }
    }
  }

  let offscreenCanvas: OffscreenCanvas | HTMLCanvasElement;
  let canvasCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (typeof OffscreenCanvas !== 'undefined') {
    offscreenCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    canvasCtx = offscreenCanvas.getContext('2d');
  } else {
    offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = canvasWidth;
    offscreenCanvas.height = canvasHeight;
    canvasCtx = offscreenCanvas.getContext('2d');
  }

  const clipDecoders = new Map<string, {
    vSink: VideoSampleSink;
    iterator: AsyncIterator<VideoSample>;
    currentSample: VideoSample | null;
    lastDrawnSample: VideoSample | null;
  }>();

  const failedVideoDecoderClips = new Set<string>();

  onProgress({ percentage: 5, statusText: 'Initializing media compositing engine...', speedMBs: 0 });

  let lastProgressTime = performance.now();
  let lastBytes = 0;
  const frameDur = 1 / fps;
  const frames = Math.ceil(exportDuration * fps);
  let currentAudioTime = 0;

  // Synchronous Lockstep Audio/Video Compositing Loop
  for (let f = 0; f < frames; f++) {
    if (abortSignal?.aborted) {
      throw Object.assign(new Error('AbortError'), { name: 'AbortError' });
    }
    const t = exportStart + f * frameDur;
    const outT = f * frameDur;

    if (canvasCtx) {
      canvasCtx.save();
      canvasCtx.fillStyle = '#000000';
      canvasCtx.fillRect(0, 0, canvasWidth, canvasHeight);

      const TRANSITION_HALF = 0.5;

      for (let i = 0; i < visibleTracks.length; i++) {
        const track = visibleTracks[i];
        const clips = track.clips || [];

        for (let cIdx = 0; cIdx < clips.length; cIdx++) {
          const activeClip = clips[cIdx];
          if (!activeClip || !activeClip.file) continue;

          const nextClip = cIdx < clips.length - 1 ? clips[cIdx + 1] : null;
          const prevClip = cIdx > 0 ? clips[cIdx - 1] : null;

          const { isActive, opacity: transitionOpacity, clipPath: transitionClipPath } = calculateTransitionState(activeClip, prevClip, nextClip, t);
          
          if (!isActive || transitionOpacity <= 0) continue;

          const isImg = activeClip.mediaType === 'image' || activeClip.file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(activeClip.file.name);
          const isAudio = activeClip.mediaType === 'audio' || activeClip.file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac|opus|wma)$/i.test(activeClip.file.name);
          if (isImg) {
            const bmp = bitmapMap.get(activeClip.id);
            if (bmp && isValidCanvasImageSource(bmp)) {
              const transform = activeClip.transform || { x: 50, y: 50, scale: i === 0 ? 1.0 : 0.45, rotation: 0, opacity: 1 };
              drawLayerToCanvas(canvasCtx, bmp, bmp.width, bmp.height, transform, canvasWidth, canvasHeight, settings, transitionOpacity, transitionClipPath);
            }
          } else if (!isAudio && !failedVideoDecoderClips.has(activeClip.id)) {
            let decoder = clipDecoders.get(activeClip.id);
            if (!decoder) {
              try {
                const input = new Input({ source: new BlobSource(activeClip.file), formats: ALL_FORMATS });
                const vTracks = await input.getVideoTracks();
                if (vTracks.length > 0) {
                  const vSink = new VideoSampleSink(vTracks[0]);
                  const sourceStart = activeClip.sourceStartTime || 0;
                  const dur = activeClip.endTime !== undefined && activeClip.endTime > (activeClip.startTime || 0)
                    ? activeClip.endTime - (activeClip.startTime || 0)
                    : activeClip.duration || activeClip.fileDuration || 10;
                  const sourceEnd = (activeClip.sourceEndTime !== undefined ? activeClip.sourceEndTime : sourceStart + dur) + 5;
                  decoder = {
                    vSink,
                    iterator: vSink.samples(sourceStart, sourceEnd)[Symbol.asyncIterator](),
                    currentSample: null,
                    lastDrawnSample: null,
                  };
                  clipDecoders.set(activeClip.id, decoder);
                } else {
                  failedVideoDecoderClips.add(activeClip.id);
                }
              } catch (e) {
                console.warn('Failed on-demand decoder creation for clip', activeClip.id, e);
                failedVideoDecoderClips.add(activeClip.id);
              }
            }

            if (decoder) {
              const timeInClip = t - (activeClip.startTime || 0) + (activeClip.sourceStartTime || 0);
              let sampleToDraw = decoder.currentSample;
              while (true) {
                if (!sampleToDraw) {
                  try {
                    const { value, done } = await decoder.iterator.next();
                    if (done) break;
                    sampleToDraw = value;
                  } catch (err) {
                    console.warn('Decoder iterator error, resetting decoder for clip:', activeClip.id, err);
                    clipDecoders.delete(activeClip.id);
                    break;
                  }
                }
                if (!sampleToDraw) break;

                const sampleDuration = sampleToDraw.duration > 0 ? sampleToDraw.duration : frameDur;
                const sampleEndTime = sampleToDraw.timestamp + sampleDuration;

                if (sampleEndTime <= timeInClip + 0.001) {
                  if (decoder.lastDrawnSample && decoder.lastDrawnSample !== sampleToDraw) {
                    decoder.lastDrawnSample.close();
                  }
                  decoder.lastDrawnSample = sampleToDraw;
                  sampleToDraw = null;
                  continue;
                }
                break;
              }
              decoder.currentSample = sampleToDraw;
              const sampleToRender = sampleToDraw || decoder.lastDrawnSample;
              if (sampleToRender) {
                const img = sampleToRender.toCanvasImageSource();
                if (img && isValidCanvasImageSource(img)) {
                  const sqW = sampleToRender.squarePixelWidth || canvasWidth;
                  const sqH = sampleToRender.squarePixelHeight || canvasHeight;
                  const transform = activeClip.transform || { x: 50, y: 50, scale: i === 0 ? 1.0 : 0.45, rotation: 0, opacity: 1 };
                  drawLayerToCanvas(canvasCtx, img, sqW, sqH, transform, canvasWidth, canvasHeight, settings, transitionOpacity, transitionClipPath);
                }
              }
            }
          }
        }
      }
      drawWatermark(canvasCtx, canvasWidth, canvasHeight, settings);
      canvasCtx.restore();
    }

    // Write Video Frame
    const outSample = new VideoSample(offscreenCanvas, { timestamp: outT, duration: frameDur });
    await vSource.add(outSample);
    outSample.close();

    // Write Interleaved Audio Frame(s) Synchronously
    if (aSource && !settings.muteAudio) {
      const targetAudioEnd = outT + frameDur;
      while (currentAudioTime < targetAudioEnd - 0.0005) {
        const currentTimelinePos = exportStart + currentAudioTime;

        const audioSources: AudioSourceInfo[] = [];

        for (const track of visibleTracks) {
          if (track.muted) continue;
          for (let cIdx = 0; cIdx < track.clips.length; cIdx++) {
            const activeClip = track.clips[cIdx];
            if (!activeClip.file) continue;
            const isImg = activeClip.mediaType === 'image' || activeClip.file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(activeClip.file.name);
            if (isImg) continue;

            const nextClip = cIdx < track.clips.length - 1 ? track.clips[cIdx + 1] : null;
            const prevClip = cIdx > 0 ? track.clips[cIdx - 1] : null;

            const { isActive, opacity } = calculateTransitionState(activeClip, prevClip, nextClip, currentTimelinePos);
            
            if (isActive && opacity > 0) {
              const clipSrcStart = activeClip.sourceStartTime || 0;
              const clipTimelineDur = (activeClip.endTime && activeClip.startTime && activeClip.endTime > activeClip.startTime)
                ? activeClip.endTime - activeClip.startTime
                : (activeClip.duration || 60);
              const clipSrcEnd = (typeof activeClip.sourceEndTime === 'number' && activeClip.sourceEndTime > clipSrcStart)
                ? activeClip.sourceEndTime
                : clipSrcStart + clipTimelineDur;

              const audioBuf = await getAudioBufferForFile(activeClip.file, clipSrcStart, clipSrcEnd).catch(() => null);
              if (audioBuf) {
                const sourceStart = activeClip.sourceStartTime || 0;
                const clipStart = activeClip.startTime || 0;
                const sourceOffset = sourceStart + (currentTimelinePos - clipStart);
                const bufStart = (audioBuf as any).startSec || 0;
                const bufEnd = bufStart + audioBuf.duration;
                if (sourceOffset >= bufStart && sourceOffset < bufEnd) {
                  audioSources.push({
                    buffer: audioBuf,
                    sourceStartSec: sourceOffset,
                    volumeMultiplier: opacity * (track.volume ?? 1)
                  });
                }
              }
            }
          }
        }

        if (audioSources.length > 0) {
          const aSample = createMixedAudioSampleBlock(audioSources, currentAudioTime);
          await aSource.add(aSample);
          currentAudioTime += AUDIO_FRAME_DURATION;
          aSample.close();
        } else {
          const silentSample = createSilentAudioBlock(currentAudioTime);
          await aSource.add(silentSample);
          currentAudioTime += AUDIO_FRAME_DURATION;
          silentSample.close();
        }
      }
    }

    const now = performance.now();
    const elapsed = (now - lastProgressTime) / 1000;
    if (elapsed > 0.5 || f === 0 || f === frames - 1) {
      const speedMBs = elapsed > 0 ? (totalWritten - lastBytes) / (1024 * 1024) / elapsed : 0;
      lastProgressTime = now;
      lastBytes = totalWritten;
      const pct = Math.min(95, Math.max(5, Math.round(((f + 1) / frames) * 90)));
      onProgress({
        percentage: pct,
        statusText: `Compositing Frame ${f + 1}/${frames} (${pct}%)...`,
        speedMBs,
        log: `[WebCodecs] Frame: ${f + 1}/${frames} | Time: ${(t - exportStart).toFixed(1)}s / ${exportDuration.toFixed(1)}s | Speed: ${speedMBs.toFixed(1)} MB/s`,
      });
    }
  }

  // Ensure audio track covers any remaining tail up to exportDuration after all video frames are encoded
  if (aSource && !settings.muteAudio) {
    while (currentAudioTime < exportDuration - 0.0005) {
      if (abortSignal?.aborted) {
        throw Object.assign(new Error('AbortError'), { name: 'AbortError' });
      }
      const currentTimelinePos = exportStart + currentAudioTime;
      const audioSources: AudioSourceInfo[] = [];

      for (const track of visibleTracks) {
        if (track.muted) continue;
        for (let cIdx = 0; cIdx < track.clips.length; cIdx++) {
          const activeClip = track.clips[cIdx];
          if (!activeClip.file) continue;
          const isImg = activeClip.mediaType === 'image' || activeClip.file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(activeClip.file.name);
          if (isImg) continue;

          const nextClip = cIdx < track.clips.length - 1 ? track.clips[cIdx + 1] : null;
          const prevClip = cIdx > 0 ? track.clips[cIdx - 1] : null;

          const { isActive, opacity } = calculateTransitionState(activeClip, prevClip, nextClip, currentTimelinePos);

          if (isActive && opacity > 0) {
            const clipSrcStart = activeClip.sourceStartTime || 0;
            const clipTimelineDur = (activeClip.endTime && activeClip.startTime && activeClip.endTime > activeClip.startTime)
              ? activeClip.endTime - activeClip.startTime
              : (activeClip.duration || 60);
            const clipSrcEnd = (typeof activeClip.sourceEndTime === 'number' && activeClip.sourceEndTime > clipSrcStart)
              ? activeClip.sourceEndTime
              : clipSrcStart + clipTimelineDur;

            const audioBuf = await getAudioBufferForFile(activeClip.file, clipSrcStart, clipSrcEnd).catch(() => null);
            if (audioBuf) {
              const sourceStart = activeClip.sourceStartTime || 0;
              const clipStart = activeClip.startTime || 0;
              const sourceOffset = sourceStart + (currentTimelinePos - clipStart);
              const bufStart = (audioBuf as any).startSec || 0;
              const bufEnd = bufStart + audioBuf.duration;
              if (sourceOffset >= bufStart && sourceOffset < bufEnd) {
                audioSources.push({
                  buffer: audioBuf,
                  sourceStartSec: sourceOffset,
                  volumeMultiplier: opacity * (track.volume ?? 1),
                });
              }
            }
          }
        }
      }

      if (audioSources.length > 0) {
        const aSample = createMixedAudioSampleBlock(audioSources, currentAudioTime);
        await aSource.add(aSample);
        currentAudioTime += AUDIO_FRAME_DURATION;
        aSample.close();
      } else {
        const silentSample = createSilentAudioBlock(currentAudioTime);
        await aSource.add(silentSample);
        currentAudioTime += AUDIO_FRAME_DURATION;
        silentSample.close();
      }
    }
  }

  for (const decoder of clipDecoders.values()) {
    if (decoder.currentSample) { decoder.currentSample.close(); decoder.currentSample = null; }
    if (decoder.lastDrawnSample) { decoder.lastDrawnSample.close(); decoder.lastDrawnSample = null; }
  }
  clipDecoders.clear();
  failedVideoDecoderClips.clear();

  // Finalize multiplexer output to ensure container headers (moov/cues) are written
  await output.finalize();

  let blobUrl: string | undefined;
  if (target instanceof BufferTarget && target.buffer) {
    const isMp4 = outputFormat instanceof Mp4OutputFormat;
    const isMkv = outputFormat instanceof MkvOutputFormat;
    const mime = isMp4 ? 'video/mp4' : isMkv ? 'video/x-matroska' : 'video/webm';
    const blob = new Blob([target.buffer], { type: mime });
    blobUrl = URL.createObjectURL(blob);
    totalWritten = target.buffer.byteLength;
  }

  return { success: true, totalBytesWritten: totalWritten, blobUrl };
}


/**
 * Concat multiple files / clips / tracks using WebCodecs API transcoding
 */
export async function processWebCodecsConcatStream(
  inputItems: any[],
  settings: EditSettings,
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number; log?: string }) => void,
  abortSignal?: AbortSignal
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  await HardwareBlurEngine.instance.init();
  const isTracks = inputItems.length > 0 && inputItems[0].clips !== undefined;
  
  if (isTracks) {
    return processWebCodecsMultiTrackTimeline(
      inputItems as TimelineTrackData[],
      settings,
      writable,
      onProgress,
      abortSignal
    );
  }

  // 1. Flatten if inputItems are raw files
  const files = inputItems as File[];
  const isExplicitTrim = settings.endTime > 0 && settings.duration > 0 && settings.endTime < settings.duration - 0.1;
  const segments = files.map((f) => {
    const isImg = f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(f.name);
    const isAud = f.type.startsWith('audio/') || /\.(mp3|wav|aac|m4a|flac|ogg|opus)$/i.test(f.name);
    return {
      file: f,
      name: f.name,
      startTime: 0,
      sourceStartTime: settings.startTime || 0,
      duration: isExplicitTrim ? (settings.endTime - (settings.startTime || 0)) : (isImg ? 5 : 0),
      isImage: isImg,
      isAudio: isAud,
      isVideo: !isImg && !isAud,
      transform: undefined as ClipTransform | undefined,
    };
  });

  if (segments.length === 0) {
    throw new Error('No valid video or image files/clips provided for concatenation');
  }

  onProgress({
    percentage: 1,
    statusText: `WebCodecs Concat Engine: Preparing ${segments.length} clips...`,
    speedMBs: 0,
    log: `[WebCodecs Concat] Merging ${segments.length} stream segments with WebCodecs normalization:`,
  });

  segments.forEach((seg, i) => {
    onProgress({
      percentage: 2,
      statusText: `Inspecting [${i + 1}/${segments.length}] ${seg.name}...`,
      speedMBs: 0,
      log: `  Segment [${i + 1}]: ${seg.name} (${seg.isImage ? 'Image' : seg.isVideo ? 'Video' : 'Audio'}, Duration: ${seg.duration.toFixed(2)}s)`,
    });
  });

  // If only 1 segment and it's a single file without timeline tracks, redirect to single encode
  if (segments.length === 1 && !isTracks) {
    return processWebCodecsEncodeStream(segments[0].file, settings, writable, onProgress);
  }

  const preferredVideoCodec: VideoCodec = (settings.videoCodec as VideoCodec) || 'avc';
  const targetQuality = resolveQuality(settings.videoQuality);

  // Probe width & height from first valid video or image segment
  let sourceWidth = 1920;
  let sourceHeight = 1080;
  let hasValidDims = false;

  for (const seg of segments) {
    if (seg.isImage) {
      try {
        const bmp = await createImageBitmap(seg.file);
        if (bmp.width > 0 && bmp.height > 0) {
          sourceWidth = bmp.width;
          sourceHeight = bmp.height;
          hasValidDims = true;
          bmp.close();
          break;
        }
        bmp.close();
      } catch (e) {
        console.warn('Probe image error', e);
      }
    } else if (seg.isVideo) {
      try {
        const firstInput = new Input({ source: new BlobSource(seg.file), formats: ALL_FORMATS });
        const firstVTracks = await firstInput.getVideoTracks();
        if (firstVTracks.length > 0) {
          sourceWidth = firstVTracks[0].displayWidth || firstVTracks[0].codedWidth || 1920;
          sourceHeight = firstVTracks[0].displayHeight || firstVTracks[0].codedHeight || 1080;
          hasValidDims = true;
          break;
        }
      } catch (e) {
        console.warn('Probe video error', e);
      }
    }
  }

  // Ensure source dimensions are even
  sourceWidth = Math.max(8, sourceWidth - (sourceWidth % 8));
  sourceHeight = Math.max(8, sourceHeight - (sourceHeight % 8));

  const hasCustomAspect = Boolean(settings.cropAspect && settings.cropAspect !== 'original');
  const hasResolutionPreset = Boolean(settings.resolution && settings.resolution !== 'original');

  let canvasWidth = sourceWidth;
  let canvasHeight = sourceHeight;

  if (hasCustomAspect) {
    if (settings.cropAspect === 'free' && settings.freeCropRect) {
      const rect = settings.freeCropRect;
      canvasWidth = Math.round(sourceWidth * Math.max(0.05, Math.min(1, rect.width || 1)));
      canvasHeight = Math.round(sourceHeight * Math.max(0.05, Math.min(1, rect.height || 1)));
    } else {
      let aspectMultiplier = 16 / 9;
      switch (settings.cropAspect) {
        case '16:9': aspectMultiplier = 16 / 9; break;
        case '4:3': aspectMultiplier = 4 / 3; break;
        case '1:1': aspectMultiplier = 1 / 1; break;
        case '4:5': aspectMultiplier = 4 / 5; break;
        case '9:16': aspectMultiplier = 9 / 16; break;
        case '21:9': aspectMultiplier = 21 / 9; break;
      }
      if (sourceWidth / sourceHeight > aspectMultiplier) {
        canvasHeight = sourceHeight;
        canvasWidth = Math.round(sourceHeight * aspectMultiplier);
      } else {
        canvasWidth = sourceWidth;
        canvasHeight = Math.round(sourceWidth / aspectMultiplier);
      }
    }
    canvasWidth = Math.max(8, canvasWidth - (canvasWidth % 8));
    canvasHeight = Math.max(8, canvasHeight - (canvasHeight % 8));
  }

  if (hasResolutionPreset) {
    const targetDims = getTargetDimensions(canvasWidth, canvasHeight, settings.resolution);
    canvasWidth = targetDims.width;
    canvasHeight = targetDims.height;
  }

  const speedConfig = resolveSpeedConfig(settings.encodeSpeed);
  const negotiated = await negotiateVideoCodec(preferredVideoCodec, canvasWidth, canvasHeight, targetQuality, speedConfig.hardwareAcceleration);
  const targetVideoCodec = negotiated.codec;
  const targetHwAccel = negotiated.hwAccel;
  const preferredAudioCodec: AudioCodec = (settings.audioCodec as AudioCodec) || 'opus';
  const targetAudioCodec = await negotiateAudioCodec(preferredAudioCodec);

  const vidLog = targetVideoCodec === preferredVideoCodec
    ? `${targetVideoCodec.toUpperCase()} (${targetHwAccel})`
    : `${targetVideoCodec.toUpperCase()} (Fallback from ${preferredVideoCodec.toUpperCase()})`;
  const normPrefAud = (preferredAudioCodec as string) === 'pcm-s16le' ? 'pcm-s16' : preferredAudioCodec;
  const audLog = targetAudioCodec === normPrefAud
    ? `${targetAudioCodec.toUpperCase()}`
    : `${targetAudioCodec.toUpperCase()} (Fallback from ${preferredAudioCodec.toUpperCase()})`;

  onProgress({
    percentage: 1,
    statusText: `Concat Initialized (${targetVideoCodec.toUpperCase()} / ${targetAudioCodec.toUpperCase()})`,
    speedMBs: 0,
    log: `[WebCodecs Pipeline] Concat Video Codec: ${vidLog} | Audio Codec: ${audLog} | Target: ${canvasWidth}x${canvasHeight}`,
  });

  const firstSeg = segments[0];
  const ext = firstSeg.file.name.split('.').pop()?.toLowerCase() || 'mp4';
  const format =
    ext === 'webm' || targetVideoCodec === 'vp8' || targetVideoCodec === 'vp9'
      ? new WebMOutputFormat()
      : ext === 'mkv'
      ? new MkvOutputFormat()
      : new Mp4OutputFormat({ fastStart: 'in-memory' });

  const target = createWebCodecsTarget(writable);
  let totalWritten = 0;
  target.on('write', ({ end }) => {
    totalWritten = Math.max(totalWritten, end);
  });
  const output = new Output({ format, target });
  const fps = (settings.fps && settings.fps > 0) ? Math.min(240, Math.max(1, Math.round(settings.fps))) : 30;
  const targetAudioBitrate = settings.audioBitrate && settings.audioBitrate > 0 ? settings.audioBitrate * 1000 : 192000;

  // Create single continuous output tracks
  const vSource = new VideoSampleSource({
    codec: targetVideoCodec,
    quality: targetQuality,
    hardwareAcceleration: targetHwAccel,
    latencyMode: speedConfig.latencyMode,
    width: canvasWidth,
    height: canvasHeight,
    framerate: fps,
  });
  const aSource = new AudioSampleSource({
    codec: targetAudioCodec,
    bitrate: targetAudioBitrate,
  });

  output.addVideoTrack(vSource, { width: canvasWidth, height: canvasHeight, framerate: fps, fps });
  output.addAudioTrack(aSource, { bitrate: targetAudioBitrate });

  await output.start();

  let currentVideoTime = 0;
  let currentAudioTime = 0;
  let lastWrittenVideoTime = -1;
  let lastWrittenAudioTime = -1;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const file = seg.file;
    const isImage = seg.isImage || file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(file.name);

    onProgress({
      percentage: Math.round((i / segments.length) * 100),
      statusText: `WebCodecs Concat: Encoding segment ${i + 1}/${segments.length} (${seg.name})...`,
      speedMBs: 0,
      log: `[WebCodecs Concat] Processing segment ${i + 1}/${segments.length}: ${seg.name} (${isImage ? 'Image' : 'Video'})`,
    });

    if (isImage) {
      // =========================================================================
      // 🖼️ IMAGE SEGMENT ENCODING (Generate continuous 30fps video frames)
      // =========================================================================
      const bmp = await createImageBitmap(file);
      const imgWidth = bmp.width;
      const imgHeight = bmp.height;
      const segDuration = seg.duration > 0 ? seg.duration : 5;
      const fps = (settings.fps && settings.fps > 0) ? Math.min(240, Math.max(1, Math.round(settings.fps))) : 30;
      const frames = Math.ceil(segDuration * fps);
      const frameDurationSec = 1 / fps;

      let segCanvas: OffscreenCanvas | HTMLCanvasElement;
      let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;

      if (typeof OffscreenCanvas !== 'undefined') {
        segCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
        ctx = segCanvas.getContext('2d');
      } else {
        segCanvas = document.createElement('canvas');
        segCanvas.width = canvasWidth;
        segCanvas.height = canvasHeight;
        ctx = segCanvas.getContext('2d');
      }

      const hasLayerTransform = seg.transform !== undefined;
      const t = seg.transform || { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 };
      const opacity = t.opacity ?? 1;

      for (let f = 0; f < frames; f++) {
        if (ctx) {
          ctx.save();
          ctx.clearRect(0, 0, canvasWidth, canvasHeight);
          ctx.filter = buildCanvasFilterString(settings);
          if (settings.flipH || settings.flipV) {
            ctx.translate(settings.flipH ? canvasWidth : 0, settings.flipV ? canvasHeight : 0);
            ctx.scale(settings.flipH ? -1 : 1, settings.flipV ? -1 : 1);
          }

          if (hasLayerTransform) {
            // Apply layer positioning (x/y in percentage, rotation, scale, opacity)
            const posX = (t.x / 100) * canvasWidth;
            const posY = (t.y / 100) * canvasHeight;
            const scale = t.scale || 1;
            const rotationDeg = t.rotation || 0;

            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
            let sourceToDraw: CanvasImageSource = bmp;
            if (t.blur && t.blur > 0) {
              const currentFilter = ctx.filter === 'none' ? '' : ctx.filter;
              const scaledBlur = Math.max(1, Math.round(t.blur * (canvasWidth / 640)));
              
              sourceToDraw = HardwareBlurEngine.instance.applyBlur(bmp, imgWidth, imgHeight, scaledBlur);
              ctx.filter = currentFilter;
            }
            ctx.translate(posX, posY);
            if (rotationDeg !== 0) {
              ctx.rotate((rotationDeg * Math.PI) / 180);
            }
            ctx.scale(scale, scale);

            // Layer media is sized relative to canvasWidth with native aspect ratio (matching VideoPlayer.tsx w-full h-auto)
            const drawW = canvasWidth;
            const drawH = (imgHeight / imgWidth) * canvasWidth;
            ctx.drawImage(sourceToDraw, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();
          } else {
            const srcRatio = imgWidth / imgHeight;
            const dstRatio = canvasWidth / canvasHeight;
            let sx = 0; let sy = 0; let sw = imgWidth; let sh = imgHeight;

            if (settings.cropAspect === 'free' && settings.freeCropRect) {
              const rect = settings.freeCropRect;
              sx = Math.max(0, Math.min(imgWidth - 2, Math.round(imgWidth * (rect.x || 0))));
              sy = Math.max(0, Math.min(imgHeight - 2, Math.round(imgHeight * (rect.y || 0))));
              sw = Math.max(8, Math.min(imgWidth - sx, Math.round(imgWidth * (rect.width || 1))));
              sh = Math.max(8, Math.min(imgHeight - sy, Math.round(imgHeight * (rect.height || 1))));
            } else if (Math.abs(srcRatio - dstRatio) > 0.01) {
              if (srcRatio > dstRatio) {
                sw = imgHeight * dstRatio;
                sx = (imgWidth - sw) / 2;
              } else {
                sh = imgWidth / dstRatio;
                sy = (imgHeight - sh) / 2;
              }
            }
            ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, canvasWidth, canvasHeight);
          }
          ctx.restore();

          if (settings.watermarkText && settings.watermarkText.trim()) {
            ctx.save();
            const fontSize = settings.watermarkSize || 24;
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.fillStyle = settings.watermarkColor || '#ffffff';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            const text = settings.watermarkText;
            const textMetrics = ctx.measureText(text);
            const padding = 20;
            let x = padding; let y = canvasHeight - padding;
            switch (settings.watermarkPosition) {
              case 'top-left': x = padding; y = padding + fontSize; break;
              case 'top-right': x = canvasWidth - textMetrics.width - padding; y = padding + fontSize; break;
              case 'bottom-left': x = padding; y = canvasHeight - padding; break;
              case 'bottom-right': x = canvasWidth - textMetrics.width - padding; y = canvasHeight - padding; break;
              case 'center': x = (canvasWidth - textMetrics.width) / 2; y = (canvasHeight + fontSize) / 2; break;
            }
            ctx.fillText(text, x, y);
            ctx.restore();
          }
        }

        const pSample = new VideoSample(segCanvas, {
          timestamp: currentVideoTime + (f * frameDurationSec),
          duration: frameDurationSec,
        });
        await vSource.add(pSample);
        pSample.close();
      }

      bmp.close();
      currentVideoTime += segDuration;
      currentAudioTime += segDuration;

    } else {
      // =========================================================================
      // 🎥 VIDEO SEGMENT ENCODING
      // =========================================================================
      const input = new Input({
        source: new BlobSource(file),
        formats: ALL_FORMATS,
      });

      let maxVidDur = 0;
      let maxAudDur = 0;

      const vTracks = await input.getVideoTracks();
      const aTracks = await input.getAudioTracks();

      const hasLayerTransform = seg.transform !== undefined;
      const t = seg.transform || { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 };
      const opacity = t.opacity ?? 1;

      const needsCanvasProcessing =
        hasLayerTransform ||
        settings.filter !== 'none' ||
        settings.brightness !== 1.0 ||
        settings.contrast !== 1.0 ||
        settings.flipH ||
        settings.flipV ||
        Boolean(settings.watermarkText?.trim()) ||
        hasCustomAspect ||
        hasResolutionPreset;

      let offscreenCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
      let canvasCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;

      if (needsCanvasProcessing) {
        if (typeof OffscreenCanvas !== 'undefined') {
          offscreenCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
          canvasCtx = offscreenCanvas.getContext('2d');
        } else {
          offscreenCanvas = document.createElement('canvas');
          offscreenCanvas.width = canvasWidth;
          offscreenCanvas.height = canvasHeight;
          canvasCtx = offscreenCanvas.getContext('2d');
        }
      }

      const sourceStart = seg.sourceStartTime || 0;
      const segMaxDuration = seg.duration > 0 ? seg.duration : undefined;

      const videoPromise = (async () => {
        if (vTracks.length > 0) {
          let segmentElapsedVideoTime = 0;
          let lastSourceVideoTime = -1;
          const vSink = new VideoSampleSink(vTracks[0]);
          for await (const sample of vSink.samples()) {
            const origDuration = sample.duration || (1 / (settings.fps || 30));

            if (sourceStart > 0 && sample.timestamp < sourceStart) {
              sample.close();
              continue;
            }
            if (segMaxDuration !== undefined && sample.timestamp >= sourceStart + segMaxDuration) {
              sample.close();
              break;
            }

            if (lastSourceVideoTime !== -1) {
              let delta = sample.timestamp - lastSourceVideoTime;
              if (delta < 0 || delta > 1.0) {
                 delta = origDuration;
              }
              segmentElapsedVideoTime += delta;
            }
            lastSourceVideoTime = sample.timestamp;

            let pSample = sample;

            if (needsCanvasProcessing && offscreenCanvas && canvasCtx) {
              const canvas = offscreenCanvas;
              const ctx = canvasCtx;
              const img = pSample.toCanvasImageSource();
              const w = canvasWidth;
              const h = canvasHeight;
              
              ctx.save();
              ctx.clearRect(0, 0, w, h);

              if (!isValidCanvasImageSource(img)) {
                ctx.restore();
                continue;
              }

              try {
                // Apply CSS Filters (Brightness, Contrast, Grayscale, etc.)
                ctx.filter = buildCanvasFilterString(settings);

                // Apply Horizontal / Vertical Flips
                if (settings.flipH || settings.flipV) {
                  ctx.translate(settings.flipH ? w : 0, settings.flipV ? h : 0);
                  ctx.scale(settings.flipH ? -1 : 1, settings.flipV ? -1 : 1);
                }

                // Calculate source crop rectangle to preserve aspect ratio without distortion
                const srcWidth = pSample.squarePixelWidth;
                const srcHeight = pSample.squarePixelHeight;
                const srcRatio = srcWidth / srcHeight;
                const dstRatio = w / h;

                if (hasLayerTransform) {
                  // Apply layer positioning (x/y in percentage, rotation, scale, opacity)
                  const posX = (t.x / 100) * w;
                  const posY = (t.y / 100) * h;
                  const scale = t.scale || 1;
                  const rotationDeg = t.rotation || 0;

                  ctx.save();
                  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
                  let sourceToDraw: CanvasImageSource = img as any;
                  if (t.blur && t.blur > 0) {
                    const currentFilter = ctx.filter === 'none' ? '' : ctx.filter;
                    const scaledBlur = Math.max(1, Math.round(t.blur * (w / 640)));
                    
                    try {
                      sourceToDraw = HardwareBlurEngine.instance.applyBlur(img as any, srcWidth, srcHeight, scaledBlur);
                    } catch (blurErr) {
                      console.warn('Hardware blur failed, falling back to unblurred image:', blurErr);
                      sourceToDraw = img as any;
                    }
                    ctx.filter = currentFilter;
                  }

                  if (isValidCanvasImageSource(sourceToDraw)) {
                    ctx.translate(posX, posY);
                    if (rotationDeg !== 0) {
                      ctx.rotate((rotationDeg * Math.PI) / 180);
                    }
                    ctx.scale(scale, scale);

                    // Layer media is sized relative to canvas width with native video aspect ratio
                    const drawW = w;
                    const drawH = (srcHeight / srcWidth) * w;
                    ctx.drawImage(sourceToDraw, -drawW / 2, -drawH / 2, drawW, drawH);
                  }
                  ctx.restore();
                } else {
                  if (settings.cropAspect === 'free' && settings.freeCropRect) {
                    const rect = settings.freeCropRect;
                    const sx = Math.max(0, Math.min(srcWidth - 2, Math.round(srcWidth * (rect.x || 0))));
                    const sy = Math.max(0, Math.min(srcHeight - 2, Math.round(srcHeight * (rect.y || 0))));
                    const sw = Math.max(8, Math.min(srcWidth - sx, Math.round(srcWidth * (rect.width || 1))));
                    const sh = Math.max(8, Math.min(srcHeight - sy, Math.round(srcHeight * (rect.height || 1))));
                    ctx.drawImage(img as any, sx, sy, sw, sh, 0, 0, w, h);
                  } else if (Math.abs(srcRatio - dstRatio) > 0.01) {
                    let sx = 0;
                    let sy = 0;
                    let sw = srcWidth;
                    let sh = srcHeight;
                    if (srcRatio > dstRatio) {
                      sw = srcHeight * dstRatio;
                      sx = (srcWidth - sw) / 2;
                    } else {
                      sh = srcWidth / dstRatio;
                      sy = (srcHeight - sh) / 2;
                    }
                    ctx.drawImage(img as any, sx, sy, sw, sh, 0, 0, w, h);
                  } else {
                    ctx.drawImage(img as any, 0, 0, w, h);
                  }
                }
              } catch (drawErr) {
                console.warn('Concat canvas process drawImage failed:', drawErr);
              } finally {
                ctx.restore();
              }

              // Apply Watermark Overlay
              if (settings.watermarkText && settings.watermarkText.trim()) {
                ctx.save();
                const fontSize = settings.watermarkSize || 24;
                ctx.font = `bold ${fontSize}px sans-serif`;
                ctx.fillStyle = settings.watermarkColor || '#ffffff';
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;

                const text = settings.watermarkText;
                const textMetrics = ctx.measureText(text);
                const padding = 20;
                let x = padding;
                let y = h - padding;

                switch (settings.watermarkPosition) {
                  case 'top-left':
                    x = padding;
                    y = padding + fontSize;
                    break;
                  case 'top-right':
                    x = w - textMetrics.width - padding;
                    y = padding + fontSize;
                    break;
                  case 'bottom-left':
                    x = padding;
                    y = h - padding;
                    break;
                  case 'bottom-right':
                    x = w - textMetrics.width - padding;
                    y = h - padding;
                    break;
                  case 'center':
                    x = (w - textMetrics.width) / 2;
                    y = (h + fontSize) / 2;
                    break;
                }

                ctx.fillText(text, x, y);
                ctx.restore();
              }

              const canvasSample = new VideoSample(canvas, { timestamp: pSample.timestamp, duration: origDuration });
              pSample = canvasSample;

            } else if (pSample.squarePixelWidth !== canvasWidth || pSample.squarePixelHeight !== canvasHeight) {
                const scaledSample = await pSample.transform({ width: canvasWidth, height: canvasHeight, fit: 'cover' });
                pSample = scaledSample;
            }

            let outTime = currentVideoTime + segmentElapsedVideoTime;
            if (outTime <= lastWrittenVideoTime) outTime = lastWrittenVideoTime + 0.001;
            lastWrittenVideoTime = outTime;
            
            pSample.setTimestamp(outTime);
            await vSource.add(pSample);
            maxVidDur = Math.max(maxVidDur, segmentElapsedVideoTime + origDuration);
            if (pSample !== sample) pSample.close();
            sample.close();
          }
        }
      })();

      const audioPromise = (async () => {
        if (aTracks.length > 0 && !settings.muteAudio) {
          let segmentElapsedAudioTime = 0;
          let lastSourceAudioTime = -1;
          const aSink = new AudioSampleSink(aTracks[0]);
          for await (const sample of aSink.samples()) {
            const origDuration = sample.duration || 0.02;

            if (sourceStart > 0 && sample.timestamp < sourceStart) {
              sample.close();
              continue;
            }
            if (segMaxDuration !== undefined && sample.timestamp >= sourceStart + segMaxDuration) {
              sample.close();
              break;
            }

            if (lastSourceAudioTime !== -1) {
              let delta = sample.timestamp - lastSourceAudioTime;
              if (delta < 0 || delta > 1.0) {
                 delta = origDuration;
              }
              segmentElapsedAudioTime += delta;
            }
            lastSourceAudioTime = sample.timestamp;

            let outTime = currentAudioTime + segmentElapsedAudioTime;
            if (outTime <= lastWrittenAudioTime) outTime = lastWrittenAudioTime + origDuration;
            lastWrittenAudioTime = outTime;
            
            const adaptedSample = adaptAudioSample(sample, MASTER_AUDIO_SAMPLE_RATE, MASTER_AUDIO_CHANNELS);
            adaptedSample.setTimestamp(outTime);
            await aSource.add(adaptedSample);
            maxAudDur = Math.max(maxAudDur, segmentElapsedAudioTime + origDuration);
            if (adaptedSample !== sample) adaptedSample.close();
            sample.close();
          }
        }
      })();

      await videoPromise;

      if (aTracks.length > 0 && !settings.muteAudio) {
        await audioPromise;
      } else if (!settings.muteAudio) {
        // Generate silent audio for video segments without audio track to keep audio stream synced
        const segDur = maxVidDur > 0 ? maxVidDur : (seg.duration || 5);
        let silencePos = 0;
        while (silencePos < segDur) {
          const step = Math.min(0.1, segDur - silencePos);
          let outTime = currentAudioTime + silencePos;
          if (outTime <= lastWrittenAudioTime) outTime = lastWrittenAudioTime + 0.001;
          
          const silentSample = createSilentAudioSample(outTime, step, MASTER_AUDIO_SAMPLE_RATE, MASTER_AUDIO_CHANNELS);
          await aSource.add(silentSample);
          lastWrittenAudioTime = outTime;
          silencePos += step;
          silentSample.close();
        }
        maxAudDur = segDur;
      }

      const segDur = Math.max(maxVidDur, maxAudDur, seg.duration || 0);
      currentVideoTime += segDur;
      currentAudioTime += segDur;
    }
  }

  await output.finalize();

  let blobUrl: string | undefined;
  if (target instanceof BufferTarget && target.buffer) {
    const isMp4 = format instanceof Mp4OutputFormat;
    const isMkv = format instanceof MkvOutputFormat;
    const mime = isMp4 ? 'video/mp4' : isMkv ? 'video/x-matroska' : 'video/webm';
    const blob = new Blob([target.buffer], { type: mime });
    blobUrl = URL.createObjectURL(blob);
    totalWritten = target.buffer.byteLength;
  }

  onProgress({
    percentage: 100,
    statusText: 'WebCodecs Concat Complete!',
    speedMBs: 0,
    log: `[WebCodecs Concat] All ${segments.length} segments merged & encoded successfully! Total: ${(totalWritten / (1024 * 1024)).toFixed(2)} MB`,
  });

  return {
    success: true,
    totalBytesWritten: totalWritten,
    blobUrl,
  };
}



// --- Background Web Worker Message Handler ---
if (typeof window === 'undefined' && typeof self !== 'undefined' && typeof (self as any).postMessage === 'function' && !(self as any).document) {
  (self as any).onmessage = async (e: MessageEvent) => {
    const { id, action, payload } = e.data;
    try {
      const { files, settings, startTime, endTime } = payload;
      const mockWritable = {
        async write(chunkOrData: any) {
          let position = undefined;
          let data = chunkOrData;
          if (chunkOrData && typeof chunkOrData === 'object' && 'data' in chunkOrData) {
            position = chunkOrData.position;
            data = chunkOrData.data;
          }
          const uint8 = data instanceof Uint8Array ? data : new Uint8Array(data);
          (self as any).postMessage({
            id,
            type: 'chunk',
            chunk: { position, data: uint8 }
          });
        },
        async seek(_pos: number) {},
        async truncate() {},
        async close() {}
      } as any;

      let result;
      const onProgress = (prog: any) => {
        (self as any).postMessage({ id, type: 'progress', progress: prog });
      };

      if (action === 'concat') {
        if (settings?.encodeMode) {
          result = await processWebCodecsConcatStream(files, settings, mockWritable, onProgress);
        } else {
          result = await processNativeConcatStream(files, mockWritable, onProgress);
        }
      } else if (action === 'trim') {
        const file = files[0];
        if (settings?.encodeMode) {
          result = await processWebCodecsEncodeStream(file, settings, mockWritable, onProgress);
        } else {
          result = await processNativeTrimStream(file, startTime, endTime, mockWritable, onProgress);
        }
      } else if (action === 'remux') {
        const file = files[0];
        result = await processNativeRemuxStream(file, mockWritable, onProgress);
      } else if (action === 'encode') {
        const file = files[0];
        result = await processWebCodecsEncodeStream(file, settings, mockWritable, onProgress);
      } else {
        throw new Error('Unknown action: ' + action);
      }

      (self as any).postMessage({ id, success: true, result });
    } catch (err: any) {
      (self as any).postMessage({ id, success: false, error: err?.message || String(err) });
    }
  };
}



let worker: Worker | null = null;
const activeRequests = new Map<string, {
  resolve: (res: any) => void;
  reject: (err: any) => void;
  onProgress?: (prog: any) => void;
  writable?: FileSystemWritableFileStream | null;
}>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./engineWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = async (e: MessageEvent) => {
      const { id, type, success, result, error, progress, chunk } = e.data;
      const req = activeRequests.get(id);
      if (!req) return;

      if (type === 'progress') {
        if (req.onProgress) req.onProgress(progress);
      } else if (type === 'chunk') {
        if (req.writable && typeof req.writable.write === 'function') {
          try {
            if (typeof (req.writable as any).seek === 'function' && typeof chunk.position === 'number') {
              await (req.writable as any).seek(chunk.position);
            }
            await req.writable.write(chunk.data);
          } catch (err) {
            console.error('Worker chunk write failure:', err);
          }
        }
      } else {
        activeRequests.delete(id);
        if (success) {
          req.resolve(result);
        } else {
          req.reject(new Error(error || 'Worker execution failed'));
        }
      }
    };
    worker.onerror = (err) => {
      console.error('Engine Worker Error:', err);
      for (const [id, req] of activeRequests.entries()) {
        req.reject(new Error('Worker crashed or failed: ' + err.message));
      }
      activeRequests.clear();
      worker = null;
    };
  }
  return worker;
}

export async function runEngineInWorker(
  action: 'concat' | 'trim' | 'remux' | 'encode',
  files: File[],
  writable: FileSystemWritableFileStream | null,
  settings?: any,
  startTime?: number,
  endTime?: number,
  onProgress?: (prog: any) => void
): Promise<any> {
  const w = getWorker();
  const id = Math.random().toString(36).substring(2, 9);

  return new Promise((resolve, reject) => {
    activeRequests.set(id, { resolve, reject, onProgress, writable });

    w.postMessage({
      id,
      action,
      payload: {
        files,
        settings,
        startTime,
        endTime
      }
    });
  });
}
