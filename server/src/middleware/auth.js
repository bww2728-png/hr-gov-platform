/**
 * Authentication middleware - verifies JWT cookie and loads user with role + scopes.
 */
const { verifyToken, COOKIE_NAME } = require('../utils/jwt');
const prisma = require('../prisma');
const { t, detectLang } = require('../i18n');

async function authenticate(req, res, next) {
  try {
    const lang = detectLang(req);
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: t(lang, 'err.unauthorized') });

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(401).json({ error: t(lang, 'err.session_expired') });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        role: true,
        employee: { include: { branch: true, department: true, position: true } },
        scopes: true,
      },
    });
    if (!user || user.status !== 'active' || user.tokenVersion !== payload.tv) {
      return res.status(401).json({ error: t(lang, 'err.session_invalid') });
    }

    // Check lock
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(423).json({ error: t(lang, 'err.locked') });
    }

    req.user = user;
    req.lang = lang;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Permission middleware. Accepts permission code(s) like 'hr.employee.write'.
 * Checks user.role.permissions json array.
 */
function _require(...codes) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: req.lang ? 'Unauthenticated' : 'غير مصدق' });
    const userPerms = Array.isArray(req.user.role?.permissions) ? req.user.role.permissions : [];
    const has = codes.some((c) => userPerms.includes(c) || userPerms.includes('*'));
    if (!has) {
      return res.status(403).json({ error: req.lang && req.lang === 'en' ? 'Forbidden: insufficient permissions' : 'ممنوع: صلاحيات غير كافية' });
    }
    next();
  };
}

/**
 * Scope-aware branch/department check for data isolation.
 * Returns an Express middleware that restricts a query by branchId / deptId
 * based on user's user_scopes rows.
 */
function scopeFilter(req) {
  // الأدوار الشاملة ترى كل شيء (بدون نطاقات)
  const code = req.user.role?.code;
  if (['sysadmin', 'ceo', 'hr_director', 'auditor', 'security_admin', 'data_analyst', 'compliance_officer', 'executive', 'hr_admin'].includes(code)) return {};
  // Build filter from user_scopes
  const branchIds = req.user.scopes
    .filter((s) => s.scopeType === 'branch')
    .map((s) => s.scopeId);
  const regionIds = req.user.scopes
    .filter((s) => s.scopeType === 'region')
    .map((s) => s.scopeId);
  const deptIds = req.user.scopes
    .filter((s) => s.scopeType === 'department')
    .map((s) => s.scopeId);

  const filter = {};
  if (branchIds.length) filter.branchId = { in: branchIds };
  if (regionIds.length) filter.branch = { regionId: { in: regionIds } };
  if (deptIds.length) filter.deptId = { in: deptIds };
  return filter;
}

module.exports = { authenticate, require: _require, scopeFilter, COOKIE_NAME, hasPermission: _require };