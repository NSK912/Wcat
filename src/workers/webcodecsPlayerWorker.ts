import { Input, BlobSource, ALL_FORMATS, CanvasSink, NativeAudioSink, InputVideoTrack, setKnownFileDuration } from '../utils/nativeMedia';

self.addEventListener('error', (e: ErrorEvent) => {
  console.warn('[WebCodecsPlayerWorker] Caught worker internal error:', e.message);
  e.preventDefault();
});

self.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  console.warn('[WebCodecsPlayerWorker] Caught unhandled rejection:', e.reason);
  e.preventDefault();
});

interface PlayerSession {
  input: Input | null;
  videoTrack: InputVideoTrack | null;
  canvasSink: CanvasSink | null;
  audioSink: NativeAudioSink | null;
  hasWebCodecsAudio: boolean;
  audioSampleRate: number;
  audioChannels: number;
  duration: number;
  width: number;
  height: number;
  rotation: number;
  fps: number;
  currentPlaybackId: number;
  renderRequestId: number;
  syncMediaTime: number;
  syncWallTime: number;
  lastTargetTime: number;
  playbackRate: number;
}

const sessions = new Map<string, PlayerSession>();

function getLiveTargetTime(
  session: PlayerSession,
  fallbackStart: number,
  startRealTime: number,
  firstFrameTs: number
): number {
  const rate = session.playbackRate || 1;
  let computed = fallbackStart;

  if (session.syncWallTime > 0) {
    const elapsedSinceSync = Math.max(0, (performance.now() - session.syncWallTime) / 1000);
    computed = session.syncMediaTime + elapsedSinceSync * rate;
  } else if (startRealTime > 0) {
    const elapsed = Math.max(0, (performance.now() - startRealTime) / 1000);
    computed = firstFrameTs + elapsed * rate;
  }

  session.lastTargetTime = Math.max(session.lastTargetTime || 0, computed);
  return session.lastTargetTime;
}

