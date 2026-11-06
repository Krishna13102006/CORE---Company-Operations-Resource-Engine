"""
resume_parser.py

Extracts structured information from raw resume text.
Returns skills, experience summaries, education, and candidate name.

This uses rule-based extraction with keyword matching — not a trained ML model.
It is intentionally simple and robust rather than sophisticated and fragile.
The goal is to extract enough structure for skill matching and display,
not to perfectly parse every resume format.

Phase 6 could replace this with a trained NER model if needed.
"""

import re
from typing import Dict, List


# Common technical and soft skills vocabulary
# Expand this list as needed for your user base
KNOWN_SKILLS = [
    # Programming languages
    'python', 'javascript', 'typescript', 'java', 'c++', 'c#', 'go', 'rust',
    'ruby', 'php', 'swift', 'kotlin', 'scala', 'r', 'matlab',
    # Web / frontend
    'react', 'vue', 'angular', 'html', 'css', 'sass', 'webpack', 'nextjs',
    'django', 'flask', 'fastapi', 'nodejs', 'express', 'graphql', 'rest',
    # Data / ML
    'machine learning', 'deep learning', 'nlp', 'pandas', 'numpy', 'tensorflow',
    'pytorch', 'scikit-learn', 'sql', 'nosql', 'spark', 'hadoop', 'tableau',
    # Databases
    'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'cassandra',
    'sqlite', 'oracle', 'dynamodb',
    # Cloud / DevOps
    'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'ansible',
    'jenkins', 'github actions', 'ci/cd', 'linux', 'nginx', 'apache',
    # Soft skills
    'leadership', 'communication', 'teamwork', 'problem solving', 'agile',
    'scrum', 'project management', 'mentoring', 'public speaking',
    # Domain
    'api design', 'system design', 'microservices', 'testing', 'tdd',
    'code review', 'git', 'jira', 'product management', 'data analysis',
]

# Section header patterns to identify resume sections
SECTION_PATTERNS = {
    'experience': [
        r'(?i)(work\s+)?experience', r'(?i)employment', r'(?i)work\s+history',
        r'(?i)professional\s+background', r'(?i)career\s+history',
    ],
    'education': [
        r'(?i)education', r'(?i)academic', r'(?i)qualification',
        r'(?i)degree', r'(?i)university', r'(?i)college',
    ],
    'skills': [
        r'(?i)skills?', r'(?i)technical\s+skills?', r'(?i)competenc',
        r'(?i)technologies', r'(?i)tools?', r'(?i)expertise',
    ],
    'projects': [
        r'(?i)projects?', r'(?i)personal\s+projects?', r'(?i)side\s+projects?',
        r'(?i)portfolio', r'(?i)notable\s+work', r'(?i)open\s+source',
    ],
}


def parse_resume(raw_text: str) -> Dict:
    """
    Parse raw resume text and extract structured fields.

    Args:
        raw_text: Full text content of the resume

    Returns:
        Dict with keys:
            'skills':      List[str] — extracted skill strings
            'experience':  List[str] — experience bullet points / summaries
            'education':   List[str] — education entries
            'name':        str       — candidate name (best guess from first line)
    """
    if not raw_text or not raw_text.strip():
        return {'skills': [], 'experience': [], 'education': [], 'projects': [], 'name': ''}

    lines = [line.strip() for line in raw_text.split('\n') if line.strip()]

    return {
        'name':       _extract_name(lines),
        'skills':     _extract_skills(raw_text),
        'experience': _extract_section(lines, 'experience'),
        'education':  _extract_section(lines, 'education'),
        'projects':   _extract_section(lines, 'projects'),
    }


def _extract_name(lines: List[str]) -> str:
    """
    Extract candidate name from the top of the resume.
    Strategy: first non-empty line that looks like a name
    (2-4 words, mostly letters, no numbers or special chars, not a list of skills).
    """
    for line in lines[:5]:  # check only the first 5 lines
        # Remove common non-name prefixes
        cleaned = re.sub(r'(?i)(resume|cv|curriculum\s+vitae):?\s*', '', line).strip()
        words = cleaned.split()
        if 2 <= len(words) <= 4:
            if all(re.match(r"^[A-Za-z\-'\.]+$", w) for w in words):
                # Ensure it's not a list of skills / tech keywords
                if not any(w.lower() in KNOWN_SKILLS for w in words):
                    return cleaned
    return ''


