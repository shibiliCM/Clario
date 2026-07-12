"""
Clario backend API.

Provides document ingestion, local vector search, and grounded chat responses.
"""

import csv
import hashlib
import logging
import math
import os
import re
import tempfile
import uuid
from collections import Counter
from typing import Dict, List, Optional
from urllib.parse import urlparse

import aiofiles
import chromadb
import docx
import httpx
import pdfplumber
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pydantic import BaseModel, Field

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

from gemini_utils import (
    GeminiConfigurationError,
    gemini_chat,
    gemini_embed,
    is_gemini_configured,
)

CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", 800))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", 150))
TOP_K_RESULTS = int(os.getenv("TOP_K_RESULTS", 5))
LOCAL_EMBED_DIM = int(os.getenv("LOCAL_EMBED_DIM", 3072))
LLM_MODEL = os.getenv("LLM_MODEL", "gemini-2.5-flash")
VECTOR_STORE_PATH_RAW = os.getenv("VECTOR_STORE_PATH", "./vector_store")
VECTOR_STORE_PATH = (
    VECTOR_STORE_PATH_RAW
    if os.path.isabs(VECTOR_STORE_PATH_RAW)
    else os.path.join(BASE_DIR, VECTOR_STORE_PATH_RAW)
)
COLLECTION_NAME = "documents"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(name)s  |  %(message)s",
)
log = logging.getLogger("clario")

