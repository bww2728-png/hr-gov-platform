/**
 * Admin routes - Users, Roles, Scopes, Integrations, Audit, Settings
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../prisma');
const { authenticate, require: requirePerm } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { PERMISSIONS, listAllCodes } = require('../permissions');

const router = express.Router();

// =========== USERS ===========

router.get('/users', authenticate, requirePerm('admin.user.read'), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        role: { select: { code: true, nameAr: true, nameEn: true } },
        employee: { select: { id: true, employeeNumber: true, fullNameAr: true, fullNameEn: true } },
        scopes: true,
      },
      orderBy: { fullNameAr: 'asc' },
    });
    res.json({ users });
  } catch (e) { next(e); }
});

const userSchema = z.object({
  username: z.string().min(3).max(50),
  fullNameAr: z.string().min(2),
  fullNameEn: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  password: z.string().min(8).max(200),
  roleId: z.number().int(),
  employeeId: z.string().uuid().optional().nullable(),
  status: z.enum(['active','inactive','locked']).default('active'),
  languagePref: z.enum(['ar','en']).default('ar'),
  mfaEnabled: z.boolean().default(false),
});

router.post('/users', authenticate, requirePerm('admin.user.write'), async (req, res, next) => {
  try {
    const data = userSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password, 10);
    const { password, ...rest } = data;
    const user = await prisma.user.create({ data: { ...rest, passwordHash } });
    audit(req, 'admin.user.create', { entityType: 'user', entityId: user.id });
    res.status(201).json({ user: { id: user.id, username: user.username, fullNameAr: user.fullNameAr } });
  } catch (e) { next(e); }
});

router.patch('/users/:id', authenticate, requirePerm('admin.user.write'), async (req, res, next) => {
  try {
    const data = userSchema.partial().parse(req.body);
    const updateData = { ...data };
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
      delete updateData.password;
    }
    const user = await prisma.user.update({ where: { id: req.params.id }, data: updateData });
    audit(req, 'admin.user.update', { entityType: 'user', entityId: user.id });
    res.json({ user });
  } catch (e) { next(e); }
});

router.post('/users/:id/reset-password', authenticate, requirePerm('admin.user.write'), async (req, res, next) => {
  try {
    const { newPassword } = z.object({ newPassword: z.string().min(8).max(200) }).parse(req.body);
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash, mustChangePassword: true, tokenVersion: { increment: 1 } },
    });
    audit(req, 'admin.user.reset_password', { entityType: 'user', entityId: req.params.id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// =========== ROLES ===========

router.get('/roles', authenticate, requirePerm('admin.role.read'), async (req, res, next) => {
  try {
    const roles = await prisma.role.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { nameAr: 'asc' },
    });
    res.json({ roles });
  } catch (e) { next(e); }
});

const roleSchema = z.object({
  code: z.string().min(2).max(50),
  nameAr: z.string().min(2),
  nameEn: z.string().min(2),
  description: z.string().optional().nullable(),
  permissions: z.array(z.string()),
  isSystem: z.boolean().default(false),
});

router.post('/roles', authenticate, requirePerm('admin.role.write'), async (req, res, next) => {
  try {
    const data = roleSchema.parse(req.body);
    const role = await prisma.role.create({ data });
    audit(req, 'admin.role.create', { entityType: 'role', entityId: role.id });
    res.status(201).json({ role });
  } catch (e) { next(e); }
});

router.patch('/roles/:id', authenticate, requirePerm('admin.role.write'), async (req, res, next) => {
  try {
    const data = roleSchema.partial().parse(req.body);
    const role = await prisma.role.update({ where: { id: parseInt(req.params.id, 10) }, data });
    audit(req, 'admin.role.update', { entityType: 'role', entityId: role.id });
    res.json({ role });
  } catch (e) { next(e); }
});

router.get('/permissions/catalog', authenticate, requirePerm('admin.role.read'), (req, res) => {
  res.json({ catalog: PERMISSIONS, allCodes: listAllCodes() });
});

// =========== SCOPES ===========

router.get('/scopes/:userId', authenticate, requirePerm('admin.user.read'), async (req, res, next) => {
  try {
    const scopes = await prisma.userScope.findMany({ where: { userId: req.params.userId } });
    res.json({ scopes });
  } catch (e) { next(e); }
});

router.put('/scopes/:userId', authenticate, requirePerm('admin.scope.write'), async (req, res, next) => {
  try {
    const { scopes } = z.object({
      scopes: z.array(z.object({
        scopeType: z.enum(['region','branch','department']),
        scopeId: z.number().int(),
        canRead: z.boolean().default(true),
        canWrite: z.boolean().default(false),
        canApprove: z.boolean().default(false),
        canDelete: z.boolean().default(false),
      })),
    }).parse(req.body);
    await prisma.userScope.deleteMany({ where: { userId: req.params.userId } });
    for (const s of scopes) {
      await prisma.userScope.create({ data: { ...s, userId: req.params.userId } });
    }
    audit(req, 'admin.scope.update', { entityType: 'user', entityId: req.params.userId });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// =========== INTEGRATIONS ===========

router.get('/integrations', authenticate, requirePerm('admin.integration.read'), async (req, res, next) => {
  try {
    const endpoints = await prisma.integrationEndpoint.findMany({
      include: { _count: { select: { logs: true } } },
      orderBy: { code: 'asc' },
    });
    res.json({ endpoints });
  } catch (e) { next(e); }
});

const integrationSchema = z.object({
  code: z.string().min(2),
  nameAr: z.string().min(2),
  nameEn: z.string().min(2),
  baseUrl: z.string().url(),
  authType: z.enum(['api_key','oauth','basic','none']).default('api_key'),
  configJson: z.any().optional().nullable(),
  isActive: z.boolean().default(true),
});

router.post('/integrations', authenticate, requirePerm('admin.integration.write'), async (req, res, next) => {
  try {
    const data = integrationSchema.parse(req.body);
    const ep = await prisma.integrationEndpoint.create({ data });
    audit(req, 'admin.integration.create', { entityType: 'integration_endpoint', entityId: ep.id });
    res.status(201).json({ endpoint: ep });
  } catch (e) { next(e); }
});

// =========== AUDIT ===========

router.get('/audit', authenticate, requirePerm('admin.audit.read'), async (req, res, next) => {
  try {
    const { userId, action, entityType, entityId, from, to, limit = 100 } = req.query;
    const where = {};
    if (userId) where.userId = String(userId);
    if (action) where.action = String(action);
    if (entityType) where.entityType = String(entityType);
    if (entityId) where.entityId = String(entityId);
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(String(from));
      if (to) where.createdAt.lte = new Date(String(to));
    }
    const logs = await prisma.auditLog.findMany({
      where,
      include: { user: { select: { username: true, fullNameAr: true, fullNameEn: true } } },
      orderBy: { id: 'desc' },
      take: Math.min(parseInt(limit, 10), 500),
    });
    res.json({ logs: logs.map((l) => ({ ...l, id: Number(l.id) })) });
  } catch (e) { next(e); }
});

// =========== SESSIONS (مسؤول النظام/الأمن) ===========

router.get('/sessions', authenticate, requirePerm('admin.sessions.manage', 'security.sessions.read'), async (req, res, next) => {
  try {
    const sessions = await prisma.userSession.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { select: { username: true, fullNameAr: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ sessions: sessions.map((s) => ({ ...s, refreshTokenHash: undefined })) });
  } catch (e) { next(e); }
});

router.post('/sessions/:id/revoke', authenticate, requirePerm('admin.sessions.manage', 'security.sessions.revoke'), async (req, res, next) => {
  try {
    const session = await prisma.userSession.update({
      where: { id: req.params.id },
      data: { revokedAt: new Date() },
    });
    audit(req, 'admin.session.revoke', { entityType: 'user_session', entityId: req.params.id });
    res.json({ ok: true, session: { id: session.id, revokedAt: session.revokedAt } });
  } catch (e) { next(e); }
});

// =========== SECURITY EVENTS ===========

router.get('/security-events', authenticate, requirePerm('security.events.read', 'admin.audit.read'), async (req, res, next) => {
  try {
    const { type, severity, limit = 100 } = req.query;
    const where = {};
    if (type) where.type = String(type);
    if (severity) where.severity = String(severity);
    const events = await prisma.securityEvent.findMany({ where, orderBy: { id: 'desc' }, take: Math.min(parseInt(limit, 10), 500) });
    res.json({ events: events.map((e) => ({ ...e, id: Number(e.id) })) });
  } catch (e) { next(e); }
});

router.post('/security-events', authenticate, requirePerm('security.events.write'), async (req, res, next) => {
  try {
    const data = z.object({
      userId: z.string().uuid().optional().nullable(),
      type: z.string().min(3).max(60),
      severity: z.enum(['info', 'warning', 'critical']).default('info'),
      details: z.any().optional(),
    }).parse(req.body);
    const event = await prisma.securityEvent.create({
      data: { ...data, ipAddress: req.ip || null },
    });
    res.status(201).json({ event });
  } catch (e) { next(e); }
});

// =========== SOFT DELETE / RESTORE (مسؤول النظام) ===========

const SOFT_DELETABLE = {
  employee: () => prisma.employee,
  user: () => prisma.user,
  knowledge_document: () => prisma.knowledgeDocument,
  policy: () => prisma.policy,
};

router.get('/deleted', authenticate, requirePerm('admin.softdelete.restore'), async (req, res, next) => {
  try {
    const out = {};
    const [employees, users] = await Promise.all([
      prisma.employee.findMany({ where: { deletedAt: { not: null } }, select: { id: true, fullNameAr: true, employeeNumber: true, deletedAt: true } }),
      prisma.user.findMany({ where: { deletedAt: { not: null } }, select: { id: true, username: true, fullNameAr: true, deletedAt: true } }),
    ]);
    out.employees = employees;
    out.users = users;
    res.json(out);
  } catch (e) { next(e); }
});

router.post('/restore', authenticate, requirePerm('admin.softdelete.restore'), async (req, res, next) => {
  try {
    const { entity, id } = z.object({ entity: z.enum(['employee', 'user']), id: z.string() }).parse(req.body);
    const model = SOFT_DELETABLE[entity]();
    const before = await model.findUnique({ where: { id } });
    if (!before || !before.deletedAt) return res.status(404).json({ error: 'السجل غير موجود أو غير محذوف' });
    await model.update({ where: { id }, data: { deletedAt: null } });
    audit(req, `admin.${entity}.restore`, { entityType: entity, entityId: id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/users/:id', authenticate, requirePerm('admin.user.write'), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'لا يمكن حذف حسابك الحالي' });
    await prisma.user.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), status: 'inactive', tokenVersion: { increment: 1 } } });
    audit(req, 'admin.user.soft_delete', { entityType: 'user', entityId: req.params.id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// =========== WORKFLOW SIMULATION (مسؤول النظام) ===========

router.post('/workflow/simulate', authenticate, requirePerm('admin.workflow.simulate'), async (req, res, next) => {
  try {
    const { definitionCode, payload } = z.object({
      definitionCode: z.string().min(1),
      payload: z.any().optional(),
    }).parse(req.body);
    const def = await prisma.workflowDefinition.findFirst({ where: { code: definitionCode, isActive: true } });
    if (!def) return res.status(404).json({ error: 'تعريف سير العمل غير موجود' });
    const steps = Array.isArray(def.definitionJson?.steps) ? def.definitionJson.steps : [];
    // محاكاة: تتبع المسار بدون إنشاء سجلات فعلية
    const trace = steps.map((s, i) => ({
      order: i + 1,
      step: s.nameAr || s.name || `خطوة ${i + 1}`,
      approverRole: s.code || null,
      slaMins: s.slaMins || null,
      simulatedDecision: 'approve',
    }));
    audit(req, 'admin.workflow.simulate', { entityType: 'workflow_definition', entityId: String(def.id) });
    res.json({ definition: { code: def.code, nameAr: def.nameAr }, stepsCount: steps.length, trace, payloadEcho: payload || null });
  } catch (e) { next(e); }
});

// =========== SETTINGS ===========

router.get('/settings', authenticate, async (req, res, next) => {
  try {
    const settings = await prisma.setting.findMany();
    const obj = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    res.json({ settings: obj });
  } catch (e) { next(e); }
});

router.put('/settings', authenticate, requirePerm('admin.settings.write'), async (req, res, next) => {
  try {
    const { settings } = z.object({ settings: z.record(z.any()) }).parse(req.body);
    for (const [key, value] of Object.entries(settings)) {
      await prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
    audit(req, 'admin.settings.update', { afterJson: settings });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;