import React from 'react';
import { Play, Pause, Scissors, Upload, Sparkles, RefreshCw, Download, Plus, LayoutGrid } from 'lucide-react';
import { formatTime } from '../utils/sampleVideos';

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
  isLoaded: boolean;
  isProcessing: boolean;
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
  onReset,
  onExportClick,
  isLoaded,
  isProcessing,
}) => {
  const [draggedIdx, setDraggedIdx] = React.useState<number | null>(null);
  const trimContainerRef = React.useRef<HTMLDivElement>(null);

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
    // Handles are w-2.5 (10px) each = 20px handles + 4px border = 24px minimum box width
    const minSpan = Math.max(0.1, (20 / containerWidth) * totalDuration);

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

        onStartTimeChange(Math.max(0, newStart));
        onEndTimeChange(Math.min(totalDuration, newEnd));
        onSeek(newStart);
      } else if (type === 'left') {
        let newStart = startStartTime + deltaTime;
        newStart = Math.max(0, Math.min(newStart, startEndTime - minSpan));
        onStartTimeChange(newStart);
        onSeek(newStart);
      } else if (type === 'right') {
        let newEnd = startEndTime + deltaTime;
        newEnd = Math.max(startStartTime + minSpan, Math.min(newEnd, totalDuration));
        onEndTimeChange(newEnd);
        onSeek(newEnd);
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

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
  const [holding, setHolding] = React.useState(false);
  const [holdProgress, setHoldProgress] = React.useState(0);
  const holdTimerRef = React.useRef<number | null>(null);
  const startTimeRef = React.useRef<number>(0);

  const startHolding = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setHolding(true);
    startTimeRef.current = Date.now();
    setHoldProgress(0);
    
    const interval = 20;
    const durationNeeded = 1000; // 1 second hold

    const updateHold = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const prog = Math.min(100, (elapsed / durationNeeded) * 100);
      setHoldProgress(prog);
      if (prog >= 100) {
        onReset();
        stopHolding();
      } else {
        holdTimerRef.current = window.setTimeout(updateHold, interval);
      }
    };
    holdTimerRef.current = window.setTimeout(updateHold, interval);
  };

  const stopHolding = () => {
    setHolding(false);
    setHoldProgress(0);
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const startPercent = duration > 0 ? (startTime / duration) * 100 : 0;
  const endPercent = duration > 0 ? (endTime / duration) * 100 : 100;

  return (
    <div className="backdrop-blur-xl bg-white/5 border-t border-white/10 px-6 py-4 flex flex-col space-y-3">
      {/* Single Row Toolbar: Play Controls + Video Scrubber Track + Action Buttons */}
      <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-3 text-sm text-slate-300">
        {/* Playback Controls & Time Display */}
        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={onTogglePlay}
            className="h-9 w-9 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 transition shrink-0"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <div className="font-mono text-xs font-medium leading-snug flex flex-col justify-center shrink-0 select-none">
            <span className="text-indigo-400 font-bold">{formatTime(currentTime, duration)}</span>
            <span className="text-slate-400 font-bold">{formatTime(duration || 0)}</span>
          </div>
        </div>

        {/* Scrubber & Trim Track (Middle Flexible Space) */}
        <div className="relative flex-1 h-8 flex items-center min-w-[140px] w-full md:w-auto">
          {/* Background track */}
          <div
            className="absolute inset-x-0 h-3 bg-white/10 rounded-full overflow-hidden cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const percent = clickX / rect.width;
              onSeek(percent * duration);
            }}
          >
            {/* Active trim range highlight */}
            <div
              className="absolute top-0 bottom-0 bg-indigo-600/30 border-y border-indigo-500/50"
              style={{
                left: `${startPercent}%`,
                width: `${Math.max(0, endPercent - startPercent)}%`,
              }}
            />

            {/* Played progress */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-indigo-500/50 pointer-events-none"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Scrubber head */}
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.01}
            value={currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="absolute inset-x-0 inset-y-0 opacity-0 cursor-pointer w-full h-full z-20"
          />

          {/* Visual scrubber handle (Wcat seek image) */}
          <div
            className="absolute top-1/2 -translate-y-1/2 pointer-events-none z-10 flex items-center justify-center -translate-x-1/2"
            style={{ left: `${progressPercent}%` }}
          >
            <img 
              src="/wcat-seek.png" 
              onError={(e) => {
                // Fallback to SVG if needed
                (e.target as HTMLImageElement).src = '/wcat-seek.svg';
              }}
              alt="Seek handle" 
              className="h-9 w-auto max-w-none object-contain select-none drop-shadow-md transition-transform duration-75 hover:scale-110"
            />
          </div>
        </div>

        {/* Action Buttons Cluster: Single File, Multi Files, Remux / Export */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Single File Upload Button (Icon only) */}
          <button
            onClick={onUploadClick}
            title="เลือกไฟล์ (ครั้งละ 1 ไฟล์)"
            className="h-9 w-9 flex items-center justify-center bg-white/5 hover:bg-white/10 text-slate-200 rounded-lg transition border border-white/10 backdrop-blur-sm group shrink-0"
          >
            <Plus className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
          </button>

          {/* Multiple Files Upload Button (Icon only: 4 small squares) */}
          <button
            onClick={onMultiUploadClick}
            title="เลือกหลายไฟล์"
            className="h-9 w-9 flex items-center justify-center bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-200 rounded-lg transition border border-indigo-500/30 backdrop-blur-sm group shrink-0"
          >
            <LayoutGrid className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
          </button>

          {/* Remux Button (Available when single file) */}
          {(!selectedFiles || selectedFiles.length <= 1) && (
            <button
              onClick={onExportClick}
              disabled={isProcessing}
              className="h-9 px-3.5 flex items-center justify-center bg-indigo-950/60 hover:bg-indigo-900/80 disabled:bg-indigo-950/30 text-indigo-200 rounded-lg text-xs font-semibold border border-indigo-500/30 backdrop-blur-sm shadow-md transition transform active:scale-95 shrink-0"
              title="Remux (Fast Lossless Copy)"
            >
              <span>Remux</span>
            </button>
          )}

          {/* Export Button (Always available) */}
          <button
            onClick={onExportClick}
            disabled={isProcessing}
            className="h-9 px-4 flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-500/20 transition transform active:scale-95 shrink-0"
            title="Export Video"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Video Preview or Multiple Files Preview Box */}
      {selectedFiles && selectedFiles.length > 1 ? (
        <div className="relative h-14 rounded-xl overflow-hidden border border-indigo-500/30 bg-black/70 shadow-inner flex items-center px-3 space-x-3 overflow-x-auto">
          <div className="text-xs font-semibold text-indigo-400 whitespace-nowrap bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-500/30 flex items-center space-x-1">
            <span>Merge Mode ({selectedFiles.length})</span>
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
                className={`flex items-center space-x-1.5 bg-slate-900/90 border ${draggedIdx === idx ? 'border-indigo-400 opacity-50' : 'border-white/10 hover:border-indigo-500/50'} px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap cursor-pointer active:cursor-grabbing transition`}
                title="Click to preview, drag or use arrows to reorder"
              >
                <span className="text-indigo-300 font-mono font-bold">#{idx + 1}</span>
                <span className="text-slate-200 truncate max-w-[100px]">{file.name}</span>
                <span className="text-[10px] text-slate-400">({(file.size / (1024 * 1024)).toFixed(1)}M)</span>
                
                <div className="flex items-center space-x-0.5 ml-1 pl-1 border-l border-white/10">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); moveFile(idx, 'left'); }}
                    disabled={idx === 0}
                    className="p-0.5 hover:bg-white/10 rounded disabled:opacity-30 text-slate-300"
                    title="Move Left"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); moveFile(idx, 'right'); }}
                    disabled={idx === selectedFiles.length - 1}
                    className="p-0.5 hover:bg-white/10 rounded disabled:opacity-30 text-slate-300"
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
        <div 
          ref={trimContainerRef}
          className="relative h-14 rounded-xl overflow-hidden border border-white/15 bg-black/40 shadow-inner flex"
        >
          <div 
            className="absolute inset-0 grid gap-0.5 pointer-events-none"
            style={{
              gridTemplateColumns: `repeat(${thumbnails.length > 0 ? thumbnails.length : 5}, minmax(0, 1fr))`
            }}
          >
            {thumbnails.length > 0 ? (
              thumbnails.map((thumb, idx) => (
                <div key={idx} className="relative h-full overflow-hidden bg-slate-900 border-r border-white/10 last:border-r-0">
                  <img src={thumb} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover opacity-100 transition" />
                </div>
              ))
            ) : (
              Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="relative h-full overflow-hidden bg-slate-900/80 border-r border-white/10 last:border-r-0 flex items-center justify-center">
                  <span className="text-[10px] text-slate-600 font-mono">FRAME {idx + 1}</span>
                </div>
              ))
            )}
          </div>

          {/* Active Trim Range Box over preview images (Transparent fill, clipped overflow) */}
          <div
            className="absolute top-0 bottom-0 bg-transparent border-2 border-indigo-400 rounded-lg shadow-xl z-10 flex flex-col justify-between cursor-grab active:cursor-grabbing select-none overflow-hidden min-w-[24px]"
            style={{
              left: `${startPercent}%`,
              width: `${Math.max(0, endPercent - startPercent)}%`,
            }}
            onMouseDown={(e) => startTrimDrag(e, 'middle')}
          >
            {/* Full height Left Handle */}
            <div 
              className="absolute left-0 top-0 bottom-0 w-2.5 bg-indigo-300 hover:bg-white rounded-l-sm shadow cursor-ew-resize z-30 shrink-0"
              onMouseDown={(e) => startTrimDrag(e, 'left')}
              title="Drag to trim start"
            ></div>

            {/* Full height Right Handle */}
            <div 
              className="absolute right-0 top-0 bottom-0 w-2.5 bg-indigo-300 hover:bg-white rounded-r-sm shadow cursor-ew-resize z-30 shrink-0"
              onMouseDown={(e) => startTrimDrag(e, 'right')}
              title="Drag to trim end"
            ></div>

            {/* Top header draggable */}
            <div 
              className="h-3.5 bg-indigo-600/50 hover:bg-indigo-500/70 text-[9px] font-mono text-white flex items-center justify-center rounded-t select-none cursor-grab active:cursor-grabbing border-b border-indigo-400/30 whitespace-nowrap overflow-hidden px-3 shrink-0"
              onMouseDown={(e) => startTrimDrag(e, 'middle')}
              title="Drag to move entire trim range"
            >
              TRIM ZONE
            </div>

            <div className="flex items-center justify-center px-3 flex-1 relative overflow-hidden">
              <div className="text-[10px] font-mono font-semibold text-white bg-indigo-950/90 px-1 py-0.5 rounded shadow pointer-events-none whitespace-nowrap overflow-hidden text-ellipsis z-10 max-w-full text-center">
                {formatTime(Math.max(0, endTime - startTime))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
