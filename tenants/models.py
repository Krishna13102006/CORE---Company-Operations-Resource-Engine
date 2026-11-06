from django.db import models
import uuid


class Organization(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name       = models.CharField(max_length=255)
    slug         = models.SlugField(unique=True)   # used in subdomains: acme.coreapp.com
    passkey_hash = models.CharField(max_length=255)
    hr_passkey_hash       = models.CharField(max_length=255, null=True, blank=True)
    manager_passkey_hash  = models.CharField(max_length=255, null=True, blank=True)
    employee_passkey_hash = models.CharField(max_length=255, null=True, blank=True)
    plan       = models.CharField(
                     max_length=20,
                     choices=[('starter','Starter'),('pro','Pro'),('enterprise','Enterprise')],
                     default='starter'
                 )
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def check_passkey(self, raw_passkey):
        from django.contrib.auth.hashers import check_password
        return check_password(raw_passkey, self.passkey_hash)

    def check_role_passkey(self, role, raw_passkey):
        from django.contrib.auth.hashers import check_password
        if role == 'admin':
            return check_password(raw_passkey, self.passkey_hash)
        elif role == 'hr':
            return self.hr_passkey_hash and check_password(raw_passkey, self.hr_passkey_hash)
        elif role == 'manager':
            return self.manager_passkey_hash and check_password(raw_passkey, self.manager_passkey_hash)
        elif role == 'employee':
            return self.employee_passkey_hash and check_password(raw_passkey, self.employee_passkey_hash)
        return False

    def __str__(self):
        return self.name


class OrgSettings(models.Model):
    org                          = models.OneToOneField(Organization, on_delete=models.CASCADE)
    max_documents                = models.IntegerField(default=1000)
    max_users                    = models.IntegerField(default=50)
    allowed_domains              = models.JSONField(default=list)  # email domains allowed to register
    enforce_2fa                  = models.BooleanField(default=False)
    session_idle_timeout_minutes = models.IntegerField(default=30)


class OrganizationInvitation(models.Model):
    STATUS_CHOICES = [
        ('pending',  'Pending'),
        ('accepted', 'Accepted'),
        ('revoked',  'Revoked'),
        ('expired',  'Expired'),
    ]

    ROLE_CHOICES = [
        ('admin',    'Admin'),
        ('hr',       'HR'),
        ('manager',  'Manager'),
        ('employee', 'Employee'),
    ]

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org         = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='invitations')
    inviter     = models.ForeignKey(
                      'accounts.User',
                      on_delete=models.SET_NULL,
                      null=True,
                      blank=True,
                      related_name='sent_invitations'
                  )
    email       = models.EmailField(db_index=True)
    first_name  = models.CharField(max_length=100, blank=True, default='')
    last_name   = models.CharField(max_length=100, blank=True, default='')
    role        = models.CharField(max_length=20, choices=ROLE_CHOICES, default='employee')
    department  = models.ForeignKey(
                      'teams.Department',
                      on_delete=models.SET_NULL,
                      null=True,
                      blank=True,
                      related_name='invitations'
                  )
    manager_email = models.CharField(max_length=255, blank=True, default='')
    skills      = models.JSONField(default=list, blank=True)
    onboarding_data = models.JSONField(default=dict, blank=True)
    token       = models.CharField(max_length=128, unique=True, db_index=True)
    status      = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    expires_at  = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['org', 'status']),
            models.Index(fields=['email', 'status']),
        ]

    def is_valid(self):
        from django.utils import timezone
        return self.status == 'pending' and self.expires_at > timezone.now()

    def __str__(self):
        return f"Invite: {self.email} -> {self.org.name} ({self.role})"