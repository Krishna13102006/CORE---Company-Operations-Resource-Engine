"""
rag_generator.py

Multi-Provider RAG Answer Generation Engine.

Supports:
1. Groq Cloud API (Free & ultra-fast LLaMA 3.3 70B / LLaMA 3.1 8B inference)
2. Google Gemini API (gemini-2.0-flash / gemini-1.5-flash)
3. OpenAI / vLLM / TGI (OpenAI-compatible chat completions)
4. Local Ollama (qwen2.5:1.5b / llama3 fallback)

Automatic Provider Selection:
- If GROQ_API_KEY is present -> uses Groq
- If GEMINI_API_KEY is present -> uses Gemini
- If OPENAI_API_KEY is present -> uses OpenAI
- Falls back to local Ollama if no cloud API key is configured.
"""

import json
import logging
import httpx
from typing import List, Dict, Any, Generator, Tuple
from django.conf import settings

logger = logging.getLogger(__name__)

MAX_CONTEXT_CHARS = getattr(settings, 'RAG_MAX_CONTEXT_CHARS', 6000)

SYSTEM_PROMPT = (
    "You are an expert, authoritative internal research assistant for an organization.\n"
    "Your mission is to deliver comprehensive, beautifully structured, and completely answered explanations grounded in the organization's documents.\n\n"
    "Strict Output & Formatting Rules:\n"
    "1. NO META-INTRODUCTIONS: Never start your response with filler phrases like 'Below is a detailed overview...', 'According to the document...', 'As an AI...', or 'In summary'. Jump straight into the substantive technical content.\n"
    "2. NO EM-DASHES (—) OR DOUBLE HYPHENS (--): Never use em-dashes (—) or double hyphens (--) anywhere in your response. Use natural sentences, commas, colons (:), or parentheses instead.\n"
    "3. NO RAW HTML IN TABLES: NEVER output raw HTML tags (such as <pre>, <br>, <code>, <div>) inside Markdown tables. In table cells, keep code examples strictly single-line using inline markdown code (e.g. `if x > 0: print('ok')`). Place all multi-line code examples in dedicated ```python ... ``` code blocks below the table.\n"
    "4. MANDATORY GFM TABLES: When presenting chapter indexes, syntax summaries, or comparisons, ALWAYS format them as clean, valid GitHub-flavored Markdown tables (| Column 1 | Column 2 | \n |---|---|).\n"
    "5. CODE & COMMANDS: Always enclose multi-line code or terminal commands in fenced code blocks with language identifiers (```python, ```bash, ```sql, ```json).\n"
    "6. FOLLOW-UP CONTINUITY & COMPLETENESS: Seamlessly maintain context from previous turns. Ensure your explanation is complete, thorough, and naturally concluded without cutting off.\n"
    "7. GROUNDED FACTS: Prioritize document facts. If the query asks for concepts related to the documents, explain them thoroughly using domain knowledge. Only if the query is wholly unrelated to any document or domain in the organization, state: \"I couldn't find information about this in your organisation's documents.\""
)

COMPARATIVE_SYSTEM_PROMPT = (
    "You are an expert, authoritative enterprise research analyst for an organization.\n"
    "Your mission is to deliver rigorous multi-document comparative synthesis, delta analysis, and structured side-by-side evaluations based on the provided documents.\n\n"
    "Strict Output & Formatting Rules:\n"
    "1. NO META-INTRODUCTIONS: Jump straight into the substantive comparative analysis.\n"
    "2. MANDATORY GFM COMPARISON TABLE: Structure key differences (e.g. Terms, Pricing, SLA, Scope, Responsibilities, Timeline) in a clear GitHub-flavored Markdown comparison table (| Feature/Topic | Document A | Document B | Key Delta |).\n"
    "3. KEY TAKEAWAYS & RISKS: Follow the table with concise, high-impact bulleted breakdowns of critical differences, trade-offs, and compliance/operational implications.\n"
    "4. NO EM-DASHES (—) OR DOUBLE HYPHENS (--): Use natural punctuation (commas, colons, parentheses).\n"
    "5. NO RAW HTML IN TABLES: Keep table cells clean with inline markdown."
)

