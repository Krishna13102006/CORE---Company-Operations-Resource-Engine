import threading
from django.apps import AppConfig


class KnowledgeConfig(AppConfig):
    name = 'knowledge'

    def ready(self):
        def _warmup():
            try:
                from nlp.embedding_generator import embed_text
                embed_text("warmup")
            except Exception:
                pass

        threading.Thread(target=_warmup, daemon=True).start()
