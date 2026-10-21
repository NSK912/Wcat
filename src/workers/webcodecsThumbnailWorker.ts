import { Input, BlobSource, ALL_FORMATS, CanvasSink, setKnownFileDuration } from '../utils/nativeMedia';

self.addEventListener('error', (e: ErrorEvent) => {
  console.warn('[WebCodecsThumbnailWorker] Caught worker internal error:', e.message);
  e.preventDefault();
});

self.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  console.warn('[WebCodecsThumbnailWorker] Caught unhandled rejection:', e.reason);
  e.preventDefault();
});

self.onmessage = async (e: MessageEvent) => {
  const { id, action, payload } = e.data;

  try {
    switch (action) {
      case 'probe': {
        const { file, knownDuration } = payload;
        if (file && knownDuration && knownDuration > 0) {
          setKnownFileDuration(file, knownDuration);
        }
        const input = new Input({
          source: new BlobSource(file),
          formats: ALL_FORMATS,
        });

        const vTracks = await input.getVideoTracks();
        const aTracks = await input.getAudioTracks();

        let duration = 0;
        let width = 1920;
        let height = 1080;
        let rotation = 0;

        if (vTracks.length > 0) {
          const track = vTracks[0];
          try {
            const metaDur = await track.getDurationFromMetadata();
            if (metaDur && Number.isFinite(metaDur) && metaDur > 0) {
              duration = metaDur;
            } else {
              duration = (await track.computeDuration()) || 0;
            }
          } catch {
            try {
              duration = (await track.computeDuration()) || 0;
            } catch {
              duration = 0;
            }
          }
          try {
            width = await track.getSquarePixelWidth();
            height = await track.getSquarePixelHeight();
            rotation = await track.getRotation();
          } catch {
            width = 1920;
            height = 1080;
          }
        } else if (aTracks.length > 0) {
          const track = aTracks[0];
          try {
            const metaDur = await track.getDurationFromMetadata();
            if (metaDur && Number.isFinite(metaDur) && metaDur > 0) {
              duration = metaDur;
            } else {
              duration = (await track.computeDuration()) || 0;
            }
          } catch {
            duration = 0;
          }
        }

        self.postMessage({
          id,
          success: true,
          result: {
            duration,
            width,
            height,
            rotation,
            hasVideo: vTracks.length > 0,
            hasAudio: aTracks.length > 0,
          },
        });
        break;
      }

      case 'thumbnails': {
        const { file, count = 8, knownDuration } = payload;
        if (file && knownDuration && knownDuration > 0) {
          setKnownFileDuration(file, knownDuration);
        }
        const input = new Input({
          source: new BlobSource(file),
          formats: ALL_FORMATS,
        });

        const vTracks = await input.getVideoTracks();
        if (vTracks.length === 0) {
          self.postMessage({ id, success: true, result: { thumbnails: [], duration: 0 } });
          return;
        }

        const videoTrack = vTracks[0];
        let duration = 0;
        try {
          const metaDur = await videoTrack.getDurationFromMetadata();
          if (metaDur && Number.isFinite(metaDur) && metaDur > 0) {
            duration = metaDur;
          } else {
            duration = (await videoTrack.computeDuration()) || 10;
          }
        } catch {
          duration = 10;
        }

        const thumbWidth = 120;
        const thumbHeight = 68;
        const sink = new CanvasSink(videoTrack, {
          width: thumbWidth,
          height: thumbHeight,
          fit: 'cover',
        });

        const thumbnails: string[] = [];
        const step = duration / count;
        const timestamps: number[] = [];
        for (let i = 0; i < count; i++) {
          timestamps.push(Math.max(0, Math.min(duration - 0.05, (i + 0.5) * step)));
        }

        // Use canvasesAtTimestamps for single-pass sorted decoding (10x faster than random seeks)
        try {
          for await (const wrappedCanvas of sink.canvasesAtTimestamps(timestamps)) {
            if (wrappedCanvas && wrappedCanvas.canvas) {
              const canvas = wrappedCanvas.canvas as OffscreenCanvas;
              if ('convertToBlob' in canvas) {
                const blob = await canvas.convertToBlob({
                  type: 'image/jpeg',
                  quality: 0.6,
                });
                const ab = await blob.arrayBuffer();
                const bytes = new Uint8Array(ab);
                let binary = '';
                const chunkLen = 8192;
                for (let j = 0; j < bytes.length; j += chunkLen) {
                  const chunk = bytes.subarray(j, Math.min(j + chunkLen, bytes.length));
                  binary += String.fromCharCode.apply(null, Array.from(chunk));
                }
                thumbnails.push('data:image/jpeg;base64,' + btoa(binary));
              } else {
                thumbnails.push('');
              }
            } else {
              thumbnails.push('');
            }
          }
        } catch (iterErr) {
          console.warn('[ThumbnailWorker] canvasesAtTimestamps partial fail:', iterErr);
        } finally {
          sink.close();
        }

        // Ensure we always return array of requested count
        while (thumbnails.length < count) {
          thumbnails.push(thumbnails[thumbnails.length - 1] || '');
        }

        self.postMessage({
          id,
          success: true,
          result: { thumbnails, duration },
        });
        break;
      }

      default:
        throw new Error(`Unknown thumbnail worker action: ${action}`);
    }
  } catch (err: any) {
    self.postMessage({
      id,
      success: false,
      error: err?.message || String(err),
    });
  }
};
