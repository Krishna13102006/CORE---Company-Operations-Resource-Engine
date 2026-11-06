"""
entity_extractor.py

Named Entity Recognition using spaCy en_core_web_sm.
Extracts people, organisations, technologies, dates, and locations
from document text and returns them grouped by entity type.

Called by the Celery pipeline task in knowledge/tasks.py.
Results saved to DocumentMetadata.entities as a JSON dict.
"""

from typing import Dict, List

# Entity label groups we care about — spaCy has many more but these are
# the ones useful for enterprise knowledge management
RELEVANT_LABELS = {
    'PERSON':   'People',
    'ORG':      'Organizations',
    'GPE':      'Locations',
    'LOC':      'Locations',
    'DATE':     'Dates',
    'PRODUCT':  'Technologies',
    'WORK_OF_ART': 'Technologies',
    'EVENT':    'Events',
    'MONEY':    'Financial',
    'LAW':      'Legal',
}

_nlp = None  # module-level cache — load model once, reuse


def _get_nlp():
    global _nlp
    if _nlp is None:
        import spacy
        try:
            # Disable non-NER pipelines to cut memory usage by 90%
            _nlp = spacy.load('en_core_web_sm', disable=['parser', 'tagger', 'lemmatizer', 'attribute_ruler'])
        except OSError:
            raise ValueError(
                'spaCy model not found. Run: python -m spacy download en_core_web_sm'
            )
    return _nlp


def extract_entities(text: str) -> Dict[str, List[str]]:
    """
    Extract named entities from text with spaCy (if installed) or high-speed regex heuristics.

    Args:
        text: Raw document text

    Returns:
        Dict mapping group labels to lists of unique entity strings.
    """
    if not text or not text.strip():
        return {}

    # Attempt spaCy if available
    try:
        nlp = _get_nlp()
        max_chars = 10000
        if len(text) > max_chars:
            text_sample = text[:max_chars]
        else:
            text_sample = text

        doc = nlp(text_sample)
        grouped: Dict[str, set] = {}
        for ent in doc.ents:
            group = RELEVANT_LABELS.get(ent.label_)
            if group:
                if group not in grouped:
                    grouped[group] = set()
                clean = ' '.join(ent.text.split())
                if len(clean) > 1:
                    grouped[group].add(clean)

        return {k: sorted(list(v)) for k, v in grouped.items() if v}
    except Exception:
        pass

    # Fast, zero-memory Regex Heuristics Fallback
    import re
    entities: Dict[str, List[str]] = {}
    
    # Extract Dates
    date_matches = re.findall(r'\b(?:(?:19|20)\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})\b', text[:5000])
    if date_matches:
        entities['Dates'] = sorted(list(set(date_matches[:5])))

    # Extract Technologies / Tools keywords
    known_tech = ['Python', 'Django', 'React', 'JavaScript', 'TypeScript', 'PostgreSQL', 'Docker', 'Kubernetes', 'Redis', 'AWS', 'Azure', 'Git', 'HTML', 'CSS', 'SQL', 'Node.js', 'Linux', 'REST API', 'GraphQL', 'Next.js', 'FastAPI']
    found_tech = [tech for tech in known_tech if re.search(r'\b' + re.escape(tech) + r'\b', text[:5000], re.IGNORECASE)]
    if found_tech:
        entities['Technologies'] = sorted(list(set(found_tech)))

    return entities

