import axios from 'axios';

const API_KEY_STORAGE = 'clario-custom-gemini-key';

export function getCustomApiKey() {
  try {
    return localStorage.getItem(API_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

export function setCustomApiKey(key) {
  try {
    if (key?.trim()) {
      localStorage.setItem(API_KEY_STORAGE, key.trim());
    } else {
      localStorage.removeItem(API_KEY_STORAGE);
    }
  } catch {}
}

function getHeaders() {
  const customKey = getCustomApiKey();
  return customKey ? { 'X-Gemini-Key': customKey } : {};
}

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(config => {
  const customKey = getCustomApiKey();
  if (customKey) {
    config.headers['X-Gemini-Key'] = customKey;
  }
  return config;
});

export const checkHealth = () => api.get('/health', { headers: getHeaders() });

export const sendChat = (question, chat_history = []) =>
  api.post('/chat', { question, chat_history }, { headers: getHeaders() });

/**
 * Real-time SSE streaming chat reader using native fetch + ReadableStream.
 */
export async function streamChat(
  question,
  chat_history = [],
  { onSources, onDelta, onDone, onError, signal } = {}
) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...getHeaders(),
    };

    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers,
      body: JSON.stringify({ question, chat_history }),
      signal,
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.detail || `Server error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete trailing fragment

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.slice(6).trim();
        if (!jsonStr) continue;

        try {
          const event = JSON.parse(jsonStr);
          if (event.type === 'sources') {
            onSources?.(event.sources || []);
          } else if (event.type === 'delta') {
            onDelta?.(event.text || '');
          } else if (event.type === 'done') {
            onDone?.();
          }
        } catch {
          // Ignore malformed intermediate chunk
        }
      }
    }

    onDone?.();
  } catch (err) {
    if (err.name !== 'AbortError') {
      onError?.(err);
    }
  }
}

export const ingestFiles = (files, onProgress) => {
  const form = new FormData();
  files.forEach(file => form.append('files', file));
  return api.post('/ingest', form, {
    headers: { 'Content-Type': 'multipart/form-data', ...getHeaders() },
    onUploadProgress: onProgress,
  });
};

export const ingestFile = (file, onProgress) => ingestFiles([file], onProgress);

export const ingestURL = (url) =>
  api.post('/ingest-url', { url }, { headers: getHeaders() });

export const listDocuments = () => api.get('/documents', { headers: getHeaders() });

export const deleteDocument = (source) =>
  api.delete('/documents', { data: { source }, headers: getHeaders() });
