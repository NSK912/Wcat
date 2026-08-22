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
  Lock,
  Crop,
  Move,
} from 'lucide-react';

interface VideoPlayerProps {
  videoUrl: string | null;
  activeAudioClips?: { id: string; url: string; startTime: number; sourceStartTime: number }[];
  settings: EditSettings;
  currentTime: number;
  mediaOffset?: number;
  sourceStartTime?: number;
  clipEndTime?: number;
  hasActiveClip?: boolean;
  selectedFiles?: File[];
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onDurationLoaded: (duration: number) => void;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onUpdateSettings?: (settings: Partial<EditSettings>) => void;
  onToggleEncodeMode?: () => void;
  isEncodeMode?: boolean;
  videoName?: string;
  selectedFile?: File;
}

interface AspectOption {
  id: EditSettings['cropAspect'];
  label: string;
  icon: React.ReactNode;
}

const ASPECT_OPTIONS: AspectOption[] = [
  {
    id: 'original',
    label: 'Original',
    icon: <RotateCcw className="w-3.5 h-3.5" />,
  },
  {
    id: '16:9',
    label: '16:9',
    icon: <Monitor className="w-3.5 h-3.5" />,
  },
  {
    id: '4:3',
    label: '4:3',
    icon: <Tv className="w-3.5 h-3.5" />,
  },
  {
    id: '1:1',
    label: '1:1',
    icon: <Square className="w-3.5 h-3.5" />,
  },
  {
    id: '4:5',
    label: '4:5',
    icon: <Smartphone className="w-3.5 h-3.5" />,
  },
  {
    id: '9:16',
    label: '9:16',
    icon: <Smartphone className="w-3.5 h-3.5 rotate-90" />,
  },
  {
    id: '21:9',
    label: '21:9',
    icon: <Film className="w-3.5 h-3.5" />,
  },
];

type DragHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

