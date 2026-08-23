import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Scissors,
  Plus,
  LayoutGrid,
  Maximize2,
  Download,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Layers,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  Trash2,
  Music,
  Image as ImageIcon,
  Video as VideoIcon,
  FileSpreadsheet,
  FilePlus,
  Edit2,
  Copy,
  Check,
  Disc,
  ArrowRightLeft,
  AlignLeft,
  ArrowUp,
  ArrowDown,
  MoveVertical,
  Magnet,
} from 'lucide-react';
import { formatTime } from '../utils/sampleVideos';
import { Input, BlobSource, ALL_FORMATS } from 'mediabunny';
import wcatSeekPng from '../../assets/Wcat seek.png';
import wcatSeekSvg from '../../public/wcat-seek.svg';
import {
  MediaType,
  TrackColor,
  TimelineClip,
  TimelineTrackData,
  ClipTransform,
} from '../types';

export type { MediaType, TrackColor, TimelineClip, TimelineTrackData, ClipTransform };

interface TimelineProps {
  currentTime: number;
  duration: number;
  startTime: number;
  endTime: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onStartTimeChange: (time: number) => void;
  onEndTimeChange: (time: number) => void;
  thumbnails: string[];
  selectedFiles?: File[];
  onFilesReorder?: (files: File[]) => void;
  onSelectFile?: (
    file: File | null,
    clipStartTime?: number,
    clipDuration?: number,
    sourceStartTime?: number,
    clipEndTime?: number,
    activeAudioClips?: { id: string; file: File; startTime: number; sourceStartTime: number }[]
  ) => void;
  onUploadClick: () => void;
  onMultiUploadClick?: () => void;
  onReset: () => void;
  onExportClick: (tracks: TimelineTrackData[]) => void;
  onFullscreenClick: () => void;
  isLoaded: boolean;
  isProcessing: boolean;
  isEncodeMode?: boolean;
  tracks?: TimelineTrackData[];
  onTracksChange?: React.Dispatch<React.SetStateAction<TimelineTrackData[]>> | ((tracks: TimelineTrackData[]) => void);
}

const COLOR_CLASSES: Record<TrackColor, {
  tabActive: string;
  headerBorder: string;
  headerBg: string;
  badge: string;
  clipBorder: string;
  clipBg: string;
  clipHandle: string;
  clipText: string;
}> = {
  indigo: {
    tabActive: 'bg-indigo-600 text-white shadow-indigo-600/30',
    headerBorder: 'border-indigo-500',
    headerBg: 'bg-indigo-950/40',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    clipBorder: 'border-indigo-400',
    clipBg: 'bg-indigo-600/20',
    clipHandle: 'bg-indigo-400 hover:bg-white',
    clipText: 'bg-indigo-950/90 border-indigo-400/50 text-indigo-200',
  },
  violet: {
    tabActive: 'bg-violet-600 text-white shadow-violet-600/30',
    headerBorder: 'border-violet-500',
    headerBg: 'bg-violet-950/40',
    badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    clipBorder: 'border-violet-400',
    clipBg: 'bg-violet-600/20',
    clipHandle: 'bg-violet-400 hover:bg-white',
    clipText: 'bg-violet-950/90 border-violet-400/50 text-violet-200',
  },
  emerald: {
    tabActive: 'bg-emerald-600 text-white shadow-emerald-600/30',
    headerBorder: 'border-emerald-500',
    headerBg: 'bg-emerald-950/40',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    clipBorder: 'border-emerald-400',
    clipBg: 'bg-emerald-600/20',
    clipHandle: 'bg-emerald-400 hover:bg-white',
    clipText: 'bg-emerald-950/90 border-emerald-400/50 text-emerald-200',
  },
  amber: {
    tabActive: 'bg-amber-600 text-white shadow-amber-600/30',
    headerBorder: 'border-amber-500',
    headerBg: 'bg-amber-950/40',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    clipBorder: 'border-amber-400',
    clipBg: 'bg-amber-600/20',
    clipHandle: 'bg-amber-400 hover:bg-white',
    clipText: 'bg-amber-950/90 border-amber-400/50 text-amber-200',
  },
  rose: {
    tabActive: 'bg-rose-600 text-white shadow-rose-600/30',
    headerBorder: 'border-rose-500',
    headerBg: 'bg-rose-950/40',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    clipBorder: 'border-rose-400',
    clipBg: 'bg-rose-600/20',
    clipHandle: 'bg-rose-400 hover:bg-white',
    clipText: 'bg-rose-950/90 border-rose-400/50 text-rose-200',
  },
  cyan: {
    tabActive: 'bg-cyan-600 text-white shadow-cyan-600/30',
    headerBorder: 'border-cyan-500',
    headerBg: 'bg-cyan-950/40',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    clipBorder: 'border-cyan-400',
    clipBg: 'bg-cyan-600/20',
    clipHandle: 'bg-cyan-400 hover:bg-white',
    clipText: 'bg-cyan-950/90 border-cyan-400/50 text-cyan-200',
  },
  fuchsia: {
    tabActive: 'bg-fuchsia-600 text-white shadow-fuchsia-600/30',
    headerBorder: 'border-fuchsia-500',
    headerBg: 'bg-fuchsia-950/40',
    badge: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30',
    clipBorder: 'border-fuchsia-400',
    clipBg: 'bg-fuchsia-600/20',
    clipHandle: 'bg-fuchsia-400 hover:bg-white',
    clipText: 'bg-fuchsia-950/90 border-fuchsia-400/50 text-fuchsia-200',
  },
};

const COLOR_OPTIONS: TrackColor[] = ['indigo', 'violet', 'emerald', 'amber', 'rose', 'cyan', 'fuchsia'];

