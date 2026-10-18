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

    playbackWorkerInstance.onerror = (err) => {
      console.error('[WebCodecsPlayerWorker] Worker error:', err);
      for (const [id, req] of pendingPlaybackRequests.entries()) {
        clearTimeout(req.timer);
        req.reject(new Error('Player Worker crashed or faulted'));
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

function sendPlaybackRequest<T = any>(action: string, payload: any, sessionId?: string, timeoutMs = 8000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = `play_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
    const worker = getPlaybackWorker();

    const timer = setTimeout(() => {
      pendingPlaybackRequests.delete(id);
      console.warn(`[WebCodecsPlayback] Action "${action}" timed out (${timeoutMs}ms)`);
      reject(new Error(`Playback operation "${action}" timed out`));
    }, timeoutMs);

    pendingPlaybackRequests.set(id, { resolve, reject, timer });
    worker.postMessage({ id, action, sessionId, payload });
  });
}

function sendThumbnailRequest<T = any>(action: string, payload: any, timeoutMs = 12000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = `thumb_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
    const worker = getThumbnailWorker();

    const timer = setTimeout(() => {
      pendingThumbnailRequests.delete(id);
      console.warn(`[WebCodecsThumbnail] Action "${action}" timed out (${timeoutMs}ms). Restarting thumbnail worker.`);
      if (thumbnailWorkerInstance) {
        try {
          thumbnailWorkerInstance.terminate();
        } catch {}
        thumbnailWorkerInstance = null;
      }
      reject(new Error(`Thumbnail operation "${action}" timed out`));
    }, timeoutMs);

    pendingThumbnailRequests.set(id, { resolve, reject, timer });
    worker.postMessage({ id, action, payload });
  });
}

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
    const res = await sendThumbnailRequest<{
      duration: number;
      width: number;
      height: number;
      rotation: number;
      hasVideo: boolean;
      hasAudio: boolean;
    }>('probe', { file }, 4000);
    return res;
  } catch (err) {
    console.warn('[probeVideoSafe] Probe failed or timed out:', err);
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

/**
 * Extracts preview thumbnails inside the isolated Thumbnail Web Worker.
 * Never affects the playback worker thread.
 */
export async function generateThumbnailsSafe(
  file: File | Blob,
  count: number = 8
): Promise<string[]> {
  try {
    const res = await sendThumbnailRequest<{ thumbnails: string[]; duration: number }>(
      'thumbnails',
      { file, count },
      10000
    );
    return res.thumbnails || [];
  } catch (err) {
    console.warn('[generateThumbnailsSafe] Thumbnail generation failed:', err);
    return [];
  }
}

export interface WebCodecsSession {
  sessionId: string;
  duration: number;
  width: number;
  height: number;
  rotation: number;
  hasVideo: boolean;
  hasAudio: boolean;
  startPlayback: (
    startTime: number,
    playbackRate: number,
    onFrame: (bitmap: ImageBitmap, timestamp: number, playbackId: number) => void,
    onEnded?: (playbackId: number) => void
  ) => number;
  stopPlayback: () => void;
  renderFrame: (timestamp: number) => Promise<ImageBitmap | null>;
  close: () => void;
}

/**
 * Creates an active WebCodecs playback session in the dedicated Playback Worker.
 */
export async function createWebCodecsSession(
  fileOrUrl: File | Blob | string
): Promise<WebCodecsSession> {
  const sessionId = `sess_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
  const payload = typeof fileOrUrl === 'string' ? { url: fileOrUrl } : { file: fileOrUrl };

  const info = await sendPlaybackRequest<{
    duration: number;
    width: number;
    height: number;
    rotation: number;
    hasVideo: boolean;
    hasAudio: boolean;
  }>('initSession', payload, sessionId, 6000);

  let isClosed = false;

  return {
    sessionId,
    duration: info.duration,
    width: info.width,
    height: info.height,
    rotation: info.rotation,
    hasVideo: info.hasVideo,
    hasAudio: info.hasAudio,
    startPlayback: (
      startTime: number,
      playbackRate: number,
      onFrame: (bitmap: ImageBitmap, timestamp: number, playbackId: number) => void,
      onEnded?: (playbackId: number) => void
    ) => {
      if (isClosed) return 0;
      const playbackId = ++globalPlaybackCounter;
      streamListeners.set(sessionId, { onFrame, onEnded });
      sendPlaybackRequest('startPlayback', { startTime, playbackRate, playbackId }, sessionId, 4000).catch(() => {});
      return playbackId;
    },
    stopPlayback: () => {
      streamListeners.delete(sessionId);
      if (!isClosed) {
        sendPlaybackRequest('stopPlayback', {}, sessionId, 1500).catch(() => {});
      }
    },
    renderFrame: async (timestamp: number) => {
      if (isClosed) return null;
      try {
        const res = await sendPlaybackRequest<{
          bitmap: ImageBitmap;
          timestamp: number;
          duration: number;
        } | null>('renderFrame', { timestamp }, sessionId, 2000);
        return res ? res.bitmap : null;
      } catch (e) {
        return null;
      }
    },
    close: () => {
      if (isClosed) return;
      isClosed = true;
      streamListeners.delete(sessionId);
      sendPlaybackRequest('closeSession', {}, sessionId, 1500).catch(() => {});
    },
  };
}
