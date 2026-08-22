import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { formatTime } from '../utils/sampleVideos';
import wcatSeekPng from '../../assets/Wcat seek.png';
import wcatSeekSvg from '../../public/wcat-seek.svg';

export type MediaType = 'any' | 'video' | 'audio' | 'image' | 'text';
export type TrackColor = 'indigo' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'fuchsia';

export interface TimelineTrackData {
  id: string;
  name: string;
  mediaType: MediaType;
  color: TrackColor;
  startTime: number;
  endTime: number;
  muted: boolean;
  locked: boolean;
  hidden: boolean;
  fileName?: string;
  file?: File;
  previewUrl?: string;
  volume?: number;
}

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
  onSelectFile?: (file: File) => void;
  onUploadClick: () => void;
  onMultiUploadClick?: () => void;
  onReset: () => void;
  onExportClick: () => void;
  onFullscreenClick: () => void;
  isLoaded: boolean;
  isProcessing: boolean;
  isEncodeMode?: boolean;
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
}) => {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [dragTooltip, setDragTooltip] = useState<string | null>(null);
  const [activeTrackId, setActiveTrackId] = useState<string>('track-1');
  const [viewMode, setViewMode] = useState<'stacked' | 'active'>('stacked');
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  // Universal, Free-form Timeline Tracks (เริ่มต้นมี 2 แทร็กอิสระ รองรับภาพ/เสียง/วิดีโอ/ข้อความได้ทั้งหมดโดยไม่มีข้อจำกัด)
  const [tracks, setTracks] = useState<TimelineTrackData[]>([
    {
      id: 'track-1',
      name: 'Track 1',
      mediaType: 'any',
      color: 'indigo',
      startTime: 0,
      endTime: duration || 10,
      muted: false,
      locked: false,
      hidden: false,
    },
    {
      id: 'track-2',
      name: 'Track 2',
      mediaType: 'any',
      color: 'violet',
      startTime: 0,
      endTime: duration ? duration * 0.8 : 8,
      muted: false,
      locked: false,
      hidden: false,
    },
  ]);

  const trimContainerRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const trackFileInputRef = useRef<HTMLInputElement>(null);
  const [targetUploadTrackId, setTargetUploadTrackId] = useState<string | null>(null);

  // Independent Thumbnail Cache per File/Media
  const [fileThumbnails, setFileThumbnails] = useState<Record<string, string[]>>({});

  const getFileKey = (file: File): string => `${file.name}_${file.size}_${file.lastModified}`;

  // Helper to extract thumbnails for a specific video file
  const extractThumbnailsForFile = (file: File) => {
    const key = getFileKey(file);
    if (fileThumbnails[key] && fileThumbnails[key].length > 0) return;

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
      const fileDur = video.duration || 10;
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
        if (!fileThumbnails[key]) {
          const imgUrl = URL.createObjectURL(file);
          setFileThumbnails((prev) => ({ ...prev, [key]: [imgUrl] }));
        }
        return;
      }

      // 2. Video File Thumbnails Extraction (Specific to this video file)
      if (mediaType === 'video') {
        extractThumbnailsForFile(file);
      }
    });
  }, [selectedFiles]);

  // Sync track 1 start/end with external props
  useEffect(() => {
    setTracks((prev) =>
      prev.map((tr) => {
        if (tr.id === 'track-1') {
          return { ...tr, startTime, endTime: endTime > 0 ? endTime : duration || 10 };
        }
        return tr;
      })
    );
  }, [startTime, endTime, duration]);

  // Sync timeline tracks dynamically according to the number of files (เพิ่ม Timeline ตามจำนวนไฟล์)
  useEffect(() => {
    if (selectedFiles && selectedFiles.length > 0) {
      setTracks((prev) => {
        const colorOrder: TrackColor[] = ['indigo', 'violet', 'emerald', 'amber', 'rose', 'cyan', 'fuchsia'];
        // If there's 1 file, maintain at least 2 tracks (Track 1 with file, Track 2 ready as an open/free track)
        // If there are N files (N >= 2), create/sync N tracks (one for each file)
        const targetCount = Math.max(2, selectedFiles.length);
        const newTracks: TimelineTrackData[] = [];

        for (let i = 0; i < targetCount; i++) {
          const file = selectedFiles[i];
          const existing = prev[i];
          const assignedColor = colorOrder[i % colorOrder.length];
          const detectedType = file ? detectMediaType(file) : (existing?.mediaType || 'any');

          if (file) {
            newTracks.push({
              id: existing ? existing.id : `track-${i + 1}-${Date.now()}`,
              name: existing?.name && existing.name !== `Track ${i + 1}` && !existing.name.startsWith('Track ')
                ? existing.name
                : file.name,
              mediaType: detectedType,
              color: existing?.color || assignedColor,
              startTime: existing?.startTime !== undefined ? existing.startTime : 0,
              endTime: existing?.endTime && existing.endTime > 0 ? existing.endTime : (duration || 10),
              muted: existing?.muted || false,
              locked: existing?.locked || false,
              hidden: existing?.hidden || false,
              fileName: file.name,
              file: file,
              previewUrl: existing?.previewUrl || (file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined),
            });
          } else {
            // Additional open track
            newTracks.push({
              id: existing ? existing.id : `track-${i + 1}-${Date.now()}`,
              name: existing?.name || `Track ${i + 1}`,
              mediaType: existing?.mediaType || 'any',
              color: existing?.color || assignedColor,
              startTime: existing?.startTime !== undefined ? existing.startTime : 0,
              endTime: existing?.endTime && existing.endTime > 0 ? existing.endTime : (duration || 10),
              muted: existing?.muted || false,
              locked: existing?.locked || false,
              hidden: existing?.hidden || false,
              fileName: existing?.fileName,
              file: existing?.file,
              previewUrl: existing?.previewUrl,
            });
          }
        }

        return newTracks;
      });
    }
  }, [selectedFiles, duration]);

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
      startTime: 0,
      endTime: duration || 10,
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

  // Direct file attachment to a specific track
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
      prev.map((t) =>
        t.id === targetUploadTrackId
          ? {
              ...t,
              fileName: file.name,
              file: file,
              mediaType: detectedType,
              previewUrl: url,
            }
          : t
      )
    );

    // If track 1 was updated with a video/audio, notify parent if desirable
    if (targetUploadTrackId === 'track-1' && onSelectFile) {
      onSelectFile(file);
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

  // Multi-file drag and drop
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

  // Universal Clip Dragging (ลาก, ย่อ, ขยาย สำหรับ track ที่เลือกได้อิสระ)
  const startTrimDrag = (
    e: React.MouseEvent,
    type: 'left' | 'right' | 'middle',
    trackId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const currentTrack = tracks.find((t) => t.id === trackId);
    if (!currentTrack || currentTrack.locked) return;

    setActiveTrackId(trackId);

    if (!trimContainerRef.current) return;

    const startX = e.clientX;
    const startStartTime = currentTrack.startTime;
    const startEndTime = currentTrack.endTime;
    const rect = trimContainerRef.current.getBoundingClientRect();
    const containerWidth = rect.width || 500;
    const totalDuration = duration || 10;
    const minSpan = Math.max(0.1, (20 / containerWidth) * totalDuration);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaTime = (deltaX / containerWidth) * totalDuration;

      let newStart = startStartTime;
      let newEnd = startEndTime;

      if (type === 'middle') {
        const span = startEndTime - startStartTime;
        newStart = startStartTime + deltaTime;
        newEnd = startEndTime + deltaTime;

        if (newStart < 0) {
          newStart = 0;
          newEnd = span;
        }
        if (newEnd > totalDuration) {
          newEnd = totalDuration;
          newStart = totalDuration - span;
        }

        newStart = Math.max(0, newStart);
        newEnd = Math.min(totalDuration, newEnd);
        setDragTooltip(
          `[${currentTrack.name}] ${formatTime(newStart)} - ${formatTime(newEnd)} (${formatTime(
            newEnd - newStart
          )})`
        );
      } else if (type === 'left') {
        newStart = startStartTime + deltaTime;
        newStart = Math.max(0, Math.min(newStart, startEndTime - minSpan));
        setDragTooltip(`[${currentTrack.name}] In: ${formatTime(newStart)}`);
      } else if (type === 'right') {
        newEnd = startEndTime + deltaTime;
        newEnd = Math.max(startStartTime + minSpan, Math.min(newEnd, totalDuration));
        setDragTooltip(`[${currentTrack.name}] Out: ${formatTime(newEnd)}`);
      }

      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, startTime: newStart, endTime: newEnd } : t))
      );

      if (trackId === 'track-1') {
        onStartTimeChange(newStart);
        onEndTimeChange(newEnd);
        onSeek(newStart);
      }
    };

    const handleMouseUp = () => {
      setDragTooltip(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Split at playhead
  const handleSplitAtPlayhead = () => {
    if (duration <= 0) return;
    const pos = currentTime;
    const activeTrack = tracks.find((t) => t.id === activeTrackId) || tracks[0];

    if (pos > activeTrack.startTime && pos < activeTrack.endTime) {
      const mid = (activeTrack.startTime + activeTrack.endTime) / 2;
      const newEnd = pos >= mid ? pos : activeTrack.endTime;
      const newStart = pos < mid ? pos : activeTrack.startTime;

      setTracks((prev) =>
        prev.map((t) =>
          t.id === activeTrack.id ? { ...t, startTime: newStart, endTime: newEnd } : t
        )
      );

      if (activeTrack.id === 'track-1') {
        if (pos >= mid) onEndTimeChange(pos);
        else onStartTimeChange(pos);
      }
    }
  };

  // Mark In
  const handleMarkIn = () => {
    const activeTrack = tracks.find((t) => t.id === activeTrackId) || tracks[0];
    if (currentTime < activeTrack.endTime) {
      setTracks((prev) =>
        prev.map((t) => (t.id === activeTrack.id ? { ...t, startTime: currentTime } : t))
      );
      if (activeTrack.id === 'track-1') {
        onStartTimeChange(currentTime);
      }
    }
  };

  // Mark Out
  const handleMarkOut = () => {
    const activeTrack = tracks.find((t) => t.id === activeTrackId) || tracks[0];
    if (currentTime > activeTrack.startTime) {
      setTracks((prev) =>
        prev.map((t) => (t.id === activeTrack.id ? { ...t, endTime: currentTime } : t))
      );
      if (activeTrack.id === 'track-1') {
        onEndTimeChange(currentTime);
      }
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Ruler tick marks
  const rulerTicks = [];
  const tickCount = Math.min(30, Math.max(6, Math.floor(10 * zoomLevel)));
  for (let i = 0; i <= tickCount; i++) {
    const timeVal = (i / tickCount) * (duration || 10);
    rulerTicks.push({
      percent: (i / tickCount) * 100,
      time: formatTime(timeVal),
    });
  }

  const displayedTracks = isEncodeMode
    ? (viewMode === 'stacked' ? tracks : tracks.filter((t) => t.id === activeTrackId))
    : [tracks.find((t) => t.id === activeTrackId) || tracks[0]].filter(Boolean);

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
    <div className="backdrop-blur-xl bg-slate-950/90 border-t border-white/10 px-4 py-2.5 flex flex-col space-y-2 select-none relative">
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
              title="เต็มจอ (Fullscreen)"
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
              {formatTime(currentTime, duration)}
            </span>
            <span className="text-slate-400 font-bold text-[10px]">{formatTime(duration || 0)}</span>
          </div>

          {/* Timeline Editing Buttons (Split only available in Encode Mode) */}
          {isEncodeMode && (
            <div className="flex items-center space-x-1 pl-2 border-l border-white/10 shrink-0">
              <button
                onClick={handleSplitAtPlayhead}
                className="h-7 px-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg border border-white/10 text-xs font-medium flex items-center space-x-1 transition cursor-pointer shadow-sm"
                title="ตัดคลิปที่ตำแหน่งหัวอ่านปัจจุบัน (Cut / Split at Current Position)"
              >
                <Scissors className="w-3 h-3 text-indigo-400" />
                <span className="hidden sm:inline">Split</span>
              </button>
            </div>
          )}

          {/* Multi-file Reorder Bar (Auto-expanding to the right of Time for Copy Cut Mode) */}
          {!isEncodeMode && selectedFiles && selectedFiles.length > 1 && (
            <div className="flex-1 min-w-0 flex items-center space-x-1.5 pl-2 border-l border-white/10 overflow-x-auto">
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
                      onSelectFile?.(file);
                    }}
                    className={`flex items-center space-x-1 bg-slate-900/90 border ${
                      draggedIdx === idx
                        ? 'border-indigo-400 opacity-50'
                        : selectedFiles[idx]?.name === (tracks.find((t) => t.id === activeTrackId)?.fileName || tracks.find((t) => t.id === activeTrackId)?.name)
                        ? 'border-indigo-400 bg-indigo-950/70 shadow-[0_0_8px_rgba(99,102,241,0.3)]'
                        : 'border-white/10 hover:border-indigo-500/50'
                    } px-2 py-0.5 rounded text-[11px] whitespace-nowrap cursor-pointer transition shrink-0`}
                    title="Click to preview, drag or use arrows to reorder"
                  >
                    <span className="text-indigo-300 font-mono font-bold">#{idx + 1}</span>
                    <span className="text-slate-200 truncate max-w-[120px] lg:max-w-[180px]">{file.name}</span>
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
            <div className="flex items-center space-x-0.5 bg-slate-900/80 border border-white/10 rounded-lg p-0.5">
              <button
                onClick={() => setZoomLevel((z) => Math.max(1, z - 0.5))}
                disabled={zoomLevel <= 1}
                className="h-6 w-6 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 rounded transition cursor-pointer"
                title="ย่อขนาดไทม์ไลน์ (Zoom Out)"
              >
                <ZoomOut className="w-3 h-3" />
              </button>
              <span className="text-[9px] font-mono text-indigo-300 px-1 font-bold">
                {zoomLevel.toFixed(1)}x
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(3, z + 0.5))}
                disabled={zoomLevel >= 3}
                className="h-6 w-6 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 rounded transition cursor-pointer"
                title="ขยายขนาดไทม์ไลน์ (Zoom In)"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Single File Upload Button */}
          <button
            onClick={onUploadClick}
            title="เลือกไฟล์ (ครั้งละ 1 ไฟล์)"
            className="h-8 w-8 flex items-center justify-center bg-white/5 hover:bg-white/10 text-slate-200 rounded-lg transition border border-white/10 backdrop-blur-sm group shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
          </button>

          {/* Multiple Files Upload Button */}
          <button
            onClick={onMultiUploadClick}
            title="เลือกหลายไฟล์"
            className="h-8 w-8 flex items-center justify-center bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-200 rounded-lg transition border border-indigo-500/30 backdrop-blur-sm group shrink-0 cursor-pointer"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
          </button>

          {/* Remux Button: ONLY shown when NOT in Encode Mode */}
          {!isEncodeMode && (!selectedFiles || selectedFiles.length <= 1) && (
            <button
              onClick={onExportClick}
              disabled={isProcessing}
              className="h-8 px-2.5 flex items-center justify-center bg-indigo-950/60 hover:bg-indigo-900/80 disabled:bg-indigo-950/30 text-indigo-200 rounded-lg text-[11px] font-semibold border border-indigo-500/30 backdrop-blur-sm shadow-md transition transform active:scale-95 shrink-0 cursor-pointer"
              title="Remux (Fast Lossless Copy)"
            >
              <span>Remux</span>
            </button>
          )}

          {/* Export / Encode Button */}
          <button
            onClick={onExportClick}
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

      {/* Drag Tooltip Indicator */}
      {dragTooltip && (
        <div className="absolute left-1/2 -top-7 -translate-x-1/2 z-50 bg-slate-900/95 border border-indigo-400 text-indigo-200 text-[11px] font-mono font-semibold px-3 py-0.5 rounded shadow-xl animate-fadeIn pointer-events-none">
          {dragTooltip}
        </div>
      )}

      {/* Universal Timeline Workspace (Same unified layout & calculation for Copy Mode and Encode Mode) */}
      {!duration || duration <= 0 ? (
        /* Empty / Idle State Timeline with clean ruler and empty track placeholder */
        <div className="flex border border-white/15 rounded-xl overflow-hidden bg-black/60 shadow-inner select-none opacity-60">
          {/* Left Track Header */}
          <div className="w-44 shrink-0 bg-slate-950/95 border-r border-white/10 flex flex-col divide-y divide-white/10 z-20">
            <div className="h-4 bg-black/80 px-2 flex items-center justify-between border-b border-white/10">
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wider">Track</span>
              <span className="text-[8px] font-mono text-slate-500">Ready</span>
            </div>
            <div className="h-14 px-2 py-1 flex items-center justify-between bg-slate-900/40">
              <div className="flex items-center space-x-1.5">
                <VideoIcon className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[11px] font-medium text-slate-500">Main Video</span>
              </div>
            </div>
          </div>

          {/* Right Empty Ruler & Track Area */}
          <div className="flex-1 relative overflow-hidden">
            <div className="h-4 bg-black/70 border-b border-white/10 flex items-center relative">
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
            <div className="h-14 bg-slate-950/60 relative [background-image:linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:28px_100%] flex items-center justify-center">
              <div className="text-[11px] text-slate-500 font-mono flex items-center space-x-1.5 pointer-events-none">
                <span>Timeline Ready</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex border border-white/15 rounded-xl overflow-hidden bg-black/60 shadow-inner">
        {/* Track Headers Panel (Left side: Name, Media Type Tag, Mute, Lock, Hide, Color, Upload, Delete) */}
        <div className="w-44 shrink-0 bg-slate-950/95 border-r border-white/10 flex flex-col divide-y divide-white/10 z-20">
          {/* Top Header Label */}
          <div className="h-4 bg-black/80 px-2 flex items-center justify-between border-b border-white/10">
            <span className="text-[8px] font-mono text-slate-400 uppercase tracking-wider">
              {isEncodeMode ? 'Universal Tracks' : 'Active Track'}
            </span>
            <span className="text-[8px] font-mono text-indigo-400 font-bold">
              {isEncodeMode ? `${displayedTracks.length} Total` : 'Copy Cut Mode'}
            </span>
          </div>

          {/* Track Headers List */}
          {displayedTracks.map((track) => {
            const isActive = activeTrackId === track.id;
            const colorConfig = COLOR_CLASSES[track.color] || COLOR_CLASSES.indigo;
            const isEditing = editingTrackId === track.id;

            return (
              <div
                key={track.id}
                onClick={() => {
                  setActiveTrackId(track.id);
                  if (track.file && onSelectFile) {
                    onSelectFile(track.file);
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
                      title={`ประเภทสื่อ: ${track.mediaType} (คลิกเพื่อเปลี่ยนสัญลักษณ์ประเภทสื่อได้อิสระ)`}
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
                        className="text-[11px] font-medium text-slate-200 truncate flex-1"
                        title="Double-click to rename"
                      >
                        {track.fileName ? track.fileName : track.name}
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
                      title="เปลี่ยนสีแทร็ก (Change Track Color)"
                    />

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicateTrack(track.id);
                      }}
                      className="text-slate-500 hover:text-indigo-300 p-0.5 rounded cursor-pointer"
                      title="คัดลอกแทร็ก (Duplicate Track)"
                    >
                      <Copy className="w-2.5 h-2.5" />
                    </button>

                    {tracks.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTrack(track.id);
                        }}
                        className="text-slate-500 hover:text-rose-400 p-0.5 rounded cursor-pointer"
                        title="ลบแทร็กนี้"
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
                      title={track.hidden ? 'เปิดแสดงแทร็ก' : 'ซ่อนแทร็ก'}
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
                      title={track.muted ? 'เปิดเสียงแทร็ก' : 'ปิดเสียงแทร็ก'}
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
                      title={track.locked ? 'ปลดล็อคแทร็ก' : 'ล็อคแทร็ก'}
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
                      title="ใส่ไฟล์มีเดีย (ภาพ/เสียง/วิดีโอ) ลงในแทร็กนี้โดยตรง"
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
                      title="เปลี่ยนชื่อแทร็ก"
                    >
                      <Edit2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tracks Main Scrubbing & Trimming Area */}
        <div
          ref={timelineScrollRef}
          className="flex-1 relative overflow-x-auto overflow-y-hidden"
        >
          <div
            ref={trimContainerRef}
            className="relative cursor-pointer select-none"
            style={{ width: `${(isEncodeMode ? zoomLevel : 1) * 100}%`, minWidth: '100%' }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const percent = Math.max(0, Math.min(1, clickX / rect.width));
              onSeek(percent * duration);
            }}
          >
            {/* 1. Top Ruler (Ticks & Timestamps) */}
            <div className="h-4 bg-black/70 border-b border-white/10 flex items-center pointer-events-none relative z-10">
              {rulerTicks.map((tick, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l border-white/20 pl-0.5 flex items-center"
                  style={{ left: `${tick.percent}%` }}
                >
                  <span className="text-[8px] font-mono text-slate-400 leading-none">{tick.time}</span>
                </div>
              ))}
            </div>

            {/* 2. Track Rows Stack */}
            <div className="flex flex-col divide-y divide-white/10">
              {displayedTracks.map((track, trackIdx) => {
                const isActive = activeTrackId === track.id;
                const colorConfig = COLOR_CLASSES[track.color] || COLOR_CLASSES.indigo;
                const trackStartPct = duration > 0 ? (track.startTime / duration) * 100 : 0;
                const trackEndPct = duration > 0 ? (track.endTime / duration) * 100 : 100;
                const trackDuration = Math.max(0, track.endTime - track.startTime);

                // Specific thumbnails for this track's file
                const trackFileKey = track.file ? getFileKey(track.file) : null;
                const trackThumbs = trackFileKey && fileThumbnails[trackFileKey] && fileThumbnails[trackFileKey].length > 0
                  ? fileThumbnails[trackFileKey]
                  : (track.id === 'track-1' && thumbnails.length > 0 ? thumbnails : null);

                // Specific image for image tracks
                const trackImageSrc = (trackFileKey && fileThumbnails[trackFileKey]?.[0]) || track.previewUrl;

                return (
                  <div
                    key={track.id}
                    className={`relative h-14 transition ${
                      track.hidden ? 'opacity-25' : 'opacity-100'
                    } ${isActive ? colorConfig.headerBg : 'bg-slate-950/70'} [background-image:linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:32px_100%]`}
                  >
                    {/* Active Track Clip Box (Thumbnails and previews live directly INSIDE this box and scale/resize with it) */}
                    <div
                      className={`absolute top-1 bottom-1 rounded-md shadow-xl z-20 overflow-hidden cursor-grab active:cursor-grabbing select-none border-2 transition ${
                        colorConfig.clipBorder
                      } ${colorConfig.clipBg} ${isActive ? 'ring-1 ring-white/40' : ''}`}
                      style={{
                        left: `${trackStartPct}%`,
                        width: `${Math.max(0.5, trackEndPct - trackStartPct)}%`,
                      }}
                      onMouseDown={(e) => startTrimDrag(e, 'middle', track.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTrackId(track.id);
                      }}
                    >
                      {/* Visualizer INSIDE Clip: Video Filmstrip, Audio Waveform, Image, or Pattern */}
                      {track.mediaType === 'video' || (trackThumbs && trackThumbs.length > 0) || track.file?.type.startsWith('video/') ? (
                        <div className="absolute inset-0 flex items-stretch overflow-hidden pointer-events-none opacity-75">
                          {trackThumbs && trackThumbs.length > 0 ? (
                            trackThumbs.map((thumb, idx) => (
                              <div
                                key={idx}
                                className="relative h-full flex-1 min-w-[36px] overflow-hidden bg-slate-900 border-r border-white/10 last:border-r-0 shrink-0"
                              >
                                <img
                                  src={thumb}
                                  alt={`${track.name} Frame ${idx + 1}`}
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
                                  {track.fileName ? track.fileName.slice(0, 6) : `F${idx + 1}`}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      ) : track.mediaType === 'audio' || track.file?.type.startsWith('audio/') ? (
                        /* Audio Waveform inside clip */
                        <div className="absolute inset-0 flex items-center justify-around px-2 pointer-events-none opacity-70">
                          {Array.from({ length: 36 }).map((_, i) => {
                            const seed = (trackIdx + 1) * 1.37;
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
                      ) : (track.mediaType === 'image' || track.file?.type.startsWith('image/')) && trackImageSrc ? (
                        /* Image Preview inside clip */
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-80 overflow-hidden bg-slate-900">
                          <img
                            src={trackImageSrc}
                            alt="Track Image"
                            className="w-full h-full object-cover select-none pointer-events-none"
                          />
                        </div>
                      ) : (
                        /* Universal subtle Pattern inside clip */
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:12px_12px]" />
                      )}

                      {/* Semi-transparent tint overlay matching track color */}
                      <div className={`absolute inset-0 pointer-events-none opacity-30 ${colorConfig.clipBg}`} />

                      {/* Left Trim Handle */}
                      {!track.locked && (
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-3 rounded-l-[3px] shadow-md cursor-ew-resize z-30 shrink-0 flex items-center justify-center group ${colorConfig.clipHandle}`}
                          onMouseDown={(e) => startTrimDrag(e, 'left', track.id)}
                          onClick={(e) => e.stopPropagation()}
                          title="ลากเพื่อย่อ/ขยายจุดเริ่มต้น In"
                        >
                          <div className="w-0.5 h-3.5 bg-slate-950/80 rounded-full" />
                        </div>
                      )}

                      {/* Right Trim Handle */}
                      {!track.locked && (
                        <div
                          className={`absolute right-0 top-0 bottom-0 w-3 rounded-r-[3px] shadow-md cursor-ew-resize z-30 shrink-0 flex items-center justify-center group ${colorConfig.clipHandle}`}
                          onMouseDown={(e) => startTrimDrag(e, 'right', track.id)}
                          onClick={(e) => e.stopPropagation()}
                          title="ลากเพื่อย่อ/ขยายจุดสิ้นสุด Out"
                        >
                          <div className="w-0.5 h-3.5 bg-slate-950/80 rounded-full" />
                        </div>
                      )}

                      {/* Clip Name & Time Badge (Floats inside clip with backdrop blur) */}
                      <div className="relative z-20 flex items-center justify-center px-3 w-full pointer-events-none overflow-hidden space-x-1.5">
                        <span className="shrink-0 drop-shadow">{getMediaIcon(track.mediaType)}</span>
                        <span
                          className={`text-[9px] font-mono font-bold text-white px-2 py-0.5 rounded shadow-md whitespace-nowrap truncate backdrop-blur-md ${colorConfig.clipText}`}
                        >
                          {track.fileName ? track.fileName : track.name}: {formatTime(track.startTime)} - {formatTime(track.endTime)} ({formatTime(trackDuration)})
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 3. Playhead Vertical Needle & Cat Handle (Spans through entire ruler and all tracks) */}
            <div
              className="absolute top-0 bottom-0 z-30 pointer-events-none flex flex-col items-center -translate-x-1/2"
              style={{ left: `${progressPercent}%` }}
            >
              {/* Cat Handle on Ruler */}
              <img
                src={wcatSeekPng}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = wcatSeekSvg;
                }}
                alt="Playhead"
                className="h-5 w-auto max-w-none object-contain select-none drop-shadow -translate-y-1"
              />
              {/* Playhead Needle Line through all stacked tracks */}
              <div className="w-[2px] flex-1 bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
