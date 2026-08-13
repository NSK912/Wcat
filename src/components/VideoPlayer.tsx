import React, { useRef, useEffect } from 'react';
import { EditSettings } from '../types';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize2, Bug } from 'lucide-react';
import { inspectVideo } from '../utils/videoInspector';

interface VideoPlayerProps {
  videoUrl: string | null;
  settings: EditSettings;
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onDurationLoaded: (duration: number) => void;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  videoName?: string;
  selectedFile?: File;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  settings,
  currentTime,
  isPlaying,
  onTimeUpdate,
  onDurationLoaded,
  onTogglePlay,
  onSeek,
  videoName,
  selectedFile,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastTimeRef = useRef<number>(0);
  const freezeCountRef = useRef<number>(0);
  const seekingStartRef = useRef<number | null>(null);

  const handleRunDiagnostic = async () => {
    const target = selectedFile || videoUrl;
    if (!target) return;
    console.info('🔍 Running Video Diagnostic Inspector (Check DevTools Console F12)...');
    await inspectVideo(target, videoName, videoRef.current);
  };

  // Real-time Freeze & Stall Watchdog Monitor
  useEffect(() => {
    if (!videoUrl) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;

      // 1. Detect if playback is active but currentTime is frozen
      if (isPlaying && !video.paused && !video.ended) {
        if (Math.abs(video.currentTime - lastTimeRef.current) < 0.02) {
          freezeCountRef.current++;
          // If video time has not advanced for 2 seconds
          if (freezeCountRef.current >= 2) {
            console.error(
              `❌ [DevTools Alert] VIDEO PLAYBACK FROZEN AT ${video.currentTime.toFixed(2)}s!`,
              `Playback state is active (isPlaying=true) but currentTime has not advanced for >2s. (readyState: ${video.readyState}, networkState: ${video.networkState}, seeking: ${video.seeking})`
            );
            const target = selectedFile || videoUrl;
            if (target) {
              inspectVideo(target, videoName, video);
            }
            freezeCountRef.current = 0;
          }
        } else {
          freezeCountRef.current = 0;
          lastTimeRef.current = video.currentTime;
        }
      } else {
        freezeCountRef.current = 0;
        if (video) lastTimeRef.current = video.currentTime;
      }

      // 2. Detect if seeking operation is stuck
      if (seekingStartRef.current !== null) {
        const seekDur = performance.now() - seekingStartRef.current;
        if (seekDur > 2500) {
          console.error(
            `❌ [DevTools Alert] VIDEO SEEKING STUCK AT ${video.currentTime.toFixed(2)}s!`,
            `Seeking operation has taken ${(seekDur / 1000).toFixed(1)}s without completing. (readyState: ${video.readyState}, networkState: ${video.networkState})`
          );
          const target = selectedFile || videoUrl;
          if (target) {
            inspectVideo(target, videoName, video);
          }
          seekingStartRef.current = null;
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, videoUrl, selectedFile, videoName]);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.3) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = settings.speed;
      videoRef.current.volume = settings.muteAudio ? 0 : settings.volume;
    }
  }, [settings.speed, settings.volume, settings.muteAudio]);

  // Compute CSS filter string for live preview
  const getCssFilter = () => {
    if (settings.brightness === 1.0 && settings.contrast === 1.0 && settings.filter === 'none') {
      return undefined;
    }
    let f = `brightness(${settings.brightness}) contrast(${settings.contrast})`;
    switch (settings.filter) {
      case 'grayscale':
        f += ' grayscale(100%)';
        break;
      case 'sepia':
        f += ' sepia(100%)';
        break;
      case 'negative':
        f += ' invert(100%)';
        break;
      case 'blur':
        f += ' blur(3px)';
        break;
      case 'vignette':
        f += ' contrast(120%) brightness(90%)';
        break;
      default:
        break;
    }
    return f;
  };

  // Compute transform
  const getTransform = () => {
    if (!settings.rotation && !settings.flipH && !settings.flipV) {
      return undefined;
    }
    const transforms = [];
    if (settings.rotation) transforms.push(`rotate(${settings.rotation}deg)`);
    if (settings.flipH) transforms.push('scaleX(-1)');
    if (settings.flipV) transforms.push('scaleY(-1)');
    return transforms.join(' ');
  };

  // Aspect ratio class container
  const getAspectClass = () => {
    switch (settings.cropAspect) {
      case '16:9':
        return 'aspect-video max-h-[480px]';
      case '9:16':
        return 'aspect-[9/16] max-h-[480px]';
      case '1:1':
        return 'aspect-square max-h-[420px]';
      case '4:3':
        return 'aspect-[4/3] max-h-[450px]';
      default:
        return 'max-h-[480px] w-auto';
    }
  };

  const getWatermarkPositionStyle = (): React.CSSProperties => {
    switch (settings.watermarkPosition) {
      case 'top-left':
        return { top: '16px', left: '16px' };
      case 'top-right':
        return { top: '16px', right: '16px' };
      case 'bottom-left':
        return { bottom: '16px', left: '16px' };
      case 'bottom-right':
        return { bottom: '16px', right: '16px' };
      case 'center':
      default:
        return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
  };

  return (
    <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center relative p-6 overflow-hidden">
      {!videoUrl ? (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center space-x-2">
            {/* YouTube Icon Link */}
            <a
              href="https://www.youtube.com/@Nat_suki452"
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 w-9 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 rounded-lg flex items-center justify-center text-red-500 transition shadow-md shrink-0"
              title="YouTube"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </a>

            {/* GitHub Icon Link */}
            <a
              href="https://github.com/NSK912/NSKSW/tree/NSK912-patch-1"
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 w-9 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center justify-center text-slate-300 hover:text-white transition shadow-md shrink-0"
              title="GitHub"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
            </a>

            {/* Donate Icon + Text Link */}
            <a
              href="https://www.patreon.com/c/natsuki69/membership"
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3 flex items-center space-x-1.5 bg-[#FF424D]/10 hover:bg-[#FF424D]/20 border border-[#FF424D]/30 text-[#FF424D] rounded-lg font-medium text-xs transition shadow-md shrink-0"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M15.386 0c-4.767 0-8.64 3.873-8.64 8.64 0 4.755 3.873 8.633 8.64 8.633 4.755 0 8.633-3.878 8.633-8.633C24.019 3.873 20.141 0 15.386 0zM2.404 24H0V0h2.404v24z" />
              </svg>
              <span>Donate</span>
            </a>
          </div>
          <div className="text-slate-500 text-xs font-medium font-mono">
            <span className="font-bold mr-2">NSK App</span>
            ver 3.5.0.0
          </div>
        </div>
      ) : (
        <div className={`relative bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center ${getAspectClass()}`}>
          <video
            ref={videoRef}
            src={videoUrl}
            className="max-h-full max-w-full object-contain transition-all duration-200"
            style={{
              filter: getCssFilter(),
              transform: getTransform(),
            }}
            onTimeUpdate={() => {
              if (videoRef.current) {
                onTimeUpdate(videoRef.current.currentTime);
              }
            }}
            onLoadedMetadata={(e) => {
              const video = e.target as HTMLVideoElement;
              const dur = video.duration;
              onDurationLoaded(dur);
              // Force mobile browsers to render the first frame
              if (video.currentTime === 0) {
                video.currentTime = 0.001;
              }
            }}
            onEnded={() => onTogglePlay()}
            onWaiting={() => {
              const video = videoRef.current;
              if (video) {
                console.warn(`⚠️ [DevTools Event] Video 'waiting' (stalled/buffering) at ${video.currentTime.toFixed(2)}s (readyState: ${video.readyState})`);
              }
            }}
            onStalled={() => {
              const video = videoRef.current;
              if (video) {
                console.warn(`⚠️ [DevTools Event] Video 'stalled' (no media data arriving) at ${video.currentTime.toFixed(2)}s (networkState: ${video.networkState})`);
              }
            }}
            onSeeking={() => {
              seekingStartRef.current = performance.now();
              const video = videoRef.current;
              if (video) {
                console.info(`⏩ [DevTools Event] Seeking started to ${video.currentTime.toFixed(2)}s`);
              }
            }}
            onSeeked={() => {
              if (seekingStartRef.current !== null) {
                const dur = Math.round(performance.now() - seekingStartRef.current);
                console.info(`✅ [DevTools Event] Seek completed in ${dur}ms`);
                seekingStartRef.current = null;
              }
            }}
            onError={async () => {
              console.error('❌ [VideoPlayer] HTML5 Video playback error detected! Running diagnostic inspection...');
              const target = selectedFile || videoUrl;
              if (target) {
                await inspectVideo(target, videoName, videoRef.current);
              }
            }}
            playsInline
            preload="auto"
            crossOrigin="anonymous"
            muted={settings.muteAudio}
          />

          {/* Top-Right Diagnostic Button */}
          <button
            onClick={handleRunDiagnostic}
            className="absolute top-3 right-3 z-30 bg-slate-900/80 hover:bg-indigo-600 text-slate-200 hover:text-white px-2.5 py-1.5 rounded-lg border border-white/10 text-xs font-semibold backdrop-blur-md transition flex items-center space-x-1.5 shadow-lg group"
            title="กดเพื่อส่งรายงานโครงสร้างวิดีโอระดับไบต์เข้า DevTools Console (F12)"
          >
            <Bug className="w-3.5 h-3.5 text-indigo-400 group-hover:text-white transition" />
            <span>DevTools Check</span>
          </button>

          {/* Live Watermark Overlay */}
          {settings.watermarkText && (
            <div
              className="absolute pointer-events-none font-bold drop-shadow-md px-3 py-1 rounded bg-black/40 backdrop-blur-xs"
              style={{
                ...getWatermarkPositionStyle(),
                color: settings.watermarkColor || '#ffffff',
                fontSize: `${settings.watermarkSize}px`,
              }}
            >
              {settings.watermarkText}
            </div>
          )}

          {/* Floating play/pause overlay button on click */}
          <div
            onClick={() => {
              if (videoRef.current) {
                if (isPlaying) {
                  videoRef.current.pause();
                } else {
                  videoRef.current.play().catch(console.error);
                }
              }
              onTogglePlay();
            }}
            className={`absolute inset-0 flex items-center justify-center transition cursor-pointer group ${
              isPlaying ? 'opacity-0 hover:opacity-100 bg-black/20' : 'opacity-100 bg-black/30'
            }`}
          >
            <div className="h-9 w-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 border border-white/10 transform group-hover:scale-110 transition">
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
