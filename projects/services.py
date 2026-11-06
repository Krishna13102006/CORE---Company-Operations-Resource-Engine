import os
import json
import logging
import httpx
from django.conf import settings
from django.utils import timezone
from core.exceptions import ServiceError
from .repositories import ProjectRepository, TaskRepository

logger = logging.getLogger(__name__)

project_repo = ProjectRepository()
task_repo    = TaskRepository()

GEMINI_CASCADE_MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-flash-latest',
]

GROQ_CASCADE_MODELS = [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
]


def _extract_json_payload(raw_text: str):
    if not raw_text:
        return None
    cleaned = raw_text.strip()
    if cleaned.startswith('```'):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith('```'):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith('```'):
            lines = lines[:-1]
        cleaned = '\n'.join(lines).strip()

    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # Find bounding curly braces or square brackets
    start_idx = -1
    end_idx = -1
    for i, char in enumerate(cleaned):
        if char in ('{', '['):
            start_idx = i
            break
    for i in range(len(cleaned) - 1, -1, -1):
        if cleaned[i] in ('}', ']'):
            end_idx = i + 1
            break
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        try:
            return json.loads(cleaned[start_idx:end_idx])
        except Exception:
            pass
    return None


def call_llm_json(prompt: str, system_prompt: str = "You are an enterprise agile project management and sprint engineering expert. You output only valid JSON.") -> dict:
    gemini_key = getattr(settings, 'GEMINI_API_KEY', '') or os.getenv('GEMINI_API_KEY', '')
    groq_key = getattr(settings, 'GROQ_API_KEY', '') or os.getenv('GROQ_API_KEY', '')
    openai_key = getattr(settings, 'OPENAI_API_KEY', '') or os.getenv('OPENAI_API_KEY', '')

    # 1. Try Groq (high speed: sub-second response)
    if groq_key:
        try:
            with httpx.Client(timeout=3.5) as client:
                resp = client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {groq_key}"},
                    json={
                        "model": "openai/gpt-oss-120b",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": prompt}
                        ],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.2
                    }
                )
                if resp.status_code == 200:
                    raw_text = resp.json()['choices'][0]['message']['content']
                    parsed = _extract_json_payload(raw_text)
                    if parsed:
                        return parsed
        except Exception as e:
            logger.warning(f"Groq failed in projects service: {e}")

    # 2. Try Gemini (ultra-fast lite model)
    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key={gemini_key}"
            payload = {
                "contents": [{"parts": [{"text": f"{system_prompt}\n\n{prompt}"}]}],
                "generationConfig": {
                    "temperature": 0.2,
                    "response_mime_type": "application/json"
                }
            }
            with httpx.Client(timeout=3.5) as client:
                resp = client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    raw_text = data['candidates'][0]['content']['parts'][0]['text']
                    parsed = _extract_json_payload(raw_text)
                    if parsed:
                        return parsed
        except Exception as e:
            logger.warning(f"Gemini failed in projects service: {e}")

    # 3. Try OpenAI / Custom compatible endpoint
    if openai_key:
        openai_base = getattr(settings, 'OPENAI_BASE_URL', 'https://api.openai.com/v1')
        openai_model = getattr(settings, 'OPENAI_MODEL', 'gpt-4o-mini')
        try:
            with httpx.Client(timeout=4.0) as client:
                resp = client.post(
                    f"{openai_base}/chat/completions",
                    headers={"Authorization": f"Bearer {openai_key}"},
                    json={
                        "model": openai_model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": prompt}
                        ],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.2
                    }
                )
                if resp.status_code == 200:
                    raw_text = resp.json()['choices'][0]['message']['content']
                    parsed = _extract_json_payload(raw_text)
                    if parsed:
                        return parsed
        except Exception as e:
            logger.warning(f"OpenAI LLM failed in projects service: {e}")

    return None


