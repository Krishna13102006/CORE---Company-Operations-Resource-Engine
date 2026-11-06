import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')

app = Celery('core')
app.config_from_object('django.conf:settings', namespace='CELERY')

# auto-discovers tasks.py in every installed app
app.autodiscover_tasks()