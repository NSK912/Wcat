// Proprietary In-House Native Media Toolkit - Universal Metadata Prober
// Fast, lightweight, non-blocking media detection. Zero external dependencies.

import { MediaMetadata } from './types';
import { MP4Demuxer } from './mp4Demuxer';
import { EBMLDemuxer } from './ebmlDemuxer';

/**
 * Probes media file metadata (duration, width, height, rotation, fps, audio/video tracks)
 * using our proprietary demuxers without loading the full file into memory.
 */
export async function probeMediaMetadata(file: File | Blob): Promise<MediaMetadata> {
  // 1. Image check
  if (file.type && file.type.startsWith('image/')) {
    return {
      format: 'image',
      duration: 5,
      width: 1920,
      height: 1080,
      rotation: 0,
      fps: 30,
      hasVideo: true,
      hasAudio: false,
      videoTracks: [],
      audioTracks: [],
    };
  }

  const name = (file as File).name || '';
  const ext = name.split('.').pop()?.toLowerCase() || '';

  // 2. Read first 16 bytes for magic byte format detection
  const headSlice = file.slice(0, 16);
  const headBuf = new Uint8Array(await headSlice.arrayBuffer());

  const isEBML = headBuf.length >= 4 && headBuf[0] === 0x1a && headBuf[1] === 0x45 && headBuf[2] === 0xdf && headBuf[3] === 0xa3;
  const isMp4OrMov = (headBuf.length >= 8 && (
    (headBuf[4] === 0x66 && headBuf[5] === 0x74 && headBuf[6] === 0x79 && headBuf[7] === 0x70) || // 'ftyp'
    (headBuf[4] === 0x6d && headBuf[5] === 0x6f && headBuf[6] === 0x6f && headBuf[7] === 0x76) || // 'moov'
    (headBuf[4] === 0x66 && headBuf[5] === 0x72 && headBuf[6] === 0x65 && headBuf[7] === 0x65) || // 'free'
    (headBuf[4] === 0x6d && headBuf[5] === 0x64 && headBuf[6] === 0x61 && headBuf[7] === 0x74)    // 'mdat'
  )) || ['mp4', 'm4v', 'mov', '3gp'].includes(ext);

  // 3. Try MP4 Demuxer
  if (isMp4OrMov) {
    try {
      const mp4 = new MP4Demuxer(file);
      const ok = await mp4.parse();
      if (ok) {
        const vTrack = mp4.videoTracks[0];
        const aTrack = mp4.audioTracks[0];
        return {
          format: ext === 'mov' ? 'mov' : 'mp4',
          duration: mp4.duration || (vTrack?.duration ?? aTrack?.duration ?? 0),
          width: vTrack?.width || 1280,
          height: vTrack?.height || 720,
          rotation: vTrack?.rotation || 0,
          fps: vTrack?.fps || 30,
          hasVideo: mp4.videoTracks.length > 0,
          hasAudio: mp4.audioTracks.length > 0,
          videoTracks: mp4.videoTracks,
          audioTracks: mp4.audioTracks,
          videoCodec: vTrack?.codec,
          audioCodec: aTrack?.codec,
        };
      }
    } catch (e) {
      console.warn('MP4 probe fallback required:', e);
    }
  }

  // 4. Try EBML (WebM / MKV) Demuxer
  if (isEBML || ['webm', 'mkv'].includes(ext)) {
    try {
      const ebml = new EBMLDemuxer(file);
      const ok = await ebml.parse();
      if (ok) {
        const vTrack = ebml.videoTracks[0];
        const aTrack = ebml.audioTracks[0];
        return {
          format: ext === 'mkv' ? 'mkv' : 'webm',
          duration: ebml.duration || (vTrack?.duration ?? aTrack?.duration ?? 0),
          width: vTrack?.width || 1280,
          height: vTrack?.height || 720,
          rotation: vTrack?.rotation || 0,
          fps: vTrack?.fps || 30,
          hasVideo: ebml.videoTracks.length > 0,
          hasAudio: ebml.audioTracks.length > 0,
          videoTracks: ebml.videoTracks,
          audioTracks: ebml.audioTracks,
          videoCodec: vTrack?.codec,
          audioCodec: aTrack?.codec,
        };
      }
    } catch (e) {
      console.warn('EBML probe fallback required:', e);
    }
  }

  // 5. Fallback HTML5 media probe with strict 2-second timeout (for MP3, WAV, AAC, etc.)
  try {
    const isAudio = file.type.startsWith('audio/') || ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'].includes(ext);
    const media = document.createElement(isAudio ? 'audio' : 'video');
    media.preload = 'metadata';
    const blobUrl = URL.createObjectURL(file);
    media.src = blobUrl;

    const html5Dur = await new Promise<number>((resolve) => {
      const timer = setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
        media.removeAttribute('src');
        if (typeof (media as any).load === 'function') (media as any).load();
        resolve(0);
      }, 2000);

      media.onloadedmetadata = () => {
        clearTimeout(timer);
        const d = media.duration;
        URL.revokeObjectURL(blobUrl);
        media.removeAttribute('src');
        if (typeof (media as any).load === 'function') (media as any).load();
        resolve(Number.isFinite(d) && d > 0 ? d : 0);
      };

      media.onerror = () => {
        clearTimeout(timer);
        URL.revokeObjectURL(blobUrl);
        media.removeAttribute('src');
        if (typeof (media as any).load === 'function') (media as any).load();
        resolve(0);
      };
    });

    if (html5Dur > 0) {
      return {
        format: isAudio ? 'audio' : 'unknown',
        duration: html5Dur,
        width: (media as HTMLVideoElement).videoWidth || 1280,
        height: (media as HTMLVideoElement).videoHeight || 720,
        rotation: 0,
        fps: 30,
        hasVideo: !isAudio,
        hasAudio: true,
        videoTracks: [],
        audioTracks: [],
      };
    }
  } catch {}

  // 6. Safe baseline fallback
  return {
    format: 'unknown',
    duration: 0,
    width: 1280,
    height: 720,
    rotation: 0,
    fps: 30,
    hasVideo: false,
    hasAudio: false,
    videoTracks: [],
    audioTracks: [],
  };
}
