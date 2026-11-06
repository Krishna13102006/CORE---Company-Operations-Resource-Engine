import os

env = os.getenv('DJANGO_ENV', 'prod' if os.getenv('RENDER') or os.getenv('DATABASE_URL') else 'base')
if env == 'prod':
    try:
        from .prod import *
    except ImportError:
        from .base import *
else:
    from .base import *
