
import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface TerminalProps {
  logs: LogEntry[];
}

const Terminal: React.FC<TerminalProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg shadow-2xl flex flex-col h-[500px] overflow-hidden">
      <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
        </div>
        <span className="text-xs text-slate-400 mono ml-2 font-medium">cloudlaunch-v0.1 -- zsh</span>
      </div>
      <div 
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto mono text-sm leading-relaxed scroll-smooth"
      >
        {logs.map((log, i) => (
          <div key={i} className="mb-1 flex gap-2">
            <span className="text-slate-600 select-none">[{log.timestamp}]</span>
            <span className={
              log.type === 'error' ? 'text-red-400' :
              log.type === 'success' ? 'text-emerald-400' :
              log.type === 'system' ? 'text-sky-400 font-semibold' :
              log.type === 'prompt' ? 'text-amber-400' :
              'text-slate-300'
            }>
              {log.message}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2 text-slate-300">
          <span className="text-emerald-500">➜</span>
          <span className="animate-pulse">_</span>
        </div>
      </div>
    </div>
  );
};

export default Terminal;
