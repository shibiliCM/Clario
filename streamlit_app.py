"""
Clario - Streamlit App for Streamlit Community Cloud.

Allows 1-click free deployment of Clario on Streamlit Community Cloud.
"""

import os
import sys
import asyncio
import streamlit as st

# Ensure backend directory is in path (checking all possible subfolder locations)
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
POSSIBLE_BACKEND_DIRS = [
    os.path.join(CURRENT_DIR, "rag-chatbot-free-tier", "rag-chatbot", "backend"),
    os.path.join(CURRENT_DIR, "rag-chatbot", "backend"),
    os.path.join(CURRENT_DIR, "backend"),
]

for b_dir in POSSIBLE_BACKEND_DIRS:
    if os.path.exists(b_dir) and b_dir not in sys.path:
        sys.path.insert(0, b_dir)

from rag_chatbot import (
    process_upload,
    process_url,
    list_documents,
    delete_document,
    small_talk_answer,
    embed_texts,
    lexical_search,
    search_similar,
    merge_hits,
    compact_sources,
    build_prompt,
    build_extractive_answer,
    TOP_K_RESULTS,
    is_gemini_configured,
    gemini_chat,
)

st.set_page_config(
    page_title="Clario 🤖 Document Mentor",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
    .main-header {
        font-size: 2.2rem;
        font-weight: 700;
        background: linear-gradient(90deg, #6366f1, #a855f7);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.5rem;
    }
    .stChatMessage {
        border-radius: 12px;
    }
</style>
""", unsafe_allow_html=True)

st.markdown('<div class="main-header">Clario 🤖 AI Document Mentor</div>', unsafe_allow_html=True)
st.caption("Ask questions grounded in your uploaded documents or web pages.")

# Initialize session states
if "messages" not in st.session_state:
    st.session_state.messages = []

# Sidebar setup
with st.sidebar:
    st.header("📄 Knowledge Base")
    
    # API Key Config check
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        user_key = st.text_input("Enter Gemini API Key", type="password", help="Get free key from aistudio.google.com")
        if user_key:
            os.environ["GEMINI_API_KEY"] = user_key
            st.success("API Key updated for session!")
    
    # Ingestion Tabs
    tab_file, tab_url = st.tabs(["📁 Files", "🌐 Web URL"])
    
    with tab_file:
        uploaded_files = st.file_uploader(
            "Upload Documents",
            type=["pdf", "docx", "txt", "md", "csv"],
            accept_multiple_files=True
        )
        if st.button("Process Files", type="primary", use_container_width=True):
            if uploaded_files:
                with st.spinner("Processing & indexing documents..."):
                    processed_count = 0
                    for file in uploaded_files:
                        class DummyUpload:
                            def __init__(self, file_obj):
                                self.filename = file_obj.name
                                self._file = file_obj
                            async def read(self):
                                return self._file.getvalue()
                        
                        try:
                            chunks = asyncio.run(process_upload(DummyUpload(file)))
                            processed_count += chunks
                        except Exception as e:
                            st.error(f"Error processing {file.name}: {e}")
                    
                    if processed_count > 0:
                        st.success(f"Successfully indexed {processed_count} chunks!")
                        st.rerun()
            else:
                st.warning("Please select at least one file.")
                
    with tab_url:
        url_input = st.text_input("Ingest Web Page", placeholder="https://example.com/article")
        if st.button("Scrape & Index URL", use_container_width=True):
            if url_input:
                with st.spinner("Scraping URL..."):
                    try:
                        chunks = asyncio.run(process_url(url_input))
                        st.success(f"Indexed {chunks} chunks from URL!")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Error: {e}")
            else:
                st.warning("Enter a valid URL.")
                
    st.divider()
    st.subheader("📚 Managed Documents")
    docs = list_documents()
    if docs:
        for doc in docs:
            col1, col2 = st.columns([4, 1])
            col1.text(f"• {doc['source']} ({doc['chunks']} chunks)")
            if col2.button("❌", key=f"del_{doc['source']}"):
                delete_document(doc['source'])
                st.rerun()
    else:
        st.info("No documents uploaded yet.")

# Chat Interface
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])
        if "sources" in msg and msg["sources"]:
            with st.expander("📌 Grounded Sources"):
                for src in msg["sources"]:
                    st.caption(f"- **{src.get('source')}** (Score: {src.get('score', 0)})")

if prompt := st.chat_input("Ask a question about your documents..."):
    # Display user message
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    # Process query
    with st.chat_message("assistant"):
        with st.spinner("Searching documents & thinking..."):
            # Check small talk first
            small_talk = small_talk_answer(prompt)
            if small_talk:
                answer = small_talk
                sources = []
            else:
                # Hybrid RAG search
                query_vec, provider = asyncio.run(embed_texts([prompt]))
                query_vector = query_vec[0] if query_vec else []
                
                lexical_hits = lexical_search(prompt, top_k=TOP_K_RESULTS)
                vector_hits = search_similar(query_vector, top_k=TOP_K_RESULTS) if query_vector else []
                merged_hits = merge_hits(lexical_hits, vector_hits, top_k=TOP_K_RESULTS)
                sources = compact_sources(merged_hits)

                if not merged_hits:
                    answer = "I don't have enough information to answer that from the provided documents."
                else:
                    if is_gemini_configured():
                        history_payload = [
                            {"role": m["role"], "content": m["content"]}
                            for m in st.session_state.messages[-7:-1]
                        ]
                        full_prompt = build_prompt(merged_hits, history_payload, prompt)
                        try:
                            answer = gemini_chat(full_prompt)
                        except Exception as e:
                            answer = build_extractive_answer(prompt, merged_hits, reason=f"(LLM unavailable: {e})")
                    else:
                        answer = build_extractive_answer(prompt, merged_hits, reason="(Gemini API Key not set)")

            st.markdown(answer)
            if sources:
                with st.expander("📌 Grounded Sources"):
                    for src in sources:
                        st.caption(f"- **{src.get('source')}** (Score: {src.get('score', 0)})")

            st.session_state.messages.append({
                "role": "assistant",
                "content": answer,
                "sources": sources
            })
