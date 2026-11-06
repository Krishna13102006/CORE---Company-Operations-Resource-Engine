from rest_framework import serializers
from .models import ExpenseClaim, SpendBudget
from projects.models import Project, Task
from teams.models import Department


class ExpenseClaimSerializer(serializers.ModelSerializer):
    employee_name      = serializers.SerializerMethodField()
    employee_email     = serializers.SerializerMethodField()
    employee_id        = serializers.SerializerMethodField()
    department_name    = serializers.SerializerMethodField()
    category_display   = serializers.SerializerMethodField()
    approved_by_name   = serializers.SerializerMethodField()
    reimbursed_by_name = serializers.SerializerMethodField()
    receipt_file_url   = serializers.SerializerMethodField()
    project_id         = serializers.SerializerMethodField()
    project_name       = serializers.SerializerMethodField()
    task_id            = serializers.SerializerMethodField()
    task_title         = serializers.SerializerMethodField()

    department_id   = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    approval_tier_display   = serializers.SerializerMethodField()
    settlement_method_display = serializers.SerializerMethodField()

    class Meta:
        model  = ExpenseClaim
        fields = [
            'id', 'employee_id', 'employee_name', 'employee_email', 'department_id', 'department_name',
            'title', 'merchant', 'expense_date', 'category', 'category_display',
            'amount', 'currency', 'exchange_rate', 'amount_converted', 'tax_amount',
            'description', 'receipt_file', 'receipt_file_url', 'receipt_url', 'receipt_hash',
            'project_id', 'project_name', 'task_id', 'task_title',
            'client_name', 'is_billable', 'billing_status', 'policy_violations',
            'status', 'approval_tier', 'approval_tier_display', 'approval_history', 'rejection_reason',
            'approved_by_name', 'approved_at',
            'reimbursed_by_name', 'reimbursed_at', 'settlement_method', 'settlement_method_display', 'settled_at', 'payout_reference',
            'ocr_raw_data', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at',
            'approved_by_name', 'approved_at',
            'reimbursed_by_name', 'reimbursed_at'
        ]

    def get_approval_tier_display(self, obj):
        return obj.get_approval_tier_display() if hasattr(obj, 'get_approval_tier_display') else obj.approval_tier

    def get_settlement_method_display(self, obj):
        return obj.get_settlement_method_display() if hasattr(obj, 'get_settlement_method_display') else obj.settlement_method

    def get_employee_name(self, obj):
        return obj.employee.get_full_name() if obj.employee else 'Unknown'

    def get_employee_email(self, obj):
        return obj.employee.user.email if obj.employee and obj.employee.user else ''

    def get_employee_id(self, obj):
        return str(obj.employee.id) if obj.employee else None

    def get_department_id(self, obj):
        if obj.department_id:
            return str(obj.department_id)
        if obj.employee and obj.employee.department_id:
            return str(obj.employee.department_id)
        return None

    def get_department_name(self, obj):
        if obj.department and not obj.department.is_deleted:
            return obj.department.name
        if obj.employee and obj.employee.department and not obj.employee.department.is_deleted:
            return obj.employee.department.name
        return 'General'

    def get_category_display(self, obj):
        return obj.get_category_display()

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return f"{obj.approved_by.first_name} {obj.approved_by.last_name}"
        return None

    def get_reimbursed_by_name(self, obj):
        if obj.reimbursed_by:
            return f"{obj.reimbursed_by.first_name} {obj.reimbursed_by.last_name}"
        return None

    def get_receipt_file_url(self, obj):
        if obj.receipt_file:
            return obj.receipt_file.url
        return obj.receipt_url or None

    def get_project_id(self, obj):
        return str(obj.project_id) if obj.project_id else None

    def get_project_name(self, obj):
        return obj.project.name if obj.project else None

    def get_task_id(self, obj):
        return str(obj.task_id) if obj.task_id else None

    def get_task_title(self, obj):
        return obj.task.title if obj.task else None


class ExpenseClaimCreateSerializer(serializers.Serializer):
    title            = serializers.CharField(max_length=255)
    merchant         = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')
    expense_date     = serializers.DateField()
    category         = serializers.ChoiceField(
                           choices=[c[0] for c in ExpenseClaim.CATEGORY_CHOICES],
                           default='other'
                       )
    amount           = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency         = serializers.ChoiceField(
                           choices=[c[0] for c in ExpenseClaim.CURRENCY_CHOICES],
                           default='USD'
                       )
    exchange_rate    = serializers.DecimalField(max_digits=10, decimal_places=4, required=False, default=1.0)
    amount_converted = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    tax_amount       = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0.0)
    description      = serializers.CharField(required=False, allow_blank=True, default='')
    receipt_file     = serializers.FileField(required=False, allow_null=True)
    receipt_url      = serializers.CharField(max_length=1000, required=False, allow_blank=True, default='')
    
    # Department, Project & Billing Fields
    department_id    = serializers.UUIDField(required=False, allow_null=True)
    project_id       = serializers.UUIDField(required=False, allow_null=True)
    task_id          = serializers.UUIDField(required=False, allow_null=True)
    client_name      = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    is_billable      = serializers.BooleanField(required=False, default=False)
    billing_status   = serializers.ChoiceField(
                           choices=[c[0] for c in ExpenseClaim.BILLING_STATUS_CHOICES],
                           required=False,
                           default='unbilled'
                       )
    
    status           = serializers.ChoiceField(choices=['draft', 'submitted'], default='submitted')
    ocr_raw_data     = serializers.JSONField(required=False, default=dict)


