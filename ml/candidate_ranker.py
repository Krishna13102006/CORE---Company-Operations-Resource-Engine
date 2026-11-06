"""
candidate_ranker.py

XGBoost-based candidate ranking for job postings.

Given a job posting and its pool of candidates, ranks candidates by their
predicted likelihood of being a good hire, based on:
  - Semantic match score (Phase 4 computed)
  - Skill match percentage
  - Number of matched vs missing skills
  - Whether a resume was processed
  - Interview note scores (if any)
  - Number of interview notes (signal of engagement)

Training data: past applications from the same org where the outcome
is known (stage = hired or rejected). The model learns what combination
of features correlates with hiring decisions in this specific org.

Minimum training samples: 10 resolved applications (hired + rejected).
If fewer exist, returns a simple match_score ranking as fallback.

Model: XGBClassifier (binary classification: hired=1, rejected=0)
Output: probability score 0.0-1.0 for each candidate
"""

from typing import List, Dict, Any


def rank_candidates(
        org_id: str,
        job_id: str,
        candidate_applications: list,
) -> List[Dict[str, Any]]:
    """
    Rank candidates for a job posting by predicted hire probability.

    Args:
        org_id:                  String UUID of the organisation
        job_id:                  String UUID of the job posting
        candidate_applications:  List of Application model instances
                                 for this job (any stage except hired/rejected)

    Returns:
        List of dicts sorted by rank_score descending:
        [
            {
                'application_id': str,
                'candidate_name': str,
                'rank_score':     float,   # 0.0-1.0 predicted hire probability
                'rank_label':     str,     # 'Strong', 'Good', 'Fair', 'Weak'
                'model_used':     str,     # 'xgboost' or 'fallback'
                'features': {
                    'match_score':     float,
                    'skill_match_pct': int,
                    'interview_avg':   float,
                },
            },
            ...
        ]
    """
    if not candidate_applications:
        return []

    import numpy as np
    from hiring.models import Application

    # ── Build training data from resolved applications in this org ────────
    resolved = Application.objects.filter(
        org_id=org_id,
        is_deleted=False,
        stage__in=['hired', 'rejected'],
    ).select_related('candidate').prefetch_related('interview_notes')

    training_features = []
    training_labels   = []

    for app in resolved:
        features = _extract_application_features(app)
        if features is not None:
            training_features.append(features)
            training_labels.append(1 if app.stage == 'hired' else 0)

    # ── Score the active candidates ───────────────────────────────────────
    results = []
    for app in candidate_applications:
        features = _extract_application_features(app)
        if features is None:
            features = [0.0, 0, 0, 0, 0.0, 0]

        rank_score = None
        model_used = 'fallback'

        # Use XGBoost only if we have enough training data
        if len(training_features) >= 10:
            try:
                rank_score = _predict_with_xgboost(
                    training_features, training_labels, features
                )
                model_used = 'xgboost'
            except Exception:
                rank_score = None

        # Fallback: use match_score directly
        if rank_score is None:
            rank_score = float(app.match_score or 0.0)
            model_used = 'fallback'

        rank_label = _score_to_label(rank_score)

        interview_scores = [n.score for n in app.interview_notes.all() if n.score]
        interview_avg    = float(np.mean(interview_scores)) if interview_scores else 0.0

        results.append({
            'application_id': str(app.id),
            'candidate_name': app.candidate.get_full_name(),
            'rank_score':     round(rank_score, 4),
            'rank_label':     rank_label,
            'model_used':     model_used,
            'features': {
                'match_score':     round(float(app.match_score or 0.0), 3),
                'skill_match_pct': len(app.matched_skills or []),
                'interview_avg':   round(interview_avg, 2),
            },
            'insufficient_data': model_used == 'fallback' and len(training_features) < 10,
            'training_samples':  len(training_features),
        })

    results.sort(key=lambda x: x['rank_score'], reverse=True)
    return results


def _extract_application_features(app) -> list:
    """Extract feature vector from an Application instance."""
    try:
        import numpy as np
        candidate = app.candidate

        match_score    = float(app.match_score or 0.0)
        matched_count  = len(app.matched_skills or [])
        missing_count  = len(app.missing_skills or [])
        skills_count   = len(candidate.parsed_skills or [])
        resume_done    = int(candidate.resume_processed or False)

        interview_scores = [n.score for n in app.interview_notes.all() if n.score]
        interview_avg    = float(np.mean(interview_scores)) if interview_scores else 0.0
        interview_count  = len(interview_scores)

        return [
            match_score,
            matched_count,
            missing_count,
            skills_count,
            interview_avg,
            interview_count,
            resume_done,
        ]
    except Exception:
        return None


def _predict_with_xgboost(
        training_features: list,
        training_labels: list,
        target_features: list,
) -> float:
    """Train an XGBoost model on resolved applications and predict for target."""
    import numpy as np
    from xgboost import XGBClassifier

    X_train = np.array(training_features, dtype=float)
    y_train = np.array(training_labels,   dtype=int)
    X_pred  = np.array([target_features], dtype=float)

    # Handle class imbalance — hired candidates are typically fewer than rejected
    n_pos = int(y_train.sum())
    n_neg = len(y_train) - n_pos
    scale_pos_weight = n_neg / n_pos if n_pos > 0 else 1.0

    model = XGBClassifier(
        n_estimators=50,
        max_depth=3,
        learning_rate=0.1,
        scale_pos_weight=scale_pos_weight,
        use_label_encoder=False,
        eval_metric='logloss',
        verbosity=0,
        random_state=42,
    )
    model.fit(X_train, y_train)

    probability = model.predict_proba(X_pred)[0][1]  # probability of class 1 (hired)
    return float(probability)


def _score_to_label(score: float) -> str:
    if score >= 0.75: return 'Strong'
    if score >= 0.50: return 'Good'
    if score >= 0.25: return 'Fair'
    return 'Weak'
