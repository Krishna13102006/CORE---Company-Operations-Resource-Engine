// dashboard.js — Main app controller

// Panel definitions — role visibility enforced here
const PANELS = [
  {
    id:       'dashboard',
    label:    'Dashboard',
    roles:    ['employee', 'manager', 'hr', 'admin'],
    topbar:   'Workspace Dashboard',
  },
  {
    id:       'knowledge',
    label:    'Knowledge',
    roles:    ['employee', 'manager', 'hr', 'admin'],
    topbar:   'Knowledge Base',
  },
  {
    id:       'projects',
    label:    'Projects',
    roles:    ['employee', 'manager', 'hr', 'admin'],
    topbar:   'Project Management',
  },
  {
    id:       'teams',
    label:    'Teams',
    roles:    ['manager', 'hr', 'admin'],
    topbar:   'Team Management',
  },
  {
    id:       'hiring',
    label:    'Hiring',
    roles:    ['hr', 'admin'],
    topbar:   'Hiring Portal',
  },
  {
    id:       'documents',
    label:    'Database & Documents',
    roles:    ['admin'],
    topbar:   'Database & Documents Administration',
  }
];

let currentUser = null;
let activePanelId = 'dashboard';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Verify authentication
  if (!TokenStore.isAuthenticated()) {
    redirectToLogin();
    return;
  }

  initApp();
});

async function initApp() {
  // 2. Fetch current user profile
  try {
    const response = await api.get('/auth/me/');
    if (!response || !response.ok) {
      redirectToLogin();
      return;
    }
    currentUser = await response.json();
    TokenStore.setUser(currentUser);
  } catch (err) {
    redirectToLogin();
    return;
  }

  // 3. Populate sidebar profile info
  document.getElementById('sidebar-user-name').textContent = `${currentUser.first_name} ${currentUser.last_name}`;
  document.getElementById('sidebar-user-role').textContent = currentUser.role;
  
  // Try to display organization ID/Name
  const orgNameEl = document.getElementById('sidebar-org-name');
  orgNameEl.textContent = currentUser.org_name || 'Platform Admin';

  // 4. Build sidebar nav links dynamically based on role
  buildSidebarNav();

  // 5. Load default active panel
  switchPanel(activePanelId);

  // 6. Bind sign out button
  document.getElementById('logout-btn').addEventListener('click', () => {
    TokenStore.clear();
    Toast.success('Signed out successfully.');
    setTimeout(() => { redirectToLogin(); }, 800);
  });
}

function buildSidebarNav() {
  const navContainer = document.getElementById('sidebar-nav');
  navContainer.innerHTML = '';

  const userRole = getCurrentUserRole();

  // Core sections layout
  const label = document.createElement('div');
  label.className = 'nav-section-label';
  label.textContent = 'Workspace';
  navContainer.appendChild(label);

  PANELS.forEach(panel => {
    if (panel.roles.includes(userRole)) {
      const navItem = document.createElement('a');
      navItem.className = `nav-item ${panel.id === activePanelId ? 'active' : ''}`;
      navItem.dataset.panelId = panel.id;
      navItem.href = '#';
      navItem.innerHTML = `
        <span>${panel.label}</span>
      `;
      
      navItem.addEventListener('click', (e) => {
        e.preventDefault();
        switchPanel(panel.id);
      });

      navContainer.appendChild(navItem);
    }
  });
}

async function switchPanel(panelId) {
  activePanelId = panelId;
  const panel = PANELS.find(p => p.id === panelId);
  if (!panel) return;

  // Update navbar active state
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
    if (el.dataset.panelId === panelId) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  // Update topbar title
  document.getElementById('topbar-title').textContent = panel.topbar;
  
  // Clear topbar actions
  document.getElementById('topbar-actions').innerHTML = '';

  // Show Loading Spinner in Content Area
  const contentContainer = document.getElementById('panel-content');
  contentContainer.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:200px;">
      <span class="spinner" style="width:32px;height:32px;border-width:3px;"></span>
    </div>
  `;

  // Fetch Panel Template Fragment
  try {
    const response = await fetch(`/panels/${panelId}/`);
    if (!response.ok) {
      contentContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">Error Loading Panel</div>
          <div class="empty-state-text">Could not load panel content from backend.</div>
        </div>
      `;
      return;
    }
    const html = await response.text();
    contentContainer.innerHTML = html;

    // Initialize Panel Specific Interaction Logic
    initializePanelController(panelId);
  } catch (err) {
    contentContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">Connection Error</div>
        <div class="empty-state-text">Failed to connect to panel service.</div>
      </div>
    `;
  }
}

// === PANEL INITIALIZATION & INTERACTION LOGIC ===

function initializePanelController(panelId) {
  if (panelId === 'dashboard') initDashboardPanel();
  if (panelId === 'knowledge') initKnowledgePanel();
  if (panelId === 'projects') initProjectsPanel();
  if (panelId === 'teams') initTeamsPanel();
  if (panelId === 'hiring') initHiringPanel();
  if (panelId === 'documents') initDocumentsPanel();
}

// 1. Dashboard panel
function initDashboardPanel() {
  const role = currentUser?.role || 'employee';

  // Greeting and date
  const greetingEl = document.getElementById('dashboard-greeting');
  const dateEl     = document.getElementById('dashboard-date');
  if (greetingEl) {
    const hour     = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    greetingEl.textContent = `${greeting}, ${currentUser.first_name}!`;
  }
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  // Show role-specific sections
  if (['manager', 'hr', 'admin'].includes(role)) {
    const teamsCard = document.getElementById('card-teams-analytics');
    if (teamsCard) teamsCard.style.display = 'block';
  }
  if (['hr', 'admin'].includes(role)) {
    const hiringCard = document.getElementById('card-hiring-analytics');
    if (hiringCard) hiringCard.style.display = 'block';
  }

  // Phase 6 — Predictive ML cards
  // if (['hr', 'admin'].includes(role)) {
  //   const attritionCard = document.getElementById('card-attrition-risk');
  //   if (attritionCard) attritionCard.style.display = 'block';
  // }
  // if (['manager', 'hr', 'admin'].includes(role)) {
  //   const projectRiskCard = document.getElementById('card-project-risk');
  //   if (projectRiskCard) projectRiskCard.style.display = 'block';
  // }

  // Refresh button
  document.getElementById('btn-refresh-dashboard')?.addEventListener('click', () => {
    loadAllDashboardData(role);
  });

  // Load all data
  loadAllDashboardData(role);
}

function loadAllDashboardData(role) {
  loadOverviewStats(role);
  loadRecentActivity(role);
  loadKnowledgeAnalytics();
  loadProjectsAnalytics(role);
  if (['manager', 'hr', 'admin'].includes(role)) loadTeamsAnalytics();
  if (['hr', 'admin'].includes(role)) loadHiringAnalytics();
  // if (['hr', 'admin'].includes(role))              loadAttritionRisks();
  // if (['manager', 'hr', 'admin'].includes(role))   loadProjectRisks();
}

// ── Plotly loader (checks global first, falls back to local static) ─────

let plotlyLoaded      = false;
let plotlyLoadPromise = null;

function loadPlotly() {
  if (typeof Plotly !== 'undefined') return Promise.resolve();
  if (plotlyLoaded) return Promise.resolve();
  if (plotlyLoadPromise) return plotlyLoadPromise;

  plotlyLoadPromise = new Promise((resolve, reject) => {
    const script   = document.createElement('script');
    script.src     = '/static/js/plotly.min.js';
    script.onload  = () => { plotlyLoaded = true; resolve(); };
    script.onerror = (err) => { console.error('[Dashboard] Failed to load local Plotly script', err); reject(err); };
    document.head.appendChild(script);
  });
  return plotlyLoadPromise;
}

// Plotly helper — purges previous chart then draws fresh
function createPlotlyChart(divId, traces, layout, config) {
  const div = document.getElementById(divId);
  if (!div) return;
  if (typeof Plotly === 'undefined') {
    console.error('[Dashboard] Plotly not loaded — cannot render chart:', divId);
    return;
  }
  Plotly.purge(div);
  Plotly.newPlot(div, traces, layout, { displayModeBar: 'hover', responsive: true, ...config });
}

// ── Shared Plotly style tokens matching core.css variables ─────────────

const CHART_COLORS = [
  '#2E5DA6', '#E8762B', '#2D7D46', '#B45309', '#7C3AED',
  '#1E2D4E', '#C53030', '#4A6FA5', '#718096', '#D4691F',
];

const BASE_LAYOUT = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor:  'rgba(0,0,0,0)',
  font: { family: 'Inter, sans-serif', size: 11, color: '#4A5568' },
  margin: { t: 16, b: 36, l: 44, r: 16, pad: 4 },
  hoverlabel: { bgcolor: '#1E2D4E', font: { color: '#fff', size: 12 } },
};

// ── Overview stats ─────────────────────────────────────────────────────

async function loadOverviewStats(role) {
  const grid = document.getElementById('overview-stats-grid');
  if (!grid) return;

  try {
    const response = await api.get('/analytics/overview/');
    if (!response || !response.ok) return;
    const data = await response.json();

    const cards = [];

    // All roles
    cards.push({ label: 'Knowledge Documents', value: data.total_documents ?? 0,  sub: `${data.searchable_documents ?? 0} searchable` });
    cards.push({ label: 'My Open Tasks',        value: data.my_open_tasks ?? 0,    sub: data.my_overdue_tasks ? `${data.my_overdue_tasks} overdue` : 'none overdue', alert: data.my_overdue_tasks > 0 });
    cards.push({ label: 'Active Projects',      value: data.active_projects ?? 0  });

    if (['manager', 'hr', 'admin'].includes(role)) {
      cards.push({ label: 'Active Employees', value: data.active_employees ?? 0 });
    }
    if (['hr', 'admin'].includes(role)) {
      cards.push({ label: 'Open Positions',          value: data.open_positions ?? 0 });
      cards.push({ label: 'Applications This Month', value: data.applications_this_month ?? 0 });
    }
    if (role === 'admin') {
      cards.push({ label: 'Total Users', value: data.total_users ?? 0 });
    }

    grid.innerHTML = cards.map(card => `
      <div class="stat-card">
        <div class="stat-card-label">${card.label}</div>
        <div class="stat-card-value" style="color:${card.alert ? 'var(--color-error)' : 'var(--color-orange)'};">
          ${card.value}
        </div>
        ${card.sub ? `<div class="stat-card-sub" style="font-size:12px;margin-top:4px;color:${card.alert ? 'var(--color-error)' : 'var(--color-text-muted)'};">${card.sub}</div>` : ''}
      </div>
    `).join('');

  } catch (e) { /* silently fail */ }
}

// ── Recent Activity ────────────────────────────────────────────────────

async function loadRecentActivity(role) {
  const listEl   = document.getElementById('activity-list');
  const updateEl = document.getElementById('activity-update-time');
  if (!listEl) return;

  try {
    const response = await api.get('/analytics/activity/?limit=15');
    if (!response || !response.ok) return;
    const items = await response.json();

    if (updateEl) updateEl.textContent = `Updated ${new Date().toLocaleTimeString()}`;

    if (!items.length) {
      listEl.innerHTML = `<div style="padding:24px;text-align:center;color:var(--color-text-muted);font-size:14px;">No activity yet.</div>`;
      return;
    }

    const actionLabels = {
      'upload_document':    '📄 Uploaded a document',
      'create_project':     '📋 Created a project',
      'create_task':        '✓ Created a task',
      'update_task':        '✎ Updated a task',
      'create_employee':    '👤 Added an employee',
      'create_job_posting': '💼 Posted a job',
      'add_candidate':      '📥 Added a candidate',
      'move_stage':         '→ Moved a candidate',
      'approve_leave':      '✓ Approved leave',
      'reject_leave':       '✕ Rejected leave',
      'create_review':      '⭐ Added a review',
    };

    listEl.innerHTML = items.map(item => {
      const label  = actionLabels[item.action] || item.action.replace(/_/g, ' ');
      const time   = new Date(item.created_at).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const detail = item.detail ? ` · ${item.detail.substring(0, 60)}${item.detail.length > 60 ? '…' : ''}` : '';
      return `
        <div style="display:flex;gap:12px;padding:12px 16px;border-bottom:1px solid var(--color-border);">
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;color:var(--color-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label}</div>
            <div style="font-size:12px;color:var(--color-text-muted);margin-top:2px;">${item.actor}${detail}</div>
          </div>
          <div style="font-size:11px;color:var(--color-text-muted);white-space:nowrap;flex-shrink:0;padding-top:2px;">${time}</div>
        </div>`;
    }).join('');

  } catch (e) { /* silently fail */ }
}

// ── Knowledge Analytics ────────────────────────────────────────────────

async function loadKnowledgeAnalytics() {
  try {
    // Load Plotly and fetch data in parallel — independently so a CDN error doesn't kill data
    const [plotlyResult, response] = await Promise.allSettled([loadPlotly(), api.get('/analytics/knowledge/')]);
    if (!response || response.status !== 'fulfilled' || !response.value?.ok) return;
    const data = await response.value.json();

    // Badge — total document count
    const badge = document.getElementById('knowledge-total-badge');
    const total = (data.by_status || []).reduce((sum, s) => sum + s.count, 0);
    if (badge) badge.textContent = `${total} documents`;

    // Category donut
    const catData = data.by_category || [];
    if (catData.length > 0 && typeof Plotly !== 'undefined') {
      createPlotlyChart('chart-docs-category', [{
        type: 'pie',
        hole: 0.45,
        labels: catData.map(c => c.category),
        values: catData.map(c => c.count),
        marker: { colors: CHART_COLORS.slice(0, catData.length) },
        textinfo: 'percent',
        hovertemplate: '<b>%{label}</b><br>%{value} docs (%{percent})<extra></extra>',
      }], {
        ...BASE_LAYOUT,
        margin: { t: 8, b: 8, l: 8, r: 8 },
        legend: { orientation: 'v', x: 1.02, y: 0.5, font: { size: 11 } },
        height: 200,
      });
    } else {
      const el = document.getElementById('chart-docs-category');
      if (el) el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--color-text-muted);font-size:13px;">No categories yet.</div>';
    }

    // Status donut
    const statusData   = data.by_status || [];
    const statusColors = { uploaded: '#718096', processing: '#B45309', searchable: '#2D7D46', failed: '#C53030' };
    if (statusData.length > 0 && typeof Plotly !== 'undefined') {
      createPlotlyChart('chart-docs-status', [{
        type: 'pie',
        hole: 0.45,
        labels: statusData.map(s => s.status),
        values: statusData.map(s => s.count),
        marker: { colors: statusData.map(s => statusColors[s.status] || '#718096') },
        textinfo: 'percent',
        hovertemplate: '<b>%{label}</b><br>%{value} docs (%{percent})<extra></extra>',
      }], {
        ...BASE_LAYOUT,
        margin: { t: 8, b: 8, l: 8, r: 8 },
        legend: { orientation: 'v', x: 1.02, y: 0.5, font: { size: 11 } },
        height: 200,
      });
    }

    // Uploads trend — filled line
    const trendData = data.uploads_trend || [];
    if (!trendData.length) {
      const el = document.getElementById('chart-uploads-trend');
      if (el) el.innerHTML = '<div style="padding:16px;color:var(--color-text-muted);font-size:13px;">No uploads in the last 30 days.</div>';
    } else if (typeof Plotly !== 'undefined') {
      createPlotlyChart('chart-uploads-trend', [{
        type: 'scatter',
        mode: 'lines+markers',
        x: trendData.map(d => d.day),
        y: trendData.map(d => d.count),
        fill: 'tozeroy',
        fillcolor: 'rgba(46,93,166,0.12)',
        line: { color: '#2E5DA6', width: 2.5, shape: 'spline' },
        marker: { size: 5, color: '#2E5DA6' },
        hovertemplate: '<b>%{x}</b>: %{y} uploads<extra></extra>',
      }], {
        ...BASE_LAYOUT,
        showlegend: false,
        height: 130,
        margin: { t: 8, b: 36, l: 36, r: 8 },
        xaxis: { showgrid: false, tickfont: { size: 10 } },
        yaxis: { dtick: 1, gridcolor: '#E2E8F0', zeroline: false, tickfont: { size: 10 } },
      });
    }

  } catch (e) { /* silently fail */ }
}

// ── Projects Analytics ─────────────────────────────────────────────────

async function loadProjectsAnalytics(role) {
  try {
    const [plotlyResult, response] = await Promise.allSettled([loadPlotly(), api.get('/analytics/projects/')]);
    if (!response || response.status !== 'fulfilled' || !response.value?.ok) return;
    const data = await response.value.json();

    // My tasks donut
    const myTasks = data.my_tasks_by_status || [];
    if (myTasks.length > 0 && typeof Plotly !== 'undefined') {
      const statusColors = { todo: '#718096', in_progress: '#2E5DA6', blocked: '#C53030', done: '#2D7D46' };
      createPlotlyChart('chart-my-tasks', [{
        type: 'pie',
        hole: 0.45,
        labels: myTasks.map(s => s.status.replace(/_/g, ' ')),
        values: myTasks.map(s => s.count),
        marker: { colors: myTasks.map(s => statusColors[s.status] || '#718096') },
        textinfo: 'value',
        hovertemplate: '<b>%{label}</b>: %{value} tasks<extra></extra>',
      }], {
        ...BASE_LAYOUT,
        height: 180,
        margin: { t: 8, b: 8, l: 8, r: 8 },
        legend: { orientation: 'h', x: 0.5, xanchor: 'center', y: -0.1, font: { size: 11 } },
      });
    } else {
      const div = document.getElementById('chart-my-tasks');
      if (div) div.innerHTML = '<div style="text-align:center;padding:32px;color:var(--color-text-muted);font-size:14px;">No tasks assigned yet.</div>';
    }

    // Overdue alert
    const overdueCount = (data.overdue_tasks || []).length;
    const alertEl = document.getElementById('overdue-tasks-alert');
    const countEl = document.getElementById('overdue-tasks-count');
    if (alertEl && overdueCount > 0) {
      alertEl.style.display = 'block';
      if (countEl) countEl.textContent = `⚠ ${overdueCount} task${overdueCount !== 1 ? 's' : ''} overdue`;
    }

    // Tasks by priority bar
    const priorityData   = data.tasks_by_priority || [];
    const priorityColors = { low: '#718096', medium: '#2E5DA6', high: '#E8762B', critical: '#C53030' };
    if (priorityData.length > 0 && typeof Plotly !== 'undefined') {
      createPlotlyChart('chart-tasks-priority', [{
        type: 'bar',
        x: priorityData.map(p => p.priority),
        y: priorityData.map(p => p.count),
        marker: { color: priorityData.map(p => priorityColors[p.priority] || '#718096'), opacity: 0.9 },
        hovertemplate: '<b>%{x}</b>: %{y} tasks<extra></extra>',
      }], {
        ...BASE_LAYOUT,
        showlegend: false,
        height: 200,
        bargap: 0.35,
        xaxis: { tickfont: { size: 11 } },
        yaxis: { dtick: 1, gridcolor: '#E2E8F0', zeroline: false, tickfont: { size: 10 } },
      });
    }

    // Overdue tasks list
    const overdueListEl = document.getElementById('overdue-tasks-list');
    const overdueTasks  = data.overdue_tasks || [];
    if (overdueListEl) {
      if (!overdueTasks.length) {
        overdueListEl.innerHTML = '<div style="color:var(--color-success);font-size:13px;padding:8px 0;">No overdue tasks. 🎉</div>';
      } else {
        overdueListEl.innerHTML = overdueTasks.map(t => `
          <div style="padding:8px 0;border-bottom:1px solid var(--color-border);">
            <div style="font-size:13px;font-weight:600;color:var(--color-text-primary);">${t.title}</div>
            <div style="font-size:12px;color:var(--color-text-muted);margin-top:2px;">
              ${t.project} · ${t.assignee || 'Unassigned'} · <span style="color:var(--color-error);">Due ${t.due_date}</span>
            </div>
          </div>`).join('');
      }
    }

    // Task completion trend bar
    const completionTrend = data.completion_trend || [];
    if (completionTrend.length > 0 && typeof Plotly !== 'undefined') {
      createPlotlyChart('chart-completion-trend', [{
        type: 'bar',
        x: completionTrend.map(d => d.day),
        y: completionTrend.map(d => d.count),
        marker: { color: 'rgba(45,125,70,0.5)', line: { color: '#2D7D46', width: 1 } },
        hovertemplate: '<b>%{x}</b>: %{y} completed<extra></extra>',
      }], {
        ...BASE_LAYOUT,
        showlegend: false,
        height: 130,
        margin: { t: 8, b: 36, l: 36, r: 8 },
        bargap: 0.25,
        xaxis: { showgrid: false, tickfont: { size: 10 } },
        yaxis: { dtick: 1, gridcolor: '#E2E8F0', zeroline: false, tickfont: { size: 10 } },
      });
    }

  } catch (e) { /* silently fail */ }
}

// ── Teams Analytics ────────────────────────────────────────────────────

async function loadTeamsAnalytics() {
  try {
    const [plotlyResult, response] = await Promise.allSettled([loadPlotly(), api.get('/analytics/teams/')]);
    if (!response || response.status !== 'fulfilled' || !response.value?.ok) return;
    const data = await response.value.json();

    // Headcount by department — horizontal bar
    const deptData = data.headcount_by_department || [];
    if (deptData.length > 0 && typeof Plotly !== 'undefined') {
      createPlotlyChart('chart-headcount', [{
        type: 'bar',
        orientation: 'h',
        x: deptData.map(d => d.count),
        y: deptData.map(d => d.department),
        marker: { color: '#2E5DA6', opacity: 0.88 },
        hovertemplate: '<b>%{y}</b>: %{x} employees<extra></extra>',
      }], {
        ...BASE_LAYOUT,
        showlegend: false,
        height: 220,
        margin: { t: 8, b: 32, l: 110, r: 16 },
        xaxis: { dtick: 1, gridcolor: '#E2E8F0', zeroline: false, tickfont: { size: 10 } },
        yaxis: { tickfont: { size: 11 }, automargin: true },
        bargap: 0.35,
      });
    }

    // Upcoming leave list
    const leaveListEl   = document.getElementById('upcoming-leave-list');
    const upcomingLeave = data.upcoming_leave || [];
    if (leaveListEl) {
      if (!upcomingLeave.length) {
        leaveListEl.innerHTML = '<div style="color:var(--color-text-muted);font-size:13px;">No upcoming leave in the next 30 days.</div>';
      } else {
        leaveListEl.innerHTML = upcomingLeave.map(l => `
          <div style="padding:8px 0;border-bottom:1px solid var(--color-border);">
            <div style="font-size:13px;font-weight:600;color:var(--color-text-primary);">${l.name}</div>
            <div style="font-size:12px;color:var(--color-text-muted);margin-top:2px;">
              ${l.leave_type} leave · ${l.start_date} — ${l.end_date}
            </div>
          </div>`).join('');
      }
    }

  } catch (e) { /* silently fail */ }
}

// ── Hiring Analytics ───────────────────────────────────────────────────

async function loadHiringAnalytics() {
  try {
    const [plotlyResult, response] = await Promise.allSettled([loadPlotly(), api.get('/analytics/hiring/')]);
    if (!response || response.status !== 'fulfilled' || !response.value?.ok) return;
    const data = await response.value.json();

    // Hiring funnel bar
    const funnel = data.funnel || [];
    if (funnel.length > 0 && typeof Plotly !== 'undefined') {
      const funnelColors = ['#2E5DA6', '#4A6FA5', '#E8762B', '#2D7D46', '#1a5c30'];
      createPlotlyChart('chart-hiring-funnel', [{
        type: 'bar',
        x: funnel.map(f => f.stage),
        y: funnel.map(f => f.count),
        marker: { color: funnelColors, opacity: 0.9 },
        hovertemplate: '<b>%{x}</b>: %{y} candidates<extra></extra>',
      }], {
        ...BASE_LAYOUT,
        showlegend: false,
        height: 220,
        bargap: 0.3,
        xaxis: { tickfont: { size: 11 } },
        yaxis: { dtick: 1, gridcolor: '#E2E8F0', zeroline: false, tickfont: { size: 10 } },
      });
    }

    // Applications trend — filled line
    const appsTrend = data.apps_trend || [];
    if (appsTrend.length > 0 && typeof Plotly !== 'undefined') {
      createPlotlyChart('chart-apps-trend', [{
        type: 'scatter',
        mode: 'lines+markers',
        x: appsTrend.map(d => d.day),
        y: appsTrend.map(d => d.count),
        fill: 'tozeroy',
        fillcolor: 'rgba(232,118,43,0.12)',
        line: { color: '#E8762B', width: 2.5, shape: 'spline' },
        marker: { size: 5, color: '#E8762B' },
        hovertemplate: '<b>%{x}</b>: %{y} applications<extra></extra>',
      }], {
        ...BASE_LAYOUT,
        showlegend: false,
        height: 220,
        margin: { t: 8, b: 36, l: 36, r: 8 },
        xaxis: { showgrid: false, tickfont: { size: 10 } },
        yaxis: { dtick: 1, gridcolor: '#E2E8F0', zeroline: false, tickfont: { size: 10 } },
      });
    }

    // KPI tiles
    const avgHireEl  = document.getElementById('stat-avg-hire-days');
    const avgMatchEl = document.getElementById('stat-avg-match');
    if (avgHireEl)  avgHireEl.textContent  = data.avg_days_to_hire ? `${data.avg_days_to_hire}d` : '—';
    if (avgMatchEl) avgMatchEl.textContent = data.avg_match_score  ? `${data.avg_match_score}%` : '—';

  } catch (e) { /* silently fail */ }
}

async function loadAttritionRisks() {
  const container = document.getElementById('attrition-risk-content');
  if (!container) return;

  try {
    const response = await api.get('/analytics/attrition/');
    if (!response || !response.ok) {
      container.innerHTML = '<div style="padding:16px 0;color:var(--color-text-muted);font-size:14px;">Attrition prediction unavailable.</div>';
      return;
    }

    const data  = await response.json();
    const risks = data.risks || [];

    if (risks.length === 0) {
      container.innerHTML = `
        <div style="padding:16px 0;color:var(--color-success);font-size:14px;">
          No employees assessed as at-risk. 🎉
        </div>
      `;
      return;
    }

    const levelColors = { High: 'var(--color-error)', Medium: 'var(--color-warning)', Low: 'var(--color-success)' };
    const levelBadges = { High: 'badge-red', Medium: 'badge-yellow', Low: 'badge-green' };

    const insufficientWarning = data.insufficient_data
      ? `<div style="padding:10px 24px;background:var(--color-warning-bg);font-size:12px;color:var(--color-warning);">
           ⚠ Limited historical data — predictions are based on tenure heuristics. Accuracy improves as more employees leave and are recorded.
         </div>`
      : '';

    container.innerHTML = insufficientWarning + risks.map(r => `
      <div style="display:flex;align-items:flex-start;gap:16px;padding:12px 24px;border-bottom:1px solid var(--color-border);">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:var(--color-text-primary);">${r.employee_name}</div>
          <div style="font-size:12px;color:var(--color-text-muted);margin-top:2px;">${r.department}</div>
          ${r.key_signals.length > 0
            ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">
                 ${r.key_signals.map(s =>
                   `<span style="font-size:11px;padding:2px 8px;background:var(--color-warning-bg);
                                 color:var(--color-warning);border-radius:10px;">${s}</span>`
                 ).join('')}
               </div>`
            : ''}
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <span class="badge ${levelBadges[r.risk_level] || 'badge-grey'}">${r.risk_level} Risk</span>
          <div style="font-size:16px;font-weight:700;color:${levelColors[r.risk_level] || 'var(--color-text-muted)'};margin-top:4px;">
            ${Math.round(r.risk_score * 100)}%
          </div>
        </div>
      </div>
    `).join('');

    // Summary header
    const summaryHeader = `
      <div style="padding:12px 24px;background:var(--color-bg);border-bottom:1px solid var(--color-border);">
        <span style="font-size:13px;color:var(--color-text-muted);">
          ${data.high_risk_count} high risk · ${data.medium_risk_count} medium risk · ${data.total_assessed} assessed
        </span>
      </div>
    `;
    container.innerHTML = summaryHeader + insufficientWarning + container.innerHTML.replace(insufficientWarning, '');

  } catch {
    if (container) container.innerHTML = '<div style="padding:16px 0;color:var(--color-text-muted);font-size:14px;">Unable to load attrition data.</div>';
  }
}

