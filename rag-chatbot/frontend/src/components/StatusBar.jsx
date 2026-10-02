import { useState, useEffect } from 'react';
import { Database, Activity, Sparkles, AlertTriangle } from 'lucide-react';
import { checkHealth } from '../services/api';

export default function StatusBar({ refreshKey, onOpenSettings }) {
  const [health, setHealth] = useState(null);
  const [online, setOnline] = useState(null);
  const needsKey = online === true && health?.gemini_configured === false;

  useEffect(() => {
    checkHealth()
      .then(r => { setHealth(r.data); setOnline(true); })
      .catch(() => { setOnline(false); });
  }, [refreshKey]);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
        <div className="flex items-center gap-2">
          {online === null && (
            <span className="h-2 w-2 rounded-full bg-slate-500 animate-pulse" />
          )}
          {online === true && !needsKey && (
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
          )}
          {needsKey && (
            <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
          )}
          {online === false && (
            <span className="h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_8px_#f87171]" />
          )}
          <span className="font-mono text-xs font-medium text-slate-300 truncate max-w-[140px] sm:max-w-none">
            {online === null ? 'connecting...' : needsKey ? 'Gemini: local only' : online ? 'Gemini 2.5 Flash' : 'backend offline'}
          </span>
        </div>

        {needsKey ? (
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1 rounded bg-amber-950/60 border border-amber-800/40 px-2 py-1 text-[10px] font-semibold text-amber-300 hover:bg-amber-900/60 transition-colors flex-shrink-0 touch-manipulation"
          >
            <AlertTriangle size={10} />
            add key
          </button>
        ) : (
          health && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-cyan-400">
              <Activity size={10} className="text-emerald-400" />
              live
            </span>
          )
        )}
      </div>

      {health && (
        <div className="flex items-center justify-between px-1 text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5">
            <Database size={12} className="text-cyan-400" />
            {health.chunks_stored} indexed chunks
          </span>
          <span className="text-slate-500 text-[10px]">
            ChromaDB
          </span>
        </div>
      )}
    </div>
  );
}
