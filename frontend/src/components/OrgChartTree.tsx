import React, { useState, useMemo } from 'react';
import {
  Users,
  ChevronDown,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Palmtree,
  CheckSquare,
  Clock,
  Briefcase,
  Layers,
  Sparkles,
  AlertTriangle,
  Shield,
  ShieldCheck,
  Building2,
  Activity,
  ArrowRight,
  Maximize2,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getInitials } from '../lib/utils';

export interface OrgChartNode {
  id: string;
  userId?: string;
  employeeProfileId?: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'admin' | 'hr' | 'manager' | 'employee';
  departmentName: string;
  departmentId?: string | null;
  departmentIds?: string[];
  managerId?: string | null;
  skills?: string[];
  isActive: boolean;
  statusMessage?: string | null;
  statusEmoji?: string | null;
  taskStats?: {
    total: number;
    completed: number;
    overdue: number;
  };
  isOnline?: boolean;
  lastSeenDisplay?: string;
  isOoo?: boolean;
  oooEndDate?: string;
  directReportsCount: number;
  spanOfControlStatus?: 'optimal' | 'manageable' | 'elevated' | 'overloaded';
  activeDelegation?: {
    id: string;
    delegatee_name: string;
    delegation_type: string;
    start_date: string;
    end_date: string;
    notes?: string;
  };
  children: OrgChartNode[];
}

interface OrgChartTreeProps {
  employees: any[];
  members: any[];
  departments: any[];
  oooLeaves?: any[];
  delegations?: any[];
  onSelectMember: (memberOrEmployee: any) => void;
  onOpenDelegationModal?: (managerId?: string) => void;
}

