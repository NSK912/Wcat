import React from 'react';
import { SAMPLE_VIDEOS } from '../utils/sampleVideos';
import { SampleVideo } from '../types';
import { X, Play, Sparkles } from 'lucide-react';

interface SampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSample: (sample: SampleVideo) => void;
}

export const SampleModal: React.FC<SampleModalProps> = ({ isOpen, onClose, onSelectSample }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl w-full max-w-xl p-6 shadow-2xl flex flex-col space-y-6 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Choose Sample Video</h3>
              <p className="text-xs text-slate-400">Select a pre-loaded video to test editing features instantly.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SAMPLE_VIDEOS.map((sample) => (
            <div
              key={sample.id}
              onClick={() => {
                onSelectSample(sample);
                onClose();
              }}
              className="group bg-white/5 border border-white/10 hover:border-indigo-500/50 rounded-2xl overflow-hidden cursor-pointer transition transform hover:-translate-y-1 shadow-lg backdrop-blur-sm"
            >
              <div className="relative aspect-video bg-black/40 overflow-hidden">
                <img
                  src={sample.thumbnail}
                  alt={sample.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300 opacity-80 group-hover:opacity-100"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/50 transform group-hover:scale-110 transition">
                    <Play className="w-5 h-5 ml-0.5" />
                  </div>
                </div>
              </div>
              <div className="p-3">
                <h4 className="text-xs font-semibold text-white truncate">{sample.name}</h4>
                <span className="text-[10px] text-slate-400 font-mono">Duration: {sample.duration}s</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
