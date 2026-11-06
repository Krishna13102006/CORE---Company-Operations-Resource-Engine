from .base import *

DEBUG = True

allowed_dev = os.getenv('ALLOWED_HOSTS', '*')
if not allowed_dev or allowed_dev == '*':
    ALLOWED_HOSTS = ['*']
else:
    ALLOWED_HOSTS = [h.strip() for h in allowed_dev.split(',') if h.strip()]
    if '*' not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.extend(['.onrender.com', 'localhost', '127.0.0.1'])

# in dev you can see SQL queries being run
LOGGING = {
    'version': 1,
    'handlers': {
        'console': {'class': 'logging.StreamHandler'},
    },
    'loggers': {
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'DEBUG',
        },
    },
}

CELERY_TASK_ALWAYS_EAGER = True

EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')


