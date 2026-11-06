import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Activity,
  FileText,
  Users,
  CheckCircle,
  Briefcase,
  AlertCircle,
  Clock,
  Sparkles,
  FolderGit2,
  CalendarDays,
  Mail,
  Plus,
  LayoutDashboard,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Queries
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => api.get('/analytics/overview/'),
  });

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ['analytics', 'activity'],
    queryFn: () => api.get('/analytics/activity/'),
  });

  const { data: knowledge } = useQuery({
    queryKey: ['analytics', 'knowledge'],
    queryFn: () => api.get('/analytics/knowledge/'),
  });

  const { data: projects } = useQuery({
    queryKey: ['analytics', 'projects'],
    queryFn: () => api.get('/analytics/projects/'),
  });

  const { data: teams } = useQuery({
    queryKey: ['analytics', 'teams'],
    queryFn: () => api.get('/analytics/teams/'),
    enabled: !!user && ['admin', 'hr', 'manager'].includes(user.role),
  });

  const { data: hiring } = useQuery({
    queryKey: ['analytics', 'hiring'],
    queryFn: () => api.get('/analytics/hiring/'),
    enabled: !!user && ['admin', 'hr'].includes(user.role),
  });

  // Fetch all approved leaves for calendar and OOO widgets
  const { data: oooLeaves } = useQuery<any[]>({
    queryKey: ['ooo-leaves'],
    queryFn: () => api.get('/teams/leave/?status=approved&all=true'),
    enabled: !!user,
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const outToday = oooLeaves?.filter((leave) => {
    const start = new Date(leave.start_date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(leave.end_date);
    end.setHours(0, 0, 0, 0);
    const userDepts = user?.department_id ? user.department_id.split(', ') : [];
    if (user?.role && ['employee', 'hr', 'manager'].includes(user.role)) {
      if (!leave.department_id || !userDepts.includes(leave.department_id)) {
        return false;
      }
    }
    return today >= start && today <= end;
  }) || [];

  // Loading state placeholder
  if (overviewLoading || activityLoading) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Loading workspace insights...</span>
        </div>
      </div>
    );
  }

  // Greeting helper
  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good morning';
    if (hr < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2 sm:gap-2.5">
            <LayoutDashboard className="h-6 w-6 text-primary shrink-0" />
            {getGreeting()}, {user?.first_name}! <Sparkles className="h-5 w-5 text-amber-500 animate-pulse inline-block" />
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 leading-snug">
            Here's what's happening across your organization dashboard today.
          </p>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="bg-white dark:bg-slate-900 border border-border rounded-xl p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between shadow-sm">
        <div className="text-left">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Quick Operations</h3>
          <p className="text-xs text-muted-foreground">Frequent actions you can perform instantly</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button
            variant="outline"
            onClick={() => navigate('/departments')}
            className="flex items-center gap-1.5 text-xs h-9 bg-slate-50 dark:bg-slate-800 border-border"
          >
            <Plus className="h-3.5 w-3.5 text-blue-500" />
            Request OOO Leave
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/documents')}
            className="flex items-center gap-1.5 text-xs h-9 bg-slate-50 dark:bg-slate-800 border-border"
          >
            <FileText className="h-3.5 w-3.5 text-emerald-500" />
            Upload Document
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/mail')}
            className="flex items-center gap-1.5 text-xs h-9 bg-slate-50 dark:bg-slate-800 border-border"
          >
            <Mail className="h-3.5 w-3.5 text-indigo-500" />
            Compose Internal Mail
          </Button>
        </div>
      </div>

      {/* Pending Actions Alerts */}
      {overview?.pending_actions && overview.pending_actions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-left">
            Requires Immediate Attention
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {overview.pending_actions.map((action: any) => (
              <div
                key={action.id}
                onClick={() => navigate(action.link)}
                className={`flex items-center justify-between p-3.5 rounded-lg border cursor-pointer transition-all hover:translate-x-0.5 ${
                  action.type === 'warning'
                    ? 'bg-red-50/40 dark:bg-red-950/10 border-red-200 dark:border-red-900/50 hover:bg-red-50/60'
                    : 'bg-amber-50/40 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/50 hover:bg-amber-50/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${action.type === 'warning' ? 'bg-red-105 dark:bg-red-900 text-red-650' : 'bg-amber-105 dark:bg-amber-900 text-amber-650'}`}>
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {action.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {action.detail}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Resolve →
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metric Cards Grid (Responsive 2 cols on mobile, 5 on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-4">
        <Card className="border-border shadow-sm bg-white dark:bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Documents
            </CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.total_documents ?? 0}</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Active knowledge base files
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm bg-white dark:bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Members
            </CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.total_users ?? 0}</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Onboarded employees and managers
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm bg-white dark:bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Projects
            </CardTitle>
            <FolderGit2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.active_projects ?? 0}</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Currently tracked initiatives
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm bg-white dark:bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Completed Tasks
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.completed_tasks ?? 0}</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Across all operational workflows
            </p>
          </CardContent>
        </Card>

        <Card className="border-red-200 dark:border-red-900/50 bg-red-50/20 dark:bg-red-950/10 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
              Overdue Tasks
            </CardTitle>
            <Clock className="h-4 w-4 text-red-500 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">{overview?.overdue_tasks ?? 0}</div>
            <p className="text-[10px] text-red-500/80 mt-1">
              Require immediate attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Layout */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Left Side: Recent Activity (spanning 4 cols) */}
        <Card className="lg:col-span-4 border-border shadow-sm bg-white dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-base font-bold">Recent Audit Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 max-h-[380px] overflow-y-auto pr-2">
              {activity && activity.length > 0 ? (
                activity.map((act: any) => (
                  <div key={act.id} className="flex gap-4 items-start">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      <Activity className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {act.actor || 'System'} <span className="font-normal text-muted-foreground">performed</span> {act.action.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {act.detail || `Action on ${act.target_type} (${act.target_id})`}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {new Date(act.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  No recent activities recorded.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right Side: Tasks & System Status (spanning 3 cols) */}
        <Card className="lg:col-span-3 border-border shadow-sm bg-white dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-base font-bold">Task Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {projects ? (
              <div className="space-y-4">
                <div className="flex justify-between text-sm font-medium">
                  <span>Tasks Completed</span>
                  <span>
                    {projects.completed_tasks} / {projects.total_tasks || 0}
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3">
                  <div
                    className="bg-primary h-3 rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        projects.total_tasks > 0
                          ? (projects.completed_tasks / projects.total_tasks) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                
                {projects.overdue_tasks > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg border border-red-100 dark:border-red-900/30 text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>
                      You have <strong>{projects.overdue_tasks} overdue tasks</strong> requiring attention.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-6">
                No task metrics available.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Subsections based on Roles */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Knowledge Stats */}
        {knowledge && (
          <Card className="border-border shadow-sm bg-white dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Knowledge Directory breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-muted-foreground mb-1">
                  <span>Category</span>
                  <span className="text-right">Files</span>
                </div>
                {knowledge.category_counts && knowledge.category_counts.length > 0 ? (
                  knowledge.category_counts.map((c: any) => (
                    <div key={c.metadata__category} className="flex justify-between items-center text-sm py-1.5 border-b border-border last:border-0">
                      <span className="font-semibold">{c.metadata__category || 'Uncategorized'}</span>
                      <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-2 py-0.5 rounded">
                        {c.count}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-xs text-muted-foreground py-4">No categories mapped.</div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Out of Office (OOO) Today Widget */}
        <Card className="border-border shadow-sm bg-white dark:bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-slate-400" /> Who's Out Today ({outToday.length})
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {outToday.length > 0 ? (
              <div className="space-y-3">
                {outToday.map((leave) => (
                  <div key={leave.id} className="flex justify-between items-center text-sm py-2 border-b border-border last:border-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{leave.employee_name}</span>
                      <span className="text-[10px] text-muted-foreground">Department Teammate</span>
                    </div>
                    <span className="text-[10px] bg-red-50 text-red-650 dark:bg-red-950/20 dark:text-red-400 border border-red-100 dark:border-red-900/30 px-2 py-0.5 rounded font-bold">
                      Until {new Date(leave.end_date).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-xs text-muted-foreground py-6 italic">
                All teammates are in office today.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Personal Calendar Widget */}
        <Card className="border-border shadow-sm bg-white dark:bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-primary" /> My Calendar & Deadlines
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {overview?.calendar_events && overview.calendar_events.length > 0 ? (
              <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                {overview.calendar_events.map((event: any) => (
                  <div
                    key={event.id}
                    onClick={() => navigate(event.link)}
                    className="flex justify-between items-start text-xs py-2 border-b border-border last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 px-1 rounded transition-colors"
                  >
                    <div className="flex flex-col gap-0.5 text-left min-w-0">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {event.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {event.detail}
                      </span>
                      <span className="text-[9px] text-muted-foreground font-semibold flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5 text-slate-400" />
                        {event.type === 'interview'
                          ? new Date(event.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : new Date(event.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ml-2 ${
                      event.type === 'interview'
                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30'
                        : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30'
                    }`}>
                      {event.type === 'interview' ? 'Interview' : 'Task Due'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-xs text-muted-foreground py-8 italic">
                No tasks or interviews scheduled.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hiring pipeline info for HR/Admins */}
        {hiring && ['admin', 'hr'].includes(user?.role || '') && (
          <Card className="border-border shadow-sm bg-white dark:bg-slate-900">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Recruiting Status
              </CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">Active Job Openings</span>
                  <span className="font-bold">{hiring.active_jobs ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">Pending Applications</span>
                  <span className="font-bold">{hiring.pending_applications ?? 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