class ExpenseClaimUpdateSerializer(serializers.Serializer):
    title            = serializers.CharField(max_length=255, required=False)
    merchant         = serializers.CharField(max_length=200, required=False, allow_blank=True)
    expense_date     = serializers.DateField(required=False)
    category         = serializers.ChoiceField(
                           choices=[c[0] for c in ExpenseClaim.CATEGORY_CHOICES],
                           required=False
                       )
    amount           = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    currency         = serializers.ChoiceField(
                           choices=[c[0] for c in ExpenseClaim.CURRENCY_CHOICES],
                           required=False
                       )
    exchange_rate    = serializers.DecimalField(max_digits=10, decimal_places=4, required=False)
    amount_converted = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    tax_amount       = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    description      = serializers.CharField(required=False, allow_blank=True)
    receipt_file     = serializers.FileField(required=False, allow_null=True)
    receipt_url      = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    
    department_id    = serializers.UUIDField(required=False, allow_null=True)
    project_id       = serializers.UUIDField(required=False, allow_null=True)
    task_id          = serializers.UUIDField(required=False, allow_null=True)
    client_name      = serializers.CharField(max_length=255, required=False, allow_blank=True)
    is_billable      = serializers.BooleanField(required=False)
    billing_status   = serializers.ChoiceField(
                           choices=[c[0] for c in ExpenseClaim.BILLING_STATUS_CHOICES],
                           required=False
                       )
    
    status           = serializers.ChoiceField(choices=['draft', 'submitted'], required=False)


class ExpenseRejectSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default='')


class ExpenseReimburseSerializer(serializers.Serializer):
    payout_reference   = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    settlement_method  = serializers.ChoiceField(
                            choices=[c[0] for c in ExpenseClaim.SETTLEMENT_METHOD_CHOICES],
                            default='direct_bank',
                            required=False
                         )


class ExpenseBatchApproveSerializer(serializers.Serializer):
    claim_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1)
    notes     = serializers.CharField(required=False, allow_blank=True, default='')


class SpendBudgetSerializer(serializers.ModelSerializer):
    amount          = serializers.FloatField()
    department_name = serializers.SerializerMethodField()
    project_name    = serializers.SerializerMethodField()
    spent_amount    = serializers.SerializerMethodField()
    pending_amount  = serializers.SerializerMethodField()
    remaining       = serializers.SerializerMethodField()
    utilization_pct = serializers.SerializerMethodField()

    class Meta:
        model = SpendBudget
        fields = [
            'id', 'target_type', 'department', 'department_name', 'project', 'project_name',
            'period', 'amount', 'currency', 'alert_threshold_percent', 'notes',
            'spent_amount', 'pending_amount', 'remaining', 'utilization_pct',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_department_name(self, obj):
        return obj.department.name if obj.department else None

    def get_project_name(self, obj):
        return obj.project.name if obj.project else None

    def get_spent_amount(self, obj):
        return getattr(obj, '_spent_amount', 0.0)

    def get_pending_amount(self, obj):
        return getattr(obj, '_pending_amount', 0.0)

    def get_remaining(self, obj):
        spent = getattr(obj, '_spent_amount', 0.0)
        return max(0.0, float(obj.amount) - spent)

    def get_utilization_pct(self, obj):
        if not obj.amount or float(obj.amount) == 0:
            return 0.0
        spent = getattr(obj, '_spent_amount', 0.0)
        return round((spent / float(obj.amount)) * 100, 1)


class SpendBudgetCreateSerializer(serializers.Serializer):
    target_type             = serializers.ChoiceField(choices=['department', 'project'], default='department')
    department_id           = serializers.UUIDField(required=False, allow_null=True)
    project_id              = serializers.UUIDField(required=False, allow_null=True)
    period                  = serializers.ChoiceField(choices=['monthly', 'quarterly', 'annual'], default='monthly')
    amount                  = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency                = serializers.CharField(max_length=10, default='USD')
    alert_threshold_percent = serializers.IntegerField(default=80, required=False)
    notes                   = serializers.CharField(required=False, allow_blank=True, default='')
