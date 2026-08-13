/**
 * Video Inspector & Real-time Diagnostic Engine for DevTools
 * Analyzes real video file binary structure (MKV/WebM/MP4/TS) & HTML5 Video Element properties.
 * Outputs authentic diagnostic reports directly to DevTools Console.
 */

export interface TrackInfo {
  trackNumber: number;
  trackType: 'video' | 'audio' | 'subtitle' | 'unknown';
  codecId: string;
}

export interface MatroskaDiagnostics {
  hasEbmlHeader: boolean;
  docType?: string;
  hasSegment: boolean;
  segmentSize8ByteVint: boolean;
  hasSeekHead: boolean;
  hasInfo: boolean;
  durationSec?: number;
  hasTracks: boolean;
  tracks: TrackInfo[];
  clusterCount: number;
  firstClusterTimecodeMs?: number;
  lastClusterTimecodeMs?: number;
  timecodeMonotonic: boolean;
  hasCues: boolean;
  cuesCount: number;
}

export interface VideoDiagnosticReport {
  fileName: string;
  fileSizeMB: number;
  mimeType: string;
  isPlayable: boolean;
  isSeekable: boolean;
  durationSec: number;
  containerType: 'Matroska/WebM' | 'MP4' | 'MPEG-TS' | 'Unknown';
  matroskaDetails?: MatroskaDiagnostics;
  html5VideoState?: {
    readyState: number;
    paused: boolean;
    currentTime: number;
    duration: number;
    seekableRanges: number;
    seekableEndSec: number;
    bufferedRanges: number;
    videoWidth: number;
    videoHeight: number;
    errorCode: number | null;
    errorMessage: string | null;
  };
  warnings: string[];
  errors: string[];
  overallStatus: 'PASS' | 'WARNING' | 'FAIL';
}

/**
 * Parse EBML Variable-Length Integer (VINT)
 */
function parseVint(buf: Uint8Array, offset: number): { value: number; length: number } | null {
  if (offset >= buf.length) return null;
  const firstByte = buf[offset];
  let length = 0;
  let mask = 0x80;

  for (let i = 1; i <= 8; i++) {
    if ((firstByte & mask) !== 0) {
      length = i;
      break;
    }
    mask >>= 1;
  }

  if (length === 0 || offset + length > buf.length) return null;

  let value = firstByte & (mask - 1);
  for (let i = 1; i < length; i++) {
    value = (value * 256) + buf[offset + i];
  }

  return { value, length };
}

/**
 * Read a slice of a File into Uint8Array
 */
