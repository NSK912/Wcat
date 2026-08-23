import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  EditSettings,
  TimelineTrackData,
  TimelineClip,
  ClipTransform,
  MediaType,
  TrackColor,
} from '../types';
import {
  Play,
  Pause,
  AlertTriangle,
  RefreshCw,
  Check,
  Monitor,
  Tv,
  Square,
  Smartphone,
  Film,
  RotateCcw,
  Lock,
  Crop,
  Move,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Sliders,
  Image as ImageIcon,
  Video as VideoIcon,
  X,
  Target,
  RotateCw,
  ArrowUpLeft,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowDownRight,
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
  tracks?: TimelineTrackData[];
  onUpdateClipTransform?: (trackId: string, clipId: string, transform: ClipTransform) => void;
  selectedClipId?: string | null;
  onSelectClipId?: (clipId: string | null) => void;
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

interface ActiveLayerItem {
  trackId: string;
  trackName: string;
  trackColor: TrackColor;
  trackIndex: number;
  clip: TimelineClip;
  mediaType: 'video' | 'image';
  url: string;
  transform: ClipTransform;
  muted: boolean;
  locked: boolean;
  volume: number;
}

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
        audioRef.current.play().catch((err) => console.warn('Audio play failed:', err));
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

// Layer Video Player Component for Multi-Track Playback in Encode Mode
const LayerVideoElement: React.FC<{
  layer: ActiveLayerItem;
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  filterStyle?: string;
  isMaster?: boolean;
  onTimeUpdate?: (time: number) => void;
  onDurationLoaded?: (dur: number) => void;
}> = ({ layer, currentTime, isPlaying, playbackRate, filterStyle, isMaster, onTimeUpdate, onDurationLoaded }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
      videoRef.current.volume = layer.muted ? 0 : layer.volume;
      videoRef.current.muted = layer.muted;
    }
  }, [playbackRate, layer.muted, layer.volume]);

  useEffect(() => {
    if (videoRef.current) {
      const targetTime = Math.max(0, (layer.clip.sourceStartTime || 0) + (currentTime - layer.clip.startTime));
      if (!isPlaying) {
        if (Math.abs(videoRef.current.currentTime - targetTime) > 0.005) {
          videoRef.current.currentTime = targetTime;
        }
      } else {
        if (Math.abs(videoRef.current.currentTime - targetTime) > 0.25) {
          videoRef.current.currentTime = targetTime;
        }
      }
    }
  }, [currentTime, layer.clip.startTime, layer.clip.sourceStartTime, isPlaying]);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch((err) => console.warn('Layer video playback paused:', err));
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, layer.url]);

  return (
    <video
      ref={videoRef}
      src={layer.url}
      playsInline
      preload="auto"
      muted={layer.muted}
      className="w-full h-auto max-w-none block pointer-events-none select-none rounded shadow-md object-cover"
      style={{
        filter: [filterStyle, layer.transform.blur ? `blur(${layer.transform.blur}px)` : ''].filter(Boolean).join(' ') || undefined,
        opacity: layer.transform.opacity ?? 1,
      }}
      onTimeUpdate={() => {
        if (isMaster && videoRef.current && isPlaying && onTimeUpdate) {
          const mappedTime = layer.clip.startTime + (videoRef.current.currentTime - (layer.clip.sourceStartTime || 0));
          onTimeUpdate(mappedTime);
        }
      }}
      onLoadedMetadata={(e) => {
        const v = e.target as HTMLVideoElement;
        if (isMaster && onDurationLoaded && v.duration > 0) {
          onDurationLoaded(v.duration);
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
  videoName,
  tracks = [],
  onUpdateClipTransform,
  selectedClipId: propSelectedClipId,
  onSelectClipId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoWrapperRef = useRef<HTMLDivElement>(null);
  const singleVideoRef = useRef<HTMLVideoElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Selected layer for direct manipulation (drag & transform)
  const [localSelectedClipId, setLocalSelectedClipId] = useState<string | null>(null);
  const selectedClipId = propSelectedClipId !== undefined ? propSelectedClipId : localSelectedClipId;
  const setSelectedClipId = useCallback(
    (id: string | null) => {
      setLocalSelectedClipId(id);
      onSelectClipId?.(id);
    },
    [onSelectClipId]
  );
  const [isDraggingLayer, setIsDraggingLayer] = useState<boolean>(false);
  const [isResizingLayerCorner, setIsResizingLayerCorner] = useState<string | null>(null);
  const layerDragStateRef = useRef<{
    clipId: string;
    trackId: string;
    startX: number;
    startY: number;
    initialTransform: ClipTransform;
    containerWidth: number;
    containerHeight: number;
  } | null>(null);

  // File URL Cache to prevent redundant object URLs
  const fileUrlCacheRef = useRef<Map<File, string>>(new Map());
  const getFileUrl = useCallback((file?: File): string => {
    if (!file) return '';
    let existing = fileUrlCacheRef.current.get(file);
    if (!existing) {
      existing = URL.createObjectURL(file);
      fileUrlCacheRef.current.set(file, existing);
    }
    return existing;
  }, []);

  const effectiveAspect = isEncodeMode
    ? (!settings.cropAspect || settings.cropAspect === 'original' ? '16:9' : settings.cropAspect)
    : 'original';

  const isFreeCropActive = Boolean(isEncodeMode && effectiveAspect === 'free');
  const isScalingActive = Boolean(isEncodeMode && effectiveAspect !== 'original');
  const currentCropRect = settings.freeCropRect || { x: 0, y: 0, width: 1, height: 1 };

  // Dragging state for free crop
  const [isDraggingCrop, setIsDraggingCrop] = useState<boolean>(false);
  const [isAlignMenuOpen, setIsAlignMenuOpen] = useState<boolean>(false);
  const alignMenuRef = useRef<HTMLDivElement>(null);
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
      setSelectedClipId(null);
      setIsAlignMenuOpen(false);
    }
  }, [isEncodeMode]);

  // Handle outside clicks to close context menu and align menu
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
      if (alignMenuRef.current && !alignMenuRef.current.contains(e.target as Node)) {
        setIsAlignMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setSelectedClipId(null);
        setIsAlignMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

  // Compute global transform
  const getGlobalTransform = () => {
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

  // =========================================================================
  // 🎛️ ACTIVE VISUAL LAYERS RESOLUTION (ENCODE MODE)
  // =========================================================================
  const activeLayers: ActiveLayerItem[] = useMemo(() => {
    if (!isEncodeMode || !tracks || tracks.length === 0) return [];

    const list: ActiveLayerItem[] = [];

    tracks.forEach((track, trackIdx) => {
      if (track.hidden) return;

      // Find clip on this track at current time
      const match = track.clips.find(
        (c) => c.startTime <= currentTime && currentTime <= c.endTime
      );

      if (!match) return;

      const isVideo =
        match.mediaType === 'video' ||
        (match.file && (match.file.type.startsWith('video/') || /\.(mp4|mkv|mov|webm|avi|flv)$/i.test(match.file.name)));

      const isImage =
        match.mediaType === 'image' ||
        (match.file && (match.file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(match.file.name)));

      if (!isVideo && !isImage) return;

      const url = match.previewUrl || (match.file ? getFileUrl(match.file) : '');
      if (!url) return;

      // Default transform if none set:
      // Track 1 (base layer): center full frame 1.0
      // Track 2+ (overlay layers): default nice overlay scale (e.g. 0.4) centered
      const defaultTransform: ClipTransform = {
        x: 50,
        y: 50,
        scale: trackIdx === 0 ? 1.0 : 0.45,
        rotation: 0,
        opacity: 1,
      };

      list.push({
        trackId: track.id,
        trackName: track.name,
        trackColor: track.color,
        trackIndex: trackIdx,
        clip: match,
        mediaType: isVideo ? 'video' : 'image',
        url,
        transform: match.transform ? { ...defaultTransform, ...match.transform } : defaultTransform,
        muted: track.muted || settings.muteAudio,
        locked: !!track.locked,
        volume: track.volume ?? 1,
      });
    });

    return list;
  }, [isEncodeMode, tracks, currentTime, settings.muteAudio, getFileUrl]);

  // Selected layer item reference
  const activeSelectedLayer = useMemo(() => {
    return activeLayers.find((l) => l.clip.id === selectedClipId) || null;
  }, [activeLayers, selectedClipId]);

  // =========================================================================
  // 🖐️ DIRECT DRAG & DROP FOR PREVIEW LAYERS (drag and drop supported)
  // =========================================================================
  const handlePointerDownLayer = (
    e: React.PointerEvent,
    layer: ActiveLayerItem,
    corner?: string
  ) => {
    if (!isEncodeMode) return;
    e.preventDefault();
    e.stopPropagation();

    setSelectedClipId(layer.clip.id);

    if (layer.locked) {
      layerDragStateRef.current = null;
      return;
    }

    if (!videoWrapperRef.current) return;
    const rect = videoWrapperRef.current.getBoundingClientRect();

    layerDragStateRef.current = {
      clipId: layer.clip.id,
      trackId: layer.trackId,
      startX: e.clientX,
      startY: e.clientY,
      initialTransform: { ...layer.transform },
      containerWidth: rect.width,
      containerHeight: rect.height,
    };

    if (corner) {
      setIsResizingLayerCorner(corner);
    } else {
      setIsDraggingLayer(true);
    }
  };

  useEffect(() => {
    if (!isDraggingLayer && !isResizingLayerCorner) return;

    const handlePointerMove = (e: MouseEvent) => {
      if (!layerDragStateRef.current) return;
      const {
        clipId,
        trackId,
        startX,
        startY,
        initialTransform,
        containerWidth,
        containerHeight,
      } = layerDragStateRef.current;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      if (isDraggingLayer) {
        // Calculate new X & Y position in container percentage
        const pctX = (deltaX / Math.max(10, containerWidth)) * 100;
        const pctY = (deltaY / Math.max(10, containerHeight)) * 100;

        const newX = Math.max(-20, Math.min(120, Math.round((initialTransform.x + pctX) * 10) / 10));
        const newY = Math.max(-20, Math.min(120, Math.round((initialTransform.y + pctY) * 10) / 10));

        if (onUpdateClipTransform) {
          onUpdateClipTransform(trackId, clipId, {
            ...initialTransform,
            x: newX,
            y: newY,
          });
        }
      } else if (isResizingLayerCorner) {
        // Determine directional multiplier based on the corner being dragged
        let dirX = 1;
        let dirY = 1;
        if (isResizingLayerCorner === 'nw') {
          dirX = -1;
          dirY = -1;
        } else if (isResizingLayerCorner === 'ne') {
          dirX = 1;
          dirY = -1;
        } else if (isResizingLayerCorner === 'sw') {
          dirX = -1;
          dirY = 1;
        } else if (isResizingLayerCorner === 'se') {
          dirX = 1;
          dirY = 1;
        }

        // Account for layer rotation if any
        const rotRad = ((initialTransform.rotation || 0) * Math.PI) / 180;
        const cos = Math.cos(rotRad);
        const sin = Math.sin(rotRad);

        // Vector from center outward along corner
        const rotatedDirX = dirX * cos - dirY * sin;
        const rotatedDirY = dirX * sin + dirY * cos;

        // Project mouse displacement onto the outward corner axis
        const projectedDelta = (deltaX * rotatedDirX + deltaY * rotatedDirY) / Math.SQRT2;
        
        // Base sensitivity on container width for smooth responsive scaling
        const sensitivity = Math.max(120, containerWidth * 0.35);
        const scaleChange = projectedDelta / sensitivity;
        const newScale = Math.max(
          0.05,
          Math.min(4.0, Math.round((initialTransform.scale + scaleChange) * 100) / 100)
        );

        if (onUpdateClipTransform) {
          onUpdateClipTransform(trackId, clipId, {
            ...initialTransform,
            scale: newScale,
          });
        }
      }
    };

    const handlePointerUp = () => {
      setIsDraggingLayer(false);
      setIsResizingLayerCorner(null);
      layerDragStateRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDraggingLayer, isResizingLayerCorner, onUpdateClipTransform]);

  // Corner & Position Alignment calculation helper for encode preview box
  const handleAlignLayer = (
    position: 'tl' | 'tr' | 'bl' | 'br' | 'tc' | 'bc' | 'lc' | 'rc' | 'center',
    customScale?: number
  ) => {
    if (!activeSelectedLayer || !onUpdateClipTransform) return;
    const currentScale = customScale ?? activeSelectedLayer.transform.scale;

    const wrapper = videoWrapperRef.current;
    const layerEl = wrapper?.querySelector(`[data-layer-id="${activeSelectedLayer.clip.id}"]`) as HTMLElement | null;

    let halfWPct = (currentScale * 100) / 2;
    let halfHPct = (currentScale * 100 * 0.5625) / 2;

    if (wrapper && layerEl) {
      const wrapperRect = wrapper.getBoundingClientRect();
      const unscaledW = layerEl.offsetWidth;
      const unscaledH = layerEl.offsetHeight;

      if (wrapperRect.width > 0 && wrapperRect.height > 0 && unscaledW > 0 && unscaledH > 0) {
        const visualWPx = unscaledW * currentScale;
        const visualHPx = unscaledH * currentScale;
        halfWPct = (visualWPx / 2 / wrapperRect.width) * 100;
        halfHPct = (visualHPx / 2 / wrapperRect.height) * 100;
      }
    }

    // Neat margin from the edge of the preview container (e.g. 1.0%)
    const margin = 1.0;

    let targetX = 50;
    let targetY = 50;

    switch (position) {
      case 'tl': // Top-Left corner 
        targetX = halfWPct + margin;
        targetY = halfHPct + margin;
        break;
      case 'tr': // Top-Right corner 
        targetX = 100 - (halfWPct + margin);
        targetY = halfHPct + margin;
        break;
      case 'bl': // Bottom-Left corner 
        targetX = halfWPct + margin;
        targetY = 100 - (halfHPct + margin);
        break;
      case 'br': // Bottom-Right corner 
        targetX = 100 - (halfWPct + margin);
        targetY = 100 - (halfHPct + margin);
        break;
      case 'tc': // Top-Center 
        targetX = 50;
        targetY = halfHPct + margin;
        break;
      case 'bc': // Bottom-Center 
        targetX = 50;
        targetY = 100 - (halfHPct + margin);
        break;
      case 'lc': // Left-Center 
        targetX = halfWPct + margin;
        targetY = 50;
        break;
      case 'rc': // Right-Center 
        targetX = 100 - (halfWPct + margin);
        targetY = 50;
        break;
      case 'center': // Center 
      default:
        targetX = 50;
        targetY = 50;
        break;
    }

    // Clamp within container boundaries so layer never overflows
    if (halfWPct * 2 < 100) {
      targetX = Math.max(halfWPct + margin, Math.min(100 - (halfWPct + margin), targetX));
    }
    if (halfHPct * 2 < 100) {
      targetY = Math.max(halfHPct + margin, Math.min(100 - (halfHPct + margin), targetY));
    }

    onUpdateClipTransform(activeSelectedLayer.trackId, activeSelectedLayer.clip.id, {
      ...activeSelectedLayer.transform,
      x: Math.round(targetX * 10) / 10,
      y: Math.round(targetY * 10) / 10,
      ...(customScale !== undefined ? { scale: customScale } : {}),
    });
  };

  // Single video player event handlers for Copy Mode / standard playback
  useEffect(() => {
    if (!isEncodeMode || activeLayers.length === 0) {
      if (singleVideoRef.current) {
        if (isPlaying && hasActiveClip && videoUrl && !loadError) {
          singleVideoRef.current.play().catch((err) => console.warn('Playback paused:', err));
        } else {
          singleVideoRef.current.pause();
        }
      }
    }
  }, [isPlaying, videoUrl, loadError, hasActiveClip, isEncodeMode, activeLayers.length]);

  useEffect(() => {
    if (!isEncodeMode || activeLayers.length === 0) {
      if (singleVideoRef.current && hasActiveClip && videoUrl) {
        const localTarget = Math.max(0, sourceStartTime + (currentTime - mediaOffset));
        if (!isPlaying) {
          if (Math.abs(singleVideoRef.current.currentTime - localTarget) > 0.005) {
            singleVideoRef.current.currentTime = localTarget;
          }
        } else {
          if (Math.abs(singleVideoRef.current.currentTime - localTarget) > 0.25) {
            singleVideoRef.current.currentTime = localTarget;
          }
        }
      }
    }
  }, [currentTime, mediaOffset, sourceStartTime, hasActiveClip, videoUrl, isPlaying, isEncodeMode, activeLayers.length]);

  useEffect(() => {
    if (singleVideoRef.current) {
      singleVideoRef.current.playbackRate = settings.speed;
      singleVideoRef.current.volume = settings.muteAudio ? 0 : settings.volume;
      singleVideoRef.current.muted = isEncodeMode || settings.muteAudio;
    }
  }, [settings.speed, settings.volume, settings.muteAudio, isEncodeMode]);

  // Right-click context menu handler (Aspect ratio picker)
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!isEncodeMode || !videoUrl || loadError) return;

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
      if (onToggleEncodeMode) onToggleEncodeMode();
      newSettings.encodeMode = true;
    }

    if (onUpdateSettings) onUpdateSettings(newSettings);
    setContextMenu(null);
  };

  // Free Crop mouse handlers
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
      const minSize = 0.1;

      if (handle === 'move') {
        x = Math.max(0, Math.min(1 - width, startRect.x + dx));
        y = Math.max(0, Math.min(1 - height, startRect.y + dy));
      } else {
        if (handle.includes('e')) width = Math.max(minSize, Math.min(1 - x, startRect.width + dx));
        if (handle.includes('s')) height = Math.max(minSize, Math.min(1 - y, startRect.height + dy));
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

  const hasLayers = isEncodeMode && activeLayers.length > 0;

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-slate-950 flex flex-col items-center justify-center relative p-6 overflow-hidden select-none"
      style={{ containerType: 'size' }}
      onClick={(e) => {
        // Deselect layer when clicking outside preview box
        if (e.target === containerRef.current) {
          setSelectedClipId(null);
        }
      }}
    >
      {!videoUrl && (!selectedFiles || selectedFiles.length === 0) && (!tracks || tracks.every((t) => t.clips.length === 0)) ? (
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
            ver 3.5.0.5
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
                if (singleVideoRef.current) singleVideoRef.current.load();
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
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => {
            if (e.target === videoWrapperRef.current) {
              setSelectedClipId(null);
            }
          }}
          id="canvas-container"
          className="relative bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center transition-all duration-300 select-none"
          style={getAspectStyle()}
        >
          {/* ================================================================= */}
          {/* 🔴 ENCODE MODE: MULTI-TRACK LAYER COMPOSITOR (DRAGGABLE LAYERS)   */}
          {/* ================================================================= */}
          {hasLayers ? (
            <div className="relative w-full h-full overflow-hidden bg-black">
              {activeLayers.map((layer, idx) => {
                const isSelected = selectedClipId === layer.clip.id;
                // STRICT TRACK ORDER HIERARCHY:
                // Layer z-index strictly follows the timeline track order:
                // Track 1 (Index 0) -> z-index 10 (base)
                // Track 2 (Index 1) -> z-index 20 (overlay)
                // Track 3 (Index 2) -> z-index 30 (top overlay)
                // Selection NEVER elevates lower tracks above higher tracks!
                const layerZIndex = (layer.trackIndex + 1) * 10;

                return (
                  <div
                    key={layer.clip.id}
                    data-layer-id={layer.clip.id}
                    onPointerDown={(e) => handlePointerDownLayer(e, layer)}
                    className={`absolute transition-shadow ${
                      layer.locked ? 'cursor-default' : 'cursor-move'
                    } ${
                      isSelected
                        ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-black shadow-2xl'
                        : 'hover:ring-1 hover:ring-white/40'
                    }`}
                    style={{
                      left: `${layer.transform.x}%`,
                      top: `${layer.transform.y}%`,
                      transform: `translate(-50%, -50%) scale(${layer.transform.scale}) rotate(${layer.transform.rotation || 0}deg)`,
                      transformOrigin: 'center center',
                      zIndex: layerZIndex,
                      width: '100%',
                    }}
                  >
                    {/* Layer Media Render */}
                    {layer.mediaType === 'image' ? (
                      <img
                        src={layer.url}
                        alt={layer.clip.name}
                        className="w-full h-auto max-w-none block pointer-events-none select-none rounded shadow-md object-contain"
                        style={{
                          filter: [getCssFilter(), layer.transform.blur ? `blur(${layer.transform.blur}px)` : ''].filter(Boolean).join(' ') || undefined,
                          opacity: layer.transform.opacity ?? 1,
                        }}
                      />
                    ) : (
                      <LayerVideoElement
                        layer={layer}
                        currentTime={currentTime}
                        isPlaying={isPlaying}
                        playbackRate={settings.speed}
                        filterStyle={getCssFilter()}
                        isMaster={idx === 0}
                        onTimeUpdate={onTimeUpdate}
                        onDurationLoaded={onDurationLoaded}
                      />
                    )}

                    {/* Active Layer Bounding Frame & Corner Drag Handles */}
                    {isSelected && (
                      <div className="absolute inset-0 pointer-events-none border-2 border-violet-400 rounded">
                        {/* Top Badge showing Track Name and Clip Name */}
                        <div
                          className="absolute -top-7 left-0 flex items-center space-x-1.5 bg-slate-900/95 border border-violet-400/80 text-violet-200 text-[10px] font-medium px-2 py-0.5 rounded shadow-lg backdrop-blur-md pointer-events-auto whitespace-nowrap"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          {layer.locked ? (
                            <Lock className="w-3 h-3 text-amber-400" />
                          ) : layer.mediaType === 'video' ? (
                            <VideoIcon className="w-3 h-3 text-violet-400" />
                          ) : (
                            <ImageIcon className="w-3 h-3 text-emerald-400" />
                          )}
                          <span className="font-semibold text-white">{layer.trackName}:</span>
                          <span className="max-w-[120px] truncate">{layer.clip.name}</span>
                          <span className="text-slate-400 text-[9px]">({Math.round(layer.transform.scale * 100)}%)</span>
                          {layer.locked && (
                            <span className="text-amber-400 text-[9px] font-semibold">(Locked)</span>
                          )}
                          <button
                            onClick={() => setSelectedClipId(null)}
                            className="ml-1 p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                            title="Deselect"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>

                        {/* Top-Left Corner Handle (Resize/Scale) - Only when unlocked */}
                        {!layer.locked && (
                          <>
                            <div
                              onPointerDown={(e) => handlePointerDownLayer(e, layer, 'nw')}
                              className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-violet-600 rounded-sm shadow-md cursor-nwse-resize hover:scale-125 transition pointer-events-auto touch-none"
                              title="Drag to resize / scale layer (Top-Left)"
                            />
                            {/* Top-Right Corner Handle */}
                            <div
                              onPointerDown={(e) => handlePointerDownLayer(e, layer, 'ne')}
                              className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-violet-600 rounded-sm shadow-md cursor-nesw-resize hover:scale-125 transition pointer-events-auto touch-none"
                              title="Drag to resize / scale layer (Top-Right)"
                            />
                            {/* Bottom-Left Corner Handle */}
                            <div
                              onPointerDown={(e) => handlePointerDownLayer(e, layer, 'sw')}
                              className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-violet-600 rounded-sm shadow-md cursor-nesw-resize hover:scale-125 transition pointer-events-auto touch-none"
                              title="Drag to resize / scale layer (Bottom-Left)"
                            />
                            {/* Bottom-Right Corner Handle */}
                            <div
                              onPointerDown={(e) => handlePointerDownLayer(e, layer, 'se')}
                              className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-violet-600 rounded-sm shadow-md cursor-nwse-resize hover:scale-125 transition pointer-events-auto touch-none"
                              title="Drag to resize / scale layer (Bottom-Right)"
                            />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Audio tracks for all non-video audio clips */}
              {activeAudioClips?.map((clip, idx) => (
                <AudioTrack
                  key={clip.id}
                  clip={clip}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  playbackRate={settings.speed}
                  volume={settings.muteAudio ? 0 : settings.volume}
                  isMasterTimekeeper={false}
                  onTimeUpdate={onTimeUpdate}
                />
              ))}
            </div>
          ) : hasActiveClip && (videoUrl || (isEncodeMode && activeAudioClips && activeAudioClips.length > 0)) ? (
            /* =============================================================== */
            /* 🔵 SINGLE MEDIA PLAYBACK (COPY MODE OR SINGLE CLIP)              */
            /* =============================================================== */
            <>
              {videoUrl ? (
                isEncodeMode && videoName && /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(videoName) ? (
                  <img
                    src={videoUrl}
                    alt={videoName}
                    className={`transition-all duration-200 ${
                      isScalingActive && !isFreeCropActive
                        ? 'w-full h-full object-cover'
                        : 'max-h-full max-w-full object-contain'
                    }`}
                    style={{
                      filter: getCssFilter(),
                      transform: getGlobalTransform(),
                    }}
                  />
                ) : (
                  <video
                    ref={singleVideoRef}
                    src={videoUrl}
                    className={`transition-all duration-200 ${
                      isScalingActive && !isFreeCropActive
                        ? 'w-full h-full object-cover'
                        : 'max-h-full max-w-full object-contain'
                    }`}
                    style={{
                      filter: getCssFilter(),
                      transform: getGlobalTransform(),
                    }}
                    onTimeUpdate={() => {
                      if (singleVideoRef.current && isPlaying && hasActiveClip) {
                        const mappedTime =
                          mediaOffset + (singleVideoRef.current.currentTime - (sourceStartTime || 0));
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
                    onError={() => setLoadError('Video format not supported natively in browser preview')}
                    onEnded={() => onTogglePlay()}
                    playsInline
                    preload="auto"
                    muted={isEncodeMode || settings.muteAudio}
                  />
                )
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
            </>
          ) : null}

          {/* Interactive Free Crop Box with Drag Handles */}
          {isFreeCropActive && (
            <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
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

              <div
                className="absolute border-2 border-violet-400 shadow-[0_0_15px_rgba(167,139,250,0.5)] pointer-events-auto"
                style={{
                  top: `${currentCropRect.y * 100}%`,
                  left: `${currentCropRect.x * 100}%`,
                  width: `${currentCropRect.width * 100}%`,
                  height: `${currentCropRect.height * 100}%`,
                }}
              >
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

                <div
                  onMouseDown={(e) => handleMouseDownCrop(e, 'n')}
                  className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-2.5 bg-violet-300 border border-violet-700 rounded shadow cursor-ns-resize hover:scale-110 transition"
                />
                <div
                  onMouseDown={(e) => handleMouseDownCrop(e, 's')}
                  className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-2.5 bg-violet-300 border border-violet-700 rounded shadow cursor-ns-resize hover:scale-110 transition"
                />
                <div
                  onMouseDown={(e) => handleMouseDownCrop(e, 'w')}
                  className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2.5 h-6 bg-violet-300 border border-violet-700 rounded shadow cursor-ew-resize hover:scale-110 transition"
                />
                <div
                  onMouseDown={(e) => handleMouseDownCrop(e, 'e')}
                  className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2.5 h-6 bg-violet-300 border border-violet-700 rounded shadow cursor-ew-resize hover:scale-110 transition"
                />

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

          {/* Watermark Overlay */}
          {settings.watermarkText && (
            <div
              className="absolute pointer-events-none font-bold drop-shadow-md px-3 py-1 rounded bg-black/40 backdrop-blur-xs z-30"
              style={{
                ...getWatermarkPositionStyle(),
                color: settings.watermarkColor || '#ffffff',
                fontSize: `${settings.watermarkSize}px`,
              }}
            >
              {settings.watermarkText}
            </div>
          )}

          {/* Floating play/pause overlay trigger (Only when not dragging layers or crop, and hidden in encode mode) */}
          {!isFreeCropActive && !isDraggingLayer && !isResizingLayerCorner && !isEncodeMode && (
            <div
              onClick={() => {
                if (singleVideoRef.current && !hasLayers) {
                  if (isPlaying) singleVideoRef.current.pause();
                  else singleVideoRef.current.play().catch(console.error);
                }
                onTogglePlay();
              }}
              className={`absolute inset-0 flex items-center justify-center transition cursor-pointer group pointer-events-auto ${
                isPlaying ? 'opacity-0 hover:opacity-100 bg-black/20' : 'opacity-100 bg-black/30'
              }`}
              style={{ zIndex: 5 }}
            >
              <div className="h-9 w-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 border border-white/10 transform group-hover:scale-110 transition">
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Right-Click Popup Context Menu for Aspect Ratio (Encode Mode) */}
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
