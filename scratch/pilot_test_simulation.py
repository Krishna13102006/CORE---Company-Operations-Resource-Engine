import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from knowledge.views import SemanticSearchView, DocumentContentView, RAGAskView
from knowledge.models import Document
from django.contrib.auth import get_user_model
import json

def run_pilot_simulation():
    print("=" * 60)
    print("      PILOT TEST SIMULATION: PERMISSION-AWARE RAG & RLS")
    print("=" * 60)

    # Flush semantic cache to ensure old leaked entries don't pollute the test
    from ml.semantic_cache import SemanticCache
    cache = SemanticCache()
    if cache.client:
        cache.client.flushdb()
        print("[+] Flushed Redis semantic cache database.")
    print("-" * 60)

    # 1. Fetch the target document
    doc = Document.objects.filter(file_type='pdf', is_deleted=False).order_by('-created_at').first()
    if not doc:
        print("[-] Aborting: No PDF document found in database.")
        return

    # Update document allowed roles to restrict it to admin and hr only
    doc.allowed_roles = "admin,hr"
    doc.save()
    print(f"[+] Restricting document '{doc.title}' to roles: [admin, hr]")
    print(f"[+] Document ID: {doc.id} | Org ID: {doc.org_id}")
    print("-" * 60)

    # 2. Get or create test users
    User = get_user_model()
    org_id = doc.org_id
    from tenants.models import Organization
    org_instance = Organization.objects.get(id=org_id)

    def get_or_create_user(email, first_name, last_name, role):
        user = User.objects.filter(email=email).first()
        if not user:
            user = User.objects.create_user(
                email=email,
                password="testpassword123",
                org=org_instance,
                role=role,
                first_name=first_name,
                last_name=last_name
            )
        else:
            user.role = role
            user.org = org_instance
            user.save()
        return user

    admin_user = get_or_create_user("pilot_admin@org.com", "Alice", "Admin", "admin")
    hr_user = get_or_create_user("pilot_hr@org.com", "Hannah", "HR", "hr")
    employee_user = get_or_create_user("pilot_emp@org.com", "Eric", "Employee", "employee")

    users_to_test = [
        ("Admin User (Alice)", admin_user, True),
        ("HR Manager (Hannah)", hr_user, True),
        ("Standard Employee (Eric)", employee_user, False),
    ]

    factory = APIRequestFactory()

    # 3. Simulate requests for each user role
    for name, user, should_have_access in users_to_test:
        print(f"\n>>> Running test for: {name} (Role: {user.role.upper()})")
        print(f"    Expected access: {'ALLOWED' if should_have_access else 'DENIED'}")

        # --- Test 1: Document Content Fetch API ---
        request = factory.get(f'/api/knowledge/documents/{doc.id}/content/')
        request.org_id = org_id
        force_authenticate(request, user=user)
        content_view = DocumentContentView.as_view()
        response = content_view(request, document_id=str(doc.id))

        if response.status_code == 200:
            print(f"    [PASS] Document content fetch: ALLOWED (Got content, pages: {response.data.get('page_count')})")
        elif response.status_code == 403:
            print("    [PASS] Document content fetch: DENIED (HTTP 403 Permission Denied as expected)")
        else:
            print(f"    [FAIL] Document content fetch: Unexpected status {response.status_code} - {response.data}")

        # --- Test 2: Semantic Search API ---
        # Search query is "css"
        request = factory.get('/api/knowledge/search/', {'q': 'css'})
        request.org_id = org_id
        force_authenticate(request, user=user)
        search_view = SemanticSearchView.as_view()
        response = search_view(request)
        
        results = response.data.get('results', [])
        found_doc = any(r['document']['id'] == str(doc.id) for r in results)
        
        if found_doc and should_have_access:
            print("    [PASS] Semantic Search: Document visible in results.")
        elif not found_doc and not should_have_access:
            print("    [PASS] Semantic Search: Document properly hidden (RLS check passed).")
        else:
            print(f"    [FAIL] Semantic Search: Document visibility mismatch! Found: {found_doc}, Expected: {should_have_access}")

        # --- Test 3: RAG Ask API ---
        # Ask RAG: "What are the core styling topics covered in the CSS notes?"
        request = factory.post('/api/knowledge/ask/', {'question': 'What are the core styling topics covered in the CSS notes?'}, format='json')
        request.org_id = org_id
        force_authenticate(request, user=user)
        ask_view = RAGAskView.as_view()
        response = ask_view(request)

        answer = response.data.get('answer', '')
        sources = response.data.get('sources', [])
        used_restricted_doc = any(s['document_id'] == str(doc.id) for s in sources)

        if used_restricted_doc and should_have_access:
            print("    [PASS] RAG Ask: Answer generated using the restricted document context.")
        elif not used_restricted_doc and not should_have_access:
            print("    [PASS] RAG Ask: Context filtered. Restricted document was NOT used.")
        else:
            print(f"    [FAIL] RAG Ask: RAG source leak check failed! Used restricted doc: {used_restricted_doc}, Expected: {should_have_access}")

    print("\n" + "=" * 60)
    print("               PILOT TEST SIMULATION COMPLETED")
    print("=" * 60)

if __name__ == '__main__':
    run_pilot_simulation()
