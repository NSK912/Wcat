import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createWebCodecsSession, WebCodecsSession } from '../utils/webcodecsPlayerClient';

interface WebCodecsPlayerCanvasProps {
  file?: File;
  url?: string;
  currentTime: number;
  isPlaying: boolean;
  playbackRate?: number;
  muted?: boolean;
  volume?: number;
  filterStyle?: string;
  transformStyle?: string;
  className?: string;
  style?: React.CSSProperties;
  onTimeUpdate?: (time: number) => void;
  onDurationLoaded?: (dur: number) => void;
  onAspectLoaded?: (aspect: number) => void;
  onError?: (err: string) => void;
  onEnded?: () => void;
  isMaster?: boolean;
}

interface BufferedFrame {
  bitmap: ImageBitmap;
  timestamp: number;
  playbackId: number;
}

export const WebCodecsPlayerCanvas: React.FC<WebCodecsPlayerCanvasProps> = ({
  file,
  url,
  currentTime,
  isPlaying,
  playbackRate = 1,
  muted = false,
  volume = 1,
  className,
  style,
  onTimeUpdate,
  onDurationLoaded,
  onAspectLoaded,
  onError,
  onEnded,
  isMaster = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const sessionRef = useRef<WebCodecsSession | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  // Keep callback refs stable to prevent unneeded session teardown
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onDurationLoadedRef = useRef(onDurationLoaded);
  const onAspectLoadedRef = useRef(onAspectLoaded);
  const onErrorRef = useRef(onError);
  const onEndedRef = useRef(onEnded);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
    onDurationLoadedRef.current = onDurationLoaded;
    onAspectLoadedRef.current = onAspectLoaded;
    onErrorRef.current = onError;
    onEndedRef.current = onEnded;
  });

  const isRenderingRef = useRef(false);
  const lastRenderedTimeRef = useRef<number>(-1);
  const playheadTimeRef = useRef<number>(currentTime);
  const lastRafTimestampRef = useRef<number>(0);
  const lastReportedTimeRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  // Streaming frame buffer for 60FPS jitter-free playback
  const frameBufferRef = useRef<BufferedFrame[]>([]);
  const currentPlaybackIdRef = useRef<number>(0);

  // Sync ref with prop
  useEffect(() => {
    playheadTimeRef.current = currentTime;
  }, [currentTime]);

  // Audio volume and playback rate
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.volume = muted ? 0 : volume;
      audioRef.current.muted = muted;
    }
  }, [playbackRate, muted, volume]);

  const clearFrameBuffer = useCallback(() => {
    frameBufferRef.current.forEach((f) => {
      try {
        f.bitmap.close();
      } catch {}
    });
    frameBufferRef.current = [];
  }, []);

  // Render a single frame onto the canvas at a given timestamp (used when scrubbing while paused)
  const drawFrameAt = useCallback(async (timestamp: number) => {
    const session = sessionRef.current;
    const canvas = canvasRef.current;
    if (!session || !canvas || isRenderingRef.current) return;

    isRenderingRef.current = true;
    try {
      const bitmap = await session.renderFrame(timestamp);
      if (bitmap) {
        if (canvas.width === 0 || canvas.height === 0 || Math.abs(canvas.width - bitmap.width) > 2) {
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
        }

        const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        }
        bitmap.close();
        lastRenderedTimeRef.current = timestamp;
      }
    } catch {
      // Ignore frame decode failure gracefully
    } finally {
      isRenderingRef.current = false;
    }
  }, []);

  // Initialize WebCodecs Session ONLY when file or url changes
  useEffect(() => {
    let active = true;
    const targetSource = file || url;
    if (!targetSource) {
      setSessionReady(false);
      return;
    }

    setSessionReady(false);
    clearFrameBuffer();

    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }

    createWebCodecsSession(targetSource)
      .then((session) => {
        if (!active) {
          session.close();
          return;
        }

        sessionRef.current = session;
        setSessionReady(true);

        if (session.duration > 0 && onDurationLoadedRef.current) {
          onDurationLoadedRef.current(session.duration);
        }

        if (session.width > 0 && session.height > 0) {
          if (canvasRef.current) {
            canvasRef.current.width = session.width;
            canvasRef.current.height = session.height;
          }
          if (onAspectLoadedRef.current) {
            onAspectLoadedRef.current(session.width / session.height);
          }
        }

        // Draw initial frame at current position
        drawFrameAt(playheadTimeRef.current);
      })
      .catch((err) => {
        console.warn('[WebCodecsPlayerCanvas] Initialization error:', err);
        if (onErrorRef.current) {
          onErrorRef.current(err.message || 'WebCodecs initialization error');
        }
      });

    return () => {
      active = false;
      clearFrameBuffer();
      if (sessionRef.current) {
        sessionRef.current.close();
        sessionRef.current = null;
      }
    };
  }, [file, url, drawFrameAt, clearFrameBuffer]);

  // Handle Seeking / Time updates when NOT playing (e.g. dragging timeline)
  useEffect(() => {
    if (!isPlaying && sessionReady) {
      clearFrameBuffer();
      if (Math.abs(lastRenderedTimeRef.current - currentTime) > 0.02) {
        drawFrameAt(currentTime);
      }
      if (audioRef.current && Math.abs(audioRef.current.currentTime - currentTime) > 0.05) {
        audioRef.current.currentTime = currentTime;
      }
    }
  }, [currentTime, isPlaying, sessionReady, drawFrameAt, clearFrameBuffer]);

  // Audio Playback synchronization
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        if (Math.abs(audioRef.current.currentTime - playheadTimeRef.current) > 0.08) {
          audioRef.current.currentTime = playheadTimeRef.current;
        }
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  // High-performance Streaming Playback Loop
  useEffect(() => {
    const session = sessionRef.current;
    const canvas = canvasRef.current;

    if (!isPlaying || !sessionReady || !session || !canvas) {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (session) {
        session.stopPlayback();
      }
      clearFrameBuffer();
      return;
    }

    clearFrameBuffer();
    lastRafTimestampRef.current = performance.now();
    lastReportedTimeRef.current = performance.now();

    // Start sequential stream decoder in WebCodecs Worker
    const playbackId = session.startPlayback(
      playheadTimeRef.current,
      playbackRate,
      (bitmap, timestamp, pid) => {
        if (pid !== currentPlaybackIdRef.current) {
          bitmap.close();
          return;
        }
        const buf = frameBufferRef.current;
        buf.push({ bitmap, timestamp, playbackId: pid });
        buf.sort((a, b) => a.timestamp - b.timestamp);
      },
      (pid) => {
        if (pid === currentPlaybackIdRef.current && onEndedRef.current) {
          onEndedRef.current();
        }
      }
    );

    currentPlaybackIdRef.current = playbackId;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

    const loop = (now: number) => {
      const delta = (now - lastRafTimestampRef.current) / 1000;
      lastRafTimestampRef.current = now;

      const duration = session.duration || 0;
      let nextTime = playheadTimeRef.current + delta * playbackRate;

      // When audio is actively playing, lock to hardware audio clock for jitter-free lip-sync
      if (audioRef.current && !muted && !audioRef.current.paused && audioRef.current.currentTime > 0) {
        const audioTime = audioRef.current.currentTime;
        if (Math.abs(audioTime - nextTime) < 0.5) {
          nextTime = audioTime;
        }
      }

      if (duration > 0 && nextTime >= duration) {
        playheadTimeRef.current = duration;
        if (onTimeUpdateRef.current) onTimeUpdateRef.current(duration);
        if (onEndedRef.current) onEndedRef.current();
        return;
      }

      playheadTimeRef.current = nextTime;

      // Extract the target frame from the streamed buffer
      const buf = frameBufferRef.current;
      let targetFrameIdx = -1;

      for (let i = 0; i < buf.length; i++) {
        if (buf[i].timestamp <= nextTime + 0.02) {
          targetFrameIdx = i;
        } else {
          break;
        }
      }

      if (targetFrameIdx >= 0) {
        // Splice all frames up to targetFrameIdx without array mutation bugs
        const removed = buf.splice(0, targetFrameIdx + 1);
        const frameToRender = removed[removed.length - 1];

        if (canvas.width === 0 || canvas.height === 0 || Math.abs(canvas.width - frameToRender.bitmap.width) > 2) {
          canvas.width = frameToRender.bitmap.width;
          canvas.height = frameToRender.bitmap.height;
        }

        if (ctx) {
          ctx.drawImage(frameToRender.bitmap, 0, 0, canvas.width, canvas.height);
        }
        lastRenderedTimeRef.current = frameToRender.timestamp;

        // Close all consumed bitmaps cleanly
        removed.forEach((f) => {
          try {
            f.bitmap.close();
          } catch {}
        });
      }

      // Throttle onTimeUpdate reporting to ~200ms intervals (matching standard HTML5 video frequency)
      if (isMaster && onTimeUpdateRef.current) {
        if (now - lastReportedTimeRef.current >= 180) {
          lastReportedTimeRef.current = now;
          onTimeUpdateRef.current(nextTime);
        }
      }

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      session.stopPlayback();
      clearFrameBuffer();
    };
  }, [isPlaying, sessionReady, playbackRate, isMaster, clearFrameBuffer, muted]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className={className}
        style={style}
      />
      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="auto"
          style={{ display: 'none' }}
          onError={() => {
            // Silently ignore audio decode failure on damaged files
          }}
        />
      )}
    </>
  );
};