async function loadProjectRisks() {
  const container = document.getElementById('project-risk-content');
  if (!container) return;

  try {
    const response = await api.get('/analytics/project-risks/');
    if (!response || !response.ok) {
      container.innerHTML = '<div style="padding:16px 0;color:var(--color-text-muted);font-size:14px;">Project risk scoring unavailable.</div>';
      return;
    }

    const data  = await response.json();
    const risks = data.risks || [];

    if (risks.length === 0) {
      container.innerHTML = `
        <div style="padding:16px 0;color:var(--color-success);font-size:14px;">
          No active projects to assess.
        </div>
      `;
      return;
    }

    const levelColors = { Critical: 'var(--color-error)', High: 'var(--color-orange)', Medium: 'var(--color-warning)', Low: 'var(--color-success)' };
    const levelBadges = { Critical: 'badge-red', High: 'badge-orange', Medium: 'badge-yellow', Low: 'badge-green' };

    container.innerHTML = `
      <div style="padding:12px 24px;background:var(--color-bg);border-bottom:1px solid var(--color-border);">
        <span style="font-size:13px;color:var(--color-text-muted);">
          ${data.critical_count} critical · ${data.high_risk_count} high risk · ${data.total_assessed} assessed
        </span>
      </div>
      ${risks.map(r => `
        <div style="display:flex;align-items:flex-start;gap:16px;padding:12px 24px;border-bottom:1px solid var(--color-border);">
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;color:var(--color-text-primary);">${r.project_name}</div>
            <div style="font-size:12px;color:var(--color-text-muted);margin-top:2px;">
              ${r.metrics.completion_pct}% complete
              ${r.metrics.days_until_deadline !== null
                ? r.metrics.days_until_deadline < 0
                  ? ` · <span style="color:var(--color-error);">${Math.abs(r.metrics.days_until_deadline)}d overdue</span>`
                  : ` · ${r.metrics.days_until_deadline}d remaining`
                : ''}
            </div>
            ${r.signals.length > 0
              ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">
                   ${r.signals.map(s =>
                     `<span style="font-size:11px;padding:2px 8px;background:var(--color-error-bg);
                                   color:var(--color-error);border-radius:10px;">${s}</span>`
                   ).join('')}
                 </div>`
              : ''}
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <span class="badge ${levelBadges[r.risk_level] || 'badge-grey'}">${r.risk_level}</span>
            <div style="font-size:16px;font-weight:700;color:${levelColors[r.risk_level] || 'var(--color-text-muted)'};margin-top:4px;">
              ${Math.round(r.risk_score * 100)}%
            </div>
          </div>
        </div>
      `).join('')}
    `;

  } catch {
    if (container) container.innerHTML = '<div style="padding:16px 0;color:var(--color-text-muted);font-size:14px;">Unable to load project risk data.</div>';
  }
}


// 2. Knowledge panel
function renderKnowledgePanel(content) {
  // Load the HTML fragment then initialize
  fetch('/panels/knowledge/')
    .then(r => r.text())
    .then(html => {
      content.innerHTML = html;
      initKnowledgePanel();
    });
}

function initKnowledgePanel() {
  // State variables
  let currentFilters   = {};
  let currentPage      = 1;
  let currentViewMode  = 'grid';   // 'grid' or 'list'
  let previousScrollY  = 0;
  let allStats         = null;
  let myUploadsLoaded  = false;
  let searchDebounce   = null;

  // Category color map — left border accent by category
  const CATEGORY_COLORS = {
    'Engineering': 'var(--color-blue-mid)',
    'Finance':     'var(--color-success)',
    'Legal':       'var(--color-warning)',
    'HR':          'var(--color-orange)',
    'Marketing':   '#7C3AED',
    'Operations':  'var(--color-text-muted)',
  };

  // File type color map
  const FILE_TYPE_COLORS = {
    'pdf':  '#DC2626',
    'docx': 'var(--color-blue-mid)',
    'txt':  'var(--color-text-muted)',
  };

  // Status badge class map
  const STATUS_BADGES = {
    'uploaded':   'badge-grey',
    'processing': 'badge-yellow',
    'searchable': 'badge-green',
    'failed':     'badge-red',
  };

  // ── Boot ──────────────────────────────────────────────────

  loadStats();
  loadDocuments(1);
  initSearchBar();
  initFilterBar();
  initViewToggle();
  initMyUploads();
  initKnowledgeUploadModal();
  initKnowledgeChat();

  // ── Stats and Category Grid ───────────────────────────────

  async function loadStats() {
    try {
      const response = await api.get('/knowledge/stats/');
      if (!response || !response.ok) return;
      allStats = await response.json();
      renderCategoryGrid(allStats);
    } catch {
      // silently fail — stats are not critical
    }
  }

  function renderCategoryGrid(stats) {
    const grid = document.getElementById('knowledge-category-grid');
    if (!grid) return;

    const categories = [
      { name: 'Engineering', icon: '⚙️' },
      { name: 'Finance',     icon: '💰' },
      { name: 'Legal',       icon: '⚖️' },
      { name: 'HR',          icon: '👥' },
      { name: 'Marketing',   icon: '📣' },
      { name: 'Operations',  icon: '🔧' },
    ];

    const byCategory = {};
    if (stats && stats.by_category) {
      stats.by_category.forEach(item => {
        byCategory[item.metadata__category] = item.count;
      });
    }

    grid.innerHTML = categories.map(cat => {
      const count    = byCategory[cat.name] || 0;
      const isActive = currentFilters.category === cat.name;
      return `
        <div
          class="card knowledge-category-card"
          data-category="${cat.name}"
          style="
            text-align:center;
            padding:16px 12px;
            cursor:pointer;
            border:2px solid ${isActive ? 'var(--color-blue-mid)' : 'var(--color-border)'};
            background:${isActive ? 'var(--color-blue-light)' : 'var(--color-surface)'};
            transition:border-color 0.15s ease,background 0.15s ease,transform 0.15s ease;
          "
        >
          <div style="font-size:24px;margin-bottom:6px;">${cat.icon}</div>
          <div style="font-size:13px;font-weight:600;color:var(--color-navy);margin-bottom:8px;">
            ${cat.name}
          </div>
          <span
            class="badge"
            style="background:var(--color-orange-light);color:var(--color-orange);font-size:12px;"
          >${count}</span>
        </div>
      `;
    }).join('');

    // Attach click handlers
    grid.querySelectorAll('.knowledge-category-card').forEach(card => {
      card.addEventListener('click', () => {
        handleCategoryFilter(card.dataset.category);
      });
      card.addEventListener('mouseenter', () => {
        if (currentFilters.category !== card.dataset.category) {
          card.style.transform = 'translateY(-2px)';
          card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
        }
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
        card.style.boxShadow = '';
      });
    });
  }

  // ── Document Loading ──────────────────────────────────────

  async function loadDocuments(page) {
    currentPage = page;
    const listEl = document.getElementById('knowledge-doc-list');
    if (!listEl) return;

    listEl.innerHTML = `
      <div style="display:flex;justify-content:center;padding:48px;">
        <span class="spinner" style="width:32px;height:32px;border-width:3px;"></span>
      </div>
    `;

    const params = new URLSearchParams({ page: String(page) });
    if (currentFilters.search)    params.set('search',    currentFilters.search);
    if (currentFilters.category)  params.set('category',  currentFilters.category);
    if (currentFilters.file_type) params.set('file_type', currentFilters.file_type);
    if (currentFilters.sort)      params.set('ordering',  currentFilters.sort);

    try {
      const response = await api.get(
        `/knowledge/documents/?${params.toString()}`
      );
      if (!response || !response.ok) {
        listEl.innerHTML = renderLoadError();
        return;
      }
      const data = await response.json();
      const docs  = data.results || [];
      const count = data.count   || 0;

      // Update count display
      const countEl = document.getElementById('knowledge-doc-count');
      if (countEl) {
        countEl.textContent = `${count} document${count !== 1 ? 's' : ''}`;
      }

      // Render list
      if (docs.length === 0) {
        listEl.innerHTML = renderEmptyState();
      } else if (currentViewMode === 'grid') {
        listEl.innerHTML = renderDocumentGrid(docs);
      } else {
        listEl.innerHTML = renderDocumentTable(docs);
      }

      // Attach click handlers to all document items
      listEl.querySelectorAll('[data-doc-id]').forEach(el => {
        el.addEventListener('click', () => {
          openDocumentDetail(el.dataset.docId);
        });
      });

      // Render pagination
      renderPagination(data);

    } catch {
      listEl.innerHTML = renderLoadError();
    }
  }

  // ── Grid and Table Renderers ──────────────────────────────

  function renderDocumentGrid(docs) {
    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;">
        ${docs.map(doc => renderDocumentCard(doc)).join('')}
      </div>
    `;
  }

  function renderDocumentCard(doc) {
    const meta      = doc.metadata || {};
    const category  = meta.category || '';
    const keywords  = (meta.keywords || []).slice(0, 3);
    const borderColor = CATEGORY_COLORS[category] || 'var(--color-border)';
    const fileColor   = FILE_TYPE_COLORS[doc.file_type] || 'var(--color-text-muted)';
    const statusClass = STATUS_BADGES[doc.status] || 'badge-grey';

    return `
      <div
        data-doc-id="${doc.id}"
        style="
          background:var(--color-surface);
          border:1px solid var(--color-border);
          border-left:4px solid ${borderColor};
          border-radius:8px;
          padding:16px;
          cursor:pointer;
          transition:transform 0.15s ease,box-shadow 0.15s ease;
        "
        onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)';"
        onmouseleave="this.style.transform='';this.style.boxShadow='';"
      >
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;">
          <span style="font-size:22px;color:${fileColor};">
            ${doc.file_type === 'pdf' ? '📕' : doc.file_type === 'docx' ? '📘' : '📄'}
          </span>
          ${category
            ? `<span class="badge badge-blue" style="font-size:10px;">${category}</span>`
            : ''}
        </div>
        <div
          style="font-size:14px;font-weight:600;color:var(--color-text-primary);margin-bottom:8px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;"
          title="${doc.title}"
        >${doc.title}</div>
        ${keywords.length > 0
          ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">
               ${keywords.map(k =>
                 `<span class="badge badge-grey" style="font-size:10px;font-weight:400;">${k}</span>`
               ).join('')}
             </div>`
          : `<div style="margin-bottom:10px;"></div>`
        }
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto;">
          <span style="font-size:11px;color:var(--color-text-muted);">
            ${doc.uploaded_by_name} · ${new Date(doc.created_at).toLocaleDateString()}
          </span>
          <span class="badge ${statusClass}" style="font-size:10px;">${doc.status}</span>
        </div>
      </div>
    `;
  }

  function renderDocumentTable(docs) {
    return `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Category</th>
              <th>Uploaded By</th>
              <th>Size</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${docs.map(doc => {
              const meta     = doc.metadata || {};
              const category = meta.category || '';
              const statusClass = STATUS_BADGES[doc.status] || 'badge-grey';
              return `
                <tr data-doc-id="${doc.id}" style="cursor:pointer;">
                  <td>
                    <div style="font-weight:600;color:var(--color-text-primary);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${doc.title}">
                      ${doc.title}
                    </div>
                  </td>
                  <td>
                    <span class="badge ${doc.file_type === 'pdf' ? 'badge-red' : doc.file_type === 'docx' ? 'badge-blue' : 'badge-grey'}" style="font-size:10px;">
                      ${doc.file_type.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    ${category
                      ? `<span class="badge badge-blue" style="font-size:10px;">${category}</span>`
                      : '<span style="color:var(--color-text-muted);font-size:12px;">—</span>'}
                  </td>
                  <td style="font-size:13px;">${doc.uploaded_by_name}</td>
                  <td style="font-size:13px;color:var(--color-text-muted);">${doc.file_size_display}</td>
                  <td><span class="badge ${statusClass}" style="font-size:10px;">${doc.status}</span></td>
                  <td style="font-size:13px;color:var(--color-text-muted);white-space:nowrap;">
                    ${new Date(doc.created_at).toLocaleDateString()}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderEmptyState() {
    const isSearching  = !!currentFilters.search;
    const isFiltering  = !!currentFilters.category || !!currentFilters.file_type;
    let title    = 'No documents yet';
    let subtitle = 'Upload the first document to get started.';
    if (isSearching) {
      title    = `No results for "${currentFilters.search}"`;
      subtitle = 'Try different keywords or clear your search.';
    } else if (isFiltering) {
      title    = 'No documents match these filters';
      subtitle = 'Try removing some filters to see more results.';
    }
    return `
      <div class="empty-state">
        <div style="font-size:48px;margin-bottom:16px;">📂</div>
        <div class="empty-state-title">${title}</div>
        <div class="empty-state-text">${subtitle}</div>
        <button class="btn btn-primary" id="empty-state-upload-btn">
          + Upload Document
        </button>
      </div>
    `;
  }

  function renderLoadError() {
    return `
      <div class="empty-state">
        <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
        <div class="empty-state-title">Failed to load documents</div>
        <div class="empty-state-text">Check your connection and try again.</div>
        <button class="btn btn-ghost" id="retry-load-docs-btn">Retry</button>
      </div>
    `;
  }

  // ── Pagination ────────────────────────────────────────────

  function renderPagination(data) {
    const container = document.getElementById('knowledge-pagination');
    if (!container) return;

    if (!data.next && !data.previous) {
      container.innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(data.count / 20);

    container.innerHTML = `
      <div class="pagination">
        <span style="font-size:13px;color:var(--color-text-muted);">
          Page ${currentPage} of ${totalPages} · ${data.count} documents
        </span>
        <div class="pagination-controls">
          <button
            class="pagination-btn"
            id="knowledge-prev-page"
            ${!data.previous ? 'disabled' : ''}
          >← Previous</button>
          <span style="font-size:13px;padding:0 8px;">${currentPage}</span>
          <button
            class="pagination-btn"
            id="knowledge-next-page"
            ${!data.next ? 'disabled' : ''}
          >Next →</button>
        </div>
      </div>
    `;

    const prevBtn = document.getElementById('knowledge-prev-page');
    const nextBtn = document.getElementById('knowledge-next-page');
    if (prevBtn) prevBtn.addEventListener('click', () => loadDocuments(currentPage - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => loadDocuments(currentPage + 1));
  }

  // ── Search Bar ────────────────────────────────────────────

  function initSearchBar() {
    const input    = document.getElementById('knowledge-search');
    const clearBtn = document.getElementById('knowledge-search-clear');
    const clearLink = document.getElementById('knowledge-search-clear-link');

    if (!input) return;

    input.addEventListener('input', () => {
      clearDebounce();
      const query = input.value.trim();

      // Show/hide clear button
      if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';

      searchDebounce = setTimeout(() => {
        handleSearch(query);
      }, 400);
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => clearSearch(input, clearBtn));
    }
  }

  function handleSearch(query) {
    const searchHeader    = document.getElementById('knowledge-search-header');
    const categorySection = document.getElementById('knowledge-category-section');
    const queryEl         = document.getElementById('knowledge-search-query');

    if (query) {
      currentFilters.search = query;
      if (searchHeader)    searchHeader.style.display    = 'flex';
      if (categorySection) categorySection.style.display = 'none';
      if (queryEl) queryEl.textContent = query;
      loadSemanticSearch(query);
    } else {
      delete currentFilters.search;
      if (searchHeader)    searchHeader.style.display    = 'none';
      if (categorySection) categorySection.style.display = 'block';
      loadDocuments(1);
    }
  }

  async function loadSemanticSearch(query) {
    const listEl = document.getElementById('knowledge-doc-list');
    if (!listEl) return;

    listEl.innerHTML = `
      <div style="display:flex;justify-content:center;padding:48px;">
        <span class="spinner" style="width:32px;height:32px;border-width:3px;"></span>
      </div>
    `;

    try {
      const params   = new URLSearchParams({ q: query });
      const response = await api.get(`/knowledge/search/?${params.toString()}`);

      if (!response || !response.ok) {
        // Fallback to title search if semantic search fails
        loadDocuments(1);
        return;
      }

      const data    = await response.json();
      const results = data.results || [];

      const countEl = document.getElementById('knowledge-search-count');
      const docCountEl = document.getElementById('knowledge-doc-count');
      if (countEl)    countEl.textContent    = results.length;
      if (docCountEl) docCountEl.textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`;

      if (results.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state">
            <div style="font-size:48px;margin-bottom:16px;">🔍</div>
            <div class="empty-state-title">No results for "${query}"</div>
            <div class="empty-state-text">Try different keywords or browse documents below.</div>
          </div>
        `;
        return;
      }

      // Render semantic results — show score and excerpt
      if (currentViewMode === 'grid') {
        listEl.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;">
            ${results.map(r => renderSemanticResultCard(r)).join('')}
          </div>
        `;
      } else {
        listEl.innerHTML = `
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Relevance</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${results.map(r => renderSemanticResultRow(r)).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      listEl.querySelectorAll('[data-doc-id]').forEach(el => {
        el.addEventListener('click', () => openDocumentDetail(el.dataset.docId));
      });

    } catch {
      // Fallback to title search on error
      loadDocuments(1);
    }
  }

  function renderSemanticResultCard(result) {
    const doc      = result.document;
    const meta     = doc.metadata || {};
    const category = meta.category || '';
    const score    = Math.round((result.score || 0) * 100);
    const excerpt  = result.excerpt || '';

    const CATEGORY_COLORS = {
      'Engineering': 'var(--color-blue-mid)',
      'Finance':     'var(--color-success)',
      'Legal':       'var(--color-warning)',
      'HR':          'var(--color-orange)',
      'Marketing':   '#7C3AED',
      'Operations':  'var(--color-text-muted)',
    };
    const borderColor = CATEGORY_COLORS[category] || 'var(--color-border)';

    return `
      <div
        data-doc-id="${doc.id}"
        style="
          background:var(--color-surface);
          border:1px solid var(--color-border);
          border-left:4px solid ${borderColor};
          border-radius:8px;
          padding:16px;
          cursor:pointer;
          transition:transform 0.15s ease,box-shadow 0.15s ease;
        "
        onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)';"
        onmouseleave="this.style.transform='';this.style.boxShadow='';"
      >
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <div style="font-size:14px;font-weight:600;color:var(--color-text-primary);flex:1;margin-right:8px;">
            ${doc.title}
          </div>
          <span style="font-size:11px;font-weight:700;color:var(--color-orange);white-space:nowrap;background:var(--color-orange-light);padding:2px 6px;border-radius:4px;">
            ${score}% match
          </span>
        </div>
        ${excerpt
          ? `<div style="font-size:12px;color:var(--color-text-muted);line-height:1.5;margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">
               ${excerpt}
             </div>`
          : ''}
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${category ? `<span class="badge badge-blue" style="font-size:10px;">${category}</span>` : ''}
          <span class="badge badge-grey" style="font-size:10px;">${doc.file_type.toUpperCase()}</span>
        </div>
      </div>
    `;
  }

  function renderSemanticResultRow(result) {
    const doc      = result.document;
    const meta     = doc.metadata || {};
    const category = meta.category || '';
    const score    = Math.round((result.score || 0) * 100);
    return `
      <tr data-doc-id="${doc.id}" style="cursor:pointer;">
        <td>
          <div style="font-weight:600;color:var(--color-text-primary);">${doc.title}</div>
          ${result.excerpt
            ? `<div style="font-size:12px;color:var(--color-text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:300px;">${result.excerpt}</div>`
            : ''}
        </td>
        <td>
          <span style="font-size:13px;font-weight:700;color:var(--color-orange);">${score}%</span>
        </td>
        <td>${category ? `<span class="badge badge-blue" style="font-size:10px;">${category}</span>` : '—'}</td>
        <td><span class="badge badge-grey" style="font-size:10px;">${doc.file_type.toUpperCase()}</span></td>
        <td style="font-size:13px;color:var(--color-text-muted);">${new Date(doc.created_at).toLocaleDateString()}</td>
      </tr>
    `;
  }

  function clearSearch(input, clearBtn) {
    input.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    handleSearch('');
  }

  function clearDebounce() {
    if (searchDebounce) {
      clearTimeout(searchDebounce);
      searchDebounce = null;
    }
  }

  // ── Category Filter ───────────────────────────────────────

  function handleCategoryFilter(category) {
    if (currentFilters.category === category) {
      // Clicking active category deselects it
      delete currentFilters.category;
    } else {
      currentFilters.category = category;
    }
    // Re-render category grid to update active states
    if (allStats) renderCategoryGrid(allStats);
    loadDocuments(1);
  }

  // ── Filter Bar ────────────────────────────────────────────

  function initFilterBar() {
    const typeSelect = document.getElementById('knowledge-filter-type');
    const sortSelect = document.getElementById('knowledge-filter-sort');

    if (typeSelect) {
      typeSelect.addEventListener('change', () => {
        if (typeSelect.value) {
          currentFilters.file_type = typeSelect.value;
        } else {
          delete currentFilters.file_type;
        }
        loadDocuments(1);
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        currentFilters.sort = sortSelect.value;
        loadDocuments(1);
      });
    }

    // Empty state and general retry click handler (event delegation)
    const listContainer = document.getElementById('knowledge-doc-list');
    if (listContainer) {
      listContainer.addEventListener('click', (e) => {
        if (e.target.id === 'empty-state-upload-btn') {
          document.getElementById('modal-knowledge-upload')?.classList.remove('hidden');
        }
        if (e.target.id === 'retry-load-docs-btn') {
          loadDocuments(1);
        }
      });
    }
  }

  // ── View Mode Toggle ──────────────────────────────────────

  function initViewToggle() {
    const gridBtn = document.getElementById('knowledge-view-grid');
    const listBtn = document.getElementById('knowledge-view-list');

    if (!gridBtn || !listBtn) return;

    gridBtn.addEventListener('click', () => {
      currentViewMode = 'grid';
      gridBtn.style.background = 'var(--color-blue-mid)';
      gridBtn.style.color      = 'white';
      listBtn.style.background = 'var(--color-surface)';
      listBtn.style.color      = 'var(--color-text-muted)';
      // Re-render current data in grid mode without re-fetching
      loadDocuments(currentPage);
    });

    listBtn.addEventListener('click', () => {
      currentViewMode = 'list';
      listBtn.style.background = 'var(--color-blue-mid)';
      listBtn.style.color      = 'white';
      gridBtn.style.background = 'var(--color-surface)';
      gridBtn.style.color      = 'var(--color-text-muted)';
      loadDocuments(currentPage);
    });
  }

  // ── Document Detail View ──────────────────────────────────

  async function openDocumentDetail(documentId) {
    previousScrollY = window.scrollY;

    const browseView = document.getElementById('knowledge-browse-view');
    const detailView = document.getElementById('knowledge-detail-view');

    if (browseView) browseView.style.display = 'none';
    if (detailView) {
      detailView.style.display = 'block';
      detailView.innerHTML = `
        <div style="display:flex;justify-content:center;padding:80px;">
          <span class="spinner" style="width:32px;height:32px;border-width:3px;"></span>
        </div>
      `;
    }

    window.scrollTo(0, 0);

    try {
      const response = await api.get(`/knowledge/documents/${documentId}/`);
      if (!response || !response.ok) {
        if (detailView) detailView.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-title">Document not found</div>
            <button class="btn btn-ghost" id="knowledge-detail-back-err">← Back</button>
          </div>
        `;
        document.getElementById('knowledge-detail-back-err')
          ?.addEventListener('click', closeDocumentDetail);
        return;
      }

      const doc = await response.json();

      // Re-inject the detail view HTML (was cleared for loading state)
      if (detailView) {
        // Fetch the template fragment again to get the detail view HTML
        const panelResponse = await fetch('/panels/knowledge/');
        const html          = await panelResponse.text();
        const temp          = document.createElement('div');
        temp.innerHTML      = html;
        const detailFragment = temp.querySelector('#knowledge-detail-view');
        if (detailFragment) {
          detailView.innerHTML = detailFragment.innerHTML;
        }
      }

      renderDocumentDetail(doc);
      initDetailBackButton();

    } catch {
      if (detailView) detailView.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">Failed to load document</div>
          <button class="btn btn-ghost" id="knowledge-detail-back-err">← Back</button>
        </div>
      `;
      document.getElementById('knowledge-detail-back-err')
        ?.addEventListener('click', closeDocumentDetail);
    }
  }

  function renderDocumentDetail(doc) {
    const meta     = doc.metadata || {};
    const category = meta.category || '';
    const keywords = meta.keywords || [];
    const entities = meta.entities || {};
    const statusClass = STATUS_BADGES[doc.status] || 'badge-grey';

    // Header card
    const headerEl = document.getElementById('knowledge-detail-header');
    if (headerEl) {
      headerEl.innerHTML = `
        <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:16px;">
          <div style="flex:1;">
            <h1 style="font-size:22px;font-weight:700;color:var(--color-text-primary);margin-bottom:12px;line-height:1.3;">
              ${doc.title}
            </h1>
            <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
              <span class="badge ${doc.file_type === 'pdf' ? 'badge-red' : doc.file_type === 'docx' ? 'badge-blue' : 'badge-grey'}">
                ${doc.file_type.toUpperCase()}
              </span>
              ${category
                ? `<span class="badge badge-blue">${category}</span>`
                : ''}
              <span class="badge ${statusClass}">${doc.status}</span>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:12px;">
            <button
              onclick="downloadFile('/api/knowledge/documents/${doc.id}/download/', '${doc.title.replace(/'/g, "\\'")}.${doc.file_type}')"
              class="btn btn-primary"
            >
              ⬇ Download
            </button>
            <div style="text-align:right;">
              <div style="font-size:12px;color:var(--color-text-muted);">
                Uploaded by ${doc.uploaded_by_name}
              </div>
              <div style="font-size:12px;color:var(--color-text-muted);">
                ${new Date(doc.created_at).toLocaleDateString('en-US', {
                  year:'numeric', month:'long', day:'numeric'
                })}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // Keywords
    const keywordsEl = document.getElementById('knowledge-detail-keywords');
    if (keywordsEl) {
      if (keywords.length > 0) {
        keywordsEl.innerHTML = `
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${keywords.map(k => `
              <span class="badge badge-grey" style="font-size:12px;font-weight:500;">${k}</span>
            `).join('')}
          </div>
        `;
      } else {
        keywordsEl.innerHTML = `
          <span style="font-size:13px;color:var(--color-text-muted);">
            No keywords yet — added automatically when document is processed.
          </span>
        `;
      }
    }

    // Entities
    const entitiesEl = document.getElementById('knowledge-detail-entities');
    if (entitiesEl) {
      const entityTypes = Object.keys(entities);
      if (entityTypes.length > 0) {
        let html = '<div style="display:flex;flex-direction:column;gap:8px;">';
        entityTypes.forEach(type => {
          const vals = entities[type];
          if (vals && vals.length > 0) {
            html += `
              <div style="display:flex;align-items:center;gap:8px;">
                <span class="badge badge-blue" style="font-size:11px;font-weight:600;min-width:80px;text-align:center;">${type}</span>
                <span style="font-size:13px;color:var(--color-text-primary);">${vals.join(', ')}</span>
              </div>
            `;
          }
        });
        html += '</div>';
        entitiesEl.innerHTML = html;
      } else {
        entitiesEl.innerHTML = `
          <span style="font-size:13px;color:var(--color-text-muted);">
            Entity extraction runs automatically when the document is processed.
            <br><br>
            <span class="badge badge-grey">Status: ${doc.status} — pending processing</span>
          </span>
        `;
      }
    }

    // Info card
    const infoEl = document.getElementById('knowledge-detail-info');
    if (infoEl) {
      infoEl.innerHTML = `
        <div>
          <div style="font-size:11px;color:var(--color-text-muted);margin-bottom:2px;">File Path</div>
          <div style="font-size:13px;font-family:monospace;color:var(--color-text-primary);word-break:break-all;">${doc.file_path}</div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--color-text-muted);margin-bottom:2px;">File Size</div>
          <div style="font-size:13px;color:var(--color-text-primary);">${doc.file_size_display}</div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--color-text-muted);margin-bottom:2px;">Uploaded By</div>
          <div style="font-size:13px;color:var(--color-text-primary);">${doc.uploaded_by_name}</div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--color-text-muted);margin-bottom:2px;">Upload Date</div>
          <div style="font-size:13px;color:var(--color-text-primary);">${new Date(doc.created_at).toLocaleString()}</div>
        </div>
      `;
    }

    // Load recommendations asynchronously
    loadDocumentRecommendations(doc.id);
  }

  async function loadDocumentRecommendations(documentId) {
    const container = document.getElementById('knowledge-related-docs-content');
    if (!container) return;

    try {
      const response = await api.get(
        `/knowledge/documents/${documentId}/recommendations/`
      );
      if (!response || !response.ok) return;

      const data = await response.json();
      const recs = data.recommendations || [];

      if (recs.length === 0) {
        container.innerHTML = `
          <div style="font-size:13px;color:var(--color-text-muted);padding:8px 0;">
            No similar documents found yet. Upload more documents to see recommendations.
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;">
          ${recs.map(r => {
            const doc   = r.document;
            const meta  = doc.metadata || {};
            const score = Math.round((r.score || 0) * 100);
            return `
              <div
                data-doc-id="${doc.id}"
                style="background:var(--color-bg);border:1px solid var(--color-border);border-radius:8px;
                       padding:14px;cursor:pointer;transition:box-shadow 0.15s ease;"
                onmouseenter="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)';"
                onmouseleave="this.style.boxShadow='';"
              >
                <div style="font-size:13px;font-weight:600;color:var(--color-text-primary);margin-bottom:6px;
                            display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
                  ${doc.title}
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;">
                  ${meta.category
                    ? `<span class="badge badge-blue" style="font-size:10px;">${meta.category}</span>`
                    : '<span></span>'}
                  <span style="font-size:11px;color:var(--color-orange);font-weight:700;">${score}% similar</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      container.querySelectorAll('[data-doc-id]').forEach(el => {
        el.addEventListener('click', () => openDocumentDetail(el.dataset.docId));
      });

    } catch { /* silently fail — recommendations are non-critical */ }
  }

  function initKnowledgeChat() {
    const sendBtn = document.getElementById('btn-knowledge-chat-send');
    const inputEl = document.getElementById('knowledge-chat-input');
    const history = document.getElementById('knowledge-chat-history');

    function formatMarkdownToHTML(text) {
      if (!text) return '';
      let escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

      escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      escaped = escaped.replace(/__([^_]+)__/g, '<strong>$1</strong>');
      escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      escaped = escaped.replace(/_([^_]+)_/g, '<em>$1</em>');
      escaped = escaped.replace(/^\s*[-*]\s+(.+)$/gm, '<div style="display:list-item; margin-left:20px; list-style-type:disc; margin-bottom:4px;">$1</div>');
      escaped = escaped.replace(/\n/g, '<br>');
      return escaped;
    }

    const handleSend = async () => {
      const question = inputEl?.value.trim();
      if (!question) return;

      inputEl.value = '';

      // Append user message
      const userMsg = document.createElement('div');
      userMsg.style.alignSelf = 'flex-end';
      userMsg.style.background = 'var(--color-blue-light)';
      userMsg.style.color = 'var(--color-blue-mid)';
      userMsg.style.padding = '8px 12px';
      userMsg.style.borderRadius = '12px 12px 0 12px';
      userMsg.style.maxWidth = '80%';
      userMsg.style.wordBreak = 'break-word';
      userMsg.innerHTML = `<strong>You:</strong> ${formatMarkdownToHTML(question)}`;
      history?.appendChild(userMsg);
      history?.scrollTo(0, history.scrollHeight);

      // Append loading indicator
      const loader = document.createElement('div');
      loader.style.alignSelf = 'flex-start';
      loader.style.background = 'var(--color-bg)';
      loader.style.border = '1px solid var(--color-border)';
      loader.style.padding = '8px 12px';
      loader.style.borderRadius = '12px 12px 12px 0';
      loader.style.maxWidth = '80%';
      loader.id = 'knowledge-chat-loader';
      loader.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;color:var(--color-text-muted);">
          <span class="spinner" style="width:12px;height:12px;border-width:2px;"></span>
          Thinking...
        </div>
      `;
      history?.appendChild(loader);
      history?.scrollTo(0, history.scrollHeight);

      try {
        const response = await api.post('/knowledge/ask/', { question });
        loader.remove();

        const data = await response.json();
        const answer = data.answer || "No response received.";

        const assistantMsg = document.createElement('div');
        assistantMsg.style.alignSelf = 'flex-start';
        assistantMsg.style.background = 'var(--color-bg)';
        assistantMsg.style.border = '1px solid var(--color-border)';
        assistantMsg.style.padding = '8px 12px';
        assistantMsg.style.borderRadius = '12px 12px 12px 0';
        assistantMsg.style.maxWidth = '80%';
        assistantMsg.style.wordBreak = 'break-word';
        assistantMsg.innerHTML = `<strong>Assistant:</strong> ${formatMarkdownToHTML(answer)}`;
        history?.appendChild(assistantMsg);

        // Render sources under the message if present
        const sources = data.sources || [];
        if (sources.length > 0) {
          const sourcesEl = document.createElement('div');
          sourcesEl.style.marginTop = '6px';
          sourcesEl.style.display = 'flex';
          sourcesEl.style.flexWrap = 'wrap';
          sourcesEl.style.gap = '6px';
          sourcesEl.innerHTML = sources.map(s => `
            <div data-doc-id="${s.document_id}"
                 style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;
                        background:var(--color-blue-light);border:1px solid var(--color-border);
                        border-radius:12px;cursor:pointer;font-size:10px;font-weight:500;
                        color:var(--color-blue-mid);transition:background 0.15s ease;"
                 onmouseenter="this.style.background='#D6E4F5';"
                 onmouseleave="this.style.background='var(--color-blue-light)';"
                 title="Relevance: ${Math.round((s.relevance_score || 0) * 100)}%">
              📄 ${s.document_title}
            </div>
          `).join('');
          sourcesEl.querySelectorAll('[data-doc-id]').forEach(el => {
            el.addEventListener('click', () => openDocumentDetail(el.dataset.docId));
          });
          assistantMsg.appendChild(sourcesEl);
        }

        history?.scrollTo(0, history.scrollHeight);
      } catch (err) {
        loader.remove();
        const errEl = document.createElement('div');
        errEl.style.alignSelf = 'flex-start';
        errEl.style.color = 'var(--color-error)';
        errEl.style.fontSize = '12px';
        errEl.textContent = "Error: Failed to fetch response.";
        history?.appendChild(errEl);
        history?.scrollTo(0, history.scrollHeight);
      }
    };

    sendBtn?.addEventListener('click', handleSend);
    inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    });
  }

  function initDetailBackButton() {
    const backBtn = document.getElementById('knowledge-detail-back');
    if (backBtn) {
      backBtn.addEventListener('click', closeDocumentDetail);
    }
  }

  function closeDocumentDetail() {
    const browseView = document.getElementById('knowledge-browse-view');
    const detailView = document.getElementById('knowledge-detail-view');
    if (browseView) browseView.style.display = 'block';
    if (detailView) detailView.style.display = 'none';

    // Restore scroll position
    window.scrollTo(0, previousScrollY);
  }

  // ── My Uploads Section ────────────────────────────────────

  function initMyUploads() {
    const header = document.getElementById('my-uploads-header');
    const content = document.getElementById('my-uploads-content');
    const chevron = document.getElementById('my-uploads-chevron');

    if (!header || !content || !chevron) return;

    header.addEventListener('click', () => {
      const isExpanded = content.style.display === 'block';
      content.style.display = isExpanded ? 'none' : 'block';
      chevron.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';

      if (!isExpanded && !myUploadsLoaded) {
        loadMyUploads();
      }
    });
  }

  async function loadMyUploads() {
    const listEl = document.getElementById('my-uploads-list');
    if (!listEl) return;

    listEl.innerHTML = `
      <div style="display:flex;padding:16px 0;">
        <span class="spinner" style="width:20px;height:20px;border-width:2px;"></span>
      </div>
    `;

    try {
      const response = await api.get(`/knowledge/documents/?uploaded_by=${currentUser.id}`);
      if (!response || !response.ok) {
        listEl.innerHTML = `<div style="color:var(--color-text-muted);font-size:13px;padding:8px 0;">Failed to load uploads.</div>`;
        return;
      }

      const data = await response.json();
      const docs = data.results || [];

      if (docs.length === 0) {
        listEl.innerHTML = `<div style="color:var(--color-text-muted);font-size:13px;padding:8px 0;">You have not uploaded any documents yet.</div>`;
        return;
      }

      listEl.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;padding-top:8px;">
          ${docs.map(doc => {
            const statusClass = STATUS_BADGES[doc.status] || 'badge-grey';
            return `
              <div 
                data-my-doc-id="${doc.id}"
                style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:6px;padding:12px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;"
              >
                <div style="min-width:0;flex:1;margin-right:12px;">
                  <div style="font-size:13px;font-weight:600;color:var(--color-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${doc.title}">
                    ${doc.title}
                  </div>
                  <div style="font-size:11px;color:var(--color-text-muted);margin-top:2px;">
                    ${doc.file_type.toUpperCase()} · ${doc.file_size_display}
                  </div>
                </div>
                <span class="badge ${statusClass}" style="font-size:9px;padding:2px 6px;">${doc.status}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;

      myUploadsLoaded = true;

      // Bind click handlers to "My Uploads" items
      listEl.querySelectorAll('[data-my-doc-id]').forEach(el => {
        el.addEventListener('click', () => {
          openDocumentDetail(el.dataset.myDocId);
        });
      });

    } catch {
      listEl.innerHTML = `<div style="color:var(--color-text-muted);font-size:13px;padding:8px 0;">Failed to load uploads.</div>`;
    }
  }

  // ── Document Upload Modal ─────────────────────────────────

  function initKnowledgeUploadModal() {
    const modal       = document.getElementById('modal-knowledge-upload');
    const openBtn     = document.getElementById('btn-knowledge-upload');
    const closeBtn    = document.getElementById('modal-knowledge-upload-close');
    const cancelBtn   = document.getElementById('modal-knowledge-upload-cancel');
    const submitBtn   = document.getElementById('btn-knowledge-submit-upload');
    const dropZone    = document.getElementById('knowledge-drop-zone');
    const fileInput   = document.getElementById('knowledge-upload-file');
    const previewEl   = document.getElementById('knowledge-files-preview');
    const errorEl     = document.getElementById('knowledge-upload-error');

    if (!modal) return;

    let selectedFiles = [];

    const showModal = () => {
      clearForm();
      modal.classList.remove('hidden');
    };

    const hideModal = () => {
      modal.classList.add('hidden');
      clearForm();
    };

    const clearForm = () => {
      selectedFiles = [];
      const cat = document.getElementById('knowledge-upload-category');
      if (cat) cat.value = '';
      if (fileInput) fileInput.value = '';
      if (previewEl) {
        previewEl.innerHTML = '';
        previewEl.style.display = 'none';
      }
      if (errorEl) {
        errorEl.style.display = 'none';
        errorEl.textContent = '';
      }
    };

    if (openBtn) openBtn.addEventListener('click', showModal);
    if (closeBtn) closeBtn.addEventListener('click', hideModal);
    if (cancelBtn) cancelBtn.addEventListener('click', hideModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(); });

    const handleFilesSelected = (files) => {
      selectedFiles = Array.from(files).filter(file => {
        const ext = file.name.toLowerCase().split('.').pop();
        return ['pdf', 'docx', 'txt'].includes(ext);
      });
      if (selectedFiles.length === 0) return;

      if (previewEl) {
        previewEl.innerHTML = selectedFiles.map(file => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;
                      background:var(--color-blue-light);border-radius:4px;font-size:12px;">
            <span style="color:var(--color-blue-mid);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:320px;">
              📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)
            </span>
          </div>
        `).join('');
        previewEl.style.display = 'flex';
      }
    };

    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--color-blue-mid)';
        dropZone.style.background = 'var(--color-blue-light)';
      });

      ['dragleave', 'dragend'].forEach(evt => {
        dropZone.addEventListener(evt, () => {
          dropZone.style.borderColor = 'var(--color-border)';
          dropZone.style.background = 'var(--color-bg)';
        });
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--color-border)';
        dropZone.style.background = 'var(--color-bg)';
        if (e.dataTransfer?.files) handleFilesSelected(e.dataTransfer.files);
      });

      fileInput.addEventListener('change', () => {
        if (fileInput.files) handleFilesSelected(fileInput.files);
      });
    }

    if (submitBtn) {
      const newSubmitBtn = submitBtn.cloneNode(true);
      submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
      newSubmitBtn.addEventListener('click', async () => {
        if (selectedFiles.length === 0) {
          showError('Please select at least one document to upload.');
          return;
        }

        newSubmitBtn.disabled = true;
        newSubmitBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px;"></span>Uploading...';

        const category = document.getElementById('knowledge-upload-category')?.value || '';
        const formData = new FormData();
        selectedFiles.forEach(file => {
          formData.append('files', file);
        });
        formData.append('category', category);

        try {
          const token = TokenStore.getAccess();
          const headers = {};
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const response = await fetch('/api/knowledge/upload/', {
            method: 'POST',
            headers: headers,
            body: formData
          });

          if (response.ok) {
            const data = await response.json();
            Toast.success(`Successfully uploaded ${data.uploaded_count} documents.`);
            hideModal();
            loadStats();
            loadDocuments(1);
            const myUploadsContent = document.getElementById('my-uploads-content');
            if (myUploadsContent && myUploadsContent.style.display === 'block') {
              loadMyUploads();
            } else {
              myUploadsLoaded = false;
            }
          } else {
            const errData = await response.json();
            showError(errData.error || 'Failed to upload documents.');
          }
        } catch {
          showError('Network error occurred during upload.');
        } finally {
          newSubmitBtn.disabled = false;
          newSubmitBtn.textContent = 'Upload Documents';
        }
      });
    }

    function showError(msg) {
      if (errorEl) {
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
      } else {
        Toast.error(msg);
      }
    }
  }
}

// 3. Projects panel
function initProjectsPanel() {
  const listContainer = document.getElementById('projects-grid');
  const searchInput    = document.getElementById('projects-search');
  const statusFilter   = document.getElementById('projects-filter-status');
  const countLabel     = document.getElementById('projects-count');
  const myTasksToggle  = document.getElementById('btn-my-tasks-toggle');
  
  // Views
  const projectsView   = document.getElementById('projects-list-view');
  const myTasksView    = document.getElementById('my-tasks-view');
  const detailView     = document.getElementById('project-detail-view');
  
  // Modals
  const createProjBtn   = document.getElementById('btn-create-project');
  const createProjModal = document.getElementById('modal-create-project');
  const createProjClose = document.getElementById('modal-create-project-close');
  const createProjCancel = document.getElementById('modal-create-project-cancel');
  const createProjForm  = document.getElementById('btn-create-project-submit');

  const editProjModal   = document.getElementById('modal-edit-project');
  const editProjClose   = document.getElementById('modal-edit-project-close');
  const editProjCancel   = document.getElementById('modal-edit-project-cancel');
  const editProjForm    = document.getElementById('btn-edit-project-submit');
  
  const createTaskModal = document.getElementById('modal-create-task');
  const createTaskClose = document.getElementById('modal-create-task-close');
  const createTaskCancel = document.getElementById('modal-create-task-cancel');
  const createTaskForm  = document.getElementById('btn-create-task-submit');

  // Task Drawer
  const drawerOverlay   = document.getElementById('task-drawer-overlay');
  const drawer          = document.getElementById('task-drawer');
  const drawerClose     = document.getElementById('task-drawer-close');
  const drawerCancel    = document.getElementById('task-drawer-cancel');
  const drawerSave      = document.getElementById('task-drawer-save');

  // State
  let currentFilters = { search: '', status: '' };
  let allUsers = [];
  let currentProject = null;
  let activeTaskId = null;
  let searchDebounce = null;

  const STATUS_BADGES = {
    'planning': 'badge-grey',
    'active':   'badge-blue',
    'on_hold':  'badge-yellow',
    'done':     'badge-green',
  };

  const PRIORITY_BADGES = {
    'low':      'badge-grey',
    'medium':   'badge-blue',
    'high':     'badge-orange',
    'critical': 'badge-red',
  };

  // ── Setup and Boot ────────────────────────────────────────

  const userRole = getCurrentUserRole();
  const canManage = ['admin', 'hr', 'manager'].includes(userRole);

  if (createProjBtn) {
    createProjBtn.classList.toggle('hidden', !canManage);
  }

  if (myTasksToggle) {
    myTasksToggle.style.display = 'inline-block';
  }

  loadUsers();
  loadProjects(1);

  // ── Fetch Users ───────────────────────────────────────────

  async function loadUsers() {
    try {
      const response = await api.get('/auth/users/');
      if (response && response.ok) {
        allUsers = await response.json();
        populateUserDropdowns();
      }
    } catch (e) {
      console.error("Failed to load organization users", e);
    }
  }

  function populateUserDropdowns() {
    const dropdowns = [
      document.getElementById('create-project-owner'),
      document.getElementById('edit-project-owner'),
      document.getElementById('create-task-assignee')
    ];

    dropdowns.forEach(dd => {
      if (!dd) return;
      dd.innerHTML = `<option value="">Select Colleague</option>` + 
        allUsers.map(u => `<option value="${u.id}">${u.first_name} ${u.last_name}</option>`).join('');
    });
  }

  // ── Load Projects ─────────────────────────────────────────

  async function loadProjects(page = 1) {
    if (!listContainer) return;
    listContainer.innerHTML = `
      <div style="display:flex;justify-content:center;padding:48px;grid-column:1/-1;">
        <span class="spinner" style="width:32px;height:32px;border-width:3px;"></span>
      </div>
    `;

    const params = new URLSearchParams({ page: String(page) });
    if (currentFilters.search) params.set('search', currentFilters.search);
    if (currentFilters.status) params.set('status', currentFilters.status);

    try {
      const response = await api.get(`/projects/?${params.toString()}`);
      if (!response || !response.ok) {
        listContainer.innerHTML = `<div style="color:var(--color-error);padding:24px;text-align:center;grid-column:1/-1;">Failed to load projects.</div>`;
        return;
      }
      const data = await response.json();
      const projects = data.results || [];
      const count = data.count || 0;

      if (countLabel) {
        countLabel.textContent = `${count} project${count !== 1 ? 's' : ''}`;
      }

      if (projects.length === 0) {
        listContainer.innerHTML = renderEmptyState();
        renderPagination(data, 'projects');
        return;
      }

      listContainer.innerHTML = projects.map(p => {
        const pct = p.task_count > 0 ? Math.round((p.completed_count / p.task_count) * 100) : 0;
        return `
          <div
            class="card project-card"
            data-proj-id="${p.id}"
            style="cursor:pointer;padding:20px;border:1px solid var(--color-border);transition:transform 0.15s ease,box-shadow 0.15s ease;"
            onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)';"
            onmouseleave="this.style.transform='';this.style.boxShadow='';"
          >
            <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;">
              <span class="badge ${STATUS_BADGES[p.status]}">${p.status.toUpperCase()}</span>
              <span style="font-size:11px;color:var(--color-text-muted);">Created ${new Date(p.created_at).toLocaleDateString()}</span>
            </div>
            <h3 style="font-size:16px;font-weight:700;color:var(--color-navy);margin-bottom:8px;">${p.name}</h3>
            <p style="font-size:13px;color:var(--color-text-secondary);margin-bottom:16px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;height:38px;">
              ${p.description || 'No description provided.'}
            </p>
            <div style="margin-bottom:14px;">
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;font-weight:600;color:var(--color-text-primary);">
                <span>Progress</span>
                <span>${pct}%</span>
              </div>
              <div style="background:var(--color-blue-light);border-radius:4px;height:6px;overflow:hidden;">
                <div style="background:var(--color-blue-mid);height:100%;width:${pct}%;border-radius:4px;"></div>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--color-text-muted);border-top:1px solid var(--color-border);padding-top:10px;">
              <span>👤 ${p.owner_name}</span>
              <span>📋 ${p.completed_count}/${p.task_count} Tasks</span>
            </div>
          </div>
        `;
      }).join('');

      // Bind detail view links
      listContainer.querySelectorAll('.project-card').forEach(card => {
        card.addEventListener('click', () => {
          openProjectDetail(card.dataset.projId);
        });
      });

      renderPagination(data, 'projects');
    } catch (e) {
      listContainer.innerHTML = `<div style="color:var(--color-error);padding:24px;text-align:center;grid-column:1/-1;">Error loading projects.</div>`;
    }
  }

  function renderEmptyState() {
    if (currentFilters.search) {
      return `<div class="empty-state" style="grid-column: 1/-1;"><h3>No results for "${currentFilters.search}"</h3><p>Try different keywords or clear search filter.</p></div>`;
    }
    if (currentFilters.status) {
      return `<div class="empty-state" style="grid-column: 1/-1;"><h3>No projects match status filter</h3><p>Try resetting the status filter.</p></div>`;
    }
    return `<div class="empty-state" style="grid-column: 1/-1;"><h3>No projects tracked</h3><p>Create a new project workspace to get started.</p></div>`;
  }

  // ── Pagination Helper ────────────────────────────────────

  function renderPagination(data, type) {
    const id = type === 'projects' ? 'projects-pagination' : 'my-tasks-pagination';
    const container = document.getElementById(id);
    if (!container) return;

    if (!data.next && !data.previous) {
      container.innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(data.count / 20);
    const currentPage = type === 'projects' ? 1 : 1; // simple page track

    container.innerHTML = `
      <div class="pagination">
        <span style="font-size:13px;color:var(--color-text-muted);">
          Total ${data.count} items
        </span>
        <div class="pagination-controls">
          <button class="pagination-btn" id="${type}-prev" ${!data.previous ? 'disabled' : ''}>← Previous</button>
          <button class="pagination-btn" id="${type}-next" ${!data.next ? 'disabled' : ''}>Next →</button>
        </div>
      </div>
    `;

    // Pagination actions
    const prevBtn = document.getElementById(`${type}-prev`);
    const nextBtn = document.getElementById(`${type}-next`);

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        const url = new URL(data.previous);
        const page = url.searchParams.get('page') || 1;
        if (type === 'projects') loadProjects(page);
        else loadMyTasks(page);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const url = new URL(data.next);
        const page = url.searchParams.get('page') || 1;
        if (type === 'projects') loadProjects(page);
        else loadMyTasks(page);
      });
    }
  }

  // ── Search & Filter Listeners ─────────────────────────────

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      if (searchDebounce) clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        currentFilters.search = searchInput.value.trim();
        loadProjects(1);
      }, 400);
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      currentFilters.status = statusFilter.value;
      loadProjects(1);
    });
  }

  // ── Toggle My Tasks ───────────────────────────────────────

  if (myTasksToggle) {
    myTasksToggle.addEventListener('click', () => {
      if (projectsView.style.display !== 'none') {
        // Switch to My Tasks
        projectsView.style.display = 'none';
        detailView.style.display = 'none';
        myTasksView.style.display = 'block';
        myTasksToggle.textContent = 'All Projects';
        loadMyTasks(1);
      } else {
        // Switch to Projects
        myTasksView.style.display = 'none';
        detailView.style.display = 'none';
        projectsView.style.display = 'block';
        myTasksToggle.textContent = 'My Tasks';
        loadProjects(1);
      }
    });
  }

  const backToProjBtn = document.getElementById('btn-back-to-projects');
  if (backToProjBtn) {
    backToProjBtn.addEventListener('click', () => {
      myTasksView.style.display = 'none';
      detailView.style.display = 'none';
      projectsView.style.display = 'block';
      if (myTasksToggle) myTasksToggle.textContent = 'My Tasks';
      loadProjects(1);
    });
  }

  async function loadMyTasks(page = 1) {
    const listBody = document.getElementById('my-tasks-list');
    if (!listBody) return;

    listBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;padding:32px;">
          <span class="spinner" style="width:24px;height:24px;border-width:2px;"></span>
        </td>
      </tr>
    `;

    const statusVal = document.getElementById('mytasks-filter-status').value;
    const params = new URLSearchParams({ page: String(page) });
    if (statusVal) params.set('status', statusVal);

    try {
      const response = await api.get(`/projects/tasks/mine/?${params.toString()}`);
      if (!response || !response.ok) {
        listBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--color-error);">Failed to load tasks.</td></tr>`;
        return;
      }
      const data = await response.json();
      const tasks = data.results || [];

      if (tasks.length === 0) {
        listBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:24px;">No tasks assigned to you.</td></tr>`;
        renderPagination(data, 'mytasks');
        return;
      }

      listBody.innerHTML = tasks.map(t => {
        const overdueStyle = t.is_overdue ? 'color:var(--color-error);font-weight:600;' : '';
        return `
          <tr data-task-row-id="${t.id}" style="cursor:pointer;">
            <td style="font-weight:600;color:var(--color-text-primary);">${t.title}</td>
            <td>${t.project_name}</td>
            <td><span class="badge ${STATUS_BADGES[t.status]}">${t.status.toUpperCase()}</span></td>
            <td><span class="badge ${PRIORITY_BADGES[t.priority]}">${t.priority.toUpperCase()}</span></td>
            <td style="${overdueStyle}">${t.due_date || 'No Date'}</td>
          </tr>
        `;
      }).join('');

      listBody.querySelectorAll('[data-task-row-id]').forEach(row => {
        row.addEventListener('click', () => {
          openTaskDrawer(row.dataset.taskRowId);
        });
      });

      renderPagination(data, 'mytasks');
    } catch {
      listBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--color-error);">Error loading tasks.</td></tr>`;
    }
  }

  const myTaskStatusFilter = document.getElementById('mytasks-filter-status');
  if (myTaskStatusFilter) {
    myTaskStatusFilter.addEventListener('change', () => loadMyTasks(1));
  }

  // ── Project Detail View ───────────────────────────────────

  async function openProjectDetail(projectId) {
    projectsView.style.display = 'none';
    myTasksView.style.display = 'none';
    detailView.style.display = 'block';

    const headerEl = document.getElementById('project-detail-header');
    if (headerEl) {
      headerEl.innerHTML = `
        <div style="display:flex;justify-content:center;padding:48px;">
          <span class="spinner" style="width:32px;height:32px;border-width:3px;"></span>
        </div>
      `;
    }

    try {
      const response = await api.get(`/projects/${projectId}/`);
      if (!response || !response.ok) {
        Toast.error("Failed to load project details.");
        return;
      }
      currentProject = await response.json();
      renderProjectHeader(currentProject);
      renderProjectStats(currentProject);
      renderKanbanBoard(currentProject.tasks || []);
    } catch {
      Toast.error("Error fetching project metadata.");
    }
  }

  function renderProjectHeader(proj) {
    const headerEl = document.getElementById('project-detail-header');
    if (!headerEl) return;

    const userRole = getCurrentUserRole();
    const canManage = ['admin', 'hr', 'manager'].includes(userRole);

    const createTaskBtn = document.getElementById('btn-create-task');
    if (createTaskBtn) {
      createTaskBtn.classList.toggle('hidden', !canManage);
    }

    headerEl.innerHTML = `
      <div class="card-body" style="padding:20px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:16px;">
          <div style="flex:1;min-width:280px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <span class="badge ${STATUS_BADGES[proj.status]}">${proj.status.toUpperCase()}</span>
              <span style="font-size:12px;color:var(--color-text-muted);">Created on ${new Date(proj.created_at).toLocaleDateString()}</span>
            </div>
            <h2 style="font-size:20px;font-weight:700;color:var(--color-navy);margin-bottom:8px;">${proj.name}</h2>
            <p style="font-size:14px;color:var(--color-text-secondary);margin-bottom:12px;line-height:1.4;">${proj.description || 'No description provided.'}</p>
            <div style="display:flex;gap:16px;font-size:13px;color:var(--color-text-muted);flex-wrap:wrap;">
              <div><strong>Owner:</strong> ${proj.owner_name}</div>
              <div><strong>Start Date:</strong> ${proj.start_date || 'None'}</div>
              <div><strong>End Date:</strong> ${proj.end_date || 'None'}</div>
            </div>
          </div>
          ${canManage ? `
            <div style="display:flex;gap:8px;">
              <button class="btn btn-secondary btn-sm" id="btn-edit-project">Edit Project</button>
              <button class="btn btn-danger btn-sm" id="btn-delete-project">Delete</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // Bind Edit/Delete
    const editBtn = document.getElementById('btn-edit-project');
    const deleteBtn = document.getElementById('btn-delete-project');

    if (editBtn) {
      editBtn.addEventListener('click', () => {
        document.getElementById('edit-project-id').value = proj.id;
        document.getElementById('edit-project-name').value = proj.name;
        document.getElementById('edit-project-desc').value = proj.description;
        document.getElementById('edit-project-status').value = proj.status;
        document.getElementById('edit-project-owner').value = proj.owner || '';
        document.getElementById('edit-project-start-date').value = proj.start_date || '';
        document.getElementById('edit-project-end-date').value = proj.end_date || '';
        document.getElementById('edit-project-error').style.display = 'none';
        editProjModal.classList.remove('hidden');
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (confirm("Are you sure you want to delete this project? This will soft-delete the project.")) {
          try {
            const res = await api.delete(`/projects/${proj.id}/`);
            if (res && res.ok) {
              Toast.success("Project deleted successfully.");
              detailView.style.display = 'none';
              projectsView.style.display = 'block';
              loadProjects(1);
            } else {
              Toast.error("Failed to delete project.");
            }
          } catch {
            Toast.error("Error occurred while deleting project.");
          }
        }
      });
    }
  }

  function renderProjectStats(proj) {
    const statsEl = document.getElementById('project-stats-strip');
    if (!statsEl) return;

    statsEl.innerHTML = `
      <div class="stat-card" style="padding:16px;background:var(--color-surface);border:1px solid var(--color-border);text-align:center;border-radius:8px;">
        <div class="stat-value" style="font-size:24px;font-weight:700;color:var(--color-navy);">${proj.task_count}</div>
        <div class="stat-label" style="font-size:12px;color:var(--color-text-muted);">Total Tasks</div>
      </div>
      <div class="stat-card" style="padding:16px;background:var(--color-surface);border:1px solid var(--color-border);text-align:center;border-radius:8px;">
        <div class="stat-value" style="font-size:24px;font-weight:700;color:var(--color-success);">${proj.completed_count}</div>
        <div class="stat-label" style="font-size:12px;color:var(--color-text-muted);">Completed</div>
      </div>
      <div class="stat-card" style="padding:16px;background:var(--color-surface);border:1px solid var(--color-border);text-align:center;border-radius:8px;">
        <div class="stat-value" style="font-size:24px;font-weight:700;color:var(--color-error);">${proj.overdue_count}</div>
        <div class="stat-label" style="font-size:12px;color:var(--color-text-muted);">Overdue</div>
      </div>
    `;
  }

  function renderKanbanBoard(tasks) {
    const boardEl = document.getElementById('kanban-board');
    if (!boardEl) return;

    const columns = [
      { id: 'todo',        label: 'To Do',       bg: 'var(--color-bg)' },
      { id: 'in_progress', label: 'In Progress', bg: 'var(--color-blue-light)' },
      { id: 'blocked',     label: 'Blocked',     bg: 'var(--color-orange-light)' },
      { id: 'done',        label: 'Done',        bg: '#EAF7ED' },
    ];

    boardEl.innerHTML = columns.map(col => {
      const colTasks = tasks.filter(t => t.status === col.id);
      return `
        <div style="background:${col.bg};border:1px solid var(--color-border);border-radius:8px;padding:12px;min-height:400px;display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;border-bottom:1px solid var(--color-border);padding-bottom:8px;">
            <span style="font-weight:600;color:var(--color-navy);font-size:13px;">${col.label}</span>
            <span class="badge badge-grey" style="font-size:11px;">${colTasks.length}</span>
          </div>
          <div class="kanban-column-tasks" data-column-id="${col.id}" style="display:flex;flex-direction:column;gap:8px;flex:1;min-height:360px;">
            ${colTasks.map(task => `
              <div
                data-task-id="${task.id}"
                class="card"
                style="
                  padding:12px;
                  cursor:pointer;
                  border:1px solid var(--color-border);
                  background:var(--color-surface);
                  transition:transform 0.15s ease,box-shadow 0.15s ease;
                "
                onmouseenter="this.style.transform='translateY(-1px)';this.style.boxShadow='0 2px 8px rgba(0,0,0,0.05)';"
                onmouseleave="this.style.transform='';this.style.boxShadow='';"
              >
                <div style="font-size:13px;font-weight:600;color:var(--color-text-primary);margin-bottom:8px;line-height:1.3;">
                  ${task.title}
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px;">
                  <span class="badge ${PRIORITY_BADGES[task.priority]}" style="font-size:10px;">${task.priority.toUpperCase()}</span>
                  <span style="font-size:11px;color:var(--color-text-muted);${task.is_overdue && task.status !== 'done' ? 'color:var(--color-error);font-weight:600;' : ''}">
                    ${task.due_date ? `📅 ${task.due_date}` : 'No date'}
                  </span>
                </div>
                <div style="font-size:11px;color:var(--color-text-muted);margin-top:6px;border-top:1px solid var(--color-border);padding-top:4px;display:flex;align-items:center;justify-content:space-between;">
                  <span>👤 ${task.assignee_name}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    // Bind click handlers to cards
    boardEl.querySelectorAll('[data-task-id]').forEach(card => {
      card.addEventListener('click', () => {
        openTaskDrawer(card.dataset.taskId);
      });
    });
  }

  const backFromDetailBtn = document.getElementById('btn-back-from-detail');
  if (backFromDetailBtn) {
    backFromDetailBtn.addEventListener('click', () => {
      detailView.style.display = 'none';
      myTasksView.style.display = 'none';
      projectsView.style.display = 'block';
      loadProjects(1);
    });
  }

  // ── Task Drawer Interaction ───────────────────────────────

  async function openTaskDrawer(taskId) {
    activeTaskId = taskId;
    if (drawerOverlay && drawer) {
      drawerOverlay.classList.remove('hidden');
      drawer.classList.remove('hidden');
      drawer.classList.add('open');
      const bodyEl = document.getElementById('task-drawer-body');
      if (bodyEl) {
        bodyEl.innerHTML = `
          <div style="display:flex;justify-content:center;padding:48px;">
            <span class="spinner" style="width:24px;height:24px;border-width:2px;"></span>
          </div>
        `;
      }
    }

    try {
      const response = await api.get(`/projects/tasks/${taskId}/`);
      if (!response || !response.ok) {
        Toast.error("Failed to load task details.");
        closeTaskDrawer();
        return;
      }
      const task = await response.json();
      renderTaskDrawerBody(task);
    } catch {
      Toast.error("Error loading task data.");
      closeTaskDrawer();
    }
  }

  function renderTaskDrawerBody(task) {
    const bodyEl = document.getElementById('task-drawer-body');
    if (!bodyEl) return;

    const userRole = getCurrentUserRole();
    const isEmployee = userRole === 'employee';
    const canDelete = userRole !== 'employee';

    bodyEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div class="form-group">
          <label class="form-label">Task Title</label>
          <input type="text" id="drawer-task-title" class="form-input" value="${task.title}" ${isEmployee ? 'disabled' : ''}>
        </div>

        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea id="drawer-task-desc" class="form-input" rows="3" ${isEmployee ? 'disabled' : ''}>${task.description || ''}</textarea>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-group">
            <label class="form-label">Status</label>
            <select id="drawer-task-status" class="form-select">
              <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
              <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
              <option value="blocked" ${task.status === 'blocked' ? 'selected' : ''}>Blocked</option>
              <option value="done" ${task.status === 'done' ? 'selected' : ''}>Done</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Priority</label>
            <select id="drawer-task-priority" class="form-select" ${isEmployee ? 'disabled' : ''}>
              <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
              <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
              <option value="critical" ${task.priority === 'critical' ? 'selected' : ''}>Critical</option>
            </select>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-group">
            <label class="form-label">Assignee</label>
            <select id="drawer-task-assignee" class="form-select" ${isEmployee ? 'disabled' : ''}>
              <option value="">Unassigned</option>
              ${allUsers.map(u => `<option value="${u.id}" ${task.assignee === u.id ? 'selected' : ''}>${u.first_name} ${u.last_name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Due Date</label>
            <input type="date" id="drawer-task-due" class="form-input" value="${task.due_date || ''}" ${isEmployee ? 'disabled' : ''}>
          </div>
        </div>

        ${canDelete ? `
          <div style="border-top:1px solid var(--color-border);padding-top:12px;">
            <button class="btn btn-danger btn-sm" id="btn-drawer-delete-task" style="width:100%;">Delete Task</button>
          </div>
        ` : ''}

        <!-- Comment Section -->
        <div style="border-top:1px solid var(--color-border);padding-top:16px;">
          <div style="font-weight:600;font-size:14px;color:var(--color-navy);margin-bottom:12px;">Comments</div>
          ${!isEmployee ? `
          <div style="display:flex;gap:8px;margin-bottom:12px;">
            <input type="text" id="drawer-new-comment" class="form-input" placeholder="Type a comment..." style="margin-bottom:0;flex:1;">
            <button class="btn btn-primary btn-sm" id="btn-drawer-submit-comment">Send</button>
          </div>
          ` : ''}
          <div id="drawer-comments-list" style="display:flex;flex-direction:column;gap:8px;">
            ${task.comments && task.comments.length > 0 ? task.comments.map(c => `
              <div style="background:var(--color-bg);padding:8px 12px;border-radius:6px;border:1px solid var(--color-border);">
                <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--color-text-muted);margin-bottom:4px;">
                  <strong>${c.author_name}</strong>
                  <span>${new Date(c.created_at).toLocaleString()}</span>
                </div>
                <div style="font-size:13px;color:var(--color-text-primary);word-break:break-all;">${c.content}</div>
              </div>
            `).join('') : '<div style="font-size:12px;color:var(--color-text-muted);text-align:center;padding:12px;">No comments yet.</div>'}
          </div>
        </div>
      </div>
    `;

    // Bind inline drawer delete
    const deleteBtn = document.getElementById('btn-drawer-delete-task');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (confirm("Are you sure you want to delete this task?")) {
          try {
            const res = await api.delete(`/projects/tasks/${task.id}/`);
            if (res && res.ok) {
              Toast.success("Task deleted successfully.");
              closeTaskDrawer();
              if (currentProject) openProjectDetail(currentProject.id);
              if (myTasksView.style.display === 'block') loadMyTasks(1);
            } else {
              Toast.error("Failed to delete task.");
            }
          } catch {
            Toast.error("Error occurred while deleting task.");
          }
        }
      });
    }

    // Bind comment post
    const commentSubmit = document.getElementById('btn-drawer-submit-comment');
    const commentInput = document.getElementById('drawer-new-comment');
    if (commentSubmit && commentInput) {
      commentSubmit.addEventListener('click', async () => {
        const val = commentInput.value.trim();
        if (!val) return;

        commentSubmit.disabled = true;
        try {
          const res = await api.post(`/projects/tasks/${task.id}/comments/`, { content: val });
          if (res && res.ok) {
            const comm = await res.json();
            commentInput.value = '';
            // Prepend comment inside UI list
            const list = document.getElementById('drawer-comments-list');
            if (list) {
              if (list.innerHTML.includes("No comments yet")) {
                list.innerHTML = '';
              }
              const div = document.createElement('div');
              div.style.cssText = "background:var(--color-bg);padding:8px 12px;border-radius:6px;border:1px solid var(--color-border);";
              div.innerHTML = `
                <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--color-text-muted);margin-bottom:4px;">
                  <strong>${comm.author_name}</strong>
                  <span>${new Date(comm.created_at).toLocaleString()}</span>
                </div>
                <div style="font-size:13px;color:var(--color-text-primary);word-break:break-all;">${comm.content}</div>
              `;
              list.insertBefore(div, list.firstChild);
            }
          } else {
            Toast.error("Failed to submit comment.");
          }
        } catch {
          Toast.error("Network error posting comment.");
        } finally {
          commentSubmit.disabled = false;
        }
      });
    }
  }

  function closeTaskDrawer() {
    if (drawerOverlay && drawer) {
      drawerOverlay.classList.add('hidden');
      drawer.classList.remove('open');
      drawer.classList.add('hidden');
      activeTaskId = null;
    }
  }

  if (drawerClose) drawerClose.addEventListener('click', closeTaskDrawer);
  if (drawerCancel) drawerCancel.addEventListener('click', closeTaskDrawer);
  if (drawerOverlay) drawerOverlay.addEventListener('click', closeTaskDrawer);

  if (drawerSave) {
    drawerSave.addEventListener('click', async () => {
      if (!activeTaskId) return;

      const title = document.getElementById('drawer-task-title').value.trim();
      const desc = document.getElementById('drawer-task-desc').value.trim();
      const status = document.getElementById('drawer-task-status').value;
      const priority = document.getElementById('drawer-task-priority').value;
      const assignee = document.getElementById('drawer-task-assignee').value;
      const due = document.getElementById('drawer-task-due').value;

      if (!title) {
        Toast.error("Task title cannot be empty.");
        return;
      }

      drawerSave.disabled = true;
      drawerSave.textContent = 'Saving...';

      try {
        const res = await api.patch(`/projects/tasks/${activeTaskId}/`, {
          title,
          description: desc,
          status,
          priority,
          assignee: assignee || null,
          due_date: due || null
        });

        if (res && res.ok) {
          Toast.success("Task updated.");
          closeTaskDrawer();
          if (currentProject) openProjectDetail(currentProject.id);
          if (myTasksView.style.display === 'block') loadMyTasks(1);
        } else {
          Toast.error("Failed to save changes.");
        }
      } catch {
        Toast.error("Network error while updating task.");
      } finally {
        drawerSave.disabled = false;
        drawerSave.textContent = 'Save Changes';
      }
    });
  }

  // ── Create Project Submit ───────────────────────────────

  if (createProjBtn) {
    createProjBtn.addEventListener('click', () => {
      document.getElementById('create-project-name').value = '';
      document.getElementById('create-project-desc').value = '';
      document.getElementById('create-project-status').value = 'planning';
      document.getElementById('create-project-owner').value = '';
      document.getElementById('create-project-start-date').value = '';
      document.getElementById('create-project-end-date').value = '';
      document.getElementById('create-project-error').style.display = 'none';
      createProjModal.classList.remove('hidden');
    });
  }

  const hideCreateProj = () => createProjModal.classList.add('hidden');
  if (createProjClose) createProjClose.addEventListener('click', hideCreateProj);
  if (createProjCancel) createProjCancel.addEventListener('click', hideCreateProj);

  if (createProjForm) {
    createProjForm.addEventListener('click', async () => {
      const name = document.getElementById('create-project-name').value.trim();
      const desc = document.getElementById('create-project-desc').value.trim();
      const status = document.getElementById('create-project-status').value;
      const owner = document.getElementById('create-project-owner').value;
      const start = document.getElementById('create-project-start-date').value;
      const end = document.getElementById('create-project-end-date').value;
      const errorEl = document.getElementById('create-project-error');

      if (!name) {
        errorEl.textContent = "Project name is required.";
        errorEl.style.display = 'block';
        return;
      }

      createProjForm.disabled = true;
      try {
        const res = await api.post('/projects/', {
          name,
          description: desc,
          status,
          owner: owner || null,
          start_date: start || null,
          end_date: end || null
        });

        if (res && res.ok) {
          Toast.success("Project created successfully.");
          hideCreateProj();
          loadProjects(1);
        } else {
          const errData = await res.json();
          errorEl.textContent = errData.error || "Failed to create project.";
          errorEl.style.display = 'block';
        }
      } catch {
        errorEl.textContent = "Network error occurred.";
        errorEl.style.display = 'block';
      } finally {
        createProjForm.disabled = false;
      }
    });
  }

  // ── Edit Project Submit ─────────────────────────────────

  const hideEditProj = () => editProjModal.classList.add('hidden');
  if (editProjClose) editProjClose.addEventListener('click', hideEditProj);
  if (editProjCancel) editProjCancel.addEventListener('click', hideEditProj);

  if (editProjForm) {
    editProjForm.addEventListener('click', async () => {
      const id = document.getElementById('edit-project-id').value;
      const name = document.getElementById('edit-project-name').value.trim();
      const desc = document.getElementById('edit-project-desc').value.trim();
      const status = document.getElementById('edit-project-status').value;
      const owner = document.getElementById('edit-project-owner').value;
      const start = document.getElementById('edit-project-start-date').value;
      const end = document.getElementById('edit-project-end-date').value;
      const errorEl = document.getElementById('edit-project-error');

      if (!name) {
        errorEl.textContent = "Project name is required.";
        errorEl.style.display = 'block';
        return;
      }

      editProjForm.disabled = true;
      try {
        const res = await api.patch(`/projects/${id}/`, {
          name,
          description: desc,
          status,
          owner: owner || null,
          start_date: start || null,
          end_date: end || null
        });

        if (res && res.ok) {
          Toast.success("Project updated successfully.");
          hideEditProj();
          openProjectDetail(id);
        } else {
          const errData = await res.json();
          errorEl.textContent = errData.error || "Failed to save project.";
          errorEl.style.display = 'block';
        }
      } catch {
        errorEl.textContent = "Network error occurred.";
        errorEl.style.display = 'block';
      } finally {
        editProjForm.disabled = false;
      }
    });
  }

  // ── Create Task Submit ──────────────────────────────────

  const createTaskBtn = document.getElementById('btn-create-task');
  if (createTaskBtn) {
    createTaskBtn.addEventListener('click', () => {
      if (!currentProject) return;
      document.getElementById('create-task-title').value = '';
      document.getElementById('create-task-desc').value = '';
      document.getElementById('create-task-status').value = 'todo';
      document.getElementById('create-task-priority').value = 'medium';
      document.getElementById('create-task-assignee').value = '';
      document.getElementById('create-task-due-date').value = '';
      document.getElementById('create-task-error').style.display = 'none';
      createTaskModal.classList.remove('hidden');
    });
  }

  const hideCreateTask = () => createTaskModal.classList.add('hidden');
  if (createTaskClose) createTaskClose.addEventListener('click', hideCreateTask);
  if (createTaskCancel) createTaskCancel.addEventListener('click', hideCreateTask);

  if (createTaskForm) {
    createTaskForm.addEventListener('click', async () => {
      if (!currentProject) return;

      const title = document.getElementById('create-task-title').value.trim();
      const desc = document.getElementById('create-task-desc').value.trim();
      const status = document.getElementById('create-task-status').value;
      const priority = document.getElementById('create-task-priority').value;
      const assignee = document.getElementById('create-task-assignee').value;
      const due = document.getElementById('create-task-due-date').value;
      const errorEl = document.getElementById('create-task-error');

      if (!title) {
        errorEl.textContent = "Task title is required.";
        errorEl.style.display = 'block';
        return;
      }

      createTaskForm.disabled = true;
      try {
        const res = await api.post(`/projects/${currentProject.id}/tasks/`, {
          title,
          description: desc,
          status,
          priority,
          assignee: assignee || null,
          due_date: due || null
        });

        if (res && res.ok) {
          Toast.success("Task added successfully.");
          hideCreateTask();
          openProjectDetail(currentProject.id);
        } else {
          const errData = await res.json();
          errorEl.textContent = errData.error || "Failed to create task.";
          errorEl.style.display = 'block';
        }
      } catch {
        errorEl.textContent = "Network error occurred.";
        errorEl.style.display = 'block';
      } finally {
        createTaskForm.disabled = false;
      }
    });
  }
}

