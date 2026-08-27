import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { EditSettings, ActiveTab, SampleVideo, TimelineTrackData, TimelineClip, ClipTransform } from './types';
import { SAMPLE_VIDEOS } from './utils/sampleVideos';
import { Input, BlobSource, ALL_FORMATS } from 'mediabunny';
import { processNativeConcatStream, processNativeTrimStream, processNativeRemuxStream } from './utils/WEngine';
import {
  processWebCodecsEncodeStream,
  processWebCodecsConcatStream,
  isWebCodecsSupported,
} from './utils/WebCodecsEngine';
import { VideoPlayer } from './components/VideoPlayer';
import { Timeline } from './components/Timeline';
import { ProcessingModal } from './components/ProcessingModal';
import { SampleModal } from './components/SampleModal';
import { Dropdown } from './components/Dropdown';
import {
  Zap,
  Cpu,
  Sparkles,
  Info,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Monitor,
  Smartphone,
  Square,
  Tv,
  Film,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Target,
  ArrowUpLeft,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Sliders,
  Check,
} from 'lucide-react';

const DEFAULT_SETTINGS: EditSettings = {
  startTime: 0,
  endTime: 0,
  duration: 0,
  filter: 'none',
  brightness: 1.0,
  contrast: 1.0,
  speed: 1.0,
  rotation: 0,
  flipH: false,
  flipV: false,
  cropAspect: 'original',
  freeCropRect: { x: 0, y: 0, width: 1, height: 1 },
  watermarkText: '',
  watermarkPosition: 'bottom-right',
  watermarkColor: '#ffffff',
  watermarkSize: 24,
  volume: 1.0,
  muteAudio: false,
  outputFormat: 'mp4',
  encodeMode: false,
  videoCodec: 'av1',
  audioCodec: 'opus',
  audioBitrate: 192,
  videoQuality: 'high',
  resolution: '1080',
  encodeSpeed: 'ultra-fast',
  fps: 60,
};

const getFileDuration = async (file: File): Promise<number> => {
  if (file.type.startsWith('image/')) {
    return 5;
  }

  // 1. Try Mediabunny WebCodecs demuxer first (100% accurate for MKV, MP4, WebM, TS, AVI, etc.)
  try {
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const vTracks = await input.getVideoTracks();
    if (vTracks.length > 0) {
      const dur = await vTracks[0].computeDuration();
      if (dur && Number.isFinite(dur) && dur > 0) {
        return dur;
      }
    }
    const aTracks = await input.getAudioTracks();
    if (aTracks.length > 0) {
      const dur = await aTracks[0].computeDuration();
      if (dur && Number.isFinite(dur) && dur > 0) {
        return dur;
      }
    }
  } catch (e) {
    console.warn('Mediabunny duration probe fallback to HTML5 video', e);
  }

  // 2. HTML5 <video> element fallback with timeout safeguard
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    video.src = url;

    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(0); // 0 means full length (do not artificially cap at 10 or 15)
    }, 2000);

    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      const dur = video.duration;
      URL.revokeObjectURL(url);
      if (dur && Number.isFinite(dur) && dur > 0) {
        resolve(dur);
      } else {
        resolve(0);
      }
    };
    video.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve(0);
    };
  });
};

const INITIAL_TIMELINE_TRACKS: TimelineTrackData[] = [
  {
    id: 'track-1',
    name: 'Track 1',
    mediaType: 'any',
    color: 'indigo',
    clips: [],
    muted: false,
    locked: false,
    hidden: false,
  },
  {
    id: 'track-2',
    name: 'Track 2',
    mediaType: 'any',
    color: 'violet',
    clips: [],
    muted: false,
    locked: false,
    hidden: false,
  },
];