async function readFileSlice(file: File, start: number, length: number): Promise<Uint8Array> {
  const blob = file.slice(start, Math.min(file.size, start + length));
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Parse Matroska / WebM File Container Structure
 */
async function analyzeMatroskaFile(file: File): Promise<MatroskaDiagnostics> {
  const diag: MatroskaDiagnostics = {
    hasEbmlHeader: false,
    hasSegment: false,
    segmentSize8ByteVint: false,
    hasSeekHead: false,
    hasInfo: false,
    hasTracks: false,
    tracks: [],
    clusterCount: 0,
    timecodeMonotonic: true,
    hasCues: false,
    cuesCount: 0,
  };

  try {
    // Read first 2MB for headers
    const headerBuf = await readFileSlice(file, 0, Math.min(file.size, 2 * 1024 * 1024));

    // Check EBML Header: 0x1A 0x45 0xDF 0xA3
    if (headerBuf[0] === 0x1A && headerBuf[1] === 0x45 && headerBuf[2] === 0xDF && headerBuf[3] === 0xA3) {
      diag.hasEbmlHeader = true;

      // Extract DocType if available
      for (let i = 0; i < headerBuf.length - 10; i++) {
        // DocType ID: 0x42 0x82
        if (headerBuf[i] === 0x42 && headerBuf[i + 1] === 0x82) {
          const vint = parseVint(headerBuf, i + 2);
          if (vint) {
            const strBytes = headerBuf.slice(i + 2 + vint.length, i + 2 + vint.length + vint.value);
            diag.docType = new TextDecoder().decode(strBytes);
          }
          break;
        }
      }
    }

    // Locate Segment ID: 0x18 0x53 0x80 0x67
    let segmentDataOffset = -1;
    for (let i = 0; i < headerBuf.length - 12; i++) {
      if (headerBuf[i] === 0x18 && headerBuf[i + 1] === 0x53 && headerBuf[i + 2] === 0x80 && headerBuf[i + 3] === 0x67) {
        diag.hasSegment = true;
        const sizeVint = parseVint(headerBuf, i + 4);
        if (sizeVint) {
          diag.segmentSize8ByteVint = sizeVint.length === 8;
          segmentDataOffset = i + 4 + sizeVint.length;
        }
        break;
      }
    }

    // Locate SeekHead: 0x11 0x4D 0x9B 0x74
    for (let i = 0; i < headerBuf.length - 10; i++) {
      if (headerBuf[i] === 0x11 && headerBuf[i + 1] === 0x4D && headerBuf[i + 2] === 0x9B && headerBuf[i + 3] === 0x74) {
        diag.hasSeekHead = true;
        break;
      }
    }

    // Locate Info: 0x15 0x49 0xA9 0x66
    for (let i = 0; i < headerBuf.length - 10; i++) {
      if (headerBuf[i] === 0x15 && headerBuf[i + 1] === 0x49 && headerBuf[i + 2] === 0xA9 && headerBuf[i + 3] === 0x66) {
        diag.hasInfo = true;
        // Search Duration: 0x44 0x89 inside Info
        for (let j = i; j < Math.min(headerBuf.length - 8, i + 200); j++) {
          if (headerBuf[j] === 0x44 && headerBuf[j + 1] === 0x89) {
            const vint = parseVint(headerBuf, j + 2);
            if (vint && vint.value === 4) {
              const view = new DataView(headerBuf.buffer, headerBuf.byteOffset + j + 2 + vint.length, 4);
              diag.durationSec = view.getFloat32(0, false);
            } else if (vint && vint.value === 8) {
              const view = new DataView(headerBuf.buffer, headerBuf.byteOffset + j + 2 + vint.length, 8);
              diag.durationSec = view.getFloat64(0, false);
            }
          }
        }
        break;
      }
    }

    // Locate Tracks: 0x16 0x54 0xAE 0x6B
    for (let i = 0; i < headerBuf.length - 10; i++) {
      if (headerBuf[i] === 0x16 && headerBuf[i + 1] === 0x54 && headerBuf[i + 2] === 0xAE && headerBuf[i + 3] === 0x6B) {
        diag.hasTracks = true;
        break;
      }
    }

    // Check Tail of file for Cues (0x1C 0x53 0xBB 0x6B)
    const tailSize = Math.min(file.size, 5 * 1024 * 1024);
    const tailStart = file.size - tailSize;
    const tailBuf = await readFileSlice(file, tailStart, tailSize);

    let cuesFound = false;
    let cuesCount = 0;
    for (let i = 0; i < tailBuf.length - 12; i++) {
      if (tailBuf[i] === 0x1C && tailBuf[i + 1] === 0x53 && tailBuf[i + 2] === 0xBB && tailBuf[i + 3] === 0x6B) {
        cuesFound = true;
        // Count CuePoint (0xBB) occurrences
        for (let j = i; j < tailBuf.length - 2; j++) {
          if (tailBuf[j] === 0xBB) {
            cuesCount++;
          }
        }
        break;
      }
    }

    diag.hasCues = cuesFound;
    diag.cuesCount = cuesCount;

    // Sample clusters to check timecodes
    let clusterCount = 0;
    let prevTc = -1;
    let firstTc: number | undefined;
    let lastTc: number | undefined;

    let sampleOffset = segmentDataOffset > 0 ? segmentDataOffset : 0;
    const step = Math.max(1, Math.floor(file.size / 10));

    for (let k = 0; k < 10 && sampleOffset < file.size - 32; k++) {
      const inspectBuf = await readFileSlice(file, sampleOffset, 1024);
      for (let i = 0; i < inspectBuf.length - 12; i++) {
        // Cluster ID: 0x1F 0x43 0xB6 0x75
        if (inspectBuf[i] === 0x1F && inspectBuf[i + 1] === 0x43 && inspectBuf[i + 2] === 0xB6 && inspectBuf[i + 3] === 0x75) {
          clusterCount++;
          // Timecode: 0xE7
          for (let j = i + 4; j < i + 32 && j < inspectBuf.length - 4; j++) {
            if (inspectBuf[j] === 0xE7) {
              const vint = parseVint(inspectBuf, j + 1);
              if (vint) {
                let tc = 0;
                for (let b = 0; b < vint.value; b++) {
                  tc = (tc << 8) | inspectBuf[j + 1 + vint.length + b];
                }
                if (firstTc === undefined) firstTc = tc;
                lastTc = tc;

                if (prevTc >= 0 && tc < prevTc) {
                  diag.timecodeMonotonic = false;
                }
                prevTc = tc;
              }
              break;
            }
          }
          break;
        }
      }
      sampleOffset += step;
    }

    diag.clusterCount = clusterCount;
    diag.firstClusterTimecodeMs = firstTc;
    diag.lastClusterTimecodeMs = lastTc;

  } catch (err) {
    console.warn('[VideoInspector] Error parsing Matroska structure:', err);
  }

  return diag;
}

/**
 * Perform REAL Video Inspection for File and/or HTMLVideoElement
 */
export async function inspectVideo(
  fileOrUrl: File | string,
  fileNameOverride?: string,
  activeVideoEl?: HTMLVideoElement | null
): Promise<VideoDiagnosticReport> {
  const fileName = typeof fileOrUrl === 'string' ? (fileNameOverride || 'video.mp4') : fileOrUrl.name;
  const fileSizeMB = typeof fileOrUrl === 'string' ? 0 : Number((fileOrUrl.size / (1024 * 1024)).toFixed(2));
  const mimeType = typeof fileOrUrl === 'string' ? 'video/mp4' : (fileOrUrl.type || 'video/x-matroska');

  const warnings: string[] = [];
  const errors: string[] = [];

  // Determine Container type
  let containerType: 'Matroska/WebM' | 'MP4' | 'MPEG-TS' | 'Unknown' = 'Unknown';
  if (fileName.match(/\.(mkv|webm)$/i) || mimeType.includes('matroska') || mimeType.includes('webm')) {
    containerType = 'Matroska/WebM';
  } else if (fileName.match(/\.(mp4|m4v|mov)$/i) || mimeType.includes('mp4')) {
    containerType = 'MP4';
  } else if (fileName.match(/\.(ts|mts)$/i) || mimeType.includes('mp2t')) {
    containerType = 'MPEG-TS';
  }

  // 1. Analyze Matroska binary headers if File is available
  let matroskaDetails: MatroskaDiagnostics | undefined;
  if (typeof fileOrUrl !== 'string' && (containerType === 'Matroska/WebM' || fileName.endsWith('.mkv'))) {
    matroskaDetails = await analyzeMatroskaFile(fileOrUrl);

    if (!matroskaDetails.hasEbmlHeader) {
      errors.push('❌ Missing valid EBML Header (0x1A45DFA3) - File is not a valid Matroska/WebM container.');
    }
    if (!matroskaDetails.hasSegment) {
      errors.push('❌ Missing Segment element (0x18538067).');
    }
    if (!matroskaDetails.hasSeekHead) {
      warnings.push('⚠️ Missing SeekHead element (0x114D9B74) - Player may take longer to locate tracks/indexes.');
    }
    if (!matroskaDetails.hasInfo) {
      warnings.push('⚠️ Missing Info element (0x1549A966).');
    }

    if (!matroskaDetails.hasCues) {
      errors.push('❌ Missing Cues index element (0x1C53BB6B) - Video lacks seek index table.');
    } else if (matroskaDetails.cuesCount === 0) {
      errors.push('❌ Cues element exists but contains 0 CuePoints.');
    } else {
      console.info(`[VideoInspector] ✅ Matroska Cues Index verified: ${matroskaDetails.cuesCount} CuePoints.`);
    }

    if (!matroskaDetails.timecodeMonotonic) {
      warnings.push('⚠️ Non-monotonic cluster timecodes detected.');
    }
  }

  // 2. Check HTMLVideoElement real runtime properties if provided
  let html5VideoState: VideoDiagnosticReport['html5VideoState'];
  let isPlayable = true;
  let isSeekable = true;
  let durationSec = matroskaDetails?.durationSec || 0;

  if (activeVideoEl) {
    const err = activeVideoEl.error;
    const errMsgs: Record<number, string> = {
      1: 'MEDIA_ERR_ABORTED - Fetching aborted by user',
      2: 'MEDIA_ERR_NETWORK - Network error during download',
      3: 'MEDIA_ERR_DECODE - Video decoding error (Corrupted frame or codec error)',
      4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - Format or codec not supported',
    };

    const seekableRanges = activeVideoEl.seekable ? activeVideoEl.seekable.length : 0;
    const seekableEndSec = seekableRanges > 0 ? activeVideoEl.seekable.end(0) : 0;

    html5VideoState = {
      readyState: activeVideoEl.readyState,
      paused: activeVideoEl.paused,
      currentTime: Number(activeVideoEl.currentTime.toFixed(2)),
      duration: Number((activeVideoEl.duration || 0).toFixed(2)),
      seekableRanges,
      seekableEndSec: Number(seekableEndSec.toFixed(2)),
      bufferedRanges: activeVideoEl.buffered ? activeVideoEl.buffered.length : 0,
      videoWidth: activeVideoEl.videoWidth,
      videoHeight: activeVideoEl.videoHeight,
      errorCode: err ? err.code : null,
      errorMessage: err ? (errMsgs[err.code] || err.message) : null,
    };

    if (activeVideoEl.duration && !isNaN(activeVideoEl.duration)) {
      durationSec = activeVideoEl.duration;
    }

    if (err) {
      isPlayable = false;
      errors.push(`❌ HTML5 Media Error: ${html5VideoState.errorMessage}`);
    }

    if (activeVideoEl.seeking) {
      warnings.push(`⚠️ Video element is currently stuck in SEEKING state (seeking=true, currentTime=${activeVideoEl.currentTime.toFixed(2)}s).`);
    }

    if (activeVideoEl.readyState < 3 && !activeVideoEl.paused) {
      errors.push(`❌ Video playback STALLED / FROZEN: readyState is ${activeVideoEl.readyState} (HAVE_CURRENT_DATA or lower). Player is waiting for video frames/keyframes at ${activeVideoEl.currentTime.toFixed(2)}s.`);
    }

    if (seekableRanges === 0 && activeVideoEl.readyState >= 1) {
      isSeekable = false;
      errors.push('❌ HTML5 Video element reports 0 seekable ranges (Missing Cues / Seek Table).');
    }
  } else if (matroskaDetails) {
    isSeekable = matroskaDetails.hasCues && matroskaDetails.cuesCount > 0;
  }

  // Overall status
  let overallStatus: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
  if (errors.length > 0) {
    overallStatus = 'FAIL';
  } else if (warnings.length > 0) {
    overallStatus = 'WARNING';
  }

  const report: VideoDiagnosticReport = {
    fileName,
    fileSizeMB,
    mimeType,
    isPlayable,
    isSeekable,
    durationSec: Number(durationSec.toFixed(2)),
    containerType,
    matroskaDetails,
    html5VideoState,
    warnings,
    errors,
    overallStatus,
  };

  // Print authentic report directly to DevTools Console
  printDevToolsReport(report);

  return report;
}

/**
 * Output structured, authentic diagnostic reports directly to DevTools Console
 */
export function printDevToolsReport(report: VideoDiagnosticReport): void {
  const isPass = report.overallStatus === 'PASS';
  const isWarn = report.overallStatus === 'WARNING';

  const badgeColor = isPass ? '#10B981' : isWarn ? '#F59E0B' : '#EF4444';
  const badgeText = isPass ? '✅ PASS - HEALTHY VIDEO' : isWarn ? '⚠️ WARN - ISSUES DETECTED' : '❌ FAIL - STRUCTURAL / PLAYBACK ERROR';

  console.group(
    `%c 🎥 [VIDEO INSPECTOR REPORT] %c ${report.fileName} %c ${badgeText} `,
    'background: #1E293B; color: #38BDF8; font-weight: bold; padding: 4px 8px; border-radius: 4px 0 0 4px;',
    'background: #0F172A; color: #F1F5F9; font-weight: bold; padding: 4px 8px;',
    `background: ${badgeColor}; color: #FFFFFF; font-weight: bold; padding: 4px 8px; border-radius: 0 4px 4px 0;`
  );

  console.info('📁 File Information:', {
    'File Name': report.fileName,
    'File Size': `${report.fileSizeMB} MB`,
    'Container Type': report.containerType,
    'MIME Type': report.mimeType,
    'Duration': `${report.durationSec}s`,
  });

  console.info('▶️ Real Status Overview:', {
    'Is Playable': report.isPlayable ? '✅ YES' : '❌ NO',
    'Is Seekable (กอเวลาได้หรือไม่)': report.isSeekable ? '✅ YES (มีตารางดรรชนี Cues กอได้ปกติ)' : '❌ NO (ไม่มีตาราง Cues / กอไม่ได้)',
  });

  if (report.html5VideoState) {
    console.info('📺 Live HTML5 Player State:', report.html5VideoState);
  }

  if (report.matroskaDetails) {
    const m = report.matroskaDetails;
    console.groupCollapsed('📦 Real Matroska / MKV Binary Header Analysis');
    console.table({
      'EBML Header': m.hasEbmlHeader ? '✅ Present' : '❌ Missing',
      'DocType': m.docType || 'matroska',
      'Segment Element': m.hasSegment ? '✅ Present' : '❌ Missing',
      'Segment 8-Byte VINT': m.segmentSize8ByteVint ? '✅ 8-Byte VINT' : '⚠️ 4-Byte VINT',
      'SeekHead Element': m.hasSeekHead ? '✅ Present' : '⚠️ Missing',
      'Info Element': m.hasInfo ? '✅ Present' : '⚠️ Missing',
      'Duration': m.durationSec ? `${m.durationSec.toFixed(2)} seconds` : 'Unknown',
      'Cues Index Element': m.hasCues ? `✅ Present (${m.cuesCount} CuePoints)` : '❌ MISSING (Cannot Seek!)',
      'Timecodes Monotonic': m.timecodeMonotonic ? '✅ Monotonic' : '⚠️ Non-monotonic Jumps',
    });
    console.groupEnd();
  }

  if (report.errors.length > 0) {
    console.group('%c 🔴 REAL ERRORS DETECTED:', 'color: #EF4444; font-weight: bold;');
    report.errors.forEach((err) => console.error(err));
    console.groupEnd();
  }

  if (report.warnings.length > 0) {
    console.group('%c 🟡 WARNINGS:', 'color: #F59E0B; font-weight: bold;');
    report.warnings.forEach((warn) => console.warn(warn));
    console.groupEnd();
  }

  console.groupEnd();

  // Store globally for developer access in Console
  (window as any).__LAST_INSPECTED_REPORT__ = report;
}
