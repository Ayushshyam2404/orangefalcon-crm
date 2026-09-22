const PERMISSION_GROUPS = [
  {
    key: 'shared', label: 'Shared Workspace', description: 'Personal and company-wide tools available across departments.',
    items: [
      { key: 'profile', label: 'My Profile', description: 'View and update the user’s own profile.' },
      { key: 'attendance', label: 'Time Clock & Work History', description: 'Clock in/out, take breaks, and view personal attendance.' },
      { key: 'leaveRequests', label: 'My Leave Requests', description: 'View and submit personal leave requests.' },
      { key: 'calendar', label: 'Calendar', description: 'View or manage company events.' },
      { key: 'announcements', label: 'Announcements', description: 'View or publish company announcements.' },
      { key: 'globalSearch', label: 'Global Search', description: 'Search across other permitted CRM records.' },
    ],
  },
  {
    key: 'sales', label: 'Sales', description: 'Hotel sales, RFP, lead, call, and revenue workflows.',
    items: [
      { key: 'dashboard', label: 'Sales Dashboard', description: 'Sales overview and dashboard widgets.' },
      { key: 'rfps', label: 'RFP Tracker', description: 'View or manage standard RFP records.' },
      { key: 'rfpConsideration', label: 'RFP Consideration', description: 'View or manage the consideration queue.' },
      { key: 'calls', label: 'Sales Calls', description: 'View, import, log, and update sales calls.' },
      { key: 'hotels', label: 'Sales Hotel List', description: 'View or manage hotels used by Sales.' },
      { key: 'groups', label: 'Groups', description: 'View or manage group business.' },
      { key: 'revenueAnalytics', label: 'Revenue Analytics', description: 'View group and revenue analytics.' },
      { key: 'tasks', label: 'Sales Tasks & Routines', description: 'View or manage daily sales work.' },
      { key: 'leads', label: 'Inbound Leads', description: 'View or manage inbound leads.' },
      { key: 'corporate', label: 'Corporate Profiles', description: 'View or manage corporate contacts.' },
    ],
  },
  {
    key: 'reputation', label: 'Reputation', description: 'Hotel reputation scoring and outreach.',
    items: [
      { key: 'reputationDashboard', label: 'Reputation Dashboard', description: 'Reputation performance overview.' },
      { key: 'hotelScores', label: 'Hotels & Scores', description: 'View or manage reputation hotels and score entries.' },
      { key: 'reputationTasks', label: 'Reputation Tasks & Routines', description: 'View or manage daily reputation work.' },
      { key: 'reputationCalls', label: 'Reputation Calls', description: 'View, import, log, and update reputation calls.' },
    ],
  },
  {
    key: 'marketing', label: 'Marketing', description: 'Content, video, graphics, and campaign work.',
    items: [
      { key: 'marketingDashboard', label: 'Marketing Dashboard', description: 'Marketing activity overview.' },
      { key: 'marketingTasks', label: 'Marketing Tasks & Routines', description: 'View or manage content and campaign work.' },
    ],
  },
  {
    key: 'operations', label: 'Operations', description: 'Executive-assistance and operational work.',
    items: [
      { key: 'operationsDashboard', label: 'Operations Dashboard', description: 'Operations activity overview.' },
      { key: 'operationsTasks', label: 'Operations Tasks & Routines', description: 'View or manage daily operations work.' },
    ],
  },
  {
    key: 'internal-sales', label: 'Internal Sales', description: 'The company’s own product-sales work.',
    items: [
      { key: 'internalSalesDashboard', label: 'Internal Sales Dashboard', description: 'Internal product-sales overview.' },
      { key: 'internalSalesTasks', label: 'Internal Sales Tasks & Routines', description: 'View or manage product-sales work.' },
    ],
  },
  {
    key: 'properties', label: 'Properties', description: 'Combined sales and reputation property snapshots.',
    items: [{ key: 'properties', label: 'Manage Properties', description: 'View combined property cards and details.' }],
  },
  {
    key: 'people', label: 'People & Attendance', description: 'Team oversight and account administration.',
    items: [
      { key: 'executiveOverview', label: 'Company Overview', description: 'View company-wide department, attendance, task, and warning summaries.' },
      { key: 'employeeBehaviour', label: 'Employee Behaviour & Attendance', description: 'View team attendance, hours, warnings, and reports.' },
      { key: 'leaveApprovals', label: 'Leave Approvals', description: 'View or approve/deny employee leave requests.' },
      { key: 'userManagement', label: 'User Accounts', description: 'View or create, edit, and remove regular users.' },
    ],
  },
  {
    key: 'administration', label: 'Administration', description: 'Individual settings areas and administrative actions.',
    items: [
      { key: 'appearance', label: 'Appearance', description: 'Access theme and visual preferences.' },
      { key: 'companySettings', label: 'Company Settings', description: 'Branding, work timings, and inactivity rules.' },
      { key: 'reportRecipients', label: 'Report Recipients', description: 'View or change scheduled-report recipients.' },
      { key: 'backupRestore', label: 'Backup & Restore', description: 'Export backups or restore CRM data.' },
      { key: 'dailyReports', label: 'Send Daily Reports', description: 'Trigger company activity reports.' },
      { key: 'alerts', label: 'Alerts', description: 'View or clear system alerts.' },
    ],
  },
];

