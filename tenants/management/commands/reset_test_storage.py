import sys
from django.core.management.base import BaseCommand
from tenants.models import Organization
from tenants.services import OrgService

org_service = OrgService()


class Command(BaseCommand):
    help = 'Purges test data (documents, Qdrant vectors, candidate resumes, expense receipts, and logs) to reset storage back to 0.0 MB.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--org',
            type=str,
            help='Organization ID or slug to purge. If omitted, prompts or operates on the first active org.'
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Purge test storage across ALL organizations in the system.'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Bypass confirmation prompt.'
        )

    def handle(self, *args, **options):
        org_identifier = options.get('org')
        purge_all = options.get('all')
        force = options.get('force')

        if purge_all:
            orgs = list(Organization.objects.all())
            if not orgs:
                self.stdout.write(self.style.WARNING("No organizations found."))
                return
        elif org_identifier:
            try:
                # Try by UUID or slug
                orgs = [Organization.objects.get(slug=org_identifier)]
            except Organization.DoesNotExist:
                try:
                    orgs = [Organization.objects.get(id=org_identifier)]
                except (Organization.DoesNotExist, Exception):
                    self.stdout.write(self.style.ERROR(f"Organization '{org_identifier}' not found."))
                    return
        else:
            orgs = list(Organization.objects.all())
            if not orgs:
                self.stdout.write(self.style.WARNING("No organizations found."))
                return
            if len(orgs) > 1 and not force:
                self.stdout.write(self.style.WARNING("Multiple organizations found. Specify --org <slug> or --all."))
                for o in orgs:
                    self.stdout.write(f"  - {o.name} (slug: {o.slug}, id: {o.id})")
                return

        if not force:
            self.stdout.write(self.style.WARNING(
                f"\n⚠️  WARNING: This will permanently delete test documents, Qdrant vectors, candidate resumes, "
                f"and receipts for {len(orgs)} organization(s). User accounts and settings will NOT be deleted."
            ))
            confirm = input("Type 'yes' to proceed with storage reset: ")
            if confirm.strip().lower() != 'yes':
                self.stdout.write(self.style.NOTICE("Aborted."))
                return

        for org in orgs:
            self.stdout.write(f"\nResetting storage for organization '{org.name}' ({org.slug})...")
            stats = org_service.purge_test_storage(org_id=org.id)
            self.stdout.write(self.style.SUCCESS(
                f"  [+] Documents Deleted:    {stats['documents_deleted']}\n"
                f"  [+] Vector Chunks Purged: {stats['vector_chunks_purged']}\n"
                f"  [+] Receipts Deleted:     {stats['receipts_deleted']}\n"
                f"  [+] Resumes Deleted:      {stats['resumes_deleted']}\n"
                f"  [+] Meetings Deleted:     {stats['meetings_deleted']}\n"
                f"  [+] Execution Logs:       {stats['execution_logs_deleted']}\n"
                f"  [+] Storage Reclaimed:    {stats['reclaimed_storage_mb']} MB"
            ))

        self.stdout.write(self.style.SUCCESS("\n[SUCCESS] Storage reset complete! All vector and file allocations are refreshed.\n"))

