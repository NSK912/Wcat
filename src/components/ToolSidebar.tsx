import React from 'react';
import { ActiveTab, EditSettings } from '../types';
import { Scissors, Sparkles, Sliders, Type, Volume2, Download, RotateCw, FlipHorizontal, FlipVertical } from 'lucide-react';
import { formatTime } from '../utils/sampleVideos';

interface ToolSidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  settings: EditSettings;
  onChangeSettings: (newSettings: Partial<EditSettings>) => void;
  duration: number;
  onExportClick: () => void;
  isProcessing: boolean;
  isLoaded: boolean;
}

export const ToolSidebar: React.FC<ToolSidebarProps> = ({
  activeTab,
  setActiveTab,
  settings,
  onChangeSettings,
  duration,
  onExportClick,
  isProcessing,
  isLoaded,
}) => {
  const tabs = [
    { id: 'trim', label: 'Trim', icon: Scissors },
    { id: 'filters', label: 'Filters', icon: Sparkles },
    { id: 'adjust', label: 'Adjust', icon: Sliders },
    { id: 'text', label: 'Text', icon: Type },
    { id: 'audio', label: 'Audio', icon: Volume2 },
    { id: 'export', label: 'Export', icon: Download },
  ] as const;

  if (!isLoaded) {
    return (
      <div className="w-80 bg-slate-900 border-l border-slate-800 p-6 flex flex-col items-center justify-center text-center text-slate-400">
        <Sliders className="w-12 h-12 text-slate-700 mb-3" />
        <p className="text-sm">Upload a video to unlock editing tools.</p>
      </div>
    );
  }

  return (
    <aside className="w-96 backdrop-blur-xl bg-white/5 border-l border-white/10 flex flex-col h-[calc(100vh-64px)] text-slate-200">
      {/* Tab bar */}
      <div className="flex border-b border-white/5 bg-black/20 p-1.5 overflow-x-auto gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveTab)}
              className={`flex-1 min-w-[56px] py-2.5 px-2 rounded-xl flex flex-col items-center space-y-1 transition text-xs font-medium ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Panel */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {activeTab === 'trim' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Trim Video Clip</h3>
              <p className="text-xs text-slate-400">Set start and end points for your exported video.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1.5">
                  Start Time: <span className="text-indigo-400 font-mono font-bold">{formatTime(settings.startTime)}</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={settings.endTime - 0.5}
                  step={0.1}
                  value={settings.startTime}
                  onChange={(e) => onChangeSettings({ startTime: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-500 bg-white/10 h-2 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1.5">
                  End Time: <span className="text-indigo-400 font-mono font-bold">{formatTime(settings.endTime)}</span>
                </label>
                <input
                  type="range"
                  min={settings.startTime + 0.5}
                  max={duration || 100}
                  step={0.1}
                  value={settings.endTime}
                  onChange={(e) => onChangeSettings({ endTime: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-500 bg-white/10 h-2 rounded-lg cursor-pointer"
                />
              </div>

              <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-2 text-xs backdrop-blur-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Selected Duration:</span>
                  <span className="font-mono font-bold text-white">{formatTime(settings.endTime - settings.startTime)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Original Duration:</span>
                  <span className="font-mono text-white">{formatTime(duration)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'filters' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Visual Filters</h3>
              <p className="text-xs text-slate-400">Apply artistic color grading and effects.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'none', name: 'Normal', preview: 'bg-slate-800' },
                { id: 'grayscale', name: 'Grayscale', preview: 'bg-gradient-to-r from-slate-600 to-slate-400' },
                { id: 'sepia', name: 'Sepia', preview: 'bg-gradient-to-r from-amber-800 to-amber-600' },
                { id: 'negative', name: 'Negative', preview: 'bg-gradient-to-r from-indigo-900 to-pink-600' },
                { id: 'vignette', name: 'Cinematic', preview: 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900' },
                { id: 'blur', name: 'Soft Blur', preview: 'bg-gradient-to-r from-slate-700 to-slate-500 backdrop-blur-sm' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => onChangeSettings({ filter: f.id as any })}
                  className={`p-3 rounded-xl border text-left transition flex flex-col space-y-2 backdrop-blur-sm ${
                    settings.filter === f.id
                      ? 'border-indigo-500 bg-indigo-600/20 text-white shadow-lg'
                      : 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-300'
                  }`}
                >
                  <div className={`w-full h-8 rounded-lg ${f.preview} border border-white/10`} />
                  <span className="text-xs font-medium">{f.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'adjust' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Adjustments & Geometry</h3>
              <p className="text-xs text-slate-400">Control brightness, speed, crop, and rotation.</p>
            </div>

            <div className="space-y-5">
              {/* Brightness */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1.5">
                  <span>Brightness</span>
                  <span className="font-mono text-indigo-400">{settings.brightness.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  value={settings.brightness}
                  onChange={(e) => onChangeSettings({ brightness: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-500 bg-white/10 h-2 rounded-lg cursor-pointer"
                />
              </div>

              {/* Contrast */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1.5">
                  <span>Contrast</span>
                  <span className="font-mono text-indigo-400">{settings.contrast.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  value={settings.contrast}
                  onChange={(e) => onChangeSettings({ contrast: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-500 bg-white/10 h-2 rounded-lg cursor-pointer"
                />
              </div>

              {/* Speed */}
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-2">Playback Speed</label>
                <div className="grid grid-cols-4 gap-2">
                  {[0.5, 1, 1.5, 2].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => onChangeSettings({ speed: spd })}
                      className={`py-2 rounded-xl text-xs font-semibold border transition ${
                        settings.speed === spd
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio */}
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-2">Aspect Ratio</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['original', '16:9', '9:16', '1:1', '4:3'] as const).map((aspect) => (
                    <button
                      key={aspect}
                      onClick={() => onChangeSettings({ cropAspect: aspect })}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition uppercase ${
                        settings.cropAspect === aspect
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {aspect}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rotate & Flip */}
              <div className="space-y-3 pt-2">
                <label className="text-xs font-medium text-slate-300 block">Orientation</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => onChangeSettings({ rotation: (settings.rotation + 90) % 360 })}
                    className="flex-1 flex items-center justify-center space-x-1.5 bg-white/5 hover:bg-white/10 border border-white/10 py-2 rounded-xl text-xs text-slate-300 transition"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Rotate ({settings.rotation}°)</span>
                  </button>

                  <button
                    onClick={() => onChangeSettings({ flipH: !settings.flipH })}
                    className={`p-2 rounded-xl border transition ${
                      settings.flipH ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                    title="Flip Horizontal"
                  >
                    <FlipHorizontal className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onChangeSettings({ flipV: !settings.flipV })}
                    className={`p-2 rounded-xl border transition ${
                      settings.flipV ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                    title="Flip Vertical"
                  >
                    <FlipVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'text' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Watermark / Text Overlay</h3>
              <p className="text-xs text-slate-400">Add custom text overlay to your video.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1.5">Watermark Text</label>
                <input
                  type="text"
                  placeholder="e.g. @MyChannel or Draft"
                  value={settings.watermarkText}
                  onChange={(e) => onChangeSettings({ watermarkText: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 backdrop-blur-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1.5">Position</label>
                <select
                  value={settings.watermarkPosition}
                  onChange={(e) => onChangeSettings({ watermarkPosition: e.target.value as any })}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="top-left" className="bg-slate-900">Top Left</option>
                  <option value="top-right" className="bg-slate-900">Top Right</option>
                  <option value="bottom-left" className="bg-slate-900">Bottom Left</option>
                  <option value="bottom-right" className="bg-slate-900">Bottom Right</option>
                  <option value="center" className="bg-slate-900">Center</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1.5">Text Color</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={settings.watermarkColor}
                      onChange={(e) => onChangeSettings({ watermarkColor: e.target.value })}
                      className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 cursor-pointer p-1"
                    />
                    <span className="text-xs font-mono text-slate-400">{settings.watermarkColor}</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1.5">Font Size ({settings.watermarkSize}px)</label>
                  <input
                    type="range"
                    min={12}
                    max={64}
                    value={settings.watermarkSize}
                    onChange={(e) => onChangeSettings({ watermarkSize: parseInt(e.target.value) })}
                    className="w-full accent-indigo-500 bg-white/10 h-2 rounded-lg cursor-pointer mt-3"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Audio Controls</h3>
              <p className="text-xs text-slate-400">Manage video volume or remove sound.</p>
            </div>

            <div className="space-y-5">
              <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm">
                <div>
                  <h4 className="text-xs font-medium text-white">Mute Audio</h4>
                  <p className="text-[11px] text-slate-400">Remove audio track from export</p>
                </div>
                <button
                  onClick={() => onChangeSettings({ muteAudio: !settings.muteAudio })}
                  className={`w-12 h-6 rounded-full transition relative p-1 ${
                    settings.muteAudio ? 'bg-indigo-600' : 'bg-white/10'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition transform ${
                      settings.muteAudio ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {!settings.muteAudio && (
                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1.5">
                    <span>Volume Level</span>
                    <span className="font-mono text-indigo-400">{Math.round(settings.volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={settings.volume}
                    onChange={(e) => onChangeSettings({ volume: parseFloat(e.target.value) })}
                    className="w-full accent-indigo-500 bg-white/10 h-2 rounded-lg cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'export' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Export Settings</h3>
              <p className="text-xs text-slate-400">Choose format and render your final video.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-2">Output Format</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'mp4', name: 'MP4 Video', desc: 'Best for sharing' },
                    { id: 'webm', name: 'WebM Video', desc: 'High web compatibility' },
                    { id: 'gif', name: 'Animated GIF', desc: 'No audio loop' },
                    { id: 'mp3', name: 'MP3 Audio', desc: 'Extract audio track' },
                  ].map((fmt) => (
                    <button
                      key={fmt.id}
                      onClick={() => onChangeSettings({ outputFormat: fmt.id as any })}
                      className={`p-3 rounded-xl border text-left transition flex flex-col space-y-1 backdrop-blur-sm ${
                        settings.outputFormat === fmt.id
                          ? 'border-indigo-500 bg-indigo-600/20 text-white shadow-lg'
                          : 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-300'
                      }`}
                    >
                      <span className="text-xs font-semibold">{fmt.name}</span>
                      <span className="text-[10px] text-slate-400">{fmt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={onExportClick}
                  disabled={isProcessing}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white py-3.5 rounded-full font-semibold text-sm shadow-xl shadow-indigo-500/20 flex items-center justify-center space-x-2 transition transform active:scale-98"
                >
                  <Download className="w-4 h-4" />
                  <span>{isProcessing ? 'Processing with FFmpeg...' : 'Start Export'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
