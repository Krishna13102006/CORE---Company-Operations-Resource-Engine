import os
from kombu import Queue
from .base import *

DEBUG = False

# Security & Hosts
allowed_env = os.getenv('ALLOWED_HOSTS', '*')
if not allowed_env or allowed_env == '*':
    ALLOWED_HOSTS = ['*']
else:
    ALLOWED_HOSTS = [h.strip() for h in allowed_env.split(',') if h.strip()]
    if '*' not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.extend(['.onrender.com', 'localhost', '127.0.0.1'])

CORS_ALLOW_ALL_ORIGINS = os.getenv('CORS_ALLOW_ALL_ORIGINS', 'True').lower() in ('true', '1', 't')
cors_env = os.getenv('CORS_ALLOWED_ORIGINS', '')
CORS_ALLOWED_ORIGINS = [o.strip() for o in cors_env.split(',') if o.strip()] if cors_env else []
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://.*\.vercel\.app$",
    r"^https://.*\.onrender\.com$",
    r"^http://localhost(:\d+)?$",
    r"^http://127\.0\.0\.1(:\d+)?$",
]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

csrf_env = os.getenv('CSRF_TRUSTED_ORIGINS', '')
CSRF_TRUSTED_ORIGINS = [o.strip() for o in csrf_env.split(',') if o.strip()] if csrf_env else [
    'https://*.vercel.app',
    'https://*.onrender.com',
    'http://localhost:5173',
    'http://localhost:3000',
]

# SSL & Security Headers
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = os.getenv('SECURE_SSL_REDIRECT', 'False').lower() == 'true'
SESSION_COOKIE_SECURE = os.getenv('SESSION_COOKIE_SECURE', 'True').lower() == 'true'
CSRF_COOKIE_SECURE = os.getenv('CSRF_COOKIE_SECURE', 'True').lower() == 'true'
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = int(os.getenv('SECURE_HSTS_SECONDS', 31536000))
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Redis Cache for PDF Previews, Page Counts, Semantic Cache & Sessions
REDIS_URL = os.getenv('REDIS_URL', '').strip()
REDIS_CACHE_URL = os.getenv('REDIS_CACHE_URL', REDIS_URL).strip()

# Only enable Redis backend if a genuine external Redis URL is provided (not localhost / dummy)
is_valid_remote_redis = (
    REDIS_CACHE_URL and 
    not REDIS_CACHE_URL.startswith('redis://localhost') and 
    not REDIS_CACHE_URL.startswith('redis://127.0.0.1')
)

if is_valid_remote_redis:
    # Upstash Redis only supports DB 0
    if 'upstash.io' in REDIS_CACHE_URL or REDIS_CACHE_URL.endswith('/1'):
        REDIS_CACHE_URL = REDIS_CACHE_URL.rstrip('/1').rstrip('/0') + '/0'

    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': REDIS_CACHE_URL,
            'TIMEOUT': 86400,
            'KEY_PREFIX': 'core_cache',
            'OPTIONS': {
                'socket_connect_timeout': 3,
                'socket_timeout': 3,
                'retry_on_timeout': False,
            }
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'core-prod-locmem-cache',
            'TIMEOUT': 86400,
        }
    }

# Production Database Connection Settings (safe for Neon / Serverless PostgreSQL)
DATABASES['default']['CONN_MAX_AGE'] = int(os.getenv('DB_CONN_MAX_AGE', 0))
DATABASES['default']['CONN_HEALTH_CHECKS'] = False
if 'OPTIONS' not in DATABASES['default']:
    DATABASES['default']['OPTIONS'] = {}
DATABASES['default']['OPTIONS'].update({
    'connect_timeout': 10,
})

# Celery Task Queues & Autoscaling Routing
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True

CELERY_TASK_QUEUES = (
    Queue('default', routing_key='default.#'),
    Queue('indexing', routing_key='indexing.#'),
    Queue('priority', routing_key='priority.#'),
)
CELERY_DEFAULT_QUEUE = 'default'
CELERY_DEFAULT_EXCHANGE = 'tasks'
CELERY_DEFAULT_ROUTING_KEY = 'default'

CELERY_TASK_ROUTES = {
    'knowledge.tasks.*': {'queue': 'indexing'},
    'hiring.tasks.*': {'queue': 'indexing'},
    'communications.tasks.*': {'queue': 'priority'},
    'core.tasks.*': {'queue': 'default'},
}

# Task safety limits (prevent runaway worker processes on huge files)
CELERY_TASK_TIME_LIMIT = 900       # 15 minutes hard kill
CELERY_TASK_SOFT_TIME_LIMIT = 840  # 14 minutes soft timeout exception
CELERY_WORKER_PREFETCH_MULTIPLIER = 1

# Production Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'json': {
            'format': '[{levelname}] {asctime} {name}: {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'json',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': os.getenv('DJANGO_LOG_LEVEL', 'INFO'),
            'propagate': False,
        },
        'accounts': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'core': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'knowledge': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'celery': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}