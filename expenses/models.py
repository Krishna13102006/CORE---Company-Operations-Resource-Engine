import uuid
import hashlib
from django.db import models
from core.models import BaseModel


class ExpenseClaim(BaseModel):
    CATEGORY_CHOICES = [
        ('meals_entertainment',   'Meals & Entertainment'),
        ('travel_transport',       'Travel & Transportation'),
        ('software_subscriptions', 'Software & SaaS Subscriptions'),
        ('office_supplies',        'Office Supplies & Stationery'),
        ('hardware_equipment',     'Hardware & Equipment'),
        ('professional_dev',       'Professional Development & Training'),
        ('utilities_internet',     'Internet & Utilities'),
        ('wellness_health',        'Wellness & Healthcare'),
        ('client_relations',       'Client Relations & Gifts'),
        ('other',                  'Other Operational Expense'),
    ]

    STATUS_CHOICES = [
        ('draft',          'Draft'),
        ('submitted',      'Submitted'),
        ('under_review',   'Under Review'),
        ('approved',       'Approved for Payout'),
        ('payment_queued', 'Payment Queued'),
        ('rejected',       'Rejected'),
        ('reimbursed',     'Settled / Paid'),
    ]

    APPROVAL_TIER_CHOICES = [
        ('auto_approved',     'Auto-Approved (< $100)'),
        ('manager_review',    'Direct Manager Review'),
        ('dept_head_review',  'Department Head Review'),
        ('finance_review',    'Finance / CFO Review'),
        ('approved',          'Fully Approved'),
        ('rejected',          'Rejected'),
    ]

    SETTLEMENT_METHOD_CHOICES = [
        ('direct_bank',    'Direct Bank Transfer'),
        ('payroll',        'Paid via Payroll'),
        ('corporate_card', 'Corporate Card / ACH'),
        ('cash',           'Cash / Petty Cash'),
    ]

    BILLING_STATUS_CHOICES = [
        ('unbilled', 'Unbilled'),
        ('invoiced', 'Invoiced'),
        ('paid',     'Paid by Client'),
    ]

    CURRENCY_CHOICES = [
        ('USD', 'US Dollar ($)'),
        ('EUR', 'Euro (€)'),
        ('GBP', 'British Pound (£)'),
        ('INR', 'Indian Rupee (₹)'),
        ('CAD', 'Canadian Dollar ($)'),
        ('AUD', 'Australian Dollar ($)'),
        ('JPY', 'Japanese Yen (¥)'),
        ('SGD', 'Singapore Dollar ($)'),
    ]

    employee         = models.ForeignKey(
                           'teams.Employee',
                           on_delete=models.CASCADE,
                           related_name='expense_claims'
                       )
    title            = models.CharField(max_length=255)
    merchant         = models.CharField(max_length=200, blank=True, default='')
    expense_date     = models.DateField()
    category         = models.CharField(
                           max_length=50,
                           choices=CATEGORY_CHOICES,
                           default='other'
                       )
    amount           = models.DecimalField(max_digits=12, decimal_places=2)
    currency         = models.CharField(max_length=10, choices=CURRENCY_CHOICES, default='USD')
    exchange_rate    = models.DecimalField(max_digits=10, decimal_places=4, default=1.0)
    amount_converted = models.DecimalField(
                           max_digits=12,
                           decimal_places=2,
                           default=0.0,
                           help_text='Amount converted to base USD currency'
                       )
    tax_amount       = models.DecimalField(max_digits=10, decimal_places=2, default=0.0)
    description      = models.TextField(blank=True, default='')

    # Department & Project Cost Allocation
    department       = models.ForeignKey(
                           'teams.Department',
                           on_delete=models.SET_NULL,
                           null=True,
                           blank=True,
                           related_name='expense_claims'
                       )
    project          = models.ForeignKey(
                           'projects.Project',
                           on_delete=models.SET_NULL,
                           null=True,
                           blank=True,
                           related_name='expense_claims'
                       )
    task             = models.ForeignKey(
                           'projects.Task',
                           on_delete=models.SET_NULL,
                           null=True,
                           blank=True,
                           related_name='expense_claims'
                       )
    client_name      = models.CharField(max_length=255, blank=True, default='')
    is_billable      = models.BooleanField(default=False)
    billing_status   = models.CharField(
                           max_length=20,
                           choices=BILLING_STATUS_CHOICES,
                           default='unbilled'
                       )

    # Receipt & Duplicate Detection Hash
    receipt_file     = models.FileField(
                           upload_to='receipts/%Y/%m/',
                           null=True,
                           blank=True
                       )
    receipt_url      = models.CharField(max_length=1000, blank=True, default='')
    receipt_hash     = models.CharField(max_length=64, blank=True, default='', db_index=True)

    # AI Policy & Compliance
    policy_violations = models.JSONField(
                           default=list,
                           blank=True,
                           help_text='List of AI policy violation tags / warning strings'
                       )

    status           = models.CharField(
                           max_length=20,
                           choices=STATUS_CHOICES,
                           default='submitted'
                       )
    approval_tier    = models.CharField(
                           max_length=30,
                           choices=APPROVAL_TIER_CHOICES,
                           default='manager_review'
                       )
    approval_history = models.JSONField(
                           default=list,
                           blank=True,
                           help_text='Audit log of approval stages and actions'
                       )
    rejection_reason = models.TextField(blank=True, default='')

    approved_by      = models.ForeignKey(
                           'accounts.User',
                           on_delete=models.SET_NULL,
                           null=True,
                           blank=True,
                           related_name='approved_expenses'
                       )
    approved_at      = models.DateTimeField(null=True, blank=True)

    reimbursed_by    = models.ForeignKey(
                           'accounts.User',
                           on_delete=models.SET_NULL,
                           null=True,
                           blank=True,
                           related_name='reimbursed_expenses'
                       )
    reimbursed_at    = models.DateTimeField(null=True, blank=True)
    settlement_method = models.CharField(
                           max_length=30,
                           choices=SETTLEMENT_METHOD_CHOICES,
                           default='direct_bank'
                       )
    settled_at       = models.DateTimeField(null=True, blank=True)
    payout_reference = models.CharField(max_length=100, blank=True, default='')

    ocr_raw_data     = models.JSONField(
                           default=dict,
                           blank=True,
                           help_text='Raw JSON metadata extracted by Gemini Vision OCR'
                       )

    class Meta:
        ordering = ['-expense_date', '-created_at']
        indexes = [
            models.Index(fields=['org', 'status', '-expense_date']),
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['org', 'category']),
            models.Index(fields=['org', 'department']),
            models.Index(fields=['org', 'project']),
            models.Index(fields=['org', 'receipt_hash']),
        ]

    def __str__(self):
        return f"{self.title} - {self.amount} {self.currency} ({self.status})"

    def save(self, *args, **kwargs):
        # Auto-compute amount_converted if not explicitly provided
        if not self.amount_converted or self.amount_converted == 0:
            rate = float(self.exchange_rate or 1.0)
            self.amount_converted = round(float(self.amount) * rate, 2)
        # Auto-default department to employee's assigned department if not specified
        if not self.department_id and self.employee and self.employee.department_id:
            self.department = self.employee.department
        super().save(*args, **kwargs)


