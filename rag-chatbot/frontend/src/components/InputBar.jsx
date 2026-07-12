import { useEffect, useRef } from 'react';
import { MessageSquare, Mic, SendHorizonal } from 'lucide-react';

export default function InputBar({ value, onChange, onSend, loading }) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  }, [value]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="border-t border-[#1c1c1c] px-6 py-4">
      <div className="flex items-end gap-2.5 rounded-[14px] border border-[#222] bg-[#080808] px-3.5 py-2.5 transition-colors focus-within:border-cyan-300/30">
        <MessageSquare size={17} className="mb-[9px] flex-shrink-0 text-neutral-600" />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
          rows={1}
          placeholder="Ask Clario about your documents..."
          className="
            max-h-32 flex-1 resize-none border-none bg-transparent
            px-0 py-2 text-sm text-neutral-300 placeholder-neutral-700
            outline-none disabled:opacity-50
          "
          style={{ minHeight: '36px' }}
        />
        <button
          type="button"
          className="mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[#222] bg-[#0d0d0d] text-neutral-600 transition-all hover:bg-[#151515] hover:text-neutral-400"
          aria-label="Voice input"
        >
          <Mic size={15} />
        </button>
        <button
          onClick={onSend}
          disabled={loading || !value.trim()}
          className="
            mb-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center
            rounded-[10px] bg-cyan-300 text-black transition-all duration-150
            hover:scale-105 hover:bg-cyan-200 disabled:cursor-not-allowed
            disabled:bg-[#1a1a1a] disabled:text-neutral-700 disabled:hover:scale-100
          "
          aria-label="Send message"
        >
          <SendHorizonal size={18} />
        </button>
      </div>
    </div>
  );
}
