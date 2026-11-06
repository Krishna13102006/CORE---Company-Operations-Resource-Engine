from django.http import HttpResponse
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.renderers import BaseRenderer
from rest_framework.negotiation import DefaultContentNegotiation
from core.permissions import IsEmployee, IsManager, IsHR
from core.exceptions import ServiceError
from core.pagination import StandardPagination
from core.audit import log_action
from teams.models import Employee
from .services import ExpenseService
from .serializers import (
    ExpenseClaimSerializer, ExpenseClaimCreateSerializer,
    ExpenseClaimUpdateSerializer, ExpenseRejectSerializer,
    ExpenseReimburseSerializer, SpendBudgetSerializer, SpendBudgetCreateSerializer
)

class IgnoreFormatNegotiation(DefaultContentNegotiation):
    def filter_renderers(self, renderers, format):
        return renderers

class PassthroughRenderer(BaseRenderer):
    media_type = '*/*'
    format = 'txt'
    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data

def get_request_org_id(request):
    org_id = getattr(request, 'org_id', None)
    if not org_id and hasattr(request, 'user') and getattr(request.user, 'is_authenticated', False):
        org_id = getattr(request.user, 'org_id', None)
    return org_id


expense_service = ExpenseService()


class ReceiptScanView(APIView):
    permission_classes = [IsEmployee]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        receipt_file = request.FILES.get('receipt') or request.FILES.get('file')
        content_type = 'image/jpeg'
        file_bytes = None

        if receipt_file:
            file_bytes = receipt_file.read()
            content_type = receipt_file.content_type
        else:
            # Direct clipboard paste (base64 JSON payload)
            base64_data = request.data.get('image_base64') or request.data.get('receipt_base64')
            if base64_data:
                import base64
                if ',' in base64_data:
                    base64_data = base64_data.split(',', 1)[1]
                try:
                    file_bytes = base64.b64decode(base64_data)
                    content_type = request.data.get('content_type', 'image/png')
                except Exception as b_err:
                    return Response({'error': f"Invalid base64 image data: {b_err}"}, status=status.HTTP_400_BAD_REQUEST)

        if not file_bytes:
            return Response({'error': 'No receipt file or image provided.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            scan_result = expense_service.scan_receipt_with_gemini(file_bytes, content_type)
            return Response(scan_result)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BatchReceiptScanView(APIView):
    """Bulk Multi-Receipt Dropzone: scans up to 10 receipts in parallel."""
    permission_classes = [IsEmployee]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        files = request.FILES.getlist('receipts') or request.FILES.getlist('files')
        if not files:
            single = request.FILES.get('receipt') or request.FILES.get('file')
            files = [single] if single else []

        if not files:
            return Response({'error': 'No receipt files provided.'}, status=status.HTTP_400_BAD_REQUEST)

        results = []
        for f in files[:10]:
            try:
                f_bytes = f.read()
                res = expense_service.scan_receipt_with_gemini(f_bytes, f.content_type)
                res['file_name'] = f.name
                results.append(res)
            except Exception as e:
                results.append({
                    'file_name': f.name,
                    'error': str(e),
                    'merchant': f.name.rsplit('.', 1)[0] if '.' in f.name else f.name,
                    'amount': 0.0,
                    'currency': 'USD',
                    'category': 'other',
                    'confidence_score': 0.0
                })

        return Response({'scanned_count': len(results), 'results': results})


class ExchangeRatesView(APIView):
    """Multi-Currency & Live Exchange Rates with Mileage & Per-Diem policies."""
    permission_classes = [IsEmployee]

    def get(self, request):
        return Response({
            'base_currency': 'USD',
            'rates': {
                'USD': 1.0,
                'EUR': 1.085,
                'GBP': 1.295,
                'INR': 0.0119,
                'CAD': 0.725,
                'AUD': 0.655,
                'JPY': 0.0066,
                'SGD': 0.755,
                'AED': 0.272,
                'CHF': 1.135
            },
            'mileage_policy': {
                'rate_per_mile_usd': 0.67,
                'rate_per_km_usd': 0.42,
                'currency': 'USD'
            },
            'per_diem_policy': {
                'default_daily_rate_usd': 75.0,
                'metro_daily_rate_usd': 110.0,
                'international_daily_rate_usd': 140.0,
                'currency': 'USD'
            }
        })


class PolicyCheckView(APIView):
    permission_classes = [IsEmployee]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        org_id = get_request_org_id(request)
        emp = Employee.objects.filter(user=request.user, org_id=org_id, is_deleted=False).first()
        receipt_file = request.FILES.get('receipt_file')
        receipt_bytes = None
        if receipt_file:
            try:
                receipt_bytes = receipt_file.read()
            except Exception:
                pass

        ocr_data = request.data.get('ocr_data')
        if isinstance(ocr_data, str):
            try:
                ocr_data = json.loads(ocr_data)
            except Exception:
                ocr_data = {}

        result = expense_service.check_policy_and_duplicates(
            org_id=org_id,
            employee=emp,
            amount=request.data.get('amount', 0),
            currency=request.data.get('currency', 'USD'),
            expense_date=request.data.get('expense_date'),
            category=request.data.get('category', 'other'),
            merchant=request.data.get('merchant', ''),
            receipt_bytes=receipt_bytes,
            receipt_hash=request.data.get('receipt_hash', ''),
            exclude_claim_id=request.data.get('claim_id'),
            ocr_data=ocr_data
        )
        return Response(result)


class ExpenseMySummaryView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        try:
            summary = expense_service.get_my_expense_summary(get_request_org_id(request), request.user)
            return Response(summary)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class ExpenseListView(APIView):
    permission_classes = [IsEmployee]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        org_id = get_request_org_id(request)
        filters = {
            'status':      request.query_params.get('status'),
            'category':    request.query_params.get('category'),
            'employee':    request.query_params.get('employee'),
            'project':     request.query_params.get('project'),
            'is_billable': request.query_params.get('is_billable'),
            'search':      request.query_params.get('search'),
            'year':        request.query_params.get('year'),
            'month':       request.query_params.get('month'),
        }
        filters = {k: v for k, v in filters.items() if v is not None and v != ''}

        claims = expense_service.list_expenses(org_id, request.user, filters)

        if request.query_params.get('all') == 'true':
            return Response(ExpenseClaimSerializer(claims, many=True).data)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(claims, request)
        return paginator.get_paginated_response(
            ExpenseClaimSerializer(page, many=True).data
        )

    def post(self, request):
        org_id = get_request_org_id(request)
        serializer = ExpenseClaimCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        receipt_file = request.FILES.get('receipt_file')

        try:
            claim = expense_service.create_expense(
                org_id=org_id,
                requesting_user=request.user,
                data=d,
                receipt_file=receipt_file
            )
            log_action(
                org_id=org_id,
                user=request.user,
                action='create_expense_claim',
                target_type='expense_claim',
                target_id=claim.id,
                detail=f'Filed claim: {claim.title} ({claim.amount} {claim.currency})'
            )
            return Response(
                ExpenseClaimSerializer(claim).data,
                status=status.HTTP_201_CREATED
            )
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class ExpenseDetailView(APIView):
    permission_classes = [IsEmployee]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, expense_id):
        org_id = get_request_org_id(request)
        try:
            claim = expense_service.get_expense(str(expense_id), org_id, request.user)
            return Response(ExpenseClaimSerializer(claim).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)

    def patch(self, request, expense_id):
        org_id = get_request_org_id(request)
        serializer = ExpenseClaimUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        receipt_file = request.FILES.get('receipt_file')
        try:
            claim = expense_service.update_expense(
                expense_id=str(expense_id),
                org_id=org_id,
                requesting_user=request.user,
                data=serializer.validated_data,
                receipt_file=receipt_file
            )
            log_action(
                org_id=org_id,
                user=request.user,
                action='update_expense_claim',
                target_type='expense_claim',
                target_id=claim.id,
                detail=f'Updated claim: {claim.title}'
            )
            return Response(ExpenseClaimSerializer(claim).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)

    def delete(self, request, expense_id):
        org_id = get_request_org_id(request)
        try:
            claim = expense_service.delete_expense(str(expense_id), org_id, request.user)
            log_action(
                org_id=org_id,
                user=request.user,
                action='delete_expense_claim',
                target_type='expense_claim',
                target_id=expense_id,
                detail=f'Deleted expense claim ID: {expense_id}'
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class ExpenseApproveView(APIView):
    permission_classes = [IsManager]

    def post(self, request, expense_id):
        org_id = get_request_org_id(request)
        notes = request.data.get('notes', '')
        try:
            claim = expense_service.approve_expense(str(expense_id), org_id, request.user, notes=notes)
            log_action(
                org_id=org_id,
                user=request.user,
                action='approve_expense_claim',
                target_type='expense_claim',
                target_id=claim.id,
                detail=f'Approved expense claim: {claim.title} ({claim.amount} {claim.currency}). Tier: {claim.approval_tier}'
            )
            return Response(ExpenseClaimSerializer(claim).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class ExpenseBatchApproveView(APIView):
    permission_classes = [IsManager]

    def post(self, request):
        org_id = get_request_org_id(request)
        serializer = ExpenseBatchApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        claim_ids = serializer.validated_data['claim_ids']
        notes = serializer.validated_data.get('notes', '')
        try:
            result = expense_service.batch_approve_expenses(
                org_id=org_id,
                requesting_user=request.user,
                claim_ids=claim_ids,
                notes=notes
            )
            log_action(
                org_id=org_id,
                user=request.user,
                action='batch_approve_expenses',
                target_type='expense_claim',
                target_id=str(org_id),
                detail=f"Batch approved {result['count']} claims totaling ${result['total_amount']:,.2f}"
            )
            return Response(result)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class ExpenseRejectView(APIView):
    permission_classes = [IsManager]

    def post(self, request, expense_id):
        org_id = get_request_org_id(request)
        serializer = ExpenseRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data.get('reason', '')
        try:
            claim = expense_service.reject_expense(str(expense_id), org_id, request.user, reason=reason)
            log_action(
                org_id=org_id,
                user=request.user,
                action='reject_expense_claim',
                target_type='expense_claim',
                target_id=claim.id,
                detail=f'Rejected claim: {claim.title}. Reason: {reason}'
            )
            return Response(ExpenseClaimSerializer(claim).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class ExpenseReimburseView(APIView):
    permission_classes = [IsHR]

    def post(self, request, expense_id):
        org_id = get_request_org_id(request)
        serializer = ExpenseReimburseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payout_ref = serializer.validated_data.get('payout_reference', '')
        method = serializer.validated_data.get('settlement_method', 'direct_bank')
        try:
            claim = expense_service.reimburse_expense(
                str(expense_id), org_id, request.user, payout_reference=payout_ref, settlement_method=method
            )
            log_action(
                org_id=org_id,
                user=request.user,
                action='reimburse_expense_claim',
                target_type='expense_claim',
                target_id=claim.id,
                detail=f'Reimbursed claim: {claim.title} via {method}. Ref: {payout_ref}'
            )
            return Response(ExpenseClaimSerializer(claim).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class ExpenseBatchPayoutView(APIView):
    permission_classes = [IsHR]

    def post(self, request):
        org_id = get_request_org_id(request)
        claim_ids = request.data.get('claim_ids', [])
        payout_ref = request.data.get('payout_reference', '')
        settlement_method = request.data.get('settlement_method', 'direct_bank')

        if not claim_ids or not isinstance(claim_ids, list):
            return Response({'error': 'A list of claim_ids is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = expense_service.batch_reimburse_expenses(
                org_id=org_id,
                requesting_user=request.user,
                claim_ids=claim_ids,
                payout_reference=payout_ref,
                settlement_method=settlement_method
            )
            log_action(
                org_id=org_id,
                user=request.user,
                action='batch_reimburse_expenses',
                target_type='expense_claim',
                target_id=str(org_id),
                detail=f"Batch reimbursed {result['count']} claims via {settlement_method}. Ref: {result['payout_reference']}"
            )
            return Response(result)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProjectCostProfitabilityView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        try:
            data = expense_service.get_project_cost_profitability(get_request_org_id(request))
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SpendBudgetView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        try:
            budgets = expense_service.get_budgets_summary(get_request_org_id(request))
            return Response(budgets)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        org_id = get_request_org_id(request)
        serializer = SpendBudgetCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            budget = expense_service.create_spend_budget(org_id, request.user, serializer.validated_data)
            return Response(SpendBudgetSerializer(budget).data, status=status.HTTP_201_CREATED)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class SpendBudgetDetailView(APIView):
    permission_classes = [IsManager]

    def delete(self, request, budget_id):
        try:
            expense_service.delete_spend_budget(str(budget_id), get_request_org_id(request), request.user)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class SubscriptionRadarView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        try:
            data = expense_service.get_subscription_radar(get_request_org_id(request))
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BankPayoutExportView(APIView):
    permission_classes = [IsHR]
    renderer_classes = [PassthroughRenderer]
    content_negotiation_class = IgnoreFormatNegotiation

    def get(self, request):
        fmt = (
            request.query_params.get('payout_format') or
            request.query_params.get('export_format') or
            request.query_params.get('format_type') or
            request.query_params.get('format') or
            'wise'
        )
        claim_ids = request.query_params.getlist('claim_ids') or None
        
        try:
            csv_data, filename, content_type = expense_service.export_bank_payout_file(
                get_request_org_id(request), format_type=fmt, claim_ids=claim_ids
            )
            response = HttpResponse(csv_data, content_type=content_type)
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ExpenseAnalyticsView(APIView):
    permission_classes = [IsHR]

    def get(self, request):
        year = request.query_params.get('year')
        try:
            analytics = expense_service.get_spend_analytics(get_request_org_id(request), year=year)
            return Response(analytics)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ExpenseExportCSVView(APIView):
    permission_classes = [IsHR]
    renderer_classes = [PassthroughRenderer]
    content_negotiation_class = IgnoreFormatNegotiation

    def get(self, request):
        filters = {
            'status':   request.query_params.get('status'),
            'category': request.query_params.get('category'),
            'year':     request.query_params.get('year'),
            'month':    request.query_params.get('month'),
        }
        filters = {k: v for k, v in filters.items() if v}
        csv_data = expense_service.export_expenses_csv(get_request_org_id(request), filters)

        response = HttpResponse(csv_data, content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="expenses_export_{timezone.now().strftime("%Y%m%d")}.csv"'
        return response


class SpreadsheetAnalyzeView(APIView):
    permission_classes = [IsEmployee]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        csv_file = request.FILES.get('file')
        csv_text = request.data.get('csv_text', '')
        filename = ''

        if csv_file:
            filename = csv_file.name
            try:
                csv_text = csv_file.read().decode('utf-8', errors='ignore')
            except Exception as e:
                return Response({'error': f'Failed to read file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not csv_text or not csv_text.strip():
            return Response({'error': 'No CSV text or file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            analysis = expense_service.analyze_spreadsheet_with_gemini(csv_text, filename=filename)
            return Response(analysis)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SpreadsheetQueryView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request):
        csv_text = request.data.get('csv_text', '')
        query = request.data.get('query', '').strip()

        if not csv_text:
            return Response({'error': 'No CSV dataset context provided.'}, status=status.HTTP_400_BAD_REQUEST)
        if not query:
            return Response({'error': 'Query text is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = expense_service.query_spreadsheet_with_gemini(csv_text, query)
            return Response(result)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
