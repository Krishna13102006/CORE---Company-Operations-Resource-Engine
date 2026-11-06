import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.getenv('SECRET_KEY') or os.getenv('DJANGO_SECRET_KEY', 'django-insecure-core-prod-fallback-key-change-in-env-secret-88231')

allowed = os.getenv('ALLOWED_HOSTS', '*')
if not allowed or allowed == '*':
    ALLOWED_HOSTS = ['*']
else:
    ALLOWED_HOSTS = [host.strip() for host in allowed.split(',') if host.strip()]
    if '*' not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.extend(['.onrender.com', 'localhost', '127.0.0.1'])

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'whitenoise.runserver_nostatic',
    'django.contrib.staticfiles',

    # third party
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',

    'core',
    'accounts',
    'tenants',
    'hiring',
    'teams',
    'projects',
    'knowledge',
    'analytics',
    'communications',
    'meetings',
    'expenses',
    'automations',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'core.middleware.SecurityHeadersMiddleware',
    'core.middleware.DatabaseConnectionMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'core.middleware.TenantMiddleware',
    'core.middleware.UserPresenceMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

import urllib.parse

db_url = os.getenv('DATABASE_URL')
db_conn_max_age = int(os.getenv('DB_CONN_MAX_AGE', 0))
if db_url:
    if db_url.startswith('postgres://'):
        db_url = db_url.replace('postgres://', 'postgresql://', 1)
    parsed_db = urllib.parse.urlparse(db_url)
    db_options = {
        'connect_timeout': 10,
    }
    if 'sslmode=require' in db_url or 'aws.neon.tech' in (parsed_db.hostname or '') or '.render.com' in (parsed_db.hostname or ''):
        db_options['sslmode'] = 'require'

    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': parsed_db.path.lstrip('/'),
            'USER': urllib.parse.unquote(parsed_db.username) if parsed_db.username else '',
            'PASSWORD': urllib.parse.unquote(parsed_db.password) if parsed_db.password else '',
            'HOST': parsed_db.hostname or 'localhost',
            'PORT': str(parsed_db.port or 5432),
            'CONN_MAX_AGE': db_conn_max_age,
            'CONN_HEALTH_CHECKS': False,
            'OPTIONS': db_options,
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME':     os.getenv('DB_NAME', 'postgres'),
            'USER':     os.getenv('DB_USER', 'postgres'),
            'PASSWORD': os.getenv('DB_PASSWORD', ''),
            'HOST':     os.getenv('DB_HOST', 'localhost'),
            'PORT':     os.getenv('DB_PORT', '5432'),
            'CONN_MAX_AGE': db_conn_max_age,
            'CONN_HEALTH_CHECKS': True,
            'OPTIONS': {
                'connect_timeout': 10,
            },
        }
    }

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'accounts.User'
# tells Django to use our custom User model instead of its default one

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 8,
        }
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

PASSWORD_HASHERS = [
    'core.hashers.OptimizedPBKDF2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
    'django.contrib.auth.hashers.Argon2PasswordHasher',
    'django.contrib.auth.hashers.BCryptSHA256PasswordHasher',
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'core.authentication.JWTCookieAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/minute',
        'user': '300/minute',
        'auth': '10/minute',
        'sql_console': '20/minute',
        'sensitive_action': '30/minute',
    },
    'DEFAULT_PAGINATION_CLASS': 'core.pagination.StandardPagination',
    'EXCEPTION_HANDLER': 'core.exceptions.custom_exception_handler',
    'PAGE_SIZE': 20,
}

# Standard Security Headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS':  True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
}

# Celery Performance & Memory Management (Low-RAM VPS & Free Cloud Tiers)
CELERY_BROKER_URL         = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND     = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT     = ['json']
CELERY_TASK_SERIALIZER    = 'json'
CELERY_RESULT_SERIALIZER  = 'json'
CELERY_WORKER_MAX_TASKS_PER_CHILD = int(os.getenv('CELERY_WORKER_MAX_TASKS_PER_CHILD', 100))  # Recycles process to release fragmented RAM
CELERY_WORKER_PREFETCH_MULTIPLIER = int(os.getenv('CELERY_WORKER_PREFETCH_MULTIPLIER', 1))    # Prevents worker task starvation
CELERY_TASK_ACKS_LATE     = True  # Guarantees no dropped tasks on worker restarts

