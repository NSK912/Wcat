import React, { useRef, useEffect, useState, useCallback } from 'react';
import { EditSettings } from '../types';
import {
  Play,
  Pause,
  AlertTriangle,
  RefreshCw,
  Check,
  Scaling,
  Monitor,
  Tv,
  Square,
  Smartphone,
  Film,
  RotateCcw,
} from 'lucide-react';

interface VideoPlayerProps {
  videoUrl: string | null;
  settings: EditSettings;
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onDurationLoaded: (duration: number) => void;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onUpdateSettings?: (settings: Partial<EditSettings>) => void;
  videoName?: string;
  selectedFile?: File;
}

interface AspectOption {
  id: EditSettings['cropAspect'];
  label: string;
  sublabel: string;
  icon: React.ReactNode;
}

const ASPECT_OPTIONS: AspectOption[] = [
  {
    id: '16:9',
    label: '16:9',
    sublabel: 'Widescreen (YouTube / TV)',
    icon: <Monitor className="w-3.5 h-3.5" />,
  },
  {
    id: '4:3',
    label: '4:3',
    sublabel: 'Classic / Standard TV',
    icon: <Tv className="w-3.5 h-3.5" />,
  },
  {
    id: '1:1',
    label: '1:1',
    sublabel: 'Square (Instagram / Feed)',
    icon: <Square className="w-3.5 h-3.5" />,
  },
  {
    id: '4:5',
    label: '4:5',
    sublabel: 'Portrait (Social Post)',
    icon: <Smartphone className="w-3.5 h-3.5" />,
  },
  {
    id: '9:16',
    label: '9:16',
    sublabel: 'Vertical (Reels / TikTok)',
    icon: <Smartphone className="w-3.5 h-3.5 rotate-90" />,
  },
  {
    id: '21:9',
    label: '21:9',
    sublabel: 'Cinematic / Ultrawide',
    icon: <Film className="w-3.5 h-3.5" />,
  },
  {
    id: 'original',
    label: 'Original',
    sublabel: 'Auto / Fit Source',
    icon: <RotateCcw className="w-3.5 h-3.5" />,
  },
];

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  settings,
  currentTime,
  isPlaying,
  onTimeUpdate,
  onDurationLoaded,
  onTogglePlay,
  onUpdateSettings,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Reset error state when video URL changes
  useEffect(() => {
    setLoadError(null);
  }, [videoUrl]);

  // Handle outside clicks to close context menu
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleOutsideClick);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [contextMenu]);

  useEffect(() => {
    if (videoRef.current && videoUrl && !loadError) {
      if (isPlaying) {
        const promise = videoRef.current.play();
        if (promise !== undefined) {
          promise.catch((err) => {
            console.warn('Playback paused or not permitted:', err);
          });
        }
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, videoUrl, loadError]);

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
        return 'aspect-[16/9] max-h-[480px] w-full max-w-[854px]';
      case '4:3':
        return 'aspect-[4/3] max-h-[460px] w-full max-w-[640px]';
      case '1:1':
        return 'aspect-square max-h-[420px] w-full max-w-[420px]';
      case '4:5':
        return 'aspect-[4/5] max-h-[480px] w-full max-w-[384px]';
      case '9:16':
        return 'aspect-[9/16] max-h-[480px] w-full max-w-[270px]';
      case '21:9':
        return 'aspect-[21/9] max-h-[400px] w-full max-w-[933px]';
      case 'original':
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

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const mediaErr = e.currentTarget.error;
    let detail = 'Browser cannot preview this video directly';
    if (mediaErr) {
      switch (mediaErr.code) {
        case 1: // MEDIA_ERR_ABORTED
          detail = 'Video playback was aborted';
          break;
        case 2: // MEDIA_ERR_NETWORK
          detail = 'Network error loading video';
          break;
        case 3: // MEDIA_ERR_DECODE
          detail = 'Decode error (unsupported audio/video codec)';
          break;
        case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
          detail = 'Video format not supported natively in browser preview (Remux or Encode Mode can still process it)';
          break;
      }
    }
    setLoadError(detail);
  };

  // Right-click context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 240;
    const menuHeight = 350;
    let posX = e.clientX;
    let posY = e.clientY;

    if (posX + menuWidth > window.innerWidth - 12) {
      posX = window.innerWidth - menuWidth - 12;
    }
    if (posY + menuHeight > window.innerHeight - 12) {
      posY = window.innerHeight - menuHeight - 12;
    }

    setContextMenu({ x: posX, y: posY });
  }, []);

  const handleSelectAspect = (aspect: EditSettings['cropAspect']) => {
    if (onUpdateSettings) {
      onUpdateSettings({ cropAspect: aspect });
    }
    setContextMenu(null);
  };

  return (
    <div
      ref={containerRef}
      onContextMenu={handleContextMenu}
      className="flex-1 bg-slate-950 flex flex-col items-center justify-center relative p-6 overflow-hidden select-none"
    >
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
            ver 3.5.0.1
          </div>
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center p-6 bg-slate-900/90 border border-amber-500/40 rounded-xl max-w-md text-center shadow-xl backdrop-blur-sm">
          <AlertTriangle className="w-10 h-10 text-amber-400 mb-3" />
          <h3 className="text-sm font-semibold text-white mb-1">Preview Notice</h3>
          <p className="text-xs text-slate-300 mb-4 leading-relaxed">{loadError}</p>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setLoadError(null);
                if (videoRef.current) {
                  videoRef.current.load();
                }
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-white/10 flex items-center space-x-1 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Load</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`relative bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center transition-all duration-300 ${getAspectClass()}`}
        >
          <video
            ref={videoRef}
            src={videoUrl}
            className={`transition-all duration-200 ${
              settings.cropAspect && settings.cropAspect !== 'original'
                ? 'w-full h-full object-cover'
                : 'max-h-full max-w-full object-contain'
            }`}
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
              if (!isNaN(dur) && dur > 0) {
                onDurationLoaded(dur);
              }
              // Force mobile browsers to render the first frame
              if (video.currentTime === 0) {
                video.currentTime = 0.001;
              }
            }}
            onError={handleVideoError}
            onEnded={() => onTogglePlay()}
            playsInline
            preload="auto"
            muted={settings.muteAudio}
          />

          {/* Current Aspect Ratio Badge Indicator */}
          {settings.cropAspect && settings.cropAspect !== 'original' && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleContextMenu(e);
              }}
              className="absolute top-3 left-3 z-10 px-2.5 py-1 bg-slate-900/85 hover:bg-slate-800 border border-white/20 text-cyan-400 text-xs font-mono rounded-md shadow-lg backdrop-blur-md flex items-center space-x-1.5 cursor-pointer transition"
              title="Click or right-click to change scale"
            >
              <Scaling className="w-3 h-3 text-cyan-400" />
              <span className="font-semibold tracking-wider">{settings.cropAspect}</span>
            </div>
          )}

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

      {/* Right-Click Popup Context Menu for Aspect Ratio / Scale */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[230px] bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-xl p-1.5 text-slate-200 animate-in fade-in zoom-in-95 duration-150"
          style={{
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Menu Header */}
          <div className="px-3 py-2 border-b border-slate-800/80 flex items-center justify-between mb-1">
            <div className="flex items-center space-x-2">
              <Scaling className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-white tracking-wide">Video Scale / สเกลวิดีโอ</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Aspect</span>
          </div>

          {/* Aspect Ratio Options List */}
          <div className="flex flex-col gap-0.5 max-h-[300px] overflow-y-auto">
            {ASPECT_OPTIONS.map((option) => {
              const isActive = (settings.cropAspect || 'original') === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => handleSelectAspect(option.id)}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between text-xs transition cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-300 font-medium border border-cyan-500/30'
                      : 'hover:bg-slate-800/80 text-slate-300 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <span
                      className={`p-1 rounded ${
                        isActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {option.icon}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-bold text-xs">{option.label}</span>
                      <span className="text-[10px] text-slate-400 leading-none">{option.sublabel}</span>
                    </div>
                  </div>
                  {isActive && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>

          {/* Menu Footer Hint */}
          <div className="mt-1 pt-1.5 border-t border-slate-800/80 px-2.5 py-1 text-[10px] text-slate-500 flex items-center justify-between">
            <span>คลิกขวาเพื่อเปิดเมนูนี้ได้ตลอดเวลา</span>
            <span className="font-mono text-slate-600">Esc to close</span>
          </div>
        </div>
      )}
    </div>
  );
};

