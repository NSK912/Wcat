import { StreamTargetChunk } from 'mediabunny';

let worker: Worker | null = null;
const activeRequests = new Map<string, {
  resolve: (res: any) => void;
  reject: (err: any) => void;
  onProgress?: (prog: any) => void;
  writable?: FileSystemWritableFileStream | null;
}>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./engineWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = async (e: MessageEvent) => {
      const { id, type, success, result, error, progress, chunk } = e.data;
      const req = activeRequests.get(id);
      if (!req) return;

      if (type === 'progress') {
        if (req.onProgress) req.onProgress(progress);
      } else if (type === 'chunk') {
        if (req.writable && typeof req.writable.write === 'function') {
          try {
            if (typeof (req.writable as any).seek === 'function' && typeof chunk.position === 'number') {
              await (req.writable as any).seek(chunk.position);
            }
            await req.writable.write(chunk.data);
          } catch (err) {
            console.error('Worker chunk write failure:', err);
          }
        }
      } else {
        activeRequests.delete(id);
        if (success) {
          req.resolve(result);
        } else {
          req.reject(new Error(error || 'Worker execution failed'));
        }
      }
    };
    worker.onerror = (err) => {
      console.error('Engine Worker Error:', err);
      for (const [id, req] of activeRequests.entries()) {
        req.reject(new Error('Worker crashed or failed: ' + err.message));
      }
      activeRequests.clear();
      worker = null;
    };
  }
  return worker;
}

export async function runEngineInWorker(
  action: 'concat' | 'trim' | 'remux' | 'encode',
  files: File[],
  writable: FileSystemWritableFileStream | null,
  settings?: any,
  startTime?: number,
  endTime?: number,
  onProgress?: (prog: any) => void
): Promise<any> {
  const w = getWorker();
  const id = Math.random().toString(36).substring(2, 9);

  return new Promise((resolve, reject) => {
    activeRequests.set(id, { resolve, reject, onProgress, writable });

    w.postMessage({
      id,
      action,
      payload: {
        files,
        settings,
        startTime,
        endTime
      }
    });
  });
}
