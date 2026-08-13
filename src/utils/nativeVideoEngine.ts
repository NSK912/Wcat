/**
 * Native Pure-JavaScript Zero-Copy Direct Disk-to-Disk Stream Engine
 * 
 * Bypasses WebAssembly & V8 ArrayBuffer allocations completely.
 * Passes Blob slices directly to FileSystemWritableFileStream handles.
 * Uses RAM strictly as a pass-through reference without allocating ArrayBuffers in JS Heap.
 * Includes Smart EBML Cluster Timecode Patcher & Duration Calculator for seamless Opus/HEVC/MKV video concatenation.
 */

export interface NativeStreamProgress {
  processedBytes: number;
  totalBytes: number;
  percentage: number;
  speedMBs: number;
  statusText: string;
}

export type NativeProgressCallback = (progress: NativeStreamProgress) => void;

/**
 * Reads exact duration of a video file in milliseconds using HTML5 Video Element with timeout fallback
 */
export function getFileDurationMs(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    video.src = url;

    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(0);
    }, 1500);

    video.onloadedmetadata = () => {
      clearTimeout(timer);
      const dur = video.duration || 0;
      URL.revokeObjectURL(url);
      resolve(Math.floor(dur * 1000));
    };

    video.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(0);
    };
  });
}

/**
 * Reads a small slice of a File as Uint8Array for header inspection only.
 */
