import { useEffect, useState, useRef } from 'react';
import {
  Link,
  CheckCircle,
  AlertCircle,
  Loader,
  X,
  Files,
  Sparkles,
  Trash2,
  Database,
} from 'lucide-react';
import { deleteDocument, ingestFiles, ingestURL, listDocuments } from '../services/api';

const MAX_FILE_NAMES = 3;

function formatFileList(files) {
  const names = files.slice(0, MAX_FILE_NAMES).map(file => file.name).join(', ');
  const extra = files.length > MAX_FILE_NAMES ? ` +${files.length - MAX_FILE_NAMES} more` : '';
  return `${names}${extra}`;
}

function normalizeURL(value) {
  try {
    const parsed = new URL(value.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
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
  const [dragging, setDragging]   = useState(false);
  const [urlInput, setUrlInput]   = useState('');
  const [showURL, setShowURL]     = useState(false);
  const [status, setStatus]       = useState(null);
  const [message, setMessage]     = useState('');
  const [progress, setProgress]   = useState(0);
  const [activeFiles, setActiveFiles] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [deletingSource, setDeletingSource] = useState('');
  const fileRef = useRef();
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
    setProgress(4);
    setActiveFiles(files);
    setMessage(
      files.length === 1
        ? `Reading ${files[0].name}...`
        : `Preparing ${files.length} files for the knowledge base...`
    );

    try {
      const res = await ingestFiles(files, event => {
        if (!event.total) return;
        const percent = Math.round((event.loaded * 100) / event.total);
        setProgress(Math.max(6, Math.min(percent, 96)));
      });

      setProgress(100);
      setStatus('success');
      setMessage(`${res.data.chunks_stored} chunks indexed from ${res.data.files_processed || files.length} file(s).`);
      onSuccess?.();
      setTimeout(() => {
        setStatus(null);
        setProgress(0);
        setActiveFiles([]);
      }, 4500);
    } catch (e) {
      setStatus('error');
      setMessage(e.response?.data?.detail || 'Upload failed');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleURL = async () => {
    if (busy) return;
    const url = normalizeURL(urlInput);
    if (!url) {
      setStatus('error');
      setProgress(0);
      setActiveFiles([]);
      setMessage('Enter a valid http or https URL.');
      return;
    }

    setStatus('loading');
    setProgress(35);
    setActiveFiles([]);
    setMessage(`Fetching and sorting the useful bits from ${url}...`);
    try {
      const res = await ingestURL(url);
      setProgress(100);
      setStatus('success');
      setMessage(`${res.data.chunks_stored} chunks indexed from the URL.`);
      setUrlInput('');
      setShowURL(false);
      onSuccess?.();
      setTimeout(() => {
        setStatus(null);
        setProgress(0);
      }, 4500);
    } catch (e) {
      setStatus('error');
      setMessage(e.response?.data?.detail || 'URL ingestion failed');
    }
  };

  const handleDelete = async (doc) => {
    if (busy || deletingSource) return;
    const label = displaySource(doc.source);
    const confirmed = window.confirm(`Delete "${label}" from the knowledge base?`);
    if (!confirmed) return;

    setDeletingSource(doc.source);
    try {
      const res = await deleteDocument(doc.source);
      setStatus('success');
      setMessage(`${res.data.chunks_deleted} chunks deleted from ${label}.`);
      setProgress(0);
      setActiveFiles([]);
      await loadDocuments();
      onSuccess?.();
      setTimeout(() => setStatus(null), 3500);
    } catch (e) {
      setStatus('error');
      setMessage(e.response?.data?.detail || 'Document deletion failed');
    } finally {
      setDeletingSource('');
    }
  };

  return (
    <div className="px-[18px] py-4">
      <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[1.2px] text-neutral-600">
        Knowledge base
      </p>

      <div
        onDragOver={e => { e.preventDefault(); if (!busy) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          if (busy) return;
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !busy && fileRef.current?.click()}
        className={`
          relative overflow-hidden rounded-xl border border-dashed p-5 text-center cursor-pointer
          transition-all duration-200 select-none
          ${dragging
            ? 'border-cyan-300 bg-cyan-300/10'
            : 'border-[#333] bg-[#080808] hover:border-cyan-300 hover:bg-[#0a0a0a]'}
        `}
      >
        <div className="mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-[10px] border border-[#222] bg-[#111]">
          <Files size={22} className="text-neutral-500" />
        </div>
        <p className="mb-1 text-[13px] text-neutral-400">
          Drop files or <span className="text-cyan-300">click to browse</span>
        </p>
        <p className="text-[10px] text-neutral-600">PDF, DOCX, TXT, MD, CSV</p>
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

      <button
        onClick={() => setShowURL(v => !v)}
        disabled={busy}
        className="mt-2 flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-neutral-400 transition-colors hover:bg-[#0f0f0f] hover:text-cyan-300 disabled:opacity-50 disabled:hover:text-neutral-400"
      >
        <Link size={15} className="text-neutral-600" />
        Add a web page
      </button>

      {showURL && (
        <div className="mt-2 flex gap-2">
          <input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleURL()}
            placeholder="https://example.com"
            className="min-w-0 flex-1 rounded-lg border border-[#222] bg-[#080808] px-3 py-2 text-xs text-neutral-300 placeholder-neutral-700 outline-none transition-colors focus:border-cyan-300/50"
          />
          <button
            onClick={handleURL}
            disabled={busy || !urlInput.trim()}
            className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-black transition-colors hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add
          </button>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-[#1c1c1c] bg-[#080808]">
        <div className="flex items-center justify-between gap-2 border-b border-[#1c1c1c] px-3 py-2">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[1.2px] text-neutral-600">
            <Database size={12} className="text-cyan-300" />
            Added documents
          </div>
          {docsLoading && <Loader size={12} className="animate-spin text-neutral-500" />}
        </div>

        {documents.length === 0 && !docsLoading ? (
          <p className="px-3 py-3 text-xs text-neutral-600">
            No documents indexed yet.
          </p>
        ) : (
          <div className="max-h-44 overflow-y-auto p-2">
            {documents.map(doc => (
              <div
                key={doc.source}
                className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#0f0f0f]"
                title={doc.source}
              >
                <Files size={13} className="flex-shrink-0 text-neutral-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-neutral-400">{displaySource(doc.source)}</p>
                  <p className="text-[10px] text-neutral-600">
                    {doc.chunks} chunk{doc.chunks === 1 ? '' : 's'}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(doc)}
                  disabled={busy || Boolean(deletingSource)}
                  className="rounded-md p-1 text-neutral-700 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40 group-hover:opacity-100"
                  aria-label={`Delete ${displaySource(doc.source)}`}
                >
                  {deletingSource === doc.source
                    ? <Loader size={12} className="animate-spin" />
                    : <Trash2 size={12} />
                  }
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {status && (
        <div className={`
          mt-3 rounded-lg border px-3 py-2 text-xs
          ${status === 'loading' ? 'border-[#222] bg-[#0d0d0d] text-neutral-300' : ''}
          ${status === 'success' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : ''}
          ${status === 'error'   ? 'border-red-500/20 bg-red-500/10 text-red-300' : ''}
        `}>
          <div className="flex items-center gap-2">
            {status === 'loading' && <Loader size={12} className="animate-spin text-cyan-300" />}
            {status === 'success' && <CheckCircle size={12} />}
            {status === 'error' && <AlertCircle size={12} />}
            <span className="flex-1">{message}</span>
            <button onClick={() => setStatus(null)} aria-label="Dismiss upload status">
              <X size={10} />
            </button>
          </div>

          {status === 'loading' && (
            <div className="mt-3">
              {activeFiles.length > 0 && (
                <div className="mb-2 flex items-center gap-1.5 text-[10px] text-neutral-500">
                  <Sparkles size={11} className="text-cyan-300" />
                  <span className="truncate">{formatFileList(activeFiles)}</span>
                </div>
              )}
              <div className="h-2 overflow-hidden rounded-full bg-[#151515]">
                <div
                  className="upload-flow h-full rounded-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-neutral-600">
                <span>Indexing</span>
                <span>{progress}%</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