class ProjectService:

    def list_projects(self, org_id, user, filters=None):
        if user.role not in ['admin', 'manager']:
            return project_repo.list_by_member(org_id, user.id, filters)
        return project_repo.list_by_org(org_id, filters)

    def get_project(self, project_id, org_id, user=None):
        project = project_repo.get_by_id(project_id, org_id)
        if not project:
            raise ServiceError('Project not found.', 404)

        if user and user.role not in ['admin', 'manager']:
            is_owner = project.owner_id == user.id
            is_member = project.tasks.filter(assignee_id=user.id, is_deleted=False).exists()
            if not is_owner and not is_member:
                raise ServiceError('You do not have access to this project.', 403)

        return project

    def create_project(self, org_id, user, name, description, status,
                       start_date, end_date, owner_id):
        if user.role == 'employee':
            raise ServiceError('Employees cannot create projects.', 403)

        from accounts.models import User
        if owner_id:
            owner = User.objects.filter(
                id=owner_id, org_id=org_id, is_deleted=False
            ).first()
            if not owner:
                raise ServiceError('Owner not found in this organisation.', 404)
        else:
            owner = user

        return project_repo.create(
            org_id=org_id,
            name=name,
            description=description,
            owner=owner,
            status=status,
            start_date=start_date,
            end_date=end_date,
        )

    def update_project(self, project_id, org_id, user, **fields):
        project = project_repo.get_by_id(project_id, org_id)
        if not project:
            raise ServiceError('Project not found.', 404)

        if user.role != 'admin' and project.owner_id != user.id:
            raise ServiceError('You do not have permission to update this project.', 403)

        if 'owner' in fields and fields['owner']:
            from accounts.models import User
            owner = User.objects.filter(
                id=fields['owner'], org_id=org_id, is_deleted=False
            ).first()
            if not owner:
                raise ServiceError('Owner not found.', 404)
            fields['owner'] = owner

        fields = {k: v for k, v in fields.items() if v is not None}
        return project_repo.update(project_id, org_id, **fields)

    def delete_project(self, project_id, org_id, user):
        project = project_repo.get_by_id(project_id, org_id)
        if not project:
            raise ServiceError('Project not found.', 404)

        if user.role != 'admin' and project.owner_id != user.id:
            raise ServiceError('You do not have permission to delete this project.', 403)

        project_repo.soft_delete(project_id, org_id)
        return True

    def get_tasks_for_user(self, user_id, org_id, filters=None):
        return task_repo.list_assigned_to_user(user_id, org_id, filters)

    def generate_sprint_summary(self, project_id, org_id, user):
        project = self.get_project(project_id, org_id, user=user)
        tasks = project.tasks.filter(is_deleted=False).select_related('assignee', 'depends_on')

        total_tasks = tasks.count()
        done_tasks = tasks.filter(status='done').count()
        in_progress_tasks = tasks.filter(status='in_progress').count()
        todo_tasks = tasks.filter(status='todo').count()
        review_tasks = tasks.filter(status='in_review').count()

        blocked_tasks = []
        for t in tasks.exclude(status='done'):
            if t.depends_on and t.depends_on.status != 'done':
                blocked_tasks.append(t.title)

        total_est = 0.0
        total_logged = 0.0
        for t in tasks:
            try:
                total_est += float(t.estimated_hours or 0)
            except (ValueError, TypeError):
                pass
            try:
                total_logged += float(t.logged_hours or 0)
            except (ValueError, TypeError):
                pass

        completion_rate = round((done_tasks / total_tasks * 100) if total_tasks > 0 else 0, 1)

        task_summaries = []
        for t in tasks[:35]:
            assignee_name = t.assignee.get_full_name() if t.assignee else "Unassigned"
            task_summaries.append(f"- [{t.status.upper()}] '{t.title}' (Assignee: {assignee_name}, Priority: {t.priority}, Est: {t.estimated_hours}h, Logged: {t.logged_hours}h)")

        prompt = f"""
Analyze this Sprint / Project Status for project '{project.name}':
Description: {project.description}
Total Tasks: {total_tasks}
Done: {done_tasks}
In Progress: {in_progress_tasks}
In Review: {review_tasks}
Todo: {todo_tasks}
Completion Rate: {completion_rate}%
Total Estimated Hours: {total_est}h
Total Logged Hours: {total_logged}h
Blocked Tasks: {', '.join(blocked_tasks) if blocked_tasks else 'None'}

Tasks:
{chr(10).join(task_summaries)}

Generate an executive Sprint Retrospective & Velocity Analysis formatted in clean Markdown with:
1. Executive Summary & Velocity Score (0-100)
2. Sprint Highlights & Key Accomplishments
3. Critical Blockers & At-Risk Milestones
4. Budget & Time Drift Analysis (Estimated vs Logged Hours)
5. Actionable Next Sprint Recommendations

Respond in JSON with this structure:
{{
  "velocity_score": 85,
  "health_status": "on_track" | "at_risk" | "delayed",
  "summary_markdown": "### Executive Summary...",
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
}}
"""
        result = call_llm_json(prompt, system_prompt="You are a Chief Technology Officer and Agile Coach producing executive sprint retrospectives. Output valid JSON.")

        if not result or not isinstance(result, dict) or not result.get('summary_markdown'):
            health = 'on_track' if completion_rate >= 60 or (total_tasks > 0 and done_tasks == total_tasks) else ('at_risk' if (completion_rate >= 20 or in_progress_tasks > 0) else 'delayed')
            score = min(100, max(20, int(completion_rate * 0.8 + (20 if not blocked_tasks else 0))))

            hours_summary = f"Total estimated hours: **{total_est}h**, actual logged hours: **{total_logged}h**."
            if total_est > 0 and total_logged > total_est:
                hours_summary += f" Project has exceeded initial budget by **{round(total_logged - total_est, 1)}h**."
            elif total_est > 0:
                hours_summary += f" **{round(total_est - total_logged, 1)}h** remaining within estimated budget."

            blocker_text = "No critical dependency blockers recorded." if not blocked_tasks else f"Critical blocked tasks requiring resolution: {', '.join(blocked_tasks)}."

            summary_md = f"""### Executive Summary & Sprint Health
Project **{project.name}** has achieved a completion rate of **{completion_rate}%** ({done_tasks}/{total_tasks} tasks completed). Sprint velocity health is evaluated as **{health.replace('_', ' ').title()}** with an agile velocity score of **{score}/100**.

### Sprint Highlights & Execution Progress
- **Completed Deliverables:** {done_tasks} tasks completed successfully.
- **Active In-Flight Work:** {in_progress_tasks} tasks actively in progress and {review_tasks} in review.
- **Backlog Volume:** {todo_tasks} tasks pending kickoff.

### Critical Blockers & Risk Analysis
{blocker_text}

### Time & Budget Drift Analysis
{hours_summary}

### Key Next-Sprint Focus
Focus on accelerating active tasks, clearing dependencies, and logging hours consistently.
"""
            recs = [
                f"Prioritize completing the {in_progress_tasks} in-progress tasks before taking on new backlog items.",
                "Review unassigned tasks and distribute workload evenly across available team members.",
                "Log team hours consistently to improve sprint velocity estimation accuracy."
            ]
            result = {
                "velocity_score": score,
                "health_status": health,
                "summary_markdown": summary_md,
                "recommendations": recs
            }

        return {
            "project_id": str(project.id),
            "project_name": project.name,
            "metrics": {
                "total_tasks": total_tasks,
                "done_tasks": done_tasks,
                "in_progress_tasks": in_progress_tasks,
                "in_review_tasks": review_tasks,
                "todo_tasks": todo_tasks,
                "blocked_count": len(blocked_tasks),
                "completion_rate": completion_rate,
                "total_estimated_hours": total_est,
                "total_logged_hours": total_logged,
            },
            "retrospective": result
        }

    def list_meeting_action_items(self, org_id):
        from meetings.models import Meeting
        meetings = Meeting.objects.filter(org_id=org_id, is_deleted=False).order_by('-start_time')
        items = []
        for m in meetings:
            if m.action_items and isinstance(m.action_items, list):
                for idx, ai in enumerate(m.action_items):
                    task_text = ai.get('task') if isinstance(ai, dict) else str(ai)
                    owner = ai.get('owner', '') if isinstance(ai, dict) else ''
                    priority = ai.get('priority', 'medium') if isinstance(ai, dict) else 'medium'
                    deadline = ai.get('deadline', '') if isinstance(ai, dict) else ''
                    items.append({
                        "id": f"{m.id}_{idx}",
                        "meeting_id": str(m.id),
                        "meeting_title": m.title,
                        "meeting_date": m.start_time.isoformat() if m.start_time else None,
                        "task": task_text,
                        "owner": owner,
                        "priority": priority if priority in ['low', 'medium', 'high', 'urgent'] else 'medium',
                        "deadline": deadline
                    })
        return items

    def import_meeting_action_item(self, project_id, org_id, user, meeting_id, task_text,
                                  assignee_id=None, priority='medium', due_date=None, tags=None, epic=''):
        from meetings.models import Meeting
        meeting = Meeting.objects.filter(id=meeting_id, org_id=org_id, is_deleted=False).first()
        if not meeting:
            raise ServiceError("Meeting not found.", 404)

        project = self.get_project(project_id, org_id, user=user)

        from accounts.models import User
        assignee = None
        if assignee_id:
            assignee = User.objects.filter(id=assignee_id, org_id=org_id, is_deleted=False).first()

        task = task_repo.create(
            org_id=org_id,
            project=project,
            title=task_text[:255],
            description=f"Imported from meeting: '{meeting.title}'",
            assignee=assignee,
            status='todo',
            priority=priority if priority in ['low', 'medium', 'high', 'urgent'] else 'medium',
            due_date=due_date,
            tags=tags or ['Meeting Action Item'],
            epic=epic or 'Meeting Outcomes',
            linked_meeting=meeting
        )
        return task

    def import_project_data(self, org_id, user, format_type, payload, target_project_id=None, new_project_name=None):
        import io
        import csv
        from django.db import transaction
        from datetime import datetime

        # Parse payload if sent as raw string
        if isinstance(payload, str):
            payload_str = payload.strip()
            if (payload_str.startswith('{') and payload_str.endswith('}')) or (payload_str.startswith('[') and payload_str.endswith(']')):
                try:
                    payload = json.loads(payload_str)
                except Exception:
                    pass
            elif format_type == 'csv' or '\n' in payload_str or ',' in payload_str:
                reader = csv.DictReader(io.StringIO(payload_str))
                payload = [row for row in reader if any(row.values())]

        with transaction.atomic():
            if target_project_id:
                project = self.get_project(target_project_id, org_id, user=user)
            else:
                p_name = new_project_name
                if not p_name and isinstance(payload, dict) and payload.get('name'):
                    p_name = payload.get('name')
                if not p_name:
                    p_name = f"Imported Project ({timezone.now().strftime('%b %d, %Y')})"

                p_desc = f"Imported on {timezone.now().strftime('%Y-%m-%d %H:%M')}"
                if isinstance(payload, dict) and payload.get('desc'):
                    p_desc = payload.get('desc')

                project = self.create_project(
                    org_id=org_id,
                    user=user,
                    name=p_name,
                    description=p_desc,
                    status='active',
                    start_date=timezone.now().date(),
                    end_date=None,
                    owner_id=user.id
                )

            imported_count = 0

            # Determine list of task/card items
            items = []
            if isinstance(payload, list):
                items = payload
            elif isinstance(payload, dict):
                items = payload.get('cards') or payload.get('tasks') or payload.get('issues') or payload.get('items') or []

            for item in items:
                if not isinstance(item, dict):
                    continue

                title = (
                    item.get('name') or item.get('summary') or item.get('title') or
                    item.get('Summary') or item.get('Title') or item.get('Task Name') or
                    item.get('Task') or ''
                ).strip()
                if not title:
                    continue

                desc = item.get('desc') or item.get('description') or item.get('Description') or item.get('Notes') or ''

                # Priority parsing
                p_val = str(item.get('priority') or item.get('Priority') or 'medium').lower().strip()
                if p_val not in ['low', 'medium', 'high', 'critical']:
                    p_val = 'high' if ('high' in p_val or 'crit' in p_val or 'urg' in p_val) else ('low' if 'low' in p_val else 'medium')

                # Status parsing
                s_val = str(item.get('status') or item.get('Status') or 'todo').lower().strip().replace(' ', '_')
                if s_val not in ['todo', 'in_progress', 'blocked', 'done']:
                    if 'prog' in s_val or 'work' in s_val or 'active' in s_val:
                        s_val = 'in_progress'
                    elif 'block' in s_val or 'wait' in s_val:
                        s_val = 'blocked'
                    elif 'done' in s_val or 'comp' in s_val or 'clos' in s_val or item.get('dueComplete') is True:
                        s_val = 'done'
                    else:
                        s_val = 'todo'

                epic_val = str(item.get('epic') or item.get('epic_link') or item.get('Epic') or item.get('Feature') or '').strip()
                est_val = item.get('estimated_hours') or item.get('estimate') or item.get('Estimated Hours') or item.get('Hours')
                try:
                    est_hours = float(est_val) if est_val is not None and str(est_val).strip() != '' else None
                except (ValueError, TypeError):
                    est_hours = None

                due_val = None
                due_raw = item.get('due_date') or item.get('due') or item.get('Due Date') or item.get('Deadline')
                if due_raw:
                    try:
                        if 'T' in str(due_raw):
                            due_val = datetime.fromisoformat(str(due_raw).replace('Z', '+00:00')).date()
                        else:
                            due_val = datetime.strptime(str(due_raw).strip(), '%Y-%m-%d').date()
                    except Exception:
                        due_val = None

                tags = []
                if item.get('labels') and isinstance(item['labels'], list):
                    for lbl in item['labels']:
                        if isinstance(lbl, dict) and lbl.get('name'):
                            tags.append(lbl['name'])
                        elif isinstance(lbl, str) and lbl:
                            tags.append(lbl)
                elif item.get('tags') and isinstance(item['tags'], list):
                    tags.extend(item['tags'])
                elif item.get('tags') and isinstance(item['tags'], str):
                    tags.extend([t.strip() for t in item['tags'].split(',') if t.strip()])
                elif item.get('Tags') and isinstance(item['Tags'], str):
                    tags.extend([t.strip() for t in item['Tags'].split(',') if t.strip()])

                task_repo.create(
                    org_id=org_id,
                    project=project,
                    title=title,
                    description=desc,
                    assignee=None,
                    status=s_val,
                    priority=p_val,
                    due_date=due_val,
                    epic=epic_val,
                    estimated_hours=est_hours,
                    tags=tags if tags else ['Imported Task']
                )
                imported_count += 1

        return {
            "project_id": str(project.id),
            "project_name": project.name,
            "imported_count": imported_count
        }