self.onmessage = async (e: MessageEvent) => {
  const { id, action, sessionId, payload } = e.data;

  try {
    switch (action) {
      case 'initSession': {
        const { file, url, knownDuration } = payload;
        let blobSource: BlobSource;

        if (file instanceof Blob || file instanceof File) {
          if (knownDuration && knownDuration > 0) {
            setKnownFileDuration(file, knownDuration);
          }
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

        let audioSink: NativeAudioSink | null = null;
        let hasWebCodecsAudio = false;
        let audioSampleRate = 48000;
        let audioChannels = 2;

        if (aTracks.length > 0 || vTracks.length === 0) {
          try {
            audioSink = new NativeAudioSink(blobSource.blob);
            hasWebCodecsAudio = await audioSink.init();
            audioSampleRate = audioSink.sampleRate || 48000;
            audioChannels = audioSink.numberOfChannels || 2;
          } catch {
            hasWebCodecsAudio = false;
          }
        }

        if (vTracks.length === 0) {
          let audioDur = audioSink?.duration || 0;
          if (audioDur <= 0 && aTracks.length > 0) {
            try {
              audioDur = (await aTracks[0].computeDuration()) || 0;
            } catch {}
          }
          if (audioDur <= 0 && knownDuration && knownDuration > 0) {
            audioDur = knownDuration;
          }
          sessions.set(sessionId, {
            input,
            videoTrack: null,
            canvasSink: null,
            audioSink,
            hasWebCodecsAudio,
            audioSampleRate,
            audioChannels,
            duration: audioDur,
            width: 0,
            height: 0,
            rotation: 0,
            fps: 0,
            currentPlaybackId: 0,
            renderRequestId: 0,
            syncMediaTime: 0,
            syncWallTime: 0,
            lastTargetTime: 0,
            playbackRate: 1,
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
              hasAudio: true,
              hasWebCodecsAudio,
              audioSampleRate,
              audioChannels,
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
        await canvasSink.init();

        sessions.set(sessionId, {
          input,
          videoTrack,
          canvasSink,
          audioSink,
          hasWebCodecsAudio,
          audioSampleRate,
          audioChannels,
          duration,
          width,
          height,
          rotation,
          fps: 30,
          currentPlaybackId: 0,
          renderRequestId: 0,
          syncMediaTime: 0,
          syncWallTime: 0,
          lastTargetTime: 0,
          playbackRate: 1,
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
            hasAudio: aTracks.length > 0 || hasWebCodecsAudio,
            hasWebCodecsAudio,
            audioSampleRate,
            audioChannels,
          },
        });
        break;
      }

      case 'syncClock': {
        const session = sessions.get(sessionId);
        if (session && payload) {
          const { mediaTime, playbackRate } = payload;
          if (typeof mediaTime === 'number' && Number.isFinite(mediaTime)) {
            session.syncMediaTime = mediaTime;
            session.syncWallTime = performance.now();
          }
          if (typeof playbackRate === 'number' && playbackRate > 0) {
            session.playbackRate = playbackRate;
          }
        }
        if (id) {
          self.postMessage({ id, success: true });
        }
        break;
      }

      case 'startPlayback': {
        const session = sessions.get(sessionId);
        if (!session) {
          self.postMessage({ id, success: false, error: 'Session not found' });
          return;
        }

        const { startTime = 0, playbackRate = 1, playbackId } = payload;
        session.currentPlaybackId = playbackId;
        session.renderRequestId = (session.renderRequestId || 0) + 1;
        session.syncMediaTime = Math.max(0, startTime);
        session.syncWallTime = performance.now();
        session.lastTargetTime = Math.max(0, startTime);
        session.playbackRate = playbackRate || 1;
        session.canvasSink?.stopStream();
        session.audioSink?.stopStream();

        self.postMessage({ id, success: true });

        let startRealTime = 0;
        let firstFrameTimestamp = Math.max(0, startTime);
        const getTargetTime = () => getLiveTargetTime(session, Math.max(0, startTime), startRealTime, firstFrameTimestamp);

        // 1. Start WebCodecs Audio Stream from the unified demuxer
        if (session.audioSink && session.hasWebCodecsAudio) {
          (async () => {
            try {
              for await (const pkt of session.audioSink!.audioChunks(Math.max(0, startTime))) {
                if (session.currentPlaybackId !== playbackId) {
                  break;
                }
                if (!pkt.channelData || pkt.channelData.length === 0) {
                  continue;
                }

                if (startRealTime === 0 && !session.canvasSink) {
                  startRealTime = performance.now();
                  firstFrameTimestamp = pkt.timestamp;
                }

                const transferList: ArrayBuffer[] = [];
                for (let c = 0; c < pkt.channelData.length; c++) {
                  const buf = pkt.channelData[c].buffer as ArrayBuffer;
                  if (!transferList.includes(buf)) {
                    transferList.push(buf);
                  }
                }

                (self as any).postMessage(
                  {
                    type: 'streamAudio',
                    sessionId,
                    playbackId,
                    channelData: pkt.channelData,
                    timestamp: pkt.timestamp,
                    duration: pkt.duration,
                    sampleRate: pkt.sampleRate,
                  },
                  transferList
                );

                // Keep ~1.2s of decoded audio ahead of the live playback clock so audio never underruns
                const liveTarget = getTargetTime();
                const rate = session.playbackRate || playbackRate || 1;
                const leadSec = (pkt.timestamp + pkt.duration - liveTarget) / rate;
                if (leadSec > 1.25) {
                  const sleepMs = Math.min(80, Math.floor((leadSec - 1.0) * 1000));
                  if (sleepMs > 6) {
                    await new Promise((r) => setTimeout(r, sleepMs));
                  }
                }
              }

              // If audio-only session (no video canvasSink), emit streamEnded when audio stream finishes
              if (!session.canvasSink && session.currentPlaybackId === playbackId) {
                (self as any).postMessage({
                  type: 'streamEnded',
                  sessionId,
                  playbackId,
                });
              }
            } catch (audioErr) {
              console.warn('[WebCodecsWorker] Audio stream finished or stopped:', audioErr);
            }
          })();
        }

        // 2. Start WebCodecs Video Stream from the unified demuxer
        if (session.canvasSink) {
          (async () => {
            try {
              for await (const wrappedFrame of session.canvasSink!.canvases(Math.max(0, startTime), getTargetTime)) {
                if (session.currentPlaybackId !== playbackId) {
                  if ((wrappedFrame as any)?.bitmap) (wrappedFrame as any).bitmap.close();
                  break;
                }

                const bitmap = (wrappedFrame as any)?.bitmap || (wrappedFrame?.canvas ? await createImageBitmap(wrappedFrame.canvas) : null);
                if (!bitmap || (bitmap as any).width <= 0 || (bitmap as any).height <= 0) {
                  continue;
                }

                if (session.currentPlaybackId !== playbackId) {
                  bitmap.close();
                  break;
                }

                if (startRealTime === 0) {
                  startRealTime = performance.now();
                  firstFrameTimestamp = wrappedFrame.timestamp;
                }

                (self as any).postMessage(
                  {
                    type: 'streamFrame',
                    sessionId,
                    playbackId,
                    bitmap,
                    timestamp: wrappedFrame.timestamp,
                    duration: wrappedFrame.duration,
                  },
                  [bitmap]
                );

                // Keep up to 2.5s of decoded video ahead of the live playback clock so buffer never starves
                const liveTarget = getTargetTime();
                const rate = session.playbackRate || playbackRate || 1;
                const leadSec = (wrappedFrame.timestamp - liveTarget) / rate;

                if (leadSec > 2.5) {
                  const sleepMs = Math.min(40, Math.floor((leadSec - 2.0) * 1000));
                  if (sleepMs > 6) {
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
        }
        break;
      }

      case 'stopPlayback': {
        const session = sessions.get(sessionId);
        if (session) {
          session.currentPlaybackId = (session.currentPlaybackId || 0) + 1;
          session.canvasSink?.stopStream();
          session.audioSink?.stopStream();
        }
        self.postMessage({ id, success: true });
        break;
      }

      case 'renderFrame': {
        const session = sessions.get(sessionId);
        if (!session || !session.canvasSink) {
          self.postMessage({ id, success: true, result: null });
          return;
        }

        // Cancel any active stream when manually seeking/rendering single frame
        session.currentPlaybackId = (session.currentPlaybackId || 0) + 1;
        const reqId = (session.renderRequestId || 0) + 1;
        session.renderRequestId = reqId;
        session.canvasSink.stopStream();
        session.audioSink?.stopStream();

        const { timestamp, fastSeek = false } = payload;
        const wrappedCanvas = await session.canvasSink.getCanvas(Math.max(0, timestamp), Boolean(fastSeek));
        if (session.renderRequestId !== reqId || !wrappedCanvas || !wrappedCanvas.canvas) {
          self.postMessage({ id, success: true, result: null });
          return;
        }

        if (
          (wrappedCanvas.canvas as any).width <= 0 ||
          (wrappedCanvas.canvas as any).height <= 0
        ) {
          self.postMessage({ id, success: true, result: null });
          return;
        }

        const bitmap = await createImageBitmap(wrappedCanvas.canvas);
        if (session.renderRequestId !== reqId) {
          bitmap.close();
          self.postMessage({ id, success: true, result: null });
          return;
        }

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
          session.renderRequestId = (session.renderRequestId || 0) + 1;
          session.canvasSink?.close();
          session.audioSink?.close();
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

