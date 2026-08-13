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

const runFFmpegTSChunk = async (
  ffmpeg: any,
  inputPath: string,
  startTime: number,
  durationSeconds: number,
  tsOffsetSeconds: number,
  outName: string = 'chunk.ts'
): Promise<Uint8Array | null> => {
  const args = [
    '-ss', startTime.toString(),
    '-i', inputPath,
    ...(durationSeconds > 0 ? ['-t', durationSeconds.toString()] : []),
    '-map', '0:v:0',
    '-map', '0:a?',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-output_ts_offset', tsOffsetSeconds.toString(),
    '-f', 'mpegts',
    outName
  ];

  try {
    const ret = await ffmpeg.exec(args);
    if (ret === 0) {
      const data = await ffmpeg.readFile(outName);
      if (data && data.length > 0) {
        await ffmpeg.deleteFile(outName);
        return data;
      }
    }
  } catch (e) {
    console.warn('TS chunk execution error:', e);
  }
  return null;
};

const runFFmpegChunk = async (
  ffmpeg: any,
  inputPath: string,
  startTime: number,
  durationSeconds: number,
  outName: string,
  targetExt: string = 'mp4'
): Promise<boolean> => {
  const ext = targetExt.toLowerCase();
  const strategies: { args: string[] }[] = [];

  // Strategy 1: Direct stream copy
  strategies.push({
    args: ['-ss', startTime.toString(), '-i', inputPath, ...(durationSeconds > 0 ? ['-t', durationSeconds.toString()] : []), '-c', 'copy', '-map', '0:v?', '-map', '0:a?', outName]
  });

  if (ext === 'mp4') {
    strategies.push({
      args: ['-ss', startTime.toString(), '-i', inputPath, ...(durationSeconds > 0 ? ['-t', durationSeconds.toString()] : []), '-c', 'copy', '-movflags', 'frag_keyframe+empty_moov+default_base_moof', '-f', 'mp4', outName]
    });
  }

  // Strategy 3: Matroska container (.mkv) which supports all codecs (HEVC, Opus, VP9, etc)
  const mkvOut = outName.endsWith('.mkv') ? outName : `${outName}_fallback.mkv`;
  strategies.push({
    args: ['-ss', startTime.toString(), '-i', inputPath, ...(durationSeconds > 0 ? ['-t', durationSeconds.toString()] : []), '-c', 'copy', '-f', 'matroska', mkvOut]
  });

  // Strategy 4: Audio convert to AAC (for MP4/TS compatibility)
  strategies.push({
    args: ['-ss', startTime.toString(), '-i', inputPath, ...(durationSeconds > 0 ? ['-t', durationSeconds.toString()] : []), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', outName]
  });

  for (const strat of strategies) {
    try {
      const targetFile = strat.args[strat.args.length - 1];
      const ret = await ffmpeg.exec(strat.args);
      if (ret === 0) {
        const data = await ffmpeg.readFile(targetFile);
        if (data && data.length > 0) {
          if (targetFile !== outName) {
            await ffmpeg.writeFile(outName, data);
            await ffmpeg.deleteFile(targetFile);
          }
          return true;
        }
      }
    } catch (e: any) {
      console.warn('Strategy execution error:', e);
    }
  }

  return false;
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
        setProcessingLogs((prev) => [...prev.slice(-200), message]);
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

      if (selectedFiles.length > 1) {
        const targetExt = targetFilename.split('.').pop()?.toLowerCase() || 'mkv';

        if (fileHandle) {
          setProcessingMessage('เปิดท่อบันทึกไฟล์รวมลง SSD (Low-RAM Concat Streaming Mode)...');
          const writable = await fileHandle.createWritable();
          let totalTimeOffset = 0;

          for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            setProcessingMessage(`กำลังประมวลผลไฟล์ที่ ${i + 1}/${selectedFiles.length} (${file.name})...`);

            const dirName = `/work_${i}`;
            await ffmpeg.createDir(dirName);
            await ffmpeg.mount('WORKERFS', { files: [file] }, dirName);
            const inputFilename = `${dirName}/${file.name}`;

            let currentFileDuration = 0;
            try {
              currentFileDuration = await getFFmpegDuration(ffmpeg, inputFilename);
            } catch (e) {
              console.warn('Could not read duration', e);
            }

            const CHUNK_DURATION = 600; // 10 minutes
            if (currentFileDuration > 0 && currentFileDuration > CHUNK_DURATION) {
              let startPos = 0;
              while (startPos < currentFileDuration) {
                const chunkDur = Math.min(CHUNK_DURATION, currentFileDuration - startPos);
                if (chunkDur <= 0) break;
                const currentTSOffset = totalTimeOffset + startPos;

                setProcessingMessage(`กำลังสตรีมลง SSD: ไฟล์ ${i + 1}/${selectedFiles.length} (ช่วงเวลา ${Math.round(currentTSOffset)}s)...`);

                const chunkData = await runFFmpegTSChunk(ffmpeg, inputFilename, startPos, chunkDur, currentTSOffset, `chunk_${i}_${Math.round(startPos)}.ts`);
                if (!chunkData) {
                  await ffmpeg.unmount(dirName);
                  await writable.close();
                  throw new Error(`ไม่สามารถประมวลผลไฟล์ ${file.name} ช่วงเวลา ${Math.round(startPos)}s ได้`);
                }

                await writable.write(chunkData);

                startPos += chunkDur;
                const fileProgress = i + (startPos / currentFileDuration);
                setProcessingProgress(fileProgress / selectedFiles.length);
              }
              totalTimeOffset += currentFileDuration;
            } else {
              setProcessingMessage(`กำลังสตรีมลง SSD: ไฟล์ ${i + 1}/${selectedFiles.length}...`);
              const chunkDur = currentFileDuration > 0 ? currentFileDuration : 0;
              const chunkData = await runFFmpegTSChunk(ffmpeg, inputFilename, 0, chunkDur, totalTimeOffset, `chunk_${i}.ts`);
              if (!chunkData) {
                await ffmpeg.unmount(dirName);
                await writable.close();
                throw new Error(`ไม่สามารถประมวลผลไฟล์ ${file.name} ได้`);
              }

              await writable.write(chunkData);
              if (currentFileDuration > 0) {
                totalTimeOffset += currentFileDuration;
              }
              setProcessingProgress((i + 1) / selectedFiles.length);
            }

            await ffmpeg.unmount(dirName);
          }

          await writable.close();
          setProcessingMessage(`รวมไฟล์ทั้งหมดและบันทึกลง SSD สำเร็จ: ${fileHandle.name}`);
          setProcessingProgress(1.0);
          setIsProcessingComplete(true);
        } else {
          setProcessingMessage('กำลังเตรียมไฟล์สำหรับรวมวิดีโอ (FFmpeg Concat)...');
          await ffmpeg.createDir('/work');
          await ffmpeg.mount('WORKERFS', { files: selectedFiles }, '/work');

          let listContent = '';
          for (let i = 0; i < selectedFiles.length; i++) {
            const filename = `/work/${selectedFiles[i].name}`;
            listContent += `file '${filename}'\n`;
          }
          await ffmpeg.writeFile('list.txt', listContent);

          setProcessingMessage('กำลังรวมวิดีโอ (Direct Stream Copy - รักษาเวลาและคุณภาพ 100%)...');
          let actualOutName = `output_merged.${targetExt}`;
          let success = false;

          // Strategy 1: Concat with direct copy matching target format
          try {
            const ret = await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', '-map', '0:v?', '-map', '0:a?', actualOutName]);
            if (ret === 0) {
              const dataCheck = await ffmpeg.readFile(actualOutName);
              if (dataCheck && dataCheck.length > 0) success = true;
            }
          } catch (e) {
            console.warn('Concat strategy 1 failed:', e);
          }

          // Strategy 2: Matroska (.mkv) fallback (supports HEVC, Opus, VP9, etc.)
          if (!success) {
            actualOutName = 'output_merged.mkv';
            try {
              const ret = await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', '-map', '0:v?', '-map', '0:a?', '-f', 'matroska', actualOutName]);
              if (ret === 0) {
                const dataCheck = await ffmpeg.readFile(actualOutName);
                if (dataCheck && dataCheck.length > 0) success = true;
              }
            } catch (e) {
              console.warn('Concat strategy 2 (MKV) failed:', e);
            }
          }

          // Strategy 3: Convert audio to AAC if target container requires it
          if (!success) {
            actualOutName = `output_merged_aac.${targetExt === 'mp4' ? 'mp4' : 'mkv'}`;
            try {
              const ret = await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', actualOutName]);
              if (ret === 0) {
                const dataCheck = await ffmpeg.readFile(actualOutName);
                if (dataCheck && dataCheck.length > 0) success = true;
              }
            } catch (e) {
              console.warn('Concat strategy 3 (AAC) failed:', e);
            }
          }

          if (!success) {
            await ffmpeg.deleteFile('list.txt');
            await ffmpeg.unmount('/work');
            throw new Error('ไม่สามารถรวมไฟล์วิดีโอในหน่วยความจำได้เนื่องจากไฟล์มีขนาดใหญ่เกินไป (กรุณาใช้ปุ่มบันทึกลง SSD โดยตรง)');
          }

          setProcessingMessage('กำลังอ่านข้อมูลวิดีโอที่รวมสำเร็จ...');
          const data = await ffmpeg.readFile(actualOutName);
          await ffmpeg.deleteFile(actualOutName);
          await ffmpeg.deleteFile('list.txt');
          await ffmpeg.unmount('/work');

          setProcessingMessage('รวมไฟล์สำเร็จแล้ว!');
          const blob = new Blob([data], { type: `video/${targetExt}` });
          const url = URL.createObjectURL(blob);
          setOutputUrl(url);
          setProcessingProgress(1.0);
          setIsProcessingComplete(true);
        }
      } else {
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
          const inputData = await fetchFile(videoUrl);
          inputFilename = `input.${inputExt}`;
          await ffmpeg.writeFile(inputFilename, inputData);
        }

        let currentFileDuration = duration;
        if (currentFileDuration === 0) {
           setProcessingMessage(`วิเคราะห์ความยาวไฟล์ด้วย FFmpeg...`);
           currentFileDuration = await getFFmpegDuration(ffmpeg, inputFilename);
        }

        let currentStart = settings.startTime;
        const finalEndTime = (settings.endTime > 0 && settings.endTime < currentFileDuration) ? settings.endTime : currentFileDuration;
        const totalTrimDuration = finalEndTime - currentStart;
        const targetExt = targetFilename.split('.').pop()?.toLowerCase() || 'mkv';

        if (fileHandle && totalTrimDuration > 600) {
          setProcessingMessage('เปิดท่อบันทึกไฟล์ลง SSD (Low-RAM Trim Streaming Mode)...');
          const writable = await fileHandle.createWritable();
          const CHUNK_DURATION = 600; // 10 minutes
          let startPos = currentStart;
          let chunkIndex = 0;

          while (startPos < finalEndTime) {
            const chunkDur = Math.min(CHUNK_DURATION, finalEndTime - startPos);
            if (chunkDur <= 0) break;
            const tsOffset = startPos - currentStart;

            setProcessingMessage(`กำลังสตรีมลง SSD (ช่วงเวลา ${Math.round(tsOffset)}s / ${Math.round(totalTrimDuration)}s)...`);
            const chunkData = await runFFmpegTSChunk(ffmpeg, inputFilename, startPos, chunkDur, tsOffset, `trim_${chunkIndex}.ts`);
            if (!chunkData) {
              if (isLocalFile) await ffmpeg.unmount('/work');
              await writable.close();
              throw new Error(`ไม่สามารถตัดวิดีโอช่วงเวลา ${Math.round(startPos)}s ได้`);
            }

            await writable.write(chunkData);
            startPos += chunkDur;
            chunkIndex++;
            setProcessingProgress((startPos - currentStart) / totalTrimDuration);
          }

          await writable.close();
          if (isLocalFile) await ffmpeg.unmount('/work');
          else await ffmpeg.deleteFile(inputFilename);

          setProcessingMessage(`บันทึกไฟล์ลง SSD สำเร็จ (เวลาตรงตามต้นฉบับ 100%): ${fileHandle.name}`);
          setProcessingProgress(1.0);
          setIsProcessingComplete(true);
        } else {
          const outName = `output_trimmed.${targetExt}`;
          setProcessingMessage('กำลังประมวลผลตัดวิดีโอ (Direct Stream Copy - รักษาเวลาและคุณภาพ 100%)...');
          
          let success = await runFFmpegChunk(ffmpeg, inputFilename, currentStart, totalTrimDuration > 0 ? totalTrimDuration : 0, outName, targetExt);
          let actualOutName = outName;

          if (!success) {
            actualOutName = `output_trimmed.mkv`;
            success = await runFFmpegChunk(ffmpeg, inputFilename, currentStart, totalTrimDuration > 0 ? totalTrimDuration : 0, actualOutName, 'mkv');
          }

          if (!success) {
            if (isLocalFile) await ffmpeg.unmount('/work');
            throw new Error(`ไม่สามารถตัด/ประมวลผลวิดีโอได้`);
          }

          const data = await ffmpeg.readFile(actualOutName);
          await ffmpeg.deleteFile(actualOutName);

          if (isLocalFile) {
            await ffmpeg.unmount('/work');
          } else {
            await ffmpeg.deleteFile(inputFilename);
          }

          if (fileHandle) {
            setProcessingMessage(`กำลังบันทึกไฟล์ลง SSD (${fileHandle.name})...`);
            const writable = await fileHandle.createWritable();
            await writable.write(data);
            await writable.close();
            setProcessingMessage(`บันทึกไฟล์ลง SSD สำเร็จ (เวลาตรงตามต้นฉบับ): ${fileHandle.name}`);
          } else {
            setProcessingMessage('ประมวลผลสำเร็จเรียบร้อย!');
            const blob = new Blob([data], { type: `video/${targetExt}` });
            const url = URL.createObjectURL(blob);
            setOutputUrl(url);
          }

          setProcessingProgress(1.0);
          setIsProcessingComplete(true);
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
