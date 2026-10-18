// Proprietary In-House Native Media Toolkit - Target Writers
import { StreamTargetChunk } from './types';

export class StreamTarget {
  private writable: WritableStream<StreamTargetChunk>;
  private writer: WritableStreamDefaultWriter<StreamTargetChunk> | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  public options?: any;

  constructor(writable: WritableStream<StreamTargetChunk>, options?: any) {
    this.writable = writable;
    this.options = options;
  }

  public async getWriter(): Promise<WritableStreamDefaultWriter<StreamTargetChunk>> {
    if (!this.writer) {
      this.writer = this.writable.getWriter();
    }
    return this.writer;
  }

  public on(event: string, fn: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
  }

  public off(event: string, fn: Function): void {
    this.listeners.get(event)?.delete(fn);
  }

  public emit(event: string, ...args: any[]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const fn of set) {
        try {
          fn(...args);
        } catch (e) {
          console.error(`Error in target listener for ${event}:`, e);
        }
      }
    }
  }

  public async write(chunk: StreamTargetChunk): Promise<void> {
    const w = await this.getWriter();
    await w.write(chunk);
    this.emit('write', {
      position: chunk.position,
      size: chunk.data.byteLength,
      end: (chunk.position ?? 0) + chunk.data.byteLength,
    });
  }

  public async close(): Promise<void> {
    if (this.writer) {
      try {
        await this.writer.close();
      } catch {}
      this.writer = null;
    }
  }
}

export class BufferTarget {
  private chunks: Uint8Array[] = [];
  public buffer: ArrayBuffer | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private currentLength = 0;

  constructor() {}

  public on(event: string, fn: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
  }

  public off(event: string, fn: Function): void {
    this.listeners.get(event)?.delete(fn);
  }

  public emit(event: string, ...args: any[]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const fn of set) {
        try {
          fn(...args);
        } catch (e) {
          console.error(`Error in target listener for ${event}:`, e);
        }
      }
    }
  }

  public async write(chunk: StreamTargetChunk | Uint8Array): Promise<void> {
    const data = (chunk && 'data' in chunk) ? chunk.data : (chunk as Uint8Array);
    this.chunks.push(data);
    this.currentLength += data.byteLength;
    this.emit('write', {
      position: (chunk && 'position' in chunk) ? chunk.position : this.currentLength - data.byteLength,
      size: data.byteLength,
      end: this.currentLength,
    });
  }

  public finalize(): ArrayBuffer {
    const out = new Uint8Array(this.currentLength);
    let offset = 0;
    for (const c of this.chunks) {
      out.set(c, offset);
      offset += c.byteLength;
    }
    this.buffer = out.buffer;
    return this.buffer;
  }

  public async close(): Promise<void> {
    this.finalize();
  }
}
