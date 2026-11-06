"""
project_risk_scorer.py

XGBoost-based project risk scoring.

Predicts which active projects are at risk of missing their deadline
or stalling, based on task velocity, overdue rate, and team signals.

Features:
  - Days until deadline (negative = already past)
  - Percentage of tasks completed
  - Percentage of tasks overdue
  - Percentage of tasks blocked
  - Total task count
  - Task completion velocity (tasks completed in last 7 days)
  - Number of unique assignees (larger teams have more coordination overhead)
  - Critical priority task count

Training data: completed projects (status=done) treated as on-time,
delayed/on_hold projects treated as at-risk. Minimum 5 resolved projects.
Falls back to a rule-based score if insufficient data.

Model: XGBClassifier (binary: at_risk=1, on_track=0)
Output: risk score 0.0-1.0 per active project
"""

from typing import List, Dict, Any


def score_project_risks(org_id: str) -> List[Dict[str, Any]]:
    """
    Score risk for all active projects in an organisation.

    Args:
        org_id: String UUID of the organisation

    Returns:
        List of dicts for all active projects, sorted by risk_score descending:
        [
            {
                'project_id':   str,
                'project_name': str,
                'risk_score':   float,  # 0.0-1.0
                'risk_level':   str,    # 'Critical', 'High', 'Medium', 'Low'
                'model_used':   str,
                'signals':      List[str],
                'metrics': {
                    'days_until_deadline': int,
                    'completion_pct':      int,
                    'overdue_pct':         int,
                    'blocked_count':       int,
                },
            },
            ...
        ]
    """
    from projects.models import Project, Task
    from django.utils import timezone

    today = timezone.now().date()

    active_projects = list(
        Project.objects.filter(
            org_id=org_id,
            is_deleted=False,
            status__in=['planning', 'active', 'on_hold'],
        ).prefetch_related('tasks')
    )

    if not active_projects:
        return []

    # ── Build training data from completed/stalled projects ───────────────
    resolved_projects = list(
        Project.objects.filter(
            org_id=org_id,
            is_deleted=False,
            status__in=['done', 'on_hold'],
        ).prefetch_related('tasks')
    )

    training_features = []
    training_labels   = []
    for proj in resolved_projects:
        features = _extract_project_features(proj, today)
        if features:
            training_features.append(features)
            training_labels.append(0 if proj.status == 'done' else 1)

    use_xgboost = len(resolved_projects) >= 5

    # ── Score active projects ─────────────────────────────────────────────
    results = []
    for proj in active_projects:
        features = _extract_project_features(proj, today)
        if not features:
            continue

        risk_score = None
        model_used = 'fallback'

        if use_xgboost and training_features:
            try:
                risk_score = _predict_with_xgboost(
                    training_features, training_labels, features
                )
                model_used = 'xgboost'
            except Exception:
                risk_score = None

        # Rule-based fallback
        if risk_score is None:
            risk_score = _rule_based_score(features)
            model_used = 'rule_based'

        risk_score = round(min(1.0, max(0.0, float(risk_score))), 4)
        risk_level = _score_to_level(risk_score)

        # Compute metrics for display
        all_tasks  = [t for t in proj.tasks.all() if not t.is_deleted]
        total      = len(all_tasks)
        done_tasks = [t for t in all_tasks if t.status == 'done']
        overdue    = [t for t in all_tasks if t.due_date and t.due_date < today and t.status != 'done']
        blocked    = [t for t in all_tasks if t.status == 'blocked']
        comp_pct   = int(len(done_tasks) / total * 100) if total > 0 else 0
        over_pct   = int(len(overdue) / total * 100) if total > 0 else 0

        days_until = None
        if proj.end_date:
            days_until = (proj.end_date - today).days

        signals = _identify_signals(features, days_until, risk_score)

        results.append({
            'project_id':   str(proj.id),
            'project_name': proj.name,
            'risk_score':   risk_score,
            'risk_level':   risk_level,
            'model_used':   model_used,
            'signals':      signals,
            'metrics': {
                'days_until_deadline': days_until,
                'completion_pct':      comp_pct,
                'overdue_pct':         over_pct,
                'blocked_count':       len(blocked),
            },
            'insufficient_data': not use_xgboost,
        })

    results.sort(key=lambda x: x['risk_score'], reverse=True)
    return results


