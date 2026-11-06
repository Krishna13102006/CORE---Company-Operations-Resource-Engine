"""
chunker.py

Splits raw document text into overlapping chunks for embedding.

Chunk strategy:
  - Size: 500 tokens (approx 375 words)
  - Overlap: 50 tokens between consecutive chunks
  - Splitter: RecursiveCharacterTextSplitter — tries paragraph breaks first,
    then sentence breaks, then word breaks, to maximise semantic coherence

Why these values:
  - 500 tokens is small enough to match specific questions in semantic search
    but large enough to contain a complete thought
  - 50-token overlap prevents answers from being cut off at chunk boundaries
  - RecursiveCharacterTextSplitter preserves document structure better than
    a naive character-count split

Phase 3 will embed each chunk using sentence-transformers and store the
vectors in Qdrant. This module has no knowledge of embeddings or Qdrant.
"""

from typing import List, Dict

CHUNK_SIZE    = 500  # target size in tokens (approximated as characters / 4)
CHUNK_OVERLAP = 50   # overlap in tokens

# Convert token counts to approximate character counts
# Average English token ≈ 4 characters
CHUNK_SIZE_CHARS    = CHUNK_SIZE    * 4   # 2000 characters
CHUNK_OVERLAP_CHARS = CHUNK_OVERLAP * 4   # 200 characters


def chunk_text(raw_text: str, chunk_size_tokens: int = CHUNK_SIZE, overlap_tokens: int = CHUNK_OVERLAP, **kwargs) -> List[Dict]:
    """
    Split raw text into overlapping chunks.
    """
    if not raw_text or not raw_text.strip():
        return []

    chunks = []
    try:
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        chunk_size_chars = chunk_size_tokens * 4
        overlap_chars = overlap_tokens * 4
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size_chars,
            chunk_overlap=overlap_chars,
            length_function=len,
            separators=['\n\n', '\n', '. ', ' ', ''],
        )
        chunks = splitter.split_text(raw_text)
    except ImportError:
        # Resilient pure-python chunker fallback
        max_chars = chunk_size_tokens * 4
        overlap = overlap_tokens * 4
        step = max(1, max_chars - overlap)
        paragraphs = raw_text.split('\n\n')
        current_chunk = ""
        for p in paragraphs:
            p_clean = p.strip()
            if not p_clean:
                continue
            if len(current_chunk) + len(p_clean) + 2 <= max_chars:
                current_chunk = f"{current_chunk}\n\n{p_clean}" if current_chunk else p_clean
            else:
                if current_chunk:
                    chunks.append(current_chunk)
                if len(p_clean) > max_chars:
                    for i in range(0, len(p_clean), step):
                        sub = p_clean[i:i+max_chars].strip()
                        if sub:
                            chunks.append(sub)
                    current_chunk = ""
                else:
                    current_chunk = p_clean
        if current_chunk:
            chunks.append(current_chunk)


    result = []
    for index, chunk in enumerate(chunks):
        cleaned = chunk.strip()
        if not cleaned:
            continue
        result.append({
            'chunk_index': index,
            'chunk_text':  cleaned,
            'token_count': max(1, len(cleaned) // 4),  # approximate
        })

    return result


def chunk_text_by_pages(pages: List[Dict], chunk_size_tokens: int = CHUNK_SIZE, overlap_tokens: int = CHUNK_OVERLAP, **kwargs) -> List[Dict]:
    """
    Split page-by-page text list into overlapping chunks, maintaining page references.
    """
    if not pages:
        return []

    result = []
    chunk_index = 0
    for page_info in pages:
        page_num = page_info.get('page_number', 1)
        page_text = page_info.get('text', '')

        if not page_text or not page_text.strip():
            continue

        page_chunks = chunk_text(page_text, chunk_size_tokens=chunk_size_tokens, overlap_tokens=overlap_tokens)
        for pc in page_chunks:
            result.append({
                'chunk_index': chunk_index,
                'chunk_text':  pc['chunk_text'],
                'token_count': pc['token_count'],
                'page_number': page_num,
            })
            chunk_index += 1

    return result
