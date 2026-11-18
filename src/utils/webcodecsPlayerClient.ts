let playbackWorkerInstance: Worker | null = null;
let thumbnailWorkerInstance: Worker | null = null;

const pendingPlaybackRequests = new Map<
  string,
  {
    resolve: (res: any) => void;
    reject: (err: any) => void;
    timer: any;
  }
>();

const pendingThumbnailRequests = new Map<
  string,
  {
    resolve: (res: any) => void;
    reject: (err: any) => void;
    timer: any;
  }
>();

interface StreamListener {
  onFrame: (bitmap: ImageBitmap, timestamp: number, playbackId: number) => void;
  onAudio?: (
    channelData: Float32Array[],
    timestamp: number,
    duration: number,
    sampleRate: number,
    playbackId: number
  ) => void;
  onEnded?: (playbackId: number) => void;
}

const streamListeners = new Map<string, StreamListener>();
let globalPlaybackCounter = 0;

function getPlaybackWorker(): Worker {
  if (!playbackWorkerInstance) {
    playbackWorkerInstance = new Worker(
      new URL('../workers/webcodecsPlayerWorker.ts', import.meta.url),
      { type: 'module' }
    );

    playbackWorkerInstance.onmessage = (e: MessageEvent) => {
      const data = e.data;
      if (data?.type === 'streamFrame') {
        const listener = streamListeners.get(data.sessionId);
        if (listener) {
          listener.onFrame(data.bitmap, data.timestamp, data.playbackId);
        } else if (data.bitmap && typeof data.bitmap.close === 'function') {
          data.bitmap.close();
        }
        return;
      }

      if (data?.type === 'streamAudio') {
        const listener = streamListeners.get(data.sessionId);
        if (listener?.onAudio && Array.isArray(data.channelData)) {
          listener.onAudio(
            data.channelData,
            data.timestamp,
            data.duration,
            data.sampleRate || 48000,
            data.playbackId
          );
        }
        return;
      }

      if (data?.type === 'streamEnded') {
        const listener = streamListeners.get(data.sessionId);
        if (listener?.onEnded) {
          listener.onEnded(data.playbackId);
        }
        return;
      }

      const { id, success, result, error } = data;
      const req = pendingPlaybackRequests.get(id);
      if (!req) return;

      clearTimeout(req.timer);
      pendingPlaybackRequests.delete(id);

      if (success) {
        req.resolve(result);
      } else {
        req.reject(new Error(error || 'Player worker operation failed'));
      }
    };

    playbackWorkerInstance.onerror = (err: ErrorEvent) => {
      const errMsg = err?.message || 'Player Worker execution error';
      console.warn('[WebCodecsPlayerWorker] Worker error message:', errMsg);
      for (const [id, req] of pendingPlaybackRequests.entries()) {
        clearTimeout(req.timer);
        req.reject(new Error(errMsg));
      }
      pendingPlaybackRequests.clear();
      streamListeners.clear();
      if (playbackWorkerInstance) {
        try {
          playbackWorkerInstance.terminate();
        } catch {}
      }
      playbackWorkerInstance = null;
    };
  }
  return playbackWorkerInstance;
}

function getThumbnailWorker(): Worker {
  if (!thumbnailWorkerInstance) {
    thumbnailWorkerInstance = new Worker(
      new URL('../workers/webcodecsThumbnailWorker.ts', import.meta.url),
      { type: 'module' }
    );

    thumbnailWorkerInstance.onmessage = (e: MessageEvent) => {
      const { id, success, result, error } = e.data;
      const req = pendingThumbnailRequests.get(id);
      if (!req) return;

      clearTimeout(req.timer);
      pendingThumbnailRequests.delete(id);

      if (success) {
        req.resolve(result);
      } else {
        req.reject(new Error(error || 'Thumbnail worker operation failed'));
      }
    };

    thumbnailWorkerInstance.onerror = (err) => {
      console.warn('[WebCodecsThumbnailWorker] Worker error:', err);
      for (const [id, req] of pendingThumbnailRequests.entries()) {
        clearTimeout(req.timer);
        req.reject(new Error('Thumbnail Worker faulted'));
      }
      pendingThumbnailRequests.clear();
      if (thumbnailWorkerInstance) {
        try {
          thumbnailWorkerInstance.terminate();
        } catch {}
      }
      thumbnailWorkerInstance = null;
    };
  }
  return thumbnailWorkerInstance;
}

