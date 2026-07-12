import { Bot, User, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

function scoreLabel(score) {
  if (!Number.isFinite(score)) return null;
  return `${Math.max(0, Math.min(100, Math.round(score * 100)))}%`;
}

export default function MessageBubble({ message }) {
  const [showSources, setShowSources] = useState(false);
  const isAI = message.role === 'assistant';

  return (
    <div className={`mb-4 flex max-w-[680px] gap-3 ${isAI ? 'flex-row' : 'ml-auto flex-row-reverse'}`}>
      <div className={`
        flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg
        ${isAI
          ? 'border border-cyan-300/15 bg-cyan-300/5'
          : 'border border-[#222] bg-[#111]'}
      `}>
        {isAI
          ? <Bot size={16} className="text-cyan-300" />
          : <User size={16} className="text-neutral-500" />
        }
      </div>

      <div className={`flex max-w-[78%] flex-col gap-1 ${isAI ? '' : 'items-end'}`}>
        <div className={`
          rounded-xl px-3.5 py-2.5 text-sm leading-relaxed font-sans whitespace-pre-wrap
          ${isAI
            ? 'border border-[#1c1c1c] bg-[#0a0a0a] text-neutral-300'
            : 'border border-cyan-300/20 bg-cyan-300/10 text-neutral-200'}
        `}>
          {isAI ? (
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
          ) : (
            message.content
          )}
        </div>

        {isAI && message.sources && message.sources.length > 0 && (
          <div className="mt-1">
            <button
              onClick={() => setShowSources(v => !v)}
              className="flex items-center gap-1 text-xs text-cyan-300/70 transition-colors hover:text-cyan-300"
            >
              {showSources ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {message.sources.length} source{message.sources.length > 1 ? 's' : ''}
            </button>
            {showSources && (
              <div className="mt-1 flex flex-wrap gap-1">
                {message.sources.map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex max-w-full items-center gap-1 rounded-md border border-[#222] bg-[#111] px-2 py-0.5 font-mono text-xs text-neutral-500"
                    title={s.source || 'Source'}
                  >
                    <FileText size={11} className="text-cyan-400" />
                    <span className="truncate">{s.source?.split(/[\\/]/).pop() || 'doc'}</span>
                    {scoreLabel(s.score) && (
                      <span className="ml-1 text-cyan-300">{scoreLabel(s.score)}</span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <span className="px-1 text-[10px] text-neutral-700">
          {message.time}
        </span>
      </div>
    </div>
  );
}
