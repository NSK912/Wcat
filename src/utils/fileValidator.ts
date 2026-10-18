import { probeMediaMetadata } from './nativeMedia';

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

  // 4. Proprietary Native Demuxer probe with strict 3-second timeout
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
