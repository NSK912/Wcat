import React from 'react';
import { Loader2, Download, AlertCircle, X, FileDown } from 'lucide-react';

interface ProcessingModalProps {
  isOpen: boolean;
  progress: number;
  message: string;
  logs: string[];
  isDone: boolean;
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
  isDone,
  outputUrl,
  outputFilename,
  onClose,
  onDownload,
}) => {
  if (!isOpen) return null;

  const isError = message.toLowerCase().includes('error') || message.toLowerCase().includes('failed');

  const handleSaveLog = () => {
    const timestamp = new Date().toLocaleString('th-TH');
    const logHeader = [
      `========================================`,
      ` FFmpeg Process & Error Log`,
      ` Date & Time: ${timestamp}`,
      ` Status / Message: ${message}`,
      `========================================`,
      ``,
      `--- Detailed Logs (${logs.length} lines) ---`,
      ``
    ].join('\n');

    const fullContent = logHeader + (logs.length > 0 ? logs.join('\n') : 'No detailed logs recorded.');
    
    const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isError ? `error_log_${Date.now()}.txt` : `ffmpeg_log_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl w-full max-w-lg p-5 shadow-2xl flex flex-col space-y-4 animate-in fade-in zoom-in duration-200">
        
        {/* Terminal log box */}
        <div className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl p-3.5 h-56 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1.5 select-text">
          {logs.length === 0 ? (
            <div className="text-slate-400 italic px-1">
              {message || 'กำลังประมวลผลด้วย FFmpeg...'}
            </div>
          ) : (
            logs.map((log, idx) => (
              <div
                key={idx}
                className={`truncate px-1 ${
                  log.toLowerCase().includes('error') || log.toLowerCase().includes('aborted')
                    ? 'text-rose-400 font-semibold'
                    : 'text-slate-300'
                }`}
              >
                {log}
              </div>
            ))
          )}
        </div>

        {/* Actions / Progress Button */}
        <div className="pt-1">
          {isDone ? (
            <div className="flex space-x-2">
              {outputUrl && (
                <button
                  onClick={onDownload}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-semibold text-sm shadow-xl shadow-emerald-600/20 flex items-center justify-center space-x-2 transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Download {outputFilename}</span>
                </button>
              )}

              {isError && (
                <button
                  onClick={handleSaveLog}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-3 rounded-xl font-semibold text-sm shadow-xl shadow-rose-600/20 flex items-center justify-center space-x-2 transition"
                >
                  <FileDown className="w-4 h-4" />
                  <span>เซฟ Error Log (.txt)</span>
                </button>
              )}

              <button
                onClick={onClose}
                className={`px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition border border-white/10 flex items-center justify-center ${!outputUrl && !isError ? 'w-full py-3' : ''}`}
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

