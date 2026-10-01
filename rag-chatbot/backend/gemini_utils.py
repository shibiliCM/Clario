"""Provider utilities for embeddings, batching, and streaming chat completion."""

import json
import os
from typing import AsyncGenerator, List, Optional, Tuple

import httpx

EMBED_MODEL = os.getenv("EMBED_MODEL", "gemini-embedding-001")
LLM_MODEL = os.getenv("LLM_MODEL", "gemini-2.5-flash")
BASE_URL = "https://generativelanguage.googleapis.com/v1beta"


class GeminiConfigurationError(RuntimeError):
    """Raised when provider credentials are required but unavailable."""


def is_gemini_configured(api_key: Optional[str] = None) -> bool:
    key = (api_key or os.getenv("GEMINI_API_KEY", "")).strip()
    return bool(key)


def _api_key(override: Optional[str] = None) -> str:
    key = (override or os.getenv("GEMINI_API_KEY", "")).strip()
    if not key:
        raise GeminiConfigurationError(
            "GEMINI_API_KEY is missing. Add it to backend/.env or configure it in the UI."
        )
    return key


def _headers(api_key: Optional[str] = None) -> dict:
    return {
        "x-goog-api-key": _api_key(api_key),
        "Content-Type": "application/json",
    }


async def gemini_embed(texts: List[str], api_key: Optional[str] = None) -> List[List[float]]:
    if not texts:
        return []

    url = f"{BASE_URL}/models/{EMBED_MODEL}:batchEmbedContents"
    requests_payload = [
        {
            "model": f"models/{EMBED_MODEL}",
            "content": {"parts": [{"text": text}]},
        }
        for text in texts
    ]
    payload = {"requests": requests_payload}

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=_headers(api_key))
        resp.raise_for_status()
        data = resp.json()
        return [item["values"] for item in data["embeddings"]]


async def gemini_embed_single(text: str, api_key: Optional[str] = None) -> List[float]:
    vectors = await gemini_embed([text], api_key=api_key)
    return vectors[0]


async def gemini_chat(prompt: str, model: str = LLM_MODEL, api_key: Optional[str] = None) -> Tuple[str, List[dict]]:
    url = f"{BASE_URL}/models/{model}:generateContent"
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "temperature": 0.0,
            "maxOutputTokens": 2048,
        },
    }

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(url, json=payload, headers=_headers(api_key))
        resp.raise_for_status()
        data = resp.json()

    try:
        answer = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        answer = "Sorry, I could not generate a response. Please try again."

    return answer, []


async def gemini_chat_stream(
    prompt: str,
    model: str = LLM_MODEL,
    api_key: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """Streams generated text tokens directly from Gemini SSE API."""
    url = f"{BASE_URL}/models/{model}:streamGenerateContent?alt=sse"
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "temperature": 0.0,
            "maxOutputTokens": 2048,
        },
    }

    async with httpx.AsyncClient(timeout=60) as client:
        async with client.stream("POST", url, json=payload, headers=_headers(api_key)) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if line.startswith("data: "):
                    raw = line[6:].strip()
                    if not raw:
                        continue
                    try:
                        data = json.loads(raw)
                        candidates = data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            for part in parts:
                                chunk_text = part.get("text", "")
                                if chunk_text:
                                    yield chunk_text
                    except Exception:
                        continue
