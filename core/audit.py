def get_client_ip(request):
    if not request:
        return None
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def log_action(org_id, user, action, target_type, target_id, detail='', ip_address=None, request=None):
    from .models import AuditLog
    try:
        if request and not ip_address:
            ip_address = get_client_ip(request)

        AuditLog.objects.create(
            org_id=org_id,
            actor=user,
            action=action,
            target_type=target_type,
            target_id=str(target_id),
            detail=detail,
            ip_address=ip_address,
        )
    except Exception:
        pass  # audit log failure must never break the main operation
