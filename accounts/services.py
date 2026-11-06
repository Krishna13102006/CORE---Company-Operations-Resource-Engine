from .repositories import UserRepository
from tenants.repositories import OrgRepository
from core.exceptions import ServiceError

user_repo = UserRepository()
org_repo  = OrgRepository()


class AuthService:
    def register_user(self, email, password, first_name, last_name, role, org_id=None, org_slug=None, passkey=None,
                      new_org_name=None, new_org_slug=None, new_org_passkey=None,
                      new_org_hr_passkey=None, new_org_manager_passkey=None, new_org_employee_passkey=None):
        from tenants.services import OrgService
        from tenants.repositories import OrgRepository

        org_service = OrgService()
        org_repo = OrgRepository()

        if role not in ['admin', 'hr', 'manager', 'employee']:
            raise ServiceError('Invalid role.')

        is_admin_joining = (role == 'admin' and org_slug)

        if role == 'admin' and not is_admin_joining:
            # admin path: create a new org, then create the user as its admin
            if not new_org_name or not new_org_slug or not new_org_passkey or not new_org_hr_passkey or not new_org_manager_passkey or not new_org_employee_passkey:
                raise ServiceError('Admin signup requires org name, slug, and all four role passkeys.')
            if org_repo.get_by_slug(new_org_slug):
                raise ServiceError('An organization with this slug already exists.', 400)
            org = org_service.create_org(
                name=new_org_name,
                slug=new_org_slug,
                passkey=new_org_passkey,
                hr_passkey=new_org_hr_passkey,
                manager_passkey=new_org_manager_passkey,
                employee_passkey=new_org_employee_passkey
            )
        else:
            # join an existing org by slug + passkey (for non-admin OR admin joining existing org)
            if not org_slug or not passkey:
                raise ServiceError('Signup to join an existing organization requires org slug and passkey.')
            org = org_repo.get_by_slug(org_slug)
            if not org:
                raise ServiceError('Organization not found.', 404)
            if not org.check_role_passkey(role, passkey):
                raise ServiceError(f'Invalid {role} passkey for this organization.', 403)

        existing = user_repo.get_by_email(email, org.id)
        if existing:
            raise ServiceError('A user with this email already exists in this organization.')

        return user_repo.create(
            email=email,
            password=password,
            org=org,
            role=role,
            first_name=first_name,
            last_name=last_name,
        )

    def list_org_users(self, org_id):
        return user_repo.list_by_org(org_id)

    def update_user_role(self, user_id, org_id, new_role):
        user = user_repo.get_by_id(user_id, org_id)
        if not user:
            raise ServiceError('User not found.', 404)
        old_role = user.role
        user.role = new_role
        user.save(update_fields=['role'])
        from core.audit import log_action
        log_action(
            org_id=org_id,
            user=user,
            action='USER_ROLE_UPDATED',
            target_type='User',
            target_id=user.id,
            detail=f"Role changed from {old_role} to {new_role} for {user.email}"
        )
        return user

    def update_user_status(self, user_id, org_id, is_active):
        user = user_repo.get_by_id(user_id, org_id)
        if not user:
            from .models import User
            user = User.objects.filter(id=user_id, org_id=org_id).first()
            if not user:
                raise ServiceError('User not found.', 404)

        from teams.models import Employee
        from core.audit import log_action

        if not is_active:
            user.is_active = False
            user.is_deleted = False
            user.save(update_fields=['is_active', 'is_deleted'])
            Employee.objects.filter(user=user).update(employment_status='suspended', is_deleted=False)
            log_action(
                org_id=org_id,
                user=user,
                action='USER_DEACTIVATED',
                target_type='User',
                target_id=user.id,
                detail=f"User {user.email} was deactivated"
            )
        else:
            user.is_active = True
            user.is_deleted = False
            user.save(update_fields=['is_active', 'is_deleted'])
            Employee.objects.filter(user=user).update(employment_status='active', is_deleted=False)
            log_action(
                org_id=org_id,
                user=user,
                action='USER_ACTIVATED',
                target_type='User',
                target_id=user.id,
                detail=f"User {user.email} was reactivated"
            )
        return user

    def delete_org_user(self, user_id, org_id):
        from .models import User
        from teams.models import Employee
        user = User.objects.filter(id=user_id, org_id=org_id).first()
        if not user:
            raise ServiceError('User not found.', 404)
        user.is_active = False
        user.is_deleted = True
        user.save(update_fields=['is_active', 'is_deleted'])
        Employee.objects.filter(user=user).update(is_deleted=True, employment_status='terminated')
        
        from .views import blacklist_all_user_tokens
        blacklist_all_user_tokens(user)
        return True