def _extract_skills(text: str) -> List[str]:
    """
    Find known skills in the resume text using case-insensitive matching.
    Returns deduplicated list sorted alphabetically.
    """
    text_lower = text.lower()
    found = set()
    for skill in KNOWN_SKILLS:
        # Use word boundary matching to avoid partial matches
        pattern = r'\b' + re.escape(skill) + r'\b'
        if re.search(pattern, text_lower):
            found.add(skill)
    return sorted(list(found))


def _extract_section(lines: List[str], section_type: str) -> List[str]:
    """
    Extract content from a named section of the resume.
    Looks for section headers matching the section_type patterns,
    then collects lines until the next section header.
    Returns up to 8 content lines from the section.
    """
    patterns = SECTION_PATTERNS.get(section_type, [])
    if not patterns:
        return []

    section_start = -1
    for i, line in enumerate(lines):
        for pattern in patterns:
            if re.match(pattern, line) and len(line) < 60:
                section_start = i
                break
        if section_start != -1:
            break

    if section_start == -1:
        return []

    # Collect lines until the next section header
    content = []
    all_header_patterns = [p for patterns_list in SECTION_PATTERNS.values() for p in patterns_list]

    for line in lines[section_start + 1:]:
        # Stop at next section header
        is_header = any(
            re.match(p, line) and len(line) < 60
            for p in all_header_patterns
        )
        if is_header:
            break
        if len(line) > 10:  # skip very short lines (dates, single words)
            content.append(line)
        if len(content) >= 8:
            break

    return content


def extract_required_skills_from_job(requirements_text: str) -> List[str]:
    """
    Extract required skills from a job posting's requirements text.
    Extracts both from KNOWN_SKILLS vocabulary and explicit comma/bullet lists.

    Args:
        requirements_text: The job's requirements/description text

    Returns:
        List of skill strings found in the job requirements
    """
    if not requirements_text or not requirements_text.strip():
        return []

    found = set(_extract_skills(requirements_text))

    # Also parse explicit comma-separated / bulleted / newline skill items
    tokens = re.split(r'[,;\n•\-\|\/]+', requirements_text)
    for token in tokens:
        clean = token.strip().lower()
        # Clean prefix phrases
        clean = re.sub(
            r'^(?:proficien(?:cy|t)\s+in|experience\s+with|knowledge\s+of|strong\s+understanding\s+of|familiarity\s+with|hands-on\s+experience\s+with|solid\s+background\s+in)\s+',
            '',
            clean
        ).strip()
        if clean and clean in KNOWN_SKILLS:
            found.add(clean)

    return sorted(list(found))


def compute_skill_match(
        candidate_skills: List[str],
        required_skills: List[str],
) -> Dict:
    """
    Compare candidate skills against required job skills.

    Args:
        candidate_skills: Skills extracted from the resume
        required_skills:  Skills extracted from the job requirements

    Returns:
        Dict with:
            'matched_skills': List[str] — skills in both candidate and job
            'missing_skills': List[str] — required skills not in candidate
            'match_percentage': int     — percentage of required skills matched
    """
    if not required_skills:
        return {
            'matched_skills':   candidate_skills,
            'missing_skills':   [],
            'match_percentage': 100,
        }

    candidate_set = set(s.lower() for s in candidate_skills)
    required_set  = set(s.lower() for s in required_skills)

    matched = sorted(list(candidate_set & required_set))
    missing = sorted(list(required_set - candidate_set))

    percentage = int(round((len(matched) / len(required_set)) * 100)) if required_set else 0

    return {
        'matched_skills':   matched,
        'missing_skills':   missing,
        'match_percentage': percentage,
    }

