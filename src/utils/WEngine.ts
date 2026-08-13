import { SampleVideo } from '../types';

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
   if (value < 127) return writeVint(value, 1);
   if (value < 16383) return writeVint(value, 2);
   if (value < 2097151) return writeVint(value, 3);
   if (value < 268435455) return writeVint(value, 4);
   return writeVint(value, 5);
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
    timecodeScale: 1000000
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
 * Standard Process Concat Stream
 */
export async function processNativeConcatStream(
  files: File[],
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number }) => void
): Promise<{ success: boolean; totalBytesWritten?: number; blobUrl?: string }> {
  try {
    if (!files.length) return { success: false };
    
    onProgress({ percentage: 0, statusText: 'กำลังวิเคราะห์โครงสร้างไฟล์ (Standard EBML)...', speedMBs: 0 });

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
                
                // Read from start of cluster to Timecode value
                const preTcSize = (cluster.timecodeOffset - cluster.offset);
                const preTcBuf = await readSlice(file, cluster.offset, preTcSize);
                await writable.write(preTcBuf);
                totalBytesWritten += preTcBuf.length;

                // Write new Timecode
                // ID_TIMECODE is E7. Size is cluster.timecodeValueLength
                const tcHdr = new Uint8Array([0xE7]);
                const tcSizeVint = writeVint(cluster.timecodeValueLength, cluster.timecodeLength - cluster.timecodeValueLength - 1);
                
                const tcValBuf = new Uint8Array(cluster.timecodeValueLength);
                let remaining = newTc;
                for (let k = cluster.timecodeValueLength - 1; k >= 0; k--) {
                   tcValBuf[k] = remaining & 0xFF;
                   remaining = Math.floor(remaining / 256);
                }

                await writable.write(tcHdr);
                await writable.write(tcSizeVint);
                await writable.write(tcValBuf);
                totalBytesWritten += tcHdr.length + tcSizeVint.length + tcValBuf.length;

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
        } catch (seekErr) {
            console.warn("SeekHead update failed:", seekErr);
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
 * Standard Process Trim Stream
 */
export async function processNativeTrimStream(
  file: File,
  startTime: number,
  endTime: number,
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number }) => void
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
             const preTcSize = (cluster.timecodeOffset - cluster.offset);
             const preTcBuf = await readSlice(file, cluster.offset, preTcSize);
             await writable.write(preTcBuf);
             totalBytesWritten += preTcBuf.length;

             const tcHdr = new Uint8Array([0xE7]);
             const tcSizeVint = writeVint(cluster.timecodeValueLength, cluster.timecodeLength - cluster.timecodeValueLength - 1);
             const tcValBuf = new Uint8Array(cluster.timecodeValueLength);
             let remaining = newTc;
             for (let k = cluster.timecodeValueLength - 1; k >= 0; k--) {
                tcValBuf[k] = remaining & 0xFF;
                remaining = Math.floor(remaining / 256);
             }

             await writable.write(tcHdr);
             await writable.write(tcSizeVint);
             await writable.write(tcValBuf);
             totalBytesWritten += tcHdr.length + tcSizeVint.length + tcValBuf.length;

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
 * Standard Process Remux Stream
 * Rebuilds the Matroska/WebM container strictly to standard, fixing timecodes and dropping junk.
 */
export async function processNativeRemuxStream(
  file: File,
  writable: FileSystemWritableFileStream | null,
  onProgress: (prog: { percentage: number; statusText: string; speedMBs: number }) => void
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
             const preTcSize = (cluster.timecodeOffset - cluster.offset);
             const preTcBuf = await readSlice(file, cluster.offset, preTcSize);
             await writable.write(preTcBuf);
             totalBytesWritten += preTcBuf.length;

             const tcHdr = new Uint8Array([0xE7]);
             const tcSizeVint = writeVint(cluster.timecodeValueLength, cluster.timecodeLength - cluster.timecodeValueLength - 1);
             const tcValBuf = new Uint8Array(cluster.timecodeValueLength);
             let remaining = newTc;
             for (let k = cluster.timecodeValueLength - 1; k >= 0; k--) {
                tcValBuf[k] = remaining & 0xFF;
                remaining = Math.floor(remaining / 256);
             }

             await writable.write(tcHdr);
             await writable.write(tcSizeVint);
             await writable.write(tcValBuf);
             totalBytesWritten += tcHdr.length + tcSizeVint.length + tcValBuf.length;

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
