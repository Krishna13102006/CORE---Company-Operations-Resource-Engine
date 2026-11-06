from .models import Organization


class OrgRepository:
    def get_by_id(self, org_id):
        try:
            return Organization.objects.get(id=org_id)
        except (Organization.DoesNotExist, ValueError, TypeError):
            return None

    def get_by_slug(self, slug):
        try:
            return Organization.objects.get(slug=slug)
        except Organization.DoesNotExist:
            return None

    def create(self, name, slug, plan='starter'):
        return Organization.objects.create(
            name=name,
            slug=slug,
            plan=plan
        )

    def list_all(self):
        return Organization.objects.filter(is_active=True)

    def list_public(self):
        return Organization.objects.filter(is_active=True).only('name', 'slug')
