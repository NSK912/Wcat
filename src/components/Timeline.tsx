import React, { useState, useRef } from 'react';
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
} from 'lucide-react';
import { formatTime } from '../utils/sampleVideos';
import wcatSeekPng from '../../assets/Wcat seek.png';
import wcatSeekSvg from '../../public/wcat-seek.svg';

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
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 1x to 4x zoom for timeline expansion
  const [dragTooltip, setDragTooltip] = useState<string | null>(null);

  const trimContainerRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

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

  // Timeline Clip Dragging (ลาก, ย่อ, ขยาย)
  const startTrimDrag = (e: React.MouseEvent, type: 'left' | 'right' | 'middle') => {
    e.preventDefault();
    e.stopPropagation();
    if (!trimContainerRef.current) return;

    const startX = e.clientX;
    const startStartTime = startTime;
    const startEndTime = endTime;
    const rect = trimContainerRef.current.getBoundingClientRect();
    const containerWidth = rect.width || 500;
    const totalDuration = duration || 100;
    const minSpan = Math.max(0.1, (24 / containerWidth) * totalDuration);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaTime = (deltaX / containerWidth) * totalDuration;

      if (type === 'middle') {
        const span = startEndTime - startStartTime;
        let newStart = startStartTime + deltaTime;
        let newEnd = startEndTime + deltaTime;

        if (newStart < 0) {
          newStart = 0;
          newEnd = span;
        }
        if (newEnd > totalDuration) {
          newEnd = totalDuration;
          newStart = totalDuration - span;
        }

        const clampedStart = Math.max(0, newStart);
        const clampedEnd = Math.min(totalDuration, newEnd);
        onStartTimeChange(clampedStart);
        onEndTimeChange(clampedEnd);
        onSeek(clampedStart);
        setDragTooltip(`Clip: ${formatTime(clampedStart)} - ${formatTime(clampedEnd)} (${formatTime(clampedEnd - clampedStart)})`);
      } else if (type === 'left') {
        let newStart = startStartTime + deltaTime;
        newStart = Math.max(0, Math.min(newStart, startEndTime - minSpan));
        onStartTimeChange(newStart);
        onSeek(newStart);
        setDragTooltip(`In Point: ${formatTime(newStart)}`);
      } else if (type === 'right') {
        let newEnd = startEndTime + deltaTime;
        newEnd = Math.max(startStartTime + minSpan, Math.min(newEnd, totalDuration));
        onEndTimeChange(newEnd);
        onSeek(newEnd);
        setDragTooltip(`Out Point: ${formatTime(newEnd)}`);
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

  // Split / Cut function at playhead (วางตัด)
  const handleSplitAtPlayhead = () => {
    if (duration <= 0) return;
    const pos = currentTime;
    
    // Split: adjust nearest boundary to current position
    if (pos > startTime && pos < endTime) {
      const mid = (startTime + endTime) / 2;
      if (pos >= mid) {
        onEndTimeChange(pos);
      } else {
        onStartTimeChange(pos);
      }
    } else if (pos <= startTime) {
      onStartTimeChange(pos);
    } else if (pos >= endTime) {
      onEndTimeChange(pos);
    }
  };

  // Mark In `[`
  const handleMarkIn = () => {
    if (currentTime < endTime) {
      onStartTimeChange(currentTime);
    }
  };

  // Mark Out `]`
  const handleMarkOut = () => {
    if (currentTime > startTime) {
      onEndTimeChange(currentTime);
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const startPercent = duration > 0 ? (startTime / duration) * 100 : 0;
  const endPercent = duration > 0 ? (endTime / duration) * 100 : 100;
  const clipDuration = Math.max(0, endTime - startTime);

  // Generate ruler tick marks for Zoomed Timeline Track
  const rulerTicks = [];
  const tickCount = Math.min(30, Math.max(6, Math.floor(10 * zoomLevel)));
  for (let i = 0; i <= tickCount; i++) {
    const timeVal = (i / tickCount) * (duration || 10);
    rulerTicks.push({
      percent: (i / tickCount) * 100,
      time: formatTime(timeVal),
    });
  }

  return (
    <div className="backdrop-blur-xl bg-slate-950/80 border-t border-white/10 px-5 py-3 flex flex-col space-y-2.5 select-none relative">
      {/* Top Controls Toolbar */}
      <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
        {/* Playback Controls & Time Display */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="flex items-center space-x-1.5">
            <button
              onClick={onFullscreenClick}
              className="h-9 w-9 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center shadow-sm border border-white/10 transition shrink-0 cursor-pointer"
              title="เต็มจอ (Fullscreen)"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={onTogglePlay}
              className={`h-9 w-9 rounded-lg flex items-center justify-center text-white shadow-md transition shrink-0 cursor-pointer ${
                isEncodeMode
                  ? 'bg-violet-600 hover:bg-violet-500 shadow-violet-600/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
              }`}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
          </div>

          <div className="font-mono text-xs font-medium leading-snug flex flex-col justify-center shrink-0 select-none">
            <span className={isEncodeMode ? 'text-violet-400 font-bold' : 'text-indigo-400 font-bold'}>
              {formatTime(currentTime, duration)}
            </span>
            <span className="text-slate-400 font-bold">{formatTime(duration || 0)}</span>
          </div>

          {/* Timeline Editing Buttons when in Encode Mode */}
          {isEncodeMode && (
            <div className="flex items-center space-x-1.5 pl-2 border-l border-white/10">
              <button
                onClick={handleSplitAtPlayhead}
                className="h-8 px-2.5 bg-violet-950/70 hover:bg-violet-900 text-violet-300 hover:text-white rounded-lg border border-violet-500/40 text-xs font-medium flex items-center space-x-1 transition cursor-pointer shadow-sm"
                title="ตัดคลิปที่ตำแหน่งหัวอ่านปัจจุบัน (Cut / Split at Current Position)"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Split</span>
              </button>

              <button
                onClick={handleMarkIn}
                className="h-8 px-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-[11px] font-mono font-semibold transition cursor-pointer"
                title="กำหนดจุดเริ่มต้น [ (Set In Point)"
              >
                [ In
              </button>

              <button
                onClick={handleMarkOut}
                className="h-8 px-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-[11px] font-mono font-semibold transition cursor-pointer"
                title="กำหนดจุดสิ้นสุด ] (Set Out Point)"
              >
                Out ]
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons Cluster */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Zoom Controls for Timeline when in Encode Mode */}
          {isEncodeMode && (
            <div className="flex items-center space-x-1 bg-slate-900/80 border border-violet-500/30 rounded-lg p-0.5">
              <button
                onClick={() => setZoomLevel((z) => Math.max(1, z - 0.5))}
                disabled={zoomLevel <= 1}
                className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 rounded transition cursor-pointer"
                title="ย่อขนาดไทม์ไลน์ (Zoom Out)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono text-violet-300 px-1 font-bold">
                {zoomLevel.toFixed(1)}x
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(3, z + 0.5))}
                disabled={zoomLevel >= 3}
                className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 rounded transition cursor-pointer"
                title="ขยายขนาดไทม์ไลน์ (Zoom In)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Single File Upload Button */}
          <button
            onClick={onUploadClick}
            title="เลือกไฟล์ (ครั้งละ 1 ไฟล์)"
            className="h-9 w-9 flex items-center justify-center bg-white/5 hover:bg-white/10 text-slate-200 rounded-lg transition border border-white/10 backdrop-blur-sm group shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
          </button>

          {/* Multiple Files Upload Button */}
          <button
            onClick={onMultiUploadClick}
            title="เลือกหลายไฟล์"
            className="h-9 w-9 flex items-center justify-center bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-200 rounded-lg transition border border-indigo-500/30 backdrop-blur-sm group shrink-0 cursor-pointer"
          >
            <LayoutGrid className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
          </button>

          {/* Remux Button: ONLY shown when NOT in Encode Mode */}
          {!isEncodeMode && (!selectedFiles || selectedFiles.length <= 1) && (
            <button
              onClick={onExportClick}
              disabled={isProcessing}
              className="h-9 px-3.5 flex items-center justify-center bg-indigo-950/60 hover:bg-indigo-900/80 disabled:bg-indigo-950/30 text-indigo-200 rounded-lg text-xs font-semibold border border-indigo-500/30 backdrop-blur-sm shadow-md transition transform active:scale-95 shrink-0 cursor-pointer"
              title="Remux (Fast Lossless Copy)"
            >
              <span>Remux</span>
            </button>
          )}

          {/* Export / Encode Button */}
          <button
            onClick={onExportClick}
            disabled={isProcessing}
            className={`h-9 px-4 flex items-center space-x-1.5 text-white rounded-lg text-xs font-semibold shadow-md transition transform active:scale-95 shrink-0 cursor-pointer ${
              isEncodeMode
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-violet-500/25'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'
            }`}
            title={isEncodeMode ? 'Encode & Export with WebCodecs API' : 'Export Video'}
          >
            {isEncodeMode ? <Sparkles className="w-3.5 h-3.5 text-amber-300" /> : <Download className="w-4 h-4" />}
            <span>{isEncodeMode ? 'Encode' : 'Export'}</span>
          </button>
        </div>
      </div>

      {/* Drag Tooltip Indicator */}
      {dragTooltip && (
        <div className="absolute left-1/2 -top-8 -translate-x-1/2 z-50 bg-slate-900/95 border border-violet-400 text-violet-200 text-[11px] font-mono font-semibold px-3 py-0.5 rounded shadow-xl animate-fadeIn pointer-events-none">
          {dragTooltip}
        </div>
      )}

      {/* Main Single Unified Timeline & Editing Track */}
      {selectedFiles && selectedFiles.length > 1 ? (
        <div className="relative h-14 rounded-xl overflow-hidden border border-indigo-500/30 bg-black/70 shadow-inner flex items-center px-3 space-x-3 overflow-x-auto">
          <div className="text-xs font-semibold text-indigo-400 whitespace-nowrap bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-500/30 flex items-center space-x-1">
            <span>Merge Track ({selectedFiles.length})</span>
          </div>
          <div className="flex items-center space-x-2 overflow-x-auto py-1">
            {selectedFiles.map((file, idx) => (
              <div
                key={idx}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, idx)}
                onClick={() => onSelectFile?.(file)}
                className={`flex items-center space-x-1.5 bg-slate-900/90 border ${
                  draggedIdx === idx ? 'border-indigo-400 opacity-50' : 'border-white/10 hover:border-indigo-500/50'
                } px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap cursor-pointer active:cursor-grabbing transition`}
                title="Click to preview, drag or use arrows to reorder"
              >
                <span className="text-indigo-300 font-mono font-bold">#{idx + 1}</span>
                <span className="text-slate-200 truncate max-w-[100px]">{file.name}</span>
                <span className="text-[10px] text-slate-400">({(file.size / (1024 * 1024)).toFixed(1)}M)</span>

                <div className="flex items-center space-x-0.5 ml-1 pl-1 border-l border-white/10">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveFile(idx, 'left');
                    }}
                    disabled={idx === 0}
                    className="p-0.5 hover:bg-white/10 rounded disabled:opacity-30 text-slate-300 cursor-pointer"
                    title="Move Left"
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
                    title="Move Right"
                  >
                    ›
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Unified Timeline Track (Scrubber, Frames, Clip Trimming, and Cat Seek integrated in one single space) */
        <div
          ref={timelineScrollRef}
          className="relative rounded-xl overflow-x-auto overflow-y-hidden border border-white/15 bg-black/60 shadow-inner"
        >
          <div
            ref={trimContainerRef}
            className="relative h-16 cursor-pointer select-none"
            style={{ width: `${zoomLevel * 100}%`, minWidth: '100%' }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const percent = Math.max(0, Math.min(1, clickX / rect.width));
              onSeek(percent * duration);
            }}
          >
            {/* 1. Top Ruler (Ticks & Timestamps) */}
            <div className="absolute top-0 inset-x-0 h-4 bg-black/70 border-b border-white/10 flex items-center pointer-events-none z-10">
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

            {/* 2. Video Thumbnails Filmstrip */}
            <div
              className="absolute inset-0 pt-4 grid gap-0.5 pointer-events-none opacity-60"
              style={{
                gridTemplateColumns: `repeat(${thumbnails.length > 0 ? Math.max(6, thumbnails.length * zoomLevel) : 6}, minmax(0, 1fr))`,
              }}
            >
              {thumbnails.length > 0 ? (
                thumbnails.map((thumb, idx) => (
                  <div
                    key={idx}
                    className="relative h-full overflow-hidden bg-slate-900 border-r border-white/10 last:border-r-0"
                  >
                    <img
                      src={thumb}
                      alt={`Frame ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))
              ) : (
                Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="relative h-full overflow-hidden bg-slate-900/90 border-r border-white/10 last:border-r-0 flex items-center justify-center"
                  >
                    <span className="text-[9px] text-slate-500 font-mono">FRAME {idx + 1}</span>
                  </div>
                ))
              )}
            </div>

            {/* 3. Darkened Out-of-bounds overlays (Dimmed unselected areas) */}
            <div
              className="absolute top-4 bottom-0 left-0 bg-black/60 pointer-events-none z-10"
              style={{ width: `${startPercent}%` }}
            />
            <div
              className="absolute top-4 bottom-0 right-0 bg-black/60 pointer-events-none z-10"
              style={{ width: `${Math.max(0, 100 - endPercent)}%` }}
            />

            {/* 4. Active Timeline Clip Container (Draggable, Resizable, Non-overlapping) */}
            <div
              className={`absolute top-4 bottom-0 bg-indigo-500/10 rounded-sm shadow-xl z-20 flex items-center justify-between cursor-grab active:cursor-grabbing select-none border-2 ${
                isEncodeMode ? 'border-violet-400 bg-violet-600/15' : 'border-indigo-400 bg-indigo-600/15'
              }`}
              style={{
                left: `${startPercent}%`,
                width: `${Math.max(0, endPercent - startPercent)}%`,
              }}
              onMouseDown={(e) => startTrimDrag(e, 'middle')}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Left Trim Handle (ย่อ/ขยายจุดเริ่มต้น) */}
              <div
                className={`absolute left-0 top-0 bottom-0 w-3.5 rounded-l-[2px] shadow-md cursor-ew-resize z-30 shrink-0 flex items-center justify-center group ${
                  isEncodeMode ? 'bg-violet-400 hover:bg-white' : 'bg-indigo-400 hover:bg-white'
                }`}
                onMouseDown={(e) => startTrimDrag(e, 'left')}
                onClick={(e) => e.stopPropagation()}
                title="ลากเพื่อย่อ/ขยายจุดเริ่มต้น In (Drag to resize start)"
              >
                <div className="w-0.5 h-4 bg-slate-900/80 rounded-full" />
              </div>

              {/* Right Trim Handle (ย่อ/ขยายจุดสิ้นสุด) */}
              <div
                className={`absolute right-0 top-0 bottom-0 w-3.5 rounded-r-[2px] shadow-md cursor-ew-resize z-30 shrink-0 flex items-center justify-center group ${
                  isEncodeMode ? 'bg-violet-400 hover:bg-white' : 'bg-indigo-400 hover:bg-white'
                }`}
                onMouseDown={(e) => startTrimDrag(e, 'right')}
                onClick={(e) => e.stopPropagation()}
                title="ลากเพื่อย่อ/ขยายจุดสิ้นสุด Out (Drag to resize end)"
              >
                <div className="w-0.5 h-4 bg-slate-900/80 rounded-full" />
              </div>

              {/* Clip Central Time Badge (Clean, inside clip, no separate text row) */}
              <div className="flex items-center justify-center px-4 w-full pointer-events-none overflow-hidden">
                <span
                  className={`text-[10px] font-mono font-bold text-white px-2 py-0.5 rounded shadow-sm whitespace-nowrap truncate backdrop-blur-md ${
                    isEncodeMode ? 'bg-violet-950/80 border border-violet-400/40 text-violet-200' : 'bg-indigo-950/80 border border-indigo-400/40 text-indigo-200'
                  }`}
                >
                  {formatTime(startTime)} - {formatTime(endTime)} ({formatTime(clipDuration)})
                </span>
              </div>
            </div>

            {/* 5. Playhead Vertical Needle & Cat Handle */}
            <div
              className="absolute top-0 bottom-0 z-30 pointer-events-none flex flex-col items-center -translate-x-1/2"
              style={{ left: `${progressPercent}%` }}
            >
              {/* Cat Handle */}
              <img
                src={wcatSeekPng}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = wcatSeekSvg;
                }}
                alt="Playhead"
                className="h-6 w-auto max-w-none object-contain select-none drop-shadow -translate-y-1"
              />
              {/* Playhead Needle Line */}
              <div className="w-[2px] flex-1 bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
