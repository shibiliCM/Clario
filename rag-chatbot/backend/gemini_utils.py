"""Provider utilities for embeddings and chat completion."""

import os
from typing import List, Tuple

import httpx

EMBED_MODEL = os.getenv("EMBED_MODEL", "gemini-embedding-001")
LLM_MODEL = os.getenv("LLM_MODEL", "gemini-2.5-flash")
BASE_URL = "https://generativelanguage.googleapis.com/v1beta"


class GeminiConfigurationError(RuntimeError):
    """Raised when provider credentials are required but unavailable."""


def is_gemini_configured() -> bool:
    return bool(os.getenv("GEMINI_API_KEY", "").strip())


def _api_key() -> str:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise GeminiConfigurationError(
            "GEMINI_API_KEY is missing. Add it to backend/.env before using chat or ingestion."
        )
    return api_key


def _headers() -> dict:
    return {
        "x-goog-api-key": _api_key(),
        "Content-Type": "application/json",
    }


async def gemini_embed(texts: List[str]) -> List[List[float]]:
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
        resp = await client.post(url, json=payload, headers=_headers())
        resp.raise_for_status()
        data = resp.json()
        return [item["values"] for item in data["embeddings"]]


async def gemini_embed_single(text: str) -> List[float]:
    vectors = await gemini_embed([text])
    return vectors[0]


async def gemini_chat(prompt: str, model: str = LLM_MODEL) -> Tuple[str, List[dict]]:
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
        resp = await client.post(url, json=payload, headers=_headers())
        resp.raise_for_status()
        data = resp.json()

    try:
        answer = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        answer = "Sorry, I could not generate a response. Please try again."

    return answer, []
