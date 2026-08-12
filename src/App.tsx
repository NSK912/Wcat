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
        setProcessingLogs((prev) => [...prev.slice(-50), message]);
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
    const defaultOutputName = selectedFiles.length > 1 
      ? 'merged_output.ts' 
      : `trimmed_${videoName ? videoName.split('.')[0] : 'video'}.ts`;
    const outputExt = defaultOutputName.split('.').pop() || 'ts';

    if ('showSaveFilePicker' in window) {
      try {
        fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: defaultOutputName,
          types: [
            {
              description: 'Video File',
              accept: {
                'video/mp2t': ['.ts'],
              },
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

      if (selectedFiles.length > 1) {
        if (fileHandle && fileHandle.name.endsWith('.ts')) {
          setProcessingMessage('เปิดท่อส่งข้อมูลลง SSD (Streaming Mode)...');
          const writable = await fileHandle.createWritable();
          
          for (let i = 0; i < selectedFiles.length; i++) {
              const file = selectedFiles[i];
              setProcessingMessage(`กำลังต่อไฟล์ ${i+1}/${selectedFiles.length} (${file.name})...`);
              
              const dirName = `/work${i}`;
              await ffmpeg.createDir(dirName);
              await ffmpeg.mount('WORKERFS', { files: [file] }, dirName);
              const inputFilename = `${dirName}/${file.name}`;
              const outName = `chunk${i}.ts`;
              
              const ret = await ffmpeg.exec(['-i', inputFilename, '-c', 'copy', '-f', 'mpegts', outName]);
              if (ret !== 0) throw new Error('FFmpeg error converting ' + file.name);
              
              const data = await ffmpeg.readFile(outName);
              await writable.write(data);
              
              await ffmpeg.deleteFile(outName);
              await ffmpeg.unmount(dirName);
              
              setProcessingProgress((i + 1) / selectedFiles.length);
          }
          await writable.close();
          setProcessingMessage(`รวมไฟล์สำเร็จ (RAM ปลอดภัย): ${fileHandle.name}`);
          setProcessingProgress(1.0);
          setIsProcessingComplete(true);
        } else {
          setProcessingMessage('Mounting input files for merge...');
          
          await ffmpeg.createDir('/work');
          await ffmpeg.mount('WORKERFS', { files: selectedFiles }, '/work');

          let listContent = '';
          for (let i = 0; i < selectedFiles.length; i++) {
            const filename = `/work/${selectedFiles[i].name}`;
            listContent += `file '${filename}'\n`;
          }

          await ffmpeg.writeFile('list.txt', listContent);

          setProcessingMessage('Merging videos without re-encoding (-c copy)...');
          const outName = 'output.ts';

          const ret = await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', '-f', 'mpegts', outName]);
          if (ret !== 0) {
            await ffmpeg.unmount('/work');
            throw new Error('FFmpeg merge failed with exit code ' + ret);
          }

          setProcessingMessage('Reading merged output file...');
          const data = await ffmpeg.readFile(outName);
          const blob = new Blob([data], { type: 'video/mp2t' });
          
          // Delete from MEMFS to free memory
          await ffmpeg.deleteFile(outName);
          await ffmpeg.unmount('/work');

          if (fileHandle) {
            setProcessingMessage(`Writing output to selected location (${fileHandle.name})...`);
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            setProcessingMessage(`Saved directly to selected folder: ${fileHandle.name}`);
            setProcessingProgress(1.0);
            setIsProcessingComplete(true);
            // Do not create ObjectURL to prevent SSD caching wear
          } else {
            setProcessingMessage('Merge completed successfully without re-encoding!');
            const url = URL.createObjectURL(blob);
            setOutputUrl(url);
            setProcessingProgress(1.0);
            setIsProcessingComplete(true);
          }
        }
      } else {
        setProcessingMessage('Reading input video...');
        
        let inputFilename = '';
        const inputExt = videoName.split('.').pop() || 'mp4';
        const isLocalFile = selectedFiles.length > 0;
        
        if (isLocalFile) {
          setProcessingMessage('Mounting local file...');
          await ffmpeg.createDir('/work');
          await ffmpeg.mount('WORKERFS', { files: [selectedFiles[0]] }, '/work');
          inputFilename = `/work/${selectedFiles[0].name}`;
        } else {
          const inputData = await fetchFile(videoUrl);
          inputFilename = `input.${inputExt}`;
          await ffmpeg.writeFile(inputFilename, inputData);
        }

        if (fileHandle && fileHandle.name.endsWith('.ts')) {
          const CHUNK_DURATION = 60; // 60s per chunk
          let currentStart = settings.startTime;
          const finalEndTime = (settings.endTime > 0 && settings.endTime < duration) ? settings.endTime : duration;
          const outName = 'chunk.ts';
          
          setProcessingMessage('เปิดท่อส่งข้อมูลลง SSD (Streaming Mode)...');
          const writable = await fileHandle.createWritable();
          
          while (currentStart < finalEndTime) {
              const chunkEnd = Math.min(currentStart + CHUNK_DURATION, finalEndTime);
              const chunkDuration = chunkEnd - currentStart;
              
              setProcessingMessage(`กำลังเขียนข้อมูลช่วง ${Math.round(currentStart)}s ถึง ${Math.round(chunkEnd)}s (ประหยัด RAM)...`);
              
              const args = [
                  '-ss', currentStart.toString(),
                  '-i', inputFilename,
                  '-t', chunkDuration.toString(),
                  '-c', 'copy',
                  '-f', 'mpegts',
                  outName
              ];
              
              const ret = await ffmpeg.exec(args);
              if (ret !== 0) throw new Error('FFmpeg error at chunk ' + currentStart);
              
              const data = await ffmpeg.readFile(outName);
              await writable.write(data);
              
              // 🔥 หัวใจสำคัญ: ลบไฟล์ออกจาก RAM ทันที!
              await ffmpeg.deleteFile(outName);
              
              currentStart = chunkEnd;
              setProcessingProgress((currentStart - settings.startTime) / (finalEndTime - settings.startTime));
          }
          
          await writable.close();
          if (isLocalFile) await ffmpeg.unmount('/work');
          
          setProcessingMessage(`บันทึกไฟล์สำเร็จ (RAM ปลอดภัย): ${fileHandle.name}`);
          setProcessingProgress(1.0);
          setIsProcessingComplete(true);
        } else {
          // Build FFmpeg arguments for fast lossless copy cut (-c copy)
          const args: string[] = [];

          const startTime = settings.startTime;
          const endTime = settings.endTime;

        if (startTime > 0) {
          args.push('-ss', startTime.toString());
        }
        args.push('-i', inputFilename);

        const trimDuration = endTime - startTime;
        if (trimDuration > 0 && trimDuration < duration) {
          args.push('-t', trimDuration.toString());
        }

        args.push('-c', 'copy');
        const outName = `output.${inputExt}`;
        args.push(outName);

        setProcessingMessage(`Running FFmpeg fast copy-cut command...`);
        console.log('FFmpeg args:', args);

        const ret = await ffmpeg.exec(args);
        
        if (isLocalFile) {
          await ffmpeg.unmount('/work');
        }
        
        if (ret !== 0) {
          throw new Error('FFmpeg command failed with exit code ' + ret);
        }

        setProcessingMessage('Reading output file...');
        const data = await ffmpeg.readFile(outName);
        const blob = new Blob([data], { type: `video/${inputExt}` });
        
        // Free MEMFS memory
        await ffmpeg.deleteFile(outName);
        if (!isLocalFile) {
          await ffmpeg.deleteFile(inputFilename);
        }

        if (fileHandle) {
          setProcessingMessage(`Writing output to selected location (${fileHandle.name})...`);
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          setProcessingMessage(`Saved directly to selected folder: ${fileHandle.name}`);
          setProcessingProgress(1.0);
          setIsProcessingComplete(true);
        } else {
          setProcessingMessage('Copy-cut completed successfully!');
          const url = URL.createObjectURL(blob);
          setOutputUrl(url);
          setProcessingProgress(1.0);
          setIsProcessingComplete(true);
        }
      }
    }
    } catch (err: any) {
      console.error('FFmpeg processing error:', err);
      setProcessingMessage(`Error: ${err.message || 'Processing failed'}`);
      setIsProcessingComplete(true); // Allow closing modal on error
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
