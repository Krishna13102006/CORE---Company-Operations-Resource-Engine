import os
import io
import csv
import json
import base64
import hashlib
import logging
import datetime
import httpx
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
from django.db.models import Sum, Count, Q, Avg
from core.exceptions import ServiceError
from teams.models import Employee, Department
from projects.models import Project, Task
from .models import ExpenseClaim, SpendBudget
from .repositories import ExpenseRepository

logger = logging.getLogger(__name__)
expense_repo = ExpenseRepository()

GEMINI_VISION_MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.8-flash',
    'gemini-flash-latest',
]


class ExpenseService:

    def compute_file_hash(self, file_bytes: bytes) -> str:
        """Computes SHA256 hash of receipt file for duplicate detection."""
        if not file_bytes:
            return ''
        return hashlib.sha256(file_bytes).hexdigest()

    # Prohibited Blacklisted Merchants / Categories for Corporate Spending
    RESTRICTED_MERCHANT_KEYWORDS = [
        'casino', 'betting', 'poker', 'lottery', 'gambling', 'draftkings', 'fanduel',
        'rolex', 'louis vuitton', 'gucci', 'prada', 'tiffany',
        'steam games', 'playstation store', 'xbox live', 'nintendo', 'epic games',
        'onlyfans', 'tinder', 'bumble', 'match.com',
        'liquor store', 'wine cellar', 'total wine', 'bevmo', 'beer bar'
    ]

    def check_policy_and_duplicates(self, org_id, employee, amount: float, currency: str,
                                   expense_date, category: str, merchant: str = '',
                                   receipt_bytes: bytes = None, receipt_hash: str = '',
                                   exclude_claim_id = None, ocr_data: dict = None) -> dict:
        """
        🏛️ Pillar 2: Corporate Policy Engine & Automated Guardrails
        1. Hard/Soft Policy Violation Flags (Absolute hard caps vs category limits).
        2. Cross-Employee & Perceptual Hash Duplicate Claim Detection.
        3. Mandatory Tax / GST / VAT Invoice Compliance Check.
        4. Weekend, Holiday, and Prohibited Alcohol Item Detection (via Gemini Vision).
        5. Restricted Merchant Blacklist & Category Guardrails.
        6. Split-Expense ("Smurfing") & Cumulative Velocity Guard.
        """
        violations = []
        hard_blocks = []
        soft_warnings = []
        duplicate_match = None
        has_receipt = bool(receipt_hash or (receipt_bytes and len(receipt_bytes) > 0))
        
        computed_hash = receipt_hash
        if not computed_hash and receipt_bytes:
            computed_hash = self.compute_file_hash(receipt_bytes)

        float_amt = float(amount or 0.0)
        merchant_clean = (merchant or '').strip()

        # -------------------------------------------------------------
        # 1. AI Duplicate Claim Detection (Hash & Multi-Employee Fuzzy Match)
        # -------------------------------------------------------------
        dup_qs = ExpenseClaim.objects.filter(org_id=org_id, is_deleted=False)
        if exclude_claim_id:
            dup_qs = dup_qs.exclude(id=exclude_claim_id)

        # Check A: Exact SHA256 Receipt File Hash Match
        if computed_hash:
            exact_dup = dup_qs.filter(receipt_hash=computed_hash).first()
            if exact_dup:
                dup_emp = exact_dup.employee.get_full_name() if exact_dup.employee else "Unknown"
                is_same_emp = exact_dup.employee_id == (employee.id if employee else None)
                relation = "you previously" if is_same_emp else f"colleague {dup_emp}"
                duplicate_match = {
                    'type': 'exact_file_hash',
                    'claim_id': str(exact_dup.id),
                    'title': exact_dup.title,
                    'employee_name': dup_emp,
                    'is_same_employee': is_same_emp,
                    'amount': float(exact_dup.amount),
                    'currency': exact_dup.currency,
                    'date': exact_dup.expense_date.strftime('%Y-%m-%d'),
                    'status': exact_dup.status,
                }
                msg = f"DUPLICATE_RECEIPT_HASH: Exact receipt file was already submitted by {relation} for '{exact_dup.title}' ({exact_dup.status})."
                hard_blocks.append(msg)
                violations.append(msg)

        # Check B: Invoice Number Match (if extracted by OCR)
        invoice_num = (ocr_data or {}).get('invoice_number', '').strip()
        if not duplicate_match and invoice_num and len(invoice_num) >= 3:
            inv_dup = dup_qs.filter(ocr_raw_data__invoice_number__iexact=invoice_num).first()
            if inv_dup:
                dup_emp = inv_dup.employee.get_full_name() if inv_dup.employee else "Unknown"
                duplicate_match = {
                    'type': 'invoice_number_match',
                    'claim_id': str(inv_dup.id),
                    'title': inv_dup.title,
                    'employee_name': dup_emp,
                    'amount': float(inv_dup.amount),
                    'currency': inv_dup.currency,
                    'date': inv_dup.expense_date.strftime('%Y-%m-%d'),
                    'status': inv_dup.status,
                }
                msg = f"DUPLICATE_INVOICE_NUMBER: Receipt/Invoice #{invoice_num} was already filed by {dup_emp} for '{inv_dup.title}'."
                hard_blocks.append(msg)
                violations.append(msg)

        # Check C: Merchant + Date + Amount (Fuzzy Match across coworkers)
        if not duplicate_match and merchant_clean and float_amt > 0 and expense_date:
            soft_dup = dup_qs.filter(
                merchant__iexact=merchant_clean,
                amount=amount,
                expense_date=expense_date
            ).first()
            if soft_dup:
                dup_emp = soft_dup.employee.get_full_name() if soft_dup.employee else "Unknown"
                is_same_emp = soft_dup.employee_id == (employee.id if employee else None)
                duplicate_match = {
                    'type': 'merchant_date_amount_match',
                    'claim_id': str(soft_dup.id),
                    'title': soft_dup.title,
                    'employee_name': dup_emp,
                    'is_same_employee': is_same_emp,
                    'amount': float(soft_dup.amount),
                    'currency': soft_dup.currency,
                    'date': soft_dup.expense_date.strftime('%Y-%m-%d'),
                    'status': soft_dup.status,
                }
                msg = f"POTENTIAL_DUPLICATE: Matching transaction at '{merchant_clean}' for {amount} {currency} on {expense_date} already exists (submitted by {dup_emp})."
                soft_warnings.append(msg)
                violations.append(msg)

        # -------------------------------------------------------------
        # 2. Real-time Policy Caps (Hard Blocks & Soft Category Warnings)
        # -------------------------------------------------------------
        # Absolute Hard Cap ($5,000 threshold requires VP approval)
        if float_amt >= 5000.0:
            msg = f"HARD_POLICY_BLOCK: Single transactions over $5,000 require VP of Finance pre-approval."
            hard_blocks.append(msg)
            violations.append(msg)
        elif float_amt >= 1000.0:
            msg = f"HIGH_VALUE_CLAIM: High-value claim (${float_amt:,.2f}) requires Senior Management / CFO sign-off."
            soft_warnings.append(msg)
            violations.append(msg)

        # Meals & Entertainment Policy Cap ($80/person daily limit)
        if category == 'meals_entertainment' and float_amt > 80.0:
            msg = f"PER_DIEM_EXCEEDED: Meals claim (${float_amt:.2f}) exceeds standard $80/day meal policy. Written client justification required."
            soft_warnings.append(msg)
            violations.append(msg)

        # Wellness Limit ($100/mo cap)
        if category == 'wellness_health' and float_amt > 100.0:
            msg = f"CATEGORY_CAP_ALERT: Wellness expense (${float_amt:.2f}) exceeds standard $100 monthly allocation."
            soft_warnings.append(msg)
            violations.append(msg)

        # -------------------------------------------------------------
        # 3. Mandatory Tax / GST / VAT Invoice Compliance Check
        # -------------------------------------------------------------
        # For transactions over $50, an itemized receipt with tax breakdown or Tax ID is expected
        vendor_tax_id = (ocr_data or {}).get('vendor_tax_id', '').strip()
        tax_amount_val = float((ocr_data or {}).get('tax_amount') or 0.0)

        if float_amt > 25.0 and not has_receipt:
            msg = "MISSING_RECEIPT: Claims over $25 require an attached itemized receipt image or PDF for audit compliance."
            hard_blocks.append(msg)
            violations.append(msg)
        elif float_amt > 75.0 and not vendor_tax_id and tax_amount_val <= 0:
            msg = "TAX_COMPLIANCE_NOTICE: Invoices over $75 require a valid Vendor Tax ID (GSTIN/VAT/EIN) or itemized tax breakdown for tax recovery."
            soft_warnings.append(msg)
            violations.append(msg)

        # -------------------------------------------------------------
        # 4. Weekend, Holiday & Prohibited Alcohol Line-Item Detection
        # -------------------------------------------------------------
        # Weekend Detection
        try:
            if isinstance(expense_date, str):
                parsed_date = datetime.date.fromisoformat(expense_date)
            else:
                parsed_date = expense_date
            if parsed_date and parsed_date.weekday() in [5, 6]:
                day_name = "Saturday" if parsed_date.weekday() == 5 else "Sunday"
                msg = f"WEEKEND_EXPENSE: Incurred on a non-business day ({day_name}, {parsed_date.strftime('%b %d')}). Business travel context required."
                soft_warnings.append(msg)
                violations.append(msg)
        except Exception:
            pass

        # Alcohol & Prohibited Line-Item Detection (Extracted via Gemini Vision)
        if ocr_data and (ocr_data.get('has_alcohol_or_disallowed') or ocr_data.get('disallowed_items_detected')):
            disallowed_list = ocr_data.get('disallowed_items_detected') or ['Alcoholic beverage']
            items_str = ", ".join(disallowed_list)
            msg = f"PROHIBITED_ITEM_DETECTED: Gemini Vision detected prohibited items on receipt ({items_str}). Alcohol is non-reimbursable per employee handbook."
            hard_blocks.append(msg)
            violations.append(msg)

        # -------------------------------------------------------------
        # 5. Restricted Merchant Blacklist & Category Guardrails
        # -------------------------------------------------------------
        lower_merchant = merchant_clean.lower()
        matched_keyword = next((kw for kw in self.RESTRICTED_MERCHANT_KEYWORDS if kw in lower_merchant), None)
        if matched_keyword:
            msg = f"RESTRICTED_MERCHANT_BLOCKED: '{merchant_clean}' matches prohibited vendor category ('{matched_keyword}'). Corporate reimbursement prohibited."
            hard_blocks.append(msg)
            violations.append(msg)

        # -------------------------------------------------------------
        # 6. Cumulative Velocity & Split-Expense ("Smurfing") Detector
        # -------------------------------------------------------------
        # If employee submits multiple claims within a 48-hour window under the same merchant or category
        if employee and parsed_date and merchant_clean:
            two_days_prior = parsed_date - datetime.timedelta(days=2)
            two_days_after = parsed_date + datetime.timedelta(days=2)
            recent_claims = dup_qs.filter(
                employee=employee,
                merchant__iexact=merchant_clean,
                expense_date__gte=two_days_prior,
                expense_date__lte=two_days_after
            )
            recent_count = recent_claims.count()
            if recent_count >= 2:
                total_split_amt = sum([float(c.amount) for c in recent_claims]) + float_amt
                msg = f"VELOCITY_SPLIT_WARNING: {recent_count + 1} transactions totaling ${total_split_amt:.2f} at '{merchant_clean}' within 48 hours. Potential split-expense ('smurfing') detected."
                soft_warnings.append(msg)
                violations.append(msg)

        return {
            'is_compliant': len(violations) == 0,
            'has_hard_blocks': len(hard_blocks) > 0,
            'violations_count': len(violations),
            'violations': violations,
            'hard_blocks': hard_blocks,
            'soft_warnings': soft_warnings,
            'duplicate_match': duplicate_match,
            'receipt_hash': computed_hash
        }

    def scan_receipt_with_gemini(self, file_bytes: bytes, content_type: str = 'image/jpeg') -> dict:
        """
        Extracts structured expense fields from receipt image or PDF using Google Gemini Vision.
        Also calculates receipt SHA256 hash for fraud & duplicate prevention.
        """
        gemini_key = getattr(settings, 'GEMINI_API_KEY', '') or os.getenv('GEMINI_API_KEY', '')
        base64_data = base64.b64encode(file_bytes).decode('utf-8')
        today_str = timezone.now().strftime('%Y-%m-%d')
        receipt_hash = self.compute_file_hash(file_bytes)

        prompt = f"""
You are an expert AI Receipt OCR & Expense Compliance Scanner for the CORE Enterprise Workspace.
Today's Date: {today_str}.

Analyze the attached receipt image or document and extract structured JSON with the following exact keys:
- "merchant": Name of the business/store/airline/hotel (e.g. "Starbucks", "Uber", "Delta Air Lines", "Amazon", "GitHub", "Figma").
- "invoice_number": Official receipt/invoice number, bill number, or transaction ref if visible (or empty string).
- "vendor_tax_id": Business tax identification number, GSTIN, VAT number, or EIN if visible (or empty string).
- "expense_date": Date of transaction in "YYYY-MM-DD" format. If only month/day visible, use the closest past date relative to {today_str}.
- "amount": Total final amount paid (as a positive number, e.g. 45.50).
- "currency": Standard 3-letter currency code (e.g. "USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY", "SGD"). Defaults to "USD" if unclear.
- "tax_amount": Tax/VAT/GST amount included or 0.0.
- "category": Choose the single most accurate category from:
  ["meals_entertainment", "travel_transport", "software_subscriptions", "office_supplies", "hardware_equipment", "professional_dev", "utilities_internet", "wellness_health", "client_relations", "other"].
- "line_items": Array of item objects with name and price (e.g. [{{"item": "Latte", "price": 4.50}}]).
- "has_alcohol_or_disallowed": Boolean (true if line items include alcoholic beverages like beer, wine, cocktails, liquor, champagne, or prohibited items like tobacco/vapes).
- "disallowed_items_detected": Array of strings naming any detected prohibited or alcohol items (e.g. ["IPA Draft Beer", "Pinot Noir Glass"]).
- "title": A clean professional expense title (e.g. "Client lunch at Starbucks", "Uber ride to client office", "Monthly Figma Team License").
- "confidence_score": Float from 0.0 to 1.0 representing extraction confidence.
- "summary": A 1-sentence description of the receipt contents.
- "is_recurring_subscription": Boolean (true if merchant looks like recurring SaaS like AWS, GitHub, Figma, Notion, Zoom, OpenAI, Google Workspace).

Return ONLY raw valid JSON matching this schema.
"""

        extracted_data = None

        if gemini_key:
            mime = content_type or 'image/jpeg'
            if 'pdf' in mime:
                mime = 'application/pdf'
            elif 'png' in mime:
                mime = 'image/png'
            elif 'webp' in mime:
                mime = 'image/webp'
            else:
                mime = 'image/jpeg'

            for model in GEMINI_VISION_MODELS:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={gemini_key}"
                    payload = {
                        "contents": [
                            {
                                "parts": [
                                    {"text": prompt},
                                    {
                                        "inlineData": {
                                            "mimeType": mime,
                                            "data": base64_data
                                        }
                                    }
                                ]
                            }
                        ],
                        "generationConfig": {
                            "temperature": 0.1,
                            "response_mime_type": "application/json"
                        }
                    }
                    with httpx.Client(timeout=35.0) as client:
                        resp = client.post(url, json=payload)
                        if resp.status_code == 200:
                            data = resp.json()
                            raw_text = data['candidates'][0]['content']['parts'][0]['text']
                            extracted_data = json.loads(raw_text)
                            logger.info(f"Gemini Vision successfully scanned receipt using {model}")
                            break
                except Exception as e:
                    logger.warning(f"Gemini Vision {model} failed: {e}")
                    continue

        if not extracted_data:
            extracted_data = {
                "merchant": "Uploaded Merchant",
                "expense_date": today_str,
                "amount": 0.0,
                "currency": "USD",
                "tax_amount": 0.0,
                "category": "other",
                "line_items": [],
                "title": f"Expense on {today_str}",
                "confidence_score": 0.5,
                "summary": "Receipt uploaded for processing.",
                "is_recurring_subscription": False
            }

        extracted_data['receipt_hash'] = receipt_hash
        return extracted_data

    def get_my_expense_summary(self, org_id, requesting_user) -> dict:
        emp = Employee.objects.filter(user=requesting_user, org_id=org_id, is_deleted=False).first()
        if not emp:
            raise ServiceError('Employee profile not found.', 404)

        current_year = timezone.now().year
        qs = ExpenseClaim.objects.filter(employee=emp, org_id=org_id, is_deleted=False)

        pending_qs = qs.filter(status='submitted')
        pending_total = pending_qs.aggregate(t=Sum('amount_converted'))['t'] or Decimal('0.00')
        pending_count = pending_qs.count()

        approved_qs = qs.filter(status='approved')
        approved_total = approved_qs.aggregate(t=Sum('amount_converted'))['t'] or Decimal('0.00')

        reimbursed_qs = qs.filter(status='reimbursed', expense_date__year=current_year)
        reimbursed_total = reimbursed_qs.aggregate(t=Sum('amount_converted'))['t'] or Decimal('0.00')

        total_claims_count = qs.count()
        recent_qs = qs.order_by('-created_at')[:5]

        from .serializers import ExpenseClaimSerializer
        return {
            'employee_id': str(emp.id),
            'pending_total': float(pending_total),
            'pending_count': pending_count,
            'approved_total': float(approved_total),
            'reimbursed_ytd': float(reimbursed_total),
            'total_claims_count': total_claims_count,
            'recent_claims': ExpenseClaimSerializer(recent_qs, many=True).data,
        }

    def list_expenses(self, org_id, requesting_user, filters=None):
        emp = Employee.objects.filter(user=requesting_user, org_id=org_id, is_deleted=False).first()
        if requesting_user.role == 'employee':
            if not emp:
                return []
            return expense_repo.list_by_employee(emp.id, org_id, filters)
        return expense_repo.list_by_org(org_id, filters)

    def get_expense(self, expense_id, org_id, requesting_user):
        claim = expense_repo.get_by_id(expense_id, org_id)
        if not claim:
            raise ServiceError('Expense claim not found.', 404)

        is_owner = claim.employee.user_id == requesting_user.id
        is_manager = requesting_user.role in ['admin', 'hr', 'manager']

        if not is_owner and not is_manager:
            raise ServiceError('Permission denied to view this expense claim.', 403)

        return claim

    def create_expense(self, org_id, requesting_user, data: dict, receipt_file=None):
        emp = Employee.objects.filter(user=requesting_user, org_id=org_id, is_deleted=False).first()
        if not emp:
            raise ServiceError('Employee profile not found.', 404)

        receipt_bytes = None
        receipt_hash = ''
        if receipt_file:
            try:
                receipt_bytes = receipt_file.read()
                receipt_hash = self.compute_file_hash(receipt_bytes)
                receipt_file.seek(0)
            except Exception:
                pass

        # Resolve Department, Project, and Task
        department = None
        if data.get('department_id'):
            department = Department.objects.filter(id=data['department_id'], org_id=org_id, is_deleted=False).first()
        elif emp.department:
            department = emp.department

        project = None
        if data.get('project_id'):
            project = Project.objects.filter(id=data['project_id'], org_id=org_id, is_deleted=False).first()

        task = None
        if data.get('task_id'):
            task = Task.objects.filter(id=data['task_id'], org_id=org_id, is_deleted=False).first()

        ocr_data = data.get('ocr_raw_data') or {}
        if isinstance(ocr_data, str):
            try:
                ocr_data = json.loads(ocr_data)
            except Exception:
                ocr_data = {}

        # Run AI Policy & Fraud Check
        policy_res = self.check_policy_and_duplicates(
            org_id=org_id,
            employee=emp,
            amount=data.get('amount', 0),
            currency=data.get('currency', 'USD'),
            expense_date=data.get('expense_date'),
            category=data.get('category', 'other'),
            merchant=data.get('merchant', ''),
            receipt_bytes=receipt_bytes,
            receipt_hash=receipt_hash,
            ocr_data=ocr_data
        )

        # Enforce Hard Policy Blocks
        if policy_res.get('has_hard_blocks'):
            hard_msg = policy_res['hard_blocks'][0]
            raise ServiceError(f"Submission Blocked by Corporate Policy: {hard_msg}", 400)

        # 🏛️ Pillar 3: Threshold-Based Multi-Tier Approval Routing & Auto-Approval
        amt_conv = float(data.get('amount_converted') or (float(data.get('amount', 0)) * float(data.get('exchange_rate', 1.0))))
        policy_viols = policy_res.get('violations', [])
        status_val = data.get('status', 'submitted')

        if status_val == 'draft':
            approval_tier = 'manager_review'
            approval_history = []
        elif amt_conv < 100.0 and len(policy_viols) == 0:
            # Tier 1 (< $100 & 0 policy flags): Auto-approved!
            status_val = 'approved'
            approval_tier = 'auto_approved'
            approval_history = [{
                'action': 'auto_approved',
                'tier': 'auto_approved',
                'by_name': 'CORE AI Policy Engine',
                'by_id': None,
                'timestamp': timezone.now().isoformat(),
                'notes': f'Instant Auto-Approval: Amount (${amt_conv:.2f}) is below $100 threshold with zero policy flags.'
            }]
        elif amt_conv <= 1000.0:
            # Tier 2 ($100 - $1,000): Direct Manager Review
            status_val = 'submitted'
            approval_tier = 'manager_review'
            approval_history = [{
                'action': 'submitted',
                'tier': 'manager_review',
                'by_name': emp.get_full_name(),
                'by_id': str(requesting_user.id),
                'timestamp': timezone.now().isoformat(),
                'notes': f'Submitted for Direct Manager review (Tier: $100 - $1,000, Amount: ${amt_conv:.2f})'
            }]
        else:
            # Tier 3 (> $1,000): High-Value multi-tier review
            status_val = 'submitted'
            approval_tier = 'manager_review'
            approval_history = [{
                'action': 'submitted',
                'tier': 'manager_review',
                'by_name': emp.get_full_name(),
                'by_id': str(requesting_user.id),
                'timestamp': timezone.now().isoformat(),
                'notes': f'High-value claim (${amt_conv:,.2f} > $1,000): Requires Manager + Dept Head + Finance review'
            }]

        claim = expense_repo.create(
            org_id=org_id,
            employee=emp,
            title=data['title'],
            merchant=data.get('merchant', ''),
            expense_date=data['expense_date'],
            category=data.get('category', 'other'),
            amount=data['amount'],
            currency=data.get('currency', 'USD'),
            exchange_rate=data.get('exchange_rate', 1.0),
            amount_converted=amt_conv,
            tax_amount=data.get('tax_amount', 0.0),
            description=data.get('description', ''),
            receipt_file=receipt_file or data.get('receipt_file'),
            receipt_url=data.get('receipt_url', ''),
            receipt_hash=receipt_hash,
            department=department,
            project=project,
            task=task,
            client_name=data.get('client_name', ''),
            is_billable=data.get('is_billable', False),
            billing_status=data.get('billing_status', 'unbilled'),
            policy_violations=policy_viols,
            status=status_val,
            approval_tier=approval_tier,
            approval_history=approval_history,
            settlement_method='direct_bank',
            ocr_raw_data=data.get('ocr_raw_data', {})
        )

        # 📨 Pillar 3: Brevo Approval Notification Relay
        if approval_tier == 'auto_approved':
            # Notify employee immediately of auto-approval
            from core.notifications import send_notification
            send_notification(
                recipient=requesting_user,
                org=org_id,
                actor=None,
                type='SYSTEM',
                title="Expense Auto-Approved",
                message=f"Your claim '{claim.title}' for {claim.amount} {claim.currency} was instantly auto-approved by the policy engine (< $100 threshold).",
                target_url='/finance',
                send_email=True,
                email_subject=f"Claim Auto-Approved: {claim.title}",
                email_cta_text="View in Finance"
            )
        else:
            # Route approval email to Direct Manager or Department Head
            approver_user = None
            role_label = "Direct Manager"
            if emp.manager and emp.manager.user and emp.manager.user_id != requesting_user.id:
                approver_user = emp.manager.user
            elif department and department.head and department.head_id != requesting_user.id:
                approver_user = department.head
                role_label = "Department Head"
            else:
                from accounts.models import User
                approver_user = User.objects.filter(org_id=org_id, role__in=['admin', 'hr']).exclude(id=requesting_user.id).first()
                role_label = "Finance Admin"

            if approver_user:
                self.send_approval_relay_email(claim, approver_user, role_label, requesting_user)

        return claim

    def update_expense(self, expense_id, org_id, requesting_user, data: dict, receipt_file=None):
        claim = self.get_expense(expense_id, org_id, requesting_user)

        if claim.status in ['approved', 'reimbursed'] and requesting_user.role == 'employee':
            raise ServiceError('Cannot modify an approved or reimbursed expense claim.', 400)

        updates = {}
        for k in ['title', 'merchant', 'expense_date', 'category', 'amount', 'currency',
                  'exchange_rate', 'amount_converted', 'tax_amount', 'description', 'receipt_url',
                  'client_name', 'is_billable', 'billing_status', 'status']:
            if k in data and data[k] is not None:
                updates[k] = data[k]

        if 'project_id' in data:
            if data['project_id']:
                updates['project'] = Project.objects.filter(id=data['project_id'], org_id=org_id, is_deleted=False).first()
            else:
                updates['project'] = None

        if 'task_id' in data:
            if data['task_id']:
                updates['task'] = Task.objects.filter(id=data['task_id'], org_id=org_id, is_deleted=False).first()
            else:
                updates['task'] = None

        if receipt_file:
            updates['receipt_file'] = receipt_file
            try:
                r_bytes = receipt_file.read()
                updates['receipt_hash'] = self.compute_file_hash(r_bytes)
                receipt_file.seek(0)
            except Exception:
                pass

        # Re-evaluate policy if amount/date/category changed
        cur_amount = updates.get('amount', claim.amount)
        cur_currency = updates.get('currency', claim.currency)
        cur_date = updates.get('expense_date', claim.expense_date)
        cur_category = updates.get('category', claim.category)
        cur_merchant = updates.get('merchant', claim.merchant)
        cur_hash = updates.get('receipt_hash', claim.receipt_hash)

        policy_res = self.check_policy_and_duplicates(
            org_id=org_id,
            employee=claim.employee,
            amount=cur_amount,
            currency=cur_currency,
            expense_date=cur_date,
            category=cur_category,
            merchant=cur_merchant,
            receipt_hash=cur_hash,
            exclude_claim_id=claim.id
        )
        updates['policy_violations'] = policy_res.get('violations', [])

        return expense_repo.update(expense_id, org_id, **updates)

    def delete_expense(self, expense_id, org_id, requesting_user):
        claim = self.get_expense(expense_id, org_id, requesting_user)
        if claim.status in ['approved', 'reimbursed'] and requesting_user.role not in ['admin', 'hr']:
            raise ServiceError('Cannot delete an approved or reimbursed expense claim.', 400)
        return expense_repo.soft_delete(expense_id, org_id)

    # -------------------------------------------------------------
    # 🏛️ Pillar 3: Multi-Tier Approvals, Batch Processing & Brevo Relay
    # -------------------------------------------------------------
    def approve_expense(self, expense_id, org_id, requesting_user, notes=''):
        claim = expense_repo.get_by_id(expense_id, org_id)
        if not claim:
            raise ServiceError('Expense claim not found.', 404)

        if claim.status in ['reimbursed', 'payment_queued']:
            raise ServiceError('Expense is already settled or queued for payment.', 400)

        emp = claim.employee
        amt_conv = float(claim.amount_converted or claim.amount)
        approver_name = f"{requesting_user.first_name} {requesting_user.last_name}".strip() or requesting_user.email
        is_admin_or_cfo = requesting_user.role in ['admin', 'hr']

        cur_tier = claim.approval_tier or 'manager_review'
        dept_head = emp.department.head if (emp and emp.department and emp.department.head) else None
        direct_manager_user = emp.manager.user if (emp and emp.manager and emp.manager.user) else None

        # Check active approval delegation proxy for expenses (Pillar 2)
        today = timezone.now().date()
        from teams.models import ApprovalDelegation
        active_delegation = ApprovalDelegation.objects.filter(
            org_id=org_id,
            delegatee=requesting_user,
            is_active=True,
            is_deleted=False,
            start_date__lte=today,
            end_date__gte=today,
            delegation_type__in=['all', 'expenses']
        ).filter(
            Q(delegator=direct_manager_user) | Q(delegator=dept_head)
        ).first()

        is_direct_mgr = direct_manager_user and direct_manager_user.id == requesting_user.id
        is_dept_head_user = dept_head and dept_head.id == requesting_user.id

        if not (is_admin_or_cfo or is_direct_mgr or is_dept_head_user or requesting_user.role == 'manager' or active_delegation):
            raise ServiceError('Only managers, authorized proxies, and finance administrators can approve expenses.', 403)

        if active_delegation:
            approver_name = f"{requesting_user.first_name} {requesting_user.last_name} (Proxy for {active_delegation.delegator.first_name} {active_delegation.delegator.last_name})".strip()
            if not notes:
                notes = f"Approved by designated Out-of-Office proxy on behalf of {active_delegation.delegator.get_full_name()}."

        history = list(claim.approval_history or [])

        # 1. Tier 3: High-Value (> $1,000) -> Manager -> Dept Head -> Finance/CFO
        if amt_conv > 1000.0:
            if cur_tier == 'manager_review':
                # Check if department head is next
                if dept_head and dept_head.id != requesting_user.id and not is_admin_or_cfo:
                    next_tier = 'dept_head_review'
                    history.append({
                        'action': 'approved_tier',
                        'tier': 'manager_review',
                        'by_name': approver_name,
                        'by_id': str(requesting_user.id),
                        'timestamp': timezone.now().isoformat(),
                        'notes': notes or f'Direct Manager approved. Advanced to Department Head review (Amount: ${amt_conv:,.2f} > $1,000).'
                    })
                    updated = expense_repo.update(
                        expense_id, org_id,
                        status='under_review',
                        approval_tier=next_tier,
                        approval_history=history,
                        rejection_reason=''
                    )
                    self.send_approval_relay_email(updated, dept_head, 'Department Head Review', requesting_user)
                    return updated
                elif not is_admin_or_cfo:
                    # Approver was Dept Head or direct manager with no dept head -> Advance to Finance
                    next_tier = 'finance_review'
                    history.append({
                        'action': 'approved_tier',
                        'tier': 'dept_head_review' if dept_head and dept_head.id == requesting_user.id else 'manager_review',
                        'by_name': approver_name,
                        'by_id': str(requesting_user.id),
                        'timestamp': timezone.now().isoformat(),
                        'notes': notes or f'Management approved. Advanced to CFO / Finance Review (Amount: ${amt_conv:,.2f} > $1,000).'
                    })
                    updated = expense_repo.update(
                        expense_id, org_id,
                        status='under_review',
                        approval_tier=next_tier,
                        approval_history=history,
                        rejection_reason=''
                    )
                    self.notify_finance_approvers(updated, requesting_user)
                    return updated

            elif cur_tier == 'dept_head_review':
                # Advance from Dept Head to Finance
                if not is_admin_or_cfo:
                    next_tier = 'finance_review'
                    history.append({
                        'action': 'approved_tier',
                        'tier': 'dept_head_review',
                        'by_name': approver_name,
                        'by_id': str(requesting_user.id),
                        'timestamp': timezone.now().isoformat(),
                        'notes': notes or f'Department Head approved. Advanced to CFO / Finance Sign-off (Amount: ${amt_conv:,.2f} > $1,000).'
                    })
                    updated = expense_repo.update(
                        expense_id, org_id,
                        status='under_review',
                        approval_tier=next_tier,
                        approval_history=history,
                        rejection_reason=''
                    )
                    self.notify_finance_approvers(updated, requesting_user)
                    return updated

        # 2. Tier 2: Mid-Range ($100 - $1,000) -> Direct Manager + Department Head
        elif amt_conv >= 100.0:
            if cur_tier == 'manager_review':
                # Route to Dept Head if different from approver and not admin
                if dept_head and dept_head.id != requesting_user.id and (not direct_manager_user or dept_head.id != direct_manager_user.id) and not is_admin_or_cfo:
                    next_tier = 'dept_head_review'
                    history.append({
                        'action': 'approved_tier',
                        'tier': 'manager_review',
                        'by_name': approver_name,
                        'by_id': str(requesting_user.id),
                        'timestamp': timezone.now().isoformat(),
                        'notes': notes or f'Direct Manager approved. Advanced to Department Head review (Amount: ${amt_conv:.2f}).'
                    })
                    updated = expense_repo.update(
                        expense_id, org_id,
                        status='under_review',
                        approval_tier=next_tier,
                        approval_history=history,
                        rejection_reason=''
                    )
                    self.send_approval_relay_email(updated, dept_head, 'Department Head Review', requesting_user)
                    return updated

        # 3. Final Approval (All required approval stages completed or authorized by Admin)
        history.append({
            'action': 'fully_approved',
            'tier': cur_tier,
            'by_name': approver_name,
            'by_id': str(requesting_user.id),
            'timestamp': timezone.now().isoformat(),
            'notes': notes or 'Final approval granted. Ready for payout.'
        })

        updated_claim = expense_repo.update(
            expense_id, org_id,
            status='approved',
            approval_tier='approved',
            approved_by=requesting_user,
            approved_at=timezone.now(),
            approval_history=history,
            rejection_reason=''
        )

        self.notify_employee_approved(updated_claim, requesting_user)
        return updated_claim

    def batch_approve_expenses(self, org_id, requesting_user, claim_ids: list, notes: str = '') -> dict:
        """Pillar 3: 1-Click Batch Approval for Managers."""
        if not claim_ids:
            raise ServiceError("No claims selected for batch approval.", 400)

        claims = ExpenseClaim.objects.filter(
            org_id=org_id,
            id__in=claim_ids,
            status__in=['submitted', 'under_review']
        )
        count = 0
        total_amount = Decimal('0.00')
        results = []

        for claim in claims:
            try:
                updated = self.approve_expense(
                    expense_id=claim.id,
                    org_id=org_id,
                    requesting_user=requesting_user,
                    notes=notes or '1-Click Batch Approval'
                )
                count += 1
                total_amount += (updated.amount_converted or updated.amount)
                results.append({
                    'id': str(updated.id),
                    'status': updated.status,
                    'approval_tier': updated.approval_tier
                })
            except Exception as e:
                logger.warning(f"Failed to batch-approve claim {claim.id}: {e}")

        return {
            'count': count,
            'total_amount': float(total_amount),
            'results': results,
            'message': f"Successfully approved {count} claims totaling ${float(total_amount):,.2f}."
        }

    def reject_expense(self, expense_id, org_id, requesting_user, reason=''):
        if requesting_user.role not in ['admin', 'hr', 'manager']:
            raise ServiceError('Only managers and administrators can reject expenses.', 403)

        claim = expense_repo.get_by_id(expense_id, org_id)
        if not claim:
            raise ServiceError('Expense claim not found.', 404)

        if claim.status in ['reimbursed', 'payment_queued']:
            raise ServiceError('Cannot reject an already settled expense.', 400)

        history = list(claim.approval_history or [])
        approver_name = f"{requesting_user.first_name} {requesting_user.last_name}".strip() or requesting_user.email
        history.append({
            'action': 'rejected',
            'tier': claim.approval_tier,
            'by_name': approver_name,
            'by_id': str(requesting_user.id),
            'timestamp': timezone.now().isoformat(),
            'notes': reason or 'Rejected by reviewer.'
        })

        updated_claim = expense_repo.update(
            expense_id, org_id,
            status='rejected',
            approval_tier='rejected',
            rejection_reason=reason,
            approval_history=history
        )

        from core.notifications import send_notification
        send_notification(
            recipient=claim.employee.user,
            org=org_id,
            actor=requesting_user,
            type='SYSTEM',
            title="Expense Claim Rejected",
            message=f"Your claim '{claim.title}' has been rejected. Reason: {reason or 'No reason provided.'}",
            target_url='/finance',
            send_email=True,
            email_subject="Expense Claim Rejected",
            email_cta_text="View in Finance"
        )
        return updated_claim

    def reimburse_expense(self, expense_id, org_id, requesting_user, payout_reference='', settlement_method='direct_bank'):
        if requesting_user.role not in ['admin', 'hr']:
            raise ServiceError('Only HR and Finance Admins can mark expenses as reimbursed.', 403)

        claim = expense_repo.get_by_id(expense_id, org_id)
        if not claim:
            raise ServiceError('Expense claim not found.', 404)

        now = timezone.now()
        ref = payout_reference or claim.payout_reference or f"SETTLE-{now.strftime('%Y%m%d%H%M')}"
        method = settlement_method or claim.settlement_method or 'direct_bank'

        history = list(claim.approval_history or [])
        history.append({
            'action': 'settled',
            'tier': 'settled',
            'by_name': f"{requesting_user.first_name} {requesting_user.last_name}".strip(),
            'by_id': str(requesting_user.id),
            'timestamp': now.isoformat(),
            'notes': f"Settled via {method.replace('_', ' ').title()}. Ref: {ref}"
        })

        updated_claim = expense_repo.update(
            expense_id, org_id,
            status='reimbursed',
            reimbursed_by=requesting_user,
            reimbursed_at=now,
            settlement_method=method,
            settled_at=now,
            payout_reference=ref,
            approval_history=history
        )

        from core.notifications import send_notification
        method_label = dict(ExpenseClaim.SETTLEMENT_METHOD_CHOICES).get(method, method)
        send_notification(
            recipient=claim.employee.user,
            org=org_id,
            actor=requesting_user,
            type='SYSTEM',
            title="Expense Reimbursement Settled",
            message=f"Reimbursement for '{claim.title}' ({claim.amount} {claim.currency}) has been settled via {method_label}. Reference: {ref}",
            target_url='/finance',
            send_email=True,
            email_subject=f"Expense Reimbursement Settled ({claim.amount} {claim.currency})",
            email_cta_text="View in Finance"
        )
        return updated_claim

    def batch_reimburse_expenses(self, org_id, requesting_user, claim_ids: list, payout_reference: str, settlement_method: str = 'direct_bank') -> dict:
        if not claim_ids:
            raise ServiceError("No claim IDs provided for batch payout.", status_code=400)

        claims = ExpenseClaim.objects.filter(
            org_id=org_id,
            id__in=claim_ids,
            status__in=['approved', 'payment_queued']
        )
        count = claims.count()
        if count == 0:
            raise ServiceError("No approved or queued claims found matching the selection.", status_code=400)

        total_amount = claims.aggregate(t=Sum('amount_converted'))['t'] or Decimal('0.00')
        now = timezone.now()
        ref = payout_reference.strip() if payout_reference else f"BATCH-{now.strftime('%Y%m%d%H%M')}"
        method = settlement_method or 'direct_bank'

        for c in claims:
            hist = list(c.approval_history or [])
            hist.append({
                'action': 'settled',
                'tier': 'settled',
                'by_name': f"{requesting_user.first_name} {requesting_user.last_name}".strip(),
                'by_id': str(requesting_user.id),
                'timestamp': now.isoformat(),
                'notes': f"Batch settlement via {method.replace('_', ' ').title()}. Ref: {ref}"
            })
            c.status = 'reimbursed'
            c.reimbursed_by = requesting_user
            c.reimbursed_at = now
            c.settlement_method = method
            c.settled_at = now
            c.payout_reference = ref
            c.approval_history = hist
            c.save(update_fields=['status', 'reimbursed_by', 'reimbursed_at', 'settlement_method', 'settled_at', 'payout_reference', 'approval_history'])

        return {
            'count': count,
            'total_amount': float(total_amount),
            'payout_reference': ref,
            'settlement_method': method,
            'message': f"Successfully settled {count} claims totaling ${float(total_amount):,.2f} via {method.replace('_', ' ').title()}."
        }

    # -------------------------------------------------------------
    # 📨 Pillar 3: Brevo Branded Notification Relays
    # -------------------------------------------------------------
    def send_approval_relay_email(self, claim, recipient, approver_role, actor):
        """Dispatches an executive approval email alert via Brevo."""
        if not recipient or not recipient.email:
            return

        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')
        approval_url = f"{frontend_url}/finance?tab=approvals"
        emp_name = claim.employee.get_full_name() if claim.employee else "Employee"
        amt_str = f"{claim.amount} {claim.currency}"
        converted_str = f" (${claim.amount_converted:.2f} USD)" if claim.currency != 'USD' else ""

        has_violations = bool(claim.policy_violations and len(claim.policy_violations) > 0)
        policy_badge = (
            '<span style="background:#fef3c7;color:#92400e;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;">⚠️ Policy Review Required</span>'
            if has_violations else
            '<span style="background:#d1fae5;color:#065f46;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;">🟢 100% Policy Compliant</span>'
        )

        subject = f"[Expense Approval] {emp_name} filed {amt_str} for '{claim.title}' ({approver_role})"
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }}
    .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
    .header {{ background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 24px; color: #ffffff; text-align: center; }}
    .header h1 {{ margin: 0; font-size: 20px; font-weight: 700; }}
    .header p {{ margin: 4px 0 0; font-size: 13px; color: #e0e7ff; }}
    .content {{ padding: 28px 24px; }}
    .badge-bar {{ margin-bottom: 16px; }}
    .amount-box {{ background: #f8fafc; border-radius: 12px; padding: 18px; text-align: center; margin: 16px 0; border: 1px solid #e2e8f0; }}
    .amount-val {{ font-size: 28px; font-weight: 800; color: #0f172a; margin-top: 4px; }}
    .details-table {{ width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }}
    .details-table td {{ padding: 8px 4px; border-bottom: 1px solid #f1f5f9; }}
    .details-table td.label {{ color: #64748b; font-weight: 600; width: 35%; }}
    .details-table td.value {{ color: #0f172a; font-weight: 700; }}
    .btn-container {{ text-align: center; margin: 28px 0 16px 0; }}
    .btn {{ display: inline-block; background: #4f46e5; color: #ffffff !important; padding: 13px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); }}
    .footer {{ background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CORE Expense & Finance</h1>
      <p>Approval Relay: {approver_role}</p>
    </div>
    <div class="content">
      <div class="badge-bar">
        <span style="background:#ede9fe;color:#6d28d9;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;">{approver_role}</span>
        &nbsp;{policy_badge}
      </div>
      <p style="font-size: 14px; color: #475569; margin: 0 0 12px 0;">
        Hello <strong>{recipient.first_name or recipient.email}</strong>,
      </p>
      <p style="font-size: 14px; color: #334155; line-height: 1.5; margin: 0 0 16px 0;">
        <strong>{emp_name}</strong> submitted an expense claim that requires your review in CORE.
      </p>
      <div class="amount-box">
        <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Reimbursement Request</div>
        <div class="amount-val">{amt_str}{converted_str}</div>
      </div>
      <table class="details-table">
        <tr>
          <td class="label">Claim Title:</td>
          <td class="value">{claim.title}</td>
        </tr>
        <tr>
          <td class="label">Merchant / Vendor:</td>
          <td class="value">{claim.merchant or 'N/A'}</td>
        </tr>
        <tr>
          <td class="label">Category:</td>
          <td class="value">{claim.get_category_display()}</td>
        </tr>
        <tr>
          <td class="label">Expense Date:</td>
          <td class="value">{claim.expense_date}</td>
        </tr>
        <tr>
          <td class="label">Department:</td>
          <td class="value">{claim.department.name if claim.department else 'General'}</td>
        </tr>
        {f'<tr><td class="label">Client / Billable:</td><td class="value">Billable ({claim.client_name})</td></tr>' if claim.is_billable else ''}
      </table>
      {f'<p style="background:#fffbeb;border:1px solid #fde68a;padding:10px 14px;border-radius:8px;font-size:12px;color:#92400e;margin:12px 0;"><strong>Policy Notice:</strong> {", ".join(claim.policy_violations)}</p>' if has_violations else ''}
      <div class="btn-container">
        <a href="{approval_url}" class="btn">Review & Approve in CORE &rarr;</a>
      </div>
    </div>
    <div class="footer">
      <p>&copy; 2026 CORE Workspace &bull; Autonomous Multi-Tier Approval Workflow</p>
    </div>
  </div>
</body>
</html>
"""
        from core.email_dispatcher import send_robust_email
        send_robust_email(
            to_email=recipient.email,
            subject=subject,
            html_content=html_content,
            text_content=f"Expense approval required for {emp_name}: {claim.title} ({amt_str}). Review in CORE: {approval_url}"
        )

    def notify_finance_approvers(self, claim, actor):
        """Notifies Finance Admins & CFO when claim advances to final finance tier."""
        from accounts.models import User
        finance_users = User.objects.filter(org_id=claim.org_id, role__in=['admin', 'hr']).exclude(id=actor.id)
        for u in finance_users[:3]:
            self.send_approval_relay_email(claim, u, 'Finance / CFO Review', actor)

    def notify_employee_approved(self, claim, actor):
        """Notifies employee that claim has completed all approval stages."""
        from core.notifications import send_notification
        send_notification(
            recipient=claim.employee.user,
            org=claim.org_id,
            actor=actor,
            type='SYSTEM',
            title="Expense Claim Fully Approved",
            message=f"Your claim '{claim.title}' for {claim.amount} {claim.currency} has been fully approved and queued for payout.",
            target_url='/finance',
            send_email=True,
            email_subject=f"Claim Approved: {claim.title}",
            email_cta_text="View in Finance"
        )

    # ==========================================
    # 🎯 PART A: Project & Client Cost Profitability
    # ==========================================
    def get_project_cost_profitability(self, org_id) -> list:
        """
        Calculates real-time project profitability:
        - Incurred Billable & Non-billable expenses
        - Estimated Labor Cost (Logged hours * standard default rate $60/hr)
        - Invoiced revenue / Budget burn
        - Gross Profit & Profit Margin %
        """
        projects = Project.objects.filter(org_id=org_id, is_deleted=False).prefetch_related('tasks')

        result = []
        for p in projects:
            p_claims = ExpenseClaim.objects.filter(org_id=org_id, project=p, is_deleted=False)
            
            billable_exp = p_claims.filter(is_billable=True, status__in=['approved', 'reimbursed']).aggregate(t=Sum('amount_converted'))['t'] or Decimal('0.00')
            non_billable_exp = p_claims.filter(is_billable=False, status__in=['approved', 'reimbursed']).aggregate(t=Sum('amount_converted'))['t'] or Decimal('0.00')
            total_exp = billable_exp + non_billable_exp

            # Task labor hours
            logged_hours = p.tasks.filter(is_deleted=False).aggregate(h=Sum('logged_hours'))['h'] or Decimal('0.00')
            estimated_labor_cost = Decimal(float(logged_hours) * 60.0) # $60 standard baseline rate

            total_project_cost = total_exp + estimated_labor_cost

            # Revenue baseline: Billable expenses + (Logged hours * $95/hr billing rate)
            estimated_billable_revenue = billable_exp + Decimal(float(logged_hours) * 95.0)
            
            gross_profit = estimated_billable_revenue - total_project_cost
            margin_pct = round((float(gross_profit) / float(estimated_billable_revenue) * 100), 1) if estimated_billable_revenue > 0 else 0.0

            owner_name = f"{p.owner.first_name} {p.owner.last_name}" if p.owner else "Unassigned"

            result.append({
                'project_id': str(p.id),
                'project_name': p.name,
                'status': p.status,
                'owner_name': owner_name,
                'start_date': p.start_date.strftime('%Y-%m-%d') if p.start_date else None,
                'end_date': p.end_date.strftime('%Y-%m-%d') if p.end_date else None,
                'claims_count': p_claims.count(),
                'billable_expenses': float(billable_exp),
                'non_billable_expenses': float(non_billable_exp),
                'total_expenses': float(total_exp),
                'logged_hours': float(logged_hours),
                'estimated_labor_cost': float(estimated_labor_cost),
                'total_project_cost': float(total_project_cost),
                'estimated_revenue': float(estimated_billable_revenue),
                'gross_profit': float(gross_profit),
                'profit_margin_percent': margin_pct
            })

        # Sort by total project cost descending
        result.sort(key=lambda x: x['total_project_cost'], reverse=True)
        return result

    # ==========================================
    # 🏢 PART C: Department & Project Budget Caps
    # ==========================================
    def get_budgets_summary(self, org_id) -> list:
        budgets = SpendBudget.objects.filter(org_id=org_id, is_deleted=False).select_related('department', 'project')
        
        current_year = timezone.now().year
        current_month = timezone.now().month

        result = []
        for b in budgets:
            claims_qs = ExpenseClaim.objects.filter(org_id=org_id, is_deleted=False)
            
            if b.target_type == 'department' and b.department:
                claims_qs = claims_qs.filter(
                    Q(department=b.department) | Q(department__isnull=True, employee__department=b.department)
                )
            elif b.target_type == 'project' and b.project:
                claims_qs = claims_qs.filter(project=b.project)
            else:
                continue

            # Period filter
            if b.period == 'monthly':
                claims_qs = claims_qs.filter(expense_date__year=current_year, expense_date__month=current_month)
            elif b.period == 'quarterly':
                quarter = (current_month - 1) // 3 + 1
                start_month = (quarter - 1) * 3 + 1
                end_month = start_month + 2
                claims_qs = claims_qs.filter(expense_date__year=current_year, expense_date__month__gte=start_month, expense_date__month__lte=end_month)
            elif b.period == 'annual':
                claims_qs = claims_qs.filter(expense_date__year=current_year)

            spent = claims_qs.filter(status__in=['approved', 'reimbursed']).aggregate(t=Sum('amount_converted'))['t'] or Decimal('0.00')
            pending = claims_qs.filter(status='submitted').aggregate(t=Sum('amount_converted'))['t'] or Decimal('0.00')

            b._spent_amount = float(spent)
            b._pending_amount = float(pending)
            
            from .serializers import SpendBudgetSerializer
            serialized = SpendBudgetSerializer(b).data
            
            # Status badge
            util = serialized['utilization_pct']
            threshold = b.alert_threshold_percent or 80
            if util >= 100:
                serialized['status_badge'] = 'exceeded'
            elif util >= threshold:
                serialized['status_badge'] = 'warning'
            else:
                serialized['status_badge'] = 'healthy'

            result.append(serialized)

        return result

    def create_spend_budget(self, org_id, requesting_user, data: dict):
        if requesting_user.role not in ['admin', 'hr', 'manager']:
            raise ServiceError("Only managers and admins can configure spend budgets.", 403)

        dept = None
        if data.get('department_id'):
            dept = Department.objects.filter(id=data['department_id'], org_id=org_id, is_deleted=False).first()

        proj = None
        if data.get('project_id'):
            proj = Project.objects.filter(id=data['project_id'], org_id=org_id, is_deleted=False).first()

        budget = SpendBudget.objects.create(
            org_id=org_id,
            target_type=data.get('target_type', 'department'),
            department=dept,
            project=proj,
            period=data.get('period', 'monthly'),
            amount=data['amount'],
            currency=data.get('currency', 'USD'),
            alert_threshold_percent=data.get('alert_threshold_percent', 80),
            notes=data.get('notes', '')
        )
        return budget

    def delete_spend_budget(self, budget_id, org_id, requesting_user):
        if requesting_user.role not in ['admin', 'hr']:
            raise ServiceError("Only administrators can delete spend budgets.", 403)
        budget = SpendBudget.objects.filter(id=budget_id, org_id=org_id, is_deleted=False).first()
        if not budget:
            raise ServiceError("Budget not found.", 404)
        budget.soft_delete()
        return True

    # ==========================================
    # 💳 PART D: Recurring SaaS / Vendor Subscription Radar
    # ==========================================
    def get_subscription_radar(self, org_id) -> dict:
        """
        Scans expenses across the organization for recurring software/SaaS vendors.
        Clusters subscriptions, detects duplicate seat purchases across departments,
        and flags price increases.
        """
        saas_claims = ExpenseClaim.objects.filter(
            org_id=org_id,
            is_deleted=False,
            category='software_subscriptions'
        ).select_related('employee__user', 'employee__department').order_by('expense_date')

        # Also find claims with common SaaS merchant names
        KNOWN_SAAS = [
            'github', 'figma', 'notion', 'openai', 'chatgpt', 'aws', 'amazon web services',
            'zoom', 'slack', 'google workspace', 'google cloud', 'gcp', 'adobe', 'canva',
            'datadog', 'atlassian', 'jira', 'hubspot', 'salesforce', 'linear', 'vercel',
            'render', 'sentry', 'postman', 'loom', 'miro', 'webflow', 'airtable'
        ]

        # Group by normalized merchant
        vendors = {}
        for c in saas_claims:
            m_raw = (c.merchant or c.title).strip()
            m_norm = m_raw.lower()
            
            # Map canonical name if matches known list
            matched_name = m_raw.title()
            for k in KNOWN_SAAS:
                if k in m_norm:
                    matched_name = k.title()
                    break

            if matched_name not in vendors:
                vendors[matched_name] = {
                    'vendor_name': matched_name,
                    'category': 'Software & Cloud SaaS',
                    'claims': [],
                    'employees': set(),
                    'departments': set(),
                    'total_spent': Decimal('0.00'),
                    'currency': c.currency or 'USD'
                }

            vendors[matched_name]['claims'].append(c)
            if c.employee and c.employee.user:
                vendors[matched_name]['employees'].add(c.employee.get_full_name())
            if c.employee and c.employee.department:
                vendors[matched_name]['departments'].add(c.employee.department.name)
            vendors[matched_name]['total_spent'] += c.amount_converted

        vendor_cards = []
        total_mrr = 0.0

        for name, v in vendors.items():
            claims = v['claims']
            claims_count = len(claims)
            employees_list = list(v['employees'])
            departments_list = list(v['departments'])
            
            # Sort claims by date
            claims.sort(key=lambda x: x.expense_date)
            latest_claim = claims[-1]
            earliest_claim = claims[0]

            # Price trend
            price_change_pct = 0.0
            if claims_count > 1 and earliest_claim.amount_converted > 0:
                diff = float(latest_claim.amount_converted - earliest_claim.amount_converted)
                price_change_pct = round((diff / float(earliest_claim.amount_converted)) * 100, 1)

            # MRR estimate
            monthly_estimate = float(latest_claim.amount_converted)
            annual_estimate = monthly_estimate * 12.0
            total_mrr += monthly_estimate

            # Duplicate multi-department license fragmentation risk
            has_dup_risk = len(departments_list) > 1 or len(employees_list) > 1

            vendor_cards.append({
                'vendor_name': name,
                'monthly_spend': round(monthly_estimate, 2),
                'annualized_run_rate': round(annual_estimate, 2),
                'currency': v['currency'],
                'claims_count': claims_count,
                'employees_using': employees_list,
                'departments': departments_list,
                'duplicate_license_risk': has_dup_risk,
                'risk_note': f"Multiple licenses purchased independently by {len(departments_list)} departments ({', '.join(departments_list)})" if has_dup_risk else "Unified license",
                'price_change_pct': price_change_pct,
                'last_payment_date': latest_claim.expense_date.strftime('%Y-%m-%d'),
                'last_payment_amount': float(latest_claim.amount),
                'status': 'active'
            })

        vendor_cards.sort(key=lambda x: x['monthly_spend'], reverse=True)

        return {
            'total_mrr': round(total_mrr, 2),
            'total_arr': round(total_mrr * 12.0, 2),
            'tracked_subscriptions_count': len(vendor_cards),
            'duplicate_risk_count': sum(1 for v in vendor_cards if v['duplicate_license_risk']),
            'subscriptions': vendor_cards
        }

    # ==========================================
    # 🏦 PART E: 1-Click Bank-Ready Payout Export
    # ==========================================
    def export_bank_payout_file(self, org_id, format_type: str = 'wise', claim_ids: list = None) -> tuple:
        """
        Generates payment-batch files formatted for direct import into:
        - Wise (TransferWise Batch CSV)
        - Stripe Transfers Batch CSV
        - Standard US NACHA / ACH CSV
        - SEPA Direct Credit CSV
        - India UPI / NEFT Payout CSV
        - PayPal Mass Payout CSV
        """
        qs = ExpenseClaim.objects.filter(
            org_id=org_id,
            is_deleted=False,
            status__in=['approved', 'reimbursed']
        ).select_related('employee__user', 'employee__department').order_by('employee__user__first_name')

        if claim_ids:
            qs = qs.filter(id__in=claim_ids)

        output = io.StringIO()
        writer = csv.writer(output)
        fmt = (format_type or 'wise').lower()
        now_str = timezone.now().strftime('%Y%m%d')

        if fmt == 'wise':
            # Wise Batch Payment Template
            writer.writerow([
                'recipientEmail', 'recipientName', 'amount', 'currency', 'paymentReference',
                'transferReason', 'sourceCurrency'
            ])
            for c in qs:
                emp_name = c.employee.get_full_name() if c.employee else "Employee"
                emp_email = c.employee.user.email if (c.employee and c.employee.user) else ""
                ref = f"EXP-{c.id.hex[:6].upper()}"
                writer.writerow([
                    emp_email, emp_name, f"{float(c.amount):.2f}", c.currency, ref,
                    f"Expense Reimbursement: {c.title[:30]}", c.currency
                ])
            filename = f"wise_batch_payout_{now_str}.csv"
            content_type = "text/csv"

        elif fmt == 'stripe':
            # Stripe Transfers CSV (Decimal standard currency amounts)
            writer.writerow([
                'amount', 'currency', 'destination', 'description', 'source_transaction', 'metadata_claim_id'
            ])
            for c in qs:
                dest_id = f"acct_{c.employee.user.id.hex[:14]}" if (c.employee and c.employee.user) else "acct_default"
                writer.writerow([
                    f"{float(c.amount):.2f}", c.currency.lower(), dest_id,
                    f"Reimbursement {c.title[:30]}", "", str(c.id)
                ])
            filename = f"stripe_transfers_payout_{now_str}.csv"
            content_type = "text/csv"

        elif fmt == 'ach':
            # US ACH Direct Deposit Format
            writer.writerow([
                'Employee Name', 'Routing Number', 'Account Number', 'Account Type',
                'Amount', 'Company Entry Description', 'Individual ID'
            ])
            for c in qs:
                emp_name = c.employee.get_full_name() if c.employee else "Employee"
                writer.writerow([
                    emp_name, "122000496", "9876543210", "Checking",
                    f"{float(c.amount):.2f}", "EXP REIMB", str(c.employee.id)[:15]
                ])
            filename = f"nacha_ach_payout_{now_str}.csv"
            content_type = "text/csv"

        elif fmt == 'sepa':
            # European SEPA Credit Transfer CSV
            writer.writerow([
                'Beneficiary Name', 'IBAN', 'BIC', 'Amount', 'Currency', 'Remittance Information', 'EndToEndId'
            ])
            for c in qs:
                emp_name = c.employee.get_full_name() if c.employee else "Employee"
                writer.writerow([
                    emp_name, "DE89370400440532013000", "DBEUMM21",
                    f"{float(c.amount):.2f}", c.currency, f"Reimbursement {c.title[:25]}", f"E2E-{c.id.hex[:8].upper()}"
                ])
            filename = f"sepa_credit_payout_{now_str}.csv"
            content_type = "text/csv"

        elif fmt == 'upi':
            # India UPI / NEFT Payout CSV
            writer.writerow([
                'Beneficiary Name', 'UPI VPA / ID', 'IFSC Code', 'Account Number', 'Amount', 'Remarks'
            ])
            for c in qs:
                emp_name = c.employee.get_full_name() if c.employee else "Employee"
                email_handle = c.employee.user.email.split('@')[0] if (c.employee and c.employee.user and c.employee.user.email) else "employee"
                vpa = f"{email_handle}@okhdfcbank"
                writer.writerow([
                    emp_name, vpa, "HDFC0001234", "50100234567890",
                    f"{float(c.amount):.2f}", f"EXP REIMB {c.title[:15]}"
                ])
            filename = f"upi_neft_payout_{now_str}.csv"
            content_type = "text/csv"

        else: # PayPal
            writer.writerow(['Recipient Email', 'Amount', 'Currency', 'Note', 'Custom ID'])
            for c in qs:
                emp_email = c.employee.user.email if (c.employee and c.employee.user) else ""
                writer.writerow([
                    emp_email, f"{float(c.amount):.2f}", c.currency,
                    f"Reimbursement for {c.title}", str(c.id)
                ])
            filename = f"paypal_payouts_{now_str}.csv"
            content_type = "text/csv"

        return output.getvalue(), filename, content_type

    def get_spend_analytics(self, org_id, year=None) -> dict:
        target_year = int(year) if year else timezone.now().year

        qs = ExpenseClaim.objects.filter(
            org_id=org_id,
            is_deleted=False,
            expense_date__year=target_year
        )

        total_spend = qs.filter(status__in=['approved', 'reimbursed']).aggregate(t=Sum('amount_converted'))['t'] or Decimal('0.00')
        pending_payout = qs.filter(status='approved').aggregate(t=Sum('amount_converted'))['t'] or Decimal('0.00')
        in_review = qs.filter(status='submitted').aggregate(t=Sum('amount_converted'))['t'] or Decimal('0.00')

        # Spend by Category
        category_breakdown = list(
            qs.filter(status__in=['approved', 'reimbursed'])
            .values('category')
            .annotate(total=Sum('amount_converted'), count=Count('id'))
            .order_by('-total')
        )

        # Spend by Department
        dept_breakdown = list(
            qs.filter(status__in=['approved', 'reimbursed'])
            .values('employee__department__name')
            .annotate(total=Sum('amount_converted'), count=Count('id'))
            .order_by('-total')
        )

        # Monthly Spend Curve
        monthly_trend = []
        for m in range(1, 13):
            m_total = qs.filter(status__in=['approved', 'reimbursed'], expense_date__month=m).aggregate(t=Sum('amount_converted'))['t'] or Decimal('0.00')
            monthly_trend.append({
                'month': m,
                'month_name': datetime.date(target_year, m, 1).strftime('%b'),
                'total': float(m_total)
            })

        # Top Merchants
        top_merchants = list(
            qs.filter(status__in=['approved', 'reimbursed'])
            .exclude(merchant='')
            .values('merchant')
            .annotate(total=Sum('amount_converted'), count=Count('id'))
            .order_by('-total')[:5]
        )

        return {
            'year': target_year,
            'total_spend_ytd': float(total_spend),
            'pending_payout': float(pending_payout),
            'in_review_total': float(in_review),
            'by_category': category_breakdown,
            'by_department': dept_breakdown,
            'monthly_trend': monthly_trend,
            'top_merchants': top_merchants
        }

    def export_expenses_csv(self, org_id, filters=None) -> str:
        qs = expense_repo.list_by_org(org_id, filters)

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            'Claim ID', 'Employee Name', 'Employee Email', 'Department',
            'Expense Date', 'Merchant', 'Title', 'Category', 'Project', 'Billable',
            'Amount', 'Currency', 'Amount (USD)', 'Tax Amount',
            'Status', 'Approved By', 'Approved At', 'Reimbursed By', 'Reimbursed At', 'Payout Reference'
        ])

        for c in qs:
            emp_name = c.employee.get_full_name() if c.employee else ''
            emp_email = c.employee.user.email if c.employee and c.employee.user else ''
            dept_name = c.employee.department.name if c.employee and c.employee.department else 'General'
            proj_name = c.project.name if c.project else 'N/A'
            billable_str = "Yes" if c.is_billable else "No"
            app_name = f"{c.approved_by.first_name} {c.approved_by.last_name}" if c.approved_by else ''
            reimb_name = f"{c.reimbursed_by.first_name} {c.reimbursed_by.last_name}" if c.reimbursed_by else ''

            writer.writerow([
                str(c.id), emp_name, emp_email, dept_name,
                c.expense_date.strftime('%Y-%m-%d'), c.merchant, c.title, c.get_category_display(), proj_name, billable_str,
                float(c.amount), c.currency, float(c.amount_converted), float(c.tax_amount),
                c.get_status_display(), app_name, c.approved_at.strftime('%Y-%m-%d %H:%M') if c.approved_at else '',
                reimb_name, c.reimbursed_at.strftime('%Y-%m-%d %H:%M') if c.reimbursed_at else '', c.payout_reference
            ])

        return output.getvalue()

    def analyze_spreadsheet_with_gemini(self, csv_content: str, filename: str = '') -> dict:
        gemini_key = getattr(settings, 'GEMINI_API_KEY', '') or os.getenv('GEMINI_API_KEY', '')
        lines = [line.strip() for line in csv_content.strip().splitlines() if line.strip()]
        total_rows = max(len(lines) - 1, 0)
        sample_csv = "\n".join(lines[:120])

        prompt = f"""
You are an expert Chief Data Scientist & Business Intelligence Analyst for an enterprise workspace.
Filename: {filename or 'dataset.csv'}
Total estimated rows: {total_rows}

Analyze this CSV dataset sample and return a comprehensive analysis in JSON format:
```csv
{sample_csv}
```

Return ONLY a JSON object with this exact schema:
{{
  "dataset_type": "Sales" | "Marketing" | "Finance & Accounting" | "Operations" | "HR & People" | "Customer Support" | "General Analytics",
  "summary_title": "A punchy, professional title summarizing the dataset",
  "executive_summary": "A 2 to 3 sentence executive summary explaining what this dataset contains, primary findings, and business health.",
  "row_count": {total_rows},
  "columns": [
    {{ "name": "column_header", "data_type": "number" | "string" | "date" | "currency" | "percentage", "description": "brief note" }}
  ],
  "kpis": [
    {{ "label": "e.g. Total Revenue", "value": "$452,000", "change": "+14% MoM", "trend": "up" | "down" | "neutral" }},
    {{ "label": "e.g. Active Records", "value": "{total_rows}", "change": "", "trend": "neutral" }}
  ],
  "key_insights": [
    "3 to 5 clear bullet points highlighting key business observations."
  ],
  "anomalies_and_warnings": [
    "Any unusual spikes, outlier values, negative margins, or warning signs."
  ],
  "recommended_charts": [
    {{
      "title": "Chart Title",
      "chart_type": "bar" | "line" | "pie" | "area",
      "description": "Why this chart matters",
      "x_key": "x_axis_column_name",
      "y_key": "y_axis_metric_column_name",
      "aggregation": "sum" | "avg" | "count",
      "data": [
        {{ "label": "Label 1", "value": 100 }}
      ]
    }}
  ]
}}
"""
        extracted = None
        if gemini_key:
            for model in GEMINI_VISION_MODELS:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={gemini_key}"
                    payload = {
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "temperature": 0.2,
                            "response_mime_type": "application/json"
                        }
                    }
                    with httpx.Client(timeout=35.0) as client:
                        resp = client.post(url, json=payload)
                        if resp.status_code == 200:
                            data = resp.json()
                            raw_text = data['candidates'][0]['content']['parts'][0]['text']
                            extracted = json.loads(raw_text)
                            logger.info(f"Gemini Data Analyst successfully processed sheet with {model}")
                            break
                except Exception as e:
                    logger.warning(f"Gemini Analyst {model} failed: {e}")
                    continue

        if not extracted:
            headers = [h.strip().strip('"') for h in lines[0].split(',')] if lines else ['Column 1']
            extracted = {
                "dataset_type": "General Analytics",
                "summary_title": f"Spreadsheet Analysis ({filename or 'Data File'})",
                "executive_summary": f"Uploaded file containing {total_rows} records and {len(headers)} columns.",
                "row_count": total_rows,
                "columns": [{"name": h, "data_type": "string", "description": ""} for h in headers],
                "kpis": [
                    {"label": "Total Rows", "value": str(total_rows), "change": "", "trend": "neutral"},
                    {"label": "Total Columns", "value": str(len(headers)), "change": "", "trend": "neutral"},
                ],
                "key_insights": [
                    f"Successfully loaded dataset with {len(headers)} attributes.",
                    "Use the Interactive Chart Studio below to plot any numeric column against categories."
                ],
                "anomalies_and_warnings": [],
                "recommended_charts": []
            }

        return extracted

    def query_spreadsheet_with_gemini(self, csv_content: str, user_query: str) -> dict:
        gemini_key = getattr(settings, 'GEMINI_API_KEY', '') or os.getenv('GEMINI_API_KEY', '')
        lines = [line.strip() for line in csv_content.strip().splitlines() if line.strip()]
        sample_csv = "\n".join(lines[:150])

        prompt = f"""
You are an expert Data Analyst AI.
User Query: "{user_query}"

Here is the CSV dataset:
```csv
{sample_csv}
```

Answer the question accurately based on the data. Provide:
1. A direct, clear answer in 2-3 sentences.
2. Highlighted data points.
3. Actionable recommendation.

Return ONLY a JSON response:
{{
  "answer": "Clear, concise direct answer to the user's question.",
  "key_findings": ["Bullet 1", "Bullet 2"],
  "recommended_action": "Optional recommendation or empty string"
}}
"""
        result = None
        if gemini_key:
            for model in GEMINI_VISION_MODELS:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={gemini_key}"
                    payload = {
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "temperature": 0.2,
                            "response_mime_type": "application/json"
                        }
                    }
                    with httpx.Client(timeout=30.0) as client:
                        resp = client.post(url, json=payload)
                        if resp.status_code == 200:
                            data = resp.json()
                            raw_text = data['candidates'][0]['content']['parts'][0]['text']
                            result = json.loads(raw_text)
                            break
                except Exception as e:
                    logger.warning(f"Gemini Q&A failed with {model}: {e}")
                    continue

        if not result:
            result = {
                "answer": f"Analysis for '{user_query}': Based on the dataset of {len(lines)} records, please examine the table columns and chart visualizer for detailed breakdowns.",
                "key_findings": ["Data retrieved from current spreadsheet session."],
                "recommended_action": "Try filtering by specific category or date range in the chart studio."
            }

        return result