const AudioTrack: React.FC<{
  clip: { id: string; url: string; startTime: number; sourceStartTime: number };
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  volume: number;
  isMasterTimekeeper?: boolean;
  onTimeUpdate?: (time: number) => void;
}> = ({ clip, currentTime, isPlaying, playbackRate, volume, isMasterTimekeeper, onTimeUpdate }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.volume = volume;
    }
  }, [playbackRate, volume]);

  useEffect(() => {
    if (audioRef.current) {
      const localTarget = Math.max(0, clip.sourceStartTime + (currentTime - clip.startTime));
      if (!isPlaying) {
        if (Math.abs(audioRef.current.currentTime - localTarget) > 0.05) {
          audioRef.current.currentTime = localTarget;
        }
      } else {
        if (Math.abs(audioRef.current.currentTime - localTarget) > 0.25) {
          audioRef.current.currentTime = localTarget;
        }
      }
    }
  }, [currentTime, clip.sourceStartTime, clip.startTime, isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(err => console.warn('Audio play failed:', err));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, clip.url]);

  return (
    <audio
      ref={audioRef}
      src={clip.url}
      preload="auto"
      style={{ display: 'none' }}
      onTimeUpdate={() => {
        if (isMasterTimekeeper && audioRef.current && isPlaying && onTimeUpdate) {
          const mappedTime = clip.startTime + (audioRef.current.currentTime - clip.sourceStartTime);
          onTimeUpdate(mappedTime);
        }
      }}
    />
  );
};

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  activeAudioClips = [],
  settings,
  currentTime,
  mediaOffset = 0,
  sourceStartTime = 0,
  clipEndTime = 0,
  hasActiveClip = false,
  selectedFiles,
  isPlaying,
  onTimeUpdate,
  onDurationLoaded,
  onTogglePlay,
  onUpdateSettings,
  onToggleEncodeMode,
  isEncodeMode = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoWrapperRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const effectiveAspect = isEncodeMode
    ? (!settings.cropAspect || settings.cropAspect === 'original' ? '16:9' : settings.cropAspect)
    : 'original';

  const isFreeCropActive = Boolean(isEncodeMode && effectiveAspect === 'free');
  const isScalingActive = Boolean(isEncodeMode && effectiveAspect !== 'original');
  const currentCropRect = settings.freeCropRect || { x: 0, y: 0, width: 1, height: 1 };

  // Dragging state for free crop
  const [isDraggingCrop, setIsDraggingCrop] = useState<boolean>(false);
  const dragInfoRef = useRef<{
    handle: DragHandle;
    startX: number;
    startY: number;
    startRect: { x: number; y: number; width: number; height: number };
    containerWidth: number;
    containerHeight: number;
  } | null>(null);

  // Reset error state and context menu when video URL or mode changes
  useEffect(() => {
    setLoadError(null);
  }, [videoUrl]);

  useEffect(() => {
    if (!isEncodeMode) {
      setContextMenu(null);
    }
  }, [isEncodeMode]);

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
    if (videoRef.current) {
      if (isPlaying && hasActiveClip && videoUrl && !loadError) {
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
  }, [isPlaying, videoUrl, loadError, hasActiveClip]);

  useEffect(() => {
    if (videoRef.current && hasActiveClip && videoUrl) {
      const localTarget = Math.max(0, sourceStartTime + (currentTime - mediaOffset));
      if (!isPlaying) {
        // Immediate seek when paused or scrubbing
        if (Math.abs(videoRef.current.currentTime - localTarget) > 0.005) {
          videoRef.current.currentTime = localTarget;
        }
      } else {
        // During playback, resync only if drift is significant
        if (Math.abs(videoRef.current.currentTime - localTarget) > 0.25) {
          videoRef.current.currentTime = localTarget;
        }
      }
    }
  }, [currentTime, mediaOffset, sourceStartTime, hasActiveClip, videoUrl, isPlaying]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = settings.speed;
      videoRef.current.volume = settings.muteAudio ? 0 : settings.volume;
      videoRef.current.muted = isEncodeMode || settings.muteAudio;
    }
  }, [settings.speed, settings.volume, settings.muteAudio, isEncodeMode]);

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

  // Aspect ratio class container (Only active when Encode Mode is enabled and not in free mode)
  const getAspectStyle = (): React.CSSProperties => {
    if (!isEncodeMode || effectiveAspect === 'free' || effectiveAspect === 'original') {
      return { maxHeight: '480px', width: 'auto', maxWidth: '100%' };
    }

    let ratioNum = 16 / 9;
    let maxW = 854;
    let maxH = 480;

    switch (effectiveAspect) {
      case '16:9': ratioNum = 16 / 9; maxW = 854; maxH = 480; break;
      case '4:3': ratioNum = 4 / 3; maxW = 640; maxH = 480; break;
      case '1:1': ratioNum = 1 / 1; maxW = 480; maxH = 480; break;
      case '4:5': ratioNum = 4 / 5; maxW = 384; maxH = 480; break;
      case '9:16': ratioNum = 9 / 16; maxW = 270; maxH = 480; break;
      case '21:9': ratioNum = 21 / 9; maxW = 1120; maxH = 480; break;
    }

    return {
      aspectRatio: `${ratioNum}`,
      width: `min(calc(100cqw - 48px), calc((100cqh - 48px) * ${ratioNum}), ${maxW}px)`,
      maxHeight: `${maxH}px`,
    };
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

  // Right-click context menu handler (Only activates on the video preview box when Encode Mode is enabled)
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    // In default Copy Mode, encode features/context menus are completely disabled
    if (!isEncodeMode || !videoUrl || loadError) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 260;
    const menuHeight = 390;
    let posX = e.clientX;
    let posY = e.clientY;

    if (posX + menuWidth > window.innerWidth - 12) {
      posX = window.innerWidth - menuWidth - 12;
    }
    if (posY + menuHeight > window.innerHeight - 12) {
      posY = window.innerHeight - menuHeight - 12;
    }

    setContextMenu({ x: posX, y: posY });
  }, [isEncodeMode, videoUrl, loadError]);

  const handleSelectAspect = (aspect: EditSettings['cropAspect']) => {
    const newSettings: Partial<EditSettings> = { cropAspect: aspect };

    if (aspect === 'free') {
      const initialRect =
        settings.freeCropRect && settings.freeCropRect.width > 0.05
          ? settings.freeCropRect
          : { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };
      newSettings.freeCropRect = initialRect;
    }

    if (!isEncodeMode && aspect !== 'original') {
      // Auto enable Encode Mode if user chooses a scaled/crop aspect ratio
      if (onToggleEncodeMode) {
        onToggleEncodeMode();
      }
      newSettings.encodeMode = true;
    }

    if (onUpdateSettings) {
      onUpdateSettings(newSettings);
    }
    setContextMenu(null);
  };

  // --- Interactive Dragging & Resizing Handles for Free Crop ---
  const handleMouseDownCrop = (e: React.MouseEvent, handle: DragHandle) => {
    e.preventDefault();
    e.stopPropagation();

    if (!videoWrapperRef.current) return;
    const rect = videoWrapperRef.current.getBoundingClientRect();

    dragInfoRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...currentCropRect },
      containerWidth: rect.width,
      containerHeight: rect.height,
    };

    setIsDraggingCrop(true);
  };

  useEffect(() => {
    if (!isDraggingCrop) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragInfoRef.current) return;

      const { handle, startX, startY, startRect, containerWidth, containerHeight } = dragInfoRef.current;
      const dx = (e.clientX - startX) / Math.max(10, containerWidth);
      const dy = (e.clientY - startY) / Math.max(10, containerHeight);

      let { x, y, width, height } = { ...startRect };
      const minSize = 0.1; // 10% min crop size

      if (handle === 'move') {
        x = Math.max(0, Math.min(1 - width, startRect.x + dx));
        y = Math.max(0, Math.min(1 - height, startRect.y + dy));
      } else {
        if (handle.includes('e')) {
          width = Math.max(minSize, Math.min(1 - x, startRect.width + dx));
        }
        if (handle.includes('s')) {
          height = Math.max(minSize, Math.min(1 - y, startRect.height + dy));
        }
        if (handle.includes('w')) {
          const maxLeftShift = startRect.x + startRect.width - minSize;
          const newX = Math.max(0, Math.min(maxLeftShift, startRect.x + dx));
          width = startRect.width + (startRect.x - newX);
          x = newX;
        }
        if (handle.includes('n')) {
          const maxTopShift = startRect.y + startRect.height - minSize;
          const newY = Math.max(0, Math.min(maxTopShift, startRect.y + dy));
          height = startRect.height + (startRect.y - newY);
          y = newY;
        }
      }

      if (onUpdateSettings) {
        onUpdateSettings({
          freeCropRect: {
            x: Math.max(0, Math.min(0.9, x)),
            y: Math.max(0, Math.min(0.9, y)),
            width: Math.max(minSize, Math.min(1, width)),
            height: Math.max(minSize, Math.min(1, height)),
          },
        });
      }
    };

    const handleMouseUp = () => {
      setIsDraggingCrop(false);
      dragInfoRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingCrop, onUpdateSettings]);

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-slate-950 flex flex-col items-center justify-center relative p-6 overflow-hidden select-none"
      style={{ containerType: 'size' }}
    >
      {!videoUrl && (!selectedFiles || selectedFiles.length === 0) ? (
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
          ref={videoWrapperRef}
          onContextMenu={handleContextMenu}
          className={`relative bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center transition-all duration-300`}
          style={getAspectStyle()}
        >
          {hasActiveClip && (videoUrl || (isEncodeMode && activeAudioClips && activeAudioClips.length > 0)) ? (
            <>
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className={`transition-all duration-200 ${
                    isScalingActive && !isFreeCropActive
                      ? 'w-full h-full object-cover'
                      : 'max-h-full max-w-full object-contain'
                  }`}
                  style={{
                    filter: getCssFilter(),
                    transform: getTransform(),
                  }}
                  onTimeUpdate={() => {
                    if (videoRef.current && isPlaying && hasActiveClip) {
                      const mappedTime =
                        mediaOffset + (videoRef.current.currentTime - (sourceStartTime || 0));
                      onTimeUpdate(mappedTime);
                    }
                  }}
                  onLoadedMetadata={(e) => {
                    const video = e.target as HTMLVideoElement;
                    const dur = video.duration;
                    if (!isNaN(dur) && dur > 0) {
                      onDurationLoaded(dur);
                    }
                    const initialLocal = Math.max(0, (sourceStartTime || 0) + (currentTime - mediaOffset));
                    if (initialLocal > 0) {
                      video.currentTime = initialLocal;
                    } else if (video.currentTime === 0) {
                      video.currentTime = 0.001;
                    }
                  }}
                  onError={handleVideoError}
                  onEnded={() => onTogglePlay()}
                  playsInline
                  preload="auto"
                  muted={isEncodeMode || settings.muteAudio}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full w-full bg-slate-900 text-slate-500">
                  <Film className="w-12 h-12 mb-2 opacity-30" />
                  <span className="text-sm font-medium opacity-50">Audio Only</span>
                </div>
              )}

              {isEncodeMode && activeAudioClips?.map((clip, idx) => (
                <AudioTrack
                  key={clip.id}
                  clip={clip}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  playbackRate={settings.speed}
                  volume={settings.muteAudio ? 0 : settings.volume}
                  isMasterTimekeeper={!videoUrl && idx === 0}
                  onTimeUpdate={onTimeUpdate}
                />
              ))}

              {/* --- Interactive Free Crop Box with Drag Handles --- */}
              {isFreeCropActive && (
                <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
                  {/* Darkened Mask Overlays outside active crop rectangle */}
                  <div
                    className="absolute bg-black/60 backdrop-blur-[0.5px]"
                    style={{ top: 0, left: 0, right: 0, height: `${currentCropRect.y * 100}%` }}
                  />
                  <div
                    className="absolute bg-black/60 backdrop-blur-[0.5px]"
                    style={{
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: `${Math.max(0, (1 - (currentCropRect.y + currentCropRect.height)) * 100)}%`,
                    }}
                  />
                  <div
                    className="absolute bg-black/60 backdrop-blur-[0.5px]"
                    style={{
                      top: `${currentCropRect.y * 100}%`,
                      bottom: `${Math.max(0, (1 - (currentCropRect.y + currentCropRect.height)) * 100)}%`,
                      left: 0,
                      width: `${currentCropRect.x * 100}%`,
                    }}
                  />
                  <div
                    className="absolute bg-black/60 backdrop-blur-[0.5px]"
                    style={{
                      top: `${currentCropRect.y * 100}%`,
                      bottom: `${Math.max(0, (1 - (currentCropRect.y + currentCropRect.height)) * 100)}%`,
                      right: 0,
                      width: `${Math.max(0, (1 - (currentCropRect.x + currentCropRect.width)) * 100)}%`,
                    }}
                  />

                  {/* Active Crop Box Window */}
                  <div
                    className="absolute border-2 border-violet-400 shadow-[0_0_15px_rgba(167,139,250,0.5)] pointer-events-auto"
                    style={{
                      top: `${currentCropRect.y * 100}%`,
                      left: `${currentCropRect.x * 100}%`,
                      width: `${currentCropRect.width * 100}%`,
                      height: `${currentCropRect.height * 100}%`,
                    }}
                  >
                    {/* Center Move Area */}
                    <div
                      onMouseDown={(e) => handleMouseDownCrop(e, 'move')}
                      className="absolute inset-3 cursor-move flex items-center justify-center group/center"
                      title="Drag to reposition crop box"
                    >
                      <div className="p-1.5 rounded-full bg-slate-900/80 text-violet-300 border border-violet-400/40 opacity-0 group-hover/center:opacity-100 transition shadow-lg flex items-center space-x-1 text-[10px]">
                        <Move className="w-3.5 h-3.5" />
                        <span>Move</span>
                      </div>
                    </div>

                    {/* Corner Resize Handles */}
                    <div
                      onMouseDown={(e) => handleMouseDownCrop(e, 'nw')}
                      className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-violet-600 rounded-sm shadow-md cursor-nwse-resize hover:scale-125 transition"
                      title="Resize Top-Left"
                    />
                    <div
                      onMouseDown={(e) => handleMouseDownCrop(e, 'ne')}
                      className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-violet-600 rounded-sm shadow-md cursor-nesw-resize hover:scale-125 transition"
                      title="Resize Top-Right"
                    />
                    <div
                      onMouseDown={(e) => handleMouseDownCrop(e, 'sw')}
                      className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-violet-600 rounded-sm shadow-md cursor-nesw-resize hover:scale-125 transition"
                      title="Resize Bottom-Left"
                    />
                    <div
                      onMouseDown={(e) => handleMouseDownCrop(e, 'se')}
                      className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-violet-600 rounded-sm shadow-md cursor-nwse-resize hover:scale-125 transition"
                      title="Resize Bottom-Right"
                    />

                    {/* Edge Resize Handles */}
                    <div
                      onMouseDown={(e) => handleMouseDownCrop(e, 'n')}
                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-2.5 bg-violet-300 border border-violet-700 rounded shadow cursor-ns-resize hover:scale-110 transition"
                      title="Resize Top"
                    />
                    <div
                      onMouseDown={(e) => handleMouseDownCrop(e, 's')}
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-2.5 bg-violet-300 border border-violet-700 rounded shadow cursor-ns-resize hover:scale-110 transition"
                      title="Resize Bottom"
                    />
                    <div
                      onMouseDown={(e) => handleMouseDownCrop(e, 'w')}
                      className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2.5 h-6 bg-violet-300 border border-violet-700 rounded shadow cursor-ew-resize hover:scale-110 transition"
                      title="Resize Left"
                    />
                    <div
                      onMouseDown={(e) => handleMouseDownCrop(e, 'e')}
                      className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2.5 h-6 bg-violet-300 border border-violet-700 rounded shadow cursor-ew-resize hover:scale-110 transition"
                      title="Resize Right"
                    />

                    {/* Floating Quick Action Badge on Crop Box */}
                    <div className="absolute -top-8 left-0 flex items-center space-x-1.5 bg-slate-900/90 backdrop-blur-md border border-violet-400/50 text-violet-200 text-[10px] font-mono px-2 py-0.5 rounded-md shadow-lg pointer-events-auto">
                      <Crop className="w-3 h-3 text-violet-400" />
                      <span>
                        {Math.round(currentCropRect.width * 100)}% × {Math.round(currentCropRect.height * 100)}%
                      </span>
                      <button
                        onClick={() => {
                          if (onUpdateSettings) {
                            onUpdateSettings({
                              freeCropRect: { x: 0, y: 0, width: 1, height: 1 },
                            });
                          }
                        }}
                        className="ml-1 p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                        title="Reset to 100% Full Frame"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
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
            </>
          ) : null}

          {/* Floating play/pause overlay button on click (Hidden during crop drag) */}
          {!isFreeCropActive && (
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
          )}
        </div>
      )}

      {/* Right-Click Popup Context Menu for Aspect Ratio / Scale (Only rendered in Encode Mode) */}
      {isEncodeMode && contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[260px] bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-xl p-2 text-slate-200 animate-in fade-in zoom-in-95 duration-150"
          style={{
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Aspect Ratio Options List */}
          <div className="flex flex-col gap-0.5 max-h-[300px] overflow-y-auto">
            {ASPECT_OPTIONS.map((option) => {
              const isOriginal = option.id === 'original';
              if (isEncodeMode && isOriginal) return null;

              const isSelected = effectiveAspect === option.id;
              const isActive = isEncodeMode && isSelected;

              return (
                <button
                  key={option.id}
                  onClick={() => handleSelectAspect(option.id)}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between text-xs transition cursor-pointer ${
                    isActive
                      ? 'bg-violet-500/20 text-violet-200 font-medium border border-violet-500/40 shadow-sm'
                      : !isEncodeMode && !isOriginal
                      ? 'hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-transparent'
                      : 'hover:bg-slate-800/80 text-slate-300 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <span
                      className={`p-1 rounded ${
                        isActive
                          ? 'bg-violet-500/30 text-violet-300'
                          : !isEncodeMode && !isOriginal
                          ? 'bg-slate-800/70 text-slate-500'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {option.icon}
                    </span>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-semibold text-xs text-slate-200">{option.label}</span>
                      {!isEncodeMode && !isOriginal && (
                        <span className="text-[9px] text-amber-400/80 font-normal">
                          (Encode Mode)
                        </span>
                      )}
                    </div>
                  </div>
                  {isActive && <Check className="w-3.5 h-3.5 text-violet-400 shrink-0 ml-2" />}
                  {!isEncodeMode && !isOriginal && (
                    <Lock className="w-3 h-3 text-slate-500 shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