class SpendBudget(BaseModel):
    TARGET_TYPE_CHOICES = [
        ('department', 'Department'),
        ('project',    'Project'),
    ]

    PERIOD_CHOICES = [
        ('monthly',   'Monthly'),
        ('quarterly', 'Quarterly'),
        ('annual',    'Annual'),
    ]

    target_type             = models.CharField(max_length=20, choices=TARGET_TYPE_CHOICES, default='department')
    department              = models.ForeignKey(
                                  'teams.Department',
                                  on_delete=models.CASCADE,
                                  null=True,
                                  blank=True,
                                  related_name='spend_budgets'
                              )
    project                 = models.ForeignKey(
                                  'projects.Project',
                                  on_delete=models.CASCADE,
                                  null=True,
                                  blank=True,
                                  related_name='spend_budgets'
                              )
    period                  = models.CharField(max_length=20, choices=PERIOD_CHOICES, default='monthly')
    amount                  = models.DecimalField(max_digits=12, decimal_places=2)
    currency                = models.CharField(max_length=10, default='USD')
    alert_threshold_percent = models.IntegerField(default=80, help_text='Percentage at which warning is triggered (e.g. 80%)')
    notes                   = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['org', 'target_type']),
        ]

    def __str__(self):
        target_name = self.department.name if self.department else (self.project.name if self.project else 'General')
        return f"{target_name} Budget ({self.period}): {self.amount} {self.currency}"
