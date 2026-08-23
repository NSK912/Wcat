import React, { useState, useRef, useEffect, useCallback } from 'react';
import { EditSettings, ActiveTab, SampleVideo, TimelineTrackData, ClipTransform } from './types';
import { SAMPLE_VIDEOS } from './utils/sampleVideos';
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
import { Zap, Cpu } from 'lucide-react';

const DEFAULT_SETTINGS: EditSettings = {
  startTime: 0,
  endTime: 10,
  duration: 10,
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
  videoCodec: 'avc',
  audioCodec: 'aac',
  videoQuality: 'high',
  resolution: '1080',
  encodeSpeed: 'ultra-fast',
};

const getFileDuration = async (file: File): Promise<number> => {
  return new Promise((resolve) => {
    if (file.type.startsWith('image/')) {
      resolve(5); // Default 5 seconds for image clips
      return;
    }
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadedmetadata = () => {
      const dur = video.duration || 0;
      URL.revokeObjectURL(url);
      resolve(dur > 0 ? dur : 10);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(10);
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
    if (selectedFiles.length <= 1 || duration === 0) {
      setDuration(dur);
      setSettings((prev) => ({
        ...prev,
        duration: dur,
        startTime: 0,
        endTime: dur,
      }));
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
      const hasMultipleClips = allVisibleClips.length > 1 || selectedFiles.length > 1;
      const hasImageClips =
        allVisibleClips.some(c => c.mediaType === 'image' || (c.file && (c.file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(c.file.name)))) ||
        selectedFiles.some(f => f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(f.name));

      if (hasMultipleClips) {
        setProcessingMessage(`Streaming & merging ${allVisibleClips.length || selectedFiles.length} clips...`);
        addLog(`Initiating multi-clip concatenation (${allVisibleClips.length || selectedFiles.length} clips):`);
        if (allVisibleClips.length > 0) {
          allVisibleClips.forEach((c, idx) => addLog(`  [${idx + 1}] ${c.name || c.file?.name} (${c.mediaType || 'clip'}, start: ${(c.startTime || 0).toFixed(2)}s, dur: ${(c.duration || 0).toFixed(2)}s)`));
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

        const shouldUseEncodeMode = isEncodeMode || hasVisualModifications || hasImageClips;

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

        let currentStart = settings.startTime;
        const finalEndTime = (settings.endTime > 0 && settings.endTime < currentFileDuration) ? settings.endTime : currentFileDuration;

        const isFullLengthRemux = currentStart === 0 && finalEndTime >= currentFileDuration - 0.1;
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
        const shouldUseEncodeMode = isEncodeMode || hasVisualModifications || isInputImage;
        let result;

        // =====================================================================
        // 🔴 ENCODE MODE: SINGLE-TRACK / TRIM (WITH RE-ENCODING)
        // =====================================================================
        if (shouldUseEncodeMode) {
          const scaleInfo = (settings.cropAspect && settings.cropAspect !== 'original') ? `Scale: ${settings.cropAspect}, ` : '';
          addLog(`[WebCodecs API] Hardware Accelerated Re-Encoding Mode Activated (${scaleInfo}Codec: ${(settings.videoCodec || 'avc').toUpperCase()}, Quality: ${settings.videoQuality || 'high'})`);
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
        accept="video/*"
        className="hidden"
      />

      {/* Hidden file input for Multiple Files selection */}
      <input
        type="file"
        ref={multiFileInputRef}
        onChange={handleMultiFileUpload}
        accept="video/*"
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
              <div className="absolute top-3 left-3 bottom-3 z-30 pointer-events-none flex">
                <div
                  id="panel-encode"
                  className="w-72 h-full flex flex-row items-center gap-3 p-3 rounded-xl border backdrop-blur-md shadow-xl transition-all duration-200 pointer-events-auto overflow-y-auto bg-slate-950/90 border-violet-500/50 shadow-violet-500/10"
                >
                  {/* Left side: Vertically rotated Panel Encode Toggle Button */}
                  <div className="flex items-center justify-center my-auto shrink-0 w-8 h-32 relative">
                    <button
                      id="encode-mode-toggle-btn"
                      onClick={() => {
                        setIsEncodeMode(false);
                        setSettings((prev) => ({ ...prev, encodeMode: false, cropAspect: 'original' }));
                      }}
                      className="-rotate-90 whitespace-nowrap px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 border shadow-md cursor-pointer select-none origin-center bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-violet-400/50 shadow-violet-500/25"
                      title="Close Panel Encode (WebCodecs ON)"
                    >
                      <span>Panel Encode</span>
                    </button>
                  </div>

                  {/* Right side: Codec, Resolution & Quality Controls inside Panel Encode */}
                  <div className="flex-1 flex flex-col gap-2 text-xs animate-fadeIn min-w-0 pl-2 border-l border-white/10">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-slate-400 font-mono">Codec:</span>
                      <Dropdown
                        id="select-codec"
                        value={settings.videoCodec || 'avc'}
                        onChange={(val) => updateSettings({ videoCodec: val as any })}
                        options={[
                          { value: 'avc', label: 'H.264 / AVC' },
                          { value: 'hevc', label: 'H.265 / HEVC' },
                          { value: 'vp9', label: 'VP9' },
                          { value: 'av1', label: 'AV1' },
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
                      <span className="text-[11px] text-slate-400 font-mono">Quality:</span>
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
                  </div>
                </div>
              </div>
            ) : (
              <div className="absolute top-1/2 -translate-y-1/2 left-2 z-30 flex items-center justify-center w-8 h-32 pointer-events-auto">
                <button
                  id="encode-mode-toggle-btn"
                  onClick={() => {
                    setIsEncodeMode(true);
                    setSettings((prev) => ({ 
                      ...prev, 
                      encodeMode: true,
                      cropAspect: (prev.cropAspect === 'original' || !prev.cropAspect) ? '16:9' : prev.cropAspect
                    }));
                  }}
                  className="-rotate-90 whitespace-nowrap px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 border shadow-md cursor-pointer select-none origin-center bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700/70 backdrop-blur-md"
                  title="Open Panel Encode"
                >
                  <span>Panel Encode</span>
                </button>
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
              onToggleEncodeMode={() => {
                const nextMode = !isEncodeMode;
                setIsEncodeMode(nextMode);
                setSettings((prev) => ({ 
                  ...prev, 
                  encodeMode: nextMode,
                  cropAspect: nextMode 
                    ? ((prev.cropAspect === 'original' || !prev.cropAspect) ? '16:9' : prev.cropAspect)
                    : 'original'
                }));
              }}
              videoName={videoName}
              selectedFile={selectedFiles.length > 0 ? selectedFiles[0] : undefined}
              tracks={tracks}
              onUpdateClipTransform={handleUpdateClipTransform}
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
