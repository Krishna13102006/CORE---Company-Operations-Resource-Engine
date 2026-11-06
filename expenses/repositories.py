from django.utils import timezone
from django.db.models import Q
from .models import ExpenseClaim, SpendBudget


class ExpenseRepository:

    def list_by_org(self, org_id, filters=None):
        qs = ExpenseClaim.objects.filter(
            org_id=org_id,
            is_deleted=False
        ).select_related(
            'employee__user', 'employee__department', 'department', 'approved_by', 'reimbursed_by', 'project', 'task'
        ).order_by('-expense_date', '-created_at')

        if filters:
            if filters.get('status'):
                qs = qs.filter(status=filters['status'])
            if filters.get('category'):
                qs = qs.filter(category=filters['category'])
            if filters.get('employee'):
                qs = qs.filter(employee_id=filters['employee'])
            if filters.get('department'):
                qs = qs.filter(Q(department_id=filters['department']) | Q(department__isnull=True, employee__department_id=filters['department']))
            if filters.get('project'):
                qs = qs.filter(project_id=filters['project'])
            if filters.get('is_billable') is not None:
                val = str(filters['is_billable']).lower() in ['true', '1']
                qs = qs.filter(is_billable=val)
            if filters.get('search'):
                s = filters['search']
                qs = qs.filter(
                    Q(title__icontains=s) |
                    Q(merchant__icontains=s) |
                    Q(client_name__icontains=s) |
                    Q(project__name__icontains=s) |
                    Q(employee__user__first_name__icontains=s) |
                    Q(employee__user__last_name__icontains=s)
                )
            if filters.get('year'):
                qs = qs.filter(expense_date__year=filters['year'])
            if filters.get('month'):
                qs = qs.filter(expense_date__month=filters['month'])

        return qs

    def list_by_employee(self, employee_id, org_id, filters=None):
        filters = filters.copy() if filters else {}
        filters['employee'] = str(employee_id)
        return self.list_by_org(org_id, filters)

    def get_by_id(self, expense_id, org_id):
        return ExpenseClaim.objects.filter(
            id=expense_id,
            org_id=org_id,
            is_deleted=False
        ).select_related(
            'employee__user', 'employee__department', 'department', 'approved_by', 'reimbursed_by', 'project', 'task'
        ).first()

    def create(self, org_id, employee, title, amount, currency, expense_date,
               category='other', merchant='', tax_amount=0.0, description='',
               exchange_rate=1.0, amount_converted=None, receipt_file=None,
               receipt_url='', receipt_hash='', status='submitted', ocr_raw_data=None,
               department=None, project=None, task=None, client_name='', is_billable=False,
               billing_status='unbilled', policy_violations=None, approval_tier='manager_review',
               approval_history=None, settlement_method='direct_bank', settled_at=None, **extra):
        if amount_converted is None or amount_converted == 0:
            amount_converted = round(float(amount) * float(exchange_rate or 1.0), 2)

        return ExpenseClaim.objects.create(
            org_id=org_id,
            employee=employee,
            title=title,
            merchant=merchant,
            expense_date=expense_date,
            category=category,
            amount=amount,
            currency=currency,
            exchange_rate=exchange_rate,
            amount_converted=amount_converted,
            tax_amount=tax_amount,
            description=description,
            receipt_file=receipt_file,
            receipt_url=receipt_url,
            receipt_hash=receipt_hash,
            department=department,
            project=project,
            task=task,
            client_name=client_name,
            is_billable=is_billable,
            billing_status=billing_status,
            policy_violations=policy_violations or [],
            status=status,
            approval_tier=approval_tier,
            approval_history=approval_history or [],
            settlement_method=settlement_method,
            settled_at=settled_at,
            ocr_raw_data=ocr_raw_data or {}
        )

    def update(self, expense_id, org_id, **fields):
        fields['updated_at'] = timezone.now()
        ExpenseClaim.objects.filter(id=expense_id, org_id=org_id).update(**fields)
        return self.get_by_id(expense_id, org_id)

    def soft_delete(self, expense_id, org_id):
        claim = self.get_by_id(expense_id, org_id)
        if claim:
            claim.soft_delete()
        return claim
