from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
import uuid


class UserManager(BaseUserManager):
    def create_user(self, email, password, org, role='employee', **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user  = self.model(email=email, org=org, role=role, **extra_fields)
        user.set_password(password)  # hashes the password
        user.save()
        return user

    def create_superuser(self, email, password, **extra_fields):
        extra_fields.setdefault('role', 'admin')
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        # superuser has no org (platform-level admin)
        return self.create_user(email, password, org=None, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('admin',    'Admin'),
        ('hr',       'HR'),
        ('manager',  'Manager'),
        ('employee', 'Employee'),
    ]

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org        = models.ForeignKey(
                     'tenants.Organization',
                     on_delete=models.CASCADE,
                     null=True,   # null for platform superusers
                     blank=True,
                     related_name='users'
                 )
    email      = models.EmailField(unique=True)
    first_name = models.CharField(max_length=100)
    last_name  = models.CharField(max_length=100)
    role       = models.CharField(max_length=20, choices=ROLE_CHOICES, default='employee')
    is_active  = models.BooleanField(default=True)
    is_staff   = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    
    # Two-Factor Authentication (2FA / MFA)
    is_2fa_enabled           = models.BooleanField(default=False)
    two_factor_secret        = models.CharField(max_length=64, blank=True, default='')
    two_factor_backup_codes  = models.JSONField(default=list, blank=True)

    # Real-Time Presence Telemetry
    last_seen_at             = models.DateTimeField(null=True, blank=True, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD  = 'email'     # login with email, not username
    REQUIRED_FIELDS = []

    @property
    def is_online(self):
        if not self.last_seen_at:
            return False
        from django.utils import timezone
        return (timezone.now() - self.last_seen_at).total_seconds() < 300

    def get_full_name(self):
        full_name = f"{self.first_name} {self.last_name}".strip()
        return full_name or self.email

    def get_short_name(self):
        return self.first_name or self.email.split('@')[0]

    def __str__(self):
        return f'{self.email} ({self.role})'