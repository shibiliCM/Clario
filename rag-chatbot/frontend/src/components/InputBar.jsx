import { useEffect, useRef } from 'react';
import { MessageSquare, SendHorizonal, Square } from 'lucide-react';

export default function InputBar({ value, onChange, onSend, onStop, loading, isStreaming }) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
  }, [value]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading && value.trim()) {
        onSend();
      }
    }
  };

  return (
    <div className="border-t border-slate-800/80 bg-slate-950/60 px-6 py-4 backdrop-blur-md">
      <div className="mx-auto max-w-4xl">
        <div className="relative flex items-end gap-2.5 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-2.5 shadow-lg shadow-black/40 transition-colors focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/30">
          <MessageSquare size={17} className="mb-2 flex-shrink-0 text-slate-500" />
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            placeholder="Ask anything about your uploaded documents or web links..."
            className="
              max-h-36 flex-1 resize-none border-none bg-transparent
              px-0 py-1.5 text-sm text-slate-100 placeholder-slate-500
              outline-none disabled:opacity-50
            "
            style={{ minHeight: '36px' }}
          />

          {isStreaming ? (
            <button
              onClick={onStop}
              type="button"
              className="
                mb-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center
                rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40
                transition-all duration-150 hover:bg-rose-500/30 hover:scale-105 active:scale-95
              "
              title="Stop generating"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={loading || !value.trim()}
              className="
                mb-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center
                rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 text-slate-950 font-bold
                transition-all duration-150 hover:scale-105 hover:from-cyan-300 hover:to-sky-300
                shadow-sm shadow-cyan-950/50 disabled:cursor-not-allowed
                disabled:opacity-25 disabled:hover:scale-100 active:scale-95
              "
              aria-label="Send query"
              type="button"
            >
              <SendHorizonal size={17} />
            </button>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-slate-500">
          <span>Clario grounds answers strictly in provided documents</span>
          <span className="hidden sm:inline font-mono text-[10px]">
            <kbd className="rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-slate-400">Enter</kbd> to send • <kbd className="rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-slate-400">Shift + Enter</kbd> newline
          </span>
        </div>
      </div>
    </div>
  );
}
