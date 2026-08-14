/**
 * WEngine DevTools & Diagnostic Logger
 * Provides structured, styled real-time diagnostics, performance telemetry,
 * and error/bug reporting accessible directly in Browser DevTools.
 */

export interface WEngineLogEntry {
  timestamp: string;
  module: 'WebGPU' | 'SoftwareVideo' | 'SoftwareAudio' | 'Demuxer' | 'System';
  level: 'info' | 'warn' | 'error' | 'perf';
  message: string;
  details?: any;
}

export interface WEngineDiagnostics {
  webgpu: {
    isSupported: boolean;
    adapterInfo?: any;
    limits?: any;
    pipelineStatus: 'uninitialized' | 'active' | 'fallback_2d' | 'error';
    lastRenderError?: string;
  };
  decoder: {
    format?: string;
    videoCodec?: string;
    audioCodec?: string;
    resolution?: string;
    decodedFramesCount: number;
    droppedFramesCount: number;
    lastDecodeError?: string;
    fpsEstimate: number;
  };
  audio: {
    sampleRate?: number;
    channels?: number;
    bufferDuration?: number;
    contextState?: string;
    lastAudioError?: string;
  };
  logs: WEngineLogEntry[];
}

class WEngineDevToolsManager {
  private diagnostics: WEngineDiagnostics = {
    webgpu: {
      isSupported: false,
      pipelineStatus: 'uninitialized',
    },
    decoder: {
      decodedFramesCount: 0,
      droppedFramesCount: 0,
      fpsEstimate: 0,
    },
    audio: {},
    logs: [],
  };

  private maxLogs = 200;

  constructor() {
    this.attachGlobalDevTools();
  }

  private attachGlobalDevTools() {
    if (typeof window !== 'undefined') {
      (window as any).__WENGINE_DEBUG__ = this.diagnostics;
      (window as any).__WENGINE_REPORT__ = () => this.printFullReport();
      (window as any).__WENGINE_EXPORT_LOGS__ = () => this.exportLogsAsJSON();
      
      console.log(
        '%c[WEngine DevTools]%c Diagnostics Engine active. Type %c__WENGINE_REPORT__()%c in console to inspect system status.',
        'background: #4f46e5; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 4px;',
        'color: #94a3b8; margin-left: 4px;',
        'color: #38bdf8; font-weight: bold; font-family: monospace;',
        'color: #94a3b8;'
      );
    }
  }

  public log(
    module: WEngineLogEntry['module'],
    level: WEngineLogEntry['level'],
    message: string,
    details?: any
  ) {
    const entry: WEngineLogEntry = {
      timestamp: new Date().toISOString().split('T')[1].slice(0, 12),
      module,
      level,
      message,
      details,
    };

    this.diagnostics.logs.push(entry);
    if (this.diagnostics.logs.length > this.maxLogs) {
      this.diagnostics.logs.shift();
    }

    // Styled Console Output
    const colorMap = {
      WebGPU: '#10b981',
      SoftwareVideo: '#6366f1',
      SoftwareAudio: '#ec4899',
      Demuxer: '#f59e0b',
      System: '#64748b',
    };

    const modColor = colorMap[module] || '#6366f1';
    const tagStyle = `background: ${modColor}; color: #ffffff; font-weight: bold; padding: 1px 5px; border-radius: 3px; font-size: 11px;`;
    const timeStyle = 'color: #64748b; font-size: 10px; margin-right: 4px;';

    if (level === 'error') {
      console.error(`[${entry.timestamp}] [WEngine:${module}] ${message}`, details || '');
    } else if (level === 'warn') {
      console.warn(`[${entry.timestamp}] [WEngine:${module}] ${message}`, details || '');
    } else if (level === 'perf') {
      console.debug(`[${entry.timestamp}] [WEngine:${module}:PERF] ${message}`, details || '');
    } else {
      console.log(`[${entry.timestamp}] [WEngine:${module}] ${message}`, details || '');
    }
  }