async function readSlice(file: File, start: number, length: number): Promise<Uint8Array> {
  const blob = file.slice(start, start + length);
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Parse EBML Variable-Size Integer (VINT)
 */
function parseVint(buf: Uint8Array, offset: number): { value: number; length: number } | null {
  if (offset >= buf.length) return null;
  const firstByte = buf[offset];
  let length = 1;
  let mask = 0x80;

  while (length <= 8 && (firstByte & mask) === 0) {
    length++;
    mask >>= 1;
  }

  if (length > 8 || offset + length > buf.length) return null;

  let value = firstByte & (mask - 1);
  for (let i = 1; i < length; i++) {
    value = (value * 256) + buf[offset + i];
  }

  const isUnknown = value === Math.pow(2, 7 * length) - 1;
  return { value: isUnknown ? -1 : value, length };
}

/**
 * Encode EBML Variable-Size Integer (VINT)
 */
function encodeVint(value: number, length: number): Uint8Array {
  const result = new Uint8Array(length);
  if (value === -1) {
    result[0] = 0x01;
    for (let i = 1; i < length; i++) result[i] = 0xFF;
    return result;
  }
  let mask = 0x80 >> (length - 1);
  let val = value;
  for (let i = length - 1; i >= 0; i--) {
    result[i] = val & 0xFF;
    val = Math.floor(val / 256);
  }
  result[0] |= mask;
  return result;
}

/**
 * Reads MKV / WebM Segment Info Duration directly from EBML Header in milliseconds
 */
export async function readMkvDurationMs(file: File): Promise<number> {
  try {
    const scanLen = Math.min(2 * 1024 * 1024, file.size);
    const buf = await readSlice(file, 0, scanLen);
    let pos = 0;

    while (pos < buf.length - 8) {
      // Segment Info ID: 0x15 0x49 0xA9 0x66
      if (buf[pos] === 0x15 && buf[pos + 1] === 0x49 && buf[pos + 2] === 0xA9 && buf[pos + 3] === 0x66) {
        const infoSizeVint = parseVint(buf, pos + 4);
        if (!infoSizeVint) break;

        const infoContentStart = pos + 4 + infoSizeVint.length;
        const infoContentEnd = infoSizeVint.value > 0 ? Math.min(buf.length, infoContentStart + infoSizeVint.value) : buf.length;

        let timecodeScale = 1000000; // Default 1ms
        let durVal: number | null = null;

        let iPos = infoContentStart;
        while (iPos < infoContentEnd - 3) {
          // TimecodeScale ID: 0x2A 0xD7 0xB1
          if (buf[iPos] === 0x2A && buf[iPos + 1] === 0xD7 && buf[iPos + 2] === 0xB1) {
            const tcScaleSize = parseVint(buf, iPos + 3);
            if (tcScaleSize && tcScaleSize.value > 0) {
              let scaleVal = 0;
              const valStart = iPos + 3 + tcScaleSize.length;
              for (let k = 0; k < tcScaleSize.value; k++) {
                scaleVal = (scaleVal * 256) + buf[valStart + k];
              }
              if (scaleVal > 0) timecodeScale = scaleVal;
              iPos = valStart + tcScaleSize.value;
              continue;
            }
          }

          // Duration ID: 0x44 0x89
          if (buf[iPos] === 0x44 && buf[iPos + 1] === 0x89) {
            const durSizeVint = parseVint(buf, iPos + 2);
            if (durSizeVint && (durSizeVint.value === 4 || durSizeVint.value === 8)) {
              const valStart = iPos + 2 + durSizeVint.length;
              const view = new DataView(buf.buffer, buf.byteOffset + valStart, durSizeVint.value);
              if (durSizeVint.value === 4) {
                durVal = view.getFloat32(0, false);
              } else if (durSizeVint.value === 8) {
                durVal = view.getFloat64(0, false);
              }
              break;
            }
          }

          iPos++;
        }

        if (durVal !== null && durVal > 0) {
          const durMs = Math.floor(durVal * (timecodeScale / 1000000));
          if (durMs > 0) return durMs;
        }
      }
      pos++;
    }
  } catch {
    // Ignore and fallback
  }

  return await scanLastClusterTimecodeMs(file);
}

/**
 * Fallback: Scans last 16MB of file for the highest Cluster Timecode
 */
async function scanLastClusterTimecodeMs(file: File): Promise<number> {
  try {
    const scanSize = Math.min(16 * 1024 * 1024, file.size);
    const scanOffset = file.size - scanSize;
    const buf = await readSlice(file, scanOffset, scanSize);

    let maxTc = 0;
    for (let i = buf.length - 8; i >= 0; i--) {
      // Cluster ID: 0x1F 0x43 0xB6 0x75
      if (buf[i] === 0x1F && buf[i + 1] === 0x43 && buf[i + 2] === 0xB6 && buf[i + 3] === 0x75) {
        const sizeVint = parseVint(buf, i + 4);
        if (!sizeVint) continue;
        let pos = i + 4 + sizeVint.length;
        while (pos < buf.length - 3 && pos < i + 128) {
          if (buf[pos] === 0xE7) { // Timecode ID
            const tcSize = parseVint(buf, pos + 1);
            if (tcSize && pos + 1 + tcSize.length + tcSize.value <= buf.length) {
              let tc = 0;
              const valStart = pos + 1 + tcSize.length;
              for (let k = 0; k < tcSize.value; k++) {
                tc = (tc * 256) + buf[valStart + k];
              }
              if (tc > maxTc) maxTc = tc;
            }
            break;
          }
          pos++;
        }
        if (maxTc > 0) break;
      }
    }
    return maxTc > 0 ? (maxTc + 1000) : 0;
  } catch {
    return 0;
  }
}

/**
 * Estimates file duration in milliseconds
 */
export async function estimateFileDurationMs(file: File): Promise<number> {
  // 1. Fast & exact MKV / WebM header parsing
  const mkvDur = await readMkvDurationMs(file);
  if (mkvDur > 0) return mkvDur;

  // 2. HTML5 Video element fallback
  const htmlDur = await getFileDurationMs(file);
  if (htmlDur > 0) return htmlDur;

  return 0;
}

/**
 * Check if a File is EBML (MKV or WebM)
 */
async function isMkvOrWebm(file: File): Promise<boolean> {
  if (file.name.toLowerCase().endsWith('.mkv') || file.name.toLowerCase().endsWith('.webm')) {
    return true;
  }
  try {
    const first4 = await readSlice(file, 0, 4);
    // EBML Header ID: 0x1A 0x45 0xDF 0xA3
    return first4[0] === 0x1A && first4[1] === 0x45 && first4[2] === 0xDF && first4[3] === 0xA3;
  } catch {
    return false;
  }
}

/**
 * Patch Segment Header in MKV File #1 to Unknown Size (allows streaming beyond File #1 boundaries)
 */
function patchSegmentHeader(headerBuf: Uint8Array): Uint8Array {
  const patched = new Uint8Array(headerBuf);
  let pos = 0;
  while (pos < patched.length - 12) {
    // Segment ID: 0x18 0x53 0x80 0x67
    if (patched[pos] === 0x18 && patched[pos + 1] === 0x53 && patched[pos + 2] === 0x80 && patched[pos + 3] === 0x67) {
      const sizeVint = parseVint(patched, pos + 4);
      if (sizeVint) {
        const vintPos = pos + 4;
        if (sizeVint.length === 8) {
          patched[vintPos] = 0x01;
          for (let i = 1; i < 8; i++) patched[vintPos + i] = 0xFF;
        } else if (sizeVint.length === 4) {
          patched[vintPos] = 0x1F;
          for (let i = 1; i < 4; i++) patched[vintPos + i] = 0xFF;
        }
      }
      break;
    }
    pos++;
  }
  return patched;
}

/**
 * Patch Segment Info element (0x1549A966) Duration (0x4489) in File #1
 * Updates total duration so players display full combined length on timeline
 */
function patchSegmentInfo(headerBuf: Uint8Array, totalDurationMs: number): Uint8Array {
  const buf = new Uint8Array(headerBuf);
  let pos = 0;

  while (pos < buf.length - 8) {
    // Segment Info ID: 0x15 0x49 0xA9 0x66
    if (buf[pos] === 0x15 && buf[pos + 1] === 0x49 && buf[pos + 2] === 0xA9 && buf[pos + 3] === 0x66) {
      const infoSizeVint = parseVint(buf, pos + 4);
      if (!infoSizeVint) break;

      const infoContentStart = pos + 4 + infoSizeVint.length;
      const infoContentEnd = infoSizeVint.value > 0 ? Math.min(buf.length, infoContentStart + infoSizeVint.value) : buf.length;

      let timecodeScale = 1000000; // Default 1ms = 1,000,000 ns
      let durValOffset = -1;
      let durValLen = 0;

      let iPos = infoContentStart;
      while (iPos < infoContentEnd - 3) {
        // TimecodeScale ID: 0x2A 0xD7 0xB1
        if (buf[iPos] === 0x2A && buf[iPos + 1] === 0xD7 && buf[iPos + 2] === 0xB1) {
          const tcScaleSize = parseVint(buf, iPos + 3);
          if (tcScaleSize && tcScaleSize.value > 0) {
            let scaleVal = 0;
            const valStart = iPos + 3 + tcScaleSize.length;
            for (let k = 0; k < tcScaleSize.value; k++) {
              scaleVal = (scaleVal * 256) + buf[valStart + k];
            }
            if (scaleVal > 0) timecodeScale = scaleVal;
            iPos = valStart + tcScaleSize.value;
            continue;
          }
        }

        // Duration ID: 0x44 0x89
        if (buf[iPos] === 0x44 && buf[iPos + 1] === 0x89) {
          const durSizeVint = parseVint(buf, iPos + 2);
          if (durSizeVint && (durSizeVint.value === 4 || durSizeVint.value === 8)) {
            durValOffset = iPos + 2 + durSizeVint.length;
            durValLen = durSizeVint.value;
            break;
          }
        }

        iPos++;
      }

      const durationInTicks = totalDurationMs / (timecodeScale / 1000000);

      if (durValOffset !== -1 && (durValLen === 4 || durValLen === 8)) {
        const view = new DataView(buf.buffer, buf.byteOffset + durValOffset, durValLen);
        if (durValLen === 4) {
          view.setFloat32(0, durationInTicks, false);
        } else if (durValLen === 8) {
          view.setFloat64(0, durationInTicks, false);
        }
        return buf;
      } else {
        // Insert Duration element (0x44 0x89) if missing
        const durHeader = new Uint8Array([0x44, 0x89, 0x88]); // len 8
        const durVal = new Uint8Array(8);
        const view = new DataView(durVal.buffer);
        view.setFloat64(0, durationInTicks, false);

        const before = buf.slice(0, infoContentStart);
        const after = buf.slice(infoContentStart);

        const newBuf = new Uint8Array(buf.length + 11);
        newBuf.set(before, 0);
        newBuf.set(durHeader, infoContentStart);
        newBuf.set(durVal, infoContentStart + 3);
        newBuf.set(after, infoContentStart + 11);

        if (infoSizeVint.value > 0) {
          const newInfoSize = infoSizeVint.value + 11;
          const newInfoSizeVint = encodeVint(newInfoSize, infoSizeVint.length);
          newBuf.set(newInfoSizeVint, pos + 4);
        }

        return newBuf;
      }
    }
    pos++;
  }

  return buf;
}

/**
 * Neutralizes Cues (0x1C53BB6B), SeekHead (0x114D9B74), and Tags (0x1254C367) in Header
 * Replaces them with valid EBML Void elements (0xEC) of matching length
 */
function neutralizeEbmlElementsInHeader(headerBuf: Uint8Array): Uint8Array {
  const buf = new Uint8Array(headerBuf);
  let pos = 0;

  while (pos < buf.length - 8) {
    const isCues = buf[pos] === 0x1C && buf[pos + 1] === 0x53 && buf[pos + 2] === 0xBB && buf[pos + 3] === 0x6B;
    const isSeekHead = buf[pos] === 0x11 && buf[pos + 1] === 0x4D && buf[pos + 2] === 0x9B && buf[pos + 3] === 0x74;
    const isTags = buf[pos] === 0x12 && buf[pos + 1] === 0x54 && buf[pos + 2] === 0xC3 && buf[pos + 3] === 0x67;

    if (isCues || isSeekHead || isTags) {
      const sizeVint = parseVint(buf, pos + 4);
      if (sizeVint && sizeVint.value >= 0) {
        const totalElemLen = 4 + sizeVint.length + sizeVint.value;
        if (pos + totalElemLen <= buf.length) {
          buf[pos] = 0xEC; // Void ID
          const payloadLen = totalElemLen - 1 - sizeVint.length;
          const voidVint = encodeVint(payloadLen, sizeVint.length);
          buf.set(voidVint, pos + 1);
          buf.fill(0x00, pos + 1 + sizeVint.length, pos + totalElemLen);
          pos += totalElemLen;
          continue;
        }
      }
      // Fallback 4-byte Void
      buf[pos] = 0xEC;
      buf[pos + 1] = 0x82;
      buf[pos + 2] = 0x00;
      buf[pos + 3] = 0x00;
    }
    pos++;
  }
  return buf;
}

/**
 * Find EBML Element ID offset in Matroska / MKV / WebM file
 */
async function findEbmlClustersOffset(file: File): Promise<{ headerLength: number; firstClusterOffset: number }> {
  const chunkSize = Math.min(2 * 1024 * 1024, file.size);
  const buffer = await readSlice(file, 0, chunkSize);
  let pos = 0;

  let firstClusterOffset = -1;

  while (pos < buffer.length - 4) {
    // Cluster ID: 0x1F 0x43 0xB6 0x75
    if (buffer[pos] === 0x1F && buffer[pos + 1] === 0x43 && buffer[pos + 2] === 0xB6 && buffer[pos + 3] === 0x75) {
      firstClusterOffset = pos;
      break;
    }
    pos++;
  }

  if (firstClusterOffset !== -1) {
    return {
      headerLength: firstClusterOffset,
      firstClusterOffset: firstClusterOffset,
    };
  }

  return { headerLength: 0, firstClusterOffset: 0 };
}

interface PatchClusterResult {
  patchedBuf: Uint8Array;
  origHeaderLen: number;
  patchedHeaderLen: number;
  origTimecodeMs: number;
  newTimecodeMs: number;
}

/**
 * Patch Cluster Timecode in EBML Cluster Header
 */
function patchClusterHeader(
  inspectBuf: Uint8Array,
  timecodeOffsetMs: number
): PatchClusterResult | null {
  if (inspectBuf[0] !== 0x1F || inspectBuf[1] !== 0x43 || inspectBuf[2] !== 0xB6 || inspectBuf[3] !== 0x75) {
    return null;
  }

  const clusterSizeVint = parseVint(inspectBuf, 4);
  if (!clusterSizeVint) return null;

  let pos = 4 + clusterSizeVint.length;

  while (pos < inspectBuf.length - 3) {
    if (inspectBuf[pos] === 0xE7) { // Timecode ID
      const tcSizeVint = parseVint(inspectBuf, pos + 1);
      if (!tcSizeVint) return null;

      const tcValPos = pos + 1 + tcSizeVint.length;
      const tcLen = tcSizeVint.value;

      if (tcValPos + tcLen > inspectBuf.length) return null;

      let origTc = 0;
      for (let i = 0; i < tcLen; i++) {
        origTc = (origTc * 256) + inspectBuf[tcValPos + i];
      }

      const newTc = Math.floor(origTc + timecodeOffsetMs);
      const origHeaderLen = tcValPos + tcLen;

      if (newTc <= 65535 || tcLen >= 4) {
        const patchedBuf = new Uint8Array(inspectBuf.slice(0, origHeaderLen));
        let tempTc = newTc;
        for (let i = tcLen - 1; i >= 0; i--) {
          patchedBuf[tcValPos + i] = tempTc & 0xFF;
          tempTc = Math.floor(tempTc / 256);
        }
        return {
          patchedBuf,
          origHeaderLen,
          patchedHeaderLen: origHeaderLen,
          origTimecodeMs: origTc,
          newTimecodeMs: newTc,
        };
      } else {
        const newTcLen = 4;
        const lenDiff = newTcLen - tcLen;

        const newClusterSize = clusterSizeVint.value > 0 ? clusterSizeVint.value + lenDiff : clusterSizeVint.value;
        const newClusterSizeVint = encodeVint(newClusterSize, clusterSizeVint.length);

        const headerId = inspectBuf.slice(0, 4);
        const tcHeader = new Uint8Array([0xE7, 0x84]); // ID 0xE7, VINT len 4
        const tcVal = new Uint8Array(4);
        let tempTc = newTc;
        for (let i = 3; i >= 0; i--) {
          tcVal[i] = tempTc & 0xFF;
          tempTc = Math.floor(tempTc / 256);
        }

        const restHeader = inspectBuf.slice(tcValPos + tcLen, origHeaderLen);

        const patchedBuf = new Uint8Array(4 + newClusterSizeVint.length + 2 + 4 + restHeader.length);
        patchedBuf.set(headerId, 0);
        patchedBuf.set(newClusterSizeVint, 4);
        patchedBuf.set(tcHeader, 4 + newClusterSizeVint.length);
        patchedBuf.set(tcVal, 4 + newClusterSizeVint.length + 2);
        patchedBuf.set(restHeader, 4 + newClusterSizeVint.length + 2 + 4);

        return {
          patchedBuf,
          origHeaderLen,
          patchedHeaderLen: patchedBuf.length,
          origTimecodeMs: origTc,
          newTimecodeMs: newTc,
        };
      }
    }
    pos++;
  }

  return null;
}

/**
 * Direct Zero-Copy Chunk Write (RAM Pass-Through)
 */
async function writeChunkZeroCopy(
  chunkBlob: Blob,
  writable: FileSystemWritableFileStream | WritableStreamDefaultWriter<Uint8Array>
): Promise<void> {
  if ('write' in writable && typeof (writable as any).write === 'function') {
    await (writable as FileSystemWritableFileStream).write(chunkBlob);
  } else {
    const buf = new Uint8Array(await chunkBlob.arrayBuffer());
    await (writable as WritableStreamDefaultWriter<Uint8Array>).write(buf);
  }
}

/**
 * Helper to encode EBML Unsigned Integer
 */
function encodeEbmlUint(val: number): Uint8Array {
  if (val === 0) return new Uint8Array([0]);
  const b: number[] = [];
  let temp = Math.floor(val);
  while (temp > 0) {
    b.unshift(temp & 0xff);
    temp = Math.floor(temp / 256);
  }
  return new Uint8Array(b);
}

/**
 * Get minimum VINT length for a given size
 */
function getVintLen(len: number): number {
  if (len < 127) return 1;
  if (len < 16383) return 2;
  if (len < 2097151) return 3;
  if (len < 268435455) return 4;
  return 8;
}

/**
 * Helper to wrap payload in an EBML Element
 */
function buildElement(idBytes: number[], payload: Uint8Array): Uint8Array {
  const vintLen = getVintLen(payload.length);
  const sizeVint = encodeVint(payload.length, vintLen);
  const result = new Uint8Array(idBytes.length + sizeVint.length + payload.length);
  result.set(idBytes, 0);
  result.set(sizeVint, idBytes.length);
  result.set(payload, idBytes.length + sizeVint.length);
  return result;
}

/**
 * Builds a valid Matroska / MKV Cues element (0x1C53BB6B) containing all CuePoints
 * Maps every Cluster timestamp to its exact byte offset in the output Segment payload
 */
export function buildCuesElement(cuePoints: { timeMs: number; pos: number }[], trackNum: number = 1): Uint8Array {
  const cuePointBuffers: Uint8Array[] = [];

  for (const cp of cuePoints) {
    // 1. CueTime (0xB3)
    const timeBytes = encodeEbmlUint(cp.timeMs);
    const cueTimeElem = buildElement([0xB3], timeBytes);

    // 2. CueTrack (0xF7)
    const trackBytes = encodeEbmlUint(trackNum);
    const cueTrackElem = buildElement([0xF7], trackBytes);

    // 3. CueClusterPosition (0xF1)
    const posBytes = encodeEbmlUint(cp.pos);
    const cuePosElem = buildElement([0xF1], posBytes);

    // 4. CueTrackPositions (0xB7)
    const trackPosPayload = new Uint8Array(cueTrackElem.length + cuePosElem.length);
    trackPosPayload.set(cueTrackElem, 0);
    trackPosPayload.set(cuePosElem, cueTrackElem.length);
    const cueTrackPosElem = buildElement([0xB7], trackPosPayload);

    // 5. CuePoint (0xBB)
    const cuePointPayload = new Uint8Array(cueTimeElem.length + cueTrackPosElem.length);
    cuePointPayload.set(cueTimeElem, 0);
    cuePointPayload.set(cueTrackPosElem, cueTimeElem.length);
    const cuePointElem = buildElement([0xBB], cuePointPayload);

    cuePointBuffers.push(cuePointElem);
  }

  // Combine all CuePoints into Cues element (0x1C53BB6B)
  const totalPayloadLen = cuePointBuffers.reduce((sum, b) => sum + b.length, 0);
  const cuesPayload = new Uint8Array(totalPayloadLen);
  let offset = 0;
  for (const buf of cuePointBuffers) {
    cuesPayload.set(buf, offset);
    offset += buf.length;
  }

  return buildElement([0x1C, 0x53, 0xBB, 0x6B], cuesPayload);
}

/**
 * Build a Matroska SeekHead element (0x114D9B74) pointing to Cues (0x1C53BB6B)
 */
export function buildSeekHeadElement(seeks: { id: number[]; pos: number }[]): Uint8Array {
  const seekBuffers: Uint8Array[] = [];

  for (const s of seeks) {
    const idPayload = new Uint8Array(s.id);
    const seekIdElem = buildElement([0x53, 0xAB], idPayload);

    const posBytes = encodeEbmlUint(s.pos);
    const seekPosElem = buildElement([0x53, 0xAC], posBytes);

    const seekPayload = new Uint8Array(seekIdElem.length + seekPosElem.length);
    seekPayload.set(seekIdElem, 0);
    seekPayload.set(seekPosElem, seekIdElem.length);
    const seekElem = buildElement([0x4D, 0xBB], seekPayload);

    seekBuffers.push(seekElem);
  }

  const totalPayloadLen = seekBuffers.reduce((sum, b) => sum + b.length, 0);
  const seekHeadPayload = new Uint8Array(totalPayloadLen);
  let offset = 0;
  for (const buf of seekBuffers) {
    seekHeadPayload.set(buf, offset);
    offset += buf.length;
  }

  return buildElement([0x11, 0x4D, 0x9B, 0x74], seekHeadPayload);
}

/**
 * Checks if a Cluster payload contains a Video Keyframe (SimpleBlock with bit 0x80 set or BlockGroup)
 */
function clusterHasKeyframe(inspectBuf: Uint8Array): boolean {
  let pos = 4;
  const clusterSize = parseVint(inspectBuf, pos);
  if (!clusterSize) return true;
  pos += clusterSize.length;

  while (pos < inspectBuf.length - 8) {
    if (inspectBuf[pos] === 0xE7) { // Timecode ID
      const tcSize = parseVint(inspectBuf, pos + 1);
      if (tcSize) {
        pos += 1 + tcSize.length + tcSize.value;
        continue;
      }
    }

    if (inspectBuf[pos] === 0xA3) { // SimpleBlock
      const sizeVint = parseVint(inspectBuf, pos + 1);
      if (!sizeVint) break;
      const dataPos = pos + 1 + sizeVint.length;
      const trackVint = parseVint(inspectBuf, dataPos);
      if (!trackVint) break;
      const flagsPos = dataPos + trackVint.length + 2; // skip 2 bytes timecode
      if (flagsPos < inspectBuf.length) {
        const flags = inspectBuf[flagsPos];
        // Bit 7 (0x80) is Keyframe flag in Matroska SimpleBlock
        return (flags & 0x80) !== 0;
      }
      break;
    } else if (inspectBuf[pos] === 0xA0) { // BlockGroup (Keyframe)
      return true;
    }
    pos++;
  }
  return true; // Fallback
}

/**
 * Pure JS Zero-Copy Stream Concatenator for MKV / WebM / MP4 / TS
 */
export async function processNativeConcatStream(
  files: File[],
  writable: FileSystemWritableFileStream | WritableStreamDefaultWriter<Uint8Array>,
  onProgress?: NativeProgressCallback
): Promise<{ success: boolean; totalBytesWritten: number }> {
  if (files.length === 0) return { success: false, totalBytesWritten: 0 };

  const totalInputSize = files.reduce((sum, f) => sum + f.size, 0);
  let totalBytesWritten = 0;
  const startTime = Date.now();
  const CHUNK_SIZE = 16 * 1024 * 1024;

  const isEbml = await isMkvOrWebm(files[0]);

  if (isEbml && files.length > 1) {
    if (onProgress) {
      onProgress({
        processedBytes: 0,
        totalBytes: totalInputSize,
        percentage: 0,
        speedMBs: 0,
        statusText: 'กำลังคำนวณความยาวรวมของทุกไฟล์ และปรับแต่ง Header...',
      });
    }

    // 1. Calculate durations of all video files
    const fileDurationsMs = await Promise.all(files.map((f) => estimateFileDurationMs(f)));
    const totalDurationMs = fileDurationsMs.reduce((sum, d) => sum + d, 0);

    // 2. Prepare File #1 Header
    const { headerLength, firstClusterOffset } = await findEbmlClustersOffset(files[0]);
    let segmentDataStartOffset = 0;
    let seekHeadFileOffset = -1;
    let seekHeadLen = 0;
    let segmentSizeFileOffset = -1;

    if (headerLength > 0) {
      const origHeaderBlob = files[0].slice(0, headerLength);
      const origHeaderBuf = new Uint8Array(await origHeaderBlob.arrayBuffer());

      let patchedHeaderBuf = patchSegmentHeader(origHeaderBuf);
      if (totalDurationMs > 0) {
        patchedHeaderBuf = patchSegmentInfo(patchedHeaderBuf, totalDurationMs);
      }
      patchedHeaderBuf = neutralizeEbmlElementsInHeader(patchedHeaderBuf);

      // Locate Segment ID (0x18538067)
      for (let p = 0; p < patchedHeaderBuf.length - 8; p++) {
        if (patchedHeaderBuf[p] === 0x18 && patchedHeaderBuf[p + 1] === 0x53 && patchedHeaderBuf[p + 2] === 0x80 && patchedHeaderBuf[p + 3] === 0x67) {
          const vint = parseVint(patchedHeaderBuf, p + 4);
          if (vint) {
            segmentSizeFileOffset = p + 4;
            segmentDataStartOffset = p + 4 + vint.length;
          }
          break;
        }
      }

      // Find first Void element in header to place initial SeekHead placeholder
      for (let p = segmentDataStartOffset; p < patchedHeaderBuf.length - 16; p++) {
        if (patchedHeaderBuf[p] === 0xEC) { // Void ID
          const vSize = parseVint(patchedHeaderBuf, p + 1);
          if (vSize && vSize.value >= 32) {
            seekHeadFileOffset = p;
            seekHeadLen = 1 + vSize.length + vSize.value;
            break;
          }
        }
      }

      await writeChunkZeroCopy(new Blob([patchedHeaderBuf]), writable);
      totalBytesWritten += patchedHeaderBuf.length;
    }

    let timeOffsetMs = 0;
    const cuePoints: { timeMs: number; pos: number }[] = [];
    let lastCueTimeMs = -1000;

    // 3. Process Clusters sequentially from File #1, #2, #3, #4, #5
    for (let fIdx = 0; fIdx < files.length; fIdx++) {
      const file = files[fIdx];
      const clusterStartOffset = (fIdx === 0 && firstClusterOffset > 0)
        ? firstClusterOffset
        : (await findEbmlClustersOffset(file)).firstClusterOffset;

      if (clusterStartOffset < 0 || clusterStartOffset >= file.size) continue;

      let offset = clusterStartOffset;
      let fileMaxTc = 0;

      while (offset < file.size - 8) {
        const inspectLen = Math.min(128, file.size - offset);
        const inspectBuf = await readSlice(file, offset, inspectLen);

        // Check if Cluster ID: 0x1F 0x43 0xB6 0x75
        if (inspectBuf[0] === 0x1F && inspectBuf[1] === 0x43 && inspectBuf[2] === 0xB6 && inspectBuf[3] === 0x75) {
          const sizeVint = parseVint(inspectBuf, 4);
          if (!sizeVint) {
            offset += 1;
            continue;
          }

          const clusterHeaderLen = 4 + sizeVint.length;
          const clusterDataLen = sizeVint.value;

          const patchedResult = patchClusterHeader(inspectBuf, timeOffsetMs);

          if (patchedResult) {
            fileMaxTc = Math.max(fileMaxTc, patchedResult.origTimecodeMs);

            // Record CuePoint ONLY for Clusters that contain Video Keyframes
            const clusterPosInSegment = Math.max(0, totalBytesWritten - segmentDataStartOffset);
            const isKeyframe = clusterHasKeyframe(inspectBuf);

            if (isKeyframe && (patchedResult.newTimecodeMs - lastCueTimeMs >= 250 || fIdx > 0 && cuePoints.length === 0)) {
              cuePoints.push({
                timeMs: patchedResult.newTimecodeMs,
                pos: clusterPosInSegment,
              });
              lastCueTimeMs = patchedResult.newTimecodeMs;
            }

            await writeChunkZeroCopy(new Blob([patchedResult.patchedBuf]), writable);
            totalBytesWritten += patchedResult.patchedHeaderLen;

            const payloadStart = offset + patchedResult.origHeaderLen;
            const payloadEnd = clusterDataLen > 0
              ? Math.min(file.size, offset + clusterHeaderLen + clusterDataLen)
              : Math.min(file.size, payloadStart + CHUNK_SIZE);

            if (payloadEnd > payloadStart) {
              const payloadBlob = file.slice(payloadStart, payloadEnd);
              await writeChunkZeroCopy(payloadBlob, writable);
              totalBytesWritten += (payloadEnd - payloadStart);
            }

            offset = clusterDataLen > 0 ? (offset + clusterHeaderLen + clusterDataLen) : payloadEnd;
          } else {
            const chunkEnd = clusterDataLen > 0 ? Math.min(file.size, offset + clusterHeaderLen + clusterDataLen) : Math.min(file.size, offset + CHUNK_SIZE);
            await writeChunkZeroCopy(file.slice(offset, chunkEnd), writable);
            totalBytesWritten += (chunkEnd - offset);
            offset = chunkEnd;
          }
        } else {
          // Check for top-level non-cluster elements (Cues, SeekHead, Tags, Chapters, Void) to skip
          let skipped = false;

          // Cues (0x1C53BB6B)
          if (inspectBuf[0] === 0x1C && inspectBuf[1] === 0x53 && inspectBuf[2] === 0xBB && inspectBuf[3] === 0x6B) {
            const sizeVint = parseVint(inspectBuf, 4);
            if (sizeVint && sizeVint.value >= 0) {
              offset += 4 + sizeVint.length + sizeVint.value;
              skipped = true;
            }
          }
          // SeekHead (0x114D9B74)
          else if (inspectBuf[0] === 0x11 && inspectBuf[1] === 0x4D && inspectBuf[2] === 0x9B && inspectBuf[3] === 0x74) {
            const sizeVint = parseVint(inspectBuf, 4);
            if (sizeVint && sizeVint.value >= 0) {
              offset += 4 + sizeVint.length + sizeVint.value;
              skipped = true;
            }
          }
          // Tags (0x1254C367)
          else if (inspectBuf[0] === 0x12 && inspectBuf[1] === 0x54 && inspectBuf[2] === 0xC3 && inspectBuf[3] === 0x67) {
            const sizeVint = parseVint(inspectBuf, 4);
            if (sizeVint && sizeVint.value >= 0) {
              offset += 4 + sizeVint.length + sizeVint.value;
              skipped = true;
            }
          }
          // Chapters (0x1043A770)
          else if (inspectBuf[0] === 0x10 && inspectBuf[1] === 0x43 && inspectBuf[2] === 0xA7 && inspectBuf[3] === 0x70) {
            const sizeVint = parseVint(inspectBuf, 4);
            if (sizeVint && sizeVint.value >= 0) {
              offset += 4 + sizeVint.length + sizeVint.value;
              skipped = true;
            }
          }
          // Void (0xEC)
          else if (inspectBuf[0] === 0xEC) {
            const sizeVint = parseVint(inspectBuf, 1);
            if (sizeVint && sizeVint.value >= 0) {
              offset += 1 + sizeVint.length + sizeVint.value;
              skipped = true;
            }
          }

          if (!skipped) {
            // Scan for next Cluster ID
            let foundNext = -1;
            const scanBufLen = Math.min(1024 * 1024, file.size - offset);
            if (scanBufLen <= 4) break;

            const scanBuf = await readSlice(file, offset, scanBufLen);
            for (let p = 0; p < scanBuf.length - 4; p++) {
              if (scanBuf[p] === 0x1F && scanBuf[p + 1] === 0x43 && scanBuf[p + 2] === 0xB6 && scanBuf[p + 3] === 0x75) {
                foundNext = offset + p;
                break;
              }
            }

            if (foundNext !== -1) {
              offset = foundNext;
            } else {
              break; // No more clusters in this file
            }
          }
        }

        if (onProgress) {
          const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
          const speedMBs = (totalBytesWritten / (1024 * 1024)) / elapsedSec;
          onProgress({
            processedBytes: totalBytesWritten,
            totalBytes: totalInputSize,
            percentage: Math.min(99.9, (totalBytesWritten / totalInputSize) * 100),
            speedMBs,
            statusText: `กำลังสตรีมรวมไฟล์ ${fIdx + 1}/${files.length} (${file.name}) [Zero-Copy Direct Stream]`,
          });
        }
      }

      const fileKnownDurMs = fileDurationsMs[fIdx] || 0;
      const effectiveFileDurMs = Math.max(fileMaxTc + 1000, fileKnownDurMs);
      timeOffsetMs += effectiveFileDurMs;
    }

    // 4. Build Cues and SeekHead Elements
    if (cuePoints.length > 0) {
      if (onProgress) {
        onProgress({
          processedBytes: totalBytesWritten,
          totalBytes: totalInputSize,
          percentage: 99.8,
          speedMBs: 0,
          statusText: 'กำลังสร้างดรรชนีกรอเวลา (Cues Index) เพื่อรองรับการลากวิดีโอทุกช่วงอย่างลื่นไหล...',
        });
      }

      const cuesPosInSegment = Math.max(0, totalBytesWritten - segmentDataStartOffset);
      const cuesElem = buildCuesElement(cuePoints);

      // Build SeekHead pointing to Cues position
      const seekHeadElem = buildSeekHeadElement([
        { id: [0x1C, 0x53, 0xBB, 0x6B], pos: cuesPosInSegment }
      ]);

      // Write Tail SeekHead + Cues Element at end of file
      await writeChunkZeroCopy(new Blob([seekHeadElem, cuesElem]), writable);
      totalBytesWritten += seekHeadElem.length + cuesElem.length;

      // 5. In-place Header Patching if stream supports seek()
      if ('seek' in writable && typeof (writable as any).seek === 'function') {
        const seekableStream = writable as FileSystemWritableFileStream;
        try {
          // Patch Segment payload length in header
          if (segmentSizeFileOffset >= 0) {
            const finalSegmentPayloadSize = totalBytesWritten - segmentDataStartOffset;
            const sizeVint8 = encodeVint(finalSegmentPayloadSize, 8);
            await seekableStream.seek(segmentSizeFileOffset);
            await seekableStream.write(sizeVint8);
          }

          // Patch SeekHead in header placeholder if available
          if (seekHeadFileOffset >= 0 && seekHeadElem.length <= seekHeadLen) {
            const paddedSeekHead = new Uint8Array(seekHeadLen);
            paddedSeekHead.set(seekHeadElem, 0);
            // Pad remaining space with Void (0xEC)
            const remaining = seekHeadLen - seekHeadElem.length;
            if (remaining > 0) {
              paddedSeekHead[seekHeadElem.length] = 0xEC;
              const voidVint = encodeVint(remaining - 1 - 1, 1);
              paddedSeekHead.set(voidVint, seekHeadElem.length + 1);
            }
            await seekableStream.seek(seekHeadFileOffset);
            await seekableStream.write(paddedSeekHead);
          }

          // Return cursor to end of file
          await seekableStream.seek(totalBytesWritten);
        } catch (err) {
          console.warn('In-place header patch seek warning:', err);
        }
      }
    }
  } else {
    // Direct Zero-Copy Stream Concatenator (For TS / MP4 / Generic formats)
    for (let fIdx = 0; fIdx < files.length; fIdx++) {
      const file = files[fIdx];
      let offset = 0;

      while (offset < file.size) {
        const end = Math.min(offset + CHUNK_SIZE, file.size);
        const chunkBlob = file.slice(offset, end);

        await writeChunkZeroCopy(chunkBlob, writable);
        totalBytesWritten += (end - offset);
        offset = end;

        if (onProgress) {
          const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
          const speedMBs = (totalBytesWritten / (1024 * 1024)) / elapsedSec;
          onProgress({
            processedBytes: totalBytesWritten,
            totalBytes: totalInputSize,
            percentage: Math.min(99.9, (totalBytesWritten / totalInputSize) * 100),
            speedMBs,
            statusText: `กำลังสตรีมรวมไฟล์ ${fIdx + 1}/${files.length} (${file.name}) [Zero-Copy Pass-Through]`,
          });
        }
      }
    }
  }

  if (onProgress) {
    const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
    const speedMBs = (totalBytesWritten / (1024 * 1024)) / elapsedSec;
    onProgress({
      processedBytes: totalBytesWritten,
      totalBytes: totalInputSize,
      percentage: 100,
      speedMBs,
      statusText: `รวมวิดีโอสำเร็จเรียบร้อย (${(totalBytesWritten / (1024 * 1024 * 1024)).toFixed(2)} GB - Zero-Copy Pass-Through)`,
    });
  }

  return { success: true, totalBytesWritten };
}

/**
 * Pure JS Zero-Copy Stream Video Trimmer
 */
export async function processNativeTrimStream(
  file: File,
  startTimeSec: number,
  endTimeSec: number,
  totalDurationSec: number,
  writable: FileSystemWritableFileStream | WritableStreamDefaultWriter<Uint8Array>,
  onProgress?: NativeProgressCallback
): Promise<{ success: boolean; totalBytesWritten: number }> {
  const startTime = Date.now();
  const dur = Math.max(0.1, totalDurationSec || 1);
  const startRatio = Math.max(0, Math.min(1, startTimeSec / dur));
  const endRatio = Math.max(startRatio, Math.min(1, endTimeSec / dur));

  const startByte = Math.floor(file.size * startRatio);
  const endByte = Math.min(file.size, Math.ceil(file.size * endRatio));
  const targetSize = Math.max(1024, endByte - startByte);

  let totalBytesWritten = 0;
  const CHUNK_SIZE = 16 * 1024 * 1024;

  const headerLen = Math.min(128 * 1024, file.size);
  if (startByte > headerLen) {
    const headerBlob = file.slice(0, headerLen);
    await writeChunkZeroCopy(headerBlob, writable);
    totalBytesWritten += headerLen;
  }

  let offset = startByte;
  while (offset < endByte) {
    const chunkEnd = Math.min(offset + CHUNK_SIZE, endByte);
    const chunkBlob = file.slice(offset, chunkEnd);

    await writeChunkZeroCopy(chunkBlob, writable);
    totalBytesWritten += (chunkEnd - offset);
    offset = chunkEnd;

    if (onProgress) {
      const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
      const speedMBs = (totalBytesWritten / (1024 * 1024)) / elapsedSec;
      onProgress({
        processedBytes: totalBytesWritten,
        totalBytes: targetSize,
        percentage: Math.min(99.9, ((offset - startByte) / targetSize) * 100),
        speedMBs,
        statusText: `กำลังสตรีมตัดวิดีโอ (${(totalBytesWritten / (1024 * 1024)).toFixed(1)} MB) [Zero-Copy Pass-Through]`,
      });
    }
  }

  if (onProgress) {
    const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
    const speedMBs = (totalBytesWritten / (1024 * 1024)) / elapsedSec;
    onProgress({
      processedBytes: totalBytesWritten,
      totalBytes: targetSize,
      percentage: 100,
      speedMBs,
      statusText: `ตัดวิดีโอสำเร็จเรียบร้อย (${(totalBytesWritten / (1024 * 1024)).toFixed(1)} MB - Zero-Copy Pass-Through)`,
    });
  }

  return { success: true, totalBytesWritten };
}
