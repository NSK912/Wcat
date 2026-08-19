import React, { useRef, useEffect, useState } from 'react';
import { Loader2, Download, AlertCircle, X, FileDown, Copy, Check, Terminal } from 'lucide-react';

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
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  const isError = message.toLowerCase().includes('error') || message.toLowerCase().includes('failed');

  // Extract diagnosis and suggestion if present in logs
  const diagnosisLine = logs.find(l => l.startsWith('[DIAGNOSIS]'))?.replace('[DIAGNOSIS]', '').trim();
  const suggestionLine = logs.find(l => l.startsWith('[SUGGESTION]'))?.replace('[SUGGESTION]', '').trim();

  const generateFullLogText = () => {
    const timestamp = new Date().toLocaleString('th-TH');
    const logHeader = [
      `========================================`,
      ` Mediabunny / Wcat Engine Process & Error Log`,
      ` Date & Time: ${timestamp}`,
      ` Status / Message: ${message}`,
      ` User Agent: ${navigator.userAgent}`,
      `========================================`,
      ``,
      `--- Detailed Logs (${logs.length} lines) ---`,
      ``
    ].join('\n');

    return logHeader + (logs.length > 0 ? logs.join('\n') : 'No detailed logs recorded.');
  };

  const handleCopyLog = () => {
    const text = generateFullLogText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveLog = () => {
    const fullContent = generateFullLogText();
    const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isError ? `mediabunny_error_log_${Date.now()}.txt` : `process_log_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl w-full max-w-xl p-5 shadow-2xl flex flex-col space-y-4 animate-in fade-in zoom-in duration-200">
        
        {/* Header Title */}
        <div className="flex items-center justify-between pb-1 border-b border-white/10">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-200">Processing Console Log</h3>
          </div>
          <div className="flex items-center space-x-2">
            {logs.length > 0 && (
              <button
                onClick={handleCopyLog}
                className="text-xs text-slate-400 hover:text-white transition flex items-center space-x-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10"
                title="Copy logs to clipboard"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy Logs'}</span>
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-white transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Diagnostic Banner if error */}
        {isError && (diagnosisLine || suggestionLine) && (
          <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-3 text-xs space-y-1.5 animate-in fade-in">
            <div className="flex items-center space-x-1.5 text-rose-400 font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Diagnostic Summary</span>
            </div>
            {diagnosisLine && (
              <p className="text-slate-200 pl-5 leading-relaxed">
                <span className="font-semibold text-amber-300">Cause:</span> {diagnosisLine}
              </p>
            )}
            {suggestionLine && (
              <p className="text-slate-300 pl-5 leading-relaxed">
                <span className="font-semibold text-cyan-300">Recommendation:</span> {suggestionLine}
              </p>
            )}
          </div>
        )}

        {/* Terminal log box */}
        <div
          ref={logContainerRef}
          className="bg-black/70 backdrop-blur-sm border border-white/10 rounded-xl p-3.5 h-64 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1 select-text scrollbar-thin scrollbar-thumb-slate-700"
        >
          {logs.length === 0 ? (
            <div className="text-slate-400 italic px-1">
              {message || 'Processing...'}
            </div>
          ) : (
            logs.map((log, idx) => {
              const lower = log.toLowerCase();
              const isErrorLine = lower.includes('error') || lower.includes('fatal') || log.startsWith('[ERROR');
              const isDiagnosis = log.startsWith('[DIAGNOSIS]');
              const isSuggestion = log.startsWith('[SUGGESTION]');
              const isInspect = log.startsWith('[INSPECT]') || log.startsWith('[TRACK');
              const isNotice = lower.includes('notice') || lower.includes('warning') || log.includes('⚠️');
              const isDoneLine = log.startsWith('[DONE]') || log.startsWith('[COMPLETE]');

              let colorClass = 'text-slate-300';
              if (isErrorLine) {
                colorClass = 'text-rose-400 font-semibold bg-rose-950/30 px-1 py-0.5 rounded border-l-2 border-rose-500 my-0.5';
              } else if (isDiagnosis) {
                colorClass = 'text-amber-300 font-medium bg-amber-950/30 px-1 py-0.5 rounded border-l-2 border-amber-500 my-0.5';
              } else if (isSuggestion) {
                colorClass = 'text-cyan-300 font-medium bg-cyan-950/30 px-1 py-0.5 rounded border-l-2 border-cyan-500 my-0.5';
              } else if (isInspect) {
                colorClass = 'text-sky-300 font-mono';
              } else if (isNotice) {
                colorClass = 'text-amber-300 font-medium';
              } else if (isDoneLine) {
                colorClass = 'text-emerald-400 font-semibold';
              }

              return (
                <div
                  key={idx}
                  className={`px-1 break-all whitespace-pre-wrap leading-relaxed ${colorClass}`}
                >
                  {log}
                </div>
              );
            })
          )}
        </div>

        {/* Actions / Progress Button */}
        <div className="pt-1">
          {isDone ? (
            <div className="flex flex-col space-y-2">
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
                    <span>Save Error Log (.txt)</span>
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

