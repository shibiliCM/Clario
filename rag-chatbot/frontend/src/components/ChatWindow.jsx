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
    <div className="mb-5 flex max-w-[800px] gap-3.5">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/60 to-slate-900/90 text-cyan-400 shadow-sm shadow-cyan-950/50">
        <Bot size={16} />
      </div>
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-3.5 backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:0ms]" />
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:180ms]" />
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:360ms]" />
          <span className="ml-2 font-mono text-xs text-slate-400">Searching documents & thinking...</span>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onSuggestion }) {
  return (
    <div className="flex flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-6 py-8 text-center">
        {/* Hero badge */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/80 to-slate-900 text-cyan-300 shadow-lg shadow-cyan-950/40">
            <Sparkles size={28} className="text-cyan-400" />
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-slate-950">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            </span>
          </div>

          <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Meet <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">Clario</span>
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-slate-400">
            Your high-precision document knowledge engine. Upload PDF, Word, CSV, or web articles to analyze and synthesize grounded answers with direct citations.
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 text-left">
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3.5 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-cyan-400">
              <Brain size={16} />
              <span className="font-display text-xs font-semibold uppercase tracking-wider">Hybrid Retrieval</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              Combines lexical token overlap with dense semantic embeddings in ChromaDB for maximum relevance.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3.5 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-indigo-400">
              <ShieldCheck size={16} />
              <span className="font-display text-xs font-semibold uppercase tracking-wider">Strict Grounding</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              Never hallucinates. Answers strictly from retrieved document passages and links to source documents.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3.5 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-emerald-400">
              <Zap size={16} />
              <span className="font-display text-xs font-semibold uppercase tracking-wider">Live Streaming</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              Real-time Server-Sent Events (SSE) stream answers token-by-token directly from Gemini 2.5 Flash.
            </p>
          </div>
        </div>

        {/* Prompt Suggestions */}
        <div className="w-full text-left">
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Suggested Prompts
          </p>
          <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
            {SUGGESTIONS.map(({ icon: Icon, title, text }) => (
              <button
                key={title}
                onClick={() => onSuggestion?.(text)}
                className="group flex flex-col gap-1 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3.5 text-left transition-all hover:border-cyan-500/40 hover:bg-slate-800/60 hover:shadow-md hover:shadow-cyan-950/20"
                type="button"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 group-hover:text-cyan-300">
                  <Icon size={14} className="text-slate-400 group-hover:text-cyan-400 transition-colors" />
                  <span>{title}</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-400 line-clamp-2">
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

export default function ChatWindow({ messages, loading, streamingMessageId, onSuggestion }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (messages.length === 0 && !loading) {
    return <EmptyState onSuggestion={onSuggestion} />;
  }

  return (
    <div className="flex-1 space-y-1 overflow-y-auto px-6 pb-4 pt-6">
      {messages.map(msg => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isStreaming={msg.id === streamingMessageId}
        />
      ))}
      {loading && !streamingMessageId && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