export const OrgChartTree: React.FC<OrgChartTreeProps> = ({
  employees,
  members,
  departments,
  oooLeaves = [],
  delegations = [],
  onSelectMember,
  onOpenDelegationModal,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [highlightOverloadOnly, setHighlightOverloadOnly] = useState<boolean>(false);

  // Check today's OOO leaves
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const oooMap = useMemo(() => {
    const map = new Map<string, { isOoo: boolean; endDate: string }>();
    oooLeaves.forEach((leave) => {
      if (leave.status === 'approved') {
        const start = new Date(leave.start_date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(leave.end_date);
        end.setHours(0, 0, 0, 0);
        if (today >= start && today <= end) {
          map.set(leave.employee_id, {
            isOoo: true,
            endDate: new Date(leave.end_date).toLocaleDateString(),
          });
        }
      }
    });
    return map;
  }, [oooLeaves, today]);

  // Active delegations map (indexed by delegator ID)
  const delegationMap = useMemo(() => {
    const map = new Map<string, any>();
    delegations.forEach((d) => {
      if (d.is_currently_effective || (d.is_active && !d.is_deleted)) {
        map.set(d.delegator, d);
      }
    });
    return map;
  }, [delegations]);

  // Build tree data with Span of Control metrics
  const { rootNodes, totalNodeCount, spanTelemetry } = useMemo(() => {
    if (!employees || employees.length === 0) {
      return {
        rootNodes: [],
        totalNodeCount: 0,
        spanTelemetry: {
          totalManagers: 0,
          avgSpan: 0,
          overloadedCount: 0,
          optimalCount: 0,
          maxSpan: 0,
        },
      };
    }

    // Filter employees by department if selected
    const filteredEmps = departmentFilter === 'all'
      ? employees
      : employees.filter((emp) => {
          const dId = emp.department || emp.department_id;
          const dIds = emp.department_ids || [];
          return dId === departmentFilter || dIds.includes(departmentFilter);
        });

    const nodeMap = new Map<string, OrgChartNode>();

    filteredEmps.forEach((emp) => {
      const user = members?.find((m) => m.id === emp.user_id || m.id === emp.id || m.email === emp.email);
      const oooInfo = oooMap.get(emp.id) || (emp.user_id ? oooMap.get(emp.user_id) : undefined);
      const deleg = delegationMap.get(emp.user_id) || delegationMap.get(emp.id);

      const node: OrgChartNode = {
        id: emp.id,
        userId: emp.user_id || (user ? user.id : emp.id),
        employeeProfileId: emp.id,
        name: emp.full_name || (user ? `${user.first_name} ${user.last_name}` : emp.email),
        firstName: emp.first_name || (user ? user.first_name : ''),
        lastName: emp.last_name || (user ? user.last_name : ''),
        email: emp.email,
        role: emp.role || (user ? user.role : 'employee'),
        departmentName: emp.department_name || (user ? user.department_name : '') || 'Unassigned',
        departmentId: emp.department || emp.department_id || (user ? user.department_id : null),
        departmentIds: emp.department_ids || (user ? user.department_ids : []),
        managerId: emp.manager_id || emp.manager || null,
        skills: emp.skills || [],
        isActive: emp.is_active ?? (user ? user.is_active : true),
        statusMessage: emp.status_message || (user ? user.status_message : null),
        statusEmoji: emp.status_emoji || (user ? user.status_emoji : null),
        taskStats: user?.task_stats || emp.task_stats || { total: 0, completed: 0, overdue: 0 },
        isOnline: emp.is_online ?? user?.is_online ?? false,
        lastSeenDisplay: emp.last_seen_display || user?.last_seen_display,
        isOoo: oooInfo?.isOoo || false,
        oooEndDate: oooInfo?.endDate,
        directReportsCount: 0,
        activeDelegation: deleg
          ? {
              id: deleg.id,
              delegatee_name: deleg.delegatee_name || deleg.delegatee?.email || 'Acting Proxy',
              delegation_type: deleg.delegation_type,
              start_date: deleg.start_date,
              end_date: deleg.end_date,
              notes: deleg.notes,
            }
          : undefined,
        children: [],
      };
      nodeMap.set(emp.id, node);
      if (emp.user_id) {
        nodeMap.set(emp.user_id, node);
      }
    });

    const roots: OrgChartNode[] = [];

    // Link parents to direct reports
    nodeMap.forEach((node, key) => {
      if (key !== node.id) return; // avoid duplicate pass for userId

      if (node.managerId && nodeMap.has(node.managerId) && node.managerId !== node.id) {
        const parent = nodeMap.get(node.managerId);
        if (parent && !parent.children.some((c) => c.id === node.id)) {
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    // Calculate Span of Control for every manager in the tree
    let totalDirectReportsSum = 0;
    let managerCount = 0;
    let overloaded = 0;
    let optimal = 0;
    let maxReports = 0;

    nodeMap.forEach((node, key) => {
      if (key !== node.id) return;
      const count = node.children.length;
      node.directReportsCount = count;

      if (count > 0) {
        managerCount += 1;
        totalDirectReportsSum += count;
        if (count > maxReports) maxReports = count;

        if (count > 10) {
          node.spanOfControlStatus = 'overloaded';
          overloaded += 1;
        } else if (count >= 5 && count <= 8) {
          node.spanOfControlStatus = 'optimal';
          optimal += 1;
        } else if (count >= 9 && count <= 10) {
          node.spanOfControlStatus = 'elevated';
        } else {
          node.spanOfControlStatus = 'manageable';
        }
      }
    });

    // Sort roots: Admins first, then Department Heads / Managers, then others
    const rolePriority: Record<string, number> = { admin: 1, hr: 2, manager: 3, employee: 4 };
    roots.sort((a, b) => (rolePriority[a.role] || 5) - (rolePriority[b.role] || 5));

    const avgSpan = managerCount > 0 ? Math.round((totalDirectReportsSum / managerCount) * 10) / 10 : 0;

    return {
      rootNodes: roots,
      totalNodeCount: filteredEmps.length,
      spanTelemetry: {
        totalManagers: managerCount,
        avgSpan,
        overloadedCount: overloaded,
        optimalCount: optimal,
        maxSpan: maxReports,
      },
    };
  }, [employees, members, oooMap, delegationMap, departmentFilter]);

  const toggleCollapse = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const expandAll = () => setCollapsedNodes(new Set());
  const collapseAll = () => {
    const allParentIds = new Set<string>();
    const collectParents = (nodes: OrgChartNode[]) => {
      nodes.forEach((n) => {
        if (n.children.length > 0) {
          allParentIds.add(n.id);
          collectParents(n.children);
        }
      });
    };
    collectParents(rootNodes);
    setCollapsedNodes(allParentIds);
  };

  const handleHighlightOverload = () => {
    setHighlightOverloadOnly(!highlightOverloadOnly);
    // Expand all branches so overloaded managers are visible
    setCollapsedNodes(new Set());
  };

  const getRoleBadgeStyle = (role: OrgChartNode['role']) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'hr':
        return 'bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border-pink-200 dark:border-pink-800';
      case 'manager':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'employee':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    }
  };

  const getAvatarRoleStyle = (role: OrgChartNode['role']) => {
    switch (role) {
      case 'admin':
        return 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300';
      case 'hr':
        return 'border-pink-500 bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300';
      case 'manager':
        return 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300';
      case 'employee':
        return 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
    }
  };

  const isMatchingSearch = (node: OrgChartNode): boolean => {
    if (!searchQuery.trim()) return false;
    const query = searchQuery.toLowerCase();
    const nameMatch = node.name.toLowerCase().includes(query);
    const emailMatch = node.email.toLowerCase().includes(query);
    const deptMatch = node.departmentName.toLowerCase().includes(query);
    const roleMatch = node.role.toLowerCase().includes(query);
    const skillMatch = (node.skills || []).some((s) => s.toLowerCase().includes(query));
    return nameMatch || emailMatch || deptMatch || roleMatch || skillMatch;
  };

  // Recursive Node Renderer
  const renderNode = (node: OrgChartNode, level: number = 0) => {
    const isCollapsed = collapsedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isHighlighted = isMatchingSearch(node);
    const isOverloaded = node.spanOfControlStatus === 'overloaded';
    const activeTasks = (node.taskStats?.total || 0) - (node.taskStats?.completed || 0);

    const matchesFilterHighlight = highlightOverloadOnly ? isOverloaded : true;

    return (
      <div key={node.id} className="flex flex-col items-center">
        {/* Node Card */}
        <div
          onClick={() => onSelectMember(node)}
          className={`relative group flex flex-col w-72 rounded-2xl border p-4 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-xl select-none ${
            isHighlighted
              ? 'ring-2 ring-primary border-primary bg-primary/5 dark:bg-primary/10 shadow-primary/20 scale-105 z-10'
              : isOverloaded
              ? 'border-red-400 bg-red-50/20 dark:bg-red-950/20 dark:border-red-800 shadow-red-500/10'
              : !matchesFilterHighlight
              ? 'opacity-40 bg-white dark:bg-slate-900 border-border'
              : 'bg-white dark:bg-slate-900 border-border hover:border-primary/50'
          }`}
        >
          {/* OOO Banner / Top Badge */}
          {node.isOoo && (
            <div className="absolute -top-2.5 right-3 bg-amber-500 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm z-10 animate-bounce">
              <Palmtree className="h-2.5 w-2.5" />
              <span>OOO (Leaves)</span>
            </div>
          )}

          {/* Card Top: Avatar & Title Info */}
          <div className="flex items-start gap-3">
            <div className="relative">
              <div
                className={`h-12 w-12 rounded-full border-2 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${getAvatarRoleStyle(
                  node.role
                )}`}
              >
                {getInitials(node.firstName, node.lastName)}
              </div>
              <span
                className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
                  node.isOnline ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-500'
                }`}
                title={node.isOnline ? '🟢 Online Now' : `⚪ Offline • Last seen ${node.lastSeenDisplay || 'recently'}`}
              >
                {node.isOnline && (
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                )}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors">
                  {node.name}
                </h4>
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${getRoleBadgeStyle(node.role)}`}>
                  {node.role}
                </span>
                {node.statusEmoji && (
                  <span className="text-xs" title={node.statusMessage || ''}>
                    {node.statusEmoji}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground truncate mt-1 flex items-center gap-1">
                <Briefcase className="h-3 w-3 shrink-0 text-slate-400" />
                <span className="truncate font-medium">{node.departmentName}</span>
              </p>
            </div>
          </div>

          {/* Span of Control Badge (Pillar 2 Requirement) */}
          {hasChildren && (
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                {node.spanOfControlStatus === 'overloaded' ? (
                  <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300 border border-red-300 dark:border-red-800 flex items-center gap-1 animate-pulse">
                    <AlertTriangle className="h-3 w-3 text-red-600" />
                    <span>Overload Risk ({node.children.length} &gt; 10 reports)</span>
                  </span>
                ) : node.spanOfControlStatus === 'optimal' ? (
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                    <Sparkles className="h-2.5 w-2.5 text-emerald-600" />
                    <span>Optimal Span ({node.children.length} reports)</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-border flex items-center gap-1">
                    <Users className="h-2.5 w-2.5 text-slate-500" />
                    <span>{node.children.length} Direct Reports</span>
                  </span>
                )}

                {/* 1-Click OOO Proxy Delegation Trigger */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenDelegationModal) {
                      onOpenDelegationModal(node.userId || node.id);
                    }
                  }}
                  className="text-[10px] text-primary hover:text-primary/80 font-bold flex items-center gap-1 hover:underline"
                  title="Grant 1-click Out-of-Office Approval Proxy"
                >
                  <Shield className="h-3 w-3" />
                  <span>Delegate</span>
                </button>
              </div>

              {/* Active Delegation Pill */}
              {node.activeDelegation && (
                <div className="p-1.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-[9px] text-indigo-800 dark:text-indigo-300 flex items-center justify-between font-semibold">
                  <div className="flex items-center gap-1 truncate">
                    <ShieldCheck className="h-3 w-3 text-indigo-600 shrink-0" />
                    <span className="truncate">Proxy: <strong className="font-bold">{node.activeDelegation.delegatee_name}</strong></span>
                  </div>
                  <span className="uppercase text-[8px] bg-indigo-100 dark:bg-indigo-900/50 px-1 py-0.2 rounded font-extrabold shrink-0">
                    {node.activeDelegation.delegation_type}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Skills Matrix tags preview */}
          {node.skills && node.skills.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-1">
              {node.skills.slice(0, 3).map((skill, idx) => (
                <span
                  key={idx}
                  className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[9px] font-semibold px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700 truncate max-w-[90px]"
                >
                  {skill}
                </span>
              ))}
              {node.skills.length > 3 && (
                <span className="text-[9px] text-muted-foreground font-bold px-1">
                  +{node.skills.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Footer Stats Row */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-muted-foreground font-medium">
            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
              <CheckSquare className="h-3 w-3 text-primary" />
              <span>{activeTasks} tasks</span>
            </span>
            {node.taskStats && node.taskStats.overdue > 0 && (
              <span className="flex items-center gap-0.5 text-red-500 font-bold">
                <Clock className="h-3 w-3" />
                <span>{node.taskStats.overdue} overdue</span>
              </span>
            )}
          </div>

          {/* Expand / Collapse Subtree Floating Pill */}
          {hasChildren && (
            <button
              onClick={(e) => toggleCollapse(node.id, e)}
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 border border-border text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-md flex items-center gap-1 transition-transform active:scale-95 z-20"
              title={isCollapsed ? 'Expand Direct Reports' : 'Collapse Subtree'}
            >
              {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <span>{node.children.length} direct reports</span>
            </button>
          )}
        </div>

        {/* Tree Connectors & Children */}
        {hasChildren && !isCollapsed && (
          <div className="flex flex-col items-center w-full">
            {/* Vertical stem from parent */}
            <div className="w-0.5 h-7 bg-border" />

            {/* Horizontal branch line if multiple children */}
            <div className="flex justify-center relative pt-2">
              {node.children.length > 1 && (
                <div
                  className="absolute top-0 h-0.5 bg-border"
                  style={{
                    left: `${100 / (node.children.length * 2)}%`,
                    right: `${100 / (node.children.length * 2)}%`,
                  }}
                />
              )}

              {/* Children Nodes */}
              <div className="flex gap-8 items-start">
                {node.children.map((child) => (
                  <div key={child.id} className="flex flex-col items-center relative">
                    {/* Vertical line connecting horizontal branch to child */}
                    {node.children.length > 1 && <div className="w-0.5 h-4 bg-border -mt-2 mb-2" />}
                    {node.children.length === 1 && <div className="w-0.5 h-2 bg-border -mt-2 mb-2" />}
                    {renderNode(child, level + 1)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* ─────────────────────────────────────────────────────────────
          EXECUTIVE SPAN OF CONTROL TELEMETRY STRIP (PILLAR 2)
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 text-white p-4 rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center border border-primary/30 shadow-inner">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Reporting Hierarchy & Span of Control Radar
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                Ideal Span: 5–8 Reports
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Head of Department ⟶ Managers ⟶ Tech Leads ⟶ Engineers with automated overload risk detection.
            </p>
          </div>
        </div>

        {/* Telemetry Metrics Counter Strip */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Avg Span</span>
            <span className="text-sm font-extrabold text-white">{spanTelemetry.avgSpan}</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Managers</span>
            <span className="text-sm font-extrabold text-white">{spanTelemetry.totalManagers}</span>
          </div>

          {/* Overload Risk Button / Filter */}
          <button
            type="button"
            onClick={handleHighlightOverload}
            className={`px-3 py-1.5 rounded-xl border transition-all text-center ${
              spanTelemetry.overloadedCount > 0
                ? highlightOverloadOnly
                  ? 'bg-red-500 text-white border-red-400 ring-2 ring-red-400 font-bold'
                  : 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30'
                : 'bg-slate-800/80 border-slate-700/80 text-slate-400'
            }`}
            title="Click to toggle highlight of overloaded managers (> 10 direct reports)"
          >
            <span className="text-[10px] uppercase font-bold flex items-center justify-center gap-1">
              <AlertTriangle className="h-3 w-3 text-red-400" /> Overload Risk
            </span>
            <span className="text-sm font-extrabold">
              {spanTelemetry.overloadedCount} {spanTelemetry.overloadedCount === 1 ? 'Manager' : 'Managers'}
            </span>
          </button>

          {/* 1-Click OOO Proxy Delegation Trigger */}
          <Button
            size="sm"
            onClick={() => onOpenDelegationModal && onOpenDelegationModal()}
            className="text-xs h-9 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-1.5"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>1-Click OOO Proxy Delegation</span>
          </Button>
        </div>
      </div>

      {/* Controls Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Department Filter Selector */}
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="h-8.5 rounded-md border border-input bg-white px-2.5 py-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:bg-slate-950 dark:border-slate-800"
            >
              <option value="all">All Departments (Entire Organization)</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.head_name ? `(Head: ${d.head_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative w-48 sm:w-60">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Find in org tree (name, skill)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-8.5 w-full rounded-md border border-input bg-white pl-8 pr-3 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:bg-slate-950 dark:border-slate-800"
            />
          </div>

          <span className="text-xs text-muted-foreground font-semibold">
            {totalNodeCount} Active Members
          </span>
        </div>

        {/* Tree Action Buttons & Zoom Controls */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={expandAll}
            className="h-8 text-xs font-semibold px-2.5 text-slate-700 dark:text-slate-200 border-border"
          >
            Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={collapseAll}
            className="h-8 text-xs font-semibold px-2.5 text-slate-700 dark:text-slate-200 border-border"
          >
            Collapse All
          </Button>

          <div className="h-4 w-px bg-border mx-1" />

          {/* Zoom controls */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setZoomLevel((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 w-10 text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setZoomLevel((z) => Math.min(1.5, Math.round((z + 0.1) * 10) / 10))}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setZoomLevel(1)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Reset Zoom (100%)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Interactive Visual Graph Canvas */}
      <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-border rounded-2xl p-8 overflow-auto min-h-[520px] max-h-[75vh] flex justify-center shadow-inner relative select-none">
        {rootNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <Users className="h-8 w-8 text-slate-400 mb-2" />
            <p className="text-xs font-semibold">No organizational reporting lines found for this selection.</p>
          </div>
        ) : (
          <div
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out',
            }}
            className="flex gap-14 justify-center items-start pt-4 pb-16 min-w-max"
          >
            {rootNodes.map((root) => renderNode(root))}
          </div>
        )}
      </div>
    </div>
  );
};
