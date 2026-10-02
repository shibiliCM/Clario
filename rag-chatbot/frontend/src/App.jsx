import { useState, useCallback, useEffect, useRef } from 'react';
import ChatWindow from './components/ChatWindow';
import InputBar from './components/InputBar';
import UploadPanel from './components/UploadPanel';
import StatusBar from './components/StatusBar';
import SettingsModal from './components/SettingsModal';
import { streamChat } from './services/api';
import {
  Bot,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  History,
  Plus,
  MessageSquare,
  Settings,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';

const HISTORY_KEY = 'clario-history-v2';

function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function makeTitle(messages, fallback = 'New conversation') {
  const firstUser = messages.find(m => m.role === 'user')?.content || fallback;
  return firstUser.length > 36 ? `${firstUser.slice(0, 36)}...` : firstUser;
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingId, setStreamingId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return false;
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [history, setHistory] = useState(loadHistory);
  const [activeId, setActiveId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const abortControllerRef = useRef(null);

  const closeOnMobile = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  // Sync conversation history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {}
  }, [history]);

  // Update active conversation in history when messages change
  useEffect(() => {
    if (messages.length === 0) return;

    const id = activeId || makeId();
    if (!activeId) setActiveId(id);

    setHistory(prev => {
      const nextItem = {
        id,
        title: makeTitle(messages),
        updatedAt: Date.now(),
        messages,
      };
      const rest = prev.filter(item => item.id !== id);
      return [nextItem, ...rest].slice(0, 25);
    });
  }, [messages, activeId]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setStreamingId(null);
  };

  const handleSend = useCallback(async (questionOverride) => {
    const q = (typeof questionOverride === 'string' ? questionOverride : input).trim();
    if (!q || loading) return;
    setInput('');

    // Abort any ongoing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const userMsg = { id: makeId(), role: 'user', content: q, time: now() };
    const assistantId = makeId();
    const assistantMsg = {
      id: assistantId,
      role: 'assistant',
      content: '',
      sources: [],
      time: now(),
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setLoading(true);
    setStreamingId(assistantId);

    const historyPayload = messages.slice(-6).map(m => ({
      role: m.role,
      content: m.content,
    }));

    await streamChat(q, historyPayload, {
      signal: abortController.signal,
      onSources: (sources) => {
        setMessages(prev =>
          prev.map(m => (m.id === assistantId ? { ...m, sources } : m))
        );
      },
      onDelta: (textChunk) => {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId ? { ...m, content: (m.content || '') + textChunk } : m
          )
        );
      },
      onDone: () => {
        setLoading(false);
        setStreamingId(null);
        abortControllerRef.current = null;
      },
      onError: (err) => {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    m.content ||
                    `⚠️ Query error: ${err.message || 'Unable to connect to assistant.'}`,
                }
              : m
          )
        );
        setLoading(false);
        setStreamingId(null);
        abortControllerRef.current = null;
      },
    });
  }, [input, loading, messages]);

  const startNewChat = () => {
    handleStop();
    setActiveId(null);
    setMessages([]);
    setInput('');
    closeOnMobile();
  };

  const openHistory = (item) => {
    handleStop();
    setActiveId(item.id);
    setMessages(item.messages);
    setInput('');
    closeOnMobile();
  };

  const deleteHistory = (id, e) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(item => item.id !== id));
    if (activeId === id) startNewChat();
  };

  const clearChat = () => {
    if (activeId) {
      setHistory(prev => prev.filter(item => item.id !== activeId));
    }
    startNewChat();
    closeOnMobile();
  };

  const handleUploadSuccess = () => setRefreshKey(k => k + 1);

  return (
    <div className="flex h-screen h-dvh overflow-hidden bg-[#060911] font-sans text-slate-100">
      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onRefresh={() => setRefreshKey(k => k + 1)}
      />

      {/* Mobile Backdrop for Drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs transition-opacity md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Collapsible Responsive Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-800/80 bg-slate-950/95 backdrop-blur-xl
        transition-all duration-300 ease-in-out overflow-hidden
        ${sidebarOpen ? 'w-[85vw] max-w-[320px] translate-x-0 shadow-2xl shadow-black/80' : 'w-[85vw] max-w-[320px] -translate-x-full pointer-events-none'}
        md:pointer-events-auto md:static md:translate-x-0 md:shadow-none md:bg-slate-950/80 md:backdrop-blur-md
        ${sidebarOpen ? 'md:w-[300px]' : 'md:w-0 md:border-r-0'}
      `}>
        {/* Sidebar Header */}
        <div className="border-b border-slate-800/80 px-4 pb-4 pt-4 sm:pt-5 safe-pt">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/70 to-slate-900 text-cyan-400 shadow-sm shadow-cyan-950/50">
                <Bot size={18} />
              </div>
              <div>
                <p className="font-display text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                  Clario
                  <span className="rounded-full bg-cyan-950 border border-cyan-800/40 px-1.5 py-0.2 font-mono text-[9px] text-cyan-300 font-normal">
                    v2.1
                  </span>
                </p>
                <p className="text-[11px] text-slate-400">Grounded Document RAG</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setSettingsOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-white"
                title="Settings & Credentials"
                type="button"
              >
                <Settings size={15} />
              </button>

              <button
                onClick={() => setSidebarOpen(false)}
                className="flex md:hidden h-8 w-8 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-white"
                title="Close drawer"
                type="button"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <StatusBar refreshKey={refreshKey} onOpenSettings={() => setSettingsOpen(true)} />

          <button
            onClick={startNewChat}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-md shadow-cyan-950/30 transition-all hover:scale-[1.01] hover:from-cyan-300 hover:to-sky-300 active:scale-[0.99]"
            type="button"
          >
            <Plus size={15} />
            <span>New Conversation</span>
          </button>
        </div>

        {/* Ingestion & Document Library */}
        <div className="flex-1 overflow-y-auto touch-scroll">
          <UploadPanel onSuccess={handleUploadSuccess} refreshKey={refreshKey} />

          {/* Chat History Section */}
          <div className="border-t border-slate-800/80 px-4 py-3">
            <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <span className="flex items-center gap-1.5">
                <History size={12} />
                Recent Chats
              </span>
              {history.length > 0 && (
                <span className="font-mono text-slate-400">{history.length}</span>
              )}
            </div>

            {history.length === 0 ? (
              <p className="text-[11px] leading-relaxed text-slate-400">
                Past conversations will appear here for reference.
              </p>
            ) : (
              <div className="space-y-1">
                {history.map(item => (
                  <div
                    key={item.id}
                    onClick={() => openHistory(item)}
                    className={`group flex items-center justify-between rounded-lg px-2.5 py-2 cursor-pointer transition-all ${
                      item.id === activeId
                        ? 'border border-cyan-800/50 bg-cyan-950/40 text-cyan-200'
                        : 'border border-transparent text-slate-300 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <MessageSquare size={13} className={item.id === activeId ? 'text-cyan-400' : 'text-slate-400'} />
                      <span className="truncate text-xs font-medium">{item.title}</span>
                    </div>

                    <button
                      onClick={(e) => deleteHistory(item.id, e)}
                      className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 rounded p-1 text-slate-500 hover:text-rose-400 transition-opacity"
                      title="Delete chat"
                      type="button"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Clear Current Chat Footer */}
        {messages.length > 0 && (
          <div className="border-t border-slate-800/80 p-3 safe-pb">
            <button
              onClick={clearChat}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-rose-900/50 hover:bg-rose-950/30 hover:text-rose-300"
              type="button"
            >
              <Trash2 size={12} />
              <span>Clear Current Chat</span>
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex min-w-0 flex-1 flex-col bg-gradient-to-b from-[#080d1a] to-[#04060b]">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b border-slate-800/80 px-3 sm:px-6 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-slate-400 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-white"
              aria-label="Toggle sidebar"
              type="button"
            >
              <span className="md:hidden">
                {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
              </span>
              <span className="hidden md:inline-flex">
                {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
              </span>
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <div className="flex md:hidden h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-gradient-to-br from-cyan-950/70 to-slate-900 text-cyan-400">
                <Bot size={15} />
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-sm font-semibold text-slate-200 truncate">
                  <span className="hidden sm:inline">Grounded Chat & Document Research</span>
                  <span className="sm:hidden font-bold">Clario</span>
                </h1>
                <p className="sm:hidden text-[10px] text-slate-400 truncate">Grounded RAG</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2 sm:px-2.5 py-1 text-xs text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-cyan-300"
              title="Settings & Credentials"
              type="button"
            >
              <Settings size={13} />
              <span className="hidden sm:inline">Settings</span>
            </button>

            {messages.length > 0 && (
              <span className="font-mono text-[10px] sm:text-[11px] text-slate-400 rounded bg-slate-900 border border-slate-800/80 px-1.5 py-0.5">
                {messages.length} msg{messages.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </header>

        {/* Scrollable Conversation */}
        <ChatWindow
          messages={messages}
          loading={loading}
          streamingMessageId={streamingId}
          onSuggestion={handleSend}
        />

        {/* Query Input Bar */}
        <InputBar
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onStop={handleStop}
          loading={loading}
          isStreaming={Boolean(streamingId)}
        />
      </main>
    </div>
  );
}