const PERMISSION_MODULES = PERMISSION_GROUPS.flatMap(group => group.items.map(item => item.key));

const DEPARTMENT_MODULES = {
  sales: ['profile', 'attendance', 'leaveRequests', 'globalSearch', 'dashboard', 'rfps', 'rfpConsideration', 'calls', 'hotels', 'groups', 'revenueAnalytics', 'tasks', 'leads', 'corporate', 'calendar', 'announcements'],
  reputation: ['profile', 'attendance', 'leaveRequests', 'globalSearch', 'reputationDashboard', 'hotelScores', 'reputationTasks', 'reputationCalls', 'calendar', 'announcements'],
  marketing: ['profile', 'attendance', 'leaveRequests', 'globalSearch', 'marketingDashboard', 'marketingTasks', 'calendar', 'announcements'],
  operations: ['profile', 'attendance', 'leaveRequests', 'globalSearch', 'operationsDashboard', 'operationsTasks', 'calendar', 'announcements', 'properties'],
  'internal-sales': ['profile', 'attendance', 'leaveRequests', 'globalSearch', 'internalSalesDashboard', 'internalSalesTasks', 'calendar', 'announcements'],
  management: PERMISSION_MODULES,
};

function fullPermissions() {
  return Object.fromEntries(PERMISSION_MODULES.map(key => [key, { read: true, write: true }]));
}

function defaultPermissions(department = 'sales', role = 'staff') {
  if (role === 'admin') return fullPermissions();
  const allowed = new Set(DEPARTMENT_MODULES[department] || DEPARTMENT_MODULES.sales);
  // Hotel records are shared reference data. Department staff can use the list,
  // while a manager/master can explicitly grant editing when it is part of the job.
  const readOnlyByDefault = new Set(['hotels']);
  return Object.fromEntries(PERMISSION_MODULES.map(key => [key, {
    read: allowed.has(key),
    write: allowed.has(key) && !readOnlyByDefault.has(key),
  }]));
}

function permissionFor(user, module) {
  if (!module) return { read: true, write: true };
  if (user?.isMaster) return { read: true, write: true };
  const defaults = defaultPermissions(user?.department, user?.role);
  const explicit = user?.permissions?.get ? user.permissions.get(module) : user?.permissions?.[module];
  return explicit ? { read: explicit.read === true, write: explicit.write === true } : (defaults[module] || { read: false, write: false });
}

module.exports = { PERMISSION_GROUPS, PERMISSION_MODULES, DEPARTMENT_MODULES, fullPermissions, defaultPermissions, permissionFor };
