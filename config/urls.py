"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from .pages import landing_page, login_page, signup_page, dashboard_page, panel_page, health_check

from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('health/',         health_check,   name='health'),
    path('api/health/',     health_check,   name='api_health'),
    path('',                landing_page,   name='landing'),
    path('dashboard/',      dashboard_page, name='dashboard'),
    path('login/',          login_page,     name='login'),
    path('signup/',         signup_page,    name='signup'),
    path('panels/<str:name>/', panel_page,  name='panel'),
    path('admin/',          admin.site.urls),
    path('api/auth/',       include('accounts.urls')),
    path('api/tenants/',    include('tenants.urls')),
    path('api/hiring/',     include('hiring.urls')),
    path('api/teams/',      include('teams.urls')),
    path('api/projects/',   include('projects.urls')),
    path('api/knowledge/',  include('knowledge.urls')),
    path('api/analytics/',  include('analytics.urls')),
    path('api/communications/', include('communications.urls')),
    path('api/meetings/',   include('meetings.urls')),
    path('api/expenses/',   include('expenses.urls')),
    path('api/automations/', include('automations.urls')),

    # Defensive alias to safely resolve accidental double /api/ prefix from legacy frontend bundles or proxies
    path('api/api/auth/',           include('accounts.urls')),
    path('api/api/tenants/',        include('tenants.urls')),
    path('api/api/hiring/',         include('hiring.urls')),
    path('api/api/teams/',          include('teams.urls')),
    path('api/api/projects/',       include('projects.urls')),
    path('api/api/knowledge/',      include('knowledge.urls')),
    path('api/api/analytics/',      include('analytics.urls')),
    path('api/api/communications/', include('communications.urls')),
    path('api/api/meetings/',       include('meetings.urls')),
    path('api/api/expenses/',       include('expenses.urls')),
    path('api/api/automations/',    include('automations.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)