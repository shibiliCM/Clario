import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import {
  AlertTriangle,
  Bot,
  Database,
  ExternalLink,
  FileText,
  GitCompare,
  Play,
  ShieldCheck,
  Table,
  Trash2,
} from 'lucide-react';

const SUGGESTIONS = [
  { icon: FileText, text: 'Summarize this document for a busy reader' },
  { icon: AlertTriangle, text: 'What are the risks, dates, and action items?' },
  { icon: GitCompare, text: 'Compare the key points across my uploaded files' },
  { icon: Table, text: 'Extract all tables and structured data' },
];

function TypingIndicator() {
  return (
    <div className="mb-4 flex max-w-[680px] gap-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-cyan-300/15 bg-cyan-300/5">
        <Bot size={16} className="text-cyan-300" />
      </div>
      <div className="rounded-xl border border-[#1c1c1c] bg-[#0a0a0a] px-4 py-3">
        <div className="flex h-4 items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onSuggestion }) {
  return (
    <div className="flex flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-6 py-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[#222] bg-[#0a0a0a] after:absolute after:-inset-1 after:rounded-[20px] after:border after:border-cyan-300/10 after:content-['']">
            <Bot size={26} className="text-cyan-300" />
          </div>
          <h2 className="mt-1 font-display text-2xl font-semibold text-neutral-100">
            Clario is ready
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-neutral-500">
            Upload documents, manage your indexed knowledge base, and ask questions with source-aware answers.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 overflow-hidden rounded-2xl border border-[#1c1c1c] bg-[#050505] text-left shadow-2xl shadow-black/30 lg:grid-cols-[1.18fr_0.82fr]">
          <div className="relative min-h-[220px] overflow-hidden border-b border-[#1c1c1c] bg-[#080808] p-4 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-2 border-b border-[#1c1c1c] pb-3">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/70" />
            <span className="ml-3 rounded bg-[#111] px-2 py-1 text-[10px] font-medium uppercase tracking-[1.4px] text-neutral-600">
              Demo video
            </span>
          </div>

            <div className="mt-5 grid gap-3">
            <div className="ml-auto max-w-[78%] rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-neutral-200">
              What happens if Gemini is rate-limited?
            </div>
            <div className="max-w-[86%] rounded-xl border border-[#222] bg-[#0d0d0d] px-4 py-4 text-sm leading-relaxed text-neutral-300">
              <p className="font-semibold text-neutral-100">Gamma - Discount Factor</p>
              <ul className="mt-3 space-y-2 text-neutral-400">
                <li><span className="text-cyan-300">Range:</span> 0 to 1</li>
                <li><span className="text-cyan-300">Typical:</span> 0.8 to 0.99</li>
                <li><span className="text-cyan-300">Fallback:</span> formatted source answer</li>
              </ul>
            </div>
          </div>

          <a
            href="/chat_demo.html"
            target="_blank"
            rel="noreferrer"
            className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition-opacity hover:opacity-100"
            aria-label="Open Clario demo"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/50 bg-cyan-300 text-black shadow-xl shadow-cyan-300/10">
              <Play size={26} fill="currentColor" />
            </span>
          </a>
          </div>

          <div className="flex flex-col justify-center p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[1.8px] text-cyan-300">
            Project demo
          </p>
          <h3 className="mt-2 font-display text-xl font-semibold text-neutral-100 sm:text-2xl">
            Watch how Clario handles documents
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">
            The demo shows upload flow, local ChromaDB storage, document deletion, source citations, and structured fallback answers when Gemini quota is exhausted.
          </p>

          <div className="mt-4 grid gap-2.5">
            {[
              { icon: Database, text: 'Stores extracted chunks locally in ChromaDB' },
              { icon: Trash2, text: 'Deletes indexed documents from the sidebar' },
              { icon: ShieldCheck, text: 'Falls back gracefully during Gemini errors' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-neutral-400">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#222] bg-[#0a0a0a] text-cyan-300">
                  <Icon size={15} />
                </span>
                {text}
              </div>
            ))}
          </div>

          <a
            href="/chat_demo.html"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-bold text-black transition-colors hover:bg-cyan-200"
          >
            Open demo
            <ExternalLink size={15} />
          </a>
          </div>
        </div>

        <div className="grid w-full grid-cols-1 gap-2 md:grid-cols-2">
          {SUGGESTIONS.map(({ icon: Icon, text }, index) => (
            <button
              key={text}
              onClick={() => onSuggestion?.(text)}
              className="suggestion-enter flex items-center gap-2.5 rounded-xl border border-[#222] bg-[#080808] px-4 py-3 text-left text-[13px] text-neutral-400 opacity-0 transition-all hover:translate-x-1 hover:border-cyan-300/30 hover:bg-[#0d0d0d] hover:text-cyan-300"
              style={{ animationDelay: `${(index + 1) * 100}ms` }}
              type="button"
            >
              <Icon size={15} className="flex-shrink-0 text-neutral-600 transition-colors" />
              {text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ChatWindow({ messages, loading, onSuggestion }) {
  const bottomRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (messages.length === 0 && !loading) {
    return <EmptyState onSuggestion={onSuggestion} />;
  }

  return (
    <div className="flex-1 space-y-1 overflow-y-auto px-6 pb-2 pt-6">
      {messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {loading && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