app = FastAPI(
    title="Clario API",
    version="2.0.0",
    description="Document ingestion and grounded chat API",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
router = APIRouter()


class ChatRequest(BaseModel):
    question: str
    chat_history: List[dict] = Field(default_factory=list)


class ChatResponse(BaseModel):
    answer: str
    sources: List[dict] = Field(default_factory=list)
    chunks: List[dict] = Field(default_factory=list)


class IngestResponse(BaseModel):
    status: str = "success"
    chunks_stored: int = 0
    filename: str = ""
    filenames: List[str] = Field(default_factory=list)
    files_processed: int = 0


class IngestURLRequest(BaseModel):
    url: str


class DocumentSummary(BaseModel):
    source: str
    chunks: int


class DocumentsResponse(BaseModel):
    documents: List[DocumentSummary] = Field(default_factory=list)
    total_documents: int = 0
    total_chunks: int = 0


class DeleteDocumentRequest(BaseModel):
    source: str


class DeleteDocumentResponse(BaseModel):
    status: str = "success"
    source: str
    chunks_deleted: int = 0
    documents_remaining: int = 0


SYSTEM_PROMPT = """You are Clario, a warm, precise document mentor.

RULES:
1. Answer ONLY using the provided CONTEXT below.
2. If the answer is NOT in the context, say exactly:
   "I don't have enough information to answer that from the provided documents."
3. Never guess or make up information.
4. Always mention which document or source your answer comes from.
5. Explain like a good mentor: friendly, structured, and easy to understand.
6. Prefer short headings, bullets, and plain examples when they help.
7. If the user asks for a concept, teach it step by step using the document context.
"""


def build_prompt(
    retrieved_chunks: List[Dict],
    chat_history: List[dict],
    question: str,
) -> str:
    history_lines = []
    for message in chat_history[-6:]:
        role = str(message.get("role", "user")).upper()
        content = str(message.get("content", "")).strip()
        if content:
            history_lines.append(f"{role}: {content}")

    history_str = "\n".join(history_lines)
    chunks_str = "\n\n---\n\n".join(
        (
            f"[Chunk {i + 1} | Source: {chunk.get('source', 'unknown')} "
            f"| Index: {chunk.get('chunk_index', 0)}]\n{chunk.get('text', '')}"
        )
        for i, chunk in enumerate(retrieved_chunks)
    )
    return f"""{SYSTEM_PROMPT}

CONTEXT:
{chunks_str}

CHAT HISTORY:
{history_str or "(no previous messages)"}

QUESTION:
{question}

ANSWER:"""


def split_text(text: str, source_file: str = "unknown") -> List[Dict]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        length_function=lambda s: len(s.split()),
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    raw_chunks = splitter.split_text(text)
    return [
        {
            "text": chunk,
            "meta": {
                "source": source_file,
                "chunk_index": i,
                "id": str(uuid.uuid4()),
            },
        }
        for i, chunk in enumerate(raw_chunks)
    ]


os.makedirs(VECTOR_STORE_PATH, exist_ok=True)
chroma_client = chromadb.PersistentClient(path=VECTOR_STORE_PATH)


def _get_collection():
    return chroma_client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


def _embedding_dimension() -> int:
    collection = _get_collection()
    if collection.count() == 0:
        return LOCAL_EMBED_DIM

    try:
        result = collection.get(limit=1, include=["embeddings"])
        embeddings = result.get("embeddings")
        if embeddings is not None and len(embeddings) > 0:
            return len(embeddings[0])
    except Exception:
        log.warning("Could not read collection embedding dimension; using %d", LOCAL_EMBED_DIM)
    return LOCAL_EMBED_DIM


def _tokens(text: str) -> List[str]:
    normalized = text.casefold().replace("\u03b3", " gamma ")
    tokens = re.findall(r"[\w]+", normalized, flags=re.UNICODE)
    return [token for token in tokens if len(token) > 1 or token in {"x", "y"}]


def small_talk_answer(question: str) -> Optional[str]:
    normalized = re.sub(r"[^\w\s]", "", question.casefold()).strip()
    normalized = re.sub(r"\s+", " ", normalized)
    greetings = {
        "hi",
        "hello",
        "hey",
        "hai",
        "hii",
        "good morning",
        "good afternoon",
        "good evening",
        "yo",
    }
    thanks = {"thanks", "thank you", "thankyou", "ok", "okay", "cool"}
    identity = {
        "who are you",
        "what are you",
        "what can you do",
        "help",
        "help me",
    }
    status = {
        "how are you",
        "how r u",
        "how are u",
        "are you there",
    }

    if normalized in greetings:
        return (
            "Hey, I am here. Ask me anything about your uploaded documents, and I will answer like a mentor: "
            "clear, structured, and tied back to the source."
        )
    if normalized in thanks:
        return "You're welcome. Send me the next question whenever you are ready."
    if normalized in identity:
        return (
            "I am Clario, your document mentor. I can help you summarize uploaded files, explain concepts, "
            "compare points across documents, and show sources for the answer."
        )
    if normalized in status:
        return "I am ready and focused. What document topic should we work through?"
    return None


def local_embed(texts: List[str], dimensions: Optional[int] = None) -> List[List[float]]:
    dimensions = dimensions or _embedding_dimension()
    vectors = []
    for text in texts:
        vector = [0.0] * dimensions
        tokens = _tokens(text)
        features = tokens + [f"{a}_{b}" for a, b in zip(tokens, tokens[1:])]

        for feature in features:
            digest = hashlib.blake2b(feature.encode("utf-8"), digest_size=8).digest()
            bucket = int.from_bytes(digest[:4], "big") % dimensions
            sign = 1.0 if digest[4] & 1 else -1.0
            vector[bucket] += sign

        norm = math.sqrt(sum(value * value for value in vector))
        if norm == 0:
            vector[0] = 1.0
        else:
            vector = [value / norm for value in vector]
        vectors.append(vector)
    return vectors


async def embed_texts(texts: List[str]) -> tuple[List[List[float]], str]:
    if not texts:
        return [], "local"

    if is_gemini_configured():
        try:
            return await gemini_embed(texts), "gemini"
        except (GeminiConfigurationError, httpx.HTTPError, OSError) as exc:
            log.warning("Gemini embeddings unavailable; using local embeddings: %s", exc)

    return local_embed(texts), "local"


def store_chunks(chunks: List[Dict], vectors: List[List[float]]) -> int:
    if not chunks:
        return 0
    if len(chunks) != len(vectors):
        raise ValueError("Embedding count did not match chunk count.")

    collection = _get_collection()
    ids = [c["meta"]["id"] for c in chunks]
    documents = [c["text"] for c in chunks]
    metadatas = [c["meta"] for c in chunks]
    collection.add(ids=ids, embeddings=vectors, documents=documents, metadatas=metadatas)
    log.info("Stored %d chunks in ChromaDB", len(chunks))
    return len(chunks)


def lexical_search(question: str, top_k: int = TOP_K_RESULTS) -> List[Dict]:
    collection = _get_collection()
    count = collection.count()
    if count == 0:
        return []

    query_tokens = _tokens(question)
    if not query_tokens:
        return []

    query_counts = Counter(query_tokens)
    query_phrase = " ".join(query_tokens)
    results = collection.get(include=["documents", "metadatas"])
    scored = []
    for doc, meta in zip(results.get("documents", []), results.get("metadatas", [])):
        doc_tokens = _tokens(doc or "")
        if not doc_tokens:
            continue

        doc_counts = Counter(doc_tokens)
        overlap = sum(min(count, doc_counts.get(token, 0)) for token, count in query_counts.items())
        phrase_bonus = 2 if query_phrase and query_phrase in " ".join(doc_tokens) else 0
        score = (overlap + phrase_bonus) / max(1, len(query_tokens))
        if score <= 0:
            continue

        scored.append({
            "text": doc,
            "source": (meta or {}).get("source", "unknown"),
            "chunk_index": (meta or {}).get("chunk_index", 0),
            "score": round(min(score, 1.0), 4),
        })

    scored.sort(key=lambda hit: hit["score"], reverse=True)
    return scored[:top_k]


def search_similar(query_vec: List[float], top_k: int = TOP_K_RESULTS) -> List[Dict]:
    collection = _get_collection()
    count = collection.count()
    if count == 0:
        return []

    results = collection.query(
        query_embeddings=[query_vec],
        n_results=min(top_k, count),
        include=["documents", "metadatas", "distances"],
    )

    hits = []
    docs = results["documents"][0]
    metas = results["metadatas"][0]
    distances = results["distances"][0]
    for doc, meta, dist in zip(docs, metas, distances):
        score = max(0.0, min(1.0, 1 - dist))
        hits.append({
            "text": doc,
            "source": meta.get("source", "unknown"),
            "chunk_index": meta.get("chunk_index", 0),
            "score": round(score, 4),
        })
    return hits


def merge_hits(*hit_groups: List[Dict], top_k: int = TOP_K_RESULTS) -> List[Dict]:
    merged = {}
    for hits in hit_groups:
        for hit in hits:
            key = (hit.get("source", "unknown"), hit.get("chunk_index", 0))
            if key not in merged or hit.get("score", 0) > merged[key].get("score", 0):
                merged[key] = hit
    return list(merged.values())[:top_k]


def compact_sources(hits: List[Dict]) -> List[Dict]:
    sources = []
    seen = set()
    for hit in hits:
        source = hit.get("source", "unknown")
        if source in seen:
            continue
        seen.add(source)
        sources.append({"source": source, "score": hit.get("score", 0)})
    return sources


def build_extractive_answer(question: str, hits: List[Dict], reason: Optional[str] = None) -> str:
    if not hits:
        return "I don't have enough information to answer that from the provided documents."

    best = hits[0]
    raw_text = best.get("text") or ""
    body = format_retrieved_answer(raw_text, question)
    note = ""
    if reason:
        note = f"> {reason} I formatted the most relevant source passage instead.\n\n"

    return (
        f"{note}"
        f"**Source:** `{best.get('source', 'unknown')}`\n\n"
        f"{body}"
    )


def format_retrieved_answer(text: str, question: str) -> str:
    query_tokens = set(_tokens(question))
    if {"discount", "factor"}.issubset(query_tokens) or {"gamma", "factor"}.issubset(query_tokens):
        formatted = format_discount_factor_section(text)
        if formatted:
            return formatted

    excerpt = relevant_excerpt(text, question)
    points = sentence_points(excerpt, limit=8)
    if not points:
        return f"**Relevant passage**\n\n{excerpt}"

    bullets = "\n".join(f"- {point}" for point in points)
    return f"**Relevant passage**\n\n{bullets}"


def format_discount_factor_section(text: str) -> Optional[str]:
    section = extract_discount_factor_section(text)
    if not section:
        return None

    def field(label: str, next_labels: List[str]) -> str:
        markers = "|".join(re.escape(next_label) for next_label in next_labels)
        match = re.search(
            rf"{re.escape(label)}\s*:?\s*(.*?)(?=\s+(?:{markers})\s*:|\Z)",
            section,
            flags=re.IGNORECASE | re.DOTALL,
        )
        return clean_field(match.group(1)) if match else ""

    range_value = field("Range", ["Meaning", "Typical values", "Tip"])
    meaning = field("Meaning", ["Typical values", "Tip"])
    typical = field("Typical values", ["Tip"])
    tip = field("Tip", ["Exploration Rate", "epsilon", "\u03b5", "episodes"])

    lines = [
        "### Gamma - Discount Factor",
        "",
        "- **What it controls:** How much future rewards matter compared with immediate rewards.",
    ]
    if range_value:
        lines.append(f"- **Range:** {range_value}")
    if typical:
        lines.append(f"- **Typical values:** {typical}")

    low_value = extract_after_marker(meaning, "0")
    high_value = extract_after_marker(meaning, "1")
    if low_value:
        lines.append(f"- **When gamma is low:** {low_value}")
    if high_value:
        lines.append(f"- **When gamma is high:** {high_value}")
    if tip:
        lines.append(f"- **Tip:** {tip}")

    return "\n".join(lines)


def extract_discount_factor_section(text: str) -> str:
    compact = " ".join(text.split())
    lowered = compact.casefold()
    position = lowered.find("discount factor")
    if position < 0:
        return ""

    start_markers = ["gamma =", "gamma ", "\u03b3"]
    start = position
    for marker in start_markers:
        marker_position = lowered.rfind(marker, 0, position)
        if marker_position >= 0 and position - marker_position < 180:
            start = marker_position
            break

    end = len(compact)
    for marker in [" exploration rate", " epsilon", " \u03b5", " episodes", " number of training"]:
        marker_position = lowered.find(marker, position + 1)
        if marker_position >= 0:
            end = min(end, marker_position)

    return compact[start:end].strip(" .")


def clean_field(value: str) -> str:
    value = re.sub(r"\s+", " ", value).strip(" .")
    value = re.sub(r"^[o\-•]+\s*", "", value)
    value = re.sub(r"(?:\s+[o?•])+$", "", value).strip(" .")
    return value


def extract_after_marker(text: str, marker: str) -> str:
    pattern = rf"(?:^|\s){re.escape(marker)}\s*(?:->|\u2192|-|:)\s*(.*?)(?=\s+[01]\s*(?:->|\u2192|-|:)|\Z)"
    match = re.search(pattern, text, flags=re.DOTALL)
    return clean_field(match.group(1)) if match else ""


def sentence_points(text: str, limit: int = 8) -> List[str]:
    compact = " ".join(text.split())
    compact = compact.replace("\u2022", ". ")
    parts = re.split(r"(?<=[.!?])\s+", compact)
    points = [part.strip(" .") for part in parts if len(part.strip()) > 20]
    return points[:limit]


def relevant_excerpt(text: str, question: str, max_chars: int = 1800) -> str:
    compact = " ".join(text.split())
    if len(compact) <= max_chars:
        return compact

    lowered = text.casefold()
    query_tokens = _tokens(question)
    phrases = []
    if "discount" in query_tokens and "factor" in query_tokens:
        phrases.append("discount factor")
    phrases.extend(token for token in query_tokens if len(token) > 3)
    phrases.append("\u03b3")

    positions = [lowered.find(phrase.casefold()) for phrase in phrases if phrase]
    positions = [position for position in positions if position >= 0]
    if not positions:
        return f"{compact[:max_chars].rstrip()}..."

    position = min(positions)
    start = max(0, position - 320)
    end = min(len(text), start + max_chars)

    line_start = text.rfind("\n", 0, position)
    if line_start >= 0 and position - line_start < 500:
        start = line_start + 1
        end = min(len(text), start + max_chars)

    excerpt = " ".join(text[start:end].split())
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(text) else ""
    return f"{prefix}{excerpt.rstrip()}{suffix}"


def list_documents() -> List[Dict]:
    collection = _get_collection()
    if collection.count() == 0:
        return []

    results = collection.get(include=["metadatas"])
    counts = Counter(
        meta.get("source", "unknown")
        for meta in results.get("metadatas", [])
        if meta
    )
    return [
        {"source": source, "chunks": chunks}
        for source, chunks in sorted(counts.items(), key=lambda item: item[0].lower())
    ]


def delete_document(source: str) -> int:
    source = source.strip()
    if not source:
        raise ValueError("Document source is required.")

    collection = _get_collection()
    matches = collection.get(where={"source": source}, include=["metadatas"])
    ids = matches.get("ids", [])
    if not ids:
        return 0

    collection.delete(ids=ids)
    log.info("Deleted %d chunks for source: %s", len(ids), source)
    return len(ids)


def _require_provider() -> None:
    if not is_gemini_configured():
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is missing. Add it to backend/.env before using chat or ingestion.",
        )


