const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { permissionFor } = require('../config/permissions');

function resolvePermissionModule(req) {
  const base = req.baseUrl;
  const category = req.query?.category || req.body?.category;
  if (base === '/api/rfps') return (req.query?.consideration !== undefined || req.body?.inConsideration !== undefined) ? 'rfpConsideration' : 'rfps';
  if (base === '/api/groups') return req.path.startsWith('/revenue-analytics') ? 'revenueAnalytics' : 'groups';
  if (base === '/api/tasks' || base === '/api/routines') {
    if (!category && !['GET', 'POST'].includes(req.method)) return null;
    return category === 'reputation' ? 'reputationTasks'
      : category === 'marketing' ? 'marketingTasks'
      : category === 'operations' ? 'operationsTasks'
      : category === 'internal-sales' ? 'internalSalesTasks' : 'tasks';
  }
  if (base === '/api/calls') {
    if (!category && !['GET', 'POST'].includes(req.method)) return null;
    return category === 'reputation' ? 'reputationCalls' : 'calls';
  }
  if (base === '/api/hotel-scores') return 'hotelScores';
  if (base === '/api/hotels') {
    if (!category && !['GET', 'POST'].includes(req.method)) return null;
    return category === 'reputation' ? 'hotelScores' : 'hotels';
  }
  if (base === '/api/attendance') {
    if (req.path.startsWith('/admin/leaves') || req.path.endsWith('/status')) return 'leaveApprovals';
    if (req.path.startsWith('/leaves')) return 'leaveRequests';
    if (req.path.startsWith('/admin') || (req.path === '/' && req.method === 'POST')) return 'employeeBehaviour';
    return 'attendance';
  }
  return {
    '/api/leads': 'leads',
    '/api/corporate': 'corporate', '/api/events': 'calendar',
    '/api/announcements': 'announcements', '/api/properties': 'properties',
    '/api/users': 'userManagement', '/api/alerts': 'alerts', '/api/search': 'globalSearch',
    '/api/report': 'dailyReports', '/api/backup': 'backupRestore', '/api/overview': 'executiveOverview',
  }[base] || null;
}

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ message: 'Not authorized, no token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    const module = resolvePermissionModule(req);
    if (module) {
      const action = ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? 'read' : 'write';
      if (!permissionFor(req.user, module)[action]) {
        return res.status(403).json({ message: `Admin or configured ${action} access to ${module} is required` });
      }
    }
    next();
  } catch {
    res.status(401).json({ message: 'Not authorized, invalid token' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.isMaster)) return next();
  res.status(403).json({ message: 'Admin access required' });
};

const masterOnly = (req, res, next) => {
  if (req.user?.isMaster) return next();
  res.status(403).json({ message: 'Master access required' });
};

const requirePermission = (module, action = 'read') => (req, res, next) => {
  const permission = permissionFor(req.user, module);
  if (permission[action]) return next();
  res.status(403).json({ message: `${action === 'write' ? 'Write' : 'Read'} access to ${module} is required` });
};

const requireAnyPermission = (modules, action = 'read') => (req, res, next) => {
  if (modules.some(module => permissionFor(req.user, module)[action])) return next();
  res.status(403).json({ message: `${action === 'write' ? 'Write' : 'Read'} access to one of ${modules.join(', ')} is required` });
};

module.exports = { protect, adminOnly, masterOnly, requirePermission, requireAnyPermission };
