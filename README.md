# CORE — Multi-Tenant SaaS Platform

CORE is a robust, multi-tenant SaaS platform designed for document management, semantic search, and organizational control. It features a backend built on **Django** and **Django REST Framework (DRF)**, async background processing via **Celery & Redis**, vector storage using **Qdrant**, and a responsive Single Page Application (SPA) frontend built with **Vanilla HTML, CSS, and JavaScript**.

---

## Technical Stack

- **Core Framework**: Python 3.10+, Django 6.0+
- **API Engine**: Django REST Framework (DRF)
- **Database**: PostgreSQL (structured schemas, user data, configurations, audit logs)
- **Vector Database**: Qdrant (semantic embeddings and vector search)
- **Task Queue**: Celery + Redis (async document text parsing and index processing)
- **Frontend**: Vanilla HTML5, CSS3, and JavaScript (SPA panel shell, AJAX, and tail-made CSS grids)

---

## Key Features

1. **Multi-Tenant Organization Isolation**:
   - `TenantMiddleware` automatically resolves tenant context (`org_id`) per request based on JWT claims.
   - Database tables are automatically segregated at the query layer.
2. **Role-Based Access Control (RBAC)**:
   - Four predefined user roles: `Admin`, `HR`, `Manager`, and `Employee`.
   - Security permissions enforced at the REST View layer.
3. **Database & Document Management (Admin Panel)**:
   - Global organization configuration updates.
   - Member management (role updating and status activation/deactivation).
   - Document upload library (supports PDF, DOCX, TXT, categorization, and editing).
4. **Audit Logging**:
   - Action logging triggers record administrative operations (role swaps, deactivations, settings changes, document deletions) inside an `AuditLog` database timeline.

---

## Local Installation & Setup

Follow these steps to configure your local development environment:

### 1. Clone the Repository
```bash
git clone https://github.com/skesur/Core.git
cd core
```

### 2. Set Up a Virtual Environment & Install Dependencies
```bash
python -m venv venv

# Activate Virtual Environment:
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install requirements
pip install -r requirements.txt
```

### 3. Setup ollama local model
Make sure **Ollama** is installed and running on your machine, then download the specific model.
```bash
ollama pull qwen2.5:1.5b
```

### 4. Setup PostgreSQL database in pgAdmin
Open pgAdmin (or your SQL client).
Connect to your local PostgreSQL server.
Create a blank database named exactly: core_db.

### 5. Setup Infrastructure Services
Make sure **Redis** and **Qdrant** are running on your machine. The easiest way is using Docker:
```bash
# Start Redis (port 6379)
docker run -d -p 6379:6379 redis:alpine

# Start Qdrant (port 6333)
docker run -d -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

### 6. Configure Environment Variables
Create a file named `.env` in the root project folder:
```env
SECRET_KEY=your-secret-key-here
DB_NAME=core_db
DB_USER=postgres
DB_PASSWORD=your_local_postgres_password
DB_HOST=localhost
DB_PORT=5432
REDIS_URL=redis://localhost:6379/0
QDRANT_HOST=localhost
QDRANT_PORT=6333
OLLAMA_BASE_URL = http://localhost:11434
OLLAMA_MODEL = qwen2.5:1.5b
```

### 7. Apply Migrations
```bash
python manage.py migrate
```

---

## Running the Servers

Open separate terminal windows with your virtual environment active in each:

### Terminal 1: Django Web Server
```bash
python manage.py runserver
```
Visit `http://localhost:8000/` to use the application.

### Terminal 2: Celery Worker Tasks Queue
```bash
celery -A config worker --loglevel=info
```

# How To Run:

cd "..\Core"

docker start core-redis

docker start core-qdrant

ollama list

.\venv\Scripts\activate

python manage.py runserver

OPEN ANOTHER CMD:

cd "..\Core"

.\venv\Scripts\activate

celery -A config worker --loglevel=info -P solo
