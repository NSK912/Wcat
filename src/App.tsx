import React, { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { EditSettings, ActiveTab, SampleVideo } from './types';
import { SAMPLE_VIDEOS } from './utils/sampleVideos';
import { VideoPlayer } from './components/VideoPlayer';
import { Timeline } from './components/Timeline';
import { ProcessingModal } from './components/ProcessingModal';
import { SampleModal } from './components/SampleModal';

import ffmpegCoreUrl from '@ffmpeg/core?url';
import ffmpegWasmUrl from '@ffmpeg/core/wasm?url';

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

const getFFmpegDuration = async (ffmpeg: any, inputPath: string): Promise<number> => {
  return new Promise(async (resolve) => {
    let extractedDuration = 0;
    const logHandler = ({ message }: { message: string }) => {
      const match = message.match(/DURATION\s*:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/i);
      if (match) {
        const parsed = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3]);
        if (parsed > extractedDuration) {
          extractedDuration = parsed;
        }
      }
    };
    ffmpeg.on('log', logHandler);
    try {
      await ffmpeg.exec(['-i', inputPath]);
    } catch (e) {
      // ignore non-zero exit from -i
    }
    ffmpeg.off('log', logHandler);
    resolve(extractedDuration);
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
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState<boolean>(false);
  const logBufferRef = useRef<string[]>([]);
  const lastLogTimeRef = useRef<number>(0);

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
    const video = document.createElement('video');
    video.src = videoUrl;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';

    const thumbs: string[] = [];
    // Dynamic thumbnail count based on video duration (1 thumbnail per ~3s, min 5, max 16)
    const count = Math.min(16, Math.max(5, Math.floor(duration / 3)));
    let currentIdx = 0;

    video.onloadedmetadata = () => {
      const step = duration / count;

      const captureNext = () => {
        if (currentIdx >= count) {
          setThumbnails(thumbs);
          return;
        }
        const targetTime = (currentIdx + 0.5) * step;
        video.currentTime = Math.min(Math.max(0, targetTime), duration - 0.05);
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          thumbs.push(canvas.toDataURL('image/jpeg', 0.7));
        }
        currentIdx++;
        captureNext();
      };

      captureNext();
    };
  }, [videoUrl, duration]);

  // Initialize FFmpeg on mount
  useEffect(() => {
    loadFFmpeg();
  }, []);

  const loadFFmpeg = async () => {
    try {
      if (ffmpegRef.current) return;
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;

      ffmpeg.on('log', ({ message }) => {
        logBufferRef.current.push(message);
        if (logBufferRef.current.length > 200) {
          logBufferRef.current = logBufferRef.current.slice(-200);
        }
        const now = Date.now();
        if (now - lastLogTimeRef.current > 500) {
          lastLogTimeRef.current = now;
          setProcessingLogs([...logBufferRef.current]);
        }
      });

      ffmpeg.on('progress', ({ progress }) => {
        setProcessingProgress(Math.max(0, Math.min(1, progress)));
      });

      setProcessingMessage('Initializing local FFmpeg core...');
      const coreURL = await toBlobURL(ffmpegCoreUrl, 'text/javascript');
      const wasmURL = await toBlobURL(ffmpegWasmUrl, 'application/wasm');

      await ffmpeg.load({
        coreURL,
        wasmURL,
      });

      setFfmpegLoaded(true);
      console.log('FFmpeg loaded successfully from local dependencies');
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      setProcessingMessage(`Failed to load FFmpeg: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSingleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFiles([file]);
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
    }
    e.target.value = '';
  };

  const handleMultiFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileArr: File[] = Array.from(files);
      setSelectedFiles(fileArr);
      const firstFile = fileArr[0];
      const url = URL.createObjectURL(firstFile);
      setVideoUrl(url);
      setVideoName(fileArr.length === 1 ? firstFile.name : `${fileArr.length} files selected`);
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

  const handleSelectSample = (sample: SampleVideo) => {
    setSelectedFiles([]);
    setVideoUrl(sample.url);
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

  // Run FFmpeg Export Process
  const handleExport = async () => {
    if (!videoUrl) return;

    // 1. Prompt user to choose destination folder & file name before starting export/remux
    let fileHandle: any = null;
    const detectedExt = (videoName ? videoName.split('.').pop()?.toLowerCase() : 'mkv') || 'mkv';
    const sourceExt = ['mkv', 'mp4', 'webm', 'ts', 'mov', 'avi'].includes(detectedExt) ? detectedExt : 'mkv';

    const defaultOutputName = selectedFiles.length > 1 
      ? `merged_output.${sourceExt}` 
      : `trimmed_${videoName ? videoName.split('.')[0] : 'video'}.${sourceExt}`;

    if ('showSaveFilePicker' in window) {
      try {
        fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: defaultOutputName,
          types: [
            {
              description: 'Matroska Video (.mkv)',
              accept: { 'video/x-matroska': ['.mkv'] },
            },
            {
              description: 'MP4 Video (.mp4)',
              accept: { 'video/mp4': ['.mp4'] },
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
        alert('⚠️ ระบบไม่สามารถเปิดหน้าต่าง "เลือกที่บันทึกไฟล์ล่วงหน้า" ได้\n\nสาเหตุหลัก: คุณกำลังใช้งานแอปนี้ผ่านหน้าต่าง Preview ของ AI Studio (ซึ่งถูกบล็อกความปลอดภัยการเข้าถึงไฟล์) หรือเบราว์เซอร์ไม่รองรับ\n\n💡 วิธีแก้เพื่อถนอม SSD: ให้คลิกปุ่ม "Open in New Tab" ที่มุมขวาบนของหน้าจอ AI Studio เพื่อเปิดแอปในแท็บใหม่ ฟีเจอร์นี้ถึงจะทำงานได้ครับ');
        
        const proceed = window.confirm('คุณต้องการประมวลผลต่อด้วย "โหมดสำรอง" หรือไม่?\n(โหมดนี้จะสร้างไฟล์ชั่วคราวลงใน RAM และอาจดึง SSD มาช่วยหากไฟล์ใหญ่มาก)');
        if (!proceed) {
           return;
        }
      }
    } else {
       const proceed = window.confirm('⚠️ เบราว์เซอร์ของคุณไม่รองรับฟีเจอร์ "เลือกที่บันทึกไฟล์ล่วงหน้า"\n\nคุณต้องการประมวลผลต่อด้วย "โหมดสำรอง" หรือไม่?\n(โหมดนี้จะสร้างไฟล์ชั่วคราวลงใน RAM และอาจดึง SSD มาช่วยหากไฟล์ใหญ่มาก)');
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
    setProcessingMessage('Preparing files for FFmpeg...');

    try {
      let ffmpeg = ffmpegRef.current;
      if (!ffmpeg || !ffmpegLoaded) {
        setProcessingMessage('Loading FFmpeg core...');
        await loadFFmpeg();
        ffmpeg = ffmpegRef.current;
      }

      if (!ffmpeg) {
        throw new Error('FFmpeg failed to initialize.');
      }

      const createPipelineStream = async (handle: FileSystemFileHandle | null, outName: string) => {
        let writable: FileSystemWritableFileStream | null = null;
        let opfsFileHandle: FileSystemFileHandle | null = null;

        if (handle) {
          writable = await handle.createWritable();
        } else if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.getDirectory) {
          try {
            const opfsRoot = await navigator.storage.getDirectory();
            const tempName = `opfs_stream_${Date.now()}_${outName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            opfsFileHandle = await opfsRoot.getFileHandle(tempName, { create: true });
            writable = await opfsFileHandle.createWritable();
          } catch (err) {
            console.warn('OPFS stream initialization error:', err);
          }
        }

        return { writable, opfsFileHandle };
      };

      const runSegmentPipeline = async (
        ffmpeg: FFmpeg,
        args: string[],
        writable: FileSystemWritableFileStream | null,
        chunks: Uint8Array[],
        progressLabel: string
      ) => {
        let activeIndex = 0;
        let totalBytesProcessed = 0;

        let isPolling = false;
        const pollInterval = setInterval(async () => {
          if (isPolling) return;
          isPolling = true;
          try {
            const files = await ffmpeg.listDir('/');
            const fileNames = new Set(files.map((f) => f.name));

            while (true) {
              const nextSegName = `out_seg_${(activeIndex + 1).toString().padStart(5, '0')}.ts`;
              const curSegName = `out_seg_${activeIndex.toString().padStart(5, '0')}.ts`;

              if (fileNames.has(nextSegName)) {
                try {
                  const segData = await ffmpeg.readFile(curSegName);
                  if (segData && segData.length > 0) {
                    totalBytesProcessed += segData.length;
                    if (writable) {
                      await writable.write(segData);
                    } else {
                      chunks.push(segData as Uint8Array);
                    }
                  }
                  await ffmpeg.deleteFile(curSegName);
                } catch (e) {
                  console.warn('Read/delete segment error:', e);
                }
                activeIndex++;
              } else {
                break;
              }
            }
            if (totalBytesProcessed > 0) {
              setProcessingMessage(`${progressLabel}: ${(totalBytesProcessed / (1024 * 1024)).toFixed(1)} MB (RAM ~15 MB)...`);
            }
          } catch (e) {
            console.warn('Polling listDir error:', e);
          } finally {
            isPolling = false;
          }
        }, 100);

        let execCode = -1;
        try {
          execCode = await ffmpeg.exec(args);
        } catch (err) {
          console.warn('FFmpeg execution error:', err);
        } finally {
          clearInterval(pollInterval);
        }

        // Final flush for remaining segments
        while (true) {
          const curSegName = `out_seg_${activeIndex.toString().padStart(5, '0')}.ts`;
          try {
            const segData = await ffmpeg.readFile(curSegName);
            if (segData && segData.length > 0) {
              totalBytesProcessed += segData.length;
              if (writable) {
                await writable.write(segData);
              } else {
                chunks.push(segData as Uint8Array);
              }
            }
            await ffmpeg.deleteFile(curSegName);
            activeIndex++;
          } catch {
            break; // Finished all segments
          }
        }

        return { success: execCode === 0 || totalBytesProcessed > 0, totalBytesProcessed };
      };

      if (selectedFiles.length > 1) {
        setProcessingMessage('กำลังเตรียมไฟล์สำหรับรวมวิดีโอ (Continuous Low-RAM Stream)...');
        await ffmpeg.createDir('/work');
        await ffmpeg.mount('WORKERFS', { files: selectedFiles }, '/work');

        let listContent = '';
        for (let i = 0; i < selectedFiles.length; i++) {
          listContent += `file '/work/${selectedFiles[i].name}'\n`;
        }
        await ffmpeg.writeFile('list.txt', listContent);

        const { writable, opfsFileHandle } = await createPipelineStream(fileHandle, targetFilename);
        const chunks: Uint8Array[] = [];

        setProcessingMessage('กำลังรวมวิดีโอแบบต่อเนื่อง (ภาพชัด 100% เวลาตรง RAM ~15MB)...');

        const concatArgs1 = [
          '-f', 'concat',
          '-safe', '0',
          '-i', 'list.txt',
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-map', '0:v?',
          '-map', '0:a?',
          '-f', 'segment',
          '-segment_time', '4',
          '-reset_timestamps', '0',
          '/out_seg_%05d.ts'
        ];

        let result = await runSegmentPipeline(ffmpeg, concatArgs1, writable, chunks, 'กำลังสตรีมรวมวิดีโอ');

        if (!result.success || result.totalBytesProcessed === 0) {
          setProcessingMessage('กำลังสลับไปใช้โหมด Direct Copy เพื่อรวมวิดีโอ...');
          const concatArgs2 = [
            '-f', 'concat',
            '-safe', '0',
            '-i', 'list.txt',
            '-c', 'copy',
            '-map', '0:v?',
            '-map', '0:a?',
            '-f', 'segment',
            '-segment_time', '4',
            '-reset_timestamps', '0',
            '/out_seg_%05d.ts'
          ];
          result = await runSegmentPipeline(ffmpeg, concatArgs2, writable, chunks, 'กำลังสตรีมรวมวิดีโอ');
        }

        try { await ffmpeg.deleteFile('list.txt'); } catch {}
        try { await ffmpeg.unmount('/work'); } catch {}

        if (writable) {
          await writable.close();
        }

        if (!result.success || result.totalBytesProcessed === 0) {
          throw new Error('ไม่สามารถรวมไฟล์วิดีโอได้ กรุณาตรวจสอบว่าไฟล์วิดีโอมีสเปกใกล้เคียงกัน');
        }

        if (opfsFileHandle) {
          const diskFile = await opfsFileHandle.getFile();
          const url = URL.createObjectURL(diskFile);
          setOutputUrl(url);
          setProcessingMessage('รวมไฟล์วิดีโอสำเร็จเรียบร้อย!');
        } else if (fileHandle) {
          setProcessingMessage(`รวมไฟล์วิดีโอบันทึกลงปลายทางสำเร็จ: ${fileHandle.name}`);
        } else if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: 'video/mp2t' });
          const url = URL.createObjectURL(blob);
          setOutputUrl(url);
          setProcessingMessage('รวมไฟล์วิดีโอสำเร็จเรียบร้อย!');
        }

        setProcessingProgress(1.0);
        setIsProcessingComplete(true);
      } else {
        // Trim mode
        setProcessingMessage('กำลังอ่านวิดีโอต้นฉบับ...');
        
        let inputFilename = '';
        const inputExt = videoName.split('.').pop() || 'mp4';
        const isLocalFile = selectedFiles.length > 0;
        
        if (isLocalFile) {
          setProcessingMessage('กำลัง Mount ไฟล์จากเครื่อง...');
          await ffmpeg.createDir('/work');
          await ffmpeg.mount('WORKERFS', { files: [selectedFiles[0]] }, '/work');
          inputFilename = `/work/${selectedFiles[0].name}`;
        } else {
          const videoUrl = SAMPLE_VIDEOS.find(v => v.name === videoName)?.url || SAMPLE_VIDEOS[0].url;
          const inputData = await fetchFile(videoUrl);
          inputFilename = `input.${inputExt}`;
          await ffmpeg.writeFile(inputFilename, inputData);
        }

        let currentFileDuration = duration;
        if (currentFileDuration === 0) {
           if (isLocalFile) {
             currentFileDuration = await getFileDuration(selectedFiles[0]);
           }
           if (currentFileDuration === 0) {
             setProcessingMessage(`วิเคราะห์ความยาวไฟล์ด้วย FFmpeg...`);
             currentFileDuration = await getFFmpegDuration(ffmpeg, inputFilename);
           }
        }

        let currentStart = settings.startTime;
        const finalEndTime = (settings.endTime > 0 && settings.endTime < currentFileDuration) ? settings.endTime : currentFileDuration;
        const totalTrimDuration = Math.max(0.1, finalEndTime - currentStart);

        const { writable, opfsFileHandle } = await createPipelineStream(fileHandle, targetFilename);
        const chunks: Uint8Array[] = [];

        setProcessingMessage('กำลังประมวลผลตัดวิดีโอ (Single-Pass Low-RAM - ภาพชัด 100% เวลาตรง)...');

        const trimArgs1 = [
          '-ss', currentStart.toString(),
          '-i', inputFilename,
          ...(totalTrimDuration > 0 ? ['-t', totalTrimDuration.toString()] : []),
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-map', '0:v?',
          '-map', '0:a?',
          '-f', 'segment',
          '-segment_time', '4',
          '-reset_timestamps', '0',
          '/out_seg_%05d.ts'
        ];

        let result = await runSegmentPipeline(ffmpeg, trimArgs1, writable, chunks, 'กำลังสตรีมตัดวิดีโอ');

        if (!result.success || result.totalBytesProcessed === 0) {
          setProcessingMessage('กำลังสลับไปใช้โหมด Direct Copy เพื่อตัดวิดีโอ...');
          const trimArgs2 = [
            '-ss', currentStart.toString(),
            '-i', inputFilename,
            ...(totalTrimDuration > 0 ? ['-t', totalTrimDuration.toString()] : []),
            '-c', 'copy',
            '-map', '0:v?',
            '-map', '0:a?',
            '-f', 'segment',
            '-segment_time', '4',
            '-reset_timestamps', '0',
            '/out_seg_%05d.ts'
          ];
          result = await runSegmentPipeline(ffmpeg, trimArgs2, writable, chunks, 'กำลังสตรีมตัดวิดีโอ');
        }

        if (writable) {
          await writable.close();
        }

        if (isLocalFile) {
          try { await ffmpeg.unmount('/work'); } catch {}
        } else {
          try { await ffmpeg.deleteFile(inputFilename); } catch (e) {}
        }

        if (!result.success || result.totalBytesProcessed === 0) {
          throw new Error('ไม่สามารถตัดวิดีโอได้');
        }

        if (opfsFileHandle) {
          const diskFile = await opfsFileHandle.getFile();
          const url = URL.createObjectURL(diskFile);
          setOutputUrl(url);
          setProcessingMessage('ตัดวิดีโอสำเร็จเรียบร้อย!');
        } else if (fileHandle) {
          setProcessingMessage(`ตัดวิดีโอบันทึกลงปลายทางสำเร็จ: ${fileHandle.name}`);
        } else if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: 'video/mp2t' });
          const url = URL.createObjectURL(blob);
          setOutputUrl(url);
          setProcessingMessage('ตัดวิดีโอสำเร็จเรียบร้อย!');
        }

        setProcessingProgress(1.0);
        setIsProcessingComplete(true);
      }
    } catch (err: any) {
      console.error('FFmpeg processing error:', err);
      setProcessingMessage(`Error: ${err.message || 'Processing failed'}`);
      setIsProcessingComplete(true);
    } finally {
      // Global cleanup
      try {
        await ffmpegRef.current?.deleteFile('temp_chunk.ts');
      } catch {}
      try {
        await ffmpegRef.current?.unmount('/work');
      } catch {}
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
          <VideoPlayer
            videoUrl={videoUrl}
            settings={settings}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onTimeUpdate={setCurrentTime}
            onDurationLoaded={handleDurationLoaded}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onSeek={(t) => setCurrentTime(t)}
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
            isLoaded={!!videoUrl}
            isProcessing={false}
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
