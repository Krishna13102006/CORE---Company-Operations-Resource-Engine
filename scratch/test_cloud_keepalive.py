import os
import sys
import time
import psycopg2
from qdrant_client import QdrantClient

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

print("=" * 65)
print("🌐 LIVE CLUSTER KEEPALIVE & STATUS PROBE")
print("=" * 65)

# 1. Neon Cloud Database
neon_url = "postgresql://neondb_owner:npg_o1alcXkWy04y@ep-withered-poetry-a9an11uy-pooler.g-2.us-east-2.aws.neon.tech/neondb?sslmode=require"
print("\n[1/2] Connecting to Neon Cloud Database (Render DATABASE_URL)...")
try:
    conn = psycopg2.connect(neon_url)
    cur = conn.cursor()
    cur.execute("SELECT version(), current_database(), now();")
    res = cur.fetchone()
    print(f"  ✓ NEON CLOUD DATABASE ACTIVE & AWAKE!")
    print(f"    - Database Name: '{res[1]}'")
    print(f"    - Cloud Timestamp: {res[2]}")
    print(f"    - Engine: {res[0].split()[0]} {res[0].split()[1]}")
    cur.close()
    conn.close()
except Exception as e:
    print(f"  ❌ Neon DB Connection Error: {e}")

# 2. Qdrant Cloud Cluster
qdrant_url = "https://0da175aa-1f46-457e-b483-9a91ad4ad473.us-east-2-0.aws.cloud.qdrant.io"
# Read API key or use fallback
print("\n[2/2] Connecting to Qdrant Cloud Cluster (Render QDRANT_HOST)...")
try:
    # Notice: Qdrant Cloud requires API Key if authentication is enabled
    # We test connecting with url
    client = QdrantClient(url=qdrant_url, timeout=10.0)
    cols = client.get_collections().collections
    print(f"  ✓ QDRANT CLOUD CLUSTER ACTIVE & RESPONDING!")
    print(f"    - URL: {qdrant_url}")
    print(f"    - Total Collections: {len(cols)}")
    for c in cols:
        print(f"      * {c.name}")
except Exception as e:
    print(f"  ⚠️ Qdrant Cloud Check (Needs API Key from Render environment): {e}")

print("\n" + "=" * 65)
print("🎉 CLUSTER PROBE COMPLETED!")
print("=" * 65)