def _is_comparative_query(question: str, retrieved_chunks: List[Dict[str, Any]]) -> bool:
    q_lower = question.lower()
    comp_keywords = ['compare', 'comparison', 'versus', 'vs', 'difference', 'delta', 'contrast', 'side by side', 'differences between']
    if any(k in q_lower for k in comp_keywords):
        return True
    # If chunks come from multiple distinct documents and question asks about multiple items
    doc_ids = {c.get('document_id') for c in retrieved_chunks if c.get('document_id')}
    return len(doc_ids) >= 2 and any(w in q_lower for w in ['both', 'between', 'each', 'matrix', 'table'])


def _clean_token(token: str) -> str:
    if not token:
        return token
    return token.replace('—', ' - ').replace('–', ' - ')


def _clean_text(text: str) -> str:
    import re
    if not text:
        return text
    cleaned = text.replace('—', ' - ').replace('–', ' - ')
    # Fix any Markdown table rows accidentally joined on the same line with ||
    cleaned = re.sub(r'\|\s*\|', '|\n|', cleaned)
    return cleaned

def get_active_provider() -> str:
    """Determine which LLM provider to use based on configuration and API keys."""
    explicit = getattr(settings, 'LLM_PROVIDER', '').strip().lower()
    if explicit in ['groq', 'gemini', 'openai', 'ollama']:
        return explicit

    # Auto-detection priority (Gemini prioritized for 1M TPM quota vs Groq 8k TPM)
    if getattr(settings, 'GEMINI_API_KEY', '').strip():
        return 'gemini'
    if getattr(settings, 'GROQ_API_KEY', '').strip():
        return 'groq'
    if getattr(settings, 'OPENAI_API_KEY', '').strip():
        return 'openai'
    return 'ollama'


def _build_context_and_prompt(question: str, retrieved_chunks: List[Dict[str, Any]], history: List[Dict[str, str]] = None) -> Tuple[str, str]:
    """Assemble context from retrieved chunks and conversation history, and format the prompt."""
    context_parts = []
    total_chars = 0

    for i, chunk in enumerate(retrieved_chunks):
        title = chunk.get('document_title', 'Unknown Document')
        text = chunk.get('chunk_text', '')
        entry = f"[Document: {title}]\n{text}"

        if i > 0 and total_chars + len(entry) > MAX_CONTEXT_CHARS:
            break

        context_parts.append(entry)
        total_chars += len(entry)

    if not context_parts:
        return "", ""

    context = "\n\n---\n\n".join(context_parts)

    history_str = ""
    if history and isinstance(history, list):
        turns = []
        for h in history[-4:]:
            role = "User" if h.get('role') == 'user' else "Assistant"
            content = h.get('content', '').strip()
            if content:
                turns.append(f"{role}: {content[:300]}")
        if turns:
            history_str = "Recent Conversation History:\n" + "\n".join(turns) + "\n\n"

    cleaned_q = question.strip()
    words = cleaned_q.split()
    is_keyword = len(words) <= 3 and not any(char in cleaned_q for char in ['?', '.', '!'])
    question_to_use = f"What do the provided documents say about {cleaned_q}?" if is_keyword else cleaned_q

    prompt = f"{history_str}Documents:\n{context}\n\nQuestion: {question_to_use}\n\nAnswer:"
    return prompt, context


def _extractive_answer_from_chunks(question: str, retrieved_chunks: List[Dict[str, Any]]) -> str:
    """
    Intelligent extractive answer synthesizer when neural LLM inference is offline or unconfigured.
    Extracts high-relevance paragraphs directly from retrieved document chunks with clean markdown.
    """
    if not retrieved_chunks:
        return "I couldn't find any relevant documents in your organization to answer your question."

    paragraphs = []
    for c in retrieved_chunks[:3]:
        doc_title = c.get('document_title', 'Document')
        page_num = c.get('page_number')
        page_str = f" (Page {page_num})" if page_num else ""
        text = c.get('chunk_text', '').strip()
        if text:
            # Highlight matching snippets
            paragraphs.append(f"### 📄 **{doc_title}**{page_str}\n\n{text}")

    if not paragraphs:
        return "I couldn't find relevant content in your documents matching your question."

    return (
        f"**Relevant Document Insights:**\n\n"
        + "\n\n---\n\n".join(paragraphs)
    )