function sendPlaybackRequest<T = any>(action: string, payload: any, sessionId?: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = `play_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
    const worker = getPlaybackWorker();

    pendingPlaybackRequests.set(id, { resolve, reject, timer: null });
    worker.postMessage({ id, action, sessionId, payload });
  });
}

function sendThumbnailRequest<T = any>(action: string, payload: any): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = `thumb_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
    const worker = getThumbnailWorker();

    pendingThumbnailRequests.set(id, { resolve, reject, timer: null });
    worker.postMessage({ id, action, payload });
  });
}

import { getKnownFileDuration, setKnownFileDuration } from './nativeMedia';

/**
 * Safely probes video duration and metadata in the isolated Thumbnail/Probe worker.
 * Never affects the real-time playback worker.
 */
export async function probeVideoSafe(file: File | Blob): Promise<{
  duration: number;
  width: number;
  height: number;
  rotation: number;
  hasVideo: boolean;
  hasAudio: boolean;
}> {
  try {
    const knownDuration = getKnownFileDuration(file);
    const res = await sendThumbnailRequest<{
      duration: number;
      width: number;
      height: number;
      rotation: number;
      hasVideo: boolean;
      hasAudio: boolean;
    }>('probe', { file, knownDuration });
    if (res.duration > 0) {
      setKnownFileDuration(file, res.duration);
    }
    return res;
  } catch (err) {
    console.warn('[probeVideoSafe] Probe failed:', err);
    return {
      duration: 0,
      width: 1920,
      height: 1080,
      rotation: 0,
      hasVideo: true,
      hasAudio: false,
    };
  }
}

const thumbnailCache = new Map<string, Promise<string[]>>();

/**
 * Extracts preview thumbnails inside the isolated Thumbnail Web Worker.
 * Never affects the playback worker thread.
 */
export async function generateThumbnailsSafe(
  file: File | Blob,
  count: number = 8,
  knownDurationHint?: number
): Promise<string[]> {
  if (knownDurationHint && knownDurationHint > 0) {
    setKnownFileDuration(file, knownDurationHint);
  }
  const f = file as File;
  const cacheKey = f.name ? `${f.name}_${f.size}_${f.lastModified || 0}` : null;

  if (cacheKey && thumbnailCache.has(cacheKey)) {
    const cached = await thumbnailCache.get(cacheKey)!;
    if (cached && cached.length > 0) {
      return cached;
    }
    thumbnailCache.delete(cacheKey);
  }

  const task = (async () => {
    try {
      const knownDuration = getKnownFileDuration(file);
      const res = await sendThumbnailRequest<{ thumbnails: string[]; duration: number }>(
        'thumbnails',
        { file, count: Math.max(count, 8), knownDuration }
      );
      if (res.duration > 0) {
        setKnownFileDuration(file, res.duration);
      }
      return (res.thumbnails || []).filter(Boolean);
    } catch (err) {
      console.warn('[generateThumbnailsSafe] Thumbnail generation failed:', err);
      return [];
    }
  })();

  if (cacheKey) {
    thumbnailCache.set(cacheKey, task);
  }

  const result = await task;
  if (cacheKey && result.length === 0) {
    thumbnailCache.delete(cacheKey);
  }
  return result;
}

