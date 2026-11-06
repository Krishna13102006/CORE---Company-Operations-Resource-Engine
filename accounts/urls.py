from django.urls import path
from . import views

urlpatterns = [
    path('register/',               views.RegisterView.as_view()),
    path('login/',                  views.LoginView.as_view()),
    path('logout/',                 views.LogoutView.as_view()),
    path('me/',                     views.MeView.as_view()),
    path('heartbeat/',              views.UserHeartbeatView.as_view()),
    path('token/refresh/',          views.CookieTokenRefreshView.as_view()),
    path('users/',                  views.OrgUserListView.as_view()),
    path('users/<uuid:user_id>/',   views.OrgUserDetailView.as_view()),
    path('audit-log/',              views.AuditLogView.as_view()),
    path('2fa/setup/',              views.TwoFactorSetupView.as_view()),
    path('2fa/enable/',             views.TwoFactorEnableView.as_view()),
    path('2fa/disable/',            views.TwoFactorDisableView.as_view()),
    path('notifications/',          views.NotificationListView.as_view()),
    path('notifications/<uuid:notification_id>/', views.NotificationReadView.as_view()),
    path('notifications/<uuid:notification_id>/read/', views.NotificationReadView.as_view()),
    path('password-reset/request/', views.PasswordResetRequestView.as_view()),
    path('password-reset/confirm/', views.PasswordResetConfirmView.as_view()),
    path('export-data/',            views.DataExportView.as_view()),
    path('delete-account/',         views.AccountErasureView.as_view()),
]