// 4. Teams panel
function initTeamsPanel() {
  const userRole = getCurrentUserRole();
  const currentUser = TokenStore.getUser();

  // Cache some elements
  let addEmployeeBtn = document.getElementById('btn-add-employee');
  let addDeptBtn = document.getElementById('btn-add-dept');

  // Role visibility checks
  const isHrOrAdmin = (userRole === 'admin' || userRole === 'hr');
  if (isHrOrAdmin) {
    if (addEmployeeBtn) addEmployeeBtn.classList.remove('hidden');
  } else {
    if (addEmployeeBtn) addEmployeeBtn.classList.add('hidden');
  }

  // Active tab state
  let activeTab = 'directory';
  let dirPage = 1;
  let leavePage = 1;

  // Initialize Tabs
  const tabLinks = document.querySelectorAll('.tab-link');
  tabLinks.forEach(link => {
    link.addEventListener('click', () => {
      const targetTab = link.dataset.tab;
      activeTab = targetTab;

      // Update active styling
      tabLinks.forEach(l => {
        const isActive = l.dataset.tab === targetTab;
        l.style.borderBottomColor = isActive ? 'var(--color-navy)' : 'transparent';
        l.style.color = isActive ? 'var(--color-navy)' : 'var(--color-text-secondary)';
        l.classList.toggle('active', isActive);
      });

      // Update content visibility
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('hidden', content.id !== `tab-${targetTab}`);
      });

      // Show/Hide profile (reset to tabs)
      document.getElementById('panel-employee-profile').classList.add('hidden');
      document.getElementById('teams-panels').classList.remove('hidden');

      // Header actions updates
      if (addDeptBtn) {
        addDeptBtn.classList.toggle('hidden', targetTab !== 'departments' || !isHrOrAdmin);
      }
      if (addEmployeeBtn) {
        addEmployeeBtn.classList.toggle('hidden', targetTab !== 'directory' || !isHrOrAdmin);
      }

      // Load Tab Data
      loadTabData(targetTab);
    });
  });

  // Load appropriate data
  async function loadTabData(tab) {
    if (tab === 'directory') {
      await loadDirectory(1);
    } else if (tab === 'departments') {
      await loadDepartments();
    } else if (tab === 'leave') {
      await loadLeaveRequests(1);
    }
  }

  // --- TAB: DIRECTORY ---
  async function loadDirectory(page) {
    dirPage = page;
    const search = document.getElementById('dir-search').value.trim();
    const dept = document.getElementById('dir-filter-dept').value;
    const status = document.getElementById('dir-filter-status').value;

    let query = `?page=${page}`;
    if (search) query += `&search=${encodeURIComponent(search)}`;
    if (dept) query += `&department=${encodeURIComponent(dept)}`;
    if (status) query += `&status=${encodeURIComponent(status)}`;

    const res = await api.get(`/teams/employees/${query}`);
    const tbody = document.getElementById('dir-table-body');
    const pagination = document.getElementById('dir-pagination');

    if (!res || !res.ok) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--color-text-muted);">Failed to load directory.</td></tr>`;
      return;
    }

    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--color-text-muted);">No employees found.</td></tr>`;
      if (pagination) pagination.innerHTML = '';
      return;
    }

    const statusColors = {
      'active': 'badge-green',
      'on_leave': 'badge-orange',
      'inactive': 'badge-grey'
    };

    if (tbody) {
      tbody.innerHTML = data.results.map(emp => `
        <tr class="clickable-row" data-id="${emp.id}" style="cursor:pointer;">
          <td>
            <div style="font-weight:600;color:var(--color-text-primary);">${emp.full_name}</div>
          </td>
          <td>${emp.email}</td>
          <td>${emp.department_name || '—'}</td>
          <td><span class="badge badge-blue">${emp.role.toUpperCase()}</span></td>
          <td>${emp.manager_name || '—'}</td>
          <td><span class="badge ${statusColors[emp.employment_status] || 'badge-grey'}">${emp.employment_status}</span></td>
        </tr>
      `).join('');

      // Click row to view profile
      tbody.querySelectorAll('.clickable-row').forEach(row => {
        row.addEventListener('click', () => {
          viewEmployeeProfile(row.dataset.id);
        });
      });
    }

    // Render directory pagination
    if (pagination) {
      renderPagination(pagination, data, page, loadDirectory);
    }
  }

  // Directory filters listeners
  const dirSearch = document.getElementById('dir-search');
  const dirFilterDept = document.getElementById('dir-filter-dept');
  const dirFilterStatus = document.getElementById('dir-filter-status');

  if (dirSearch) {
    const newDirSearch = dirSearch.cloneNode(true);
    dirSearch.parentNode.replaceChild(newDirSearch, dirSearch);
    newDirSearch.addEventListener('input', debounce(() => loadDirectory(1), 300));
  }
  if (dirFilterDept) {
    const newFilterDept = dirFilterDept.cloneNode(true);
    dirFilterDept.parentNode.replaceChild(newFilterDept, dirFilterDept);
    newFilterDept.addEventListener('change', () => loadDirectory(1));
  }
  if (dirFilterStatus) {
    const newFilterStatus = dirFilterStatus.cloneNode(true);
    dirFilterStatus.parentNode.replaceChild(newFilterStatus, dirFilterStatus);
    newFilterStatus.addEventListener('change', () => loadDirectory(1));
  }


  // --- TAB: DEPARTMENTS ---
  async function loadDepartments() {
    const res = await api.get('/teams/departments/');
    const tbody = document.getElementById('dept-table-body');
    if (!res || !res.ok) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--color-text-muted);">Failed to load departments.</td></tr>`;
      return;
    }

    const data = await res.json();
    if (data.length === 0) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--color-text-muted);">No departments configured.</td></tr>`;
      return;
    }

    if (tbody) {
      tbody.innerHTML = data.map(dept => `
        <tr>
          <td style="font-weight:600;color:var(--color-text-primary);">${dept.name}</td>
          <td>${dept.parent_name || '—'}</td>
          <td>${dept.head_name || '—'}</td>
          <td>${dept.employee_count}</td>
          <td style="text-align:right;">
            ${isHrOrAdmin ? `<button class="btn btn-danger btn-xs btn-delete-dept" data-id="${dept.id}" data-name="${dept.name}">Delete</button>` : '—'}
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('.btn-delete-dept').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`Are you sure you want to delete department "${btn.dataset.name}"?`)) {
            btn.disabled = true;
            const delRes = await api.delete(`/teams/departments/${btn.dataset.id}/`);
            if (delRes && delRes.ok) {
              Toast.success('Department deleted successfully.');
              loadDepartments();
              populateDepartmentDropdowns(); // refresh dropdowns
            } else {
              const err = await delRes.json();
              Toast.error(err.error || 'Failed to delete department.');
              btn.disabled = false;
            }
          }
        });
      });
    }
  }


  // --- TAB: LEAVE REQUESTS ---
  async function loadLeaveRequests(page) {
    leavePage = page;
    const status = document.getElementById('leave-filter-status').value;

    let query = `?page=${page}`;
    if (status) query += `&status=${encodeURIComponent(status)}`;

    const res = await api.get(`/teams/leave/${query}`);
    const tbody = document.getElementById('leave-table-body');
    const pagination = document.getElementById('leave-pagination');

    if (!res || !res.ok) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--color-text-muted);">Failed to load leave requests.</td></tr>`;
      return;
    }

    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--color-text-muted);">No leave requests found.</td></tr>`;
      if (pagination) pagination.innerHTML = '';
      return;
    }

    const statusColors = {
      'pending': 'badge-orange',
      'approved': 'badge-green',
      'rejected': 'badge-red'
    };

    if (tbody) {
      tbody.innerHTML = data.results.map(req => {
        const canProcess = req.status === 'pending' && (userRole === 'admin' || userRole === 'hr' || userRole === 'manager');
        const actionHtml = canProcess ? `
          <div style="display:flex;gap:6px;justify-content:flex-end;">
            <button class="btn btn-primary btn-xs btn-approve-leave" data-id="${req.id}">Approve</button>
            <button class="btn btn-danger btn-xs btn-reject-leave" data-id="${req.id}">Reject</button>
          </div>
        ` : '—';

        return `
          <tr>
            <td style="font-weight:600;color:var(--color-text-primary);">${req.employee_name}</td>
            <td><span class="badge badge-grey">${req.leave_type}</span></td>
            <td>${req.start_date}</td>
            <td>${req.end_date}</td>
            <td>${req.duration_days} days</td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${req.notes || ''}">${req.notes || '—'}</td>
            <td><span class="badge ${statusColors[req.status] || 'badge-grey'}">${req.status}</span></td>
            <td>${req.approved_by_name || '—'}</td>
            <td style="text-align:right;">${actionHtml}</td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.btn-approve-leave').forEach(btn => {
        btn.addEventListener('click', () => processLeave(btn.dataset.id, 'approved', btn));
      });
      tbody.querySelectorAll('.btn-reject-leave').forEach(btn => {
        btn.addEventListener('click', () => processLeave(btn.dataset.id, 'rejected', btn));
      });
    }

    if (pagination) {
      renderPagination(pagination, data, page, loadLeaveRequests);
    }
  }

  // Process leave request status
  async function processLeave(id, status, btn) {
    if (btn) btn.disabled = true;
    const response = await api.patch(`/teams/leave/${id}/`, { status });
    if (response && response.ok) {
      Toast.success(`Leave request ${status} successfully.`);
      loadLeaveRequests(leavePage);
    } else {
      const err = await response.json();
      Toast.error(err.error || 'Failed to update leave request.');
      if (btn) btn.disabled = false;
    }
  }

  const leaveFilterStatus = document.getElementById('leave-filter-status');
  if (leaveFilterStatus) {
    const newLeaveFilter = leaveFilterStatus.cloneNode(true);
    leaveFilterStatus.parentNode.replaceChild(newLeaveFilter, leaveFilterStatus);
    newLeaveFilter.addEventListener('change', () => loadLeaveRequests(1));
  }


  // --- DETAILED SCREEN: EMPLOYEE PROFILE ---
  async function viewEmployeeProfile(employeeId) {
    const res = await api.get(`/teams/employees/${employeeId}/`);
    if (!res || !res.ok) {
      Toast.error('Failed to load employee profile.');
      return;
    }

    const emp = await res.json();

    // Toggle panels visibility
    document.getElementById('teams-panels').classList.add('hidden');
    document.getElementById('panel-employee-profile').classList.remove('hidden');

    // Hide directory buttons in header
    if (addEmployeeBtn) addEmployeeBtn.classList.add('hidden');
    if (addDeptBtn) addDeptBtn.classList.add('hidden');

    // Populate profile card elements
    document.getElementById('profile-name').textContent = emp.full_name;
    document.getElementById('profile-role-badge').textContent = (emp.role || 'employee').toUpperCase();
    document.getElementById('profile-email').textContent = emp.email;
    document.getElementById('profile-hire-date').textContent = emp.hire_date || '—';
    document.getElementById('profile-department').textContent = emp.department_name || '—';
    document.getElementById('profile-manager').textContent = emp.manager_name || '—';
    document.getElementById('profile-avatar').textContent = emp.full_name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();

    // Status badge colors
    const statusColors = {
      'active': 'badge-green',
      'on_leave': 'badge-orange',
      'inactive': 'badge-grey'
    };
    const sBadge = document.getElementById('profile-status-badge-container');
    if (sBadge) {
      sBadge.innerHTML = `<span class="badge ${statusColors[emp.employment_status] || 'badge-grey'}">${emp.employment_status}</span>`;
    }

    // Leave balance limits
    document.getElementById('bal-annual').textContent = emp.leave_balance?.annual ?? 0;
    document.getElementById('bal-sick').textContent = emp.leave_balance?.sick ?? 0;
    document.getElementById('bal-unpaid').textContent = emp.leave_balance?.unpaid ?? 0;

    // HR Actions visibility
    const hrActions = document.getElementById('hr-actions-container');
    if (isHrOrAdmin) {
      hrActions.classList.remove('hidden');
      
      // Update Edit profile modal button
      const editBtn = document.getElementById('btn-edit-profile');
      editBtn.onclick = () => {
        document.getElementById('edit-employee-id').value = emp.id;
        document.getElementById('edit-dept').value = emp.department || '';
        document.getElementById('edit-manager').value = emp.manager || '';
        document.getElementById('edit-status').value = emp.employment_status;
        document.getElementById('edit-hire-date').value = emp.hire_date || '';
        document.getElementById('modal-edit-profile').classList.remove('hidden');
      };

      // Deactivate account button
      const deactivateBtn = document.getElementById('btn-deactivate-employee');
      deactivateBtn.disabled = emp.employment_status === 'inactive';
      deactivateBtn.onclick = async () => {
        if (confirm(`Are you sure you want to deactivate ${emp.full_name}?`)) {
          deactivateBtn.disabled = true;
          const patchRes = await api.patch(`/teams/employees/${emp.id}/`, { employment_status: 'inactive' });
          if (patchRes && patchRes.ok) {
            Toast.success('Employee account deactivated.');
            viewEmployeeProfile(emp.id);
          } else {
            Toast.error('Failed to deactivate employee.');
            deactivateBtn.disabled = false;
          }
        }
      };
    } else {
      hrActions.classList.add('hidden');
    }

    // Bind Review button (visible to managers/HR/admin)
    const addReviewBtn = document.getElementById('btn-add-review');
    const isManagerOrAbove = (userRole === 'admin' || userRole === 'hr' || userRole === 'manager');
    if (isManagerOrAbove) {
      addReviewBtn.classList.remove('hidden');
      addReviewBtn.onclick = () => {
        document.getElementById('review-employee-id').value = emp.id;
        document.getElementById('form-add-review').reset();
        document.getElementById('modal-add-review').classList.remove('hidden');
      };
    } else {
      addReviewBtn.classList.add('hidden');
    }

    // Active tasks body
    const tasksBody = document.getElementById('profile-tasks-body');
    if (tasksBody) {
      if (!emp.active_tasks || emp.active_tasks.length === 0) {
        tasksBody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--color-text-muted);">No active tasks assigned.</td></tr>`;
      } else {
        const priorityColors = {
          'low': 'badge-grey',
          'medium': 'badge-blue',
          'high': 'badge-orange',
          'critical': 'badge-red'
        };
        tasksBody.innerHTML = emp.active_tasks.map(t => `
          <tr>
            <td><strong>${t.project_name}</strong></td>
            <td>${t.title}</td>
            <td><span class="badge ${priorityColors[t.priority] || 'badge-grey'}">${t.priority}</span></td>
            <td><span class="badge badge-grey">${t.status}</span></td>
            <td>${t.due_date || '—'}</td>
          </tr>
        `).join('');
      }
    }

    // Performance reviews list
    const reviewsList = document.getElementById('profile-reviews-list');
    if (reviewsList) {
      if (!emp.reviews || emp.reviews.length === 0) {
        reviewsList.innerHTML = `<div style="text-align:center;padding:16px;color:var(--color-text-muted);border: 1px dashed var(--color-border); border-radius: 6px;">No performance evaluations logged yet.</div>`;
      } else {
        reviewsList.innerHTML = emp.reviews.map(r => `
          <div class="card" style="padding:16px; border:1px solid var(--color-border); background-color: var(--color-bg); margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-weight:600;font-size:14px;color:var(--color-text-primary);">Period: ${r.period_start} to ${r.period_end}</span>
              <span class="badge badge-green" style="font-size:12px;padding:4px 8px;">Score: ${r.score} / 5</span>
            </div>
            <p style="margin:0 0 10px 0;font-size:13px;color:var(--color-text-secondary);line-height:1.4;">${r.notes || '—'}</p>
            <div style="font-size:11px;color:var(--color-text-muted);display:flex;justify-content:space-between;">
              <span>Evaluated by: ${r.reviewer_name}</span>
              <span>Logged: ${new Date(r.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        `).join('');
      }
    }
  }

  // Profile Back Button Action
  const profileBack = document.getElementById('profile-back');
  if (profileBack) {
    const newProfileBack = profileBack.cloneNode(true);
    profileBack.parentNode.replaceChild(newProfileBack, profileBack);
    newProfileBack.addEventListener('click', () => {
      document.getElementById('panel-employee-profile').classList.add('hidden');
      document.getElementById('teams-panels').classList.remove('hidden');
      
      // Restore header buttons
      if (addEmployeeBtn) addEmployeeBtn.classList.toggle('hidden', activeTab !== 'directory' || !isHrOrAdmin);
      if (addDeptBtn) addDeptBtn.classList.toggle('hidden', activeTab !== 'departments' || !isHrOrAdmin);
      
      loadDirectory(dirPage);
    });
  }


  // --- MODAL UTILITIES ---

  // Close any modal handler
  document.querySelectorAll('.modal-close, .btn-close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.modal;
      if (modalId) {
        document.getElementById(modalId).classList.add('hidden');
      }
    });
  });

  // Modal open binds
  if (addEmployeeBtn) {
    const newAddEmployeeBtn = addEmployeeBtn.cloneNode(true);
    addEmployeeBtn.parentNode.replaceChild(newAddEmployeeBtn, addEmployeeBtn);
    addEmployeeBtn = newAddEmployeeBtn; // Update closure reference!
    addEmployeeBtn.addEventListener('click', () => {
      document.getElementById('form-add-employee').reset();
      document.getElementById('modal-add-employee').classList.remove('hidden');
    });
  }

  if (addDeptBtn) {
    const newAddDeptBtn = addDeptBtn.cloneNode(true);
    addDeptBtn.parentNode.replaceChild(newAddDeptBtn, addDeptBtn);
    addDeptBtn = newAddDeptBtn; // Update closure reference!
    addDeptBtn.addEventListener('click', () => {
      document.getElementById('form-add-dept').reset();
      document.getElementById('modal-add-dept').classList.remove('hidden');
    });
  }

  const requestLeaveBtn = document.getElementById('btn-request-leave');
  if (requestLeaveBtn) {
    const newReqLeaveBtn = requestLeaveBtn.cloneNode(true);
    requestLeaveBtn.parentNode.replaceChild(newReqLeaveBtn, requestLeaveBtn);
    newReqLeaveBtn.addEventListener('click', () => {
      document.getElementById('form-request-leave').reset();
      document.getElementById('modal-request-leave').classList.remove('hidden');
    });
  }


  // Populate forms dropdown selections dynamically
  async function populateDepartmentDropdowns() {
    const res = await api.get('/teams/departments/');
    if (res && res.ok) {
      const depts = await res.json();
      const optionsHtml = `<option value="">Select Department</option>` + depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
      
      const parentSelect = document.getElementById('dept-parent');
      const addEmpDeptSelect = document.getElementById('emp-dept');
      const editEmpDeptSelect = document.getElementById('edit-dept');
      const dirFilterSelect = document.getElementById('dir-filter-dept');

      if (parentSelect) parentSelect.innerHTML = `<option value="">None (Top Level)</option>` + depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
      if (addEmpDeptSelect) addEmpDeptSelect.innerHTML = optionsHtml;
      if (editEmpDeptSelect) editEmpDeptSelect.innerHTML = `<option value="">None</option>` + depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
      if (dirFilterSelect) dirFilterSelect.innerHTML = `<option value="">All Departments</option>` + depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    }
  }

  async function populateEmployeeDropdowns() {
    const res = await api.get('/teams/employees/?page_size=200'); // fetch a larger list
    if (res && res.ok) {
      const data = await res.json();
      const employees = data.results || [];
      const optionsHtml = `<option value="">Select Manager</option>` + employees.map(e => `<option value="${e.id}">${e.full_name}</option>`).join('');
      
      const headSelect = document.getElementById('dept-head');
      const addEmpMgrSelect = document.getElementById('emp-manager');
      const editEmpMgrSelect = document.getElementById('edit-manager');

      if (headSelect) headSelect.innerHTML = `<option value="">Select Head</option>` + employees.map(e => `<option value="${e.user_id}">${e.full_name}</option>`).join('');
      if (addEmpMgrSelect) addEmpMgrSelect.innerHTML = optionsHtml;
      if (editEmpMgrSelect) editEmpMgrSelect.innerHTML = `<option value="">None</option>` + employees.map(e => `<option value="${e.id}">${e.full_name}</option>`).join('');
    }
  }


  // --- FORM SUBMISSIONS ---

  // Form: Create Employee
  const formAddEmployee = document.getElementById('form-add-employee');
  if (formAddEmployee) {
    const newFormAddEmp = formAddEmployee.cloneNode(true);
    formAddEmployee.parentNode.replaceChild(newFormAddEmp, formAddEmployee);
    newFormAddEmp.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = newFormAddEmp.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      const payload = {
        first_name: document.getElementById('emp-first-name').value.trim(),
        last_name: document.getElementById('emp-last-name').value.trim(),
        email: document.getElementById('emp-email').value.trim(),
        password: document.getElementById('emp-password').value,
        role: document.getElementById('emp-role').value,
        department_id: document.getElementById('emp-dept').value || null,
        manager_id: document.getElementById('emp-manager').value || null,
        hire_date: document.getElementById('emp-hire-date').value || null,
      };

      const response = await api.post('/teams/employees/', payload);
      submitBtn.disabled = false;

      if (response && response.ok) {
        Toast.success('Employee created successfully.');
        document.getElementById('modal-add-employee').classList.add('hidden');
        loadDirectory(1);
        populateEmployeeDropdowns(); // refresh dropdown selections
      } else {
        const err = await response.json();
        Toast.error(err.error || 'Failed to create employee.');
      }
    });
  }

  // Form: Create Department
  const formAddDept = document.getElementById('form-add-dept');
  if (formAddDept) {
    const newFormAddDept = formAddDept.cloneNode(true);
    formAddDept.parentNode.replaceChild(newFormAddDept, formAddDept);
    newFormAddDept.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = newFormAddDept.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      const payload = {
        name: document.getElementById('dept-name').value.trim(),
        parent_department_id: document.getElementById('dept-parent').value || null,
        head_id: document.getElementById('dept-head').value || null,
      };

      const response = await api.post('/teams/departments/', payload);
      submitBtn.disabled = false;

      if (response && response.ok) {
        Toast.success('Department created successfully.');
        document.getElementById('modal-add-dept').classList.add('hidden');
        loadDepartments();
        populateDepartmentDropdowns(); // refresh dropdown selections
      } else {
        const err = await response.json();
        Toast.error(err.error || 'Failed to create department.');
      }
    });
  }

  // Form: Request Leave
  const formRequestLeave = document.getElementById('form-request-leave');
  if (formRequestLeave) {
    const newFormReqLeave = formRequestLeave.cloneNode(true);
    formRequestLeave.parentNode.replaceChild(newFormReqLeave, formRequestLeave);
    newFormReqLeave.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = newFormReqLeave.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      const payload = {
        leave_type: document.getElementById('leave-type').value,
        start_date: document.getElementById('leave-start').value,
        end_date: document.getElementById('leave-end').value,
        notes: document.getElementById('leave-notes').value.trim(),
      };

      const response = await api.post('/teams/leave/', payload);
      submitBtn.disabled = false;

      if (response && response.ok) {
        Toast.success('Leave request submitted.');
        document.getElementById('modal-request-leave').classList.add('hidden');
        loadLeaveRequests(1);
      } else {
        const err = await response.json();
        Toast.error(err.error || 'Failed to submit leave request.');
      }
    });
  }

  // Form: Create Review
  const formAddReview = document.getElementById('form-add-review');
  if (formAddReview) {
    const newFormAddReview = formAddReview.cloneNode(true);
    formAddReview.parentNode.replaceChild(newFormAddReview, formAddReview);
    newFormAddReview.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = newFormAddReview.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      const empId = document.getElementById('review-employee-id').value;
      const payload = {
        employee_id: empId,
        period_start: document.getElementById('review-start').value,
        period_end: document.getElementById('review-end').value,
        score: parseInt(document.getElementById('review-score').value),
        notes: document.getElementById('review-notes').value.trim(),
      };

      const response = await api.post('/teams/reviews/', payload);
      submitBtn.disabled = false;

      if (response && response.ok) {
        Toast.success('Performance review recorded.');
        document.getElementById('modal-add-review').classList.add('hidden');
        viewEmployeeProfile(empId);
      } else {
        const err = await response.json();
        Toast.error(err.error || 'Failed to create review.');
      }
    });
  }

  // Form: Update Employee Record
  const formEditProfile = document.getElementById('form-edit-profile');
  if (formEditProfile) {
    const newFormEditProfile = formEditProfile.cloneNode(true);
    formEditProfile.parentNode.replaceChild(newFormEditProfile, formEditProfile);
    newFormEditProfile.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = newFormEditProfile.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      const empId = document.getElementById('edit-employee-id').value;
      const payload = {
        department_id: document.getElementById('edit-dept').value || null,
        manager_id: document.getElementById('edit-manager').value || null,
        employment_status: document.getElementById('edit-status').value,
        hire_date: document.getElementById('edit-hire-date').value || null,
      };

      const response = await api.patch(`/teams/employees/${empId}/`, payload);
      submitBtn.disabled = false;

      if (response && response.ok) {
        Toast.success('Employee record updated.');
        document.getElementById('modal-edit-profile').classList.add('hidden');
        viewEmployeeProfile(empId);
        populateEmployeeDropdowns(); // refresh managers list
      } else {
        const err = await response.json();
        Toast.error(err.error || 'Failed to update employee record.');
      }
    });
  }


  // --- PAGINATION COMPONENT UTILITY ---
  function renderPagination(container, data, currentPage, loadPageFn) {
    container.innerHTML = '';
    if (!data.previous && !data.next) return;

    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn btn-ghost btn-xs';
    prevBtn.textContent = '← Previous';
    prevBtn.disabled = !data.previous;
    prevBtn.style.marginRight = '8px';
    if (data.previous) {
      prevBtn.addEventListener('click', () => loadPageFn(currentPage - 1));
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-ghost btn-xs';
    nextBtn.textContent = 'Next →';
    nextBtn.disabled = !data.next;
    if (data.next) {
      nextBtn.addEventListener('click', () => loadPageFn(currentPage + 1));
    }

    container.appendChild(prevBtn);
    
    const pageInfo = document.createElement('span');
    pageInfo.style.fontSize = '13px';
    pageInfo.style.color = 'var(--color-text-muted)';
    pageInfo.style.margin = '0 12px';
    pageInfo.textContent = `Page ${currentPage}`;
    container.appendChild(pageInfo);
    
    container.appendChild(nextBtn);
  }


  // --- INITIAL STAGE LOAD ---
  populateDepartmentDropdowns();
  populateEmployeeDropdowns();
  loadDirectory(1);
}


