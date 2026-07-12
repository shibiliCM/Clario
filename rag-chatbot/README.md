# Clario

Clario is a local document assistant that lets users upload files, build a searchable knowledge base, and ask questions against their own sources.

## What It Does

- Accepts PDF, DOCX, TXT, MD, and CSV files
- Supports multiple file uploads in one batch
- Stores searchable document chunks in a local ChromaDB database
- Answers questions using retrieved document context
- Keeps a browser-side chat history for recent conversations
- Can ingest readable content from a web page URL

## Setup

### 1. Add Your API Key

Open `backend/.env` and set your provider key:

```env
GEMINI_API_KEY=your_key_here
```

### 2. Start Backend

From the project root:

```powershell
.\start_backend.ps1
```

The API runs at `http://localhost:8000`.

### 3. Start Frontend

Open a second PowerShell window from the project root:

```powershell
.\start_frontend.ps1
```

Then open `http://localhost:5173`.

## Project Structure

```text
clario/
  backend/
    .env
    requirements.txt
    rag_chatbot.py
    gemini_utils.py
  frontend/
    src/
      App.jsx
      components/
      services/api.js
    package.json
  start_backend.ps1
  start_frontend.ps1
```

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health` | Server and knowledge base status |
| POST | `/api/ingest` | Upload one or more documents |
| POST | `/api/ingest-url` | Ingest a web page |
| POST | `/api/chat` | Ask a question |
