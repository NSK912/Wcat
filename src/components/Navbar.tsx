import React from 'react';
import { Film } from 'lucide-react';

interface NavbarProps {
  videoName: string;
  onUploadClick: () => void;
  onSampleClick: () => void;
  onReset: () => void;
  onExportClick: () => void;
  isLoaded: boolean;
  isProcessing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  videoName,
}) => {
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
    </header>
  );
};