async def _save_temp_file(upload: UploadFile) -> str:
    suffix = os.path.splitext(upload.filename or "file")[1] or ".bin"
    tmp_path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4()}{suffix}")
    content = await upload.read()
    async with aiofiles.open(tmp_path, "wb") as f:
        await f.write(content)
    return tmp_path


def _extract_pdf(path: str) -> str:
    pages = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
    return "\n".join(pages)


def _extract_docx(path: str) -> str:
    document = docx.Document(path)
    parts = [p.text.strip() for p in document.paragraphs if p.text.strip()]
    for table in document.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells:
                parts.append(" | ".join(cells))
    return "\n".join(parts)


def _extract_txt(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def _extract_csv(path: str) -> str:
    rows = []
    with open(path, newline="", encoding="utf-8", errors="ignore") as f:
        reader = csv.reader(f)
        for row in reader:
            values = [cell.strip() for cell in row]
            if any(values):
                rows.append(" | ".join(values))
    return "\n".join(rows)


async def _scrape_url(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Enter a valid http or https URL.")

    headers = {"User-Agent": "Mozilla/5.0 Clario/1.0"}
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        resp = await client.get(url.strip(), headers=headers)
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "form", "nav", "footer", "header", "aside"]):
        tag.decompose()

    blocks = []
    seen = set()
    for tag in soup.find_all(["h1", "h2", "h3", "p", "li"]):
        text = " ".join(tag.get_text(separator=" ", strip=True).split())
        if len(text) < 25 or text in seen:
            continue
        seen.add(text)
        blocks.append(text)

    return "\n\n".join(blocks)


