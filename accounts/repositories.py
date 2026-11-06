from .models import User


class UserRepository:
    def get_by_email(self, email, org_id):
        return User.objects.filter(
            email=email,
            org_id=org_id,
            is_deleted=False
        ).first()

    def get_by_id(self, user_id, org_id):
        return User.objects.filter(
            id=user_id,
            org_id=org_id,
            is_deleted=False
        ).first()

    def create(self, email, password, org, role, first_name, last_name):
        return User.objects.create_user(
            email=email,
            password=password,
            org=org,
            role=role,
            first_name=first_name,
            last_name=last_name,
        )

    def list_by_org(self, org_id):
        return User.objects.filter(
            org_id=org_id,
            is_deleted=False
        ).select_related(
            'org',
            'employee_profile__department'
        ).prefetch_related(
            'employee_profile__departments',
            'headed_departments'
        )
