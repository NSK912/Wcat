/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Settings, Home, HardDrive, Cpu, Activity, Maximize2, Minus, X, Box } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="flex flex-col h-screen bg-[#09090b] text-slate-200 font-sans overflow-hidden select-none">
      {/* Title Bar */}
      <div className="h-10 bg-[#09090b] flex items-center justify-between px-4 border-b border-white/5 flex-shrink-0 select-none">
        <div className="flex items-center gap-2 pointer-events-none">
          <Activity size={16} className="text-indigo-500" />
          <span className="text-xs font-medium text-slate-400 tracking-wide">SeedPlanet</span>
        </div>
        {/* Window controls mock */}
        <div className="flex items-center gap-3">
          <button className="hover:bg-white/5 p-1 rounded text-slate-400 hover:text-white transition-colors">
            <Minus size={14} />
          </button>
          <button className="hover:bg-white/5 p-1 rounded text-slate-400 hover:text-white transition-colors">
            <Maximize2 size={12} />
          </button>
          <button className="hover:bg-red-500/80 hover:text-white p-1 rounded text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-[#0c0c0e] border-r border-white/5 flex flex-col flex-shrink-0">
          <div className="p-4">
            <h2 className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-4 px-3">Menu</h2>
            <nav className="flex flex-col gap-1 px-1">
              <NavItem 
                icon={<Home size={18} />} 
                label="Dashboard" 
                isActive={activeTab === 'dashboard'} 
                onClick={() => setActiveTab('dashboard')} 
              />
              <NavItem 
                icon={<Cpu size={18} />} 
                label="System" 
                isActive={activeTab === 'system'} 
                onClick={() => setActiveTab('system')} 
              />
              <NavItem 
                icon={<HardDrive size={18} />} 
                label="Storage" 
                isActive={activeTab === 'storage'} 
                onClick={() => setActiveTab('storage')} 
              />
            </nav>
          </div>
          <div className="mt-auto p-4 border-t border-white/5">
             <nav className="flex flex-col gap-1 px-1">
               <NavItem 
                  icon={<Settings size={18} />} 
                  label="Settings" 
                  isActive={activeTab === 'settings'} 
                  onClick={() => setActiveTab('settings')} 
                />
             </nav>
          </div>
        </div>
        {/* Main Content */}
        <div className="flex-1 overflow-y-auto bg-[#09090b] p-8">
          {activeTab === 'dashboard' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-xl font-medium text-white mb-6">Welcome back</h1>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="CPU Usage" value="24%" trend="+2.5%" />
                <StatCard title="Memory" value="4.2 GB" trend="-0.4%" />
                <StatCard title="Network" value="128 KB/s" trend="Stable" />
              </div>
              <div className="mt-8 p-6 bg-[#121215] border border-white/5 rounded-xl shadow-sm">
                <h3 className="text-sm font-medium text-white mb-2">Desktop App Ready (Electron)</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  Full hardware acceleration enabled with native Wayland/X11 and unlocked 120 FPS+ refresh rate.
                </p>
                <div className="bg-zinc-900/50 p-4 rounded-lg font-mono text-xs text-indigo-300 overflow-x-auto border border-white/5">
                  <span className="text-slate-500"># Run desktop app locally:</span><br />
                  npm run dev:electron<br />
                  <span className="text-slate-500"># Build Linux AppImage:</span><br />
                  npm run build:electron
                </div>
              </div>
            </div>
          )}
          
          {activeTab !== 'dashboard' && activeTab !== 'devgame' && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col items-center justify-center text-slate-500">
                <Activity size={48} className="mb-4 opacity-20 text-indigo-400" />
                <p className="text-sm">Content for {activeTab} goes here.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm transition-colors ${
        isActive 
          ? 'bg-white/5 text-white border border-white/5' 
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
      }`}
    >
      <span className={isActive ? 'text-indigo-400' : 'opacity-70'}>{icon}</span>
      {label}
    </button>
  );
}

function StatCard({ title, value, trend }: { title: string, value: string, trend: string }) {
  const isPositive = trend.startsWith('+');
  const isNeutral = trend === 'Stable';
  
  return (
    <div className="bg-[#121215] p-5 rounded-xl border border-white/5 flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-tight text-slate-500">{title}</span>
      <div className="flex items-end justify-between mt-1">
        <span className="text-2xl font-semibold text-white">{value}</span>
        <span className={`text-[10px] mb-1 ${
          isNeutral ? 'text-slate-500' : isPositive ? 'text-emerald-400' : 'text-red-400'
        }`}>
          {isPositive && !isNeutral ? `↑ ${trend.replace('+', '')}` : isNeutral ? trend : `↓ ${trend.replace('-', '')}`}
        </span>
      </div>
    </div>
  );
}