async def process_upload(file: UploadFile) -> int:
    tmp_path = await _save_temp_file(file)
    suffix = os.path.splitext(tmp_path)[1].lower()

    try:
        if suffix == ".pdf":
            raw = _extract_pdf(tmp_path)
        elif suffix == ".docx":
            raw = _extract_docx(tmp_path)
        elif suffix in {".txt", ".md"}:
            raw = _extract_txt(tmp_path)
        elif suffix == ".csv":
            raw = _extract_csv(tmp_path)
        else:
            raise ValueError(f"Unsupported file type: '{suffix}'. Supported: PDF, DOCX, TXT, MD, CSV")
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass

    if not raw.strip():
        raise ValueError("No text could be extracted from the file.")

    chunks = split_text(raw, source_file=file.filename or "upload")
    vectors, provider = await embed_texts([c["text"] for c in chunks])
    for chunk in chunks:
        chunk["meta"]["embedding_provider"] = provider
    return store_chunks(chunks, vectors)


async def process_url(url: str) -> int:
    raw = await _scrape_url(url)
    if not raw.strip():
        raise ValueError("No text could be extracted from the URL.")

    chunks = split_text(raw, source_file=url)
    vectors, provider = await embed_texts([c["text"] for c in chunks])
    for chunk in chunks:
        chunk["meta"]["embedding_provider"] = provider
    return store_chunks(chunks, vectors)


