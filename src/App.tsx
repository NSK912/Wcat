import React, { useState, useRef, useEffect } from 'react';
import { EditSettings, ActiveTab, SampleVideo } from './types';
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
};

const getFileDuration = async (file: File): Promise<number> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadedmetadata = () => {
      const dur = video.duration || 0;
      URL.revokeObjectURL(url);
      resolve(dur);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
  });
};

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

  const singleFileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);

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

  const handleSingleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (videoUrl) {
        try { URL.revokeObjectURL(videoUrl); } catch {}
      }
      const file = files[0];
      setSelectedFiles([file]);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setVideoName(file.name);
      if (outputUrl) {
        try { URL.revokeObjectURL(outputUrl); } catch {}
      }
      setOutputUrl(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setSettings((prev) => ({
        ...prev,
        startTime: 0,
        endTime: 0,
      }));
    }
    e.target.value = '';
  };

  const handleMultiFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (videoUrl) {
        try { URL.revokeObjectURL(videoUrl); } catch {}
      }
      const fileArr: File[] = Array.from(files);
      setSelectedFiles(fileArr);
      const firstFile = fileArr[0];
      const url = URL.createObjectURL(firstFile);
      setVideoUrl(url);
      setVideoName(fileArr.length === 1 ? firstFile.name : `${fileArr.length} files selected`);
      if (outputUrl) {
        try { URL.revokeObjectURL(outputUrl); } catch {}
      }
      setOutputUrl(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setSettings((prev) => ({
        ...prev,
        startTime: 0,
        endTime: 0,
      }));
    }
    e.target.value = '';
  };

  const handleFilesReorder = (newFiles: File[]) => {
    setSelectedFiles(newFiles);
    if (newFiles.length > 0) {
      const url = URL.createObjectURL(newFiles[0]);
      setVideoUrl(url);
      setVideoName(newFiles.length === 1 ? newFiles[0].name : `${newFiles.length} files selected`);
      setOutputUrl(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setSettings((prev) => ({
        ...prev,
        startTime: 0,
        endTime: 0,
      }));
    }
  };

  const handleSelectFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setVideoName(file.name);
    setOutputUrl(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setSettings((prev) => ({
      ...prev,
      startTime: 0,
      endTime: 0,
    }));
  };

  const handleSelectSample = async (sample: SampleVideo) => {
    try {
      const response = await fetch(sample.url);
      const blob = await response.blob();
      const file = new File([blob], `${sample.name.replace(/\s+/g, '_')}.mp4`, { type: 'video/mp4' });
      setSelectedFiles([file]);
      const blobUrl = URL.createObjectURL(file);
      if (videoUrl && videoUrl.startsWith('blob:')) {
        try { URL.revokeObjectURL(videoUrl); } catch {}
      }
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
    setDuration(dur);
    setSettings((prev) => ({
      ...prev,
      duration: dur,
      startTime: 0,
      endTime: dur,
    }));
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
  const handleExport = async () => {
    if (!videoUrl) return;

    // 1. Prompt user to choose destination folder & file name before starting export/remux
    let fileHandle: any = null;
    const detectedExt = (videoName ? videoName.split('.').pop()?.toLowerCase() : 'mp4') || 'mp4';
    const sourceExt = ['mp4', 'mkv', 'webm', 'ts', 'mov', 'm4v'].includes(detectedExt) ? detectedExt : 'mp4';

    const defaultOutputName = selectedFiles.length > 1 
      ? `merged_output.${sourceExt}` 
      : `trimmed_${videoName ? videoName.split('.')[0] : 'video'}.${sourceExt}`;

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
        
        // --- NEW: Handle Preview/Iframe restrictions explicitly ---
        (window as any).alert('⚠️ ระบบไม่สามารถเปิดหน้าต่าง "เลือกที่บันทึกไฟล์ล่วงหน้า" ได้\n\nสาเหตุหลัก: คุณกำลังใช้งานแอปนี้ผ่านหน้าต่าง Preview ของ AI Studio (ซึ่งถูกบล็อกความปลอดภัยการเข้าถึงไฟล์) หรือเบราว์เซอร์ไม่รองรับ\n\n💡 วิธีแก้เพื่อถนอม SSD: ให้คลิกปุ่ม "Open in New Tab" ที่มุมขวาบนของหน้าจอ AI Studio เพื่อเปิดแอปในแท็บใหม่ ฟีเจอร์นี้ถึงจะทำงานได้ครับ');
        
        const proceed = (window as any).confirm('คุณต้องการประมวลผลต่อด้วย "โหมดสำรอง" หรือไม่?\n(โหมดนี้จะสร้างไฟล์ชั่วคราวลงใน RAM และอาจดึง SSD มาช่วยหากไฟล์ใหญ่มาก)');
        if (!proceed) {
           return;
        }
      }
    } else {
       const proceed = (window as any).confirm('⚠️ เบราว์เซอร์ของคุณไม่รองรับฟีเจอร์ "เลือกที่บันทึกไฟล์ล่วงหน้า"\n\nคุณต้องการประมวลผลต่อด้วย "โหมดสำรอง" หรือไม่?\n(โหมดนี้จะสร้างไฟล์ชั่วคราวลงใน RAM และอาจดึง SSD มาช่วยหากไฟล์ใหญ่มาก)');
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

      if (selectedFiles.length > 1) {
        setProcessingMessage(`Streaming & merging ${selectedFiles.length} video files...`);
        addLog(`Initiating multi-file concatenation for ${selectedFiles.length} files:`);
        selectedFiles.forEach((f, idx) => addLog(`  [${idx + 1}] ${f.name} (${(f.size / (1024 * 1024)).toFixed(2)} MB)`));

        const { writable, opfsFileHandle } = await createPipelineStream(fileHandle, targetFilename);

        let result;
        if (isEncodeMode) {
          addLog(`[WebCodecs API] Hardware Accelerated Concatenation & Encoding Mode Initialized`);
          result = await processWebCodecsConcatStream(selectedFiles, settings, writable, (prog) => {
            setProcessingProgress(prog.percentage / 100);
            setProcessingMessage(`${prog.statusText} - Speed: ${prog.speedMBs.toFixed(1)} MB/s`);
            if (prog.log) addLog(prog.log);
          });
        } else {
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
        let result;

        if (isEncodeMode) {
          addLog(`[WebCodecs API] Hardware Accelerated Re-Encoding Mode Activated (Codec: ${(settings.videoCodec || 'avc').toUpperCase()}, Quality: ${settings.videoQuality || 'high'})`);
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
        } else if (isFullLengthRemux) {
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
        } else {
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
        {/* Top Left Floating Encode Mode Button & Controls */}
        <div className="absolute top-3 left-3 z-30 flex items-center space-x-2">
          <button
            id="encode-mode-toggle-btn"
            onClick={() => {
              const nextMode = !isEncodeMode;
              setIsEncodeMode(nextMode);
              setSettings((prev) => ({ ...prev, encodeMode: nextMode }));
            }}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 border shadow-lg cursor-pointer select-none ${
              isEncodeMode
                ? 'bg-gradient-to-r from-violet-600/90 to-indigo-600/90 hover:from-violet-500 hover:to-indigo-500 text-white border-violet-400/50 shadow-violet-500/25 ring-1 ring-violet-400/40'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700/70 backdrop-blur-md'
            }`}
            title={isEncodeMode ? 'WebCodecs API Hardware Accelerated Encode Mode Active' : 'Switch to WebCodecs API Encode Mode'}
          >
            <div className={`w-2 h-2 rounded-full transition-all ${isEncodeMode ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]' : 'bg-slate-500'}`} />
            <Zap className={`w-3.5 h-3.5 ${isEncodeMode ? 'text-amber-300' : 'text-slate-400'}`} />
            <span>Encode Mode</span>
            <span className={`px-1.5 py-0.5 text-[10px] rounded font-mono font-medium ${
              isEncodeMode ? 'bg-violet-950/80 text-violet-200 border border-violet-400/40' : 'bg-slate-800 text-slate-400'
            }`}>
              {isEncodeMode ? 'WebCodecs ON' : 'OFF'}
            </span>
          </button>

          {/* Dynamic Codec Selector when Encode Mode is Active */}
          {isEncodeMode && (
            <div className="hidden sm:flex items-center space-x-1.5 bg-slate-900/90 border border-violet-500/40 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs shadow-md animate-fadeIn">
              <span className="text-[11px] text-slate-400 font-mono">Codec:</span>
              <select
                value={settings.videoCodec || 'avc'}
                onChange={(e) => updateSettings({ videoCodec: e.target.value as any })}
                className="bg-slate-800 text-violet-300 font-mono text-[11px] rounded px-1.5 py-0.5 border border-slate-700 focus:outline-none focus:border-violet-500 cursor-pointer"
              >
                <option value="avc">H.264 / AVC</option>
                <option value="hevc">H.265 / HEVC</option>
                <option value="vp9">VP9</option>
                <option value="av1">AV1</option>
              </select>

              <span className="text-[11px] text-slate-400 font-mono ml-1">Quality:</span>
              <select
                value={settings.videoQuality || 'high'}
                onChange={(e) => updateSettings({ videoQuality: e.target.value as any })}
                className="bg-slate-800 text-violet-300 font-mono text-[11px] rounded px-1.5 py-0.5 border border-slate-700 focus:outline-none focus:border-violet-500 cursor-pointer"
              >
                <option value="very-high">Very High</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          )}
        </div>

        {/* Left/Center: Video Player & Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden bg-black/20 backdrop-blur-sm">
          <VideoPlayer
            videoUrl={videoUrl}
            settings={settings}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onTimeUpdate={setCurrentTime}
            onDurationLoaded={handleDurationLoaded}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onSeek={(t) => setCurrentTime(t)}
            videoName={videoName}
            selectedFile={selectedFiles.length > 0 ? selectedFiles[0] : undefined}
          />

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
            isProcessing={false}
            isEncodeMode={isEncodeMode}
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
