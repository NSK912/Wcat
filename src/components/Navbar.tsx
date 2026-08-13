import React, { useState, useEffect } from 'react';
import { Film, Cpu, Activity } from 'lucide-react';
import { getMemoryUsage } from '../utils/ramTracker';

interface NavbarProps {
  videoName: string;
  onUploadClick: () => void;
  onSampleClick: () => void;
  onReset: () => void;
  onExportClick: () => void;
  isLoaded: boolean;
  isProcessing: boolean;
  onOpenRamMonitor: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  videoName,
  onOpenRamMonitor,
}) => {
  const [ramUsage, setRamUsage] = useState<string>('');

  useEffect(() => {
    const updateRam = () => {
      const mem = getMemoryUsage();
      if (mem.supported) {
        setRamUsage(`${(mem.usedJSHeapSize / (1024 * 1024)).toFixed(0)} MB`);
      }
    };
    updateRam();
    const interval = setInterval(updateRam, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="relative h-16 border-b border-white/5 backdrop-blur-md bg-white/5 flex items-center justify-between px-6 z-10 text-white shadow-md">
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Film className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            Easy Video Editor
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-medium px-2 py-0.5 rounded-full border border-indigo-500/30">
              FFmpeg WASM
            </span>
          </h1>
          <p className="text-xs text-slate-400">
            {videoName ? `Editing: ${videoName}` : 'Upload a video or choose a sample to start'}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* RAM Live Status & Diagnostic Button */}
        <button
          onClick={onOpenRamMonitor}
          className="flex items-center space-x-2 bg-slate-900/80 hover:bg-indigo-950/80 border border-indigo-500/30 hover:border-indigo-400/60 px-3 py-1.5 rounded-xl transition text-xs shadow-lg group"
          title="คลิกเพื่อเปิดระบบเทสแรม & Diagnostic RAM Monitor"
        >
          <div className="relative flex items-center justify-center">
            <Cpu className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300 transition" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-ping opacity-75" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full" />
          </div>
          <div className="flex flex-col text-left leading-tight">
            <span className="text-[10px] text-indigo-300 font-semibold uppercase tracking-wider flex items-center gap-1">
              ระบบเทสแรม
              <Activity className="w-3 h-3 text-emerald-400" />
            </span>
            <span className="font-mono text-xs font-bold text-slate-200 group-hover:text-white">
              {ramUsage ? `RAM: ${ramUsage}` : 'RAM Monitor'}
            </span>
          </div>
        </button>
      </div>
    </header>
  );
};

