import multiprocessing
import os

port = os.getenv("PORT", "10000")
bind = os.getenv("GUNICORN_BIND", f"0.0.0.0:{port}")

# Multi-worker & thread configuration with redundancy against hung I/O sockets
workers = int(os.getenv("GUNICORN_WORKERS", 2))
threads = int(os.getenv("GUNICORN_THREADS", 4))
worker_class = os.getenv("GUNICORN_WORKER_CLASS", "gthread")

# Prevent memory leaks over prolonged runtime
max_requests = int(os.getenv("GUNICORN_MAX_REQUESTS", 1000))
max_requests_jitter = int(os.getenv("GUNICORN_MAX_REQUESTS_JITTER", 50))

# Timeouts: support cloud server cold-starts and serverless DB spin-ups (60s)
timeout = int(os.getenv("GUNICORN_TIMEOUT", 60))
graceful_timeout = 20
keepalive = int(os.getenv("GUNICORN_KEEPALIVE", 5))

# Disable preload_app to allow clean database and thread initialization
preload_app = False

# Logging
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")
capture_output = True