class TaskService:

    def list_tasks_for_project(self, project_id, org_id, user=None):
        tasks = task_repo.list_by_project(project_id, org_id)
        if user and user.role != 'admin':
            project = project_repo.get_by_id(project_id, org_id)
            if project and project.owner_id != user.id:
                tasks = tasks.filter(assignee_id=user.id)
        return tasks

    def list_my_tasks(self, user_id, org_id, filters=None):
        return task_repo.list_assigned_to_user(user_id, org_id, filters)

    def get_task(self, task_id, org_id):
        task = task_repo.get_by_id(task_id, org_id)
        if not task:
            raise ServiceError('Task not found.', 404)
        return task

    def create_task(self, project_id, org_id, user,
                    title, description, status, priority, due_date, assignee_id,
                    start_date=None, is_milestone=False, depends_on_id=None,
                    tags=None, epic="", estimated_hours=None, logged_hours=None,
                    linked_document_id=None, linked_meeting_id=None):
        project = project_repo.get_by_id(project_id, org_id)
        if not project:
            raise ServiceError('Project not found.', 404)

        if user.role == 'employee':
            raise ServiceError('Employees cannot create tasks.', 403)
        if user.role != 'admin' and project.owner_id != user.id:
            raise ServiceError('You can only create tasks for projects you created.', 403)

        # Resolve assignee
        assignee = None
        if assignee_id:
            from accounts.models import User
            assignee = User.objects.filter(
                id=assignee_id, org_id=org_id, is_deleted=False
            ).first()
            if not assignee:
                raise ServiceError('Assignee not found in this organisation.', 404)
            
            role_ranks = {'admin': 4, 'hr': 3, 'manager': 2, 'employee': 1}
            creator_rank = role_ranks.get(user.role, 0)
            assignee_rank = role_ranks.get(assignee.role, 0)
            if assignee_rank > creator_rank:
                raise ServiceError('You cannot assign tasks to users with a higher role level than yourself.', 403)

        # Resolve dependency
        depends_on = None
        if depends_on_id:
            from projects.models import Task as ProjectTask
            depends_on = ProjectTask.objects.filter(
                id=depends_on_id, org_id=org_id, is_deleted=False
            ).first()
            if not depends_on:
                raise ServiceError('Dependency task not found.', 404)

        # Resolve linked document
        linked_document = None
        if linked_document_id:
            from knowledge.models import Document
            linked_document = Document.objects.filter(
                id=linked_document_id, org_id=org_id, is_deleted=False
            ).first()

        # Resolve linked meeting
        linked_meeting = None
        if linked_meeting_id:
            from meetings.models import Meeting
            linked_meeting = Meeting.objects.filter(
                id=linked_meeting_id, org_id=org_id, is_deleted=False
            ).first()

        task = task_repo.create(
            org_id=org_id,
            project=project,
            title=title,
            description=description,
            assignee=assignee,
            status=status,
            priority=priority,
            due_date=due_date,
            start_date=start_date,
            is_milestone=is_milestone,
            depends_on=depends_on,
            tags=tags or [],
            epic=epic or "",
            estimated_hours=estimated_hours,
            logged_hours=logged_hours or 0.0,
            linked_document=linked_document,
            linked_meeting=linked_meeting,
        )

        if assignee and assignee.id != user.id:
            from core.notifications import send_notification
            send_notification(
                recipient=assignee,
                org=org_id,
                actor=user,
                type='TASK_ASSIGNED',
                title="New Task Assigned",
                message=f"{user.first_name} {user.last_name} assigned you to task '{task.title}' in project '{project.name}'.",
                target_url='/projects',
                send_email=True,
                email_subject=f"New Task Assigned: {task.title}",
                email_cta_text="View Task Details"
            )

        return task

    def update_task(self, task_id, org_id, user, **fields):
        task = task_repo.get_by_id(task_id, org_id)
        if not task:
            raise ServiceError('Task not found.', 404)

        old_assignee_id = task.assignee_id
        old_status = task.status

        if user.role != 'admin':
            if user.role == 'employee':
                if not task.assignee or task.assignee_id != user.id:
                    raise ServiceError('You can only update your own tasks.', 403)
                if task.project.status != 'active':
                    raise ServiceError('Tasks can only be updated when the project is Active.', 403)
                
                # Employees can update status, logged_hours
                allowed_employee_fields = {'status', 'logged_hours'}
                for key, val in fields.items():
                    if key not in allowed_employee_fields and val is not None:
                        current_val = getattr(task, key, None)
                        if current_val != val:
                            raise ServiceError('Employees can only update task status and logged hours.', 403)
            else:
                is_project_owner = task.project.owner_id == user.id
                is_assignee = task.assignee_id == user.id
                
                if not is_project_owner and not is_assignee:
                    raise ServiceError('You can only update tasks in projects you created.', 403)
                
                if not is_project_owner and is_assignee:
                    allowed_assignee_fields = {'status', 'logged_hours'}
                    for key, val in fields.items():
                        if key not in allowed_assignee_fields and val is not None:
                            current_val = getattr(task, key, None)
                            if current_val != val:
                                raise ServiceError('You can only update status and logged hours for assigned tasks.', 403)
                
                if is_project_owner and 'assignee' in fields and fields['assignee']:
                    from accounts.models import User as OrgUser
                    target_assignee = OrgUser.objects.filter(
                        id=fields['assignee'], org_id=org_id, is_deleted=False
                    ).first()
                    if target_assignee:
                        role_ranks = {'admin': 4, 'hr': 3, 'manager': 2, 'employee': 1}
                        user_rank = role_ranks.get(user.role, 0)
                        assignee_rank = role_ranks.get(target_assignee.role, 0)
                        if assignee_rank > user_rank:
                            raise ServiceError('You cannot assign tasks to users with a higher role level than yourself.', 403)

        # Resolve assignee UUID if provided
        if 'assignee' in fields:
            if fields['assignee']:
                from accounts.models import User
                assignee = User.objects.filter(
                    id=fields['assignee'], org_id=org_id, is_deleted=False
                ).first()
                if not assignee:
                    raise ServiceError('Assignee not found.', 404)
                fields['assignee'] = assignee
            else:
                fields['assignee'] = None

        # Resolve depends_on UUID if provided
        if 'depends_on' in fields:
            if fields['depends_on']:
                from projects.models import Task as ProjectTask
                dep_task = ProjectTask.objects.filter(
                    id=fields['depends_on'], org_id=org_id, is_deleted=False
                ).first()
                if not dep_task:
                    raise ServiceError('Dependency task not found.', 404)
                fields['depends_on'] = dep_task
            else:
                fields['depends_on'] = None

        # Resolve linked_document UUID if provided
        if 'linked_document' in fields:
            if fields['linked_document']:
                from knowledge.models import Document
                linked_doc = Document.objects.filter(
                    id=fields['linked_document'], org_id=org_id, is_deleted=False
                ).first()
                fields['linked_document'] = linked_doc
            else:
                fields['linked_document'] = None

        # Resolve linked_meeting UUID if provided
        if 'linked_meeting' in fields:
            if fields['linked_meeting']:
                from meetings.models import Meeting
                linked_meet = Meeting.objects.filter(
                    id=fields['linked_meeting'], org_id=org_id, is_deleted=False
                ).first()
                fields['linked_meeting'] = linked_meet
            else:
                fields['linked_meeting'] = None

        cleaned = {}
        for k, v in fields.items():
            if v is not None or k in ['assignee', 'depends_on', 'linked_document', 'linked_meeting']:
                cleaned[k] = v

        updated_task = task_repo.update(task_id, org_id, **cleaned)

        # Notification: Reassigned task
        if updated_task.assignee and updated_task.assignee_id != old_assignee_id and updated_task.assignee_id != user.id:
            from core.notifications import send_notification
            send_notification(
                recipient=updated_task.assignee,
                org=org_id,
                actor=user,
                type='TASK_ASSIGNED',
                title="Task Assigned to You",
                message=f"{user.first_name} {user.last_name} assigned you to task '{updated_task.title}' in project '{updated_task.project.name}'.",
                target_url='/projects',
                send_email=True,
                email_subject=f"Task Assigned: {updated_task.title}",
                email_cta_text="View Task Details"
            )

        # Notification: Completed task
        if old_status != 'done' and updated_task.status == 'done':
            from core.notifications import send_notification
            if updated_task.project.owner and updated_task.project.owner_id != user.id:
                send_notification(
                    recipient=updated_task.project.owner,
                    org=org_id,
                    actor=user,
                    type='TASK_COMPLETED',
                    title="Task Completed",
                    message=f"{user.first_name} {user.last_name} completed task '{updated_task.title}' in your project '{updated_task.project.name}'.",
                    target_url='/projects',
                    send_email=True,
                    email_subject=f"Task Completed: {updated_task.title}",
                    email_cta_text="View Project"
                )

            # Blocker resolution trigger: notify tasks depending on this task
            from projects.models import Task as ProjectTask
            blocked_tasks = ProjectTask.objects.filter(depends_on=updated_task, is_deleted=False).select_related('assignee', 'project')
            for bt in blocked_tasks:
                if bt.assignee and bt.assignee_id != user.id:
                    send_notification(
                        recipient=bt.assignee,
                        org=org_id,
                        actor=user,
                        type='TASK_ASSIGNED',
                        title="Dependency Resolved",
                        message=f"Predecessor task '{updated_task.title}' was completed. You can now proceed with '{bt.title}'.",
                        target_url='/projects',
                        send_email=False,
                    )

        return updated_task

    def delete_task(self, task_id, org_id, user):
        task = task_repo.get_by_id(task_id, org_id)
        if not task:
            raise ServiceError('Task not found.', 404)

        if user.role == 'employee':
            raise ServiceError('Employees cannot delete tasks.', 403)
        if user.role != 'admin' and task.project.owner_id != user.id:
            raise ServiceError('You do not have permission to delete tasks in this project.', 403)

        task_repo.soft_delete(task_id, org_id)
        return True

    def add_comment(self, task_id, org_id, user, content):
        task = task_repo.get_by_id(task_id, org_id)
        if not task:
            raise ServiceError('Task not found.', 404)

        comment = task_repo.add_comment(
            task=task,
            author=user,
            content=content,
            org_id=org_id,
        )

        from core.notifications import send_notification
        if task.assignee and task.assignee_id != user.id:
            send_notification(
                recipient=task.assignee,
                org=org_id,
                actor=user,
                type='MENTION',
                title="New Comment on Task",
                message=f"{user.first_name} {user.last_name} commented on your task '{task.title}': \"{content[:80]}\"",
                target_url='/projects',
                send_email=True,
                email_subject=f"New Comment on '{task.title}'",
                email_cta_text="View Task Discussion"
            )
        elif task.project.owner and task.project.owner_id != user.id:
            send_notification(
                recipient=task.project.owner,
                org=org_id,
                actor=user,
                type='MENTION',
                title="New Comment on Task",
                message=f"{user.first_name} {user.last_name} commented on task '{task.title}' in your project '{task.project.name}': \"{content[:80]}\"",
                target_url='/projects',
                send_email=True,
                email_subject=f"New Comment on '{task.title}'",
                email_cta_text="View Task Discussion"
            )

        return comment

    def add_subtask(self, task_id, org_id, user, title):
        task = task_repo.get_by_id(task_id, org_id)
        if not task:
            raise ServiceError('Task not found.', 404)

        is_owner = task.project.owner_id == user.id
        is_assignee = task.assignee_id == user.id
        if user.role == 'employee':
            if not is_assignee:
                raise ServiceError('You can only add subtasks to your own tasks.', 403)
            if task.project.status != 'active':
                raise ServiceError('Subtasks can only be added when the project is Active.', 403)
        else:
            if user.role != 'admin' and not is_owner and not is_assignee:
                raise ServiceError('You do not have permission to add subtasks to this task.', 403)

        from .models import Subtask
        subtask = Subtask.objects.create(
            org_id=org_id,
            task=task,
            title=title,
            is_done=False
        )
        return subtask

    def toggle_subtask(self, subtask_id, org_id, user, is_done):
        from .models import Subtask
        subtask = Subtask.objects.filter(id=subtask_id, org_id=org_id).first()
        if not subtask:
            raise ServiceError('Subtask not found.', 404)

        task = subtask.task
        is_owner = task.project.owner_id == user.id
        is_assignee = task.assignee_id == user.id
        if user.role == 'employee':
            if not is_assignee:
                raise ServiceError('You can only complete subtasks on your own tasks.', 403)
            if task.project.status != 'active':
                raise ServiceError('Subtasks can only be updated when the project is Active.', 403)
        else:
            if user.role != 'admin' and not is_owner and not is_assignee:
                raise ServiceError('You do not have permission to update this subtask.', 403)

        subtask.is_done = is_done
        subtask.save()
        return subtask

    def delete_subtask(self, subtask_id, org_id, user):
        from .models import Subtask
        subtask = Subtask.objects.filter(id=subtask_id, org_id=org_id).first()
        if not subtask:
            raise ServiceError('Subtask not found.', 404)

        task = subtask.task
        is_owner = task.project.owner_id == user.id
        is_assignee = task.assignee_id == user.id
        if user.role == 'employee':
            if not is_assignee:
                raise ServiceError('You can only delete subtasks from your own tasks.', 403)
            if task.project.status != 'active':
                raise ServiceError('Subtasks can only be deleted when the project is Active.', 403)
        else:
            if user.role != 'admin' and not is_owner and not is_assignee:
                raise ServiceError('You do not have permission to delete this subtask.', 403)

        subtask.delete()
        return True

    def breakdown_task(self, org_id, user, title, description, project_id=None):
        prompt = f"""
Break down this high-level project requirement/task into 4 to 6 actionable, well-scoped engineering/operational subtasks:

Task Title: {title}
Task Description: {description}

For each subtask, provide:
- title: clear, imperative action phrase (e.g. 'Provision AWS Route53 Multi-Region Failover')
- description: 1-2 sentence execution guidance
- estimated_hours: realistic float (e.g. 4.0, 8.0, 2.5)
- priority: 'low' | 'medium' | 'high' | 'urgent'
- suggested_role: e.g. 'Backend Engineer', 'DevOps / SRE', 'Frontend Engineer', 'QA / Security'
- tags: list of 1-3 tags (e.g. ['Backend', 'Infrastructure', 'Security'])

Respond ONLY in valid JSON matching this schema:
{{
  "breakdown": [
    {{
      "title": "Subtask title",
      "description": "Execution guidance",
      "estimated_hours": 4.0,
      "priority": "high",
      "suggested_role": "DevOps / SRE",
      "tags": ["DevOps", "Infrastructure"]
    }}
  ]
}}
"""
        result = call_llm_json(prompt, system_prompt="You are a Principal Software Architect and Agile Technical Lead. You output only valid JSON.")
        
        if not result or not isinstance(result, dict) or not result.get('breakdown') or len(result.get('breakdown', [])) == 0:
            clean_title = title.strip()
            result = {
                "breakdown": [
                    {
                        "title": f"Technical Architecture & Requirements Spec for {clean_title}",
                        "description": f"Define data models, API contracts, interface specifications, and architectural constraints for '{clean_title}'.",
                        "estimated_hours": 3.0,
                        "priority": "high",
                        "suggested_role": "Software Architect / Lead",
                        "tags": ["Architecture", "Planning"]
                    },
                    {
                        "title": f"Core Backend & Service Logic Implementation for {clean_title}",
                        "description": f"Implement business logic, database transactions, services, and core error handling for '{clean_title}'.",
                        "estimated_hours": 8.0,
                        "priority": "high",
                        "suggested_role": "Backend Engineer",
                        "tags": ["Backend", "Core Logic"]
                    },
                    {
                        "title": f"Frontend UI/UX & Interactive State Integration for {clean_title}",
                        "description": f"Build user interface components, responsive layout, and connect API mutations for '{clean_title}'.",
                        "estimated_hours": 6.0,
                        "priority": "medium",
                        "suggested_role": "Frontend Engineer",
                        "tags": ["Frontend", "UI/UX"]
                    },
                    {
                        "title": f"Automated Unit/E2E Testing & Security Review for {clean_title}",
                        "description": f"Write test suites covering edge cases, permission checks, and validate end-to-end user workflows.",
                        "estimated_hours": 4.0,
                        "priority": "medium",
                        "suggested_role": "QA / Security",
                        "tags": ["Testing", "Security"]
                    },
                    {
                        "title": f"Production Deployment & Observability Alarms for {clean_title}",
                        "description": f"Deploy changes to staging/production, configure log monitoring, metrics tracking, and error alarms.",
                        "estimated_hours": 2.5,
                        "priority": "high",
                        "suggested_role": "DevOps / SRE",
                        "tags": ["DevOps", "Infrastructure"]
                    }
                ]
            }
        return result

