import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Activity,
  Trash2,
  Play,
  CheckCircle2,
  X,
  AlertTriangle,
  HardDrive,
  BarChart3,
  RefreshCw,
  ShieldCheck,
  Zap,
  Layers,
} from 'lucide-react';
import { getMemoryUsage, formatBytes, ProcessingRamLog } from '../utils/ramTracker';

interface RamMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: ProcessingRamLog[];
  onClearLogs: () => void;
}

export const RamMonitorModal: React.FC<RamMonitorModalProps> = ({
  isOpen,
  onClose,
  logs,
  onClearLogs,
}) => {
  const [currentMemory, setCurrentMemory] = useState(getMemoryUsage());
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testProgress, setTestProgress] = useState(0);
  const [testLogMessage, setTestLogMessage] = useState<string>('');
  const [testResults, setTestResults] = useState<{
    allocMB: number;
    ramBeforeMB: number;
    ramDuringMB: number;
    ramAfterMB: number;
    passed: boolean;
  } | null>(null);

  const [opfsQuota, setOpfsQuota] = useState<{ usage: number; quota: number } | null>(null);

  // Poll memory usage every 500ms when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setCurrentMemory(getMemoryUsage());
    }, 500);

    // Fetch OPFS storage estimate if available
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((est) => {
        setOpfsQuota({
          usage: est.usage || 0,
          quota: est.quota || 0,
        });
      }).catch(() => {});
    }

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const usedMB = (currentMemory.usedJSHeapSize / (1024 * 1024)).toFixed(1);
  const totalMB = (currentMemory.totalJSHeapSize / (1024 * 1024)).toFixed(1);
  const limitMB = (currentMemory.jsHeapSizeLimit / (1024 * 1024)).toFixed(1);
  const percentUsed = currentMemory.jsHeapSizeLimit
    ? Math.min(100, Math.round((currentMemory.usedJSHeapSize / currentMemory.jsHeapSizeLimit) * 100))
    : 0;

  // Run interactive RAM Stress & Memory Leak Test
  const handleRunRamBenchmark = async () => {
    setIsTestRunning(true);
    setTestResults(null);
    setTestProgress(10);
    setTestLogMessage('กำลังวัดหน่วยความจำเริ่มต้น (Baseline Memory)...');

    await new Promise((r) => setTimeout(r, 400));
    const memBefore = getMemoryUsage();
    const ramBeforeMB = memBefore.usedJSHeapSize / (1024 * 1024);

    setTestProgress(30);
    setTestLogMessage('กำลังจำลองการจองและสตรีมหน่วยความจำขนาด 200MB ชั่วคราว (Simulated Streaming Allocation)...');

    // Allocate chunks
    const numChunks = 20;
    const chunkSize = 10 * 1024 * 1024; // 10MB each = 200MB total
    let tempBuffers: Uint8Array[] | null = [];

    for (let i = 0; i < numChunks; i++) {
      tempBuffers.push(new Uint8Array(chunkSize).fill(i % 256));
      setTestProgress(30 + Math.round((i / numChunks) * 40));
      await new Promise((r) => setTimeout(r, 50));
    }

    await new Promise((r) => setTimeout(r, 300));
    const memDuring = getMemoryUsage();
    const ramDuringMB = memDuring.usedJSHeapSize / (1024 * 1024);

    setTestProgress(80);
    setTestLogMessage('กำลังคืนหน่วยความจำและเรียก Garbage Collector (Releasing & Cleaning up)...');

    // Release references
    tempBuffers = null;

    // Force memory allocation tick to help trigger GC
    await new Promise((r) => setTimeout(r, 600));

    const memAfter = getMemoryUsage();
    const ramAfterMB = memAfter.usedJSHeapSize / (1024 * 1024);

    setTestProgress(100);
    setTestLogMessage('การทดสอบแรมเสร็จสิ้น!');

    const isLeaking = ramAfterMB - ramBeforeMB > 50; // if >50MB retained permanently
    setTestResults({
      allocMB: 200,
      ramBeforeMB: parseFloat(ramBeforeMB.toFixed(1)),
      ramDuringMB: parseFloat(ramDuringMB.toFixed(1)),
      ramAfterMB: parseFloat(ramAfterMB.toFixed(1)),
      passed: !isLeaking,
    });

    setIsTestRunning(false);
  };

  const handleForceGC = () => {
    // Attempt GC hint by allocating and immediately dropping a minor array
    let dummy: any = new Array(1000000).fill(0);
    dummy = null;
    setCurrentMemory(getMemoryUsage());
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900/95 border border-white/10 rounded-2xl w-full max-w-2xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-white animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600/30 border border-indigo-500/40 rounded-xl flex items-center justify-center text-indigo-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                ระบบเทสแรม & Diagnostic RAM Monitor
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold px-2 py-0.5 rounded-full">
                  Real-time
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                ตรวจสอบการใช้งานหน่วยความจำ (JS Heap & Disk Stream) และทดสอบ Memory Leak
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1">
          
          {/* Current RAM Status Gauge */}
          <div className="bg-slate-950/60 border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center text-indigo-300">
                <Activity className="w-4 h-4 mr-1.5 text-indigo-400 animate-pulse" />
                สถานะแรมปัจจุบัน (JavaScript Heap Memory)
              </span>
              <span className="text-slate-400 font-mono">
                {currentMemory.supported ? `${usedMB} MB / ${limitMB} MB (${percentUsed}%)` : 'ไม่รองรับ Performance.memory'}
              </span>
            </div>

            {/* Gauge Bar */}
            <div className="w-full bg-slate-800/80 h-3.5 rounded-full overflow-hidden border border-white/5 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  percentUsed > 80
                    ? 'bg-gradient-to-r from-amber-500 to-rose-600'
                    : percentUsed > 50
                    ? 'bg-gradient-to-r from-indigo-500 to-amber-500'
                    : 'bg-gradient-to-r from-emerald-500 to-indigo-500'
                }`}
                style={{ width: `${Math.max(2, percentUsed)}%` }}
              />
            </div>

            {/* Sub Stats Grid */}
            <div className="grid grid-cols-3 gap-3 pt-1 text-center font-mono">
              <div className="bg-slate-900/80 border border-white/5 p-2.5 rounded-xl">
                <div className="text-[10px] text-slate-400 font-sans">แรมที่ใช้งานอยู่ (Used)</div>
                <div className="text-sm font-bold text-emerald-400">{usedMB} MB</div>
              </div>
              <div className="bg-slate-900/80 border border-white/5 p-2.5 rounded-xl">
                <div className="text-[10px] text-slate-400 font-sans">แรมที่จองไว้ (Allocated)</div>
                <div className="text-sm font-bold text-indigo-400">{totalMB} MB</div>
              </div>
              <div className="bg-slate-900/80 border border-white/5 p-2.5 rounded-xl">
                <div className="text-[10px] text-slate-400 font-sans">ขีดจำกัดแรมเบราว์เซอร์</div>
                <div className="text-sm font-bold text-slate-300">{limitMB} MB</div>
              </div>
            </div>

            {/* OPFS Disk Storage Quota */}
            {opfsQuota && (
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/5">
                <span className="flex items-center text-slate-300">
                  <HardDrive className="w-3.5 h-3.5 mr-1 text-purple-400" />
                  พื้นที่ดิสก์ชั่วคราว OPFS Storage:
                </span>
                <span className="font-mono text-purple-300">
                  ใช้ไป {formatBytes(opfsQuota.usage)} / โควต้าสูงสุด {formatBytes(opfsQuota.quota)}
                </span>
              </div>
            )}
          </div>

          {/* Interactive Benchmark Test Button Section */}
          <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-indigo-200 flex items-center">
                  <Zap className="w-4 h-4 mr-1.5 text-indigo-400" />
                  ทดสอบประสิทธิภาพการใช้แรม (RAM Benchmark & Leak Test)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  จำลองการจองแรม 200MB แล้วทดสอบคืนค่า ดูว่า Garbage Collector ทำงานปกติหรือไม่
                </p>
              </div>
              <button
                onClick={handleRunRamBenchmark}
                disabled={isTestRunning}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition flex items-center space-x-1.5 shrink-0"
              >
                {isTestRunning ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังทดสอบ...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>เริ่มทดสอบแรม</span>
                  </>
                )}
              </button>
            </div>

            {/* Progress or Test Results */}
            {isTestRunning && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[11px] text-slate-300">
                  <span>{testLogMessage}</span>
                  <span>{testProgress}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full transition-all duration-200"
                    style={{ width: `${testProgress}%` }}
                  />
                </div>
              </div>
            )}

            {testResults && !isTestRunning && (
              <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                testResults.passed
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
              }`}>
                <div className="flex items-center font-bold">
                  {testResults.passed ? (
                    <>
                      <ShieldCheck className="w-4 h-4 mr-1.5 text-emerald-400" />
                      ผลการทดสอบ: ผ่าน! ระบบจัดการแรมคืนค่าได้ปกติ (No Memory Leak detected)
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 mr-1.5 text-rose-400" />
                      ผลการทดสอบ: พบการใช้แรมคงค้างบางส่วนหลังทดสอบ
                    </>
                  )}
                </div>
                <div className="font-mono text-[11px] grid grid-cols-3 gap-2 pt-1 opacity-90">
                  <div>แรมก่อนทดสอบ: {testResults.ramBeforeMB} MB</div>
                  <div>แรมสูงสุดระหว่างทดสอบ: {testResults.ramDuringMB} MB</div>
                  <div>แรมหลังเคลียร์: {testResults.ramAfterMB} MB</div>
                </div>
              </div>
            )}
          </div>

          {/* Processing Log History */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 flex items-center">
                <BarChart3 className="w-4 h-4 mr-1.5 text-slate-400" />
                ประวัติวัดแรมของแต่ละกระบวนการ ({logs.length} รายการ)
              </h3>
              {logs.length > 0 && (
                <button
                  onClick={onClearLogs}
                  className="text-xs text-slate-400 hover:text-rose-400 transition flex items-center"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  ล้างประวัติ
                </button>
              )}
            </div>

            <div className="bg-black/50 border border-white/10 rounded-xl overflow-hidden">
              {logs.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  ยังไม่มีประวัติการวัดแรม (เมื่อคุณตัดหรือรวมวิดีโอ ข้อมูลแรมจะถูกบันทึกที่นี่โดยอัตโนมัติ)
                </div>
              ) : (
                <div className="divide-y divide-white/5 max-h-56 overflow-y-auto">
                  {logs.map((log) => {
                    const ramDiff = log.peakRamMB - log.startRamMB;
                    return (
                      <div key={log.id} className="p-3 text-xs flex flex-col space-y-1 hover:bg-white/5 transition">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200 flex items-center">
                            <Layers className="w-3.5 h-3.5 mr-1 text-indigo-400" />
                            {log.taskName} ({log.fileSizeStr})
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {log.startTime} | ใช้เวลา {log.durationSec}s
                          </span>
                        </div>

                        <div className="grid grid-cols-4 gap-2 font-mono text-[11px] pt-1">
                          <div className="text-slate-400">
                            เริ่มต้น: <span className="text-slate-200">{log.startRamMB} MB</span>
                          </div>
                          <div className="text-slate-400">
                            แรมสูงสุด: <span className="text-amber-400 font-semibold">{log.peakRamMB} MB</span>
                          </div>
                          <div className="text-slate-400">
                            แรมหลังเคลียร์: <span className="text-emerald-400 font-semibold">{log.finalRamMB} MB</span>
                          </div>
                          <div className="text-right">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                              + {ramDiff.toFixed(1)} MB
                            </span>
                          </div>
                        </div>

                        {log.notes && (
                          <div className="text-[10px] text-slate-400 italic pt-0.5">
                            {log.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between">
          <button
            onClick={handleForceGC}
            className="text-xs text-slate-400 hover:text-white flex items-center px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            เคลียร์หน่วยความจำชั่วคราว
          </button>
          <button
            onClick={onClose}
            className="bg-white/10 hover:bg-white/20 text-white font-semibold text-xs px-5 py-2 rounded-xl border border-white/10 transition"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
};
