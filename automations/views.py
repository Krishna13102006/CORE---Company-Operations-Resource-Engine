import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from core.permissions import IsAdmin, IsHR, IsEmployee
from core.pagination import StandardPagination

from .models import Playbook, AutomationExecutionLog
from .serializers import (
    PlaybookSerializer,
    PlaybookToggleSerializer,
    PlaybookConfigSerializer,
    AutomationExecutionLogSerializer,
)
from .services import AutomationService

logger = logging.getLogger(__name__)


class PlaybookListView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        org_id = getattr(request, 'org_id', None)
        if not org_id:
            return Response({'error': 'Organization context missing.'}, status=status.HTTP_400_BAD_REQUEST)

        playbooks = Playbook.objects.filter(org_id=org_id)
        if not playbooks.exists():
            playbooks = AutomationService.get_or_create_default_playbooks(org_id, request.user)

        serializer = PlaybookSerializer(playbooks, many=True)
        return Response(serializer.data)


class PlaybookToggleView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, slug):
        org_id = getattr(request, 'org_id', None)
        serializer = PlaybookToggleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        is_enabled = serializer.validated_data['is_enabled']
        pb = AutomationService.toggle_playbook(org_id, slug, is_enabled, request.user)
        if not pb:
            return Response({'error': 'Playbook not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(PlaybookSerializer(pb).data)


class PlaybookConfigView(APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, slug):
        org_id = getattr(request, 'org_id', None)
        serializer = PlaybookConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        config_data = serializer.validated_data['config']
        pb = AutomationService.update_playbook_config(org_id, slug, config_data, request.user)
        if not pb:
            return Response({'error': 'Playbook not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(PlaybookSerializer(pb).data)


class PlaybookTestRunView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, slug):
        org_id = getattr(request, 'org_id', None)
        try:
            log = AutomationService.run_simulation(org_id, slug, request.user)
            return Response({
                'message': f"Simulation executed for {slug}",
                'log': AutomationExecutionLogSerializer(log).data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Test run failed for {slug}: {e}", exc_info=True)
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AutomationLogsListView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        org_id = getattr(request, 'org_id', None)
        logs = AutomationExecutionLog.objects.filter(org_id=org_id).order_by('-created_at')
        
        paginator = StandardPagination()
        page = paginator.paginate_queryset(logs, request)
        return paginator.get_paginated_response(
            AutomationExecutionLogSerializer(page, many=True).data
        )


class AutomationStatsView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        org_id = getattr(request, 'org_id', None)
        playbooks = Playbook.objects.filter(org_id=org_id)
        if not playbooks.exists():
            playbooks = AutomationService.get_or_create_default_playbooks(org_id, request.user)

        total_playbooks = playbooks.count()
        active_playbooks = playbooks.filter(is_enabled=True).count()

        logs = AutomationExecutionLog.objects.filter(org_id=org_id)
        total_runs = logs.count()
        successful_runs = logs.filter(status='success').count()
        success_rate = (successful_runs / total_runs * 100.0) if total_runs > 0 else 100.0

        # Estimate hours saved (~15 min per execution on average)
        hours_saved = round((total_runs * 15) / 60.0, 1)

        return Response({
            'total_playbooks': total_playbooks,
            'active_playbooks': active_playbooks,
            'total_executions': total_runs,
            'success_rate': round(success_rate, 1),
            'estimated_hours_saved': hours_saved,
        })
