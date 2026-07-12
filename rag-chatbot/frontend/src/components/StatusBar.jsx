import { useState, useEffect } from 'react';
import { Database, Activity } from 'lucide-react';
import { checkHealth } from '../services/api';

export default function StatusBar({ refreshKey }) {
  const [health, setHealth] = useState(null);
  const [online, setOnline] = useState(null);
  const needsKey = online === true && health?.gemini_configured === false;

  useEffect(() => {
    checkHealth()
      .then(r => { setHealth(r.data); setOnline(true); })
      .catch(() => { setOnline(false); });
  }, [refreshKey]);

  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 rounded-lg border border-[#222] bg-[#0d0d0d] px-2.5 py-1.5">
        <div className="flex items-center gap-2">
          {online === null && (
            <span className="h-[7px] w-[7px] rounded-full bg-neutral-500 animate-pulse" />
          )}
          {online === true && !needsKey && (
            <span className="h-[7px] w-[7px] rounded-full bg-emerald-400 shadow-[0_0_8px_#00e676aa] animate-pulse" />
          )}
          {needsKey && (
            <span className="h-[7px] w-[7px] rounded-full bg-amber-300 shadow-[0_0_8px_#fcd34d]" />
          )}
          {online === false && (
            <span className="h-[7px] w-[7px] rounded-full bg-red-400" />
          )}
          <span className="text-xs font-medium text-neutral-300">
            {online === null ? 'connecting...' : needsKey ? 'needs key' : online ? 'ready' : 'offline'}
          </span>
        </div>

        {health && !needsKey && (
          <span className="ml-auto flex items-center gap-1 rounded bg-[#111] px-1.5 py-0.5 text-[10px] text-neutral-500">
            <Activity size={9} className="text-cyan-300" />
            live
          </span>
        )}
      </div>

      {health && (
        <div className="mt-2 flex items-center gap-1.5 px-0.5 text-[11px] text-neutral-500">
          <Database size={14} className="text-neutral-600" />
          {health.chunks_stored} indexed chunks
        </div>
      )}
    </div>
  );
}
