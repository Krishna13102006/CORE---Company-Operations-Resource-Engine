from rest_framework.views import APIView
from rest_framework.response import Response
from core.permissions import IsEmployee, IsManager, IsHR, IsAdmin
from .services import AnalyticsService

analytics_service = AnalyticsService()


class OverviewStatsView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        data = analytics_service.overview_stats(
            org_id=request.org_id,
            user_id=str(request.user.id),
            role=request.user.role,
        )
        return Response(data)


class KnowledgeAnalyticsView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        data = analytics_service.knowledge_stats(org_id=request.org_id)
        return Response(data)


class ProjectsAnalyticsView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        data = analytics_service.projects_stats(
            org_id=request.org_id,
            user_id=str(request.user.id),
            role=request.user.role,
        )
        return Response(data)


class TeamsAnalyticsView(APIView):
    permission_classes = [IsManager]

    def get(self, request):
        data = analytics_service.teams_stats(org_id=request.org_id)
        return Response(data)


class HiringAnalyticsView(APIView):
    permission_classes = [IsHR]

    def get(self, request):
        data = analytics_service.hiring_stats(org_id=request.org_id)
        return Response(data)


class RecentActivityView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        limit = int(request.query_params.get('limit', 15))
        data = analytics_service.recent_activity(
            org_id=request.org_id,
            user_id=str(request.user.id),
            role=request.user.role,
            limit=min(limit, 50),
        )
        return Response(data)


# class CandidateRankingView(APIView):
#     permission_classes = [IsHR]
# 
#     def get(self, request, job_id):
#         try:
#             result = analytics_service.candidate_rankings(
#                 org_id=request.org_id,
#                 job_id=str(job_id),
#             )
#             return Response(result)
#         except Exception as e:
#             return Response(
#                 {'error': 'Ranking unavailable.', 'detail': str(e)},
#                 status=500
#             )
# 
# 
# class AttritionRiskView(APIView):
#     permission_classes = [IsHR]
# 
#     def get(self, request):
#         try:
#             result = analytics_service.attrition_risks(org_id=request.org_id)
#             return Response(result)
#         except Exception as e:
#             return Response(
#                 {'error': 'Attrition prediction unavailable.', 'detail': str(e)},
#                 status=500
#             )
# 
# 
# class ProjectRiskView(APIView):
#     permission_classes = [IsManager]
# 
#     def get(self, request):
#         try:
#             result = analytics_service.project_risks(org_id=request.org_id)
#             return Response(result)
#         except Exception as e:
#             return Response(
#                 {'error': 'Project risk scoring unavailable.', 'detail': str(e)},
#                 status=500
#             )

