# config/pages.py
from django.shortcuts import render


def landing_page(request):
    return render(request, 'landing.html')


def login_page(request):
    return render(request, 'auth/login.html')


def signup_page(request):
    return render(request, 'auth/signup.html')


def dashboard_page(request):
    return render(request, 'base.html')


def panel_page(request, name):
    # Renders a panel's template fragment to be loaded dynamically
    return render(request, f'panels/{name}.html')


from django.http import JsonResponse


def health_check(request):
    db_status = "ok"
    if request.GET.get('check_db') == '1':
        try:
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1;")
        except Exception as e:
            db_status = f"unreachable: {str(e)}"
        finally:
            try:
                from django.db import connection
                connection.close()
            except Exception:
                pass
    return JsonResponse({'status': 'ok', 'database': db_status, 'service': 'core-backend'})

