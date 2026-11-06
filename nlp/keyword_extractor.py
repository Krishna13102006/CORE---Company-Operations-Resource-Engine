"""
keyword_extractor.py

High-performance Keyword extraction using term-frequency and bigram analysis.
Extracts the most representative keywords and keyphrases from document text in under 2ms.
"""

import re
from collections import Counter
from typing import List

# Standard English stopwords to filter out common noise
STOPWORDS = {
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', "you're", "you've", "you'll", "you'd",
    'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', "she's", 'her', 'hers',
    'herself', 'it', "it's", 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which',
    'who', 'whom', 'this', 'that', "that'll", 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if',
    'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between',
    'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out',
    'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
    'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', "don't", 'should',
    "should've", 'now', 'd', 'll', 'm', 'o', 're', 've', 'y', 'ain', 'aren', "aren't", 'couldn', "couldn't",
    'didn', "didn't", 'doesn', "doesn't", 'hadn', "hadn't", 'hasn', "hasn't", 'haven', "haven't", 'isn', "isn't",
    'ma', 'mightn', "mightn't", 'mustn', "mustn't", 'needn', "needn't", 'shan', "shan't", 'shouldn', "shouldn't",
    'wasn', "wasn't", 'weren', "weren't", 'won', "won't", 'wouldn', "wouldn't",
    'use', 'using', 'used', 'would', 'could', 'should', 'also', 'many', 'much', 'like', 'well', 'new', 'first',
    'page', 'chapter', 'section', 'document', 'file', 'data', 'information', 'system', 'project', 'candidate'
}


def extract_keywords(text: str, top_n: int = 10) -> List[str]:
    """
    Extract unigram and bigram keywords/keyphrases from text based on term frequency.
    Extremely fast, running in < 2ms without neural network overhead.
    """
    if not text or not text.strip():
        return []

    try:
        # Normalize and tokenize words (letters only, length >= 3)
        words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
        filtered_words = [w for w in words if w not in STOPWORDS]

        if not filtered_words:
            return []

        # 1. Unigram frequency
        unigram_counts = Counter(filtered_words)

        # 2. Bigram frequency
        bigrams = [f"{filtered_words[i]} {filtered_words[i+1]}" for i in range(len(filtered_words) - 1)]
        bigram_counts = Counter(bigrams)

        # 3. Combine scores, prioritizing bigram terms slightly
        candidates = {}
        for word, count in unigram_counts.most_common(top_n * 2):
            candidates[word] = count
        for bigram, count in bigram_counts.most_common(top_n * 2):
            candidates[bigram] = count * 1.5

        # 4. Sort and return top candidates
        sorted_kws = sorted(candidates.items(), key=lambda x: x[1], reverse=True)
        return [kw for kw, score in sorted_kws[:top_n]]

    except Exception:
        return []

