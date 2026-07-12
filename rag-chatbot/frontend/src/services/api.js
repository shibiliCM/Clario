import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const checkHealth = () => api.get('/health');

export const sendChat = (question, chat_history = []) =>
  api.post('/chat', { question, chat_history });

export const ingestFiles = (files, onProgress) => {
  const form = new FormData();
  files.forEach(file => form.append('files', file));
  return api.post('/ingest', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress,
  });
};

export const ingestFile = (file, onProgress) => ingestFiles([file], onProgress);

export const ingestURL = (url) =>
  api.post('/ingest-url', { url });

export const listDocuments = () => api.get('/documents');

export const deleteDocument = (source) =>
  api.delete('/documents', { data: { source } });
