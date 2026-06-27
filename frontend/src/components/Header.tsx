import React from 'react';

interface HeaderProps {
  cameraActive: boolean;
  systemStatus: string;
}

export const Header: React.FC<HeaderProps> = ({ cameraActive, systemStatus }) => {
  return (
    <header className="flex items-center justify-between border-b border-[var(--border-color)] pb-4 mb-6">
      <div className="flex items-center gap-4">
        <div className="text-3xl animate-[float_2.5s_ease-in-out_infinite]">🌊</div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-sky-400">
            SignWave AI
          </h1>
          <div className="text-xs font-semibold tracking-wider uppercase text-[var(--accent)]">
            Advanced Accessibility Suite
          </div>
        </div>
      </div>
      
      <div className={`px-4 py-1.5 rounded-full text-xs font-bold border flex items-center gap-2 transition-all duration-300 ${
        cameraActive 
          ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.15)]' 
          : 'bg-white/5 text-[var(--text-muted)] border-[var(--border-color)]'
      }`}>
        <span className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-cyan-400 animate-pulse' : 'bg-gray-500'}`} />
        <span>{systemStatus}</span>
      </div>
    </header>
  );
};

export default Header;