// 5. Hiring panel
const mockCandidates = [];

// ============================================================
// HIRING PANEL — Full Phase 1 Implementation
// ============================================================

function initHiringPanel() {

  // State
  let currentView      = 'job-board';
  let currentJobId     = null;
  let currentJobTitle  = '';
  let jobsPage         = 1;
  let jobsFilters      = {};
  let searchDebounce   = null;

  // Stage config
  const STAGES = [
    { key: 'applied',   label: 'Applied',   color: 'var(--color-text-muted)',  badge: 'badge-grey' },
    { key: 'screening', label: 'Screening', color: 'var(--color-blue-mid)',    badge: 'badge-blue' },
    { key: 'interview', label: 'Interview', color: 'var(--color-warning)',     badge: 'badge-yellow' },
    { key: 'offer',     label: 'Offer',     color: 'var(--color-orange)',      badge: 'badge-orange' },
    { key: 'hired',     label: 'Hired',     color: 'var(--color-success)',     badge: 'badge-green' },
    { key: 'rejected',  label: 'Rejected',  color: 'var(--color-error)',       badge: 'badge-red' },
  ];

  const STATUS_CONFIG = {
    draft:  { label: 'Draft',  badge: 'badge-grey' },
    open:   { label: 'Open',   badge: 'badge-green' },
    closed: { label: 'Closed', badge: 'badge-red' },
  };

  // ── Boot ─────────────────────────────────────────────────

  loadStats();
  showJobBoardView();
  initPostJobModal();
  initAddCandidateModal();
  initMoveStageModal();
  initCandidateDrawer();
  initJobChat();
  initBulkUploadModal();

  document.getElementById('btn-back-to-jobs')
    ?.addEventListener('click', showJobBoardView);

  // ── View Switching ────────────────────────────────────────

  function showJobBoardView() {
    currentView   = 'job-board';
    currentJobId  = null;
    document.getElementById('hiring-job-board-view').style.display  = 'block';
    document.getElementById('hiring-pipeline-view').style.display   = 'none';
    loadJobs(1);
    initJobSearch();
    initJobFilters();
  }

  function showPipelineView(jobId, jobTitle) {
    currentView   = 'pipeline';
    currentJobId  = jobId;
    currentJobTitle = jobTitle;
    document.getElementById('hiring-job-board-view').style.display  = 'none';
    document.getElementById('hiring-pipeline-view').style.display   = 'block';
    window.scrollTo(0, 0);
    loadPipeline(jobId);
  }

  // ── Stats ─────────────────────────────────────────────────

  async function loadStats() {
    try {
      const response = await api.get('/hiring/stats/');
      if (!response || !response.ok) return;
      const data = await response.json();
      document.getElementById('stat-open-positions').textContent = data.open_positions      ?? '—';
      document.getElementById('stat-apps-month').textContent     = data.applications_month  ?? '—';
      document.getElementById('stat-apps-week').textContent      = data.applications_week   ?? '—';
      document.getElementById('stat-avg-hire').textContent       =
        data.avg_days_to_hire ? `${data.avg_days_to_hire}d` : '—';
    } catch { /* silent */ }
  }

  // ── Job Board ─────────────────────────────────────────────

  async function loadJobs(page) {
    jobsPage = page;
    const grid = document.getElementById('jobs-grid');
    if (!grid) return;

    grid.innerHTML = `
      <div style="display:flex;justify-content:center;padding:48px;grid-column:1/-1;">
        <span class="spinner" style="width:32px;height:32px;border-width:3px;"></span>
      </div>
    `;

    const params = new URLSearchParams({ page: String(page) });
    if (jobsFilters.search) params.set('search', jobsFilters.search);
    if (jobsFilters.status) params.set('status', jobsFilters.status);

    try {
      const response = await api.get(`/hiring/jobs/?${params.toString()}`);
      if (!response || !response.ok) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
          <div class="empty-state-title">Failed to load jobs</div>
        </div>`;
        return;
      }

      const data = await response.json();
      const jobs = data.results || [];
      const count = data.count || 0;

      const countEl = document.getElementById('jobs-count');
      if (countEl) countEl.textContent = `${count} posting${count !== 1 ? 's' : ''}`;

      if (jobs.length === 0) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1;">
            <div style="font-size:48px;margin-bottom:16px;">💼</div>
            <div class="empty-state-title">No job postings yet</div>
            <div class="empty-state-text">
              ${jobsFilters.search || jobsFilters.status
                ? 'Try adjusting your filters.'
                : 'Create your first job posting to start hiring.'}
            </div>
            ${!jobsFilters.search && !jobsFilters.status
              ? `<button class="btn btn-primary"
                   onclick="document.getElementById('modal-post-job').classList.remove('hidden')">
                   + Post a Job
                 </button>` : ''}
          </div>
        `;
      } else {
        grid.innerHTML = jobs.map(job => renderJobCard(job)).join('');
        grid.querySelectorAll('[data-job-id]').forEach(card => {
          card.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
              showPipelineView(card.dataset.jobId, card.dataset.jobTitle);
            }
          });
        });
      }

      renderJobsPagination(data);

    } catch {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-state-title">Connection error</div>
      </div>`;
    }
  }

  function renderJobCard(job) {
    const statusCfg  = STATUS_CONFIG[job.status] || { label: job.status, badge: 'badge-grey' };
    const count      = job.application_count || 0;

    return `
      <div
        data-job-id="${job.id}"
        data-job-title="${job.title.replace(/"/g, '&quot;')}"
        style="
          background:var(--color-surface);
          border:1px solid var(--color-border);
          border-radius:8px;
          overflow:hidden;
          cursor:pointer;
          transition:transform 0.15s ease,box-shadow 0.15s ease;
        "
        onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)';"
        onmouseleave="this.style.transform='';this.style.boxShadow='';"
      >
        <div style="background:var(--color-navy);padding:16px 20px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
            <div style="font-size:15px;font-weight:700;color:white;line-height:1.3;
                        display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
              ${job.title}
            </div>
            <span class="badge ${statusCfg.badge}" style="flex-shrink:0;font-size:10px;">
              ${statusCfg.label}
            </span>
          </div>
          ${job.department
            ? `<div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px;">${job.department}</div>`
            : ''}
        </div>
        <div style="padding:16px 20px;">
          <div style="font-size:13px;color:var(--color-text-muted);margin-bottom:12px;">
            ${count} applicant${count !== 1 ? 's' : ''} ·
            Posted ${new Date(job.created_at).toLocaleDateString()}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button
              class="btn btn-ghost btn-sm"
              onclick="event.stopPropagation();openEditJobModal('${job.id}','${job.title.replace(/'/g,"\\'")}','${job.department}','${job.status}')"
            >Edit</button>
            ${job.status !== 'open'
              ? `<button class="btn btn-secondary btn-sm"
                   onclick="event.stopPropagation();updateJobStatus('${job.id}','open')">
                   Publish
                 </button>`
              : `<button class="btn btn-ghost btn-sm"
                   onclick="event.stopPropagation();updateJobStatus('${job.id}','closed')">
                   Close
                 </button>`
            }
            <button
              class="btn btn-danger btn-sm"
              onclick="event.stopPropagation();deleteJob('${job.id}','${job.title.replace(/'/g,"\\'")}')"
            >Delete</button>
          </div>
        </div>
      </div>
    `;
  }

  window.updateJobStatus = async function(jobId, newStatus) {
    try {
      const response = await api.patch(`/hiring/jobs/${jobId}/`, { status: newStatus });
      if (response && response.ok) {
        Toast.success(`Job ${newStatus === 'open' ? 'published' : 'closed'}.`);
        loadJobs(jobsPage);
        loadStats();
      } else {
        Toast.error('Failed to update job status.');
      }
    } catch { Toast.error('An error occurred.'); }
  };

  window.deleteJob = async function(jobId, title) {
    if (!confirm(`Delete job posting "${title}"?`)) return;
    try {
      const response = await api.delete(`/hiring/jobs/${jobId}/`);
      if (response && response.status === 204) {
        Toast.success('Job posting deleted.');
        loadJobs(jobsPage);
        loadStats();
      } else {
        Toast.error('Failed to delete job posting.');
      }
    } catch { Toast.error('An error occurred.'); }
  };

  function initJobSearch() {
    const input = document.getElementById('jobs-search');
    if (!input) return;
    input.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        jobsFilters.search = input.value.trim() || undefined;
        loadJobs(1);
      }, 400);
    });
  }

  function initJobFilters() {
    document.getElementById('jobs-filter-status')
      ?.addEventListener('change', (e) => {
        jobsFilters.status = e.target.value || undefined;
        loadJobs(1);
      });
  }

  function renderJobsPagination(data) {
    const container = document.getElementById('jobs-pagination');
    if (!container) return;
    if (!data.next && !data.previous) { container.innerHTML = ''; return; }
    const totalPages = Math.ceil(data.count / 20);
    container.innerHTML = `
      <div class="pagination">
        <span style="font-size:13px;color:var(--color-text-muted);">
          Page ${jobsPage} of ${totalPages} · ${data.count} postings
        </span>
        <div class="pagination-controls">
          <button class="pagination-btn" id="jobs-prev" ${!data.previous ? 'disabled' : ''}>← Previous</button>
          <button class="pagination-btn" id="jobs-next" ${!data.next ? 'disabled' : ''}>Next →</button>
        </div>
      </div>
    `;
    document.getElementById('jobs-prev')?.addEventListener('click', () => loadJobs(jobsPage - 1));
    document.getElementById('jobs-next')?.addEventListener('click', () => loadJobs(jobsPage + 1));
  }

  // ── Pipeline View ─────────────────────────────────────────

  async function loadPipeline(jobId) {
    const headerEl = document.getElementById('pipeline-job-header');
    const boardEl  = document.getElementById('pipeline-board');
    const statsEl  = document.getElementById('pipeline-stats');

    // Reset Chat History for this Job
    const chatHistory = document.getElementById('job-chat-history');
    if (chatHistory) {
      chatHistory.innerHTML = `
        <div style="color:var(--color-text-muted); font-style:italic;">
          Hello! I can answer questions about this job description and any candidate resumes uploaded to this pipeline. Try asking: "Who has Python experience?" or "Summarize the applicant skills."
        </div>
      `;
    }
    const chatInput = document.getElementById('job-chat-input');
    if (chatInput) chatInput.value = '';

    if (headerEl) headerEl.innerHTML = `<div style="padding:20px;display:flex;justify-content:center;">
      <span class="spinner" style="width:28px;height:28px;border-width:3px;"></span>
    </div>`;
    if (boardEl) boardEl.innerHTML = '';

    try {
      // Load job and applications in parallel
      const [jobResponse, appsResponse] = await Promise.all([
        api.get(`/hiring/jobs/${jobId}/`),
        api.get(`/hiring/jobs/${jobId}/applications/`),
      ]);

      if (!jobResponse || !jobResponse.ok) {
        if (headerEl) headerEl.innerHTML = `<div class="empty-state"><div class="empty-state-title">Job not found</div></div>`;
        return;
      }

      const job  = await jobResponse.json();
      const apps = appsResponse && appsResponse.ok ? await appsResponse.json() : [];

      renderPipelineHeader(job);
      renderPipelineStats(apps);
      renderPipelineBoard(apps);

    } catch {
      if (headerEl) headerEl.innerHTML = `<div class="empty-state"><div class="empty-state-title">Failed to load pipeline</div></div>`;
    }
  }

  function renderPipelineHeader(job) {
    const headerEl = document.getElementById('pipeline-job-header');
    if (!headerEl) return;
    const statusCfg = STATUS_CONFIG[job.status] || { label: job.status, badge: 'badge-grey' };

    headerEl.innerHTML = `
      <div style="padding:20px 24px;display:flex;align-items:flex-start;
                  justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
            <h1 style="font-size:20px;font-weight:700;color:var(--color-text-primary);margin:0;">
              ${job.title}
            </h1>
            <span class="badge ${statusCfg.badge}">${statusCfg.label}</span>
          </div>
          <div style="font-size:13px;color:var(--color-text-muted);">
            ${job.department ? `${job.department} · ` : ''}
            Posted by ${job.created_by_name} ·
            ${new Date(job.created_at).toLocaleDateString()}
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          ${job.status !== 'open'
            ? `<button class="btn btn-secondary btn-sm"
                 onclick="updateJobStatus('${job.id}','open');loadPipeline('${job.id}')">
                 Publish
               </button>`
            : `<button class="btn btn-ghost btn-sm"
                 onclick="updateJobStatus('${job.id}','closed');loadPipeline('${job.id}')">
                 Close Job
               </button>`
          }
        </div>
      </div>
    `;
    // Load AI candidate rankings for this job
    // loadCandidateRankings(job.id);
  }

  async function loadCandidateRankings(jobId) {
    // Insert a rankings section above the pipeline board
    const boardEl = document.getElementById('pipeline-board');
    if (!boardEl) return;

    // Create rankings container above the board
    let rankingsEl = document.getElementById('candidate-rankings-section');
    if (!rankingsEl) {
      rankingsEl = document.createElement('div');
      rankingsEl.id = 'candidate-rankings-section';
      rankingsEl.style.marginBottom = '20px';
      boardEl.parentElement.insertBefore(rankingsEl, boardEl.previousElementSibling);
    }

    rankingsEl.innerHTML = `
      <div class="card">
        <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
          <span class="text-card-title">🤖 AI Candidate Rankings</span>
          <span style="font-size:12px;color:var(--color-text-muted);">Powered by XGBoost</span>
        </div>
        <div class="card-body" style="padding:12px 24px;">
          <div style="display:flex;align-items:center;gap:8px;color:var(--color-text-muted);font-size:13px;">
            <span class="spinner" style="width:14px;height:14px;border-width:2px;"></span>
            Analysing candidates...
          </div>
        </div>
      </div>
    `;

    try {
      const response = await api.get(`/analytics/candidates/${jobId}/ranking/`);
      if (!response || !response.ok) {
        rankingsEl.innerHTML = '';
        return;
      }

      const data     = await response.json();
      const rankings = data.rankings || [];

      if (rankings.length === 0) {
        rankingsEl.innerHTML = '';
        return;
      }

      const insufficientData = data.insufficient_data;
      const labelColors = {
        Strong: 'var(--color-success)',
        Good:   'var(--color-blue-mid)',
        Fair:   'var(--color-orange)',
        Weak:   'var(--color-text-muted)',
      };

      rankingsEl.innerHTML = `
        <div class="card">
          <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
            <span class="text-card-title">🤖 AI Candidate Rankings</span>
            <span style="font-size:12px;color:var(--color-text-muted);">
              ${insufficientData
                ? 'Fallback scoring — more data needed for XGBoost'
                : `XGBoost · ${data.total} candidates`}
            </span>
          </div>
          <div class="card-body" style="padding:0;">
            ${rankings.map((r, i) => `
              <div style="display:flex;align-items:center;gap:16px;padding:12px 24px;
                          border-bottom:1px solid var(--color-border);
                          ${i === 0 ? 'background:var(--color-blue-light);' : ''}">
                <div style="font-size:18px;font-weight:700;color:var(--color-text-muted);
                             width:28px;text-align:center;flex-shrink:0;">
                  ${i + 1}
                </div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:13px;font-weight:600;color:var(--color-text-primary);">
                    ${r.candidate_name}
                  </div>
                  <div style="font-size:12px;color:var(--color-text-muted);margin-top:2px;">
                    Match: ${Math.round(r.features.match_score * 100)}%
                    · Skills: ${r.features.skill_match_pct}
                    ${r.features.interview_avg > 0
                      ? ` · Interview avg: ${r.features.interview_avg.toFixed(1)}/5`
                      : ''}
                  </div>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                  <div style="font-size:16px;font-weight:700;color:${labelColors[r.rank_label] || 'var(--color-text-muted)'};">
                    ${Math.round(r.rank_score * 100)}%
                  </div>
                  <div style="font-size:11px;color:${labelColors[r.rank_label] || 'var(--color-text-muted)'};">
                    ${r.rank_label}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

    } catch {
      if (rankingsEl) rankingsEl.innerHTML = '';
    }
  }


  function renderPipelineStats(apps) {
    const statsEl = document.getElementById('pipeline-stats');
    if (!statsEl) return;

    const total    = apps.length;
    const active   = apps.filter(a => !['hired','rejected'].includes(a.stage)).length;
    const hired    = apps.filter(a => a.stage === 'hired').length;
    const rejected = apps.filter(a => a.stage === 'rejected').length;

    statsEl.innerHTML = `
      <div class="stat-card">
        <div class="stat-card-label">Total Applicants</div>
        <div class="stat-card-value">${total}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Active</div>
        <div class="stat-card-value" style="color:var(--color-blue-mid);">${active}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Hired</div>
        <div class="stat-card-value" style="color:var(--color-success);">${hired}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Rejected</div>
        <div class="stat-card-value" style="color:var(--color-error);">${rejected}</div>
      </div>
    `;
  }

  function renderPipelineBoard(apps) {
    const boardEl = document.getElementById('pipeline-board');
    if (!boardEl) return;

    boardEl.innerHTML = STAGES.map(stage => {
      const stageApps = apps.filter(a => a.stage === stage.key);
      return `
        <div style="background:var(--color-bg);border-radius:8px;padding:10px;min-width:160px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="font-size:12px;font-weight:600;color:${stage.color};">
              ${stage.label}
            </div>
            <span style="background:var(--color-border);color:var(--color-text-muted);
                         font-size:11px;font-weight:600;padding:2px 6px;border-radius:8px;">
              ${stageApps.length}
            </span>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;min-height:40px;">
            ${stageApps.map(app => renderCandidateCard(app, stage)).join('')}
          </div>
        </div>
      `;
    }).join('');

    boardEl.querySelectorAll('[data-app-id]').forEach(card => {
      card.addEventListener('click', () => openCandidateDrawer(card.dataset.appId));
    });
  }

  function renderCandidateCard(app, stage) {
    return `
      <div
        data-app-id="${app.id}"
        style="
          background:var(--color-surface);
          border:1px solid var(--color-border);
          border-left:3px solid ${stage.color};
          border-radius:6px;
          padding:8px 10px;
          cursor:pointer;
          transition:box-shadow 0.15s ease;
        "
        onmouseenter="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)';"
        onmouseleave="this.style.boxShadow='';"
      >
        <div style="font-size:12px;font-weight:600;color:var(--color-text-primary);
                    margin-bottom:4px;word-break:break-word;">
          ${app.candidate_name}
        </div>
        <div style="font-size:11px;color:var(--color-text-muted);">
          ${new Date(app.created_at).toLocaleDateString()}
          ${app.has_resume ? ' · 📄' : ''}
        </div>
      </div>
    `;
  }

  // ── Candidate Drawer ──────────────────────────────────────

  function initCandidateDrawer() {
    const overlay   = document.getElementById('candidate-drawer-overlay');
    const closeBtn  = document.getElementById('candidate-drawer-close');
    const cancelBtn = document.getElementById('candidate-drawer-cancel');

    const close = () => {
      overlay?.classList.add('hidden');
      document.getElementById('candidate-drawer')?.classList.remove('open');
    };

    overlay?.addEventListener('click', close);
    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
  }

  function initJobChat() {
    const sendBtn = document.getElementById('btn-job-chat-send');
    const inputEl = document.getElementById('job-chat-input');
    const history = document.getElementById('job-chat-history');

    function formatMarkdownToHTML(text) {
      if (!text) return '';
      let escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

      escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      escaped = escaped.replace(/__([^_]+)__/g, '<strong>$1</strong>');
      escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      escaped = escaped.replace(/_([^_]+)_/g, '<em>$1</em>');
      escaped = escaped.replace(/^\s*[-*]\s+(.+)$/gm, '<div style="display:list-item; margin-left:20px; list-style-type:disc; margin-bottom:4px;">$1</div>');
      escaped = escaped.replace(/\n/g, '<br>');
      return escaped;
    }

    const handleSend = async () => {
      const question = inputEl?.value.trim();
      if (!question || !currentJobId) return;

      // Clear input
      inputEl.value = '';

      // Append user message
      const userMsg = document.createElement('div');
      userMsg.style.alignSelf = 'flex-end';
      userMsg.style.background = 'var(--color-blue-light)';
      userMsg.style.color = 'var(--color-blue-mid)';
      userMsg.style.padding = '8px 12px';
      userMsg.style.borderRadius = '12px 12px 0 12px';
      userMsg.style.maxWidth = '80%';
      userMsg.style.wordBreak = 'break-word';
      userMsg.innerHTML = `<strong>You:</strong> ${question}`;
      history?.appendChild(userMsg);
      history?.scrollTo(0, history.scrollHeight);

      // Append loading indicator
      const loader = document.createElement('div');
      loader.style.alignSelf = 'flex-start';
      loader.style.background = 'var(--color-bg)';
      loader.style.border = '1px solid var(--color-border)';
      loader.style.padding = '8px 12px';
      loader.style.borderRadius = '12px 12px 12px 0';
      loader.style.maxWidth = '80%';
      loader.id = 'job-chat-loader';
      loader.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;color:var(--color-text-muted);">
          <span class="spinner" style="width:12px;height:12px;border-width:2px;"></span>
          Thinking...
        </div>
      `;
      history?.appendChild(loader);
      history?.scrollTo(0, history.scrollHeight);

      try {
        const response = await api.post(`/hiring/jobs/${currentJobId}/chat/`, { question });
        loader.remove();

        const data = await response.json();
        const answer = data.answer || "No response received.";

        const assistantMsg = document.createElement('div');
        assistantMsg.style.alignSelf = 'flex-start';
        assistantMsg.style.background = 'var(--color-bg)';
        assistantMsg.style.border = '1px solid var(--color-border)';
        assistantMsg.style.padding = '8px 12px';
        assistantMsg.style.borderRadius = '12px 12px 12px 0';
        assistantMsg.style.maxWidth = '80%';
        assistantMsg.style.wordBreak = 'break-word';
        assistantMsg.innerHTML = `<strong>Assistant:</strong> ${formatMarkdownToHTML(answer)}`;
        history?.appendChild(assistantMsg);
        history?.scrollTo(0, history.scrollHeight);
      } catch (err) {
        loader.remove();
        const errEl = document.createElement('div');
        errEl.style.alignSelf = 'flex-start';
        errEl.style.color = 'var(--color-error)';
        errEl.style.fontSize = '12px';
        errEl.textContent = "Error: Failed to fetch response.";
        history?.appendChild(errEl);
        history?.scrollTo(0, history.scrollHeight);
      }
    };

    sendBtn?.addEventListener('click', handleSend);
    inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleSend();
      }
    });
  }

  async function openCandidateDrawer(applicationId) {
    const overlay = document.getElementById('candidate-drawer-overlay');
    const drawer  = document.getElementById('candidate-drawer');
    const body    = document.getElementById('candidate-drawer-body');
    const title   = document.getElementById('candidate-drawer-title');

    overlay?.classList.remove('hidden');
    drawer?.classList.add('open');
    if (body) body.innerHTML = `
      <div style="display:flex;justify-content:center;padding:48px;">
        <span class="spinner" style="width:24px;height:24px;border-width:2px;"></span>
      </div>
    `;

    try {
      const response = await api.get(`/hiring/applications/${applicationId}/`);
      if (!response || !response.ok) return;
      const app = await response.json();
      if (title) title.textContent = app.candidate_name;
      renderCandidateDrawer(app);
      // Load match analysis asynchronously after drawer renders
      loadMatchAnalysis(app.id);
    } catch {
      if (body) body.innerHTML = `<div class="empty-state"><div class="empty-state-title">Failed to load</div></div>`;
    }
  }

  function renderCandidateDrawer(app) {
    const body = document.getElementById('candidate-drawer-body');
    if (!body) return;

    const stageCfg = STAGES.find(s => s.key === app.stage)
      || { label: app.stage, badge: 'badge-grey' };

    body.innerHTML = `

      <!-- Personal info -->
      <div style="margin-bottom:20px;">
        <div style="font-size:13px;font-weight:600;color:var(--color-text-muted);
                    text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">
          Contact
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <div style="font-size:13px;"><strong>Email:</strong> ${app.candidate_email}</div>
          ${app.candidate_phone
            ? `<div style="font-size:13px;"><strong>Phone:</strong> ${app.candidate_phone}</div>`
            : ''}
          <div style="font-size:13px;">
            <strong>Applied:</strong> ${new Date(app.created_at).toLocaleDateString()}
          </div>
          <div style="margin-top:6px;">
            <span class="badge ${stageCfg.badge}">Current Stage: ${stageCfg.label}</span>
          </div>
        </div>
      </div>

      <!-- Resume -->
      <div style="margin-bottom:20px;">
        <div style="font-size:13px;font-weight:600;color:var(--color-text-muted);
                    text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">
          Resume
        </div>
        ${app.has_resume
          ? `<button
               onclick="downloadFile('/api/hiring/candidates/${app.candidate_id}/resume/', '${app.candidate_name.replace(/'/g, "\\'")}_resume.pdf')"
               class="btn btn-ghost btn-sm"
             >⬇ Download Resume (PDF)</button>`
          : `<div style="font-size:13px;color:var(--color-text-muted);">No resume uploaded.</div>`
        }
      </div>

      <!-- Match Analysis — Phase 4 AI -->
      <div style="margin-bottom:20px;" id="match-analysis-section-${app.id}">
        <div style="font-size:13px;font-weight:600;color:var(--color-text-muted);
                    text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">
          Resume Match
        </div>
        <div id="match-analysis-content-${app.id}">
          <div style="display:flex;align-items:center;gap:8px;color:var(--color-text-muted);font-size:13px;">
            <span class="spinner" style="width:14px;height:14px;border-width:2px;"></span>
            Analysing resume...
          </div>
        </div>
      </div>

      <!-- Stage actions -->
      <div style="margin-bottom:20px;">
        <div style="font-size:13px;font-weight:600;color:var(--color-text-muted);
                    text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">
          Move Stage
        </div>
        ${!['hired','rejected'].includes(app.stage)
          ? `<button
               class="btn btn-primary btn-sm"
               onclick="openMoveStageModal('${app.id}','${app.candidate_name.replace(/'/g,"\\'")}')"
             >Change Stage</button>`
          : `<div style="font-size:13px;color:var(--color-text-muted);">
               Pipeline complete — candidate has been ${app.stage}.
             </div>`
        }
      </div>

      <div class="divider"></div>

      <!-- Stage history -->
      <div style="margin-bottom:20px;">
        <div style="font-size:13px;font-weight:600;color:var(--color-text-muted);
                    text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">
          Stage History
        </div>
        ${app.stage_history && app.stage_history.length > 0
          ? app.stage_history.map(h => `
              <div style="padding:8px 0;border-bottom:1px solid var(--color-border);">
                <div style="font-size:12px;font-weight:600;color:var(--color-text-primary);">
                  ${h.from_stage ? `${h.from_stage} → ` : ''}${h.to_stage}
                </div>
                <div style="font-size:11px;color:var(--color-text-muted);">
                  by ${h.moved_by_name} · ${new Date(h.moved_at).toLocaleString()}
                </div>
                ${h.notes ? `<div style="font-size:12px;color:var(--color-text-secondary);margin-top:2px;">${h.notes}</div>` : ''}
              </div>
            `).join('')
          : `<div style="font-size:13px;color:var(--color-text-muted);">No history yet.</div>`
        }
      </div>

      <div class="divider"></div>

      <!-- Interview notes -->
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--color-text-muted);
                    text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">
          Interview Notes
        </div>
        <div id="drawer-interview-notes">
          ${app.interview_notes && app.interview_notes.length > 0
            ? app.interview_notes.map(n => `
                <div style="padding:10px 12px;background:var(--color-bg);
                            border-radius:6px;margin-bottom:8px;">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                    <div style="font-size:12px;font-weight:600;color:var(--color-navy);">
                      ${n.interviewer_name}
                    </div>
                    ${n.score
                      ? `<span style="font-size:13px;font-weight:700;color:var(--color-orange);">
                           ${n.score}/5
                         </span>`
                      : ''}
                  </div>
                  <div style="font-size:12px;color:var(--color-text-muted);margin-bottom:4px;">
                    ${new Date(n.created_at).toLocaleString()}
                  </div>
                  <div style="font-size:13px;color:var(--color-text-secondary);">${n.notes}</div>
                </div>
              `).join('')
            : `<div style="font-size:13px;color:var(--color-text-muted);margin-bottom:12px;">
                 No interview notes yet.
               </div>`
          }
        </div>

        <!-- Add note inline -->
        <div style="margin-top:12px;border-top:1px solid var(--color-border);padding-top:12px;">
          <div style="font-size:12px;font-weight:600;color:var(--color-navy);margin-bottom:8px;">
            Add Note
          </div>
          <div class="form-group">
            <select id="note-score" class="form-select" style="margin-bottom:8px;">
              <option value="">No score</option>
              <option value="5">5 — Excellent</option>
              <option value="4">4 — Good</option>
              <option value="3">3 — Average</option>
              <option value="2">2 — Below Average</option>
              <option value="1">1 — Poor</option>
            </select>
            <textarea
              id="note-content"
              class="form-input"
              rows="2"
              placeholder="Interview notes..."
            ></textarea>
          </div>
          <button
            class="btn btn-secondary btn-sm"
            id="btn-submit-note"
            data-app-id="${app.id}"
          >Post Note</button>
        </div>
      </div>
    `;

    // Wire note submission
    document.getElementById('btn-submit-note')
      ?.addEventListener('click', () => submitInterviewNote(app.id));
  }

  async function loadMatchAnalysis(applicationId) {
    const container = document.getElementById(`match-analysis-content-${applicationId}`);
    if (!container) return;

    try {
      const response = await api.get(`/hiring/applications/${applicationId}/match/`);
      if (!response || !response.ok) {
        container.innerHTML = `<div style="font-size:13px;color:var(--color-text-muted);">Match analysis unavailable.</div>`;
        return;
      }

      const data = await response.json();

      if (!data.resume_processed) {
        container.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;
                      background:var(--color-blue-light);border-radius:6px;">
            <span class="spinner" style="width:14px;height:14px;border-width:2px;flex-shrink:0;"></span>
            <span style="font-size:13px;color:var(--color-blue-mid);">
              Resume is being processed. Check back in a moment.
            </span>
          </div>
        `;
        return;
      }

      if (data.match_score === null) {
        container.innerHTML = `<div style="font-size:13px;color:var(--color-text-muted);">No resume uploaded for this candidate.</div>`;
        return;
      }

      const pct           = data.match_percentage || 0;
      const matched       = data.matched_skills   || [];
      const missing       = data.missing_skills   || [];
      const candidateOnly = (data.candidate_skills || []).filter(
        s => !matched.includes(s)
      ).slice(0, 8);

      // Score color
      const scoreColor = pct >= 70
        ? 'var(--color-success)'
        : pct >= 40
          ? 'var(--color-orange)'
          : 'var(--color-error)';

      container.innerHTML = `

        <!-- Overall score -->
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;
                    padding:14px 16px;background:var(--color-bg);border-radius:8px;
                    border:1px solid var(--color-border);">
          <div style="text-align:center;flex-shrink:0;">
            <div style="font-size:32px;font-weight:700;color:${scoreColor};line-height:1;">
              ${pct}%
            </div>
            <div style="font-size:11px;color:var(--color-text-muted);margin-top:2px;">
              Match Score
            </div>
          </div>
          <div style="flex:1;">
            <div style="height:8px;background:var(--color-border);border-radius:4px;overflow:hidden;margin-bottom:8px;">
              <div style="height:100%;width:${pct}%;background:${scoreColor};border-radius:4px;transition:width 0.5s ease;"></div>
            </div>
            <div style="font-size:12px;color:var(--color-text-muted);">
              ${matched.length} of ${(data.required_skills || []).length || '?'} required skills matched
            </div>
          </div>
        </div>

        <!-- Matched skills -->
        ${matched.length > 0 ? `
          <div style="margin-bottom:12px;">
            <div style="font-size:11px;font-weight:600;color:var(--color-success);
                        text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">
              ✓ Matched Skills (${matched.length})
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;">
              ${matched.map(s => `
                <span style="padding:3px 8px;background:var(--color-success-bg);
                             color:var(--color-success);border-radius:12px;font-size:11px;
                             font-weight:500;">${s}</span>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Missing skills -->
        ${missing.length > 0 ? `
          <div style="margin-bottom:12px;">
            <div style="font-size:11px;font-weight:600;color:var(--color-error);
                        text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">
              ✗ Missing Skills (${missing.length})
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;">
              ${missing.map(s => `
                <span style="padding:3px 8px;background:var(--color-error-bg);
                             color:var(--color-error);border-radius:12px;font-size:11px;
                             font-weight:500;">${s}</span>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Candidate's other skills -->
        ${candidateOnly.length > 0 ? `
          <div style="margin-bottom:4px;">
            <div style="font-size:11px;font-weight:600;color:var(--color-text-muted);
                        text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">
              Other Skills
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;">
              ${candidateOnly.map(s => `
                <span style="padding:3px 8px;background:var(--color-blue-light);
                             color:var(--color-blue-mid);border-radius:12px;font-size:11px;
                             font-weight:400;">${s}</span>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${data.cached ? `<div style="font-size:11px;color:var(--color-text-muted);margin-top:8px;">Cached result</div>` : ''}
      `;

    } catch {
      container.innerHTML = `<div style="font-size:13px;color:var(--color-text-muted);">Match analysis unavailable.</div>`;
    }
  }

  async function submitInterviewNote(applicationId) {
    const score   = document.getElementById('note-score')?.value || null;
    const content = document.getElementById('note-content')?.value.trim();
    const btn     = document.getElementById('btn-submit-note');

    if (!content) { Toast.error('Please write a note before posting.'); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Posting...'; }

    try {
      const response = await api.post(
        `/hiring/applications/${applicationId}/notes/`,
        { score: score ? parseInt(score) : null, notes: content }
      );

      if (response && response.ok) {
        const note = await response.json();
        const notesContainer = document.getElementById('drawer-interview-notes');
        const noNotes = notesContainer?.querySelector('[style*="No interview notes"]');
        if (noNotes) noNotes.remove();

        const noteEl = document.createElement('div');
        noteEl.style.cssText = 'padding:10px 12px;background:var(--color-bg);border-radius:6px;margin-bottom:8px;';
        noteEl.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <div style="font-size:12px;font-weight:600;color:var(--color-navy);">
              ${note.interviewer_name}
            </div>
            ${note.score
              ? `<span style="font-size:13px;font-weight:700;color:var(--color-orange);">${note.score}/5</span>`
              : ''}
          </div>
          <div style="font-size:12px;color:var(--color-text-muted);margin-bottom:4px;">Just now</div>
          <div style="font-size:13px;color:var(--color-text-secondary);">${note.notes}</div>
        `;
        notesContainer?.appendChild(noteEl);

        document.getElementById('note-content').value = '';
        document.getElementById('note-score').value   = '';
        Toast.success('Note added.');
      } else {
        Toast.error('Failed to add note.');
      }
    } catch { Toast.error('An error occurred.'); }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Post Note'; } }
  }

  // ── Post Job Modal ────────────────────────────────────────

  function initPostJobModal() {
    const modal     = document.getElementById('modal-post-job');
    const openBtn   = document.getElementById('btn-post-job');
    const closeBtn  = document.getElementById('modal-post-job-close');
    const cancelBtn = document.getElementById('modal-post-job-cancel');
    const submitBtn = document.getElementById('btn-submit-post-job');

    const resetForm = () => {
      ['job-title','job-department','job-description','job-requirements'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      document.getElementById('job-status').value = 'draft';
    };

    const close = () => { modal?.classList.add('hidden'); resetForm(); };

    openBtn?.addEventListener('click', () => modal?.classList.remove('hidden'));
    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
    modal?.addEventListener('click', (e) => { if (e.target === modal) close(); });
    submitBtn?.addEventListener('click', submitPostJob);
  }

  // Edit job modal — reuses post job modal
  window.openEditJobModal = function(jobId, title, department, currentStatus) {
    document.getElementById('job-title').value       = title;
    document.getElementById('job-department').value  = department || '';
    document.getElementById('job-status').value      = currentStatus;

    const submitBtn = document.getElementById('btn-submit-post-job');
    const titleEl   = document.querySelector('#modal-post-job .modal-title');
    if (titleEl) titleEl.textContent = 'Edit Job Posting';
    if (submitBtn) {
      submitBtn.textContent = 'Save Changes';
      submitBtn.dataset.editId = jobId;
    }
    document.getElementById('modal-post-job')?.classList.remove('hidden');
  };

  async function submitPostJob() {
    const title       = document.getElementById('job-title')?.value.trim();
    const department  = document.getElementById('job-department')?.value.trim();
    const description = document.getElementById('job-description')?.value.trim();
    const requirements = document.getElementById('job-requirements')?.value.trim();
    const status      = document.getElementById('job-status')?.value;
    const btn         = document.getElementById('btn-submit-post-job');
    const editId      = btn?.dataset.editId;

    if (!title) { Toast.error('Job title is required.'); return; }
    if (btn) { btn.disabled = true; btn.textContent = editId ? 'Saving...' : 'Creating...'; }

    try {
      const payload  = { title, department, description, requirements, status };
      const response = editId
        ? await api.patch(`/hiring/jobs/${editId}/`, payload)
        : await api.post('/hiring/jobs/', payload);

      if (response && (response.ok || response.status === 201)) {
        Toast.success(editId ? 'Job updated.' : 'Job posting created.');
        document.getElementById('modal-post-job')?.classList.add('hidden');

        // Reset edit state
        if (btn) { delete btn.dataset.editId; btn.textContent = 'Create Posting'; }
        const titleEl = document.querySelector('#modal-post-job .modal-title');
        if (titleEl) titleEl.textContent = 'Post a Job';

        loadJobs(jobsPage);
        loadStats();
      } else {
        const data = await response?.json();
        Toast.error(data?.error || 'Failed to save job posting.');
      }
    } catch { Toast.error('An error occurred.'); }
    finally { if (btn) { btn.disabled = false; } }
  }

  // ── Add Candidate Modal ───────────────────────────────────

  function initAddCandidateModal() {
    const modal     = document.getElementById('modal-add-candidate');
    const openBtn   = document.getElementById('btn-add-candidate');
    const closeBtn  = document.getElementById('modal-add-candidate-close');
    const cancelBtn = document.getElementById('modal-add-candidate-cancel');
    const submitBtn = document.getElementById('btn-submit-add-candidate');
    const dropZone  = document.getElementById('cand-drop-zone');
    const fileInput = document.getElementById('cand-resume-file');

    const resetForm = () => {
      ['cand-first-name','cand-last-name','cand-email','cand-phone'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      resetResumeSelection();
      const errEl = document.getElementById('add-candidate-error');
      if (errEl) errEl.style.display = 'none';
    };

    const close = () => { modal?.classList.add('hidden'); resetForm(); };

    openBtn?.addEventListener('click', () => { resetForm(); modal?.classList.remove('hidden'); });
    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
    modal?.addEventListener('click', (e) => { if (e.target === modal) close(); });

    // Drop zone
    dropZone?.addEventListener('click', () => fileInput?.click());
    dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor     = 'var(--color-blue-mid)';
      dropZone.style.backgroundColor = 'var(--color-blue-light)';
    });
    dropZone?.addEventListener('dragleave', () => {
      dropZone.style.borderColor     = 'var(--color-border)';
      dropZone.style.backgroundColor = 'var(--color-bg)';
    });
    dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor     = 'var(--color-border)';
      dropZone.style.backgroundColor = 'var(--color-bg)';
      const file = e.dataTransfer?.files[0];
      if (file) handleResumeSelected(file);
    });
    fileInput?.addEventListener('change', () => {
      if (fileInput.files?.[0]) handleResumeSelected(fileInput.files[0]);
    });
    document.getElementById('cand-remove-resume')
      ?.addEventListener('click', (e) => { e.stopPropagation(); resetResumeSelection(); });

    submitBtn?.addEventListener('click', submitAddCandidate);
  }
  
  function initBulkUploadModal() {
    const modal     = document.getElementById('modal-bulk-upload');
    const openBtn   = document.getElementById('btn-bulk-upload');
    const closeBtn  = document.getElementById('modal-bulk-upload-close');
    const cancelBtn = document.getElementById('modal-bulk-upload-cancel');
    const submitBtn = document.getElementById('btn-submit-bulk-upload');
    const dropZone  = document.getElementById('bulk-drop-zone');
    const fileInput = document.getElementById('bulk-resume-files');
    const previewEl = document.getElementById('bulk-files-preview');

    let selectedFiles = [];

    const resetForm = () => {
      selectedFiles = [];
      if (fileInput) fileInput.value = '';
      if (previewEl) {
        previewEl.innerHTML = '';
        previewEl.style.display = 'none';
      }
      const errEl = document.getElementById('bulk-upload-error');
      if (errEl) errEl.style.display = 'none';
    };

    const close = () => { modal?.classList.add('hidden'); resetForm(); };

    openBtn?.addEventListener('click', () => { resetForm(); modal?.classList.remove('hidden'); });
    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
    modal?.addEventListener('click', (e) => { if (e.target === modal) close(); });

    const handleFilesSelected = (files) => {
      selectedFiles = Array.from(files).filter(file => file.name.toLowerCase().endsWith('.pdf'));
      if (selectedFiles.length === 0) return;

      if (previewEl) {
        previewEl.innerHTML = selectedFiles.map(file => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;
                      background:var(--color-blue-light);border-radius:4px;font-size:12px;">
            <span style="color:var(--color-blue-mid);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:320px;">
              📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)
            </span>
          </div>
        `).join('');
        previewEl.style.display = 'flex';
      }
    };

    dropZone?.addEventListener('click', () => fileInput?.click());
    dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor     = 'var(--color-blue-mid)';
      dropZone.style.backgroundColor = 'var(--color-blue-light)';
    });
    dropZone?.addEventListener('dragleave', () => {
      dropZone.style.borderColor     = 'var(--color-border)';
      dropZone.style.backgroundColor = 'var(--color-bg)';
    });
    dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor     = 'var(--color-border)';
      dropZone.style.backgroundColor = 'var(--color-bg)';
      if (e.dataTransfer?.files) handleFilesSelected(e.dataTransfer.files);
    });

    fileInput?.addEventListener('change', () => {
      if (fileInput.files) handleFilesSelected(fileInput.files);
    });

    const submitBulkUpload = async () => {
      if (!currentJobId || selectedFiles.length === 0) {
        Toast.error('Please select at least one PDF resume.');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px;"></span>Uploading...';
      }

      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('resumes', file);
      });

      try {
        const access = TokenStore.getAccess();
        const response = await fetch(`/api/hiring/jobs/${currentJobId}/bulk-upload/`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${access}` },
          body: formData,
        });

        if (response.ok || response.status === 201) {
          const data = await response.json();
          Toast.success(`Successfully uploaded ${data.uploaded_count} resumes.`);
          close();
          loadPipeline(currentJobId);
          loadStats();
        } else {
          const data = await response.json();
          const errEl = document.getElementById('bulk-upload-error');
          if (errEl) {
            errEl.textContent = data.error || 'Failed to upload resumes.';
            errEl.style.display = 'block';
          }
        }
      } catch {
        Toast.error('An error occurred during bulk upload.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Upload Resumes';
        }
      }
    };

    submitBtn?.addEventListener('click', submitBulkUpload);
  }

  function handleResumeSelected(file) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      Toast.error('Resume must be a PDF file.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      Toast.error('Resume file must not exceed 20MB.');
      return;
    }
    const dropZone   = document.getElementById('cand-drop-zone');
    const selectedEl = document.getElementById('cand-selected-resume');
    const nameEl     = document.getElementById('cand-resume-name');
    const fileInput  = document.getElementById('cand-resume-file');

    if (dropZone)   dropZone.style.display   = 'none';
    if (selectedEl) selectedEl.style.display = 'flex';
    if (nameEl) nameEl.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

    if (fileInput) {
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
      } catch { /* file already set via file input change event */ }
    }
  }

  function resetResumeSelection() {
    const dropZone   = document.getElementById('cand-drop-zone');
    const selectedEl = document.getElementById('cand-selected-resume');
    const fileInput  = document.getElementById('cand-resume-file');
    if (dropZone)   dropZone.style.display   = 'block';
    if (selectedEl) selectedEl.style.display = 'none';
    if (fileInput)  fileInput.value           = '';
  }

  async function submitAddCandidate() {
    if (!currentJobId) return;

    const firstName = document.getElementById('cand-first-name')?.value.trim();
    const lastName  = document.getElementById('cand-last-name')?.value.trim();
    const email     = document.getElementById('cand-email')?.value.trim();
    const phone     = document.getElementById('cand-phone')?.value.trim();
    const fileInput = document.getElementById('cand-resume-file');
    const errEl     = document.getElementById('add-candidate-error');
    const btn       = document.getElementById('btn-submit-add-candidate');

    if (errEl) errEl.style.display = 'none';

    if (!firstName || !lastName || !email) {
      if (errEl) {
        errEl.textContent = 'First name, last name, and email are required.';
        errEl.style.display = 'block';
      }
      return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px;"></span>Adding...'; }

    try {
      const formData = new FormData();
      formData.append('first_name', firstName);
      formData.append('last_name',  lastName);
      formData.append('email',      email);
      formData.append('phone',      phone);
      if (fileInput?.files?.[0]) {
        formData.append('resume', fileInput.files[0]);
      }

      const access   = TokenStore.getAccess();
      const response = await fetch(`/api/hiring/jobs/${currentJobId}/applications/`, {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${access}` },
        body:    formData,
      });

      if (response.ok || response.status === 201) {
        Toast.success('Candidate added to pipeline.');
        document.getElementById('modal-add-candidate')?.classList.add('hidden');
        loadPipeline(currentJobId);
        loadStats();
      } else {
        const data = await response.json();
        const msg  = data?.error || 'Failed to add candidate.';
        if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
      }
    } catch {
      if (errEl) { errEl.textContent = 'An error occurred.'; errEl.style.display = 'block'; }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Add to Pipeline'; }
    }
  }

  // ── Move Stage Modal ──────────────────────────────────────

  function initMoveStageModal() {
    const modal     = document.getElementById('modal-move-stage');
    const closeBtn  = document.getElementById('modal-move-stage-close');
    const cancelBtn = document.getElementById('modal-move-stage-cancel');
    const submitBtn = document.getElementById('btn-submit-move-stage');
    const stageSelect = document.getElementById('move-stage-select');
    const reasonGroup = document.getElementById('rejection-reason-group');

    const resetForm = () => {
      document.getElementById('move-application-id').value = '';
      document.getElementById('move-candidate-name').textContent = '';
      if (stageSelect) stageSelect.value = 'applied';
      if (reasonGroup) reasonGroup.style.display = 'none';
      const notes = document.getElementById('move-stage-notes');
      if (notes) notes.value = '';
    };

    const close = () => { modal?.classList.add('hidden'); resetForm(); };

    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
    modal?.addEventListener('click', (e) => { if (e.target === modal) close(); });

    stageSelect?.addEventListener('change', (e) => {
      if (reasonGroup) {
        reasonGroup.style.display = e.target.value === 'rejected' ? 'block' : 'none';
      }
    });

    submitBtn?.addEventListener('click', submitMoveStage);
  }

  window.openMoveStageModal = function(applicationId, candidateName) {
    document.getElementById('move-application-id').value = applicationId;
    document.getElementById('move-candidate-name').textContent = candidateName;
    document.getElementById('move-stage-select').value = 'applied';
    document.getElementById('move-stage-notes').value = '';
    
    const reasonGroup = document.getElementById('rejection-reason-group');
    if (reasonGroup) reasonGroup.style.display = 'none';
    
    document.getElementById('modal-move-stage')?.classList.remove('hidden');
  };

  async function submitMoveStage() {
    const applicationId    = document.getElementById('move-application-id')?.value;
    const stage            = document.getElementById('move-stage-select')?.value;
    const rejectionReason  = document.getElementById('move-rejection-reason')?.value;
    const notes            = document.getElementById('move-stage-notes')?.value.trim();
    const btn              = document.getElementById('btn-submit-move-stage');

    if (!applicationId || !stage) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Confirming...'; }

    try {
      const payload = { stage, notes };
      if (stage === 'rejected') {
        payload.rejection_reason = rejectionReason;
      }

      const response = await api.patch(`/hiring/applications/${applicationId}/stage/`, payload);
      if (response && response.ok) {
        Toast.success('Candidate moved successfully.');
        document.getElementById('modal-move-stage')?.classList.add('hidden');
        
        // Reload current state
        if (currentJobId) {
          loadPipeline(currentJobId);
        }
        loadStats();
        
        // If drawer is open, refresh it
        const drawer = document.getElementById('candidate-drawer');
        if (drawer && drawer.classList.contains('open')) {
          openCandidateDrawer(applicationId);
        }
      } else {
        const data = await response?.json();
        Toast.error(data?.error || 'Failed to move candidate.');
      }
    } catch { Toast.error('An error occurred.'); }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Confirm Move'; } }
  }

}

function renderCandidates(list) {
  // Not used in new dynamic job-board pipeline flow.
}

// 6. Database & Documents panel
function initDocumentsPanel() {
  initDocsTabs();
  loadPlatformAdminTab();
  loadDocumentManagementTab();
}

// === TAB SWITCHING ===
function initDocsTabs() {
  const tabs = document.querySelectorAll('.docs-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;

      // Update tab buttons
      tabs.forEach(t => {
        const isActive = t.dataset.tab === targetTab;
        t.style.borderBottomColor = isActive ? 'var(--color-orange)' : 'transparent';
        t.style.color = isActive ? 'var(--color-orange)' : 'var(--color-text-muted)';
        t.classList.toggle('active', isActive);
      });

      // Update content visibility
      document.querySelectorAll('.docs-tab-content').forEach(content => {
        content.style.display = content.id === `tab-${targetTab}` ? 'block' : 'none';
      });
    });
  });
}

// === TAB 1: PLATFORM ADMIN ===
let allUsers = []; // Cache for user filtering

async function loadPlatformAdminTab() {
  try {
    // 1. Load Org Settings
    const settingsLoading = document.getElementById('org-settings-loading');
    const settingsForm = document.getElementById('org-settings-form');
    
    const res = await api.get('/tenants/me/');
    if (res && res.ok) {
      const orgData = await res.json();
      document.getElementById('org-name-display').textContent = orgData.name || '—';
      document.getElementById('org-plan-display').textContent = (orgData.plan || '—').toUpperCase();
      document.getElementById('org-created-display').textContent = orgData.created_at ? new Date(orgData.created_at).toLocaleDateString() : '—';
      document.getElementById('settings-max-users').value = orgData.settings?.max_users || 0;
      document.getElementById('settings-max-docs').value = orgData.settings?.max_documents || 0;
      
      if (settingsLoading) settingsLoading.style.display = 'none';
      if (settingsForm) settingsForm.style.display = 'block';
    } else {
      if (settingsLoading) settingsLoading.textContent = 'Failed to load organization settings.';
    }

    // Save Settings Event Listener
    const saveSettingsBtn = document.getElementById('btn-save-settings');
    if (saveSettingsBtn) {
      // Recreate to clear old listeners
      const newSaveSettingsBtn = saveSettingsBtn.cloneNode(true);
      saveSettingsBtn.parentNode.replaceChild(newSaveSettingsBtn, saveSettingsBtn);
      newSaveSettingsBtn.addEventListener('click', async () => {
        const maxUsers = parseInt(document.getElementById('settings-max-users').value) || 0;
        const maxDocs = parseInt(document.getElementById('settings-max-docs').value) || 0;

        newSaveSettingsBtn.disabled = true;
        const patchRes = await api.patch('/tenants/settings/', {
          max_users: maxUsers,
          max_documents: maxDocs
        });
        newSaveSettingsBtn.disabled = false;

        if (patchRes && patchRes.ok) {
          Toast.success('Organization settings updated successfully!');
        } else {
          Toast.error('Failed to update settings.');
        }
      });
    }

    // 2. Load Users List
    await refreshUsersList();

    // User Search input handler
    const userSearchInput = document.getElementById('user-search');
    if (userSearchInput) {
      userSearchInput.addEventListener('input', () => {
        const query = userSearchInput.value.toLowerCase();
        const filtered = allUsers.filter(u => 
          (u.first_name + ' ' + u.last_name).toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query)
        );
        renderUsersTable(filtered);
      });
    }

    // Modal triggers: Edit user role modal close/cancel
    setupUserModals();

    // 3. Load Audit Logs (Page 1)
    await loadAuditLogs(1);

  } catch (err) {
    console.error(err);
  }
}

async function refreshUsersList() {
  const res = await api.get('/auth/users/');
  if (res && res.ok) {
    allUsers = await res.json();
    renderUsersTable(allUsers);
  }
}

function renderUsersTable(list) {
  const container = document.getElementById('users-table-body');
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--color-text-muted);">No users found.</td></tr>`;
    return;
  }

  container.innerHTML = list.map(u => {
    const isSelf = u.id === currentUser.id;
    const name = `${u.first_name} ${u.last_name}`;
    const badgeClass = u.role === 'admin' ? 'badge-orange' : u.role === 'hr' ? 'badge-yellow' : u.role === 'manager' ? 'badge-blue' : 'badge-grey';
    const statusBadge = u.is_active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-red">Deactivated</span>';
    
    // Toggle active actions
    const toggleText = u.is_active ? 'Deactivate' : 'Activate';
    const toggleClass = u.is_active ? 'btn-danger' : 'btn-primary';
    const actions = isSelf ? `—` : `
      <div style="display:flex;gap:6px;">
        <button class="btn btn-ghost btn-xs edit-user-btn" data-id="${u.id}" data-name="${name}" data-email="${u.email}" data-role="${u.role}">Edit Role</button>
        <button class="btn ${toggleClass} btn-xs toggle-user-btn" data-id="${u.id}" data-active="${u.is_active}">${toggleText}</button>
      </div>
    `;

    return `
      <tr>
        <td><span style="font-weight:600;color:var(--color-text-primary);">${name} ${isSelf ? '(You)' : ''}</span></td>
        <td>${u.email}</td>
        <td><span class="badge ${badgeClass}">${u.role}</span></td>
        <td>${statusBadge}</td>
        <td>${u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
        <td>${actions}</td>
      </tr>
    `;
  }).join('');

  // Bind Actions in Table
  container.querySelectorAll('.toggle-user-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.id;
      const currentActive = btn.dataset.active === 'true';
      btn.disabled = true;
      const res = await api.patch(`/auth/users/${userId}/`, { is_active: !currentActive });
      btn.disabled = false;
      if (res && res.ok) {
        Toast.success(`User successfully ${!currentActive ? 'activated' : 'deactivated'}.`);
        await refreshUsersList();
      } else {
        Toast.error('Failed to toggle user status.');
      }
    });
  });

  container.querySelectorAll('.edit-user-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = document.getElementById('modal-edit-user');
      document.getElementById('edit-user-id').value = btn.dataset.id;
      document.getElementById('edit-user-name-display').textContent = btn.dataset.name;
      document.getElementById('edit-user-email-display').textContent = btn.dataset.email;
      document.getElementById('edit-user-role').value = btn.dataset.role;
      modal.classList.remove('hidden');
    });
  });
}

