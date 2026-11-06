"""
attrition_predictor.py

XGBoost-based employee attrition risk prediction.

Predicts which active employees are at elevated risk of leaving,
based on signals learned from employees who have left (employment_status=inactive).

Features used:
  - Tenure in days (longer tenure = lower risk generally)
  - Average performance review score (lower scores = higher risk)
  - Number of performance reviews (fewer = less engaged)
  - Approved leave requests in last 6 months (more = possible burnout signal)
  - Rejected leave requests (frustration signal)
  - Days since last review (longer gap = less attention)
  - Whether employee has a manager assigned
  - Whether employee has a department assigned

Training data: employees in this org who have become inactive (attrited)
vs employees who are still active. Minimum 5 attrited employees required.

If insufficient data exists, returns a simple tenure-based heuristic.

Model: XGBClassifier (binary: attrited=1, active=0)
Output: risk score 0.0-1.0 per active employee
"""

from typing import List, Dict, Any


def predict_attrition_risk(org_id: str) -> List[Dict[str, Any]]:
    """
    Predict attrition risk for all active employees in an organisation.

    Args:
        org_id: String UUID of the organisation

    Returns:
        List of dicts sorted by risk_score descending, top 20 only:
        [
            {
                'employee_id':   str,
                'employee_name': str,
                'department':    str,
                'risk_score':    float,   # 0.0-1.0
                'risk_level':    str,     # 'High', 'Medium', 'Low'
                'model_used':    str,     # 'xgboost' or 'fallback'
                'key_signals':   List[str],
            },
            ...
        ]
    """
    from teams.models import Employee

    active_employees = list(
        Employee.objects.filter(
            org_id=org_id,
            is_deleted=False,
            employment_status='active',
        ).select_related('user', 'department', 'manager')
        .prefetch_related('performance_reviews', 'leave_requests')
    )

    if not active_employees:
        return []

    # ── Build training data from inactive employees ───────────────────────
    inactive_employees = list(
        Employee.objects.filter(
            org_id=org_id,
            is_deleted=False,
            employment_status='inactive',
        ).select_related('user', 'department', 'manager')
        .prefetch_related('performance_reviews', 'leave_requests')
    )

    training_features = []
    training_labels   = []

    for emp in inactive_employees:
        features = _extract_employee_features(emp)
        training_features.append(features)
        training_labels.append(1)  # attrited

    for emp in active_employees:
        features = _extract_employee_features(emp)
        training_features.append(features)
        training_labels.append(0)  # retained

    # ── Score active employees ────────────────────────────────────────────
    results = []
    use_xgboost = len(inactive_employees) >= 5

    for emp in active_employees:
        features   = _extract_employee_features(emp)
        risk_score = None
        model_used = 'fallback'

        if use_xgboost:
            try:
                risk_score = _predict_with_xgboost(
                    training_features, training_labels, features
                )
                model_used = 'xgboost'
            except Exception:
                risk_score = None

        # Fallback: short tenure = higher base risk
        if risk_score is None:
            tenure_days = features[0]
            risk_score  = max(0.0, 1.0 - (tenure_days / 730))  # 2 years = near zero
            model_used  = 'fallback'

        risk_score = round(min(1.0, max(0.0, float(risk_score))), 4)
        risk_level = _score_to_level(risk_score)
        key_signals = _identify_signals(emp, features, risk_score)

        results.append({
            'employee_id':         str(emp.id),
            'employee_name':       emp.get_full_name(),
            'department':          emp.department.name if emp.department else 'Unassigned',
            'risk_score':          risk_score,
            'risk_level':          risk_level,
            'model_used':          model_used,
            'key_signals':         key_signals,
            'insufficient_data':   not use_xgboost,
            'training_attrited':   len(inactive_employees),
        })

    # Return top 20 highest-risk employees only
    results.sort(key=lambda x: x['risk_score'], reverse=True)
    return results[:20]


def _extract_employee_features(emp) -> list:
    """Extract feature vector from an Employee instance."""
    import datetime
    from django.utils import timezone

    today = timezone.now().date()

    # Tenure in days
    tenure_days = 0
    if emp.hire_date:
        tenure_days = (today - emp.hire_date).days

    # Performance review signals
    reviews = list(emp.performance_reviews.filter(is_deleted=False))
    avg_score      = sum(r.score for r in reviews) / len(reviews) if reviews else 3.0
    review_count   = len(reviews)
    days_since_rev = 365  # default to 1 year if no review
    if reviews:
        latest_review  = max(reviews, key=lambda r: r.period_end)
        days_since_rev = (today - latest_review.period_end).days

    # Leave request signals (last 6 months)
    six_months_ago = today - datetime.timedelta(days=180)
    recent_leaves  = [
        lr for lr in emp.leave_requests.filter(is_deleted=False)
        if lr.created_at.date() >= six_months_ago
    ]
    approved_leave = sum(1 for lr in recent_leaves if lr.status == 'approved')
    rejected_leave = sum(1 for lr in recent_leaves if lr.status == 'rejected')

    # Structural signals
    has_manager    = int(emp.manager_id is not None)
    has_department = int(emp.department_id is not None)

    return [
        tenure_days,
        round(avg_score, 2),
        review_count,
        days_since_rev,
        approved_leave,
        rejected_leave,
        has_manager,
        has_department,
    ]


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
    if score >= 0.70: return 'High'
    if score >= 0.40: return 'Medium'
    return 'Low'


def _identify_signals(emp, features: list, risk_score: float) -> list:
    """Generate human-readable signal labels for why this risk score was assigned."""
    signals = []
    tenure_days, avg_score, review_count, days_since_rev, approved_leave, rejected_leave, has_manager, has_dept = features

    if tenure_days < 180:
        signals.append('New hire — first 6 months')
    if avg_score < 2.5:
        signals.append('Below-average review scores')
    if review_count == 0:
        signals.append('No performance reviews on record')
    if days_since_rev > 365:
        signals.append('No review in over a year')
    if rejected_leave >= 2:
        signals.append('Multiple rejected leave requests')
    if approved_leave >= 4:
        signals.append('Frequent leave usage')
    if not has_manager:
        signals.append('No manager assigned')

    return signals[:3]  # return top 3 signals