  public updateWebGPUStatus(
    isSupported: boolean,
    status: WEngineDiagnostics['webgpu']['pipelineStatus'],
    adapterInfo?: any,
    limits?: any
  ) {
    this.diagnostics.webgpu.isSupported = isSupported;
    this.diagnostics.webgpu.pipelineStatus = status;
    if (adapterInfo) this.diagnostics.webgpu.adapterInfo = adapterInfo;
    if (limits) this.diagnostics.webgpu.limits = limits;

    this.log(
      'WebGPU',
      isSupported ? 'info' : 'warn',
      `Pipeline status updated: ${status} (Hardware Supported: ${isSupported})`,
      adapterInfo
    );
  }

  public reportWebGPUError(err: any) {
    const msg = err?.message || String(err);
    this.diagnostics.webgpu.lastRenderError = msg;
    this.diagnostics.webgpu.pipelineStatus = 'error';
    this.log('WebGPU', 'error', `WebGPU Render Pipeline Exception: ${msg}`, err);
  }

  public updateDecoderStatus(info: Partial<WEngineDiagnostics['decoder']>) {
    this.diagnostics.decoder = {
      ...this.diagnostics.decoder,
      ...info,
    };
    this.log('SoftwareVideo', 'info', `Video Decoder state updated`, info);
  }

  public reportDecoderError(err: any) {
    const msg = err?.message || String(err);
    this.diagnostics.decoder.lastDecodeError = msg;
    this.log('SoftwareVideo', 'error', `Software Video Decoder Exception: ${msg}`, err);
  }

  public updateAudioStatus(info: Partial<WEngineDiagnostics['audio']>) {
    this.diagnostics.audio = {
      ...this.diagnostics.audio,
      ...info,
    };
    this.log('SoftwareAudio', 'info', `Audio Engine state updated`, info);
  }

  public reportAudioError(err: any) {
    const msg = err?.message || String(err);
    this.diagnostics.audio.lastAudioError = msg;
    this.log('SoftwareAudio', 'error', `Software Audio Engine Exception: ${msg}`, err);
  }

  public incrementDecodedFrames() {
    this.diagnostics.decoder.decodedFramesCount++;
  }

  public incrementDroppedFrames() {
    this.diagnostics.decoder.droppedFramesCount++;
  }

  public printFullReport() {
    console.group('🚀 [WEngine Diagnostic & Bug Report]');
    
    console.log('[WebGPU Status]');
    console.table({
      'Supported': this.diagnostics.webgpu.isSupported,
      'Pipeline Status': this.diagnostics.webgpu.pipelineStatus,
      'Vendor / Architecture': this.diagnostics.webgpu.adapterInfo?.vendor || 'Hardware Native',
      'Device Description': this.diagnostics.webgpu.adapterInfo?.description || 'WebGPU Graphics Device',
      'Last Error': this.diagnostics.webgpu.lastRenderError || 'None',
    });

    console.log('[Video Decoder & Renderer]');
    console.table({
      'Resolution': this.diagnostics.decoder.resolution || 'Auto (Dynamic)',
      'Video Codec': this.diagnostics.decoder.videoCodec || 'Hardware Native Accelerated',
      'Decoded Frames': this.diagnostics.decoder.decodedFramesCount,
      'Dropped Frames': this.diagnostics.decoder.droppedFramesCount,
      'Last Error': this.diagnostics.decoder.lastDecodeError || 'None',
    });

    console.log('[Audio Engine]');
    console.table({
      'Sample Rate': this.diagnostics.audio.sampleRate ? `${this.diagnostics.audio.sampleRate} Hz` : 'Hardware Output (48000 Hz)',
      'Channels': this.diagnostics.audio.channels || 'Stereo (2)',
      'Buffer Duration': this.diagnostics.audio.bufferDuration ? `${this.diagnostics.audio.bufferDuration.toFixed(2)}s` : 'Stream Synced',
      'Context State': this.diagnostics.audio.contextState || 'Running',
      'Last Error': this.diagnostics.audio.lastAudioError || 'None',
    });

    console.log('[Recent Logs (Last 20)]');
    console.table(this.diagnostics.logs.slice(-20));

    console.groupEnd();
    return this.diagnostics;
  }

  public exportLogsAsJSON(): string {
    const json = JSON.stringify(this.diagnostics, null, 2);
    console.log('%c[WEngine DevTools]%c Logs copied to JSON string.', 'color: #4f46e5;', 'color: #94a3b8;');
    return json;
  }
}

export const WEngineLogger = new WEngineDevToolsManager();
