import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
django.setup()

from config.celery import app

def check_health():
    print("=" * 60)
    print("           CELERY WORKER HEALTH CHECK MONITOR")
    print("=" * 60)

    try:
        inspector = app.control.inspect()
        
        # 1. Ping workers
        print("[*] Pinging Celery workers...")
        pings = inspector.ping()
        if not pings:
            print("[-] CRITICAL: No active Celery workers found!")
            print("    Please run: celery -A config worker --loglevel=info -P solo")
            return False
        
        for worker, response in pings.items():
            print(f"[+] Worker: {worker} | Status: ONLINE (Ping: {response.get('ok', 'unknown')})")

        # 2. Get active / registered tasks
        print("\n[*] Inspecting worker statistics...")
        stats = inspector.stats()
        active = inspector.active()
        scheduled = inspector.scheduled()
        registered = inspector.registered()

        for worker in pings.keys():
            print(f"\nWorker Metrics for: {worker}")
            if stats and worker in stats:
                w_stats = stats[worker]
                print(f"  - Broker: {w_stats.get('broker', {}).get('hostname', 'Unknown')}")
                print(f"  - Completed Tasks: {w_stats.get('total', {}).get('knowledge.tasks.process_document', 0)}")
            
            # Active tasks running right now
            w_active = active.get(worker, []) if active else []
            print(f"  - Active running tasks: {len(w_active)}")
            for t in w_active:
                print(f"    * Task ID: {t.get('id')} | Name: {t.get('name')}")
            
            # Scheduled tasks in queue
            w_sched = scheduled.get(worker, []) if scheduled else []
            print(f"  - Scheduled queued tasks: {len(w_sched)}")

            # Registered task types
            w_reg = registered.get(worker, []) if registered else []
            print(f"  - Registered tasks types: {len(w_reg)}")
            print(f"    * List of registered tasks: {w_reg}")
            if 'knowledge.tasks.process_document' in w_reg:
                print("    * [OK] Document indexing task registered successfully.")
            else:
                print("    * [WARNING] Document indexing task is NOT registered on this worker.")

        print("\n" + "=" * 60)
        print("          CELERY WORKER HEALTH CHECK: SUCCESSFUL")
        print("=" * 60)
        return True

    except Exception as e:
        print(f"[-] Health check crashed: {e}")
        return False

if __name__ == '__main__':
    check_health()