def generate_answer(
        question: str,
        retrieved_chunks: List[Dict[str, Any]],
        history: List[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Generate an answer to a question using retrieved document chunks.
    Routes to Groq, Gemini, OpenAI, or Ollama, with extractive fallback.
    """
    if not retrieved_chunks:
        return {
            'answer': "I couldn't find any relevant documents to answer your question. "
                      "Please upload relevant files to the knowledge base.",
            'answered': False,
        }

    prompt, context = _build_context_and_prompt(question, retrieved_chunks, history=history)
    if not prompt:
        return {
            'answer': "I couldn't find any relevant information in your documents.",
            'answered': False,
        }

    provider = get_active_provider()
    system_prompt = COMPARATIVE_SYSTEM_PROMPT if _is_comparative_query(question, retrieved_chunks) else SYSTEM_PROMPT
    logger.info(f"RAG: Generating answer via provider '{provider}' (comparative={system_prompt is COMPARATIVE_SYSTEM_PROMPT})")

    try:
        if provider == 'groq':
            answer = _call_groq(prompt, system_prompt)
        elif provider == 'gemini':
            answer = _call_gemini(prompt, system_prompt)
        elif provider == 'openai':
            answer = _call_openai(prompt, system_prompt)
        else:
            try:
                answer = _call_ollama(prompt, system_prompt)
            except Exception:
                logger.info("Ollama is offline; using extractive synthesis fallback.")
                answer = _extractive_answer_from_chunks(question, retrieved_chunks)

        if not answer:
            answer = _extractive_answer_from_chunks(question, retrieved_chunks)

        could_not_answer = (
            "couldn't find" in answer.lower() or
            "cannot find" in answer.lower()
        )

        return {
            'answer': answer,
            'answered': not could_not_answer,
            'provider': provider,
        }

    except Exception as e:
        logger.warning(f"RAG provider error ({provider}): {e}. Using extractive fallback.")
        fallback_ans = _extractive_answer_from_chunks(question, retrieved_chunks)
        return {
            'answer': fallback_ans,
            'answered': True,
            'provider': 'extractive_fallback',
        }


def generate_answer_stream(
        question: str,
        retrieved_chunks: List[Dict[str, Any]],
        history: List[Dict[str, str]] = None,
) -> Generator[Tuple[str, bool], None, None]:
    """
    Stream answer tokens from Groq, Gemini, OpenAI, or Ollama with instant extractive fallback.
    Yields: (token_str, done_bool)
    """
    if not retrieved_chunks:
        yield "I couldn't find any relevant documents to answer your question.", True
        return

    prompt, context = _build_context_and_prompt(question, retrieved_chunks, history=history)
    if not prompt:
        yield "I couldn't find any relevant information in your documents.", True
        return

    provider = get_active_provider()
    system_prompt = COMPARATIVE_SYSTEM_PROMPT if _is_comparative_query(question, retrieved_chunks) else SYSTEM_PROMPT
    logger.info(f"RAG: Streaming answer via provider '{provider}' (comparative={system_prompt is COMPARATIVE_SYSTEM_PROMPT})")

    try:
        if provider == 'groq':
            yield from _stream_groq(prompt, system_prompt)
        elif provider == 'gemini':
            yield from _stream_gemini(prompt, system_prompt)
        elif provider == 'openai':
            yield from _stream_openai(prompt, system_prompt)
        else:
            try:
                yield from _stream_ollama(prompt, system_prompt)
            except Exception:
                logger.info("Ollama is offline; streaming extractive fallback.")
                fallback_ans = _extractive_answer_from_chunks(question, retrieved_chunks)
                words = fallback_ans.split(' ')
                for i, w in enumerate(words):
                    tok = w if i == len(words) - 1 else w + ' '
                    yield tok, (i == len(words) - 1)
    except Exception as e:
        logger.warning(f"RAG provider error ({provider}): {e}. Streaming extractive fallback.")
        fallback_ans = _extractive_answer_from_chunks(question, retrieved_chunks)
        words = fallback_ans.split(' ')
        for i, w in enumerate(words):
            tok = w if i == len(words) - 1 else w + ' '
            yield tok, (i == len(words) - 1)


# ==============================================================================
# 1. Groq Cloud API Implementation (OpenAI-compatible ultra-fast inference)
# ==============================================================================

GROQ_CANDIDATE_MODELS = [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
]


def _call_groq(prompt: str, system_prompt: str, max_tokens: int = 1024) -> str:
    api_key = getattr(settings, 'GROQ_API_KEY', '').strip()
    preferred_model = getattr(settings, 'GROQ_MODEL', 'openai/gpt-oss-120b')
    url = "https://api.groq.com/openai/v1/chat/completions"
    models_to_try = [preferred_model] + [m for m in GROQ_CANDIDATE_MODELS if m != preferred_model]
    last_err = None

    for model in models_to_try:
        try:
            response = httpx.post(
                url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.2,
                    "max_tokens": max_tokens,
                    "stream": False,
                },
                timeout=6.0,
            )
            if response.status_code == 200:
                data = response.json()
                return data["choices"][0]["message"]["content"].strip()
            if response.status_code == 429:
                last_err = f"HTTP 429 Rate limited: {response.text[:120]}"
                # Quota on this key is temporarily exhausted, immediately fallback to Gemini
                break
            last_err = f"HTTP {response.status_code}: {response.text[:120]}"
        except Exception as e:
            last_err = str(e)

    raise ValueError(f"All Groq models failed. Last error: {last_err}")


def _stream_groq(prompt: str, system_prompt: str) -> Generator[Tuple[str, bool], None, None]:
    api_key = getattr(settings, 'GROQ_API_KEY', '').strip()
    model = getattr(settings, 'GROQ_MODEL', 'openai/gpt-oss-120b')
    url = "https://api.groq.com/openai/v1/chat/completions"

    with httpx.stream(
        "POST",
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 1024,
            "stream": True,
        },
        timeout=15.0,
    ) as response:
        response.raise_for_status()
        for line in response.iter_lines():
            line = line.strip()
            if not line or line.startswith(":") or line == "data: [DONE]":
                if line == "data: [DONE]":
                    yield "", True
                continue
            if line.startswith("data: "):
                try:
                    payload = json.loads(line[6:])
                    delta = payload.get("choices", [{}])[0].get("delta", {}).get("content", "")
                    finish_reason = payload.get("choices", [{}])[0].get("finish_reason")
                    is_done = finish_reason is not None
                    if delta or is_done:
                        yield _clean_token(delta), is_done
                except Exception:
                    pass


# ==============================================================================
# 2. Google Gemini API Implementation
# ==============================================================================

GEMINI_CANDIDATE_MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
]


def _call_gemini(prompt: str, system_prompt: str, max_tokens: int = 1200) -> str:
    api_key = getattr(settings, 'GEMINI_API_KEY', '').strip()
    preferred_model = getattr(settings, 'GEMINI_MODEL', 'gemini-3.5-flash-lite')
    if preferred_model not in GEMINI_CANDIDATE_MODELS:
        preferred_model = 'gemini-3.5-flash-lite'
    
    models_to_try = [preferred_model] + [m for m in GEMINI_CANDIDATE_MODELS if m != preferred_model]
    last_error = None

    for model in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": max_tokens,
            },
        }
        try:
            response = httpx.post(url, json=payload, timeout=6.0)
            if response.status_code == 200:
                data = response.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        return parts[0].get("text", "").strip()
                return ""
            else:
                last_error = f"HTTP {response.status_code}: {response.text[:120]}"
        except Exception as e:
            last_error = str(e)

    raise ValueError(f"All Gemini models failed. Last error: {last_error}")


def _stream_gemini(prompt: str, system_prompt: str) -> Generator[Tuple[str, bool], None, None]:
    api_key = getattr(settings, 'GEMINI_API_KEY', '').strip()
    preferred_model = getattr(settings, 'GEMINI_MODEL', 'gemini-3.5-flash-lite')
    if preferred_model not in GEMINI_CANDIDATE_MODELS:
        preferred_model = 'gemini-3.5-flash-lite'
    
    models_to_try = [preferred_model] + [m for m in GEMINI_CANDIDATE_MODELS if m != preferred_model]
    last_error = None
    stream_started = False

    for model in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={api_key}"
        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 4096,
            },
        }
        try:
            with httpx.stream("POST", url, json=payload, timeout=30.0) as response:
                if response.status_code != 200:
                    last_error = f"HTTP {response.status_code}"
                    continue

                for line in response.iter_lines():
                    line = line.strip()
                    if line.startswith("data: "):
                        try:
                            chunk_data = json.loads(line[6:])
                            candidates = chunk_data.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                text = parts[0].get("text", "") if parts else ""
                                finish = candidates[0].get("finishReason")
                                is_done = finish is not None and finish != ""
                                if text or is_done:
                                    stream_started = True
                                    yield text, is_done
                        except Exception:
                            pass

                if stream_started:
                    return
        except Exception as e:
            last_error = str(e)

    if not stream_started:
        raise ValueError(f"Gemini streaming failed on all models. Last error: {last_error}")


# ==============================================================================
# 3. OpenAI / Custom vLLM / TGI Implementation
# ==============================================================================

def _call_openai(prompt: str, system_prompt: str) -> str:
    api_key = getattr(settings, 'OPENAI_API_KEY', '').strip()
    model = getattr(settings, 'OPENAI_MODEL', 'gpt-4o-mini')
    base_url = getattr(settings, 'OPENAI_BASE_URL', 'https://api.openai.com/v1').rstrip('/')
    url = f"{base_url}/chat/completions"

    response = httpx.post(
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 4096,
            "stream": False,
        },
        timeout=60.0,
    )
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"].strip()


def _stream_openai(prompt: str, system_prompt: str) -> Generator[Tuple[str, bool], None, None]:
    api_key = getattr(settings, 'OPENAI_API_KEY', '').strip()
    model = getattr(settings, 'OPENAI_MODEL', 'gpt-4o-mini')
    base_url = getattr(settings, 'OPENAI_BASE_URL', 'https://api.openai.com/v1').rstrip('/')
    url = f"{base_url}/chat/completions"

    with httpx.stream(
        "POST",
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 4096,
            "stream": True,
        },
        timeout=60.0,
    ) as response:
        response.raise_for_status()
        for line in response.iter_lines():
            line = line.strip()
            if not line or line == "data: [DONE]":
                if line == "data: [DONE]":
                    yield "", True
                continue
            if line.startswith("data: "):
                try:
                    payload = json.loads(line[6:])
                    delta = payload.get("choices", [{}])[0].get("delta", {}).get("content", "")
                    finish_reason = payload.get("choices", [{}])[0].get("finish_reason")
                    is_done = finish_reason is not None
                    if delta or is_done:
                        yield _clean_token(delta), is_done
                except Exception:
                    pass


# ==============================================================================
# 4. Local Ollama Implementation (Fallback)
# ==============================================================================

def _call_ollama(prompt: str, system_prompt: str) -> str:
    ollama_url = f"{settings.OLLAMA_BASE_URL}/api/generate"
    model_name = settings.OLLAMA_MODEL

    response = httpx.post(
        ollama_url,
        json={
            'model': model_name,
            'system': system_prompt,
            'prompt': prompt,
            'stream': False,
            'options': {
                'temperature': 0.2,
                'num_predict': 4096,
                'top_p': 0.9,
                'repeat_penalty': 1.2,
                'repeat_last_n': 64,
                'num_ctx': 4096,
            },
        },
        timeout=httpx.Timeout(15.0, connect=1.5),
    )
    response.raise_for_status()
    data = response.json()
    return data.get('response', '').strip()


def _stream_ollama(prompt: str, system_prompt: str) -> Generator[Tuple[str, bool], None, None]:
    ollama_url = f"{settings.OLLAMA_BASE_URL}/api/generate"
    model_name = settings.OLLAMA_MODEL

    with httpx.stream(
        "POST",
        ollama_url,
        json={
            'model': model_name,
            'system': system_prompt,
            'prompt': prompt,
            'stream': True,
            'options': {
                'temperature': 0.2,
                'num_predict': 4096,
                'top_p': 0.9,
                'repeat_penalty': 1.2,
                'repeat_last_n': 64,
                'num_ctx': 4096,
            },
        },
        timeout=httpx.Timeout(15.0, connect=1.5),
    ) as response:
        response.raise_for_status()
        for line in response.iter_lines():
            if line:
                data = json.loads(line)
                yield data.get('response', ''), data.get('done', False)