function setupUserModals() {
  const modal = document.getElementById('modal-edit-user');
  const closeBtn = document.getElementById('modal-user-close');
  const cancelBtn = document.getElementById('modal-user-cancel');
  const formBtn = document.getElementById('btn-submit-user-edit');
  const roleSelect = document.getElementById('edit-user-role');

  const closeModal = () => modal && modal.classList.add('hidden');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  if (formBtn) {
    const newFormBtn = formBtn.cloneNode(true);
    formBtn.parentNode.replaceChild(newFormBtn, formBtn);
    newFormBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const userId = document.getElementById('edit-user-id').value;
      const role = roleSelect.value;

      newFormBtn.disabled = true;
      const res = await api.patch(`/auth/users/${userId}/`, { role });
      newFormBtn.disabled = false;

      if (res && res.ok) {
        Toast.success('User role updated successfully.');
        closeModal();
        await refreshUsersList();
      } else {
        Toast.error('Failed to update user role.');
      }
    });
  }
}

async function loadAuditLogs(page) {
  const res = await api.get(`/auth/audit-log/?page=${page}`);
  const container = document.getElementById('audit-log-body');
  const pagination = document.getElementById('audit-log-pagination');
  if (!container) return;

  if (!res || !res.ok) {
    container.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--color-text-muted);">Failed to load audit logs.</td></tr>`;
    return;
  }

  const data = await res.json();

  if (!data || !data.results || data.results.length === 0) {
    container.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--color-text-muted);">No audit events recorded.</td></tr>`;
    if (pagination) pagination.innerHTML = '';
    return;
  }

  container.innerHTML = data.results.map(log => `
    <tr>
      <td><span style="font-size:13px;color:var(--color-text-muted);">${new Date(log.created_at).toLocaleString()}</span></td>
      <td><strong>${log.actor}</strong></td>
      <td><span class="badge badge-blue">${log.action}</span></td>
      <td><span style="font-size:13px;font-family:monospace;color:var(--color-text-muted);">${log.target_type} (${log.target_id.substring(0, 8)})</span></td>
      <td><span style="font-size:13px;">${log.detail || '—'}</span></td>
    </tr>
  `).join('');

  // Handle Pagination
  if (pagination) {
    pagination.innerHTML = '';
    
    if (data.previous || data.next) {
      const prevBtn = document.createElement('button');
      prevBtn.className = 'btn btn-ghost btn-xs';
      prevBtn.textContent = '← Previous';
      prevBtn.disabled = !data.previous;
      prevBtn.style.marginRight = '8px';
      if (data.previous) {
        prevBtn.addEventListener('click', () => loadAuditLogs(page - 1));
      }

      const nextBtn = document.createElement('button');
      nextBtn.className = 'btn btn-ghost btn-xs';
      nextBtn.textContent = 'Next →';
      nextBtn.disabled = !data.next;
      if (data.next) {
        nextBtn.addEventListener('click', () => loadAuditLogs(page + 1));
      }

      pagination.appendChild(prevBtn);
      
      const pageInfo = document.createElement('span');
      pageInfo.style.fontSize = '13px';
      pageInfo.style.color = 'var(--color-text-muted)';
      pageInfo.style.margin = '0 12px';
      pageInfo.textContent = `Page ${page}`;
      pagination.appendChild(pageInfo);
      
      pagination.appendChild(nextBtn);
    }
  }
}

