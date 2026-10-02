import { useEffect, useState, useRef } from 'react';
import {
  Link,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  Files,
  Sparkles,
  Trash2,
  Database,
  Search,
  Globe,
  FileCode,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { deleteDocument, ingestFiles, ingestURL, listDocuments } from '../services/api';

function formatFileType(source) {
  const s = source?.toLowerCase() || '';
  if (s.startsWith('http://') || s.startsWith('https://')) {
    return { label: 'URL', color: 'bg-purple-950/60 text-purple-300 border-purple-800/40', icon: Globe };
  }
  if (s.endsWith('.pdf')) {
    return { label: 'PDF', color: 'bg-rose-950/60 text-rose-300 border-rose-800/40', icon: FileText };
  }
  if (s.endsWith('.docx') || s.endsWith('.doc')) {
    return { label: 'DOC', color: 'bg-blue-950/60 text-blue-300 border-blue-800/40', icon: FileText };
  }
  if (s.endsWith('.csv')) {
    return { label: 'CSV', color: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40', icon: FileSpreadsheet };
  }
  return { label: 'TXT', color: 'bg-amber-950/60 text-amber-300 border-amber-800/40', icon: FileCode };
}

function displaySource(source) {
  try {
    const url = new URL(source);
    return `${url.hostname}${url.pathname === '/' ? '' : url.pathname}`;
  } catch {
    return source?.split(/[\\/]/).pop() || 'Document';
  }
}

export default function UploadPanel({ onSuccess, refreshKey }) {
  const [dragging, setDragging] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showURL, setShowURL] = useState(false);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [documents, setDocuments] = useState([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [docsLoading, setDocsLoading] = useState(false);
  const [deletingSource, setDeletingSource] = useState('');
  const fileRef = useRef(null);
  const busy = status === 'loading';

  const loadDocuments = async () => {
    setDocsLoading(true);
    try {
      const res = await listDocuments();
      setDocuments(res.data.documents || []);
    } catch {
      setDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [refreshKey]);

  const handleFiles = async (fileList) => {
    if (busy) return;
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    setStatus('loading');
    setProgress(15);
    setMessage(
      files.length === 1
        ? `Reading ${files[0].name}...`
        : `Uploading ${files.length} files...`
    );

    try {
      const res = await ingestFiles(files, event => {
        if (!event.total) return;
        const percent = Math.round((event.loaded * 100) / event.total);
        setProgress(Math.max(15, Math.min(percent, 92)));
      });

      setProgress(100);
      setStatus('success');
      setMessage(`Successfully indexed ${res.data.chunks_stored} chunk(s) into ChromaDB.`);
      await loadDocuments();
      onSuccess?.();
      setTimeout(() => {
        setStatus(null);
        setProgress(0);
      }, 4000);
    } catch (e) {
      setStatus('error');
      setMessage(e.response?.data?.detail || e.message || 'Upload failed');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleURL = async () => {
    if (busy || !urlInput.trim()) return;

    setStatus('loading');
    setProgress(30);
    setMessage(`Fetching and extracting readable content from URL...`);
    try {
      const res = await ingestURL(urlInput.trim());
      setProgress(100);
      setStatus('success');
      setMessage(`Indexed ${res.data.chunks_stored} chunk(s) from article.`);
      setUrlInput('');
      setShowURL(false);
      await loadDocuments();
      onSuccess?.();
      setTimeout(() => {
        setStatus(null);
        setProgress(0);
      }, 4000);
    } catch (e) {
      setStatus('error');
      setMessage(e.response?.data?.detail || e.message || 'URL scraping failed');
    }
  };

  const handleDelete = async (doc) => {
    if (busy || deletingSource) return;
    const label = displaySource(doc.source);
    const confirmed = window.confirm(`Remove "${label}" and all its vector embeddings from ChromaDB?`);
    if (!confirmed) return;

    setDeletingSource(doc.source);
    try {
      const res = await deleteDocument(doc.source);
      setStatus('success');
      setMessage(`Deleted ${res.data.chunks_deleted} chunks from knowledge base.`);
      await loadDocuments();
      onSuccess?.();
      setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      setStatus('error');
      setMessage(e.response?.data?.detail || 'Document deletion failed');
    } finally {
      setDeletingSource('');
    }
  };

  const filteredDocs = documents.filter(doc =>
    doc.source.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const totalChunks = documents.reduce((acc, d) => acc + (d.chunks || 0), 0);

  return (
    <div className="flex h-full flex-col px-4 py-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-xs font-semibold uppercase tracking-wider text-slate-400">
          Knowledge Base
        </span>
        <span className="rounded-full border border-slate-800 bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-cyan-400">
          {documents.length} doc{documents.length !== 1 ? 's' : ''} ({totalChunks} chunks)
        </span>
      </div>

      {/* Drag & Drop Box */}
      <div
        onDragOver={e => { e.preventDefault(); if (!busy) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          if (!busy) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !busy && fileRef.current?.click()}
        className={`
          group relative flex flex-col items-center justify-center rounded-xl border border-dashed p-3.5 sm:p-4 text-center cursor-pointer
          transition-all duration-200 select-none touch-manipulation active:scale-[0.99]
          ${dragging
            ? 'border-cyan-400 bg-cyan-950/30'
            : 'border-slate-800 bg-slate-900/40 hover:border-cyan-500/50 hover:bg-slate-900/80'}
        `}
      >
        <div className="mb-2 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 group-hover:border-cyan-500/30 group-hover:text-cyan-400 transition-colors">
          <Files size={17} />
        </div>
        <p className="text-xs font-medium text-slate-300">
          <span className="text-cyan-400 font-semibold underline underline-offset-2">Upload files</span> or drop here
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-slate-500">PDF, DOCX, CSV, TXT, MD</p>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.txt,.csv,.md"
          multiple
          disabled={busy}
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {/* URL Ingestion Trigger */}
      <div className="mt-2.5">
        <button
          onClick={() => setShowURL(v => !v)}
          disabled={busy}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-800/60 hover:text-cyan-300 disabled:opacity-50 touch-manipulation"
          type="button"
        >
          <Globe size={13} className="text-cyan-400" />
          <span>Ingest Web Page or Article</span>
        </button>

        {showURL && (
          <div className="mt-2 flex gap-1.5">
            <input
              type="url"
              placeholder="https://example.com/article"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleURL()}
              disabled={busy}
              className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-sm sm:text-xs text-slate-200 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
            />
            <button
              onClick={handleURL}
              disabled={busy || !urlInput.trim()}
              className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:opacity-50 min-h-[34px]"
              type="button"
            >
              Add
            </button>
          </div>
        )}
      </div>

      {/* Progress / Status banner */}
      {status && (
        <div className={`mt-3 rounded-lg border p-2.5 text-xs ${
          status === 'loading' ? 'border-cyan-800/40 bg-cyan-950/30 text-cyan-200' :
          status === 'success' ? 'border-emerald-800/40 bg-emerald-950/30 text-emerald-200' :
          'border-rose-800/40 bg-rose-950/30 text-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {status === 'loading' && <Loader2 size={13} className="animate-spin text-cyan-400" />}
            {status === 'success' && <CheckCircle size={13} className="text-emerald-400" />}
            {status === 'error' && <AlertCircle size={13} className="text-rose-400" />}
            <span className="truncate font-medium">{message}</span>
          </div>
          {status === 'loading' && progress > 0 && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Document Library Filter & List */}
      <div className="mt-4 flex flex-1 flex-col overflow-hidden">
        {documents.length > 4 && (
          <div className="relative mb-2">
            <Search size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Filter documents..."
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 py-1.5 pl-7 pr-2 text-xs text-slate-300 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        )}

        <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
          {docsLoading && documents.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              <Loader2 size={16} className="mx-auto mb-1 animate-spin text-slate-400" />
              Loading library...
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              {documents.length === 0
                ? 'No documents indexed yet.'
                : 'No matching documents found.'}
            </div>
          ) : (
            filteredDocs.map(doc => {
              const meta = formatFileType(doc.source);
              const Icon = meta.icon;
              return (
                <div
                  key={doc.source}
                  className="group flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/30 px-2.5 py-2 transition-colors hover:border-slate-700 hover:bg-slate-900/80"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border text-[10px] font-bold ${meta.color}`}>
                      {meta.label}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-300" title={doc.source}>
                        {displaySource(doc.source)}
                      </p>
                      <p className="font-mono text-[10px] text-slate-500">
                        {doc.chunks} chunk{doc.chunks !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={deletingSource === doc.source}
                    className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 rounded p-1.5 text-slate-400 transition-all hover:bg-rose-950/40 hover:text-rose-400 hover:opacity-100"
                    title="Delete from knowledge base"
                    type="button"
                  >
                    {deletingSource === doc.source ? (
                      <Loader2 size={13} className="animate-spin text-rose-400" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
