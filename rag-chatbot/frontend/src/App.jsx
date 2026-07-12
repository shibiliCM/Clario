import { useState, useCallback, useEffect } from 'react';
import ChatWindow from './components/ChatWindow';
import InputBar from './components/InputBar';
import UploadPanel from './components/UploadPanel';
import StatusBar from './components/StatusBar';
import { sendChat } from './services/api';
import {
  Bot,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  History,
  Plus,
  MessageSquare,
  Settings,
} from 'lucide-react';

const HISTORY_KEY = 'clario-history';

function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
  return firstUser.length > 42 ? `${firstUser.slice(0, 42)}...` : firstUser;
}

export default function App() {
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [refreshKey,  setRefreshKey]  = useState(0);
  const [history,     setHistory]     = useState(loadHistory);
  const [activeId,    setActiveId]    = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Chat still works if private browsing or quota limits block history storage.
    }
  }, [history]);

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
      return [nextItem, ...rest].slice(0, 20);
    });
  }, [messages, activeId]);

  const handleSend = useCallback(async (questionOverride) => {
    const q = (typeof questionOverride === 'string' ? questionOverride : input).trim();
    if (!q || loading) return;
    setInput('');

    const userMsg = { id: makeId(), role: 'user', content: q, time: now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const historyPayload = messages.slice(-6).map(m => ({
        role: m.role,
        content: m.content,
      }));
      const res = await sendChat(q, historyPayload);
      const { answer, sources } = res.data;
      setMessages(prev => [...prev, {
        id: makeId(),
        role: 'assistant',
        content: answer,
        sources,
        time: now(),
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: makeId(),
        role: 'assistant',
        content: `Upload or chat error: ${err.response?.data?.detail || err.message}`,
        sources: [],
        time: now(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const startNewChat = () => {
    setActiveId(null);
    setMessages([]);
    setInput('');
  };

  const openHistory = (item) => {
    setActiveId(item.id);
    setMessages(item.messages);
    setInput('');
  };

  const deleteHistory = (id) => {
    setHistory(prev => prev.filter(item => item.id !== id));
    if (activeId === id) startNewChat();
  };

  const clearChat = () => {
    if (activeId) {
      setHistory(prev => prev.filter(item => item.id !== activeId));
    }
    startNewChat();
  };

  const handleUploadSuccess = () => setRefreshKey(k => k + 1);

  return (
    <div className="flex h-screen overflow-hidden bg-black font-sans text-neutral-100">
      <aside className={`
        flex flex-col border-r border-[#1c1c1c] bg-[#050505]
        transition-all duration-300 ease-in-out overflow-hidden
        ${sidebarOpen ? 'w-[280px]' : 'w-0'}
      `}>
        <div className="border-b border-[#1c1c1c] px-[18px] pb-4 pt-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] border border-[#2a2a2a] bg-[#111]">
              <Bot size={18} className="text-cyan-300" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-neutral-100">Clario</p>
              <p className="mt-px text-[11px] text-neutral-500">Your document workspace</p>
            </div>
          </div>

          <StatusBar refreshKey={refreshKey} />

          <button
            onClick={startNewChat}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-[10px] bg-cyan-300 px-4 py-2.5 text-sm font-bold text-black transition-all hover:-translate-y-px hover:bg-cyan-200 active:translate-y-0"
          >
            <Plus size={16} />
            New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <UploadPanel onSuccess={handleUploadSuccess} refreshKey={refreshKey} />

          <div className="border-t border-[#1c1c1c] px-[18px] py-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[1.2px] text-neutral-600">
              <History size={12} />
              History
            </div>
            {history.length === 0 ? (
              <p className="text-[11px] leading-relaxed text-neutral-500">
                Conversations you start will appear here for quick review.
              </p>
            ) : (
              <div className="space-y-0.5">
                {history.map(item => (
                  <div
                    key={item.id}
                    className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors
                      ${item.id === activeId
                        ? 'bg-cyan-300/10 text-cyan-200'
                        : 'hover:bg-[#0f0f0f]'}`}
                  >
                    <button
                      onClick={() => openHistory(item)}
                      className="min-w-0 flex-1 flex items-center gap-2 text-left"
                    >
                      <MessageSquare size={14} className="flex-shrink-0 text-neutral-600" />
                      <span className="truncate text-xs text-neutral-400">{item.title}</span>
                    </button>
                    <button
                      onClick={() => deleteHistory(item.id)}
                      className="rounded-md p-1 text-neutral-700 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
                      aria-label="Delete conversation"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {messages.length > 0 && (
          <div className="border-t border-[#1c1c1c] p-4">
            <button
              onClick={clearChat}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#222] bg-[#0a0a0a] px-3 py-2 text-xs text-neutral-500 transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 size={12} />
              Clear current chat
            </button>
          </div>
        )}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-black">
        <header className="flex items-center justify-between border-b border-[#1c1c1c] px-6 py-4">
          <p className="font-display text-lg font-medium text-neutral-200">
            Ask your documents
          </p>
          <div className="flex items-center gap-2">
            <button
              className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-[#222] bg-[#0a0a0a] text-neutral-500 transition-all hover:border-cyan-300/60 hover:bg-[#111] hover:text-cyan-300"
              aria-label="Settings"
              type="button"
            >
              <Settings size={16} />
            </button>
          <button
            onClick={() => setSidebarOpen(v => !v)}
              className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-[#222] bg-[#0a0a0a] text-neutral-500 transition-all hover:border-cyan-300/60 hover:bg-[#111] hover:text-cyan-300"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen
              ? <PanelLeftClose size={16} />
              : <PanelLeftOpen size={16} />
            }
          </button>
          {messages.length > 0 && (
              <span className="ml-1 rounded bg-[#111] px-2 py-1 text-[10px] font-medium text-neutral-500">
              {messages.length} messages
            </span>
          )}
          </div>
        </header>

        <ChatWindow messages={messages} loading={loading} onSuggestion={handleSend} />

        <InputBar
          value={input}
          onChange={setInput}
          onSend={handleSend}
          loading={loading}
        />
      </main>
    </div>
  );
}
