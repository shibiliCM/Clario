import { useState, useEffect } from 'react';
import { X, Key, ShieldCheck, Database, Server, Check, Trash2, ExternalLink } from 'lucide-react';
import { getCustomApiKey, setCustomApiKey, checkHealth } from '../services/api';

export default function SettingsModal({ isOpen, onClose, onRefresh }) {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setApiKey(getCustomApiKey());
      setSaved(false);
      setLoading(true);
      checkHealth()
        .then(res => setHealth(res.data))
        .catch(() => setHealth(null))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    setCustomApiKey(apiKey);
    setSaved(true);
    onRefresh?.();
    setTimeout(() => setSaved(false), 2500);
  };

  const handleClearKey = () => {
    setApiKey('');
    setCustomApiKey('');
    setSaved(true);
    onRefresh?.();
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-black/60">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          type="button"
        >
          <X size={18} />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-950/60 text-cyan-400">
            <Key size={18} />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-white">Clario Configuration</h3>
            <p className="text-xs text-slate-400">Manage your provider credentials and runtime status</p>
          </div>
        </div>

        {/* Gemini API Key form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-200">
                Custom Google Gemini API Key
              </label>
              <a
                href="https://aistudio.google.com/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
              >
                <span>Get a free key</span>
                <ExternalLink size={10} />
              </a>
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 font-mono text-xs text-slate-200 placeholder-slate-700 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
              Stored only in your browser's local storage. Passed directly to the backend for streaming responses.
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleClearKey}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-400 transition-colors"
            >
              <Trash2 size={13} />
              Reset to Server Default
            </button>

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 shadow-md shadow-cyan-950/40 hover:bg-cyan-300 transition-all"
            >
              {saved ? (
                <>
                  <Check size={14} className="text-slate-950" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Key</span>
              )}
            </button>
          </div>
        </form>

        {/* Runtime Diagnostics */}
        <div className="mt-6 border-t border-slate-800/80 pt-4">
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            System & Engine Status
          </p>

          <div className="space-y-2 rounded-xl border border-slate-800/80 bg-slate-950/70 p-3 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5 text-slate-500">
                <Server size={13} />
                API Server
              </span>
              <span className="font-semibold text-emerald-400">
                {health ? 'Online (v2.1.0)' : 'Offline / Checking...'}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5 text-slate-500">
                <ShieldCheck size={13} />
                Active Model
              </span>
              <span className="text-slate-200">{health?.model || 'gemini-2.5-flash'}</span>
            </div>

            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5 text-slate-500">
                <Database size={13} />
                ChromaDB
              </span>
              <span className="text-cyan-400">
                {health ? `${health.chunks_stored} chunks indexed` : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
