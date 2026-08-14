import React, { useRef, useEffect, useState, useCallback } from 'react';
import { EditSettings } from '../types';
import { Play, Pause, StepForward, StepBack, Cpu, Layers } from 'lucide-react';

interface VideoPlayerProps {
  videoUrl: string | null;
  settings: EditSettings;
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onDurationLoaded: (duration: number) => void;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  videoName?: string;
  selectedFile?: File;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  settings,
  currentTime,
  isPlaying,
  onTimeUpdate,
  onDurationLoaded,
  onTogglePlay,
  onSeek,
  videoName,
  selectedFile,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const isSeekingRef = useRef<boolean>(false);

  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 1280,
    height: 720,
  });
  const [fps, setFps] = useState<number>(30);
  const fpsCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(performance.now());

  // ฟังก์ชันวาดเฟรมปัจจุบันลงบน Canvas ในระดับพิกเซล
  const drawFrameToCanvas = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;

    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width = vw;
      canvas.height = vh;
    }

    ctx.save();
    ctx.clearRect(0, 0, vw, vh);

    // เลื่อนแกนไปกึ่งกลางสำหรับการแปลงภาพ (Transformations)
    ctx.translate(vw / 2, vh / 2);

    // การหมุน (Rotation)
    if (settings.rotation !== 0) {
      ctx.rotate((settings.rotation * Math.PI) / 180);
    }

    // การกลับด้านภาพ (Flip Horizontal / Vertical)
    const scaleX = settings.flipH ? -1 : 1;
    const scaleY = settings.flipV ? -1 : 1;
    if (scaleX !== 1 || scaleY !== 1) {
      ctx.scale(scaleX, scaleY);
    }

    // การปรับสีและฟิลเตอร์ (Color & Effects Filters)
    let filterStr = `brightness(${settings.brightness}) contrast(${settings.contrast})`;
    switch (settings.filter) {
      case 'grayscale':
        filterStr += ' grayscale(100%)';
        break;
      case 'sepia':
        filterStr += ' sepia(100%)';
        break;
      case 'negative':
        filterStr += ' invert(100%)';
        break;
      case 'blur':
        filterStr += ' blur(3px)';
        break;
      case 'vignette':
        filterStr += ' contrast(120%) brightness(90%)';
        break;
      default:
        break;
    }
    ctx.filter = filterStr;

    // วาดเฟรมจริงจาก Video เข้าสู่ Canvas พิกเซลต่อพิกเซล
    if (video.readyState >= 1) {
      try {
        ctx.drawImage(video, -vw / 2, -vh / 2, vw, vh);
      } catch (err) {
        console.warn('Canvas draw error:', err);
      }
    }

    // ล้าง filter ก่อนวาดลายน้ำ
    ctx.filter = 'none';

    // วาดลายน้ำลงบน Canvas โดยตรง (Direct Canvas Watermark)
    if (settings.watermarkText) {
      ctx.restore();
      ctx.save();
      ctx.fillStyle = settings.watermarkColor || '#ffffff';
      ctx.font = `bold ${settings.watermarkSize || 24}px sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 6;

      const text = settings.watermarkText;
      const metrics = ctx.measureText(text);
      const padding = 20;

      let wx = padding;
      let wy = padding + (settings.watermarkSize || 24);

      switch (settings.watermarkPosition) {
        case 'top-left':
          wx = padding;
          wy = padding + (settings.watermarkSize || 24);
          ctx.textAlign = 'left';
          break;
        case 'top-right':
          wx = vw - padding;
          wy = padding + (settings.watermarkSize || 24);
          ctx.textAlign = 'right';
          break;
        case 'bottom-left':
          wx = padding;
          wy = vh - padding;
          ctx.textAlign = 'left';
          break;
        case 'bottom-right':
          wx = vw - padding;
          wy = vh - padding;
          ctx.textAlign = 'right';
          break;
        case 'center':
        default:
          wx = vw / 2;
          wy = vh / 2;
          ctx.textAlign = 'center';
          break;
      }

      ctx.fillText(text, wx, wy);
    }

    ctx.restore();

    // คำนวณ FPS
    fpsCountRef.current++;
    const now = performance.now();
    if (now - lastFpsTimeRef.current >= 1000) {
      setFps(Math.round((fpsCountRef.current * 1000) / (now - lastFpsTimeRef.current)));
      fpsCountRef.current = 0;
      lastFpsTimeRef.current = now;
    }
  }, [
    settings.brightness,
    settings.contrast,
    settings.filter,
    settings.rotation,
    settings.flipH,
    settings.flipV,
    settings.watermarkText,
    settings.watermarkPosition,
    settings.watermarkColor,
    settings.watermarkSize,
  ]);

  // RequestAnimationFrame Render Loop ขณะเล่นวิดีโอ
  useEffect(() => {
    let isActive = true;

    const loop = () => {
      if (!isActive) return;
      if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
        drawFrameToCanvas();
        onTimeUpdate(videoRef.current.currentTime);
      }
      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    if (isPlaying) {
      animFrameIdRef.current = requestAnimationFrame(loop);
    } else {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      // วาดเฟรมหยุดนิ่ง
      drawFrameToCanvas();
    }

    return () => {
      isActive = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [isPlaying, drawFrameToCanvas, onTimeUpdate]);

  // วาดเฟรมใหม่ทุกครั้งที่มีการเปลี่ยน Settings (Filters / Transforms)
  useEffect(() => {
    drawFrameToCanvas();
  }, [drawFrameToCanvas]);

  // จัดการการเล่น/หยุดของ Video Element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch((err) => {
        console.warn('Autoplay prevented or playback issue:', err);
      });
    } else {
      video.pause();
    }
  }, [isPlaying]);

  // ซิงค์ตำแหน่งเวลาจาก Timeline
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isSeekingRef.current) return;

    if (Math.abs(video.currentTime - currentTime) > 0.2) {
      video.currentTime = currentTime;
      drawFrameToCanvas();
    }
  }, [currentTime, drawFrameToCanvas]);

  // ซิงค์ Speed และ Volume
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = settings.speed || 1.0;
    video.volume = settings.muteAudio ? 0 : settings.volume;
    video.muted = !!settings.muteAudio;
  }, [settings.speed, settings.volume, settings.muteAudio]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;

    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    setDimensions({ width: w, height: h });

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = w;
      canvas.height = h;
    }

    if (video.duration && !isNaN(video.duration) && isFinite(video.duration)) {
      onDurationLoaded(video.duration);
    }

    // Force frame display
    if (video.currentTime === 0) {
      video.currentTime = 0.001;
    }
    setTimeout(() => {
      drawFrameToCanvas();
    }, 50);
  };

  const handleStep = (forward: boolean) => {
    const video = videoRef.current;
    if (!video) return;
    const step = 1 / 30;
    const target = forward ? video.currentTime + step : video.currentTime - step;
    video.currentTime = Math.max(0, Math.min(target, video.duration || 1000));
    onTimeUpdate(video.currentTime);
    drawFrameToCanvas();
  };

  const getAspectClass = () => {
    switch (settings.cropAspect) {
      case '16:9':
        return 'aspect-video max-h-[480px]';
      case '9:16':
        return 'aspect-[9/16] max-h-[480px]';
      case '1:1':
        return 'aspect-square max-h-[420px]';
      case '4:3':
        return 'aspect-[4/3] max-h-[450px]';
      default:
        return 'max-h-[480px] w-auto';
    }
  };

  return (
    <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center relative p-6 overflow-hidden">
      {!videoUrl ? (
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
            ver 3.5.0.0
          </div>
        </div>
      ) : (
        <div className={`relative bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center ${getAspectClass()}`}>
          {/* Main Direct Pixel Canvas Surface */}
          <canvas
            ref={canvasRef}
            width={dimensions.width}
            height={dimensions.height}
            className="max-h-full max-w-full object-contain transition-all duration-150"
          />

          {/* In-DOM Video Source Stream Decoder (อยู่ใน DOM เสมอ ป้องกัน Offscreen Viewport culling) */}
          <video
            ref={videoRef}
            src={videoUrl}
            playsInline
            preload="auto"
            crossOrigin="anonymous"
            muted={settings.muteAudio}
            onLoadedMetadata={handleLoadedMetadata}
            onLoadedData={() => drawFrameToCanvas()}
            onSeeked={() => drawFrameToCanvas()}
            onTimeUpdate={() => {
              if (videoRef.current) {
                onTimeUpdate(videoRef.current.currentTime);
                drawFrameToCanvas();
              }
            }}
            onEnded={() => onTogglePlay()}
            className="absolute inset-0 w-full h-full opacity-0 pointer-events-none -z-10"
          />

          {/* Badge แสดงสถานะ Direct Pixel Canvas Engine */}
          <div className="absolute top-3 left-3 z-30 flex items-center space-x-2 pointer-events-none">
            <div className="flex items-center space-x-1.5 bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-cyan-500/30 text-[11px] text-cyan-300 font-mono shadow-md select-none">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-200 font-medium">Pixel Canvas Surface</span>
              <span className="text-slate-500">|</span>
              <span className={isPlaying ? 'text-emerald-400 font-bold' : 'text-slate-400'}>{fps} FPS</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">{dimensions.width}x{dimensions.height}</span>
            </div>
          </div>

          {/* Quick Frame Step Controls (มุมขวาบน) */}
          <div className="absolute top-3 right-3 z-30 flex items-center space-x-1 bg-slate-900/80 backdrop-blur-md p-1 rounded-lg border border-slate-800 text-slate-300">
            <button
              onClick={() => handleStep(false)}
              title="Step 1 Frame Back"
              className="p-1 hover:bg-white/10 rounded transition active:scale-95 text-xs flex items-center"
            >
              <StepBack className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleStep(true)}
              title="Step 1 Frame Forward"
              className="p-1 hover:bg-white/10 rounded transition active:scale-95 text-xs flex items-center"
            >
              <StepForward className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Floating play/pause overlay button on click */}
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
            className={`absolute inset-0 flex items-center justify-center transition cursor-pointer group z-20 ${
              isPlaying ? 'opacity-0 hover:opacity-100 bg-black/20' : 'opacity-100 bg-black/30'
            }`}
          >
            <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/40 border border-white/20 transform group-hover:scale-110 transition">
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
