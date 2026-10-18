import { Input, BlobSource, ALL_FORMATS, CanvasSink, InputVideoTrack } from 'mediabunny';

interface PlayerSession {
  input: Input | null;
  videoTrack: InputVideoTrack | null;
  canvasSink: CanvasSink | null;
  duration: number;
  width: number;
  height: number;
  rotation: number;
  fps: number;
  currentPlaybackId: number;
}

const sessions = new Map<string, PlayerSession>();

self.onmessage = async (e: MessageEvent) => {
  const { id, action, sessionId, payload } = e.data;

  try {
    switch (action) {
      case 'initSession': {
        const { file, url } = payload;
        let blobSource: BlobSource;

        if (file instanceof Blob || file instanceof File) {
          blobSource = new BlobSource(file);
        } else if (typeof url === 'string') {
          const resp = await fetch(url);
          const blob = await resp.blob();
          blobSource = new BlobSource(blob);
        } else {
          throw new Error('Invalid file or URL for player session');
        }

        const input = new Input({
          source: blobSource,
          formats: ALL_FORMATS,
        });

        const vTracks = await input.getVideoTracks();
        const aTracks = await input.getAudioTracks();

        if (vTracks.length === 0) {
          let audioDur = 0;
          if (aTracks.length > 0) {
            try {
              audioDur = (await aTracks[0].computeDuration()) || 0;
            } catch {}
          }
          sessions.set(sessionId, {
            input,
            videoTrack: null,
            canvasSink: null,
            duration: audioDur,
            width: 0,
            height: 0,
            rotation: 0,
            fps: 0,
            currentPlaybackId: 0,
          });
          self.postMessage({
            id,
            success: true,
            result: {
              duration: audioDur,
              width: 0,
              height: 0,
              rotation: 0,
              hasVideo: false,
              hasAudio: aTracks.length > 0,
            },
          });
          return;
        }

        const videoTrack = vTracks[0];
        let duration = 0;
        let width = 1280;
        let height = 720;
        let rotation = 0;

        try {
          const metaDur = await videoTrack.getDurationFromMetadata();
          if (metaDur && Number.isFinite(metaDur) && metaDur > 0) {
            duration = metaDur;
          } else {
            duration = (await videoTrack.computeDuration()) || 0;
          }
        } catch {
          try {
            duration = (await videoTrack.computeDuration()) || 0;
          } catch {
            duration = 0;
          }
        }

        try {
          width = await videoTrack.getSquarePixelWidth();
          height = await videoTrack.getSquarePixelHeight();
          rotation = await videoTrack.getRotation();
        } catch {
          width = 1280;
          height = 720;
        }

        const canvasSink = new CanvasSink(videoTrack);

        sessions.set(sessionId, {
          input,
          videoTrack,
          canvasSink,
          duration,
          width,
          height,
          rotation,
          fps: 30,
          currentPlaybackId: 0,
        });

        self.postMessage({
          id,
          success: true,
          result: {
            duration,
            width,
            height,
            rotation,
            hasVideo: true,
            hasAudio: aTracks.length > 0,
          },
        });
        break;
      }

      case 'startPlayback': {
        const session = sessions.get(sessionId);
        if (!session || !session.canvasSink) {
          self.postMessage({ id, success: false, error: 'Session not found or has no video' });
          return;
        }

        const { startTime = 0, playbackRate = 1, playbackId } = payload;
        session.currentPlaybackId = playbackId;

        self.postMessage({ id, success: true });

        // Start sequential streaming of video frames via canvases generator
        (async () => {
          const startRealTime = performance.now();
          try {
            for await (const wrappedCanvas of session.canvasSink.canvases(Math.max(0, startTime))) {
              if (session.currentPlaybackId !== playbackId) {
                break;
              }

              const bitmap = await createImageBitmap(wrappedCanvas.canvas);
              if (session.currentPlaybackId !== playbackId) {
                bitmap.close();
                break;
              }

              (self as any).postMessage(
                {
                  type: 'streamFrame',
                  sessionId,
                  playbackId,
                  bitmap,
                  timestamp: wrappedCanvas.timestamp,
                  duration: wrappedCanvas.duration,
                },
                [bitmap]
              );

              // Regulate pacing to stay ~350ms ahead of real presentation time
              const elapsedMedia = (wrappedCanvas.timestamp - startTime) / (playbackRate || 1);
              const elapsedReal = (performance.now() - startRealTime) / 1000;
              const leadSec = elapsedMedia - elapsedReal;

              if (leadSec > 0.35) {
                const sleepMs = Math.min(200, Math.floor((leadSec - 0.25) * 1000));
                if (sleepMs > 5) {
                  await new Promise((r) => setTimeout(r, sleepMs));
                }
              }
            }

            if (session.currentPlaybackId === playbackId) {
              (self as any).postMessage({
                type: 'streamEnded',
                sessionId,
                playbackId,
              });
            }
          } catch (err) {
            console.warn('[WebCodecsWorker] Playback stream finished or stopped:', err);
          }
        })();
        break;
      }

      case 'stopPlayback': {
        const session = sessions.get(sessionId);
        if (session) {
          session.currentPlaybackId = (session.currentPlaybackId || 0) + 1;
        }
        self.postMessage({ id, success: true });
        break;
      }

      case 'renderFrame': {
        const session = sessions.get(sessionId);
        if (!session || !session.canvasSink) {
          self.postMessage({ id, success: false, error: 'Session not found or has no video track' });
          return;
        }

        // Cancel any active stream when manually seeking/rendering single frame
        session.currentPlaybackId = (session.currentPlaybackId || 0) + 1;

        const { timestamp } = payload;
        const wrappedCanvas = await session.canvasSink.getCanvas(Math.max(0, timestamp));
        if (!wrappedCanvas || !wrappedCanvas.canvas) {
          self.postMessage({ id, success: true, result: null });
          return;
        }

        const bitmap = await createImageBitmap(wrappedCanvas.canvas);

        (self as any).postMessage(
          {
            id,
            success: true,
            result: {
              bitmap,
              timestamp: wrappedCanvas.timestamp,
              duration: wrappedCanvas.duration,
            },
          },
          [bitmap]
        );
        break;
      }

      case 'closeSession': {
        const session = sessions.get(sessionId);
        if (session) {
          session.currentPlaybackId = (session.currentPlaybackId || 0) + 1;
          sessions.delete(sessionId);
        }
        self.postMessage({ id, success: true });
        break;
      }

      default:
        throw new Error(`Unknown player worker action: ${action}`);
    }
  } catch (err: any) {
    self.postMessage({
      id,
      success: false,
      error: err?.message || String(err),
    });
  }
};
