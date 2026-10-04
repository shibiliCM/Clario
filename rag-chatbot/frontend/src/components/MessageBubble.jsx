import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, User, ChevronDown, ChevronUp, FileText, Copy, Check, UploadCloud, Paperclip } from 'lucide-react';

function scoreLabel(score) {
  if (!Number.isFinite(score)) return null;
  return `${Math.max(0, Math.min(100, Math.round(score * 100)))}% match`;
}

export default function MessageBubble({ message, isStreaming = false, onOpenUpload }) {
  const [showSources, setShowSources] = useState(false);
  const [copied, setCopied] = useState(false);
  const isAI = message.role === 'assistant';

  const handleCopy = async () => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className={`group mb-3.5 sm:mb-5 flex max-w-[800px] gap-2.5 sm:gap-3.5 ${isAI ? 'flex-row' : 'ml-auto flex-row-reverse'}`}>
      {/* Avatar */}
      <div className={`
        relative flex h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0 items-center justify-center rounded-xl transition-transform mt-0.5
        ${isAI
          ? 'border border-cyan-500/20 bg-gradient-to-br from-cyan-950/60 to-slate-900/90 text-cyan-400 shadow-sm shadow-cyan-950/50'
          : 'border border-slate-800 bg-slate-900 text-slate-400'}
      `}>
        {isAI ? <Bot size={15} /> : <User size={15} />}
      </div>

      {/* Bubble Container */}
      <div className={`flex max-w-[92%] sm:max-w-[85%] min-w-0 flex-col gap-1.5 ${isAI ? '' : 'items-end'}`}>
        <div className={`
          relative rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 text-sm leading-relaxed transition-all max-w-full break-words
          ${isAI
            ? 'border border-slate-800/80 bg-slate-900/60 text-slate-200 shadow-md shadow-black/20 backdrop-blur-sm'
            : 'border border-cyan-500/30 bg-gradient-to-r from-cyan-950/50 to-blue-950/50 text-slate-100'}
        `}>
          {isAI ? (
            <div className="overflow-hidden">
              <ReactMarkdown
                className="message-markdown"
                components={{
                  a: ({ node, ...props }) => (
                    <a {...props} target="_blank" rel="noreferrer" />
                  ),
                }}
              >
                {message.content || ''}
              </ReactMarkdown>
              {isStreaming && <span className="streaming-cursor" />}
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}

          {/* Action buttons on AI bubble */}
          {isAI && message.content && !isStreaming && (
            <div className="mt-2.5 flex flex-wrap items-center justify-end gap-1.5 border-t border-slate-800/60 pt-2 text-[11px] text-slate-500">
              {onOpenUpload && (
                <button
                  onClick={onOpenUpload}
                  className="flex items-center gap-1 rounded bg-cyan-950/40 border border-cyan-800/30 px-2 py-0.5 text-[11px] text-cyan-300 transition-colors hover:bg-cyan-900/50 hover:text-cyan-200"
                  title="Upload or manage documents"
                  type="button"
                >
                  <Paperclip size={11} />
                  <span>Upload Docs</span>
                </button>
              )}
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 rounded px-2 py-0.5 transition-colors hover:bg-slate-800 hover:text-slate-300"
                  title="Copy response"
                  type="button"
                >
                  {copied ? (
                    <>
                      <Check size={11} className="text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={11} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
            </div>
          )}

          {/* Interactive CTA if no documents indexed */}
          {isAI && message.content && message.content.toLowerCase().includes('no documents are currently indexed') && onOpenUpload && (
            <div className="mt-3 pt-2.5 border-t border-cyan-900/40">
              <button
                onClick={onOpenUpload}
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 px-3.5 py-2.5 text-xs font-bold text-slate-950 shadow-md shadow-cyan-950/40 transition-all hover:scale-[1.01] hover:from-cyan-300 hover:to-sky-300 active:scale-[0.99]"
              >
                <UploadCloud size={16} />
                <span>Upload Documents to Knowledge Base</span>
              </button>
            </div>
          )}
        </div>

        {/* Source Citations Drawer */}
        {isAI && message.sources && message.sources.length > 0 && (
          <div className="mt-0.5 px-1 max-w-full">
            <button
              onClick={() => setShowSources(v => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400/80 transition-colors hover:text-cyan-300 py-0.5"
              type="button"
            >
              {showSources ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              <span>
                {message.sources.length} document source{message.sources.length > 1 ? 's' : ''} cited
              </span>
            </button>

            {showSources && (
              <div className="mt-1.5 flex flex-wrap gap-1.5 max-w-full">
                {message.sources.map((s, i) => (
                  <div
                    key={i}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/90 px-2 sm:px-2.5 py-1 text-xs text-slate-400"
                    title={s.source || 'Document source'}
                  >
                    <FileText size={12} className="text-cyan-400 flex-shrink-0" />
                    <span className="truncate max-w-[130px] sm:max-w-[200px] font-mono text-[10px] sm:text-[11px] text-slate-300">
                      {s.source?.split(/[\\/]/).pop() || 'document'}
                    </span>
                    {scoreLabel(s.score) && (
                      <span className="ml-1 rounded bg-cyan-950/80 px-1.5 py-0.2 text-[9px] sm:text-[10px] font-semibold text-cyan-300 border border-cyan-800/40">
                        {scoreLabel(s.score)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <span className="px-1 font-mono text-[10px] text-slate-600">
          {message.time}
        </span>
      </div>
    </div>
  );
}