def _extract_project_features(proj, today) -> list:
    """Extract feature vector from a Project instance."""
    try:
        from django.utils import timezone

        all_tasks = [t for t in proj.tasks.all() if not t.is_deleted]
        total     = len(all_tasks)
        if total == 0:
            return None

        done_tasks = [t for t in all_tasks if t.status == 'done']
        overdue    = [t for t in all_tasks if t.due_date and t.due_date < today and t.status != 'done']
        blocked    = [t for t in all_tasks if t.status == 'blocked']
        critical   = [t for t in all_tasks if t.priority == 'critical' and t.status != 'done']

        comp_pct = len(done_tasks) / total
        over_pct = len(overdue)    / total
        blk_pct  = len(blocked)    / total

        # Velocity: tasks completed in last 7 days
        seven_days_ago = timezone.now() - __import__('datetime').timedelta(days=7)
        velocity = sum(
            1 for t in done_tasks
            if t.updated_at >= seven_days_ago
        )

        # Unique assignees
        assignees = len(set(t.assignee_id for t in all_tasks if t.assignee_id))

        # Days until deadline
        days_until = 365  # default: no deadline = low urgency
        if proj.end_date:
            days_until = (proj.end_date - today).days

        return [
            days_until,
            round(comp_pct, 3),
            round(over_pct, 3),
            round(blk_pct, 3),
            total,
            velocity,
            assignees,
            len(critical),
        ]
    except Exception:
        return None


def _rule_based_score(features: list) -> float:
    """Simple rule-based risk score when insufficient training data exists."""
    days_until, comp_pct, over_pct, blk_pct, total, velocity, assignees, critical = features

    score = 0.0
    if days_until < 0:    score += 0.4   # past deadline
    elif days_until < 7:  score += 0.25  # within a week
    elif days_until < 30: score += 0.1   # within a month

    score += over_pct * 0.3   # overdue tasks contribute up to 30%
    score += blk_pct  * 0.2   # blocked tasks contribute up to 20%

    if velocity == 0 and comp_pct < 0.9:
        score += 0.15  # no recent progress

    return min(1.0, score)


def _predict_with_xgboost(
        training_features: list,
        training_labels: list,
        target_features: list,
) -> float:
    import numpy as np
    from xgboost import XGBClassifier

    X_train = np.array(training_features, dtype=float)
    y_train = np.array(training_labels,   dtype=int)
    X_pred  = np.array([target_features], dtype=float)

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
    return float(model.predict_proba(X_pred)[0][1])


def _score_to_level(score: float) -> str:
    if score >= 0.75: return 'Critical'
    if score >= 0.50: return 'High'
    if score >= 0.25: return 'Medium'
    return 'Low'


def _identify_signals(features: list, days_until, risk_score: float) -> list:
    _, comp_pct, over_pct, blk_pct, total, velocity, assignees, critical = features
    signals = []

    if days_until is not None and days_until < 0:
        signals.append(f'Past deadline by {abs(days_until)} days')
    elif days_until is not None and days_until < 7:
        signals.append(f'Deadline in {days_until} days')

    if over_pct > 0.3:
        signals.append(f'{int(over_pct * 100)}% of tasks overdue')
    if blk_pct > 0.2:
        signals.append(f'{int(blk_pct * 100)}% of tasks blocked')
    if velocity == 0 and comp_pct < 0.9:
        signals.append('No task completions in last 7 days')
    if critical > 0:
        signals.append(f'{critical} critical task{"s" if critical > 1 else ""} open')

    return signals[:3]