# Qdrant
QDRANT_HOST = os.getenv('QDRANT_HOST', 'localhost')
QDRANT_PORT = int(os.getenv('QDRANT_PORT', 6333))
QDRANT_API_KEY = os.getenv('QDRANT_API_KEY', '')

STATIC_URL = '/static/'
STATICFILES_DIRS = [os.path.join(BASE_DIR, 'static')]
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{levelname}] {asctime} {name}: {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class':     'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'knowledge': {
            'handlers': ['console'],
            'level':    'INFO',
            'propagate': False,
        },
        'celery': {
            'handlers': ['console'],
            'level':    'INFO',
            'propagate': False,
        },
    },
}

# LLM Providers Configuration (Groq Cloud API, Google Gemini, OpenAI, Ollama)
LLM_PROVIDER    = os.getenv('LLM_PROVIDER', 'groq')  # 'groq' | 'gemini' | 'openai' | 'ollama'

# Groq Cloud API (Free & ultra-fast LLaMA / Qwen / GPT-OSS models)
GROQ_API_KEY    = os.getenv('GROQ_API_KEY', '')
GROQ_MODEL      = os.getenv('GROQ_MODEL', 'openai/gpt-oss-120b')

# Google Gemini API
GEMINI_API_KEY  = os.getenv('GEMINI_API_KEY', '')
GEMINI_MODEL    = os.getenv('GEMINI_MODEL', 'gemini-3.8-flash')

# OpenAI / Custom vLLM / TGI
OPENAI_API_KEY  = os.getenv('OPENAI_API_KEY', '')
OPENAI_MODEL    = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
OPENAI_BASE_URL = os.getenv('OPENAI_BASE_URL', 'https://api.openai.com/v1')

# Local Ollama Fallback
OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
OLLAMA_MODEL    = os.getenv('OLLAMA_MODEL',    'qwen2.5:1.5b')

RAG_TOP_K_CHUNKS   = 5     # number of chunks to retrieve from Qdrant per query
RAG_MAX_CONTEXT_CHARS = 6000  # max total characters of context passed to LLM (accommodates 3-4 chunks of 500 tokens)

# CORS & Cookie Auth Settings
CORS_ALLOW_ALL_ORIGINS = os.getenv('CORS_ALLOW_ALL_ORIGINS', 'True').lower() in ('true', '1', 't')
cors_env = os.getenv('CORS_ALLOWED_ORIGINS', '')
if cors_env:
    CORS_ALLOWED_ORIGINS = [o.strip() for o in cors_env.split(',') if o.strip()]
else:
    CORS_ALLOWED_ORIGINS = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
CORS_ALLOW_CREDENTIALS = True

# Brevo Cloud Email API (Primary Cloud Delivery Engine over HTTPS Port 443)
BREVO_API_KEY = os.getenv('BREVO_API_KEY', '')
BREVO_SENDER_EMAIL = os.getenv('BREVO_SENDER_EMAIL', '')
BREVO_SENDER_NAME = os.getenv('BREVO_SENDER_NAME', 'CORE Workspace')

# Resend Cloud Email API (Secondary Cloud Delivery Engine over HTTPS Port 443)
RESEND_API_KEY = os.getenv('RESEND_API_KEY', '')
RESEND_FROM_EMAIL = os.getenv('RESEND_FROM_EMAIL', 'CORE Workspace <onboarding@resend.dev>')

# Real SMTP / Gmail Email Delivery Configuration
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', 465))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'False').lower() in ('true', '1', 't')
EMAIL_USE_SSL = os.getenv('EMAIL_USE_SSL', 'True').lower() in ('true', '1', 't')
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', f'CORE Workspace <{EMAIL_HOST_USER}>' if EMAIL_HOST_USER else 'CORE Workspace <noreply@example.com>')
EMAIL_TIMEOUT = 10

# Frontend URL for password reset links & email redirection
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173').rstrip('/')
PASSWORD_RESET_TIMEOUT = int(os.getenv('PASSWORD_RESET_TIMEOUT', 1800))  # 30 minutes in seconds


