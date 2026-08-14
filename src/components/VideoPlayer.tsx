import React, { useRef, useEffect, useState, useCallback } from 'react';
import { EditSettings } from '../types';
import { Play, Pause, Zap, Terminal } from 'lucide-react';
import { WEngineLogger } from '../utils/WEngineDevTools';

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
  const [showLogToast, setShowLogToast] = useState<boolean>(false);
  const [isHardwareGPU, setIsHardwareGPU] = useState<boolean>(true);

  // Sync play / pause with video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          WEngineLogger.log('SoftwareVideo', 'warn', 'Playback play() interrupted:', err);
        });
      }
    } else {
      video.pause();
    }
  }, [isPlaying]);

  // Sync seek with video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Math.abs(video.currentTime - currentTime) > 0.25) {
      video.currentTime = currentTime;
    }
  }, [currentTime]);

  // Sync audio volume, mute, speed
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = Math.max(0, Math.min(1, settings.volume));
    video.muted = settings.muteAudio;
    video.playbackRate = settings.speed || 1.0;
  }, [settings.volume, settings.muteAudio, settings.speed]);

  // Handle Video Metadata Loaded
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;

    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    const dur = video.duration || 0;

    if (dur > 0) {
      onDurationLoaded(dur);
    }

    WEngineLogger.updateDecoderStatus({
      resolution: `${w}x${h}`,
      videoCodec: 'Hardware Accelerated (H.264/WebCodecs/AV1)',
      decodedFramesCount: 0,
      droppedFramesCount: 0,
    });

    WEngineLogger.log('SoftwareVideo', 'info', `Media loaded: ${w}x${h}, duration: ${dur.toFixed(2)}s`);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video) {
      onTimeUpdate(video.currentTime);
    }
  };

  const handleVideoEnded = () => {
    onTogglePlay();
    onSeek(0);
  };

  // Compute CSS filter & hardware transform styles
  const getVideoFilterStyle = (): React.CSSProperties => {
    let filterStr = `brightness(${settings.brightness}) contrast(${settings.contrast})`;
    if (settings.filter === 'grayscale') filterStr += ' grayscale(100%)';
    else if (settings.filter === 'sepia') filterStr += ' sepia(100%)';
    else if (settings.filter === 'negative') filterStr += ' invert(100%)';

    let transformStr = `rotate(${settings.rotation}deg)`;
    if (settings.flipH) transformStr += ' scaleX(-1)';
    if (settings.flipV) transformStr += ' scaleY(-1)';

    return {
      filter: filterStr,
      transform: transformStr,
      transition: 'filter 0.15s ease, transform 0.15s ease',
    };
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

  const handleTriggerReport = (e: React.MouseEvent) => {
    e.stopPropagation();
    WEngineLogger.printFullReport();
    setShowLogToast(true);
    setTimeout(() => setShowLogToast(false), 2500);
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
        <div
          className={`relative bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center ${getAspectClass()}`}
        >
          {/* Hardware Accelerated Video Display */}
          <video
            ref={videoRef}
            src={videoUrl}
            playsInline
            crossOrigin="anonymous"
            preload="auto"
            style={getVideoFilterStyle()}
            className="max-h-full max-w-full object-contain"
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleVideoEnded}
            onError={(e) => {
              WEngineLogger.reportDecoderError(e);
            }}
          />

          {/* Vignette Filter Overlay */}
          {settings.filter === 'vignette' && (
            <div
              className="absolute inset-0 pointer-events-none z-10"
              style={{
                boxShadow: 'inset 0 0 90px rgba(0, 0, 0, 0.85)',
              }}
            />
          )}

          {/* Engine Status & DevTools Diagnostic Trigger Badge */}
          <button
            onClick={handleTriggerReport}
            title="Click to print full WEngine Diagnostic Report to DevTools Console"
            className="absolute top-3 left-3 z-30 flex items-center space-x-1.5 bg-slate-900/85 hover:bg-slate-800 backdrop-blur-md px-2.5 py-1 rounded-full border border-indigo-500/30 text-[11px] text-indigo-300 font-mono shadow-md cursor-pointer transition"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-emerald-300 font-semibold">GPU Accelerated</span>
            <span className="text-slate-500">|</span>
            <Terminal className="w-3 h-3 text-cyan-400" />
            <span className="text-cyan-300 text-[10px]">DevTools</span>
          </button>

          {/* DevTools Log Toast Notification */}
          {showLogToast && (
            <div className="absolute top-12 left-3 z-30 bg-slate-900/95 border border-cyan-500/40 text-cyan-200 text-xs px-3 py-1.5 rounded-lg shadow-xl font-mono animate-fade-in pointer-events-none">
              🚀 Report printed to DevTools Console (F12)
            </div>
          )}

          {/* Live Watermark Overlay */}
          {settings.watermarkText && (
            <div
              className="absolute pointer-events-none font-bold drop-shadow-md px-3 py-1 rounded bg-black/40 backdrop-blur-xs z-10"
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
            onClick={() => onTogglePlay()}
            className={`absolute inset-0 flex items-center justify-center transition cursor-pointer group z-20 ${
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