export interface WebCodecsSession {
  sessionId: string;
  duration: number;
  width: number;
  height: number;
  rotation: number;
  hasVideo: boolean;
  hasAudio: boolean;
  hasWebCodecsAudio: boolean;
  audioSampleRate: number;
  audioChannels: number;
  startPlayback: (
    startTime: number,
    playbackRate: number,
    onFrame: (bitmap: ImageBitmap, timestamp: number, playbackId: number) => void,
    onEnded?: (playbackId: number) => void,
    onAudio?: (
      channelData: Float32Array[],
      timestamp: number,
      duration: number,
      sampleRate: number,
      playbackId: number
    ) => void
  ) => number;
  syncClock: (mediaTime: number, playbackRate?: number, immediate?: boolean) => void;
  stopPlayback: () => void;
  renderFrame: (timestamp: number, fastSeek?: boolean) => Promise<ImageBitmap | null>;
  close: () => void;
}

/**
 * Creates an active WebCodecs playback session in the dedicated Playback Worker.
 */
export async function createWebCodecsSession(
  fileOrUrl: File | Blob | string
): Promise<WebCodecsSession> {
  const sessionId = `sess_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
  const knownDuration = typeof fileOrUrl !== 'string' ? getKnownFileDuration(fileOrUrl) : 0;
  const payload =
    typeof fileOrUrl === 'string'
      ? { url: fileOrUrl }
      : { file: fileOrUrl, knownDuration };

  const info = await sendPlaybackRequest<{
    duration: number;
    width: number;
    height: number;
    rotation: number;
    hasVideo: boolean;
    hasAudio: boolean;
    hasWebCodecsAudio?: boolean;
    audioSampleRate?: number;
    audioChannels?: number;
  }>('initSession', payload, sessionId);

  if (typeof fileOrUrl !== 'string' && info.duration > 0) {
    setKnownFileDuration(fileOrUrl, info.duration);
  }

  let isClosed = false;

  return {
    sessionId,
    duration: info.duration,
    width: info.width,
    height: info.height,
    rotation: info.rotation,
    hasVideo: info.hasVideo,
    hasAudio: info.hasAudio,
    hasWebCodecsAudio: Boolean(info.hasWebCodecsAudio),
    audioSampleRate: info.audioSampleRate || 48000,
    audioChannels: info.audioChannels || 2,
    startPlayback: (
      startTime: number,
      playbackRate: number,
      onFrame: (bitmap: ImageBitmap, timestamp: number, playbackId: number) => void,
      onEnded?: (playbackId: number) => void,
      onAudio?: (
        channelData: Float32Array[],
        timestamp: number,
        duration: number,
        sampleRate: number,
        playbackId: number
      ) => void
    ) => {
      if (isClosed) return 0;
      const playbackId = ++globalPlaybackCounter;
      streamListeners.set(sessionId, { onFrame, onAudio, onEnded });
      sendPlaybackRequest('startPlayback', { startTime, playbackRate, playbackId }, sessionId).catch(() => {});
      return playbackId;
    },
    syncClock: (mediaTime: number, playbackRate?: number) => {
      if (isClosed) return;
      const worker = getPlaybackWorker();
      worker.postMessage({
        id: 0,
        action: 'syncClock',
        sessionId,
        payload: { mediaTime, playbackRate },
      });
    },
    stopPlayback: () => {
      streamListeners.delete(sessionId);
      if (!isClosed) {
        sendPlaybackRequest('stopPlayback', {}, sessionId).catch(() => {});
      }
    },
    renderFrame: async (timestamp: number, fastSeek: boolean = false) => {
      if (isClosed) return null;
      try {
        const res = await sendPlaybackRequest<{
          bitmap: ImageBitmap;
          timestamp: number;
          duration: number;
        } | null>('renderFrame', { timestamp, fastSeek }, sessionId);
        return res ? res.bitmap : null;
      } catch (e) {
        return null;
      }
    },
    close: () => {
      if (isClosed) return;
      isClosed = true;
      streamListeners.delete(sessionId);
      sendPlaybackRequest('closeSession', {}, sessionId).catch(() => {});
    },
  };
}

