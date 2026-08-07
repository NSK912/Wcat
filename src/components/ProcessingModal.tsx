import React from 'react';
import { Loader2, Download, AlertCircle, X } from 'lucide-react';

interface ProcessingModalProps {
  isOpen: boolean;
  progress: number;
  message: string;
  logs: string[];
  outputUrl: string | null;
  outputFilename: string;
  onClose: () => void;
  onDownload: () => void;
}

export const ProcessingModal: React.FC<ProcessingModalProps> = ({
  isOpen,
  progress,
  message,
  logs,
  outputUrl,
  outputFilename,
  onClose,
  onDownload,
}) => {
  if (!isOpen) return null;

  const isError = message.toLowerCase().includes('error') || message.toLowerCase().includes('failed');

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl w-full max-w-lg p-5 shadow-2xl flex flex-col space-y-4 animate-in fade-in zoom-in duration-200">
        
        {/* Terminal log box (includes Error & Status reporting) */}
        <div className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl p-3.5 h-48 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1.5 select-text">
          {message && (
            <div
              className={`px-3 py-2 rounded-lg border text-xs font-sans font-medium flex items-center space-x-2 mb-2 ${
                isError
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">{message}</span>
            </div>
          )}

          {logs.length === 0 ? (
            <div className="text-slate-500 italic px-1">Initializing FFmpeg core...</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="truncate px-1 text-slate-400">
                {log}
              </div>
            ))
          )}
        </div>

        {/* Actions / Progress Button */}
        <div className="pt-1">
          {outputUrl ? (
            <div className="flex space-x-3">
              <button
                onClick={onDownload}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-semibold text-sm shadow-xl shadow-emerald-600/20 flex items-center justify-center space-x-2 transition"
              >
                <Download className="w-4 h-4" />
                <span>Download {outputFilename}</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition border border-white/10 flex items-center justify-center"
              >
                <X className="w-4 h-4 mr-1" />
                <span>Close</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="relative w-full h-11 bg-slate-800/90 hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-semibold transition border border-white/10 overflow-hidden shadow-inner flex items-center justify-between px-4 select-none group"
              title="Click to Cancel or close"
            >
              {/* Progress bar background fill */}
              <div
                className="absolute inset-y-0 left-0 bg-indigo-600 transition-all duration-300 rounded-xl"
                style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
              />

              {/* Left text: Cancel */}
              <span className="relative z-10 text-white group-hover:text-amber-200 transition">
                Cancel
              </span>

              {/* Right text & icon: Processing + spinning icon without background */}
              <div className="relative z-10 flex items-center space-x-2 text-white">
                <span>Processing</span>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