@router.get("/health")
async def health():
    collection = _get_collection()
    return {
        "status": "ok",
        "model": LLM_MODEL,
        "gemini_configured": is_gemini_configured(),
        "vector_db": "ChromaDB (local)",
        "chunks_stored": collection.count(),
    }


@router.get("/documents", response_model=DocumentsResponse)
async def documents():
    docs = list_documents()
    return DocumentsResponse(
        documents=[DocumentSummary(**doc) for doc in docs],
        total_documents=len(docs),
        total_chunks=sum(doc["chunks"] for doc in docs),
    )


@router.delete("/documents", response_model=DeleteDocumentResponse)
async def remove_document(body: DeleteDocumentRequest):
    try:
        deleted = delete_document(body.source)
        if deleted == 0:
            raise HTTPException(status_code=404, detail="Document was not found in the knowledge base.")

        return DeleteDocumentResponse(
            source=body.source,
            chunks_deleted=deleted,
            documents_remaining=len(list_documents()),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        log.exception("Document deletion failed")
        raise HTTPException(status_code=500, detail=f"Document deletion error: {exc}")


@router.post("/ingest", response_model=IngestResponse)
async def ingest_file(
    files: Optional[List[UploadFile]] = File(None),
    file: Optional[UploadFile] = File(None),
):
    try:
        upload_files = files or ([file] if file is not None else [])
        if not upload_files:
            raise ValueError("No files were uploaded.")

        total_chunks = 0
        filenames = []
        for upload in upload_files:
            log.info("Ingesting file: %s", upload.filename)
            total_chunks += await process_upload(upload)
            filenames.append(upload.filename or "upload")

        return IngestResponse(
            status="success",
            chunks_stored=total_chunks,
            filename=", ".join(filenames),
            filenames=filenames,
            files_processed=len(upload_files),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except HTTPException:
        raise
    except GeminiConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Gemini request failed: {exc}")
    except Exception as exc:
        log.exception("Ingestion failed")
        raise HTTPException(status_code=500, detail=f"Ingestion error: {exc}")


@router.post("/ingest-url", response_model=IngestResponse)
async def ingest_url(body: IngestURLRequest):
    try:
        log.info("Scraping URL: %s", body.url)
        count = await process_url(body.url)
        return IngestResponse(
            status="success",
            chunks_stored=count,
            filename=body.url,
            filenames=[body.url],
            files_processed=1,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except HTTPException:
        raise
    except GeminiConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"URL returned HTTP {exc.response.status_code}.")
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"URL scrape request failed: {exc}")
    except Exception as exc:
        log.exception("URL ingestion failed")
        raise HTTPException(status_code=500, detail=f"URL scrape error: {exc}")


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest):
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    try:
        canned = small_talk_answer(payload.question)
        if canned:
            return ChatResponse(answer=canned, sources=[], chunks=[])

        if _get_collection().count() == 0:
            return ChatResponse(
                answer="I don't have enough information to answer that from the provided documents.",
                sources=[],
                chunks=[],
            )

        lexical_hits = lexical_search(payload.question, top_k=TOP_K_RESULTS)
        query_vectors, query_provider = await embed_texts([payload.question])
        vector_hits = search_similar(query_vectors[0], top_k=TOP_K_RESULTS)
        hits = merge_hits(lexical_hits, vector_hits, top_k=TOP_K_RESULTS)
        query_tokens = _tokens(payload.question)

        if not lexical_hits and len(query_tokens) <= 2:
            return ChatResponse(
                answer="I don't have enough information to answer that from the provided documents.",
                sources=[],
                chunks=[],
            )

        if not hits:
            return ChatResponse(
                answer="I don't have enough information to answer that from the provided documents.",
                sources=[],
                chunks=[],
            )

        if query_provider != "gemini":
            fallback_hits = lexical_hits or hits
            return ChatResponse(
                answer=build_extractive_answer(
                    payload.question,
                    fallback_hits,
                    "Gemini is unavailable right now, so I cannot generate a full answer.",
                ),
                sources=compact_sources(fallback_hits),
                chunks=fallback_hits,
            )

        full_prompt = build_prompt(
            retrieved_chunks=hits,
            chat_history=payload.chat_history,
            question=payload.question,
        )
        try:
            answer, _ = await gemini_chat(full_prompt, model=LLM_MODEL)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429:
                answer = build_extractive_answer(
                    payload.question,
                    hits,
                    "Gemini is rate-limited right now, so I cannot generate a full answer.",
                )
            else:
                raise
        except (httpx.HTTPError, OSError) as exc:
            answer = build_extractive_answer(
                payload.question,
                hits,
                f"Gemini request failed: {exc}.",
            )

        return ChatResponse(
            answer=answer,
            sources=compact_sources(hits),
            chunks=hits,
        )
    except HTTPException:
        raise
    except GeminiConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Gemini request failed: {exc}")
    except Exception as exc:
        log.exception("Chat failed")
        raise HTTPException(status_code=500, detail=f"Chat error: {exc}")


app.include_router(router, prefix="/api")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("rag_chatbot:app", host="0.0.0.0", port=8000, reload=True)
