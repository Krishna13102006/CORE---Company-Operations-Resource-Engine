from django.contrib import admin
from .models import Organization, OrgSettings


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'plan', 'is_active', 'created_at')
    list_filter = ('plan', 'is_active')
    search_fields = ('name', 'slug')


@admin.register(OrgSettings)
class OrgSettingsAdmin(admin.ModelAdmin):
    list_display = ('org', 'max_documents', 'max_users')
    search_fields = ('org__name',)