// === TAB 2: DOCUMENT MANAGEMENT ===

async function loadDocumentManagementTab() {
  await refreshDocumentStats();
  await loadDocumentsList(1);
  setupDocumentModals();
}

function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function refreshDocumentStats() {
  const res = await api.get('/knowledge/documents/stats/');
  if (res && res.ok) {
    const data = await res.json();
    document.getElementById('stat-total-docs').textContent = `${data.total_documents} / ${data.max_documents}`;
    document.getElementById('stat-storage').textContent = formatBytes(data.total_size_bytes);
    
    const searchable = data.by_status.find(s => s.status === 'searchable')?.count || 0;
    const processing = data.by_status.find(s => s.status === 'processing')?.count || 0;
    
    document.getElementById('stat-searchable').textContent = searchable;
    document.getElementById('stat-processing').textContent = processing;
  } else {
    document.getElementById('stat-total-docs').textContent = '—';
    document.getElementById('stat-storage').textContent = '—';
    document.getElementById('stat-searchable').textContent = '—';
    document.getElementById('stat-processing').textContent = '—';
  }
}

async function loadDocumentsList(page) {
  const container = document.getElementById('docs-table-body');
  const pagination = document.getElementById('docs-pagination');
  if (!container) return;

  // Build filters
  const search = document.getElementById('doc-search').value;
  const status = document.getElementById('doc-filter-status').value;
  const fileType = document.getElementById('doc-filter-type').value;

  let query = `?page=${page}`;
  if (search) query += `&search=${encodeURIComponent(search)}`;
  if (status) query += `&status=${encodeURIComponent(status)}`;
  if (fileType) query += `&file_type=${encodeURIComponent(fileType)}`;

  const res = await api.get(`/knowledge/documents/${query}`);

  if (!res || !res.ok) {
    container.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--color-text-muted);">Failed to load documents.</td></tr>`;
    return;
  }

  const data = await res.json();

  if (!data || !data.results || data.results.length === 0) {
    container.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--color-text-muted);">No documents found.</td></tr>`;
    if (pagination) pagination.innerHTML = '';
    return;
  }

  container.innerHTML = data.results.map(doc => {
    const statusColors = {
      'uploaded': 'badge-grey',
      'processing': 'badge-blue',
      'searchable': 'badge-green',
      'failed': 'badge-red'
    };
    const statusText = doc.status.charAt(0).toUpperCase() + doc.status.slice(1);
    const category = doc.metadata?.category || 'Uncategorized';
    
    return `
      <tr>
        <td><span style="font-weight:600;color:var(--color-text-primary);">${doc.title}</span></td>
        <td><span class="badge badge-grey">${doc.file_type.toUpperCase()}</span></td>
        <td><span class="badge badge-blue">${category}</span></td>
        <td>${doc.uploaded_by_name}</td>
        <td>${doc.file_size_display}</td>
        <td><span class="badge ${statusColors[doc.status] || 'badge-grey'}">${statusText}</span></td>
        <td>${new Date(doc.created_at).toLocaleDateString()}</td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-ghost btn-xs reprocess-doc-btn" data-id="${doc.id}">Reprocess</button>
            <button class="btn btn-ghost btn-xs edit-doc-btn" data-id="${doc.id}" data-title="${doc.title}" data-category="${category}" data-keywords="${doc.metadata?.keywords ? doc.metadata.keywords.join(', ') : ''}">Edit</button>
            <button class="btn btn-danger btn-xs delete-doc-btn" data-id="${doc.id}" data-title="${doc.title}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Bind row action listeners
  container.querySelectorAll('.reprocess-doc-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const reprocessRes = await api.post(`/knowledge/documents/${btn.dataset.id}/reprocess/`);
      btn.disabled = false;
      if (reprocessRes && reprocessRes.ok) {
        Toast.success('NLP reprocessing queued.');
        await refreshDocumentStats();
        await loadDocumentsList(page);
      } else {
        Toast.error('Failed to trigger reprocessing.');
      }
    });
  });

  container.querySelectorAll('.edit-doc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = document.getElementById('modal-edit-doc');
      document.getElementById('edit-doc-id').value = btn.dataset.id;
      document.getElementById('edit-doc-title').value = btn.dataset.title;
      document.getElementById('edit-doc-category').value = btn.dataset.category === 'Uncategorized' ? '' : btn.dataset.category;
      document.getElementById('edit-doc-keywords').value = btn.dataset.keywords;
      modal.classList.remove('hidden');
    });
  });

  container.querySelectorAll('.delete-doc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = document.getElementById('modal-confirm-delete');
      document.getElementById('delete-doc-id').value = btn.dataset.id;
      document.getElementById('delete-doc-name').textContent = btn.dataset.title;
      modal.classList.remove('hidden');
    });
  });

  // Pagination Controls
  if (pagination) {
    pagination.innerHTML = '';
    
    if (data.previous || data.next) {
      const prevBtn = document.createElement('button');
      prevBtn.className = 'btn btn-ghost btn-xs';
      prevBtn.textContent = '← Previous';
      prevBtn.disabled = !data.previous;
      prevBtn.style.marginRight = '8px';
      if (data.previous) {
        prevBtn.addEventListener('click', () => loadDocumentsList(page - 1));
      }

      const nextBtn = document.createElement('button');
      nextBtn.className = 'btn btn-ghost btn-xs';
      nextBtn.textContent = 'Next →';
      nextBtn.disabled = !data.next;
      if (data.next) {
        nextBtn.addEventListener('click', () => loadDocumentsList(page + 1));
      }

      pagination.appendChild(prevBtn);
      
      const pageInfo = document.createElement('span');
      pageInfo.style.fontSize = '13px';
      pageInfo.style.color = 'var(--color-text-muted)';
      pageInfo.style.margin = '0 12px';
      pageInfo.textContent = `Page ${page}`;
      pagination.appendChild(pageInfo);
      
      pagination.appendChild(nextBtn);
    }
  }
}

function setupDocumentModals() {
  // Bind Document filters
  const searchInput = document.getElementById('doc-search');
  const statusFilter = document.getElementById('doc-filter-status');
  const typeFilter = document.getElementById('doc-filter-type');

  const onFilterChange = () => loadDocumentsList(1);

  if (searchInput) {
    searchInput.addEventListener('input', debounce(onFilterChange, 300));
  }
  if (statusFilter) statusFilter.addEventListener('change', onFilterChange);
  if (typeFilter) typeFilter.addEventListener('change', onFilterChange);

  // Modal 1: Upload Documents (Bulk)
  const uploadModal = document.getElementById('modal-upload');
  const uploadBtn   = document.getElementById('btn-upload-doc');
  const uploadClose = document.getElementById('modal-upload-close');
  const uploadCancel = document.getElementById('modal-upload-cancel');
  const submitUploadBtn = document.getElementById('btn-submit-upload');

  // Track selected files
  let docSelectedFiles = [];

  const renderDocFilePreview = () => {
    const preview = document.getElementById('doc-files-preview');
    if (!preview) return;
    if (docSelectedFiles.length === 0) {
      preview.style.display = 'none';
      preview.innerHTML = '';
      return;
    }
    preview.style.display = 'flex';
    preview.innerHTML = docSelectedFiles.map((f, i) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;
                  background:var(--color-surface);border-radius:4px;font-size:13px;">
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80%;">📄 ${f.name}</span>
        <button data-idx="${i}" style="background:none;border:none;cursor:pointer;color:var(--color-text-muted);font-size:16px;line-height:1;padding:0 4px;">&times;</button>
      </div>`).join('');
    preview.querySelectorAll('button[data-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        docSelectedFiles.splice(parseInt(btn.dataset.idx), 1);
        renderDocFilePreview();
      });
    });
  };

  const openUpload = () => {
    uploadModal && uploadModal.classList.remove('hidden');
    docSelectedFiles = [];
    renderDocFilePreview();
    const errBox = document.getElementById('doc-upload-error');
    if (errBox) { errBox.style.display = 'none'; errBox.textContent = ''; }
  };
  const closeUpload = () => {
    uploadModal && uploadModal.classList.add('hidden');
    const cat = document.getElementById('upload-category');
    const fi  = document.getElementById('upload-file');
    if (cat) cat.value = '';
    if (fi)  fi.value  = '';
    docSelectedFiles = [];
    renderDocFilePreview();
  };

  if (uploadBtn)    uploadBtn.addEventListener('click', openUpload);
  if (uploadClose)  uploadClose.addEventListener('click', closeUpload);
  if (uploadCancel) uploadCancel.addEventListener('click', closeUpload);

  // Drag & drop for Documents bulk upload
  const docDropZone = document.getElementById('doc-drop-zone');
  const docFileInput = document.getElementById('upload-file');

  const addDocFiles = (newFiles) => {
    const allowed = ['pdf', 'docx', 'txt'];
    Array.from(newFiles).forEach(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      if (!allowed.includes(ext)) return;
      if (docSelectedFiles.length >= 10) return;
      docSelectedFiles.push(f);
    });
    renderDocFilePreview();
  };

  if (docDropZone && docFileInput) {
    docDropZone.addEventListener('click', () => docFileInput.click());
    docDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      docDropZone.style.borderColor = 'var(--color-orange)';
      docDropZone.style.background  = 'var(--color-orange-subtle, rgba(255,140,0,0.05))';
    });
    docDropZone.addEventListener('dragleave', () => {
      docDropZone.style.borderColor = 'var(--color-border)';
      docDropZone.style.background  = 'var(--color-bg)';
    });
    docDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      docDropZone.style.borderColor = 'var(--color-border)';
      docDropZone.style.background  = 'var(--color-bg)';
      addDocFiles(e.dataTransfer.files);
    });
    docFileInput.addEventListener('change', () => {
      addDocFiles(docFileInput.files);
      docFileInput.value = '';
    });
  }

  if (submitUploadBtn) {
    const newSubmitBtn = submitUploadBtn.cloneNode(true);
    submitUploadBtn.parentNode.replaceChild(newSubmitBtn, submitUploadBtn);
    newSubmitBtn.addEventListener('click', async () => {
      if (docSelectedFiles.length === 0) {
        Toast.error('Please select at least one file to upload.');
        return;
      }

      const category = document.getElementById('upload-category')?.value || '';
      const errBox   = document.getElementById('doc-upload-error');

      newSubmitBtn.disabled     = true;
      newSubmitBtn.textContent  = 'Uploading…';

      const formData = new FormData();
      if (category) formData.append('category', category);
      docSelectedFiles.forEach(f => formData.append('files', f));

      try {
        const token   = TokenStore.getAccess();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        const response = await fetch('/api/knowledge/upload/', {
          method: 'POST',
          headers,
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          Toast.success(`${data.uploaded_count} document${data.uploaded_count !== 1 ? 's' : ''} uploaded successfully.`);
          closeUpload();
          await refreshDocumentStats();
          await loadDocumentsList(1);
        } else {
          const errData = await response.json().catch(() => ({}));
          const msg = errData.error || errData.detail || 'Failed to upload documents.';
          if (errBox) { errBox.textContent = msg; errBox.style.display = 'block'; }
          else Toast.error(msg);
        }
      } catch (err) {
        Toast.error('Network error uploading files.');
      } finally {
        newSubmitBtn.disabled    = false;
        newSubmitBtn.textContent = 'Upload Documents';
      }
    });
  }


  // Modal 2: Edit Document
  const editModal = document.getElementById('modal-edit-doc');
  const editClose = document.getElementById('modal-edit-close');
  const editCancel = document.getElementById('modal-edit-cancel');
  const submitEditBtn = document.getElementById('btn-submit-edit');

  const closeEdit = () => editModal && editModal.classList.add('hidden');
  if (editClose) editClose.addEventListener('click', closeEdit);
  if (editCancel) editCancel.addEventListener('click', closeEdit);

  if (submitEditBtn) {
    const newSubmitEditBtn = submitEditBtn.cloneNode(true);
    submitEditBtn.parentNode.replaceChild(newSubmitEditBtn, submitEditBtn);
    newSubmitEditBtn.addEventListener('click', async () => {
      const id = document.getElementById('edit-doc-id').value;
      const title = document.getElementById('edit-doc-title').value.trim();
      const category = document.getElementById('edit-doc-category').value;
      const keywordsRaw = document.getElementById('edit-doc-keywords').value;
      const keywords = keywordsRaw ? keywordsRaw.split(',').map(k => k.trim()).filter(k => k.length > 0) : [];

      if (!title) {
        Toast.error('Title is required.');
        return;
      }

      newSubmitEditBtn.disabled = true;
      const editRes = await api.patch(`/knowledge/documents/${id}/`, { title, category, keywords });
      newSubmitEditBtn.disabled = false;

      if (editRes && editRes.ok) {
        Toast.success('Document updated successfully.');
        closeEdit();
        await loadDocumentsList(1);
      } else {
        Toast.error('Failed to update document metadata.');
      }
    });
  }

  // Modal 3: Delete Document
  const deleteModal = document.getElementById('modal-confirm-delete');
  const deleteClose = document.getElementById('modal-delete-close');
  const deleteCancel = document.getElementById('modal-delete-cancel');
  const confirmDeleteBtn = document.getElementById('btn-confirm-delete');

  const closeDelete = () => deleteModal && deleteModal.classList.add('hidden');
  if (deleteClose) deleteClose.addEventListener('click', closeDelete);
  if (deleteCancel) deleteCancel.addEventListener('click', closeDelete);

  if (confirmDeleteBtn) {
    const newConfirmDeleteBtn = confirmDeleteBtn.cloneNode(true);
    confirmDeleteBtn.parentNode.replaceChild(newConfirmDeleteBtn, confirmDeleteBtn);
    newConfirmDeleteBtn.addEventListener('click', async () => {
      const id = document.getElementById('delete-doc-id').value;
      newConfirmDeleteBtn.disabled = true;
      
      const deleteRes = await api.delete(`/knowledge/documents/${id}/`);
      newConfirmDeleteBtn.disabled = false;
      
      if (deleteRes && deleteRes.ok) {
        Toast.success('Document deleted successfully.');
        closeDelete();
        await refreshDocumentStats();
        await loadDocumentsList(1);
      } else {
        Toast.error('Failed to delete document.');
      }
    });
  }
}
// Helper: Debounce utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Global authenticated download helper
window.downloadFile = async function(url, defaultFilename) {
  try {
    const token = TokenStore.getAccess();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Fetch the file contents using JWT headers
    const response = await fetch(url, { headers: headers });
    
    if (!response.ok) {
      throw new Error('Download failed: ' + response.statusText);
    }
    
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    
    // Parse content-disposition header if present
    const disposition = response.headers.get('content-disposition');
    let filename = defaultFilename;
    if (disposition && disposition.indexOf('attachment') !== -1) {
      const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
      const matches = filenameRegex.exec(disposition);
      if (matches != null && matches[1]) {
        filename = matches[1].replace(/['"]/g, '');
      }
    }
    
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  } catch (err) {
    Toast.error('Download failed. Please try again.');
    console.error(err);
  }
};
