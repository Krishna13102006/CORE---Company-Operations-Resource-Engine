import uuid
import datetime
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework import status
from tenants.models import Organization
from projects.models import Project, Task
from projects.views import ProjectTaskListView, TaskDetailView

User = get_user_model()

class ProjectsAdvancedTasksTestCase(TestCase):
    def setUp(self):
        # Create Org
        self.org = Organization.objects.create(
            name="Project Corp",
            slug="project-corp",
            passkey_hash="dummy"
        )
        
        # Create Users
        self.admin = User.objects.create_user(
            email="admin@pcorp.com",
            password="password",
            first_name="Admin",
            last_name="User",
            role="admin",
            org=self.org
        )
        self.manager = User.objects.create_user(
            email="manager@pcorp.com",
            password="password",
            first_name="Alice",
            last_name="Manager",
            role="manager",
            org=self.org
        )
        self.employee = User.objects.create_user(
            email="emp@pcorp.com",
            password="password",
            first_name="Bob",
            last_name="Employee",
            role="employee",
            org=self.org
        )
        
        # Create Project
        self.project = Project.objects.create(
            org_id=self.org.id,
            name="Project Gamma",
            description="Gamma project",
            status="active",
            owner=self.manager
        )
        
        self.factory = APIRequestFactory()

    def test_advanced_task_creation_and_dependencies(self):
        # 1. Create predecessor milestone task via API
        view = ProjectTaskListView.as_view()
        data1 = {
            "title": "Database Setup",
            "description": "Initialize postgres database",
            "status": "todo",
            "priority": "critical",
            "start_date": "2026-09-01",
            "due_date": "2026-09-05",
            "is_milestone": True
        }
        
        request = self.factory.post(f'/api/projects/{self.project.id}/tasks/', data1, format='json')
        request.org_id = self.org.id
        request.user = self.manager
        force_authenticate(request, user=self.manager)
        
        response = view(request, project_id=self.project.id)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        task1_id = response.data['id']
        self.assertTrue(response.data['is_milestone'])
        self.assertEqual(response.data['start_date'], "2026-09-01")
        self.assertEqual(response.data['priority'], "critical")
        
        # 2. Create dependent task via API
        data2 = {
            "title": "API Routing",
            "description": "Establish Django routes",
            "status": "todo",
            "priority": "high",
            "start_date": "2026-09-06",
            "due_date": "2026-09-10",
            "is_milestone": False,
            "depends_on": task1_id
        }
        
        request = self.factory.post(f'/api/projects/{self.project.id}/tasks/', data2, format='json')
        request.org_id = self.org.id
        request.user = self.manager
        force_authenticate(request, user=self.manager)
        
        response = view(request, project_id=self.project.id)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(str(response.data['depends_on']), task1_id)
        self.assertFalse(response.data['is_milestone'])

    def test_task_employee_permissions(self):
        # Create a task assigned to employee
        task = Task.objects.create(
            org_id=self.org.id,
            project=self.project,
            title="Design Frontend mockups",
            description="Draw mockups in Figma",
            assignee=self.employee,
            status="todo",
            priority="medium",
            due_date=datetime.date(2026, 9, 20),
            start_date=datetime.date(2026, 9, 15)
        )
        
        # 1. Employee updates status -> Should be allowed
        detail_view = TaskDetailView.as_view()
        data = {
            "status": "in_progress"
        }
        request = self.factory.patch(f'/api/projects/tasks/{task.id}/', data, format='json')
        request.org_id = self.org.id
        request.user = self.employee
        force_authenticate(request, user=self.employee)
        
        response = detail_view(request, task_id=task.id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], "in_progress")
        
        # 2. Employee tries to change due date -> Should be rejected with 403 Forbidden
        data_invalid = {
            "due_date": "2026-09-25"
        }
        request = self.factory.patch(f'/api/projects/tasks/{task.id}/', data_invalid, format='json')
        request.org_id = self.org.id
        request.user = self.employee
        force_authenticate(request, user=self.employee)
        
        response = detail_view(request, task_id=task.id)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