export default function App() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string>('');
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('trim');
  const [settings, setSettings] = useState<EditSettings>(DEFAULT_SETTINGS);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isEncodeMode, setIsEncodeMode] = useState<boolean>(false);
  const [isLeftPanelExpanded, setIsLeftPanelExpanded] = useState<boolean>(window.innerWidth >= 1200);
  const [isRightPanelExpanded, setIsRightPanelExpanded] = useState<boolean>(window.innerWidth >= 1200);
  const [isCustomFpsMode, setIsCustomFpsMode] = useState<boolean>(false);
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [holdHint, setHoldHint] = useState<boolean>(false);
  const holdRafRef = useRef<number | null>(null);
  const holdStartTimeRef = useRef<number>(0);
  const hintTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1200) {
        setIsLeftPanelExpanded(false);
        setIsRightPanelExpanded(false);
      }
    };
    window.addEventListener('resize', handleResize);
    // Initial check
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleOpenEncodeMode = useCallback(() => {
    setIsEncodeMode(true);
    setSettings((prev) => ({
      ...prev,
      encodeMode: true,
      cropAspect: (prev.cropAspect === 'original' || !prev.cropAspect) ? '16:9' : prev.cropAspect,
    }));
  }, []);

  const handleCloseEncodeMode = useCallback(() => {
    if (holdRafRef.current) {
      cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
    setHoldProgress(0);
    setHoldHint(false);
    setIsEncodeMode(false);
    setIsCustomFpsMode(false);
    setSettings((prev) => ({
      ...prev,
      encodeMode: false,
      cropAspect: 'original',
      freeCropRect: { x: 0, y: 0, width: 1, height: 1 },
      filter: 'none',
      brightness: 1.0,
      contrast: 1.0,
      speed: 1.0,
      rotation: 0,
      flipH: false,
      flipV: false,
      watermarkText: '',
      muteAudio: false,
      fps: 60,
      audioCodec: 'opus',
      audioBitrate: 192,
    }));
  }, []);

  const startHoldToClose = useCallback((e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (holdRafRef.current) {
      cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
    const startTime = performance.now();
    holdStartTimeRef.current = startTime;
    const duration = 1200; // 1.2s smooth hold duration

    const updateFrame = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(100, (elapsed / duration) * 100);
      setHoldProgress(progress);

      if (progress >= 100) {
        if (holdRafRef.current) {
          cancelAnimationFrame(holdRafRef.current);
          holdRafRef.current = null;
        }
        handleCloseEncodeMode();
      } else {
        holdRafRef.current = requestAnimationFrame(updateFrame);
      }
    };

    holdRafRef.current = requestAnimationFrame(updateFrame);
  }, [handleCloseEncodeMode]);

  const cancelHoldToClose = useCallback((wasClick: boolean = false) => {
    if (holdRafRef.current) {
      cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
    const elapsed = performance.now() - holdStartTimeRef.current;
    setHoldProgress(0);

    if (wasClick && elapsed < 900 && isEncodeMode) {
      setHoldHint(true);
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
      hintTimeoutRef.current = setTimeout(() => {
        setHoldHint(false);
      }, 2500);
    }
  }, [isEncodeMode]);

  const fileUrlCache = useRef<Map<string, string>>(new Map());

  const getOrCreateFileUrl = useCallback((file: File): string => {
    const key = `${file.name}_${file.size}_${file.lastModified}`;
    let url = fileUrlCache.current.get(key);
    if (!url) {
      url = URL.createObjectURL(file);
      fileUrlCache.current.set(key, url);
    }
    return url;
  }, []);

  // Modals
  const [isSampleModalOpen, setIsSampleModalOpen] = useState<boolean>(false);
  const [isProcessingModalOpen, setIsProcessingModalOpen] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [isProcessingComplete, setIsProcessingComplete] = useState<boolean>(false);
  const [processingMessage, setProcessingMessage] = useState<string>('');
  const [processingLogs, setProcessingLogs] = useState<string[]>([]);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputFilename, setOutputFilename] = useState<string>('output.mp4');
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [mediaOffset, setMediaOffset] = useState<number>(0);
  const [sourceStartTime, setSourceStartTime] = useState<number>(0);
  const [clipEndTime, setClipEndTime] = useState<number>(0);
  const [hasActiveClip, setHasActiveClip] = useState<boolean>(false);
  const [activeAudioClips, setActiveAudioClips] = useState<{ id: string; url: string; startTime: number; sourceStartTime: number }[]>([]);
  const [tracks, setTracks] = useState<TimelineTrackData[]>(INITIAL_TIMELINE_TRACKS);

  const handleUpdateClipTransform = useCallback(
    (trackId: string, clipId: string, transform: ClipTransform) => {
      setTracks((prev) =>
        prev.map((t) => {
          if (t.id !== trackId) return t;
          return {
            ...t,
            clips: t.clips.map((c) => {
              if (c.id !== clipId) return c;
              return {
                ...c,
                transform: {
                  ...(c.transform || {}),
                  ...transform,
                },
              };
            }),
          };
        })
      );
    },
    []
  );

  // Selected clip/layer in Encode Mode
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // All sub-layers across all tracks for layertool sub-layer selector
  const allSubLayers = useMemo(() => {
    if (!isEncodeMode || !tracks || tracks.length === 0) return [];
    const list: {
      trackId: string;
      trackName: string;
      subLayerName: string;
      trackColor: string;
      trackIndex: number;
      clipIndex: number;
      clip: TimelineClip;
      isActive: boolean;
      transform: ClipTransform;
    }[] = [];

    tracks.forEach((track, trackIdx) => {
      if (track.hidden) return;
      const clips = track.clips || [];

      // Sort visual clips chronologically by startTime
      const visualClips = clips
        .filter((c) => {
          const isVid =
            c.mediaType === 'video' ||
            (c.file && (c.file.type.startsWith('video/') || /\.(mp4|mkv|mov|webm|avi|flv)$/i.test(c.file.name)));
          const isImg =
            c.mediaType === 'image' ||
            (c.file && (c.file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(c.file.name)));
          return isVid || isImg;
        })
        .slice()
        .sort((a, b) => a.startTime - b.startTime);

      visualClips.forEach((clip, seqIdx) => {
        const rawClipIdx = clips.findIndex((c) => c.id === clip.id);
        const isActive = currentTime >= clip.startTime && currentTime <= clip.endTime;
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
          subLayerName: `Layer ${trackIdx + 1}-${seqIdx + 1}`,
          trackColor: track.color,
          trackIndex: trackIdx,
          clipIndex: rawClipIdx,
          clip,
          isActive,
          transform: clip.transform ? { ...defaultTransform, ...clip.transform } : defaultTransform,
        });
      });
    });

    // Sort by Track 1, 2, 3, 4 ascending (Track 1 top -> Track 2 -> Track 3 -> Track 4)
    // For same track, sort chronologically by startTime
    return list.sort((a, b) => {
      if (a.trackIndex !== b.trackIndex) {
        return a.trackIndex - b.trackIndex;
      }
      return a.clip.startTime - b.clip.startTime;
    });
  }, [isEncodeMode, tracks, currentTime]);

  // Active layers currently visible on preview screen
  const activeLayers = useMemo(() => {
    return allSubLayers.filter((l) => l.isActive);
  }, [allSubLayers]);

  // Auto-select top active layer on screen when currentTime moves or previous selection ends
  useEffect(() => {
    if (!isEncodeMode) return;
    if (activeLayers.length === 0) return;
    const isSelectedActive = activeLayers.some((l) => l.clip.id === selectedClipId);
    if (!isSelectedActive) {
      // Auto-select the top-most active layer on screen
      setSelectedClipId(activeLayers[0].clip.id);
    }
  }, [isEncodeMode, activeLayers, selectedClipId]);

  const activeSelectedLayer = useMemo(() => {
    if (allSubLayers.length === 0) return null;
    const found = allSubLayers.find((l) => l.clip.id === selectedClipId);
    if (found) return found;
    if (activeLayers.length > 0) return activeLayers[0];
    return allSubLayers[0];
  }, [allSubLayers, activeLayers, selectedClipId]);

  const handleAlignLayer = (
    position: 'tl' | 'tr' | 'bl' | 'br' | 'tc' | 'bc' | 'lc' | 'rc' | 'center',
    customScale?: number
  ) => {
    if (!activeSelectedLayer) return;
    const currentScale = customScale ?? activeSelectedLayer.transform.scale;
    const margin = 1.0;
    let targetX = 50;
    let targetY = 50;

    const halfWPct = (currentScale * 100) / 2;
    let halfHPct = (currentScale * 100 * 0.5625) / 2;

    const container = document.getElementById('canvas-container');
    const layerEl = document.querySelector(`[data-layer-id="${activeSelectedLayer.clip.id}"]`);
    if (container && layerEl) {
      const containerRect = container.getBoundingClientRect();
      const Rc = containerRect.height > 0 ? containerRect.width / containerRect.height : 16 / 9;
      
      const mediaEl = layerEl.querySelector('img, video');
      if (mediaEl) {
        let Rm = 16 / 9;
        if (mediaEl.tagName === 'IMG') {
          const img = mediaEl as HTMLImageElement;
          if (img.naturalWidth && img.naturalHeight) {
            Rm = img.naturalWidth / img.naturalHeight;
          }
        } else if (mediaEl.tagName === 'VIDEO') {
          const vid = mediaEl as HTMLVideoElement;
          if (vid.videoWidth && vid.videoHeight) {
            Rm = vid.videoWidth / vid.videoHeight;
          }
        }
        halfHPct = (Rc / Rm) * currentScale * 50;
      }
    }

    switch (position) {
      case 'tl':
        targetX = halfWPct + margin;
        targetY = halfHPct + margin;
        break;
      case 'tr':
        targetX = 100 - (halfWPct + margin);
        targetY = halfHPct + margin;
        break;
      case 'bl':
        targetX = halfWPct + margin;
        targetY = 100 - (halfHPct + margin);
        break;
      case 'br':
        targetX = 100 - (halfWPct + margin);
        targetY = 100 - (halfHPct + margin);
        break;
      case 'tc':
        targetX = 50;
        targetY = halfHPct + margin;
        break;
      case 'bc':
        targetX = 50;
        targetY = 100 - (halfHPct + margin);
        break;
      case 'lc':
        targetX = halfWPct + margin;
        targetY = 50;
        break;
      case 'rc':
        targetX = 100 - (halfWPct + margin);
        targetY = 50;
        break;
      case 'center':
      default:
        targetX = 50;
        targetY = 50;
        break;
    }

    if (halfWPct * 2 < 100) {
      targetX = Math.max(halfWPct + margin, Math.min(100 - (halfWPct + margin), targetX));
    }
    if (halfHPct * 2 < 100) {
      targetY = Math.max(halfHPct + margin, Math.min(100 - (halfHPct + margin), targetY));
    }

    handleUpdateClipTransform(activeSelectedLayer.trackId, activeSelectedLayer.clip.id, {
      ...activeSelectedLayer.transform,
      x: Math.round(targetX * 10) / 10,
      y: Math.round(targetY * 10) / 10,
      ...(customScale !== undefined ? { scale: customScale } : {}),
    });
  };

  const singleFileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);

  // Master timeline playback clock to advance across blank gaps and when no video element is active
  useEffect(() => {
    if (!isPlaying) return;
    const isImage = isEncodeMode && videoName && /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(videoName);
    if (hasActiveClip && videoUrl && !isImage) return; // Active video element drives time updates with exact frame/audio sync

    let lastTime = performance.now();
    let animId: number;

    const tick = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      setCurrentTime((prev) => {
        const speed = settings.speed || 1;
        const next = prev + delta * speed;
        const max = duration > 0 ? duration : 10;
        if (next >= max) {
          setIsPlaying(false);
          return max;
        }
        return next;
      });

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, duration, settings.speed, hasActiveClip, videoUrl, isEncodeMode, videoName]);

  // Prevent right click context menu globally
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  // Generate video preview thumbnails dynamically based on video duration
  useEffect(() => {
    if (!videoUrl || !duration) {
      setThumbnails([]);
      return;
    }
    let isCancelled = false;
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.preload = 'metadata';

    const thumbs: string[] = [];
    const count = Math.min(12, Math.max(5, Math.floor(duration / 3)));
    let currentIdx = 0;

    video.onerror = () => {
      // Gracefully ignore preview thumbnail failures
    };

    video.onloadedmetadata = () => {
      if (isCancelled) return;
      const step = duration / count;

      const captureNext = () => {
        if (isCancelled) return;
        if (currentIdx >= count) {
          setThumbnails(thumbs);
          return;
        }
        const targetTime = (currentIdx + 0.5) * step;
        video.currentTime = Math.min(Math.max(0, targetTime), duration - 0.05);
      };

      video.onseeked = () => {
        if (isCancelled) return;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 160;
          canvas.height = 90;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            thumbs.push(canvas.toDataURL('image/jpeg', 0.7));
          }
        } catch {
          // Ignore cross-origin canvas security exceptions
        }
        currentIdx++;
        captureNext();
      };

      captureNext();
    };

    return () => {
      isCancelled = true;
      video.src = '';
      video.load();
    };
  }, [videoUrl, duration]);

  const handleSingleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFiles([file]);
      const url = getOrCreateFileUrl(file);
      const dur = await getFileDuration(file);
      setVideoUrl(url);
      setVideoName(file.name);
      setDuration(dur);
      if (outputUrl) {
        try { URL.revokeObjectURL(outputUrl); } catch {}
      }
      setOutputUrl(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setSettings((prev) => ({
        ...prev,
        duration: dur,
        startTime: 0,
        endTime: dur,
      }));
    }
    e.target.value = '';
  };

  const handleMultiFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileArr: File[] = Array.from(files);
      setSelectedFiles(fileArr);

      // Probe all files in parallel to get their true durations
      const durations = await Promise.all(fileArr.map((f) => getFileDuration(f)));
      const totalDur = durations.reduce((acc, d) => acc + d, 0);

      const firstFile = fileArr[0];
      const url = getOrCreateFileUrl(firstFile);
      setVideoUrl(url);
      setVideoName(fileArr.length === 1 ? firstFile.name : `${fileArr.length} files selected`);
      setDuration(totalDur > 0 ? totalDur : durations[0]);

      if (outputUrl) {
        try { URL.revokeObjectURL(outputUrl); } catch {}
      }
      setOutputUrl(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setSettings((prev) => ({
        ...prev,
        duration: totalDur > 0 ? totalDur : durations[0],
        startTime: 0,
        endTime: totalDur > 0 ? totalDur : durations[0],
      }));
    }
    e.target.value = '';
  };

  const handleFilesReorder = useCallback((newFiles: File[]) => {
    setSelectedFiles(newFiles);
    if (newFiles.length > 0) {
      const url = getOrCreateFileUrl(newFiles[0]);
      setVideoUrl((prev) => (prev !== url ? url : prev));
      setVideoName(newFiles.length === 1 ? newFiles[0].name : `${newFiles.length} files selected`);
      setOutputUrl(null);
    }
  }, [getOrCreateFileUrl]);

  const handleSelectFile = useCallback(
    (
      file: File | null,
      clipStartTime: number = 0,
      _clipDuration: number = 0,
      clipSourceStart: number = 0,
      clipEnd: number = 0,
      audioClips: { id: string; file: File; startTime: number; sourceStartTime: number }[] = []
    ) => {
      if (!file && audioClips.length === 0) {
        setHasActiveClip((prev) => (prev ? false : prev));
        setVideoUrl((prev) => (prev !== null ? null : prev));
        setMediaOffset((prev) => (prev !== 0 ? 0 : prev));
        setSourceStartTime((prev) => (prev !== 0 ? 0 : prev));
        setClipEndTime((prev) => (prev !== 0 ? 0 : prev));
        setActiveAudioClips((prev) => (prev.length === 0 ? prev : []));
        return;
      }
      const url = file ? getOrCreateFileUrl(file) : null;
      setHasActiveClip((prev) => (!prev ? true : prev));
      setVideoUrl((prev) => (prev !== url ? url : prev));
      setVideoName((prev) => (file && prev !== file.name ? file.name : prev));
      setMediaOffset((prev) => (prev !== clipStartTime ? clipStartTime : prev));
      setSourceStartTime((prev) => (prev !== clipSourceStart ? clipSourceStart : prev));
      setClipEndTime((prev) => (prev !== clipEnd ? clipEnd : prev));

      const aClips = audioClips.map((c) => ({
        id: c.id,
        url: getOrCreateFileUrl(c.file),
        startTime: c.startTime,
        sourceStartTime: c.sourceStartTime,
      }));
      setActiveAudioClips((prev) => {
        if (
          prev.length === aClips.length &&
          prev.every(
            (p, i) =>
              p.id === aClips[i].id &&
              p.url === aClips[i].url &&
              Math.abs(p.startTime - aClips[i].startTime) < 0.001 &&
              Math.abs(p.sourceStartTime - aClips[i].sourceStartTime) < 0.001
          )
        ) {
          return prev;
        }
        return aClips;
      });
    },
    [getOrCreateFileUrl]
  );

  const handleSelectSample = async (sample: SampleVideo) => {
    try {
      const response = await fetch(sample.url);
      const blob = await response.blob();
      const file = new File([blob], `${sample.name.replace(/\s+/g, '_')}.mp4`, { type: 'video/mp4' });
      setSelectedFiles([file]);
      const blobUrl = getOrCreateFileUrl(file);
      setVideoUrl(blobUrl);
    } catch {
      setSelectedFiles([]);
      setVideoUrl(sample.url);
    }
    setVideoName(sample.name);
    setDuration(sample.duration);
    setSettings((prev) => ({
      ...prev,
      startTime: 0,
      endTime: sample.duration,
      duration: sample.duration,
    }));
    setOutputUrl(null);
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleDurationLoaded = (dur: number) => {
    if (dur > 0 && (selectedFiles.length <= 1 || duration === 0)) {
      setDuration(dur);
      setSettings((prev) => {
        const isDefaultOrPreset = prev.endTime === 0 || prev.endTime === 10 || prev.endTime === 15 || Math.abs(prev.endTime - prev.duration) < 0.1;
        return {
          ...prev,
          duration: dur,
          startTime: prev.startTime || 0,
          endTime: isDefaultOrPreset ? dur : prev.endTime,
        };
      });
    }
  };

  const updateSettings = (newSettings: Partial<EditSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleReset = () => {
    setSelectedFiles([]);
    setSettings({
      ...DEFAULT_SETTINGS,
      duration,
      endTime: duration || 10,
    });
    setOutputUrl(null);
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn(`Fullscreen error: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Run FFmpeg Export Process
  const handleExport = async (tracks?: any[]) => {
    if (!videoUrl) return;

    // 1. Prompt user to choose destination folder & file name before starting export/remux
    let fileHandle: any = null;
    const detectedExt = (videoName ? videoName.split('.').pop()?.toLowerCase() : 'mp4') || 'mp4';
    const sourceExt = ['mp4', 'mkv', 'webm', 'ts', 'mov', 'm4v'].includes(detectedExt) ? detectedExt : 'mp4';

    const baseName = videoName ? videoName.split('.')[0] : 'video';
    let defaultOutputName = '';
    if (isEncodeMode) {
      const isMulti = (tracks && tracks.some(t => !t.hidden && t.clips.length > 0)) || selectedFiles.length > 1;
      defaultOutputName = isMulti ? `encoded_project.${sourceExt}` : `encoded_${baseName}.${sourceExt}`;
    } else {
      defaultOutputName = selectedFiles.length > 1 ? `merged_output.${sourceExt}` : `trimmed_${baseName}.${sourceExt}`;
    }

    if ('showSaveFilePicker' in window) {
      try {
        fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: defaultOutputName,
          types: [
            {
              description: 'MP4 Video (.mp4)',
              accept: { 'video/mp4': ['.mp4'] },
            },
            {
              description: 'Matroska Video (.mkv)',
              accept: { 'video/x-matroska': ['.mkv'] },
            },
            {
              description: 'WebM Video (.webm)',
              accept: { 'video/webm': ['.webm'] },
            },
            {
              description: 'MPEG-TS Video (.ts)',
              accept: { 'video/mp2t': ['.ts'] },
            },
          ],
        });
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('Export cancelled by user (Save picker closed)');
          return; // Abort export cleanly if user cancels folder/file picker
        }
        console.warn('showSaveFilePicker error/fallback:', err);
        
        (window as any).alert('⚠️ Unable to open "Save File Picker".\n\nReason: You are using the app inside an iframe/preview window with restricted file access permissions, or your browser does not support the File System Access API.\n\n💡 Solution: Click "Open in New Tab" in the top right corner to run the app directly and enable direct-to-disk streaming.');
        
        const proceed = (window as any).confirm('Do you want to continue using fallback memory storage mode?\n(This will process in a temporary memory buffer or virtual storage)');
        if (!proceed) {
           return;
        }
      }
    } else {
       const proceed = (window as any).confirm('⚠️ Your browser does not support the Save File Picker.\n\nDo you want to continue with fallback storage mode?');
       if (!proceed) return;
    }

    const targetFilename = fileHandle ? fileHandle.name : defaultOutputName;
    setOutputFilename(targetFilename);

    setIsProcessingModalOpen(true);
    setProcessingProgress(0);
    setIsProcessingComplete(false);
    setProcessingLogs([]);
    
    // Revoke previous blob url if exists to free memory/cache
    if (outputUrl) {
      URL.revokeObjectURL(outputUrl);
    }
    setOutputUrl(null);
    setProcessingMessage('Initializing processing engine...');

    const addLog = (text: string) => {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
      const lines = text.split('\n');
      setProcessingLogs((prev) => [
        ...prev,
        ...lines.map((line) => `[${timeStr}] ${line}`)
      ]);
    };

    addLog(`Engine: Wcat Zero-RAM Hybrid Stream Engine`);
    addLog(`Target: ${targetFilename}`);

    try {
      const createPipelineStream = async (handle: FileSystemFileHandle | null, outName: string) => {
        let writable: FileSystemWritableFileStream | null = null;
        let opfsFileHandle: FileSystemFileHandle | null = null;

        if (handle) {
          try {
            writable = await handle.createWritable();
            addLog(`Direct disk output handle created: ${handle.name}`);
          } catch (e) {
            console.warn('FileHandle createWritable failed:', e);
            addLog(`Warning: Direct handle createWritable failed: ${e}`);
          }
        }

        if (!writable && typeof navigator !== 'undefined' && navigator.storage && navigator.storage.getDirectory) {
          try {
            const opfsRoot = await navigator.storage.getDirectory();
            const tempName = `opfs_stream_${Date.now()}_${outName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            opfsFileHandle = await opfsRoot.getFileHandle(tempName, { create: true });
            writable = await opfsFileHandle.createWritable();
            addLog(`Virtual OPFS temporary stream initialized: ${tempName}`);
          } catch (err) {
            console.warn('OPFS stream initialization error:', err);
            addLog(`Warning: OPFS stream init error: ${err}`);
          }
        }

        if (!writable) {
          addLog(`In-memory BufferTarget fallback engaged (No filesystem stream available)`);
        }

        return { writable, opfsFileHandle };
      };

      const allVisibleClips = tracks ? tracks.filter(t => !t.hidden).flatMap(t => t.clips || []) : [];
      const hasTimelineClips = allVisibleClips.length > 0;
      const hasMultipleClips = isEncodeMode
        ? (hasTimelineClips || selectedFiles.length > 1)
        : (allVisibleClips.length > 1 || selectedFiles.length > 1);
      const hasImageClips =
        allVisibleClips.some(c => c.mediaType === 'image' || (c.file && (c.file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(c.file.name)))) ||
        selectedFiles.some(f => f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(f.name));

      if (hasMultipleClips) {
        setProcessingMessage(`Streaming & merging ${allVisibleClips.length || selectedFiles.length} clips...`);
        addLog(`Initiating multi-clip concatenation (${allVisibleClips.length || selectedFiles.length} clips):`);
        if (allVisibleClips.length > 0) {
          allVisibleClips.forEach((c, idx) => {
            const clipDur = (c.endTime !== undefined && c.startTime !== undefined && c.endTime > c.startTime)
              ? c.endTime - c.startTime
              : c.duration || c.fileDuration || 0;
            addLog(`  [${idx + 1}] ${c.name || c.file?.name} (${c.mediaType || 'clip'}, start: ${(c.startTime || 0).toFixed(2)}s, dur: ${clipDur.toFixed(2)}s)`);
          });
        } else {
          selectedFiles.forEach((f, idx) => addLog(`  [${idx + 1}] ${f.name} (${(f.size / (1024 * 1024)).toFixed(2)} MB)`));
        }

        const { writable, opfsFileHandle } = await createPipelineStream(fileHandle, targetFilename);

        const hasVisualModifications =
          Boolean(settings.cropAspect && settings.cropAspect !== 'original') ||
          settings.filter !== 'none' ||
          settings.brightness !== 1.0 ||
          settings.contrast !== 1.0 ||
          settings.rotation !== 0 ||
          settings.flipH ||
          settings.flipV ||
          Boolean(settings.watermarkText?.trim()) ||
          settings.muteAudio;

        // When Encode Panel is closed (isEncodeMode is false), strictly use Lossless Fast Stream Copy
        const shouldUseEncodeMode = isEncodeMode ? true : hasImageClips;

        let result;
        // =====================================================================
        // 🔴 ENCODE MODE: MULTI-TRACK CONCATENATION (WITH RE-ENCODING)
        // =====================================================================
        if (shouldUseEncodeMode) {
          addLog(`[WebCodecs API] Hardware Accelerated Concatenation & Encoding Mode Initialized`);
          result = await processWebCodecsConcatStream(tracks && tracks.length > 0 ? tracks : selectedFiles, settings, writable, (prog) => {
            setProcessingProgress(prog.percentage / 100);
            setProcessingMessage(`${prog.statusText} - Speed: ${prog.speedMBs.toFixed(1)} MB/s`);
            if (prog.log) addLog(prog.log);
          });
        } 
        // =====================================================================
        // 🔵 COPY MODE: MULTI-TRACK CONCATENATION (FAST STREAM COPY)
        // =====================================================================
        else {
          result = await processNativeConcatStream(selectedFiles, writable, (prog) => {
            setProcessingProgress(prog.percentage / 100);
            setProcessingMessage(`${prog.statusText} - Speed: ${prog.speedMBs.toFixed(1)} MB/s`);
            if (prog.log) addLog(prog.log);
          });
        }

        if (writable) {
          try { await writable.close(); } catch {}
        }

        if (!result.success || result.totalBytesWritten === 0) {
          throw new Error('Failed to concatenate video files');
        }

        if (opfsFileHandle) {
          const diskFile = await opfsFileHandle.getFile();
          const url = URL.createObjectURL(diskFile);
          setOutputUrl(url);
          setProcessingMessage('Video concatenation completed successfully!');
          addLog(`Result saved to OPFS (${(diskFile.size / (1024 * 1024)).toFixed(2)} MB), ready for download.`);
        } else if (result.blobUrl) {
          setOutputUrl(result.blobUrl);
          setProcessingMessage('Video concatenation completed successfully!');
          addLog(`Result generated in memory buffer, ready for download.`);
        } else if (fileHandle) {
          setProcessingMessage(`Result saved directly to target file: ${fileHandle.name}`);
          addLog(`Result saved directly to target file: ${fileHandle.name}`);
        }

        setProcessingProgress(1.0);
        setIsProcessingComplete(true);
      } else {
        // Trim mode or Single file
        setProcessingMessage('Streaming video processing...');
        const { writable, opfsFileHandle } = await createPipelineStream(fileHandle, targetFilename);

        let inputFile: File;
        if (selectedFiles.length > 0) {
          inputFile = selectedFiles[0];
        } else {
          // Sample video fallback
          const sample = SAMPLE_VIDEOS.find(v => v.name === videoName) || SAMPLE_VIDEOS[0];
          const response = await fetch(sample.url);
          const blob = await response.blob();
          inputFile = new File([blob], `${sample.name}.mp4`, { type: 'video/mp4' });
        }

        let currentFileDuration = duration;
        if (currentFileDuration === 0) {
          currentFileDuration = await getFileDuration(inputFile);
        }

        let currentStart = settings.startTime || 0;
        // Check if the user explicitly trimmed the video (rather than leaving it at default settings duration)
        const isUserExplicitTrim =
          settings.endTime > 0 &&
          currentFileDuration > 0 &&
          settings.endTime < currentFileDuration - 0.1 &&
          (settings.duration > 0 && Math.abs(settings.endTime - settings.duration) > 0.1);

        const finalEndTime = isUserExplicitTrim ? settings.endTime : (currentFileDuration > 0 ? currentFileDuration : 0);
        const isFullLengthRemux = currentStart === 0 && (!isUserExplicitTrim || finalEndTime === 0 || finalEndTime >= currentFileDuration - 0.1);
        const hasVisualModifications =
          Boolean(settings.cropAspect && settings.cropAspect !== 'original') ||
          settings.filter !== 'none' ||
          settings.brightness !== 1.0 ||
          settings.contrast !== 1.0 ||
          settings.rotation !== 0 ||
          settings.flipH ||
          settings.flipV ||
          Boolean(settings.watermarkText?.trim()) ||
          settings.muteAudio;

        const isInputImage = inputFile.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(inputFile.name);
        // When Encode Panel is closed (isEncodeMode is false), strictly use Lossless Fast Stream Copy
        const shouldUseEncodeMode = isEncodeMode ? true : isInputImage;
        let result;

        // =====================================================================
        // 🔴 ENCODE MODE: SINGLE-TRACK / TRIM (WITH RE-ENCODING)
        // =====================================================================
        if (shouldUseEncodeMode) {
          const scaleInfo = (settings.cropAspect && settings.cropAspect !== 'original') ? `Scale: ${settings.cropAspect}, ` : '';
          addLog(`[WebCodecs API] Hardware Accelerated Re-Encoding Mode Activated (${scaleInfo}Codec: ${(settings.videoCodec || 'av1').toUpperCase()}, Quality: ${settings.videoQuality || 'high'})`);
          result = await processWebCodecsEncodeStream(
            inputFile,
            settings,
            writable,
            (prog) => {
              setProcessingProgress(prog.percentage / 100);
              setProcessingMessage(`${prog.statusText} - Speed: ${prog.speedMBs.toFixed(1)} MB/s`);
              if (prog.log) addLog(prog.log);
            }
          );
        } 
        // =====================================================================
        // 🔵 COPY MODE: SINGLE-TRACK FULL LENGTH (FAST NATIVE REMUX)
        // =====================================================================
        else if (isFullLengthRemux) {
          addLog(`Mode: Full length container repair / fast-start optimization for ${inputFile.name}`);
          result = await processNativeRemuxStream(
            inputFile,
            writable,
            (prog) => {
              setProcessingProgress(prog.percentage / 100);
              setProcessingMessage(`${prog.statusText} - Speed: ${prog.speedMBs.toFixed(1)} MB/s`);
              if (prog.log) addLog(prog.log);
            }
          );
        } 
        // =====================================================================
        // 🔵 COPY MODE: SINGLE-TRACK TRIM (FAST STREAM COPY)
        // =====================================================================
        else {
          addLog(`Mode: Precision Trim from ${currentStart.toFixed(2)}s to ${finalEndTime.toFixed(2)}s for ${inputFile.name}`);
          result = await processNativeTrimStream(
            inputFile,
            currentStart,
            finalEndTime,
            writable,
            (prog) => {
              setProcessingProgress(prog.percentage / 100);
              setProcessingMessage(`${prog.statusText} - Speed: ${prog.speedMBs.toFixed(1)} MB/s`);
              if (prog.log) addLog(prog.log);
            }
          );
        }

        if (writable) {
          try { await writable.close(); } catch {}
        }

        if (!result.success || result.totalBytesWritten === 0) {
          throw new Error('Failed to process video file');
        }

        if (opfsFileHandle) {
          const diskFile = await opfsFileHandle.getFile();
          const url = URL.createObjectURL(diskFile);
          setOutputUrl(url);
          setProcessingMessage('Video processing completed successfully!');
          addLog(`Result saved to OPFS (${(diskFile.size / (1024 * 1024)).toFixed(2)} MB), ready for download.`);
        } else if (result.blobUrl) {
          setOutputUrl(result.blobUrl);
          setProcessingMessage('Video processing completed successfully!');
          addLog(`Result generated in memory buffer, ready for download.`);
        } else if (fileHandle) {
          setProcessingMessage(`Result saved directly to target file: ${fileHandle.name}`);
          addLog(`Result saved directly to target file: ${fileHandle.name}`);
        }

        setProcessingProgress(1.0);
        setIsProcessingComplete(true);
      }
    } catch (err: any) {
      console.error('Video processing error:', err);
      addLog(`FATAL ERROR: ${err?.message || err}`);
      if (err?.stack) addLog(`Stack: ${err.stack}`);
      setProcessingMessage(`Error: ${err.message || 'Processing failed'}`);
      setIsProcessingComplete(true);
    }
  };

  const handleDownloadOutput = () => {
    if (!outputUrl) return;
    const a = document.createElement('a');
    a.href = outputUrl;
    a.download = outputFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex flex-col h-screen bg-[#030712] text-slate-100 font-sans overflow-hidden relative">
      {/* Background ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px]"></div>
      </div>

      {/* Hidden file input for Single File selection (1 file at a time) */}
      <input
        type="file"
        ref={singleFileInputRef}
        onChange={handleSingleFileUpload}
        accept="video/*,audio/*,image/*"
        className="hidden"
      />

      {/* Hidden file input for Multiple Files selection */}
      <input
        type="file"
        ref={multiFileInputRef}
        onChange={handleMultiFileUpload}
        accept="video/*,audio/*,image/*"
        multiple
        className="hidden"
      />





      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Left/Center: Video Player & Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden bg-black/20 backdrop-blur-sm">
          {/* Video Player Area with Floating Panel Encode (Stops right at the Timeline toolbar) */}
          <div className="relative flex-1 min-h-0 flex flex-col">
            {/* ================================================================= */}
            {/* 🎛️ ENCODE MODE / COPY MODE: PANEL TOGGLE & UI SETTINGS                 */}
            {/* ================================================================= */}
            {/* Left Floating Panel Encode (Expanded box when ON, or clean floating button when OFF) */}
            {isEncodeMode ? (
              <div
                className={`absolute top-3 bottom-3 z-40 transition-all duration-300 ease-in-out ${
                  isLeftPanelExpanded ? 'left-3' : '-left-[288px]'
                }`}
              >
                <div
                  id="panel-encode"
                  className="w-72 h-full flex flex-col items-stretch p-3 rounded-xl border backdrop-blur-md shadow-xl transition-all duration-200 pointer-events-auto bg-slate-950/95 border-violet-500/50 shadow-violet-500/10 relative overflow-hidden"
                >
                  {/* Header (Fixed at top, matching Layer Tool) */}
                  <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-white/10 shrink-0">
                    <div className="flex items-center space-x-1.5 text-violet-300 font-bold text-xs">
                      <Sliders className="w-4 h-4 text-violet-400" />
                      <span className="tracking-wide uppercase">Encode Settings</span>
                    </div>
                    <div className="flex items-center space-x-1.5 relative">
                      <button
                        id="encode-mode-toggle-btn"
                        onPointerDown={startHoldToClose}
                        onPointerUp={() => cancelHoldToClose(true)}
                        onPointerLeave={() => cancelHoldToClose(false)}
                        onPointerCancel={() => cancelHoldToClose(false)}
                        onContextMenu={(e) => e.preventDefault()}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide transition-all duration-200 border shadow-sm cursor-pointer select-none text-white relative overflow-hidden flex items-center justify-center ${
                          holdProgress > 0
                            ? 'bg-rose-950/90 border-rose-400/80 shadow-rose-500/30'
                            : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-violet-400/50 shadow-violet-500/25'
                        }`}
                        title="Hold to close and restore Copy Mode"
                      >
                        {/* Hold progress filling bar - zero latency sync with RAF */}
                        {holdProgress > 0 && (
                          <div
                            className="absolute inset-0 bg-gradient-to-r from-rose-600 to-amber-500 opacity-80"
                            style={{ width: `${holdProgress}%`, willChange: 'width' }}
                          />
                        )}
                        <span className="relative z-10 flex items-center justify-center font-medium pointer-events-none uppercase">
                          Close
                        </span>
                      </button>

                      {/* Hint tooltip if tapped quickly */}
                      {holdHint && (
                        <div className="absolute right-0 top-7 z-50 bg-slate-900/95 border border-violet-400/80 text-violet-200 text-[10px] font-sans px-2.5 py-1 rounded-lg shadow-xl animate-fadeIn pointer-events-none w-48 text-center leading-tight whitespace-nowrap">
                          Hold button to close
                        </div>
                      )}

                      <button onClick={() => setIsLeftPanelExpanded(false)} className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10" title="Fold panel">
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Top / Main area: Codec, Resolution & Quality Controls inside Panel Encode */}
                  <div className="flex-1 flex flex-col gap-2 text-xs animate-fadeIn min-w-0 pr-1 overflow-y-auto">
                    {/* VIDEO SECTION */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-slate-400 font-mono">Video Codec:</span>
                      <Dropdown
                        id="select-codec"
                        value={settings.videoCodec || 'av1'}
                        onChange={(val) => updateSettings({ videoCodec: val as any })}
                        options={[
                          { value: 'av1', label: 'AV1' },
                          { value: 'vp9', label: 'VP9' },
                        ]}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-slate-400 font-mono">Resolution:</span>
                      <Dropdown
                        id="select-resolution"
                        value={settings.resolution || '1080'}
                        onChange={(val) => updateSettings({ resolution: val as any })}
                        options={[
                          { value: '480', label: '480p' },
                          { value: '720', label: '720p' },
                          { value: '1080', label: '1080p (FHD)' },
                          { value: '2k', label: '2K (1440p)' },
                          { value: '4k', label: '4K (2160p)' },
                          { value: '8k', label: '8K (4320p)' },
                        ]}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-slate-400 font-mono">Video Quality:</span>
                      <Dropdown
                        id="select-quality"
                        value={settings.videoQuality || 'high'}
                        onChange={(val) => updateSettings({ videoQuality: val as any })}
                        options={[
                          { value: 'very-high', label: 'Very High' },
                          { value: 'high', label: 'High' },
                          { value: 'medium', label: 'Medium' },
                          { value: 'low', label: 'Low' },
                        ]}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-slate-400 font-mono">Speed:</span>
                      <Dropdown
                        id="select-speed"
                        value={settings.encodeSpeed || 'ultra-fast'}
                        onChange={(val) => updateSettings({ encodeSpeed: val as any })}
                        options={[
                          { value: 'ultra-fast', label: 'Ultra Fast (Hardware)' },
                          { value: 'fast', label: 'Fast' },
                          { value: 'medium', label: 'Medium (Balanced)' },
                          { value: 'slow', label: 'Slow (High Efficiency)' },
                        ]}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-slate-400 font-mono">Frame Rate (FPS):</span>
                      <Dropdown
                        id="select-fps"
                        value={isCustomFpsMode || ![30, 60, 120].includes(settings.fps || 60) ? 'custom' : String(settings.fps || 60)}
                        onChange={(val) => {
                          if (val === 'custom') {
                            setIsCustomFpsMode(true);
                            if ([30, 60, 120].includes(settings.fps || 60)) {
                              updateSettings({ fps: 24 });
                            }
                          } else {
                            setIsCustomFpsMode(false);
                            updateSettings({ fps: Number(val) });
                          }
                        }}
                        options={[
                          { value: '30', label: '30 fps (Standard)' },
                          { value: '60', label: '60 fps (Smooth)' },
                          { value: '120', label: '120 fps (Ultra High)' },
                          { value: 'custom', label: 'Custom Custom...' },
                        ]}
                      />

                      {(isCustomFpsMode || ![30, 60, 120].includes(settings.fps || 60)) && (
                        <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-slate-900/90 border border-violet-500/30 animate-fadeIn mt-0.5">
                          <div className="flex items-center gap-1.5">
                            <div className="relative flex-1 flex items-center">
                              <input
                                id="custom-fps-input"
                                type="number"
                                min="1"
                                max="240"
                                value={settings.fps || 60}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  if (!isNaN(val)) {
                                    updateSettings({ fps: Math.min(240, Math.max(1, val)) });
                                  }
                                }}
                                className="w-full bg-slate-950 text-white font-mono text-xs pl-2.5 pr-7 py-1.5 rounded border border-slate-700/80 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 focus:outline-none transition"
                                placeholder="e.g. 24, 48, 90, 144"
                              />
                              {/* Custom Themed Stepper Buttons */}
                              <div className="absolute right-1 flex flex-col items-center justify-center border-l border-slate-800 pl-0.5">
                                <button
                                  type="button"
                                  id="btn-fps-increment"
                                  onClick={() => updateSettings({ fps: Math.min(240, (settings.fps || 60) + 1) })}
                                  className="p-0.5 text-slate-400 hover:text-violet-300 hover:bg-violet-950/60 rounded transition cursor-pointer leading-none active:scale-90"
                                  title="Increase FPS (+1)"
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  id="btn-fps-decrement"
                                  onClick={() => updateSettings({ fps: Math.max(1, (settings.fps || 60) - 1) })}
                                  className="p-0.5 text-slate-400 hover:text-violet-300 hover:bg-violet-950/60 rounded transition cursor-pointer leading-none active:scale-90"
                                  title="Decrease FPS (-1)"
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono shrink-0">fps</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-slate-400 font-mono">Audio Codec:</span>
                      <Dropdown
                        id="select-audio-codec"
                        value={settings.audioCodec || 'opus'}
                        onChange={(val) => updateSettings({ audioCodec: val as any })}
                        options={[
                          { value: 'opus', label: 'Opus (WebM / Modern)' },
                          { value: 'flac', label: 'FLAC (Lossless Audio)' },
                          { value: 'pcm-s16', label: 'PCM 16-bit (Uncompressed)' },
                        ]}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-slate-400 font-mono">Audio Bitrate:</span>
                      <Dropdown
                        id="select-audio-bitrate"
                        value={String(settings.audioBitrate || 192)}
                        onChange={(val) => updateSettings({ audioBitrate: Number(val) })}
                        options={[
                          { value: '320', label: '320 kbps (Maximum / Studio)' },
                          { value: '256', label: '256 kbps (Very High)' },
                          { value: '192', label: '192 kbps (High Quality - Recommended)' },
                          { value: '128', label: '128 kbps (Standard)' },
                          { value: '96', label: '96 kbps (Voice / Compact)' },
                          { value: '64', label: '64 kbps (Low)' },
                        ]}
                      />
                    </div>
                  </div>
                </div>
                {!isLeftPanelExpanded && (
                  <button
                    onClick={() => setIsLeftPanelExpanded(true)}
                    className="absolute top-1/2 -translate-y-1/2 -right-5 w-5 h-16 bg-slate-950/90 border border-violet-500/50 border-l-0 rounded-r-lg flex items-center justify-center text-violet-400 hover:text-white hover:bg-slate-800 pointer-events-auto shadow-xl backdrop-blur-md transition-colors"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            ) : (
              <div className="absolute top-1/2 -translate-y-1/2 left-2 z-30 flex items-center justify-center w-8 h-32 pointer-events-auto">
                <button
                  id="encode-mode-toggle-btn"
                  onClick={handleOpenEncodeMode}
                  className="-rotate-90 whitespace-nowrap px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 border shadow-md cursor-pointer select-none origin-center bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700/70 backdrop-blur-md"
                  title="Open Panel Encode"
                >
                  <span>Panel Encode</span>
                </button>
              </div>
            )}

            {/* Right Floating Panel: layertool */}
            {isEncodeMode && (
              <div
                className={`absolute top-3 bottom-3 z-40 transition-all duration-300 ease-in-out ${
                  isRightPanelExpanded ? 'right-3' : '-right-[288px]'
                }`}
              >
                {!isRightPanelExpanded && (
                  <button
                    onClick={() => setIsRightPanelExpanded(true)}
                    className="absolute top-1/2 -translate-y-1/2 -left-5 w-5 h-16 bg-slate-950/90 border border-violet-500/50 border-r-0 rounded-l-lg flex items-center justify-center text-violet-400 hover:text-white hover:bg-slate-800 pointer-events-auto shadow-xl backdrop-blur-md transition-colors"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                )}
                <div
                  id="layertool"
                  className="w-72 h-full flex flex-col items-stretch p-3 rounded-xl border backdrop-blur-md shadow-xl transition-all duration-200 pointer-events-auto bg-slate-950/95 border-violet-500/50 shadow-violet-500/10 relative overflow-hidden"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-white/10 shrink-0">
                    <div className="flex items-center space-x-1.5 text-violet-300 font-bold text-xs">
                      <Layers className="w-4 h-4 text-violet-400" />
                      <span className="tracking-wide uppercase">Layer Tool</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {activeSelectedLayer && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-600/30 text-violet-300 border border-violet-500/40 font-mono font-bold">
                          {activeSelectedLayer.subLayerName}
                        </span>
                      )}
                      <button onClick={() => setIsRightPanelExpanded(false)} className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10" title="Fold panel">
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col gap-3 text-xs min-w-0 pr-0.5 overflow-y-auto">
                    {/* SECTION 1: Right click menu (Aspect Ratio & Canvas Presets) */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          Canvas Aspect Ratio
                        </span>
                        <span className="text-[10px] text-violet-400 font-mono font-medium">
                          {settings.cropAspect || '16:9'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: '16:9', label: '16:9 (Landscape)', icon: <Monitor className="w-3.5 h-3.5" /> },
                          { id: '9:16', label: '9:16 (Reels/TikTok)', icon: <Smartphone className="w-3.5 h-3.5 rotate-90" /> },
                          { id: '1:1', label: '1:1 (Square)', icon: <Square className="w-3.5 h-3.5" /> },
                          { id: '4:5', label: '4:5 (Instagram)', icon: <Smartphone className="w-3.5 h-3.5" /> },
                          { id: '4:3', label: '4:3 (Classic TV)', icon: <Tv className="w-3.5 h-3.5" /> },
                          { id: '21:9', label: '21:9 (Ultrawide)', icon: <Film className="w-3.5 h-3.5" /> },
                        ].map((option) => {
                          const isSelected = (settings.cropAspect || '16:9') === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => updateSettings({ cropAspect: option.id as any })}
                              className={`px-2 py-1.5 rounded-lg flex items-center justify-between text-[11px] transition cursor-pointer border ${
                                isSelected
                                  ? 'bg-violet-600/30 text-violet-200 border-violet-400/70 font-semibold shadow-sm shadow-violet-500/20'
                                  : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-white/5'
                              }`}
                            >
                              <div className="flex items-center space-x-1.5 truncate">
                                <span className={isSelected ? 'text-violet-300' : 'text-slate-400'}>
                                  {option.icon}
                                </span>
                                <span className="truncate">{option.label}</span>
                              </div>
                              {isSelected && <Check className="w-3 h-3 text-violet-400 shrink-0 ml-1" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* SECTION 2: Sub-Layers List */}
                    <div className="flex flex-col gap-1.5 pt-2 border-t border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          Sub-Layers ({allSubLayers.length})
                        </span>
                      </div>

                      {allSubLayers.length > 0 ? (
                        <div className="flex flex-col gap-2.5 max-h-48 overflow-y-auto pr-0.5 custom-scrollbar">
                          {Array.from(new Set<number>(allSubLayers.map((l) => l.trackIndex)))
                            .sort((a: number, b: number) => a - b)
                            .map((tIdx: number) => {
                              const trackSubLayers = allSubLayers.filter((l) => l.trackIndex === tIdx);
                              const tName = trackSubLayers[0]?.trackName || `Track ${tIdx + 1}`;
                              return (
                                <div key={tIdx} className="flex flex-col gap-1">
                                  <div className="flex items-center justify-between px-0.5">
                                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                                      {tName} ({trackSubLayers.length})
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {trackSubLayers.map((l) => {
                                      const isSelected = activeSelectedLayer?.clip.id === l.clip.id;
                                      return (
                                        <button
                                          key={l.clip.id}
                                          type="button"
                                          onClick={() => {
                                            setSelectedClipId(l.clip.id);
                                            if (!l.isActive) {
                                              setCurrentTime(l.clip.startTime);
                                            }
                                          }}
                                          className={`p-1.5 rounded-lg flex flex-col items-start text-left transition cursor-pointer border relative overflow-hidden ${
                                            isSelected
                                              ? 'bg-violet-600/35 border-violet-400 text-white shadow-sm shadow-violet-500/20'
                                              : 'bg-slate-900/90 hover:bg-slate-800/90 text-slate-300 border-white/5'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between w-full gap-1">
                                            <span className="font-mono font-bold text-[10px] text-violet-300 truncate">
                                              {l.subLayerName}
                                            </span>
                                          </div>
                                          <span className="text-[9px] text-slate-400 truncate w-full">
                                            {l.clip.name || l.clip.file?.name || l.trackName}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-500 italic p-2 bg-slate-900/40 rounded-lg border border-white/5 text-center">
                          No layers in timeline
                        </div>
                      )}
                    </div>

                    {/* SECTION 3: Layer Controls */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          Layer Controls
                        </span>
                        {activeSelectedLayer && (
                          <span className="text-[10px] text-violet-300 font-mono font-bold">
                            {activeSelectedLayer.subLayerName}
                          </span>
                        )}
                      </div>

                      {activeSelectedLayer ? (
                        <div className="flex flex-col gap-2.5 bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                          {/* Scale Controls */}
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 font-mono">Scale:</span>
                              <span className="text-[10px] text-violet-300 font-mono font-semibold">
                                {Math.round(activeSelectedLayer.transform.scale * 100)}%
                              </span>
                            </div>

                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const nextScale = Math.max(0.1, Math.round((activeSelectedLayer.transform.scale - 0.1) * 10) / 10);
                                  handleUpdateClipTransform(activeSelectedLayer.trackId, activeSelectedLayer.clip.id, {
                                    ...activeSelectedLayer.transform,
                                    scale: nextScale,
                                  });
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-white/5"
                                title="Scale Down (-10%)"
                              >
                                <ZoomOut className="w-3.5 h-3.5" />
                              </button>

                              <input
                                type="range"
                                min="0.1"
                                max="3.0"
                                step="0.05"
                                value={activeSelectedLayer.transform.scale}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  handleUpdateClipTransform(activeSelectedLayer.trackId, activeSelectedLayer.clip.id, {
                                    ...activeSelectedLayer.transform,
                                    scale: val,
                                  });
                                }}
                                className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
                              />

                              <button
                                type="button"
                                onClick={() => {
                                  const nextScale = Math.min(3.0, Math.round((activeSelectedLayer.transform.scale + 0.1) * 10) / 10);
                                  handleUpdateClipTransform(activeSelectedLayer.trackId, activeSelectedLayer.clip.id, {
                                    ...activeSelectedLayer.transform,
                                    scale: nextScale,
                                  });
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-white/5"
                                title="Scale Up (+10%)"
                              >
                                <ZoomIn className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Opacity Control */}
                          <div className="flex flex-col gap-1.5 pt-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 font-mono">Opacity:</span>
                              <span className="text-[10px] text-violet-300 font-mono font-semibold">
                                {Math.round((activeSelectedLayer.transform.opacity ?? 1) * 100)}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={activeSelectedLayer.transform.opacity ?? 1}
                              onChange={(e) => {
                                handleUpdateClipTransform(activeSelectedLayer.trackId, activeSelectedLayer.clip.id, {
                                  ...activeSelectedLayer.transform,
                                  opacity: parseFloat(e.target.value),
                                });
                              }}
                              className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
                            />
                          </div>

                          {/* Blur Control */}
                          <div className="flex flex-col gap-1.5 pt-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 font-mono">Blur:</span>
                              <span className="text-[10px] text-violet-300 font-mono font-semibold">
                                {activeSelectedLayer.transform.blur ?? 0}px
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="50"
                              step="1"
                              value={activeSelectedLayer.transform.blur ?? 0}
                              onChange={(e) => {
                                handleUpdateClipTransform(activeSelectedLayer.trackId, activeSelectedLayer.clip.id, {
                                  ...activeSelectedLayer.transform,
                                  blur: parseInt(e.target.value, 10),
                                });
                              }}
                              className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
                            />
                          </div>

                          {/* 3x3 Position & Corner Alignment Snap Grid */}
                          <div className="flex flex-col gap-1 pt-1">
                            <span className="text-[10px] text-slate-400 font-mono">Corner & Snap:</span>
                            <div className="grid grid-cols-3 gap-1 bg-slate-950/80 p-1.5 rounded-lg border border-white/5">
                              <button
                                type="button"
                                onClick={() => handleAlignLayer('tl')}
                                className="flex items-center justify-center p-1.5 rounded bg-slate-800/80 hover:bg-violet-600/30 hover:text-violet-200 text-slate-300 transition text-[10px] border border-white/5 cursor-pointer"
                                title="Top-Left"
                              >
                                <ArrowUpLeft className="w-3.5 h-3.5 mr-0.5" />
                                <span>TL</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAlignLayer('tc')}
                                className="flex items-center justify-center p-1.5 rounded bg-slate-800/80 hover:bg-violet-600/30 hover:text-violet-200 text-slate-300 transition text-[10px] border border-white/5 cursor-pointer"
                                title="Top-Center"
                              >
                                <ArrowUp className="w-3.5 h-3.5 mr-0.5" />
                                <span>TC</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAlignLayer('tr')}
                                className="flex items-center justify-center p-1.5 rounded bg-slate-800/80 hover:bg-violet-600/30 hover:text-violet-200 text-slate-300 transition text-[10px] border border-white/5 cursor-pointer"
                                title="Top-Right"
                              >
                                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                                <span>TR</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAlignLayer('lc')}
                                className="flex items-center justify-center p-1.5 rounded bg-slate-800/80 hover:bg-violet-600/30 hover:text-violet-200 text-slate-300 transition text-[10px] border border-white/5 cursor-pointer"
                                title="Left-Center"
                              >
                                <ArrowLeft className="w-3.5 h-3.5 mr-0.5" />
                                <span>LC</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAlignLayer('center')}
                                className="flex items-center justify-center p-1.5 rounded bg-violet-600/30 hover:bg-violet-600 text-violet-200 hover:text-white transition text-[10px] border border-violet-500/40 font-medium cursor-pointer"
                                title="Center"
                              >
                                <Target className="w-3.5 h-3.5 mr-0.5 text-violet-400" />
                                <span>Center</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAlignLayer('rc')}
                                className="flex items-center justify-center p-1.5 rounded bg-slate-800/80 hover:bg-violet-600/30 hover:text-violet-200 text-slate-300 transition text-[10px] border border-white/5 cursor-pointer"
                                title="Right-Center"
                              >
                                <ArrowRight className="w-3.5 h-3.5 mr-0.5" />
                                <span>RC</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAlignLayer('bl')}
                                className="flex items-center justify-center p-1.5 rounded bg-slate-800/80 hover:bg-violet-600/30 hover:text-violet-200 text-slate-300 transition text-[10px] border border-white/5 cursor-pointer"
                                title="Bottom-Left"
                              >
                                <ArrowDownLeft className="w-3.5 h-3.5 mr-0.5" />
                                <span>BL</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAlignLayer('bc')}
                                className="flex items-center justify-center p-1.5 rounded bg-slate-800/80 hover:bg-violet-600/30 hover:text-violet-200 text-slate-300 transition text-[10px] border border-white/5 cursor-pointer"
                                title="Bottom-Center"
                              >
                                <ArrowDown className="w-3.5 h-3.5 mr-0.5" />
                                <span>BC</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAlignLayer('br')}
                                className="flex items-center justify-center p-1.5 rounded bg-slate-800/80 hover:bg-violet-600/30 hover:text-violet-200 text-slate-300 transition text-[10px] border border-white/5 cursor-pointer"
                                title="Bottom-Right"
                              >
                                <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                                <span>BR</span>
                              </button>
                            </div>
                          </div>

                          {/* Action Buttons: Fit 100% & Rotate 90 */}
                          <div className="grid grid-cols-2 gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateClipTransform(activeSelectedLayer.trackId, activeSelectedLayer.clip.id, {
                                  ...activeSelectedLayer.transform,
                                  x: 50,
                                  y: 50,
                                  scale: 1.0,
                                  rotation: 0,
                                });
                              }}
                              className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-white/5 flex items-center justify-center space-x-1 transition cursor-pointer"
                            >
                              <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Fit 100%</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const currentRot = activeSelectedLayer.transform.rotation || 0;
                                const nextRot = (currentRot + 90) % 360;
                                handleUpdateClipTransform(activeSelectedLayer.trackId, activeSelectedLayer.clip.id, {
                                  ...activeSelectedLayer.transform,
                                  rotation: nextRot,
                                });
                              }}
                              className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-white/5 flex items-center justify-center space-x-1 transition cursor-pointer"
                            >
                              <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Rotate 90°</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 text-center text-slate-400 flex flex-col items-center justify-center gap-1 text-[11px]">
                          <Sliders className="w-5 h-5 text-slate-500 mb-1" />
                          <span>Click a layer in the Preview or select a track to adjust</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <VideoPlayer
              videoUrl={videoUrl}
              activeAudioClips={activeAudioClips}
              settings={settings}
              currentTime={currentTime}
              mediaOffset={mediaOffset}
              sourceStartTime={sourceStartTime}
              clipEndTime={clipEndTime}
              hasActiveClip={hasActiveClip}
              selectedFiles={selectedFiles}
              isPlaying={isPlaying}
              onTimeUpdate={setCurrentTime}
              onDurationLoaded={handleDurationLoaded}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
              onSeek={(t) => setCurrentTime(t)}
              onUpdateSettings={updateSettings}
              isEncodeMode={isEncodeMode}
              isLeftPanelExpanded={isLeftPanelExpanded}
              isRightPanelExpanded={isRightPanelExpanded}
              onToggleEncodeMode={() => {
                if (isEncodeMode) {
                  handleCloseEncodeMode();
                } else {
                  handleOpenEncodeMode();
                }
              }}
              videoName={videoName}
              selectedFile={selectedFiles.length > 0 ? selectedFiles[0] : undefined}
              tracks={tracks}
              onUpdateClipTransform={handleUpdateClipTransform}
              selectedClipId={selectedClipId}
              onSelectClipId={setSelectedClipId}
            />
          </div>

          <Timeline
            currentTime={currentTime}
            duration={duration}
            startTime={settings.startTime}
            endTime={settings.endTime}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onSeek={(t) => setCurrentTime(t)}
            onStartTimeChange={(t) => updateSettings({ startTime: t })}
            onEndTimeChange={(t) => updateSettings({ endTime: t })}
            thumbnails={thumbnails}
            selectedFiles={selectedFiles}
            onFilesReorder={handleFilesReorder}
            onSelectFile={handleSelectFile}
            onUploadClick={() => singleFileInputRef.current?.click()}
            onMultiUploadClick={() => multiFileInputRef.current?.click()}
            onReset={handleReset}
            onExportClick={handleExport}
            onFullscreenClick={handleFullscreen}
            isLoaded={!!videoUrl}
            isProcessing={isProcessingModalOpen}
            isEncodeMode={isEncodeMode}
            tracks={tracks}
            onTracksChange={setTracks}
          />
        </div>


      </div>

      {/* Processing Modal */}
      <ProcessingModal
        isOpen={isProcessingModalOpen}
        progress={processingProgress}
        message={processingMessage}
        logs={processingLogs}
        isDone={isProcessingComplete}
        outputUrl={outputUrl}
        outputFilename={outputFilename}
        onClose={() => setIsProcessingModalOpen(false)}
        onDownload={handleDownloadOutput}
      />

      {/* Sample Videos Modal */}
      <SampleModal
        isOpen={isSampleModalOpen}
        onClose={() => setIsSampleModalOpen(false)}
        onSelectSample={handleSelectSample}
      />
    </div>
  );
}
