import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import {
  AlertCircle,
  Bot,
  Brain,
  Database,
  FileSearch,
  FileText,
  GitCompare,
  Layers,
  ListFilter,
  ShieldCheck,
  Sparkles,
  Zap,
  UploadCloud,
} from 'lucide-react';

const SUGGESTIONS = [
  {
    icon: FileText,
    title: 'Executive Summary',
    text: 'Summarize the primary takeaways and conclusions from the uploaded documents.',
  },
  {
    icon: AlertCircle,
    title: 'Risks & Key Dates',
    text: 'What are the critical risks, deadlines, and action items mentioned?',
  },
  {
    icon: GitCompare,
    title: 'Cross-Document Comparison',
    text: 'Compare and contrast the main perspectives across my uploaded files.',
  },
  {
    icon: Layers,
    title: 'Deep Dive Explanation',
    text: 'Explain the core methodology or architecture described in the documents step by step.',
  },
];

function TypingIndicator() {
  return (
    <div className="mb-4 sm:mb-5 flex max-w-[800px] gap-2.5 sm:gap-3.5">
      <div className="flex h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/60 to-slate-900/90 text-cyan-400 shadow-sm shadow-cyan-950/50 mt-0.5">
        <Bot size={15} />
      </div>
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 px-3.5 py-2.5 sm:px-4 sm:py-3 backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:0ms]" />
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:180ms]" />
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:360ms]" />
          <span className="ml-2 font-mono text-[11px] sm:text-xs text-slate-400">Searching documents & thinking...</span>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onSuggestion, onOpenUpload }) {
  return (
    <div className="flex flex-1 overflow-y-auto touch-scroll">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4 sm:gap-6 px-4 sm:px-6 py-5 sm:py-8 text-center">
        {/* Hero badge */}
        <div className="flex flex-col items-center gap-2.5 sm:gap-3">
          <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/80 to-slate-900 text-cyan-300 shadow-lg shadow-cyan-950/40">
            <Sparkles size={24} className="text-cyan-400 sm:w-7 sm:h-7" />
            <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-slate-950">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            </span>
          </div>

          <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-4xl">
            Meet <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">Clario</span>
          </h2>
          <p className="max-w-xl text-xs sm:text-sm leading-relaxed text-slate-400">
            Your high-precision document knowledge engine. Upload PDF, Word, CSV, or web articles to analyze and synthesize grounded answers with direct citations.
          </p>

          {onOpenUpload && (
            <button
              onClick={onOpenUpload}
              className="mt-1 flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 px-4 py-2 text-xs font-bold text-slate-950 shadow-md shadow-cyan-950/40 transition-all hover:scale-[1.02] hover:from-cyan-300 hover:to-sky-300 active:scale-[0.98]"
              type="button"
            >
              <UploadCloud size={15} />
              <span>Upload Documents to Knowledge Base</span>
            </button>
          )}
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3 text-left">
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 sm:p-3.5 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-cyan-400">
              <Brain size={15} />
              <span className="font-display text-xs font-semibold uppercase tracking-wider">Hybrid Retrieval</span>
            </div>
            <p className="mt-1 text-[11px] sm:text-xs leading-relaxed text-slate-400">
              Combines lexical token overlap with dense semantic embeddings in ChromaDB for maximum relevance.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 sm:p-3.5 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-indigo-400">
              <ShieldCheck size={15} />
              <span className="font-display text-xs font-semibold uppercase tracking-wider">Strict Grounding</span>
            </div>
            <p className="mt-1 text-[11px] sm:text-xs leading-relaxed text-slate-400">
              Never hallucinates. Answers strictly from retrieved document passages and links to source documents.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 sm:p-3.5 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-emerald-400">
              <Zap size={15} />
              <span className="font-display text-xs font-semibold uppercase tracking-wider">Live Streaming</span>
            </div>
            <p className="mt-1 text-[11px] sm:text-xs leading-relaxed text-slate-400">
              Real-time Server-Sent Events (SSE) stream answers token-by-token directly from Gemini 2.5 Flash.
            </p>
          </div>
        </div>

        {/* Prompt Suggestions */}
        <div className="w-full text-left">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Suggested Prompts
          </p>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5">
            {SUGGESTIONS.map(({ icon: Icon, title, text }) => (
              <button
                key={title}
                onClick={() => onSuggestion?.(text)}
                className="group flex flex-col gap-1 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 sm:p-3.5 text-left transition-all hover:border-cyan-500/40 hover:bg-slate-800/60 hover:shadow-md hover:shadow-cyan-950/20 active:scale-[0.99] touch-manipulation"
                type="button"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 group-hover:text-cyan-300">
                  <Icon size={14} className="text-slate-400 group-hover:text-cyan-400 transition-colors" />
                  <span>{title}</span>
                </div>
                <p className="text-[11px] sm:text-xs leading-relaxed text-slate-400 line-clamp-2">
                  {text}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatWindow({
  messages,
  loading,
  streamingMessageId,
  onSuggestion,
  onOpenUpload,
}) {
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, loading]);

  if (messages.length === 0 && !loading) {
    return <EmptyState onSuggestion={onSuggestion} onOpenUpload={onOpenUpload} />;
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 space-y-1 overflow-y-auto px-3 sm:px-6 pb-3 pt-3 sm:pb-4 sm:pt-6 touch-scroll overscroll-contain"
    >
      {messages.map(msg => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isStreaming={msg.id === streamingMessageId}
          onOpenUpload={onOpenUpload}
        />
      ))}
      {loading && !streamingMessageId && <TypingIndicator />}
    </div>
  );
}
