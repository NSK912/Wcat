// Utility to measure JavaScript Memory Heap in supported browsers (Chromium / Chrome / Edge / Electron)
export interface MemoryInfo {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
  supported: boolean;
}

export interface ProcessingRamLog {
  id: string;
  taskName: string;
  fileSizeStr: string;
  startTime: string;
  durationSec: number;
  startRamMB: number;
  peakRamMB: number;
  finalRamMB: number;
  status: 'completed' | 'canceled' | 'failed' | 'testing';
  notes: string;
}

export const getMemoryUsage = (): MemoryInfo => {
  if (typeof window !== 'undefined' && (performance as any).memory) {
    const mem = (performance as any).memory;
    return {
      jsHeapSizeLimit: mem.jsHeapSizeLimit || 0,
      totalJSHeapSize: mem.totalJSHeapSize || 0,
      usedJSHeapSize: mem.usedJSHeapSize || 0,
      supported: true,
    };
  }
  return {
    jsHeapSizeLimit: 0,
    totalJSHeapSize: 0,
    usedJSHeapSize: 0,
    supported: false,
  };
};

export const formatBytes = (bytes: number, decimals: number = 1): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};
