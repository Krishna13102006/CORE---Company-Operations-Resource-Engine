"""
svm_classifier.py

Document category classification using TF-IDF + SVM.

In Phase 3 this is a RULE-BASED classifier using keyword heuristics,
not a trained ML model. A trained SVM requires labelled training data
which does not yet exist (the system is new).

The classifier uses keyword matching against category keyword lists.
This gives reasonable category predictions without needing training data.
In Phase 6, once enough labelled documents exist, this is replaced with
a real trained SVM (sklearn Pipeline: TfidfVectorizer + LinearSVC).

Categories: Engineering, Finance, Legal, HR, Marketing, Operations
"""

CATEGORY_KEYWORDS = {
    'Engineering': [
        'code', 'software', 'api', 'database', 'server', 'deploy', 'docker',
        'kubernetes', 'git', 'python', 'javascript', 'architecture', 'system',
        'backend', 'frontend', 'devops', 'cloud', 'aws', 'azure', 'testing',
        'bug', 'feature', 'sprint', 'agile', 'ci', 'cd', 'pipeline', 'microservice',
    ],
    'Finance': [
        'budget', 'revenue', 'expense', 'profit', 'loss', 'financial', 'invoice',
        'payment', 'cost', 'tax', 'accounting', 'forecast', 'quarterly', 'annual',
        'investment', 'capital', 'cashflow', 'balance', 'sheet', 'income',
    ],
    'Legal': [
        'contract', 'agreement', 'clause', 'terms', 'conditions', 'legal',
        'liability', 'compliance', 'regulation', 'policy', 'law', 'gdpr',
        'privacy', 'intellectual', 'property', 'copyright', 'trademark', 'nda',
    ],
    'HR': [
        'employee', 'hire', 'onboarding', 'performance', 'review', 'salary',
        'benefits', 'leave', 'vacation', 'policy', 'conduct', 'training',
        'recruitment', 'interview', 'job', 'role', 'team', 'culture', 'hr',
    ],
    'Marketing': [
        'marketing', 'campaign', 'brand', 'customer', 'market', 'sales',
        'advertising', 'content', 'social', 'media', 'seo', 'analytics',
        'conversion', 'funnel', 'audience', 'engagement', 'growth',
    ],
    'Operations': [
        'process', 'workflow', 'procedure', 'operations', 'supply', 'chain',
        'vendor', 'logistics', 'inventory', 'quality', 'incident', 'sla',
        'support', 'maintenance', 'infrastructure', 'facility',
    ],
}


def classify_document(text: str) -> str:
    """
    Classify a document into a category using keyword heuristics.

    Args:
        text: Raw document text

    Returns:
        Category string ('Engineering', 'Finance', etc.)
        Returns '' if no category is confidently matched.
    """
    # Limit text classification scan to the first 10,000 characters
    # (more than enough to confidently determine category from intro/headers)
    text_lower = text[:10000].lower()
    scores = {}

    for category, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > 0:
            scores[category] = score

    if not scores:
        return ''

    best_category = max(scores, key=scores.get)
    best_score    = scores[best_category]
    total_words   = len(text_lower.split())

    # Require at least 2 keyword matches to make a classification
    # to avoid miscategorising documents with one accidental match
    if best_score < 2:
        return ''

    return best_category
