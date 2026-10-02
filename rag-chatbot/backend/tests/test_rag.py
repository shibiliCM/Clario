import os
import sys
import unittest
import math

# Add backend directory to sys.path
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from rag_chatbot import (
    split_text,
    _validate_safe_url,
    small_talk_answer,
    local_embed,
    LOCAL_EMBED_DIM,
    app,
)
from starlette.testclient import TestClient


class TestRagPipeline(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_text_splitting_and_metadata(self):
        sample = "This is sentence one. " * 50
        chunks = split_text(sample, source_file="sample.txt")
        self.assertGreater(len(chunks), 0)
        first = chunks[0]
        self.assertIn("text", first)
        self.assertIn("meta", first)
        self.assertEqual(first["meta"]["source"], "sample.txt")
        self.assertEqual(first["meta"]["chunk_index"], 0)
        self.assertTrue(len(first["meta"]["id"]) > 0)

    def test_ssrf_validator_blocks_internal_and_loopback(self):
        blocked_urls = [
            "http://localhost:8000/api/documents",
            "http://127.0.0.1:8000",
            "http://127.0.0.1/test",
            "http://0.0.0.0/",
            "http://10.0.0.1/secret",
            "http://192.168.1.1/admin",
            "http://169.254.169.254/latest/meta-data/",
            "ftp://example.com/file",
            "file:///etc/passwd",
        ]
        for url in blocked_urls:
            with self.subTest(url=url):
                with self.assertRaises(ValueError):
                    _validate_safe_url(url)

    def test_ssrf_validator_allows_valid_public_domain(self):
        valid = "https://example.com/test-article"
        self.assertEqual(_validate_safe_url(valid), valid)

    def test_small_talk_greetings_and_help(self):
        self.assertIsNotNone(small_talk_answer("hello"))
        self.assertIsNotNone(small_talk_answer("hi there!"))
        self.assertIsNotNone(small_talk_answer("Who are you?"))
        self.assertIsNotNone(small_talk_answer("Thank you"))
        self.assertIsNone(small_talk_answer("What were the sales figures for Q3 2025?"))

    def test_local_embedding_dimensions_and_normalization(self):
        self.assertEqual(LOCAL_EMBED_DIM, 768)
        vectors = local_embed(["Clario RAG Assistant with dense semantic embeddings."])
        self.assertEqual(len(vectors), 1)
        self.assertEqual(len(vectors[0]), 768)
        norm = math.sqrt(sum(v * v for v in vectors[0]))
        self.assertAlmostEqual(norm, 1.0, places=4)

    def test_health_endpoint(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("status"), "ok")
        self.assertIn("gemini_configured", data)
        self.assertIn("chunks_stored", data)


if __name__ == "__main__":
    unittest.main()