export const Timeline: React.FC<TimelineProps> = ({
  currentTime,
  duration,
  startTime,
  endTime,
  isPlaying,
  onTogglePlay,
  onSeek,
  onStartTimeChange,
  onEndTimeChange,
  thumbnails,
  selectedFiles,
  onFilesReorder,
  onSelectFile,
  onUploadClick,
  onMultiUploadClick,
  onExportClick,
  onFullscreenClick,
  isProcessing,
  isEncodeMode = false,
  tracks: propsTracks,
  onTracksChange,
}) => {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [dragTooltip, setDragTooltip] = useState<string | null>(null);
  const [activeTrackId, setActiveTrackId] = useState<string>('track-1');
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  // Universal, Free-form Timeline Tracks (Each track holds MULTIPLE independent clips)
  const [internalTracks, setInternalTracks] = useState<TimelineTrackData[]>([
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
  ]);

  const tracks = propsTracks ?? internalTracks;
  const setTracks = (onTracksChange as unknown as React.Dispatch<React.SetStateAction<TimelineTrackData[]>>) ?? setInternalTracks;

  const trimContainerRef = useRef<HTMLDivElement>(null);
  const tracksStackRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const leftHeadersScrollRef = useRef<HTMLDivElement>(null);
  const trackFileInputRef = useRef<HTMLInputElement>(null);
  const [targetUploadTrackId, setTargetUploadTrackId] = useState<string | null>(null);
  const [hoveredDropTrackId, setHoveredDropTrackId] = useState<string | null>(null);
  const [activeMoveMenuClipId, setActiveMoveMenuClipId] = useState<string | null>(null);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [snapEnabled, setSnapEnabled] = useState<boolean>(true);
  const [snapGuideTime, setSnapGuideTime] = useState<number | null>(null);
  const dragHoveredTrackIdRef = useRef<string | null>(null);
  const lastNewStartRef = useRef<number>(0);
  const lastNewEndRef = useRef<number>(0);

  // Adjustable timeline panel height with drag up/down
  const [timelineHeight, setTimelineHeight] = useState<number>(() => {
    const saved = localStorage.getItem('timeline_panel_height');
    return saved ? Math.max(130, Math.min(600, parseInt(saved, 10))) : 200;
  });
  const [isResizingHeight, setIsResizingHeight] = useState<boolean>(false);
  const resizeStartYRef = useRef<number>(0);
  const resizeStartHeightRef = useRef<number>(0);

  const startHeightResize = (clientY: number) => {
    setIsResizingHeight(true);
    resizeStartYRef.current = clientY;
    resizeStartHeightRef.current = timelineHeight;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
  };

  useEffect(() => {
    if (!isResizingHeight) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = resizeStartYRef.current - e.clientY;
      const newHeight = Math.max(130, Math.min(window.innerHeight * 0.75, resizeStartHeightRef.current + deltaY));
      setTimelineHeight(newHeight);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const deltaY = resizeStartYRef.current - e.touches[0].clientY;
        const newHeight = Math.max(130, Math.min(window.innerHeight * 0.75, resizeStartHeightRef.current + deltaY));
        setTimelineHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsResizingHeight(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      setTimelineHeight((curr) => {
        try {
          localStorage.setItem('timeline_panel_height', curr.toString());
        } catch {}
        return curr;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizingHeight]);

  // Independent Thumbnail Cache per File/Media
  const [fileThumbnails, setFileThumbnails] = useState<Record<string, string[]>>({});
  const [fileDurations, setFileDurations] = useState<Record<string, number>>({});
  const inFlightExtractionsRef = useRef<Set<string>>(new Set());
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const isScrubbingRef = useRef<boolean>(false);
  const lastEmittedClipRef = useRef<{
    fileKey: string;
    startTime: number;
    sourceStart: number;
    endTime: number;
    audioSignature?: string;
  } | null>(null);

  const getFileKey = (file: File): string => `${file.name}_${file.size}_${file.lastModified}`;

  // Helper to extract thumbnails and exact duration for a specific video file
  const extractThumbnailsForFile = async (file: File) => {
    const key = getFileKey(file);
    if (inFlightExtractionsRef.current.has(key)) return;
    if (fileThumbnails[key] && fileThumbnails[key].length > 0 && fileDurations[key]) return;

    inFlightExtractionsRef.current.add(key);

    const updateClipDurations = (fileDur: number) => {
      if (!fileDur || fileDur <= 0) return;
      setFileDurations((prev) => ({ ...prev, [key]: fileDur }));

      setTracks((prev) => {
        let changed = false;
        const nextTracks = prev.map((t) => ({
          ...t,
          clips: t.clips.map((c) => {
            if (c.file && getFileKey(c.file) === key) {
              const currentSpan = c.endTime - c.startTime;
              const isUntrimmed =
                !c.isTrimmed ||
                currentSpan <= 15 ||
                currentSpan === c.fileDuration ||
                c.endTime === 10 ||
                c.endTime === 15 ||
                !c.fileDuration;
              const newEnd = isUntrimmed ? c.startTime + fileDur : c.endTime;
              const newSourceEnd = isUntrimmed ? fileDur : (c.sourceEndTime || fileDur);
              if (c.fileDuration !== fileDur || c.endTime !== newEnd || c.sourceEndTime !== newSourceEnd) {
                changed = true;
                return {
                  ...c,
                  fileDuration: fileDur,
                  endTime: newEnd,
                  sourceEndTime: newSourceEnd,
                };
              }
            }
            return c;
          }),
        }));
        return changed ? nextTracks : prev;
      });
    };

    // 1. Fast Mediabunny Demuxer probe (100% accurate for MKV, MP4, WebM, TS, AVI)
    let probedDur = 0;
    try {
      const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
      const vTracks = await input.getVideoTracks();
      if (vTracks.length > 0) {
        const d = await vTracks[0].computeDuration();
        if (d && Number.isFinite(d) && d > 0) probedDur = d;
      }
      if (!probedDur) {
        const aTracks = await input.getAudioTracks();
        if (aTracks.length > 0) {
          const d = await aTracks[0].computeDuration();
          if (d && Number.isFinite(d) && d > 0) probedDur = d;
        }
      }
    } catch (e) {
      console.warn('Mediabunny duration extraction in Timeline:', e);
    }

    if (probedDur > 0) {
      updateClipDurations(probedDur);
    }

    // 2. HTML5 <video> element thumbnail extraction & fallback duration check
    const video = document.createElement('video');
    const blobUrl = URL.createObjectURL(file);
    video.src = blobUrl;
    video.muted = true;
    video.preload = 'metadata';

    const count = 8;
    const thumbs: string[] = [];
    let currentIdx = 0;

    const cleanup = () => {
      try {
        URL.revokeObjectURL(blobUrl);
        video.src = '';
        video.load();
      } catch {}
    };

    video.onerror = () => {
      cleanup();
    };

    video.onloadedmetadata = () => {
      const html5Dur = (video.duration && Number.isFinite(video.duration) && video.duration > 0) ? video.duration : 0;
      const fileDur = html5Dur || probedDur || 10;
      updateClipDurations(fileDur);

      const step = fileDur / count;

      const captureNext = () => {
        if (currentIdx >= count) {
          setFileThumbnails((prev) => ({ ...prev, [key]: thumbs }));
          cleanup();
          return;
        }
        const targetTime = (currentIdx + 0.5) * step;
        video.currentTime = Math.min(Math.max(0, targetTime), Math.max(0.1, fileDur - 0.05));
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 160;
          canvas.height = 90;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            thumbs.push(canvas.toDataURL('image/jpeg', 0.7));
          }
        } catch {}
        currentIdx++;
        captureNext();
      };

      captureNext();
    };
  };

  // Extract separate video thumbnails for each distinct video file
  useEffect(() => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    selectedFiles.forEach((file) => {
      const key = getFileKey(file);
      const mediaType = detectMediaType(file);

      // 1. Image File Preview
      if (mediaType === 'image') {
        if (!inFlightExtractionsRef.current.has(key)) {
          inFlightExtractionsRef.current.add(key);
          const imgUrl = URL.createObjectURL(file);
          setFileThumbnails((prev) => ({ ...prev, [key]: [imgUrl] }));
          setFileDurations((prev) => ({ ...prev, [key]: 5 }));
        }
        return;
      }

      // 2. Video File Thumbnails Extraction (Specific to this video file)
      if (mediaType === 'video') {
        extractThumbnailsForFile(file);
      }
    });
  }, [selectedFiles]);

  const detectMediaType = (file: File): MediaType => {
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type.startsWith('image/')) return 'image';
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (['mp4', 'mkv', 'mov', 'webm', 'avi', 'flv'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg', 'opus'].includes(ext)) return 'audio';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext)) return 'image';
    return 'any';
  };

  // Sync timeline tracks and multi-clips dynamically according to selectedFiles
  useEffect(() => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    setTracks((prev) => {
      const colorOrder: TrackColor[] = ['indigo', 'violet', 'emerald', 'amber', 'rose', 'cyan', 'fuchsia'];

      // Check existing files already present across any track
      const existingFilesSet = new Set<string>();
      prev.forEach((t) => {
        t.clips.forEach((c) => {
          if (c.file) {
            existingFilesSet.add(getFileKey(c.file));
          }
        });
      });

      // If tracks are empty or just initialized with no clips, create 1 dedicated track per selected file
      const totalClipsCount = prev.reduce((acc, t) => acc + t.clips.length, 0);
      if (totalClipsCount === 0) {
        const newTracks: TimelineTrackData[] = selectedFiles.map((file, idx) => {
          const key = getFileKey(file);
          const detectedType = detectMediaType(file);
          const knownDuration = fileDurations[key] || (detectedType === 'image' ? 5 : 0);
          const trackColor = colorOrder[idx % colorOrder.length];

          const clip: TimelineClip = {
            id: `clip-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
            name: file.name,
            mediaType: detectedType,
            startTime: 0,
            endTime: knownDuration,
            sourceStartTime: 0,
            sourceEndTime: knownDuration,
            fileDuration: knownDuration,
            file: file,
            fileName: file.name,
            previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
            color: trackColor,
            isTrimmed: false,
          };

          return {
            id: `track-${idx + 1}`,
            name: selectedFiles.length > 1 ? `Track ${idx + 1}` : 'Track 1',
            mediaType: 'any' as MediaType,
            color: trackColor,
            clips: [clip],
            muted: false,
            locked: false,
            hidden: false,
          };
        });

        // Ensure at least 2 tracks if only 1 file is selected
        while (newTracks.length < 2) {
          const nextIdx = newTracks.length + 1;
          newTracks.push({
            id: `track-${nextIdx}`,
            name: `Track ${nextIdx}`,
            mediaType: 'any' as MediaType,
            color: colorOrder[(nextIdx - 1) % colorOrder.length],
            clips: [],
            muted: false,
            locked: false,
            hidden: false,
          });
        }

        return newTracks;
      }

      // If tracks already exist and have clips, check if any newly selected files need their own track
      const missingFiles = selectedFiles.filter((file) => !existingFilesSet.has(getFileKey(file)));
      if (missingFiles.length === 0) {
        return prev;
      }

      const updatedTracks = [...prev];
      missingFiles.forEach((file) => {
        const key = getFileKey(file);
        const detectedType = detectMediaType(file);
        const knownDuration = fileDurations[key] || (detectedType === 'image' ? 5 : 0);
        const trackColor = colorOrder[updatedTracks.length % colorOrder.length];

        const newClip: TimelineClip = {
          id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: file.name,
          mediaType: detectedType,
          startTime: 0,
          endTime: knownDuration,
          sourceStartTime: 0,
          sourceEndTime: knownDuration,
          fileDuration: knownDuration,
          file: file,
          fileName: file.name,
          previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
          color: trackColor,
          isTrimmed: false,
        };

        // Find first empty track without clips
        const emptyTrackIdx = updatedTracks.findIndex((t) => t.clips.length === 0);
        if (emptyTrackIdx !== -1) {
          updatedTracks[emptyTrackIdx] = {
            ...updatedTracks[emptyTrackIdx],
            clips: [newClip],
          };
        } else {
          // Create a new separate track for this file
          const newTrackIdx = updatedTracks.length + 1;
          updatedTracks.push({
            id: `track-${Date.now()}-${newTrackIdx}`,
            name: `Track ${newTrackIdx}`,
            mediaType: 'any' as MediaType,
            color: trackColor,
            clips: [newClip],
            muted: false,
            locked: false,
            hidden: false,
          });
        }
      });

      return updatedTracks;
    });
  }, [selectedFiles]);

  // Add a new universal track with zero restrictions
  const handleAddTrack = () => {
    const newIdx = tracks.length + 1;
    const colorOrder: TrackColor[] = ['emerald', 'amber', 'rose', 'cyan', 'fuchsia', 'indigo', 'violet'];
    const assignedColor = colorOrder[(newIdx - 1) % colorOrder.length];

    const newTrack: TimelineTrackData = {
      id: `track-${Date.now()}`,
      name: `Track ${newIdx}`,
      mediaType: 'any',
      color: assignedColor,
      clips: [],
      muted: false,
      locked: false,
      hidden: false,
    };
    setTracks((prev) => [...prev, newTrack]);
    setActiveTrackId(newTrack.id);
  };

  // Duplicate a track
  const handleDuplicateTrack = (trackId: string) => {
    const src = tracks.find((t) => t.id === trackId);
    if (!src) return;
    const newTrack: TimelineTrackData = {
      ...src,
      id: `track-${Date.now()}`,
      name: `${src.name} (Copy)`,
      clips: src.clips.map((c) => ({
        ...c,
        id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      })),
    };
    setTracks((prev) => [...prev, newTrack]);
    setActiveTrackId(newTrack.id);
  };

  // Delete a track
  const handleDeleteTrack = (trackId: string) => {
    if (tracks.length <= 1) return; // Always keep at least 1 track
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
    if (activeTrackId === trackId) {
      const remaining = tracks.filter((t) => t.id !== trackId);
      setActiveTrackId(remaining[0].id);
    }
  };

  // Cycle / switch media type icon on track freely
  const cycleMediaType = (trackId: string) => {
    const types: MediaType[] = ['any', 'video', 'audio', 'image', 'text'];
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === trackId) {
          const currIdx = types.indexOf(t.mediaType);
          const nextType = types[(currIdx + 1) % types.length];
          return { ...t, mediaType: nextType };
        }
        return t;
      })
    );
  };

  // Change track color
  const cycleTrackColor = (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === trackId) {
          const currIdx = COLOR_OPTIONS.indexOf(t.color);
          const nextColor = COLOR_OPTIONS[(currIdx + 1) % COLOR_OPTIONS.length];
          return { ...t, color: nextColor };
        }
        return t;
      })
    );
  };

  // Direct file attachment to a specific track as a new clip
  const handleTrackFileSelect = (trackId: string) => {
    setTargetUploadTrackId(trackId);
    trackFileInputRef.current?.click();
  };

  const handleTrackFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetUploadTrackId) return;

    const detectedType = detectMediaType(file);
    const url = URL.createObjectURL(file);

    // If image or video, extract thumbnails immediately
    const key = getFileKey(file);
    if (detectedType === 'image') {
      setFileThumbnails((prev) => ({ ...prev, [key]: [url] }));
    } else if (detectedType === 'video') {
      extractThumbnailsForFile(file);
    }

    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === targetUploadTrackId) {
          const startVal = currentTime;
          const dur = fileDurations[key] || (detectedType === 'image' ? 5 : 0);
          const newClip: TimelineClip = {
            id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            name: file.name,
            mediaType: detectedType,
            startTime: startVal,
            endTime: startVal + dur,
            sourceStartTime: 0,
            sourceEndTime: dur,
            fileDuration: dur,
            file: file,
            fileName: file.name,
            previewUrl: url,
            color: t.color,
            isTrimmed: false,
          };
          return {
            ...t,
            clips: [...t.clips, newClip],
          };
        }
        return t;
      })
    );

    if (onSelectFile && !isEncodeMode) {
      onSelectFile(file, currentTime);
    }

    if (trackFileInputRef.current) {
      trackFileInputRef.current.value = '';
    }
    setTargetUploadTrackId(null);
  };

  // Start inline rename
  const handleStartRename = (track: TimelineTrackData) => {
    setEditingTrackId(track.id);
    setEditingName(track.name);
  };

  const handleSaveRename = (trackId: string) => {
    if (editingName.trim()) {
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, name: editingName.trim() } : t))
      );
    }
    setEditingTrackId(null);
  };

  // Track toggles
  const toggleTrackMute = (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t))
    );
  };

  const toggleTrackLock = (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, locked: !t.locked } : t))
    );
  };

  const toggleTrackHidden = (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, hidden: !t.hidden } : t))
    );
  };

  // Multi-file drag and drop (Reorder files tab bar)
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx);
    e.dataTransfer.setData('text/plain', idx.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedIdx === null || !selectedFiles || !onFilesReorder) return;
    if (draggedIdx === targetIdx) return;

    const newFiles = [...selectedFiles];
    const [movedFile] = newFiles.splice(draggedIdx, 1);
    newFiles.splice(targetIdx, 0, movedFile);
    onFilesReorder(newFiles);
    setDraggedIdx(null);
  };

  const moveFile = (idx: number, direction: 'left' | 'right') => {
    if (!selectedFiles || !onFilesReorder) return;
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= selectedFiles.length) return;
    const newFiles = [...selectedFiles];
    const temp = newFiles[idx];
    newFiles[idx] = newFiles[targetIdx];
    newFiles[targetIdx] = temp;
    onFilesReorder(newFiles);
  };

  // Calculate project total timeline duration dynamically across all clips in all tracks
  const allClips = tracks.flatMap((t) => t.clips);
  const computedTimelineDuration = Math.max(
    duration || 0,
    ...allClips.map((c) => c.endTime || 0),
    10
  );

  // Auto-Sequence all clips (Option: Sequence all clips into Track 1 in order)
  const handleAutoSequence = () => {
    let currentOffset = 0;
    setTracks((prev) => {
      // Gather all clips across all tracks
      const allExtractedClips = prev.flatMap((t) => t.clips);
      if (allExtractedClips.length === 0) return prev;

      // Sort clips by their current start time
      allExtractedClips.sort((a, b) => a.startTime - b.startTime);

      const sequencedClips = allExtractedClips.map((c) => {
        const span = c.fileDuration || Math.max(1, c.endTime - c.startTime);
        const start = currentOffset;
        const end = start + span;
        currentOffset = end;
        return { ...c, startTime: start, endTime: end };
      });

      // Put all sequenced clips together on Track 1 (or keep empty other tracks)
      return prev.map((t, idx) => {
        if (idx === 0) {
          return { ...t, clips: sequencedClips };
        }
        return { ...t, clips: [] };
      });
    });
  };

  // Align all tracks' first clip to start at 00:00.0 without changing internal spacing
  const handleAlignToStart = () => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.clips.length === 0) return t;
        const minStart = Math.min(...t.clips.map((c) => c.startTime));
        return {
          ...t,
          clips: t.clips.map((c) => {
            const span = c.endTime - c.startTime;
            const newStart = Math.max(0, c.startTime - minStart);
            return { ...c, startTime: newStart, endTime: newStart + span };
          }),
        };
      })
    );
  };

  // Move a specific clip from one track to another track (keeps both clips on the target track!)
  const handleMoveClipToTrack = (sourceTrackId: string, clipId: string, targetTrackId: string) => {
    if (sourceTrackId === targetTrackId) return;

    setTracks((prev) => {
      const srcTrack = prev.find((t) => t.id === sourceTrackId);
      const destTrack = prev.find((t) => t.id === targetTrackId);
      if (!srcTrack || !destTrack) return prev;

      const movingClip = srcTrack.clips.find((c) => c.id === clipId);
      if (!movingClip) return prev;

      const remainingSrcClips = srcTrack.clips.filter((c) => c.id !== clipId);
      const newDestClips = [...destTrack.clips, movingClip];

      return prev.map((t) => {
        if (t.id === sourceTrackId) return { ...t, clips: remainingSrcClips };
        if (t.id === targetTrackId) return { ...t, clips: newDestClips };
        return t;
      });
    });

    setActiveTrackId(targetTrackId);
    setActiveClipId(clipId);
    setActiveMoveMenuClipId(null);
  };

  // Move clip to a brand new track
  const handleMoveClipToNewTrack = (sourceTrackId: string, clipId: string) => {
    const srcTrack = tracks.find((t) => t.id === sourceTrackId);
    if (!srcTrack) return;
    const movingClip = srcTrack.clips.find((c) => c.id === clipId);
    if (!movingClip) return;

    const newIdx = tracks.length + 1;
    const colorOrder: TrackColor[] = ['emerald', 'amber', 'rose', 'cyan', 'fuchsia', 'indigo', 'violet'];
    const assignedColor = colorOrder[(newIdx - 1) % colorOrder.length];

    const newTrack: TimelineTrackData = {
      id: `track-${Date.now()}`,
      name: `Track ${newIdx}`,
      mediaType: movingClip.mediaType,
      color: assignedColor,
      clips: [movingClip],
      muted: false,
      locked: false,
      hidden: false,
    };

    setTracks((prev) => [
      ...prev.map((t) =>
        t.id === sourceTrackId
          ? {
              ...t,
              clips: t.clips.filter((c) => c.id !== clipId),
            }
          : t
      ),
      newTrack,
    ]);

    setActiveTrackId(newTrack.id);
    setActiveClipId(clipId);
    setActiveMoveMenuClipId(null);
  };

  // Duplicate a specific clip in the same track
  const handleDuplicateClip = (trackId: string, clipId: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === trackId) {
          const srcClip = t.clips.find((c) => c.id === clipId);
          if (!srcClip) return t;
          const span = srcClip.endTime - srcClip.startTime;
          const newClip: TimelineClip = {
            ...srcClip,
            id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            name: `${srcClip.name} (Copy)`,
            startTime: srcClip.endTime,
            endTime: srcClip.endTime + span,
          };
          return { ...t, clips: [...t.clips, newClip] };
        }
        return t;
      })
    );
  };

  // Delete a specific clip from a track
  const handleDeleteClip = (trackId: string, clipId: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, clips: t.clips.filter((c) => c.id !== clipId) } : t))
    );
  };

  // Dynamically sync preview video when playhead enters any clip's time range
  useEffect(() => {
    if (!onSelectFile || tracks.length === 0) return;

    // =========================================================================
    // 🎛️ PLAYHEAD RESOLUTION LOGIC (ENCODE MODE vs COPY MODE)
    // =========================================================================
    // Find clip under playhead
    let targetClip: TimelineClip | undefined;
    const activeAudioClips: { id: string; file: File; startTime: number; sourceStartTime: number }[] = [];

    if (!isEncodeMode) {
      const activeTrack = tracks.find((t) => t.id === activeTrackId);
      if (activeTrack && !activeTrack.hidden) {
        targetClip = activeTrack.clips.find((c) => c.file && c.startTime <= currentTime && currentTime <= c.endTime);
      }
    } else {
      for (const t of tracks) {
        const match = t.clips.find((c) => c.file && c.startTime <= currentTime && currentTime <= c.endTime);
        if (match) {
          if (!t.hidden && !targetClip) {
            targetClip = match; // Topmost visible track provides video
          }
          if (!t.muted && match.file) {
            activeAudioClips.push({
              id: match.id,
              file: match.file,
              startTime: match.startTime,
              sourceStartTime: match.sourceStartTime || 0
            });
          }
        }
      }
    }

    const audioSignature = activeAudioClips.map(c => `${c.id}_${c.startTime}_${c.sourceStartTime}`).join('|');
    const fileKey = targetClip?.file ? getFileKey(targetClip.file) : '';
    const startTime = targetClip?.startTime || 0;
    const sourceStart = targetClip?.sourceStartTime || 0;
    const endTime = targetClip?.endTime || 0;
    const fileDuration = targetClip?.fileDuration || (targetClip ? (targetClip.endTime - targetClip.startTime) : 0);

    if (
      !lastEmittedClipRef.current ||
      lastEmittedClipRef.current.fileKey !== fileKey ||
      lastEmittedClipRef.current.audioSignature !== audioSignature ||
      Math.abs(lastEmittedClipRef.current.startTime - startTime) > 0.001 ||
      Math.abs(lastEmittedClipRef.current.sourceStart - sourceStart) > 0.001 ||
      Math.abs(lastEmittedClipRef.current.endTime - endTime) > 0.001
    ) {
      lastEmittedClipRef.current = { fileKey, startTime, sourceStart, endTime, audioSignature };
      onSelectFile(targetClip?.file || null, startTime, fileDuration, sourceStart, endTime, activeAudioClips);
    }
  }, [currentTime, tracks, onSelectFile, isEncodeMode, activeTrackId]);

  // Master Timeline Drag-to-Seek Scrubber for Cat Handle, Playhead Needle, and Top Ruler
  const handleStartScrub = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!trimContainerRef.current) return;
    setIsScrubbing(true);
    isScrubbingRef.current = true;

    const calcTimeFromEvent = (clientX: number) => {
      if (!trimContainerRef.current) return 0;
      const rect = trimContainerRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const percent = Math.max(0, Math.min(1, clickX / (rect.width || 1)));
      let targetTime = percent * computedTimelineDuration;

      if (snapEnabled) {
        const snapThresholdPx = 10;
        const snapThresholdTime = (snapThresholdPx / (rect.width || 500)) * computedTimelineDuration;
        const snapPoints: number[] = [0];
        if (computedTimelineDuration > 0) snapPoints.push(computedTimelineDuration);
        tracks.forEach((t) => {
          t.clips.forEach((c) => {
            snapPoints.push(c.startTime);
            snapPoints.push(c.endTime);
          });
        });

        let snappedPoint: number | null = null;
        for (const pt of snapPoints) {
          if (Math.abs(targetTime - pt) <= snapThresholdTime) {
            targetTime = pt;
            snappedPoint = pt;
            break;
          }
        }
        setSnapGuideTime(snappedPoint);
      } else {
        setSnapGuideTime(null);
      }

      return Math.max(0, Math.min(computedTimelineDuration, targetTime));
    };

    const initialTime = calcTimeFromEvent(e.clientX);
    onSeek(initialTime);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isScrubbingRef.current) return;
      const newTime = calcTimeFromEvent(moveEvent.clientX);
      onSeek(newTime);
    };

    const handleMouseUp = () => {
      setIsScrubbing(false);
      isScrubbingRef.current = false;
      setSnapGuideTime(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Universal Clip Dragging (Supports multi-clip horizontal trimming & moving + vertical inter-track drop into same track)
  const startTrimDrag = (
    e: React.MouseEvent,
    type: 'left' | 'right' | 'middle',
    trackId: string,
    clipId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const currentTrack = tracks.find((t) => t.id === trackId);
    if (!currentTrack || currentTrack.locked) return;

    const currentClip = currentTrack.clips.find((c) => c.id === clipId);
    if (!currentClip) return;

    setActiveTrackId(trackId);
    setActiveClipId(clipId);
    dragHoveredTrackIdRef.current = trackId;
    lastNewStartRef.current = currentClip.startTime;
    lastNewEndRef.current = currentClip.endTime;

    if (!trimContainerRef.current) return;

    const startX = e.clientX;
    const startStartTime = currentClip.startTime;
    const startEndTime = currentClip.endTime;
    const startSourceStartTime = currentClip.sourceStartTime || 0;
    const startSourceEndTime =
      currentClip.sourceEndTime || currentClip.fileDuration || (startEndTime - startStartTime);
    const rect = trimContainerRef.current.getBoundingClientRect();
    const containerWidth = rect.width || 500;
    const totalDuration = computedTimelineDuration;
    const minSpan = Math.max(0.1, (20 / containerWidth) * totalDuration);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaTime = (deltaX / containerWidth) * totalDuration;
      const snapThresholdPx = 12; // 12px magnetic snap radius
      const snapThresholdTime = (snapThresholdPx / containerWidth) * totalDuration;

      let newStart = startStartTime;
      let newEnd = startEndTime;
      let activeSnapPoint: number | null = null;

      if (type === 'middle') {
        const span = startEndTime - startStartTime;
        let rawStart = startStartTime + deltaTime;
        let rawEnd = startEndTime + deltaTime;

        if (rawStart < 0) {
          rawStart = 0;
          rawEnd = span;
        }

        if (snapEnabled) {
          // Candidate snap points across timeline, other clips, and playhead
          const snapPoints: number[] = [0];
          if (computedTimelineDuration > 0) snapPoints.push(computedTimelineDuration);
          if (currentTime >= 0) snapPoints.push(currentTime);

          tracks.forEach((t) => {
            t.clips.forEach((c) => {
              if (c.id !== clipId) {
                snapPoints.push(c.startTime);
                snapPoints.push(c.endTime);
              }
            });
          });

          let bestDist = Infinity;
          let snappedStart: number | null = null;
          let snappedEnd: number | null = null;
          let snappedPoint: number | null = null;

          for (const pt of snapPoints) {
            // Check start edge snap
            const distStart = Math.abs(rawStart - pt);
            if (distStart <= snapThresholdTime && distStart < bestDist) {
              bestDist = distStart;
              snappedStart = pt;
              snappedEnd = pt + span;
              snappedPoint = pt;
            }

            // Check end edge snap
            const distEnd = Math.abs(rawEnd - pt);
            if (distEnd <= snapThresholdTime && distEnd < bestDist) {
              bestDist = distEnd;
              snappedStart = Math.max(0, pt - span);
              snappedEnd = pt;
              snappedPoint = pt;
            }
          }

          if (snappedPoint !== null && snappedStart !== null && snappedEnd !== null) {
            newStart = snappedStart;
            newEnd = snappedEnd;
            activeSnapPoint = snappedPoint;
          } else {
            newStart = Math.max(0, rawStart);
            newEnd = Math.max(newStart + 0.1, rawEnd);
          }
        } else {
          newStart = Math.max(0, rawStart);
          newEnd = Math.max(newStart + 0.1, rawEnd);
        }

        lastNewStartRef.current = newStart;
        lastNewEndRef.current = newEnd;

        // Detect target track row on vertical drag
        if (tracksStackRef.current) {
          const stackRect = tracksStackRef.current.getBoundingClientRect();
          const relY = moveEvent.clientY - stackRect.top;
          const rowH = 56;
          const currentDisplayed = !isEncodeMode
            ? tracks.filter((t) => t.id === activeTrackId)
            : tracks;
          const clampedIdx = Math.max(0, Math.min(currentDisplayed.length - 1, Math.floor(relY / rowH)));
          const targetTrack = currentDisplayed[clampedIdx];
          if (targetTrack) {
            dragHoveredTrackIdRef.current = targetTrack.id;
            setHoveredDropTrackId(targetTrack.id);

            const snapPrefix = activeSnapPoint !== null ? `🧲 Snap (${formatTime(activeSnapPoint)}) ` : '';
            if (targetTrack.id !== trackId) {
              setDragTooltip(
                `${snapPrefix}[Move to ${targetTrack.name}] ${formatTime(newStart)} - ${formatTime(newEnd)} (${formatTime(
                  newEnd - newStart
                )})`
              );
            } else {
              setDragTooltip(
                `${snapPrefix}[${currentTrack.name}] ${formatTime(newStart)} - ${formatTime(newEnd)} (${formatTime(
                  newEnd - newStart
                )})`
              );
            }
          }
        }
      } else if (type === 'left') {
        let rawStart = startStartTime + deltaTime;
        rawStart = Math.max(0, Math.min(rawStart, startEndTime - minSpan));

        if (snapEnabled) {
          const snapPoints: number[] = [0];
          if (currentTime >= 0) snapPoints.push(currentTime);
          tracks.forEach((t) => {
            t.clips.forEach((c) => {
              if (c.id !== clipId) {
                snapPoints.push(c.startTime);
                snapPoints.push(c.endTime);
              }
            });
          });

          let bestDist = Infinity;
          let snappedVal: number | null = null;
          for (const pt of snapPoints) {
            if (pt <= startEndTime - minSpan) {
              const dist = Math.abs(rawStart - pt);
              if (dist <= snapThresholdTime && dist < bestDist) {
                bestDist = dist;
                snappedVal = pt;
              }
            }
          }

          if (snappedVal !== null) {
            newStart = snappedVal;
            activeSnapPoint = snappedVal;
          } else {
            newStart = rawStart;
          }
        } else {
          newStart = rawStart;
        }

        lastNewStartRef.current = newStart;
        const snapPrefix = activeSnapPoint !== null ? `🧲 Snap (${formatTime(activeSnapPoint)}) ` : '';
        setDragTooltip(`${snapPrefix}[${currentClip.name}] In: ${formatTime(newStart)}`);
      } else if (type === 'right') {
        let rawEnd = startEndTime + deltaTime;
        rawEnd = Math.max(startStartTime + minSpan, rawEnd);

        if (snapEnabled) {
          const snapPoints: number[] = [];
          if (computedTimelineDuration > 0) snapPoints.push(computedTimelineDuration);
          if (currentTime >= 0) snapPoints.push(currentTime);
          tracks.forEach((t) => {
            t.clips.forEach((c) => {
              if (c.id !== clipId) {
                snapPoints.push(c.startTime);
                snapPoints.push(c.endTime);
              }
            });
          });

          let bestDist = Infinity;
          let snappedVal: number | null = null;
          for (const pt of snapPoints) {
            if (pt >= startStartTime + minSpan) {
              const dist = Math.abs(rawEnd - pt);
              if (dist <= snapThresholdTime && dist < bestDist) {
                bestDist = dist;
                snappedVal = pt;
              }
            }
          }

          if (snappedVal !== null) {
            newEnd = snappedVal;
            activeSnapPoint = snappedVal;
          } else {
            newEnd = rawEnd;
          }
        } else {
          newEnd = rawEnd;
        }

        lastNewEndRef.current = newEnd;
        const snapPrefix = activeSnapPoint !== null ? `🧲 Snap (${formatTime(activeSnapPoint)}) ` : '';
        setDragTooltip(`${snapPrefix}[${currentClip.name}] Out: ${formatTime(newEnd)}`);
      }

      setSnapGuideTime(activeSnapPoint);

      let newSourceStart = startSourceStartTime;
      let newSourceEnd = startSourceEndTime;
      if (type === 'left') {
        newSourceStart = Math.max(0, startSourceStartTime + (newStart - startStartTime));
      } else if (type === 'right') {
        newSourceEnd = startSourceStartTime + (newEnd - startStartTime);
      }

      setTracks((prev) =>
        prev.map((t) =>
          t.id === trackId
            ? {
                ...t,
                clips: t.clips.map((c) =>
                  c.id === clipId
                    ? {
                        ...c,
                        startTime: newStart,
                        endTime: newEnd,
                        sourceStartTime: newSourceStart,
                        sourceEndTime: newSourceEnd,
                        isTrimmed: type === 'left' || type === 'right' ? true : c.isTrimmed,
                      }
                    : c
                ),
              }
            : t
        )
      );

      if (trackId === 'track-1') {
        onStartTimeChange(newStart);
        onEndTimeChange(newEnd);
        onSeek(newStart);
      }
    };

    const handleMouseUp = () => {
      setDragTooltip(null);
      setHoveredDropTrackId(null);
      setSnapGuideTime(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      const finalTargetId = dragHoveredTrackIdRef.current || trackId;
      const finalStart = lastNewStartRef.current;
      const finalEnd = lastNewEndRef.current;

      let finalSourceStart = startSourceStartTime;
      let finalSourceEnd = startSourceEndTime;
      if (type === 'left') {
        finalSourceStart = Math.max(0, startSourceStartTime + (finalStart - startStartTime));
      } else if (type === 'right') {
        finalSourceEnd = startSourceStartTime + (finalEnd - startStartTime);
      }

      if (type === 'middle' && finalTargetId !== trackId) {
        // Move clip from source track into destination track (keeping all existing clips in both tracks!)
        setTracks((prev) => {
          const src = prev.find((t) => t.id === trackId);
          const dest = prev.find((t) => t.id === finalTargetId);
          if (!src || !dest) return prev;

          const clipToMove = src.clips.find((c) => c.id === clipId);
          if (!clipToMove) return prev;

          const updatedClip = {
            ...clipToMove,
            startTime: finalStart,
            endTime: finalEnd,
            sourceStartTime: finalSourceStart,
            sourceEndTime: finalSourceEnd,
          };

          return prev.map((t) => {
            if (t.id === trackId) {
              return { ...t, clips: t.clips.filter((c) => c.id !== clipId) };
            }
            if (t.id === finalTargetId) {
              return { ...t, clips: [...t.clips, updatedClip] };
            }
            return t;
          });
        });

        setActiveTrackId(finalTargetId);
        setActiveClipId(clipId);
        if (currentClip.file && onSelectFile && !isEncodeMode) {
          onSelectFile(currentClip.file, finalStart, currentClip.fileDuration, finalSourceStart, finalEnd);
        }
      } else {
        setTracks((prev) =>
          prev.map((t) =>
            t.id === trackId
              ? {
                  ...t,
                  clips: t.clips.map((c) =>
                    c.id === clipId
                      ? {
                          ...c,
                          startTime: finalStart,
                          endTime: finalEnd,
                          sourceStartTime: finalSourceStart,
                          sourceEndTime: finalSourceEnd,
                        }
                      : c
                  ),
                }
              : t
          )
        );
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Split at playhead: cuts the clip under playhead into TWO clips inside the SAME track!
  const handleSplitAtPlayhead = () => {
    if (computedTimelineDuration <= 0) return;
    const pos = currentTime;

    // Find the clip under playhead in active track or any visible track
    const activeTrack = tracks.find((t) => t.id === activeTrackId) || tracks[0];
    const targetClip =
      activeTrack.clips.find((c) => pos > c.startTime && pos < c.endTime) ||
      tracks.flatMap((t) => t.clips).find((c) => pos > c.startTime && pos < c.endTime);

    if (!targetClip) return;

    // Find which track holds targetClip
    const parentTrack = tracks.find((t) => t.clips.some((c) => c.id === targetClip.id));
    if (!parentTrack) return;

    const offset = pos - targetClip.startTime;
    const splitSourcePos = (targetClip.sourceStartTime || 0) + offset;

    const clipA: TimelineClip = {
      ...targetClip,
      id: `${targetClip.id}-a-${Date.now()}`,
      startTime: targetClip.startTime,
      endTime: pos,
      sourceStartTime: targetClip.sourceStartTime || 0,
      sourceEndTime: splitSourcePos,
    };

    const clipB: TimelineClip = {
      ...targetClip,
      id: `${targetClip.id}-b-${Date.now()}`,
      startTime: pos,
      endTime: targetClip.endTime,
      sourceStartTime: splitSourcePos,
      sourceEndTime:
        targetClip.sourceEndTime || targetClip.fileDuration || (targetClip.endTime - targetClip.startTime),
    };

    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === parentTrack.id) {
          const newClips: TimelineClip[] = [];
          t.clips.forEach((c) => {
            if (c.id === targetClip.id) {
              newClips.push(clipA, clipB);
            } else {
              newClips.push(c);
            }
          });
          return { ...t, clips: newClips };
        }
        return t;
      })
    );

    setActiveClipId(clipB.id);
  };

  // Mark In
  const handleMarkIn = () => {
    const activeTrack = tracks.find((t) => t.id === activeTrackId) || tracks[0];
    const targetClip = activeTrack.clips.find((c) => c.id === activeClipId) || activeTrack.clips[0];
    if (targetClip && currentTime < targetClip.endTime) {
      setTracks((prev) =>
        prev.map((t) =>
          t.id === activeTrack.id
            ? {
                ...t,
                clips: t.clips.map((c) => (c.id === targetClip.id ? { ...c, startTime: currentTime } : c)),
              }
            : t
        )
      );
      if (activeTrack.id === 'track-1') {
        onStartTimeChange(currentTime);
      }
    }
  };

  // Mark Out
  const handleMarkOut = () => {
    const activeTrack = tracks.find((t) => t.id === activeTrackId) || tracks[0];
    const targetClip = activeTrack.clips.find((c) => c.id === activeClipId) || activeTrack.clips[0];
    if (targetClip && currentTime > targetClip.startTime) {
      setTracks((prev) =>
        prev.map((t) =>
          t.id === activeTrack.id
            ? {
                ...t,
                clips: t.clips.map((c) => (c.id === targetClip.id ? { ...c, endTime: currentTime } : c)),
              }
            : t
        )
      );
      if (activeTrack.id === 'track-1') {
        onEndTimeChange(currentTime);
      }
    }
  };

  const progressPercent =
    computedTimelineDuration > 0 ? (currentTime / computedTimelineDuration) * 100 : 0;

  // Ruler tick marks calculated dynamically based on total computed timeline duration
  const rulerTicks = [];
  const tickCount = Math.min(30, Math.max(6, Math.floor(10 * zoomLevel)));
  for (let i = 0; i <= tickCount; i++) {
    const timeVal = (i / tickCount) * computedTimelineDuration;
    rulerTicks.push({
      percent: (i / tickCount) * 100,
      time: formatTime(timeVal),
    });
  }

  const displayedTracks = isEncodeMode 
    ? tracks 
    : (tracks.filter((t) => t.id === activeTrackId).length ? tracks.filter((t) => t.id === activeTrackId) : tracks.slice(0, 1));

  const getMediaIcon = (type: MediaType) => {
    switch (type) {
      case 'video':
        return <VideoIcon className="w-3 h-3 text-indigo-400" />;
      case 'audio':
        return <Music className="w-3 h-3 text-emerald-400" />;
      case 'image':
        return <ImageIcon className="w-3 h-3 text-amber-400" />;
      case 'text':
        return <FileSpreadsheet className="w-3 h-3 text-rose-400" />;
      default:
        return <Disc className="w-3 h-3 text-cyan-400" />;
    }
  };

  return (
    <div
      style={{ height: `${timelineHeight}px` }}
      className={`backdrop-blur-xl bg-slate-950/95 border-t border-white/15 px-4 pt-2.5 pb-2 flex flex-col space-y-2 select-none relative shrink-0 z-20 ${
        isResizingHeight ? 'transition-none' : 'transition-[height] duration-100 ease-out'
      }`}
    >
      {/* Top Splitter / Resize Drag Bar (Drag up/down to resize tools panel) */}
      <div
        className="absolute -top-2 left-0 right-0 h-4.5 z-50 cursor-row-resize flex items-center justify-center group select-none"
        onMouseDown={(e) => {
          e.preventDefault();
          startHeightResize(e.clientY);
        }}
        onTouchStart={(e) => {
          if (e.touches.length > 0) {
            startHeightResize(e.touches[0].clientY);
          }
        }}
        title="Drag up or down to resize timeline & toolbar"
      >
        <div className="w-20 h-1 rounded-full bg-slate-600/50 group-hover:bg-indigo-400 group-hover:h-1.5 group-hover:w-28 transition-all duration-150 shadow-sm flex items-center justify-center">
          <div className="w-6 h-0.5 bg-slate-300/40 rounded-full" />
        </div>
      </div>

      {/* Hidden File Input for Direct Track Media Upload */}
      <input
        ref={trackFileInputRef}
        type="file"
        accept="video/*,audio/*,image/*"
        className="hidden"
        onChange={handleTrackFileChange}
      />

      {/* Top Controls Toolbar */}
      <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
        {/* Playback Controls & Time Display & Auto-Expanding File Bar */}
        <div className="flex-1 min-w-0 flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              onClick={onFullscreenClick}
              className="h-8 w-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center shadow-sm border border-white/10 transition shrink-0 cursor-pointer"
              title="Fullscreen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onTogglePlay}
              className={`h-8 w-8 rounded-lg flex items-center justify-center text-white shadow-md transition shrink-0 cursor-pointer ${
                isEncodeMode
                  ? 'bg-violet-600 hover:bg-violet-500 shadow-violet-600/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
            </button>
          </div>

          <div className="font-mono text-xs font-medium leading-snug flex flex-col justify-center shrink-0 select-none">
            <span className={isEncodeMode ? 'text-violet-400 font-bold' : 'text-indigo-400 font-bold'}>
              {formatTime(currentTime, computedTimelineDuration)}
            </span>
            <span className="text-slate-400 font-bold text-[10px]">
              {formatTime(computedTimelineDuration || 0)}
            </span>
          </div>

          {/* Timeline Editing Split Button */}
          {isEncodeMode && (
          <div className="flex items-center space-x-1 pl-2 border-l border-white/10 shrink-0">
            <button
              onClick={handleSplitAtPlayhead}
              className="h-8 px-2.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg border border-white/10 text-xs font-medium flex items-center space-x-1.5 transition cursor-pointer shadow-sm"
              title="Split clip at current playhead position"
            >
              <Scissors className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Split</span>
            </button>
          </div>
          )}

          {/* Multi-file Reorder Bar (Fast Copy / Remux mode only - hidden in Encode mode) */}
          {!isEncodeMode && selectedFiles && selectedFiles.length > 1 && (
            <div className="flex-1 min-w-0 flex items-center space-x-1.5 pl-2 border-l border-white/10 overflow-hidden">
              <div className="text-[10px] font-semibold text-indigo-400 whitespace-nowrap bg-indigo-950/80 px-2 py-1 rounded border border-indigo-500/30 flex items-center space-x-1 shrink-0">
                <span>Files ({selectedFiles.length})</span>
              </div>
              <div className="flex items-center space-x-1 overflow-x-auto py-0.5 flex-1 min-w-0">
                {selectedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, idx)}
                    onClick={() => {
                      if (tracks[idx]) {
                        setActiveTrackId(tracks[idx].id);
                      }
                      if (!isEncodeMode) {
                        onSelectFile?.(file);
                      }
                    }}
                    className={`flex items-center space-x-1 bg-slate-900/90 border ${
                      draggedIdx === idx
                        ? 'border-indigo-400 opacity-50'
                        : selectedFiles[idx]?.name ===
                          (tracks.find((t) => t.id === activeTrackId)?.fileName ||
                            tracks.find((t) => t.id === activeTrackId)?.name)
                        ? 'border-indigo-400 bg-indigo-950/70 shadow-[0_0_8px_rgba(99,102,241,0.3)]'
                        : 'border-white/10 hover:border-indigo-500/50'
                    } px-2 py-0.5 rounded text-[11px] whitespace-nowrap cursor-pointer transition shrink-0`}
                    title="Click to preview, drag or use arrows to reorder"
                  >
                    <span className="text-indigo-300 font-mono font-bold">#{idx + 1}</span>
                    <span className="text-slate-200 truncate max-w-[120px] lg:max-w-[180px]">
                      {file.name}
                    </span>
                    <div className="flex items-center space-x-0.5 ml-1 pl-1 border-l border-white/10">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveFile(idx, 'left');
                        }}
                        disabled={idx === 0}
                        className="p-0.5 hover:bg-white/10 rounded disabled:opacity-30 text-slate-300 cursor-pointer"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveFile(idx, 'right');
                        }}
                        disabled={idx === selectedFiles.length - 1}
                        className="p-0.5 hover:bg-white/10 rounded disabled:opacity-30 text-slate-300 cursor-pointer"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons Cluster */}
        <div className="flex items-center space-x-1.5 shrink-0">
          {/* Zoom Controls (ONLY in Encode Mode) */}
          {isEncodeMode && (
            <div className="h-8 flex items-center space-x-0.5 bg-slate-900/80 border border-white/10 rounded-lg px-1 shrink-0">
              <button
                onClick={() => setZoomLevel((z) => Math.max(1, z - 0.5))}
                disabled={zoomLevel <= 1}
                className="h-6 w-6 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 rounded transition cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono text-indigo-300 px-1 font-bold">
                {zoomLevel.toFixed(1)}x
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(3, z + 0.5))}
                disabled={zoomLevel >= 3}
                className="h-6 w-6 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 rounded transition cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Single File Upload Button */}
          <button
            onClick={onUploadClick}
            title="Select File (Single)"
            className="h-8 w-8 flex items-center justify-center bg-white/5 hover:bg-white/10 text-slate-200 rounded-lg transition border border-white/10 backdrop-blur-sm group shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
          </button>

          {/* Multiple Files Upload Button */}
          <button
            onClick={onMultiUploadClick}
            title="Select Multiple Files"
            className="h-8 w-8 flex items-center justify-center bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-200 rounded-lg transition border border-indigo-500/30 backdrop-blur-sm group shrink-0 cursor-pointer"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
          </button>

          {/* Remux Button: ONLY shown when NOT in Encode Mode */}
          {!isEncodeMode && (!selectedFiles || selectedFiles.length <= 1) && (
            <button
              onClick={() => onExportClick(tracks)}
              disabled={isProcessing}
              className="h-8 px-2.5 flex items-center justify-center bg-indigo-950/60 hover:bg-indigo-900/80 disabled:bg-indigo-950/30 text-indigo-200 rounded-lg text-[11px] font-semibold border border-indigo-500/30 backdrop-blur-sm shadow-md transition transform active:scale-95 shrink-0 cursor-pointer"
              title="Remux (Fast Lossless Copy)"
            >
              <span>Remux</span>
            </button>
          )}

          {/* Export / Encode Button */}
          <button
            onClick={() => onExportClick(tracks)}
            disabled={isProcessing}
            className={`h-8 px-3.5 flex items-center space-x-1 text-white rounded-lg text-xs font-semibold shadow-md transition transform active:scale-95 shrink-0 cursor-pointer ${
              isEncodeMode
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-violet-500/25'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'
            }`}
            title={isEncodeMode ? 'Encode & Export with WebCodecs API' : 'Export Video'}
          >
            {isEncodeMode ? <Sparkles className="w-3 h-3 text-amber-300" /> : <Download className="w-3.5 h-3.5" />}
            <span>{isEncodeMode ? 'Encode' : 'Export'}</span>
          </button>
        </div>
      </div>

      {/* Universal Timeline Workspace (Same unified layout & calculation for Copy Mode and Encode Mode) */}
      {!computedTimelineDuration || computedTimelineDuration <= 0 ? (
        /* Empty / Idle State Timeline with clean ruler and empty track placeholder */
        <div className="flex border border-white/15 rounded-xl overflow-hidden bg-black/60 shadow-inner select-none opacity-60 flex-1 min-h-0">
          {/* Left Track Header */}
          <div className="w-44 shrink-0 bg-slate-950/95 border-r border-white/10 flex flex-col divide-y divide-white/10 z-20">
            <div className="h-4 bg-black/80 px-2 flex items-center justify-between border-b border-white/10 shrink-0">
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wider">Track</span>
              <span className="text-[8px] font-mono text-slate-500">Ready</span>
            </div>
            <div className="h-14 px-2 py-1 flex items-center justify-between bg-slate-900/40 shrink-0">
              <div className="flex items-center space-x-1.5">
                <VideoIcon className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[11px] font-medium text-slate-500">Main Video</span>
              </div>
            </div>
          </div>

          {/* Right Empty Ruler & Track Area */}
          <div className="flex-1 relative overflow-hidden flex flex-col min-h-0">
            <div className="h-4 bg-black/70 border-b border-white/10 flex items-center relative shrink-0">
              {['00:00.0', '00:05.0', '00:10.0', '00:15.0', '00:20.0', '00:25.0', '00:30.0'].map((tick, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l border-white/15 pl-0.5 flex items-center"
                  style={{ left: `${(i / 6) * 100}%` }}
                >
                  <span className="text-[8px] font-mono text-slate-600 leading-none">{tick}</span>
                </div>
              ))}
            </div>
            <div className="flex-1 min-h-[56px] bg-slate-950/60 relative [background-image:linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:28px_100%] flex items-center justify-center">
              <div className="text-[11px] text-slate-500 font-mono flex items-center space-x-1.5 pointer-events-none">
                <span>Timeline Ready</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex border border-white/15 rounded-xl overflow-hidden bg-black/60 shadow-inner flex-1 min-h-0">
        {/* Track Headers Panel (Left side: Name, Media Type Tag, Mute, Lock, Hide, Color, Upload, Delete) */}
        <div
          ref={leftHeadersScrollRef}
          onScroll={(e) => {
            if (timelineScrollRef.current && timelineScrollRef.current.scrollTop !== e.currentTarget.scrollTop) {
              timelineScrollRef.current.scrollTop = e.currentTarget.scrollTop;
            }
          }}
          className="w-44 shrink-0 bg-slate-950/95 border-r border-white/10 flex flex-col z-20 overflow-y-auto min-h-0"
        >
          {/* Top Header Label */}
          <div className="h-4 bg-black/80 px-2 flex items-center justify-between border-b border-white/10 shrink-0 sticky top-0 z-30">
            <span className="text-[8px] font-mono text-slate-400 uppercase tracking-wider">
              {isEncodeMode ? "Universal Tracks" : "Track"}
            </span>
            <div className="flex items-center space-x-2">
              <span className="text-[8px] font-mono text-indigo-400 font-bold">
                {isEncodeMode ? `${displayedTracks.length} Tracks` : "Ready"}
              </span>
              {isEncodeMode && (
                <button
                  onClick={handleAddTrack}
                  className="p-0.5 text-slate-400 hover:text-white hover:bg-white/10 rounded cursor-pointer transition-colors"
                  title="Add New Track"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Track Headers List */}
          <div className="flex flex-col divide-y divide-white/10">
          {displayedTracks.map((track) => {
            const isActive = activeTrackId === track.id;
            const colorConfig = COLOR_CLASSES[track.color] || COLOR_CLASSES.indigo;
            const isEditing = editingTrackId === track.id;

            return (
              <div
                key={track.id}
                onClick={() => {
                  setActiveTrackId(track.id);
                  const firstClip = track.clips?.[0];
                  if (firstClip?.file && onSelectFile && !isEncodeMode) {
                    onSelectFile(firstClip.file, firstClip.startTime, firstClip.fileDuration);
                  }
                }}
                className={`h-14 px-2 py-1 flex flex-col justify-between cursor-pointer transition ${
                  isActive
                    ? `${colorConfig.headerBg} border-l-2 ${colorConfig.headerBorder}`
                    : 'hover:bg-white/5 border-l-2 border-transparent'
                }`}
              >
                {/* Track Top Row: Icon + Name / Inline Edit + Color / Delete */}
                <div className="flex items-center justify-between space-x-1">
                  <div className="flex items-center space-x-1 overflow-hidden flex-1">
                    {/* Media Type Switcher Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        cycleMediaType(track.id);
                      }}
                      className="p-0.5 rounded hover:bg-white/10 transition cursor-pointer"
                      title={`Media Type: ${track.mediaType} (Click to cycle type)`}
                    >
                      {getMediaIcon(track.mediaType)}
                    </button>

                    {/* Track Name or Inline Input */}
                    {isEditing ? (
                      <div className="flex items-center space-x-0.5 flex-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(track.id);
                            if (e.key === 'Escape') setEditingTrackId(null);
                          }}
                          autoFocus
                          className="bg-slate-900 text-white text-[10px] px-1 py-0.2 rounded border border-indigo-500 w-full focus:outline-none"
                        />
                        <button
                          onClick={() => handleSaveRename(track.id)}
                          className="p-0.5 text-emerald-400 hover:text-emerald-300"
                        >
                          <Check className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ) : (
                      <span
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(track);
                        }}
                        className="text-[11px] font-medium text-slate-200 truncate flex-1 flex items-center space-x-1"
                        title="Double-click to rename"
                      >
                        <span className="truncate">{track.name}</span>
                        {track.clips?.length > 0 && (
                          <span className="text-[8px] text-indigo-400 font-mono bg-indigo-950/80 px-1 py-0.2 rounded border border-indigo-500/20 shrink-0">
                            {track.clips.length}
                          </span>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Actions: Color tag, Duplicate, Delete */}
                  <div className="flex items-center space-x-0.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        cycleTrackColor(track.id);
                      }}
                      className={`w-2.5 h-2.5 rounded-full border border-white/20 transition cursor-pointer bg-${track.color}-500`}
                      style={{
                        backgroundColor:
                          track.color === 'indigo'
                            ? '#6366f1'
                            : track.color === 'violet'
                            ? '#8b5cf6'
                            : track.color === 'emerald'
                            ? '#10b981'
                            : track.color === 'amber'
                            ? '#f59e0b'
                            : track.color === 'rose'
                            ? '#f43f5e'
                            : track.color === 'cyan'
                            ? '#06b6d4'
                            : '#d946ef',
                      }}
                      title="Change Track Color"
                    />

                    {isEncodeMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateTrack(track.id);
                        }}
                        className="text-slate-500 hover:text-indigo-300 p-0.5 rounded cursor-pointer"
                        title="Duplicate Track"
                      >
                        <Copy className="w-2.5 h-2.5" />
                      </button>
                    )}

                    {isEncodeMode && tracks.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTrack(track.id);
                        }}
                        className="text-slate-500 hover:text-rose-400 p-0.5 rounded cursor-pointer"
                        title="Delete Track"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Track Bottom Controls: File attach, Mute, Lock, Hide, Edit */}
                <div className="flex items-center justify-between pt-0.5 border-t border-white/5">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTrackHidden(track.id);
                      }}
                      className={`p-1 rounded text-[10px] transition cursor-pointer ${
                        track.hidden ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400 hover:text-white'
                      }`}
                      title={track.hidden ? 'Show Track' : 'Hide Track'}
                    >
                      {track.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTrackMute(track.id);
                      }}
                      className={`p-1 rounded text-[10px] transition cursor-pointer ${
                        track.muted ? 'text-amber-400 bg-amber-500/10' : 'text-slate-400 hover:text-white'
                      }`}
                      title={track.muted ? 'Unmute Track' : 'Mute Track'}
                    >
                      {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTrackLock(track.id);
                      }}
                      className={`p-1 rounded text-[10px] transition cursor-pointer ${
                        track.locked ? 'text-red-400 bg-red-500/10' : 'text-slate-400 hover:text-white'
                      }`}
                      title={track.locked ? 'Unlock Track' : 'Lock Track'}
                    >
                      {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Direct Add File / Media to Track */}
                  <div className="flex items-center space-x-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTrackFileSelect(track.id);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-indigo-300 hover:bg-white/10 transition cursor-pointer flex items-center space-x-0.5 text-[9px]"
                      title="Attach media file (image/audio/video) directly to this track"
                    >
                      <FilePlus className="w-2.5 h-2.5" />
                      <span className="hidden sm:inline">Media</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartRename(track);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-slate-200 transition cursor-pointer"
                      title="Rename Track"
                    >
                      <Edit2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>

        {/* Tracks Main Scrubbing & Trimming Area */}
        <div
          ref={timelineScrollRef}
          onScroll={(e) => {
            if (leftHeadersScrollRef.current && leftHeadersScrollRef.current.scrollTop !== e.currentTarget.scrollTop) {
              leftHeadersScrollRef.current.scrollTop = e.currentTarget.scrollTop;
            }
          }}
          className="flex-1 relative overflow-x-auto overflow-y-auto min-h-0"
        >
          <div
            ref={trimContainerRef}
            className={`relative select-none ${isScrubbing ? 'cursor-grabbing' : 'cursor-default'}`}
            style={{ width: `${(isEncodeMode ? zoomLevel : 1) * 100}%`, minWidth: '100%' }}
            onMouseDown={(e) => {
              // If clicked directly on tracks container background (not on a clip or button)
              const target = e.target as HTMLElement;
              if (
                target === trimContainerRef.current ||
                target.classList.contains('track-row-canvas') ||
                target.classList.contains('ruler-bar')
              ) {
                handleStartScrub(e);
              }
            }}
          >
            {/* 1. Top Ruler (Ticks & Timestamps) - Click or Drag anywhere to scrub smoothly */}
            <div
              onMouseDown={handleStartScrub}
              className="ruler-bar h-5 bg-slate-950/90 hover:bg-slate-900 border-b border-white/10 flex items-center relative z-20 cursor-pointer select-none transition-colors"
              title="Click or drag ruler to scrub video"
            >
              {rulerTicks.map((tick, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l border-white/20 pl-0.5 flex items-center pointer-events-none"
                  style={{ left: `${tick.percent}%` }}
                >
                  <span className="text-[8px] font-mono text-slate-400 leading-none select-none">{tick.time}</span>
                </div>
              ))}
            </div>

            {/* 2. Track Rows Stack */}
            <div ref={tracksStackRef} className="flex flex-col divide-y divide-white/10">
              {displayedTracks.map((track, trackIdx) => {
                const isActive = activeTrackId === track.id;
                const isDropTarget = hoveredDropTrackId === track.id;
                const colorConfig = COLOR_CLASSES[track.color] || COLOR_CLASSES.indigo;
                const hasClips = track.clips && track.clips.length > 0;

                return (
                  <div
                    key={track.id}
                    className={`relative h-14 transition ${
                      track.hidden ? 'opacity-25' : 'opacity-100'
                    } ${
                      isDropTarget
                        ? 'bg-indigo-900/40 ring-2 ring-indigo-400 ring-inset z-10'
                        : isActive
                        ? colorConfig.headerBg
                        : 'bg-slate-950/70'
                    } [background-image:linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:32px_100%]`}
                  >
                    {/* Empty Track Placeholder (if no clip on this track) */}
                    {!hasClips && (
                      <div className="absolute inset-x-2 top-2 bottom-2 rounded border border-dashed border-white/15 pointer-events-none select-none">
                      </div>
                    )}

                    {/* All Clips in this Track */}
                    {hasClips &&
                      track.clips.map((clip, clipIdx) => {
                        const clipStartPct =
                          computedTimelineDuration > 0 ? (clip.startTime / computedTimelineDuration) * 100 : 0;
                        const clipEndPct =
                          computedTimelineDuration > 0 ? (clip.endTime / computedTimelineDuration) * 100 : 100;
                        const clipDuration = Math.max(0, clip.endTime - clip.startTime);
                        const isClipActive = activeClipId === clip.id || (isActive && clipIdx === 0 && !activeClipId);
                        const clipColorConfig = COLOR_CLASSES[clip.color || track.color] || colorConfig;

                        // Thumbnails for this clip's file
                        const clipFileKey = clip.file ? getFileKey(clip.file) : null;
                        const clipThumbs = clipFileKey && fileThumbnails[clipFileKey] && fileThumbnails[clipFileKey].length > 0
                          ? fileThumbnails[clipFileKey]
                          : (thumbnails.length > 0 ? thumbnails : null);

                        const clipImageSrc = (clipFileKey && fileThumbnails[clipFileKey]?.[0]) || clip.previewUrl;

                        return (
                          <div
                            key={clip.id}
                            className={`absolute top-1 bottom-1 rounded-md shadow-xl z-20 overflow-hidden cursor-grab active:cursor-grabbing select-none border-2 transition group ${
                              clipColorConfig.clipBorder
                            } ${clipColorConfig.clipBg} ${isClipActive ? 'ring-2 ring-white/60 shadow-indigo-500/20' : ''}`}
                            style={{
                              left: `${clipStartPct}%`,
                              width: `${Math.max(0.8, clipEndPct - clipStartPct)}%`,
                            }}
                            onMouseDown={(e) => startTrimDrag(e, 'middle', track.id, clip.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTrackId(track.id);
                              setActiveClipId(clip.id);
                              if (clip.file && onSelectFile && !isEncodeMode) {
                                onSelectFile(clip.file, clip.startTime, clip.fileDuration);
                              }
                            }}
                          >
                            {/* Visualizer INSIDE Clip: Video Filmstrip, Audio Waveform, Image, or Pattern */}
                            {clip.mediaType === 'video' || (clipThumbs && clipThumbs.length > 0) || clip.file?.type.startsWith('video/') ? (
                              <div className="absolute inset-0 flex items-stretch overflow-hidden pointer-events-none opacity-75">
                                {clipThumbs && clipThumbs.length > 0 ? (
                                  clipThumbs.map((thumb, idx) => (
                                    <div
                                      key={idx}
                                      className="relative h-full flex-1 min-w-[36px] overflow-hidden bg-slate-900 border-r border-white/10 last:border-r-0 shrink-0"
                                    >
                                      <img
                                        src={thumb}
                                        alt={`${clip.name} Frame ${idx + 1}`}
                                        className="w-full h-full object-cover select-none pointer-events-none"
                                      />
                                    </div>
                                  ))
                                ) : (
                                  Array.from({ length: 8 }).map((_, idx) => (
                                    <div
                                      key={idx}
                                      className="relative h-full flex-1 min-w-[40px] overflow-hidden bg-slate-900/90 border-r border-white/10 last:border-r-0 flex items-center justify-center shrink-0"
                                    >
                                      <span className="text-[8px] text-slate-400 font-mono">
                                        {clip.fileName ? clip.fileName.slice(0, 6) : `F${idx + 1}`}
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            ) : clip.mediaType === 'audio' || clip.file?.type.startsWith('audio/') ? (
                              /* Audio Waveform inside clip */
                              <div className="absolute inset-0 flex items-center justify-around px-2 pointer-events-none opacity-70">
                                {Array.from({ length: 36 }).map((_, i) => {
                                  const seed = (trackIdx + clipIdx + 1) * 1.37;
                                  const h = 20 + Math.sin((i + seed * 3) * 0.7) * 16 + Math.cos((i + seed) * 0.4) * 12;
                                  return (
                                    <div
                                      key={i}
                                      className="w-1 bg-emerald-400 rounded-full shrink-0"
                                      style={{ height: `${Math.max(10, Math.min(95, h))}%` }}
                                    />
                                  );
                                })}
                              </div>
                            ) : (clip.mediaType === 'image' || clip.file?.type.startsWith('image/')) && clipImageSrc ? (
                              /* Image Preview inside clip */
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-80 overflow-hidden bg-slate-900">
                                <img
                                  src={clipImageSrc}
                                  alt="Clip Image"
                                  className="w-full h-full object-cover select-none pointer-events-none"
                                />
                              </div>
                            ) : (
                              /* Universal subtle Pattern inside clip */
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:12px_12px]" />
                            )}

                            {/* Semi-transparent tint overlay matching clip color */}
                            <div className={`absolute inset-0 pointer-events-none opacity-30 ${clipColorConfig.clipBg}`} />

                            {/* Left Trim Handle */}
                            {!track.locked && (
                              <div
                                className={`absolute left-0 top-0 bottom-0 w-3 rounded-l-[3px] shadow-md cursor-ew-resize z-30 shrink-0 flex items-center justify-center group ${clipColorConfig.clipHandle}`}
                                onMouseDown={(e) => startTrimDrag(e, 'left', track.id, clip.id)}
                                onClick={(e) => e.stopPropagation()}
                                title="Drag to adjust Start (In point)"
                              >
                                <div className="w-0.5 h-3.5 bg-slate-950/80 rounded-full" />
                              </div>
                            )}

                            {/* Right Trim Handle */}
                            {!track.locked && (
                              <div
                                className={`absolute right-0 top-0 bottom-0 w-3 rounded-r-[3px] shadow-md cursor-ew-resize z-30 shrink-0 flex items-center justify-center group ${clipColorConfig.clipHandle}`}
                                onMouseDown={(e) => startTrimDrag(e, 'right', track.id, clip.id)}
                                onClick={(e) => e.stopPropagation()}
                                title="Drag to adjust End (Out point)"
                              >
                                <div className="w-0.5 h-3.5 bg-slate-950/80 rounded-full" />
                              </div>
                            )}

                            {/* Clip Name & Time Badge + Quick Actions Bar */}
                            <div className="relative z-20 flex items-center justify-between px-2 w-full h-full pointer-events-none overflow-hidden">
                              <div className="flex items-center space-x-1 min-w-0 truncate">
                                <span className="shrink-0 drop-shadow">{getMediaIcon(clip.mediaType)}</span>
                                <span
                                  className={`text-[9px] font-mono font-bold text-white px-2 py-0.5 rounded shadow-md whitespace-nowrap truncate backdrop-blur-md ${clipColorConfig.clipText}`}
                                >
                                  {clip.fileName ? clip.fileName : clip.name}: {formatTime(clip.startTime)} - {formatTime(clip.endTime)} ({formatTime(clipDuration)})
                                </span>
                              </div>

                              {/* Quick Move Inter-Track & Clip Action Buttons (Visible on hover) */}
                              <div className="flex items-center space-x-0.5 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/90 rounded px-1 py-0.5 border border-white/20 shadow-lg shrink-0">
                                {isEncodeMode && trackIdx > 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMoveClipToTrack(track.id, clip.id, displayedTracks[trackIdx - 1].id);
                                    }}
                                    className="p-0.5 text-slate-300 hover:text-white hover:bg-white/20 rounded transition cursor-pointer"
                                    title="Move Clip Up to Previous Track"
                                  >
                                    <ArrowUp className="w-2.5 h-2.5" />
                                  </button>
                                )}
                                {isEncodeMode && trackIdx < displayedTracks.length - 1 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMoveClipToTrack(track.id, clip.id, displayedTracks[trackIdx + 1].id);
                                    }}
                                    className="p-0.5 text-slate-300 hover:text-white hover:bg-white/20 rounded transition cursor-pointer"
                                    title="Move Clip Down to Next Track"
                                  >
                                    <ArrowDown className="w-2.5 h-2.5" />
                                  </button>
                                )}
                                {isEncodeMode && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMoveMenuClipId(activeMoveMenuClipId === clip.id ? null : clip.id);
                                  }}
                                  className="p-0.5 text-indigo-300 hover:text-white hover:bg-indigo-600/50 rounded transition cursor-pointer flex items-center space-x-0.5 text-[8px] font-medium"
                                  title="Move to any Track..."
                                >
                                  <MoveVertical className="w-2.5 h-2.5" />
                                </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicateClip(track.id, clip.id);
                                  }}
                                  className="p-0.5 text-slate-300 hover:text-indigo-300 hover:bg-white/20 rounded transition cursor-pointer"
                                  title="Duplicate Clip in this Track"
                                >
                                  <Copy className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClip(track.id, clip.id);
                                  }}
                                  className="p-0.5 text-slate-400 hover:text-rose-400 hover:bg-white/20 rounded transition cursor-pointer"
                                  title="Delete Clip"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>

                            {/* Move To Track Dropdown Popup for this Clip */}
                            {activeMoveMenuClipId === clip.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute top-7 right-2 z-50 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-1.5 min-w-[140px] flex flex-col space-y-1 text-[10px]"
                              >
                                <span className="text-[9px] text-slate-400 font-semibold px-1.5 py-0.5 border-b border-white/10">
                                  Move Clip To:
                                </span>
                                {tracks.map((targetT) => {
                                  if (targetT.id === track.id) return null;
                                  return (
                                    <button
                                      key={targetT.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMoveClipToTrack(track.id, clip.id, targetT.id);
                                      }}
                                      className="w-full text-left px-2 py-1 rounded hover:bg-indigo-600 hover:text-white text-slate-200 transition cursor-pointer flex items-center justify-between"
                                    >
                                      <span>{targetT.name}</span>
                                      <span className="text-[8px] text-slate-400 font-mono">
                                        ({targetT.clips.length} clips)
                                      </span>
                                    </button>
                                  );
                                })}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveClipToNewTrack(track.id, clip.id);
                                  }}
                                  className="w-full text-left px-2 py-1 rounded hover:bg-emerald-600 hover:text-white text-emerald-300 transition cursor-pointer flex items-center space-x-1 border-t border-white/10 pt-1"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                  <span>+ New Track</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>

            {/* 3. Magnetic Snap Vertical Guideline & Indicator */}
            {snapGuideTime !== null && computedTimelineDuration > 0 && (
              <div
                className="absolute top-0 bottom-0 z-40 pointer-events-none flex flex-col items-center -translate-x-1/2"
                style={{ left: `${(snapGuideTime / computedTimelineDuration) * 100}%` }}
              >
                <div className="bg-amber-400 text-slate-950 font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-lg flex items-center space-x-1 -translate-y-1">
                  <Magnet className="w-2.5 h-2.5 fill-current" />
                  <span>Snap {formatTime(snapGuideTime)}</span>
                </div>
                <div className="w-[1.5px] flex-1 bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
              </div>
            )}

            {/* 4. Playhead Vertical Needle & Cat Handle (Spans through entire ruler and all tracks) */}
            <div
              className="absolute top-0 bottom-0 z-30 pointer-events-none flex flex-col items-center -translate-x-1/2"
              style={{ left: `${progressPercent}%` }}
            >
              {/* Cat Handle on Ruler - Highly interactive, draggable with grab cursor */}
              <div
                onMouseDown={handleStartScrub}
                className="pointer-events-auto cursor-grab active:cursor-grabbing p-1.5 -m-1.5 flex items-center justify-center group/cat hover:scale-125 transition-transform z-30 select-none"
                title="Drag cat to scrub video timeline"
              >
                <img
                  src={wcatSeekPng}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = wcatSeekSvg;
                  }}
                  alt="Playhead Cat"
                  className="h-5 w-auto max-w-none object-contain select-none drop-shadow-[0_2px_8px_rgba(244,63,94,0.7)] group-hover/cat:brightness-110 pointer-events-none"
                />
              </div>
              {/* Playhead Needle Line through all stacked tracks */}
              <div
                onMouseDown={handleStartScrub}
                className="w-[2px] flex-1 bg-rose-500 shadow-[0_0_10px_#f43f5e] pointer-events-auto cursor-col-resize hover:w-[4px] transition-all"
                title="Drag red line to seek"
              />
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
